import { getSync, setSync } from '../database/repositories/settings'
import { db } from '../database/db'
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

/** 获取持久化的设备 ID（来自 sync_state，初始化时随机生成） */
function getDeviceId(): string {
  const row = db().prepare(`SELECT device_id FROM sync_state WHERE id = 1`).get() as
    | { device_id: string }
    | undefined
  return row?.device_id ?? 'unknown'
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

/** 推送本地变更（整库快照 JSON 推送，作为增量同步的基础实现） */
export async function push(): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.enabled || !s.serverUrl) return { ok: false, message: '同步未启用' }
  try {
    const snapshot = buildSnapshot()
    const resp = await syncFetch('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId(), snapshot })
    })
    if (!resp.ok) {
      const detail = await safeText(resp)
      return { ok: false, message: `推送失败 ${resp.status}${detail ? `: ${detail}` : ''}` }
    }
    const next: SyncSettings = { ...s, lastSyncAt: new Date().toISOString() }
    setSync(next)
    return { ok: true, message: '推送成功' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** 拉取其他设备变更并合并。
 * 服务端返回最新快照时整体 upsert 合并；无快照（204）视为无变更。 */
export async function pull(): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.enabled || !s.serverUrl) return { ok: false, message: '同步未启用' }
  try {
    const since = s.lastSyncAt ?? ''
    const resp = await syncFetch(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`, {
      method: 'GET'
    })
    if (resp.status === 204) {
      // 无新变更
      return { ok: true, message: '已是最新' }
    }
    if (!resp.ok) {
      const detail = await safeText(resp)
      return { ok: false, message: `拉取失败 ${resp.status}${detail ? `: ${detail}` : ''}` }
    }
    const data = (await resp.json()) as { snapshot?: SnapshotPayload } | null
    if (data?.snapshot) {
      applySnapshot(data.snapshot)
    }
    const next: SyncSettings = { ...s, lastSyncAt: new Date().toISOString() }
    setSync(next)
    return { ok: true, message: '拉取成功' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** 立即执行一次同步：先拉取后推送；两者都成功才算成功 */
export async function syncNow(): Promise<{ ok: boolean; message: string }> {
  const pullRes = await pull()
  const pushRes = await push()
  if (pullRes.ok && pushRes.ok) {
    return { ok: true, message: `同步完成（${pullRes.message} / ${pushRes.message}）` }
  }
  // 部分成功时返回失败方信息，便于排查
  if (!pullRes.ok && !pushRes.ok) {
    return { ok: false, message: `同步失败（拉取：${pullRes.message}；推送：${pushRes.message}）` }
  }
  if (!pullRes.ok) {
    return { ok: false, message: `拉取失败：${pullRes.message}（推送已成功）` }
  }
  return { ok: false, message: `推送失败：${pushRes.message}（拉取已成功）` }
}

interface SnapshotPayload {
  students?: unknown[]
  classes?: unknown[]
  ideas?: unknown[]
  lessons?: unknown[]
}

// 本地快照构建（复用各仓库 list）
function buildSnapshot(): SnapshotPayload & { exportedAt: string } {
  const students = studentRepo.list()
  const classes = classRepo.list()
  const ideas = ideaRepo.list()
  const lessons = lessonRepo.list({})
  return { students, classes, ideas, lessons, exportedAt: new Date().toISOString() }
}

/** 将拉取的快照合并到本地（upsert 语义，按 id 覆盖；不删除本地独有数据） */
function applySnapshot(snap: SnapshotPayload): void {
  const conn = db()
  conn.transaction(() => {
    upsertRows(conn, 'students', snap.students, [
      'id',
      'name',
      'avatar_path',
      'grade',
      'tags',
      'created_at',
      'updated_at'
    ])
    upsertRows(conn, 'classes', snap.classes, ['id', 'name', 'type', 'schedule_rule', 'created_at'])
    upsertRows(conn, 'ideas', snap.ideas, [
      'id',
      'title',
      'description',
      'target_course',
      'status',
      'created_at',
      'updated_at'
    ])
    upsertRows(conn, 'lessons', snap.lessons, [
      'id',
      'class_id',
      'start_time',
      'end_time',
      'subject',
      'idea_version_id',
      'status',
      'feedback_sent',
      'created_at'
    ])
  })()
}

/** 通用 upsert：按行对象的列值插入或替换 */
function upsertRows(
  conn: ReturnType<typeof db>,
  table: string,
  rows: unknown[] | undefined,
  fallbackCols: string[]
): void {
  if (!rows || rows.length === 0) return
  for (const row of rows) {
    const r = row as Record<string, unknown>
    const cols = Object.keys(r).filter((c) => fallbackCols.includes(c))
    if (cols.length === 0) continue
    const placeholders = cols.map(() => '?').join(', ')
    conn.prepare(
      `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
    ).run(...cols.map((c) => r[c]))
  }
}

async function safeText(resp: Response): Promise<string> {
  try {
    const t = await resp.text()
    return t.length > 200 ? t.slice(0, 200) + '...' : t
  } catch {
    return ''
  }
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path
}
