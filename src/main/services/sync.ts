import { getSync, setSync } from '../database/repositories/settings'
import { db } from '../database/db'
import * as studentRepo from '../database/repositories/students'
import * as classRepo from '../database/repositories/classes'
import * as ideaRepo from '../database/repositories/ideas'
import * as lessonRepo from '../database/repositories/lessons'
import type { SyncSettings } from '@shared/types'

/** 同步状态事件载荷，对应渲染进程的 sync:status 事件 */
export interface SyncStatus {
  running: boolean
  message: string
}

/** 同步过程中的状态回调，可选；用于向渲染进程推送实时进度 */
export type SyncStatusCallback = (status: SyncStatus) => void

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
export async function testConnection(
  onStatus?: SyncStatusCallback
): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.serverUrl) return { ok: false, message: '未配置服务器地址' }
  onStatus?.({ running: true, message: '正在测试连接...' })
  try {
    const resp = await syncFetch('/health', { method: 'GET', timeoutMs: 8000 })
    const ok = resp.ok
    const msg = ok ? '服务器连接正常' : `服务器返回 ${resp.status}`
    onStatus?.({ running: false, message: msg })
    return { ok, message: msg }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    onStatus?.({ running: false, message: `连接失败：${msg}` })
    return { ok: false, message: msg }
  }
}

/** 推送本地变更（整库快照 JSON 推送，作为增量同步的基础实现） */
export async function push(onStatus?: SyncStatusCallback): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.enabled || !s.serverUrl) return { ok: false, message: '同步未启用' }
  onStatus?.({ running: true, message: '正在推送本地数据...' })
  try {
    const snapshot = buildSnapshot()
    const resp = await syncFetch('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId(), snapshot })
    })
    if (!resp.ok) {
      const detail = await safeText(resp)
      const msg = `推送失败 ${resp.status}${detail ? `: ${detail}` : ''}`
      onStatus?.({ running: false, message: msg })
      return { ok: false, message: msg }
    }
    const next: SyncSettings = { ...s, lastSyncAt: new Date().toISOString() }
    setSync(next)
    onStatus?.({ running: false, message: '推送成功' })
    return { ok: true, message: '推送成功' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    onStatus?.({ running: false, message: `推送失败：${msg}` })
    return { ok: false, message: msg }
  }
}

/** 拉取其他设备变更并合并。
 * 服务端返回最新快照时整体 upsert 合并；无快照（204）视为无变更。 */
