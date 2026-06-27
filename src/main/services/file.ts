import { dialog, app } from 'electron'
import { copyFile, mkdir } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import { join, extname, basename } from 'path'
import { uuid } from '../database/db'

/** 选择图片文件 */
export async function pickImage(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: '选择图片',
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile']
  })
  if (res.canceled || !res.filePaths.length) return null
  return res.filePaths[0]
}

/** 保存头像到 userData/avatars，返回相对路径 */
export async function saveAvatar(srcPath: string, studentName: string): Promise<string> {
  const dir = join(app.getPath('userData'), 'avatars')
  await mkdir(dir, { recursive: true })
  const ext = extname(srcPath) || '.png'
  const safeName = studentName.replace(/[^\w\u4e00-\u9fa5]/g, '_')
  const dest = join(dir, `${safeName}-${uuid().slice(0, 8)}${ext}`)
  await copyFile(srcPath, dest)
  return dest
}

/** 读取图片为 base64（含 data: 前缀） */
export function readImageBase64(path: string): string {
  const buf = readFileSync(path)
  const ext = extname(path).slice(1) || 'png'
  const mime = ext === 'jpg' ? 'jpeg' : ext
  return `data:image/${mime};base64,${buf.toString('base64')}`
}

/** 根据扩展名推断 MIME 类型 */
function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg'
  }
  return map[ext] ?? 'application/octet-stream'
}

/** 读取任意资源文件为 data URL（图片/音频可直接用于预览） */
export function readFileAsDataUrl(path: string): string {
  const buf = readFileSync(path)
  const ext = extname(path).slice(1).toLowerCase()
  const mime = mimeFromExt(ext)
  return `data:${mime};base64,${buf.toString('base64')}`
}

/** 资源库文件导入：拷贝到 userData/resources 并返回新路径 */
export async function importResourceFile(
  filePath: string,
  type: 'backdrop' | 'sprite' | 'sound'
): Promise<{ name: string; filePath: string }> {
  if (!existsSync(filePath)) {
    throw new Error(`源文件不存在：${filePath}`)
  }
  const dir = join(app.getPath('userData'), 'resources', type)
  await mkdir(dir, { recursive: true })
  const name = basename(filePath, extname(filePath))
  const ext = extname(filePath)
  const dest = join(dir, `${name}-${uuid().slice(0, 8)}${ext}`)
  await copyFile(filePath, dest)
  return { name, filePath: dest }
}

/** 选择 Scratch 资源文件（.sb3 / .json），返回路径或 null（用户取消） */
export async function pickResourceFile(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: '选择 Scratch 资源文件',
    filters: [
      { name: 'Scratch 项目', extensions: ['sb3'] },
      { name: 'JSON', extensions: ['json'] }
    ],
    properties: ['openFile']
  })
  if (res.canceled || !res.filePaths.length) return null
  return res.filePaths[0]
}
