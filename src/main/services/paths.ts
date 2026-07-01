import { app } from 'electron'
import { join, resolve, relative, isAbsolute } from 'path'
import { getScratch } from '../database/repositories/settings'

/** Scratch 作品工作目录（来自设置或默认 userData/scratch-projects） */
export function workspaceDir(): string {
  const s = getScratch()
  return s.workspaceDir || join(app.getPath('userData'), 'scratch-projects')
}

/** 资源根目录（userData/resources） */
export function resourcesRoot(): string {
  return join(app.getPath('userData'), 'resources')
}

/**
 * 将存储中的路径解析为绝对路径。
 * - 已是绝对路径：原样返回（向后兼容历史数据）
 * - 相对路径：相对于 root 解析
 */
export function resolveStoredPath(stored: string, root: string): string {
  if (!stored) return stored
  return isAbsolute(stored) ? stored : resolve(root, stored)
}

/**
 * 将绝对路径转换为存储路径（相对 root 的相对路径，用 / 分隔）。
 * - 路径等于 root 本身：返回空串
 * - 无法计算相对路径（不同盘符等）：返回原绝对路径
 */
export function toStoredPath(absolute: string, root: string): string {
  if (!absolute) return absolute
  const a = resolve(absolute)
  const r = resolve(root)
  if (a === r) return ''
  const rel = relative(r, a)
  return rel !== null ? rel.replace(/\\/g, '/') : absolute
}
