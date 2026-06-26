// IPC API 封装：统一解包 Result，抛出异常便于 try/catch
import type { Result } from '@shared/types'

export async function call<T>(
  p: Promise<{ ok: boolean; data?: T; error?: string }>
): Promise<T> {
  const res = await p
  if (!res.ok) throw new Error(res.error || '操作失败')
  return res.data as T
}

/** 便捷调用各命名空间 */
export const api = window.api

export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error)
  return r.data as T
}
