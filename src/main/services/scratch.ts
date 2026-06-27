import { BrowserWindow, ipcMain, app } from 'electron'
import { join, resolve, basename } from 'path'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import JSZip from 'jszip'
import { getScratch } from '../database/repositories/settings'
import * as ideaRepo from '../database/repositories/ideas'
import * as resourceRepo from '../database/repositories/resources'
import type { ArchiveTarget, IdeaVersion, Resource, ScratchSavePayload, VersionMeta } from '@shared/types'

let scratchWin: BrowserWindow | null = null
let mainWindowRef: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

function workspaceDir(): string {
  const s = getScratch()
  if (s.workspaceDir) return s.workspaceDir
  return join(app.getPath('userData'), 'scratch-projects')
}

/** 资源根目录，用于 read-resource 路径白名单校验 */
function resourcesRoot(): string {
  return join(app.getPath('userData'), 'resources')
}

/**
 * 校验路径必须位于允许的根目录内，防止 scratch-gui 页面读取任意本地文件。
 * 允许：userData/resources、userData/scratch-projects、scratch 工作目录。
 */
function assertSafePath(filePath: string): void {
  const allowedRoots = [resourcesRoot(), workspaceDir()].map((p) => resolve(p))
  const target = resolve(filePath)
  const safe = allowedRoots.some((root) => target === root || target.startsWith(root + '\\') || target.startsWith(root + '/'))
  if (!safe) {
    throw new Error(`禁止访问资源目录之外的文件：${filePath}`)
  }
}

/** 净化文件名：去除路径分隔符与危险字符，仅保留安全字符 */
function safeFileName(name: string): string {
  const base = basename(name)
  return base.replace(/[^\w.\u4e00-\u9fa5-]/g, '_') || 'untitled'
}

/** 启动 Scratch 编辑器窗口，可选加载某版本 */
export async function launch(versionId?: string): Promise<void> {
  // 已存在窗口：聚焦并加载请求的版本（而非忽略 versionId）
  if (scratchWin && !scratchWin.isDestroyed()) {
    scratchWin.focus()
    if (versionId) await loadVersionInto(scratchWin, versionId)
    return
  }
  const settings = getScratch()
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'Scratch 编辑器',
    webPreferences: {
      preload: join(__dirname, '../preload/scratch.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  scratchWin = win

  // 窗口生命周期监听：关闭/崩溃时清理引用
  win.on('closed', () => {
    if (scratchWin === win) scratchWin = null
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[scratch] 编辑器渲染进程崩溃', details)
    if (!win.isDestroyed()) win.destroy()
    if (scratchWin === win) scratchWin = null
  })

  const target = resolveGuiTarget(settings.guiUrl)
  try {
    if (target.type === 'url') {
      await win.loadURL(target.url)
    } else {
      await win.loadFile(target.path)
    }
  } catch (e) {
    console.error('[scratch] 加载 Scratch GUI 失败', e)
    if (!win.isDestroyed()) win.destroy()
    scratchWin = null
    throw new Error(
      target.type === 'url'
        ? '无法加载 Scratch 编辑器，请检查设置中的 GUI 地址'
        : '无法加载内置 Scratch 编辑器，请在「设置 → Scratch」中配置外部 GUI 地址'
    )
  }

  if (versionId) await loadVersionInto(win, versionId)
}

/**
 * 解析 Scratch GUI 加载目标：
 * 1) http(s) URL → loadURL（外部服务）
 * 2) 本地文件路径 → loadFile（用户自定义打包版本）
 * 3) 内置打包版本 → loadFile（resources/scratch-gui/index.html）
 * 4) 全部缺失 → 抛出明确错误，提示用户在设置中配置
 */
function resolveGuiTarget(
  guiUrl: string
): { type: 'url'; url: string } | { type: 'file'; path: string } {
  const url = (guiUrl || '').trim()
  if (/^https?:\/\//i.test(url)) {
    return { type: 'url', url }
  }
  // 内置打包版本（packaged: resourcesPath/scratch-gui；dev: resources/scratch-gui）
  const builtinDir = app.isPackaged
    ? join(process.resourcesPath, 'scratch-gui')
    : join(app.getAppPath(), 'resources', 'scratch-gui')
  const builtinIndex = join(builtinDir, 'index.html')
  if (existsSync(builtinIndex)) {
    // 若用户填写的是本地路径且存在，优先使用；否则使用内置版本
    if (url && existsSync(url)) return { type: 'file', path: url }
    return { type: 'file', path: builtinIndex }
  }
  if (url && existsSync(url)) {
    return { type: 'file', path: url }
  }
  throw new Error(
    '未找到 Scratch 编辑器：内置版本缺失且未配置 GUI 地址。请前往「设置 → Scratch」填写本地路径或服务地址。'
  )
}

/** 读取版本 .sb3 的 project.json 并注入到指定窗口 */
async function loadVersionInto(win: BrowserWindow, versionId: string): Promise<void> {
  const version = ideaRepo.getVersion(versionId)
  if (!version?.filePath || !existsSync(version.filePath)) return
  try {
    const projectJson = await readSb3ProjectJson(version.filePath)
    // 等待页面完成基础加载后再发送，避免监听尚未注册导致消息丢失
    await new Promise<void>((resolveWait) => {
      if (!win.webContents.isLoading()) resolveWait()
      else win.webContents.once('did-finish-load', () => resolveWait())
    })
    win.webContents.send('scratch:load-project', projectJson)
  } catch (e) {
    console.error('[scratch] 加载版本失败', e)
  }
}

export function close(): void {
  if (scratchWin && !scratchWin.isDestroyed()) scratchWin.destroy()
  scratchWin = null
}

/** 注册 Scratch 相关 IPC（在 app ready 时调用） */
export function registerScratchIpc(): void {
  // 接收 scratch-gui 保存事件
  ipcMain.on('scratch:save', (_e, payload: ScratchSavePayload) => {
    // 转发给主窗口渲染进程，弹出归档对话框
    mainWindowRef?.webContents.send('scratch:save-request', payload)
  })

  // scratch-gui 请求资源库
  ipcMain.on('scratch:request-resources', () => {
    const list = resourceRepo.list().map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      filePath: r.filePath
    }))
    scratchWin?.webContents.send('scratch:resources', list)
  })

  // scratch-gui 读取本地资源文件 -> base64（路径必须位于资源/工作目录白名单内）
  ipcMain.handle('scratch:read-resource', async (_e, filePath: string) => {
    try {
      assertSafePath(filePath)
      const buf = await readFile(filePath)
      return { ok: true, data: buf.toString('base64') }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}

/** 保存到点子库：打包 .sb3 并写库 */
export async function saveToIdea(
  payload: ScratchSavePayload,
  target: ArchiveTarget
): Promise<IdeaVersion> {
  // 净化 ideaId 与 versionName，防止路径遍历
  const safeIdeaId = target.ideaId.replace(/[^\w-]/g, '')
  if (!safeIdeaId) throw new Error('无效的点子 ID')
  const dir = join(workspaceDir(), safeIdeaId)
  await mkdir(dir, { recursive: true })
  const safeName = safeFileName(target.versionName)
  const filePath = join(dir, `${safeName}-${Date.now()}.sb3`)
  const sb3 = await packSb3(payload.projectJson)
  await writeFile(filePath, sb3)
  return ideaRepo.createVersion({
    ideaId: target.ideaId,
    versionName: target.versionName,
    notes: target.notes,
    filePath
  })
}

/** 保存到资源库（作为示例作品素材） */
export async function saveToResource(
  payload: ScratchSavePayload,
  type: Resource['type'] = 'sprite'
): Promise<Resource> {
  const dir = join(workspaceDir(), '_resources')
  await mkdir(dir, { recursive: true })
  const name = safeFileName(payload.fileName || `scratch-${Date.now()}`)
  const filePath = join(dir, `${name}.sb3`)
  const sb3 = await packSb3(payload.projectJson)
  await writeFile(filePath, sb3)
  return resourceRepo.create({ name, type, filePath })
}

/** 将项目 JSON 打包为 .sb3（zip，含 project.json） */
async function packSb3(projectJson: unknown): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify(projectJson))
  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })
  return buf
}