export async function pull(onStatus?: SyncStatusCallback): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.enabled || !s.serverUrl) return { ok: false, message: '同步未启用' }
  onStatus?.({ running: true, message: '正在拉取远端数据...' })
  try {
    const since = s.lastSyncAt ?? ''
    const resp = await syncFetch(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`, {
      method: 'GET'
    })
    if (resp.status === 204) {
      // 无新变更
      onStatus?.({ running: false, message: '已是最新' })
      return { ok: true, message: '已是最新' }
    }
    if (!resp.ok) {
      const detail = await safeText(resp)
      const msg = `拉取失败 ${resp.status}${detail ? `: ${detail}` : ''}`
      onStatus?.({ running: false, message: msg })
      return { ok: false, message: msg }
    }
    const data = (await resp.json()) as { snapshot?: SnapshotPayload } | null
    if (data?.snapshot) {
      applySnapshot(data.snapshot)
    }
    const next: SyncSettings = { ...s, lastSyncAt: new Date().toISOString() }
    setSync(next)
    onStatus?.({ running: false, message: '拉取成功' })
    return { ok: true, message: '拉取成功' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    onStatus?.({ running: false, message: `拉取失败：${msg}` })
    return { ok: false, message: msg }
  }
}

/** 立即执行一次同步：先拉取后推送；两者都成功才算成功 */
export async function syncNow(onStatus?: SyncStatusCallback): Promise<{ ok: boolean; message: string }> {
  onStatus?.({ running: true, message: '开始同步...' })
  const pullRes = await pull(onStatus)
  const pushRes = await push(onStatus)
  if (pullRes.ok && pushRes.ok) {
    const msg = `同步完成（${pullRes.message} / ${pushRes.message}）`
    onStatus?.({ running: false, message: '同步完成' })
    return { ok: true, message: msg }
  }
  // 部分成功时返回失败方信息，便于排查
  let msg: string
  if (!pullRes.ok && !pushRes.ok) {
    msg = `同步失败（拉取：${pullRes.message}；推送：${pushRes.message}）`
  } else if (!pullRes.ok) {
    msg = `拉取失败：${pullRes.message}（推送已成功）`
  } else {
    msg = `推送失败：${pushRes.message}（拉取已成功）`
  }
  onStatus?.({ running: false, message: msg })
  return { ok: false, message: msg }
}

interface SnapshotPayload {
  students?: unknown[]
  classes?: unknown[]
  ideas?: unknown[]
  lessons?: unknown[]
  /** 备课：点子版本（含 .sb3 文件路径，跨设备仅同步元数据） */
  ideaVersions?: unknown[]
  /** 备课：教案（与点子版本 1:1 关联，结构化备课内容） */
  lessonPlans?: unknown[]
  /** 备课：资源库（含素材文件路径，跨设备仅同步元数据） */
  resources?: unknown[]
  /** 备课：文档关联 */
  docLinks?: unknown[]
}

/** 查询原始行（保留 snake_case 列名与 JSON 字符串原值），确保 upsert 列名匹配 */
function listRaw(table: string): unknown[] {
  return db().prepare(`SELECT * FROM ${table}`).all()
}

// 本地快照构建（students/classes/ideas/lessons 复用各仓库 list；备课三表取原始行保证列名一致）
function buildSnapshot(): SnapshotPayload & { exportedAt: string } {
  const students = studentRepo.list()
  const classes = classRepo.list()
  const ideas = ideaRepo.list()
  const lessons = lessonRepo.list({})
  return {
    students,
    classes,
    ideas,
    lessons,
    ideaVersions: listRaw('idea_versions'),
    lessonPlans: listRaw('lesson_plans'),
    resources: listRaw('resources'),
    docLinks: listRaw('doc_links'),
    exportedAt: new Date().toISOString()
  }
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
    // 备课三表：版本需先于课次合并（lessons.idea_version_id 引用），资源与文档独立
    upsertRows(conn, 'idea_versions', snap.ideaVersions, [
      'id',
      'idea_id',
      'version_name',
      'file_path',
      'notes',
      'created_at'
    ])
    upsertRows(
      conn,
      'lesson_plans',
      snap.lessonPlans,
      [
        'id',
        'idea_version_id',
        'title',
        'objectives',
        'key_points',
        'preparation',
        'process',
        'reflection',
        'duration_minutes',
        'created_at',
        'updated_at'
      ],
      ['idea_version_id']
    )
    upsertRows(conn, 'resources', snap.resources, [
      'id',
      'name',
      'type',
      'file_path',
      'tags',
      'class_id',
      'created_at'
    ])
    upsertRows(conn, 'doc_links', snap.docLinks, [
      'id',
      'lesson_id',
      'url',
      'title',
      'created_at'
    ])
  })()
}

/** 通用 upsert：按行对象的列值插入或替换；可选 conflictCols 时使用 ON CONFLICT 更新 */
function upsertRows(
  conn: ReturnType<typeof db>,
  table: string,
  rows: unknown[] | undefined,
  fallbackCols: string[],
  conflictCols?: string[]
): void {
  if (!rows || rows.length === 0) return
  const effectiveConflict = conflictCols?.filter((c) => fallbackCols.includes(c)) ?? []
  const useUpsert = effectiveConflict.length > 0
  for (const row of rows) {
    const r = row as Record<string, unknown>
    const cols = Object.keys(r).filter((c) => fallbackCols.includes(c))
    if (cols.length === 0) continue
    const placeholders = cols.map(() => '?').join(', ')
    if (!useUpsert) {
      conn.prepare(
        `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
      ).run(...cols.map((c) => r[c]))
      continue
    }
    const conflictSpec = effectiveConflict.join(', ')
    const setClauses = cols
      .filter((c) => !effectiveConflict.includes(c))
      .map((c) => `${c} = excluded.${c}`)
    if (setClauses.length === 0) continue
    conn.prepare(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(${conflictSpec}) DO UPDATE SET ${setClauses.join(', ')}`
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
