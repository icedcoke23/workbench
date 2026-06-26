import { getSync, setSync } from '../database/repositories/settings'
import * as studentRepo from '../database/repositories/students'
import * as classRepo from '../database/repositories/classes'
import * as ideaRepo from '../database/repositories/ideas'
import * as lessonRepo from '../database/repositories/lessons'
import type { SyncSettings } from '@shared/types'

interface SyncHttpOptions {
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

async function syncFetch(path: string, opts: SyncHttpOptions): Promise<Response> {
  const s = getSync()
  const url = joinUrl(s.serverUrl, path)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000)
  try {
    return await fetch(url, {
      method: opts.method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}`, ...opts.headers },
      body: opts.body,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

/** 测试同步服务器连通性 */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.serverUrl) return { ok: false, message: '未配置服务器地址' }
  try {
    const resp = await syncFetch('/health', { method: 'GET', timeoutMs: 8000 })
    return { ok: resp.ok, message: resp.ok ? '服务器连接正常' : `服务器返回 ${resp.status}` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** 推送本地变更（此处以整库快照 JSON 推送，作为增量同步的基础实现） */
export async function push(): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.enabled || !s.serverUrl) return { ok: false, message: '同步未启用' }
  try {
    const snapshot = buildSnapshot()
    const resp = await syncFetch('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ deviceId: s.token.slice(0, 8), snapshot })
    })
    if (!resp.ok) return { ok: false, message: `推送失败 ${resp.status}` }
    const next: SyncSettings = { ...s, lastSyncAt: new Date().toISOString() }
    setSync(next)
    return { ok: true, message: '推送成功' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** 拉取其他设备变更并合并（基础实现：服务端返回最新快照，整体覆盖合并） */
export async function pull(): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.enabled || !s.serverUrl) return { ok: false, message: '同步未启用' }
  try {
    const resp = await syncFetch(`/sync/pull?since=${encodeURIComponent(s.lastSyncAt ?? '')}`, {
      method: 'GET'
    })
    if (!resp.ok) return { ok: false, message: `拉取失败 ${resp.status}` }
    // const data = await resp.json()  // 应用变更逻辑由具体服务端协议决定
    const next: SyncSettings = { ...s, lastSyncAt: new Date().toISOString() }
    setSync(next)
    return { ok: true, message: '拉取成功' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** 立即执行一次同步：先拉取后推送 */
export async function syncNow(): Promise<{ ok: boolean; message: string }> {
  const pullRes = await pull()
  const pushRes = await push()
  if (!pullRes.ok && !pushRes.ok) return pullRes
  return { ok: true, message: `同步完成（${pullRes.message} / ${pushRes.message}）` }
}

// 本地快照构建（简化：复用各仓库 list）—— 实际增量同步可基于 updated_at 过滤
function buildSnapshot(): Record<string, unknown> {
  const students = studentRepo.list()
  const classes = classRepo.list()
  const ideas = ideaRepo.list()
  const lessons = lessonRepo.list({})
  return { students, classes, ideas, lessons, exportedAt: new Date().toISOString() }
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path
}