/** 从 .sb3 读取 project.json */
async function readSb3ProjectJson(sb3Path: string): Promise<unknown> {
  const data = readFileSync(sb3Path)
  const zip = await JSZip.loadAsync(data)
  const file = zip.file('project.json')
  if (!file) throw new Error('sb3 中未找到 project.json')
  const text = await file.async('string')
  return JSON.parse(text)
}

/** 读取版本 .sb3 的元信息（角色数、积木数等），无需打开编辑器 */
export async function getVersionMeta(versionId: string): Promise<VersionMeta> {
  const version = ideaRepo.getVersion(versionId)
  if (!version?.filePath || !existsSync(version.filePath)) {
    return {
      hasFile: false,
      spriteCount: 0,
      scriptCount: 0,
      costumeCount: 0,
      soundCount: 0,
      spriteNames: [],
      fileSize: 0
    }
  }
  const stat = await import('fs/promises').then((m) => m.stat(version.filePath!))
  let spriteCount = 0
  let scriptCount = 0
  let costumeCount = 0
  let soundCount = 0
  let spriteNames: string[] = []
  try {
    const projectJson = (await readSb3ProjectJson(version.filePath)) as {
      targets?: Array<{
        name?: string
        isStage?: boolean
        blocks?: Record<string, unknown>
        costumes?: unknown[]
        sounds?: unknown[]
      }>
    }
    const targets = projectJson.targets ?? []
    spriteNames = targets.filter((t) => !t.isStage).map((t) => t.name ?? '未命名')
    spriteCount = spriteNames.length
    for (const t of targets) {
      // blocks 中顶层块（含 topLevel=true）即为脚本入口
      const blocks = t.blocks ?? {}
      scriptCount += Object.values(blocks).filter(
        (b) => (b as { topLevel?: boolean })?.topLevel === true
      ).length
      costumeCount += t.costumes?.length ?? 0
      soundCount += t.sounds?.length ?? 0
    }
  } catch (e) {
    console.error('[scratch] 读取版本元信息失败', e)
  }
  return {
    hasFile: true,
    spriteCount,
    scriptCount,
    costumeCount,
    soundCount,
    spriteNames,
    fileSize: stat.size
  }
}
