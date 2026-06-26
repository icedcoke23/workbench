import { BrowserWindow, ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import JSZip from 'jszip'
import { getScratch } from '../database/repositories/settings'
import * as ideaRepo from '../database/repositories/ideas'
import * as resourceRepo from '../database/repositories/resources'
import type { ArchiveTarget, IdeaVersion, Resource, ScratchSavePayload } from '@shared/types'

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

/** 启动 Scratch 编辑器窗口，可选加载某版本 */
export async function launch(versionId?: string): Promise<void> {
  if (scratchWin && !scratchWin.isDestroyed()) {
    scratchWin.focus()
    return
  }
  const settings = getScratch()
  scratchWin = new BrowserWindow({
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

  await scratchWin.loadURL(settings.guiUrl)

  if (versionId) {
    const version = ideaRepo.getVersion(versionId)
    if (version?.filePath && existsSync(version.filePath)) {
      // 读取 .sb3 中的 project.json 注入到编辑器
      try {
        const projectJson = await readSb3ProjectJson(version.filePath)
        scratchWin.webContents.send('scratch:load-project', projectJson)
      } catch (e) {
        console.error('加载版本失败', e)
      }
    }
  }
}

export function close(): void {
  if (scratchWin && !scratchWin.isDestroyed()) scratchWin.close()
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

  // scratch-gui 读取本地资源文件 -> base64
  ipcMain.handle('scratch:read-resource', async (_e, filePath: string) => {
    try {
      const buf = await readFile(filePath)
      return { ok: true, data: buf.toString('base64') }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  // 渲染进程请求打开资源选择器（侧边栏入口）
  ipcMain.handle('scratch:pickResourceFile', async () => {
    const res = await dialog.showOpenDialog({
      title: '选择素材文件',
      filters: [
        { name: '图片/音频', extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif', 'wav', 'mp3'] }
      ],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths.length) return { ok: false, error: '取消选择' }
    const fp = res.filePaths[0]
    const name = fp.split(/[\\/]/).pop() ?? 'resource'
    const ext = name.split('.').pop()?.toLowerCase() ?? ''
    const type: Resource['type'] = ['wav', 'mp3'].includes(ext) ? 'sound' : ext === 'svg' ? 'sprite' : 'sprite'
    const created = resourceRepo.create({ name, type, filePath: fp })
    return { ok: true, data: created }
  })
}

/** 保存到点子库：打包 .sb3 并写库 */
export async function saveToIdea(
  payload: ScratchSavePayload,
  target: ArchiveTarget
): Promise<IdeaVersion> {
  const dir = join(workspaceDir(), target.ideaId)
  await mkdir(dir, { recursive: true })
  const safeName = target.versionName.replace(/[^\w.-]/g, '_')
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
export async function saveToResource(payload: ScratchSavePayload): Promise<Resource> {
  const dir = join(workspaceDir(), '_resources')
  await mkdir(dir, { recursive: true })
  const name = payload.fileName || `scratch-${Date.now()}`
  const filePath = join(dir, `${name}.sb3`)
  const sb3 = await packSb3(payload.projectJson)
  await writeFile(filePath, sb3)
  return resourceRepo.create({ name, type: 'sprite', filePath })
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
