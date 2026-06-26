import { type BrowserWindow } from 'electron'
import { getSync, setSync } from '../database/repositories/settings'
import { db, stringifyJSON } from '../database/db'
import * as studentRepo from '../database/repositories/students'
import * as classRepo from '../database/repositories/classes'
import * as ideaRepo from '../database/repositories/ideas'
import * as lessonRepo from '../database/repositories/lessons'
import type { SyncSettings } from '@shared/types'

let mainWindowRef: BrowserWindow | null = null

export function setSyncWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

/** 向渲染进程广播同步状态 */
function emitStatus(running: boolean, message: string): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('sync:status', { running, message })
  }
}

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

/** 推送本地增量变更（基于 updated_at > lastSyncAt 过滤） */
export async function push(): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.enabled || !s.serverUrl) return { ok: false, message: '同步未启用' }
  emitStatus(true, '正在推送...')
  try {
    const since = s.lastSyncAt ?? ''
    const snapshot = buildIncrementalSnapshot(since)
    const resp = await syncFetch('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ deviceId: s.token.slice(0, 8), since, snapshot })
    })
    if (!resp.ok) {
      emitStatus(false, `推送失败 ${resp.status}`)
      return { ok: false, message: `推送失败 ${resp.status}` }
    }
    const next: SyncSettings = { ...s, lastSyncAt: new Date().toISOString() }
    setSync(next)
    emitStatus(false, '推送完成')
    return { ok: true, message: '推送成功' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    emitStatus(false, `推送出错: ${msg}`)
    return { ok: false, message: msg }
  }
}

/** 拉取其他设备变更并合并（last-write-wins，基于 updated_at） */
export async function pull(): Promise<{ ok: boolean; message: string }> {
  const s = getSync()
  if (!s.enabled || !s.serverUrl) return { ok: false, message: '同步未启用' }
  emitStatus(true, '正在拉取...')
  try {
    const resp = await syncFetch(`/sync/pull?since=${encodeURIComponent(s.lastSyncAt ?? '')}`, {
      method: 'GET'
    })
    if (!resp.ok) {
      emitStatus(false, `拉取失败 ${resp.status}`)
      return { ok: false, message: `拉取失败 ${resp.status}` }
    }
    const data = (await resp.json()) as SyncSnapshot
    const stats = applyRemoteSnapshot(data)
    const next: SyncSettings = { ...s, lastSyncAt: new Date().toISOString() }
    setSync(next)
    emitStatus(false, `拉取完成（+${stats.students}学生/+${stats.classes}班级/+${stats.ideas}点子/+${stats.lessons}课次）`)
    return {
      ok: true,
      message: `拉取成功（新增/更新：${stats.students}学生, ${stats.classes}班级, ${stats.ideas}点子, ${stats.lessons}课次）`
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    emitStatus(false, `拉取出错: ${msg}`)
    return { ok: false, message: msg }
  }
}

/** 立即执行一次同步：先拉取后推送 */
export async function syncNow(): Promise<{ ok: boolean; message: string }> {
  const pullRes = await pull()
  const pushRes = await push()
  if (!pullRes.ok && !pushRes.ok) return pullRes
  return { ok: true, message: `同步完成（${pullRes.message} / ${pushRes.message}）` }
}

// ============ 快照构建 ============

interface SyncSnapshot {
  students?: Array<Record<string, unknown>>
  classes?: Array<Record<string, unknown>>
  ideas?: Array<Record<string, unknown>>
  lessons?: Array<Record<string, unknown>>
  exportedAt?: string
}

/** 构建增量快照：只包含 updated_at > since 的记录 */
function buildIncrementalSnapshot(since: string): SyncSnapshot {
  const conn = db()
  const students = since
    ? conn.prepare('SELECT * FROM students WHERE updated_at > ?').all(since)
    : studentRepo.list()
  const classes = since
    ? conn.prepare('SELECT * FROM classes WHERE updated_at > ?').all(since)
    : classRepo.list()
  const ideas = since
    ? conn.prepare('SELECT * FROM ideas WHERE updated_at > ?').all(since)
    : ideaRepo.list()
  // lessons 没有 updated_at，用 created_at 过滤
  const lessons = since
    ? conn.prepare('SELECT * FROM lessons WHERE created_at > ?').all(since)
    : lessonRepo.list({})
  return { students, classes, ideas, lessons, exportedAt: new Date().toISOString() }
}

// ============ 合并逻辑 ============

interface MergeStats {
  students: number
  classes: number
  ideas: number
  lessons: number
}

/** 将远程快照合并到本地（last-write-wins，基于 updated_at） */
function applyRemoteSnapshot(snapshot: SyncSnapshot): MergeStats {
  const conn = db()
  const stats: MergeStats = { students: 0, classes: 0, ideas: 0, lessons: 0 }
  const tx = conn.transaction(() => {
    if (snapshot.students?.length) stats.students = mergeStudents(snapshot.students)
    if (snapshot.classes?.length) stats.classes = mergeClasses(snapshot.classes)
    if (snapshot.ideas?.length) stats.ideas = mergeIdeas(snapshot.ideas)
    if (snapshot.lessons?.length) stats.lessons = mergeLessons(snapshot.lessons)
  })
  tx()
  return stats
}

function coerce(v: unknown, fallback: unknown = null): unknown {
  return v == null ? fallback : v
}

function mergeStudents(rows: Array<Record<string, unknown>>): number {
  const stmt = db().prepare(
    `INSERT INTO students (id, name, avatar_path, grade, tags, created_at, updated_at)
     VALUES (@id, @name, @avatar_path, @grade, @tags, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       avatar_path = excluded.avatar_path,
       grade = excluded.grade,
       tags = excluded.tags,
       updated_at = excluded.updated_at
     WHERE excluded.updated_at > students.updated_at`
  )
  let n = 0
  for (const r of rows) {
    const res = stmt.run({
      id: coerce(r.id, ''),
      name: coerce(r.name, ''),
      avatar_path: r.avatar_path,
      grade: r.grade,
      tags: stringifyJSON(typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags),
      created_at: coerce(r.created_at, new Date().toISOString()),
      updated_at: coerce(r.updated_at, new Date().toISOString())
    })
    if (res.changes > 0) n++
  }
  return n
}

function mergeClasses(rows: Array<Record<string, unknown>>): number {
  const stmt = db().prepare(
    `INSERT INTO classes (id, name, type, schedule_rule, created_at, updated_at)
     VALUES (@id, @name, @type, @schedule_rule, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       schedule_rule = excluded.schedule_rule,
       updated_at = excluded.updated_at
     WHERE excluded.updated_at > classes.updated_at`
  )
  let n = 0
  for (const r of rows) {
    const res = stmt.run({
      id: coerce(r.id, ''),
      name: coerce(r.name, ''),
      type: coerce(r.type, 'regular'),
      schedule_rule: r.schedule_rule,
      created_at: coerce(r.created_at, new Date().toISOString()),
      updated_at: coerce(r.updated_at, new Date().toISOString())
    })
    if (res.changes > 0) n++
  }
  return n
}

function mergeIdeas(rows: Array<Record<string, unknown>>): number {
  const stmt = db().prepare(
    `INSERT INTO ideas (id, title, target_course, description, status, created_at, updated_at)
     VALUES (@id, @title, @target_course, @description, @status, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       target_course = excluded.target_course,
       description = excluded.description,
       status = excluded.status,
       updated_at = excluded.updated_at
     WHERE excluded.updated_at > ideas.updated_at`
  )
  let n = 0
  for (const r of rows) {
    const res = stmt.run({
      id: coerce(r.id, ''),
      title: coerce(r.title, ''),
      target_course: r.target_course,
      description: r.description,
      status: coerce(r.status, 'idea'),
      created_at: coerce(r.created_at, new Date().toISOString()),
      updated_at: coerce(r.updated_at, new Date().toISOString())
    })
    if (res.changes > 0) n++
  }
  return n
}

function mergeLessons(rows: Array<Record<string, unknown>>): number {
  // lessons 没有 updated_at，仅插入本地不存在的记录（INSERT OR IGNORE）
  const stmt = db().prepare(
    `INSERT OR IGNORE INTO lessons (id, class_id, start_time, end_time, idea_version_id, subject, status, feedback_sent, created_at)
     VALUES (@id, @class_id, @start_time, @end_time, @idea_version_id, @subject, @status, @feedback_sent, @created_at)`
  )
  let n = 0
  for (const r of rows) {
    const res = stmt.run({
      id: coerce(r.id, ''),
      class_id: coerce(r.class_id, ''),
      start_time: coerce(r.start_time, ''),
      end_time: coerce(r.end_time, ''),
      idea_version_id: r.idea_version_id,
      subject: r.subject,
      status: coerce(r.status, 'pending'),
      feedback_sent: coerce(r.feedback_sent, 0),
      created_at: coerce(r.created_at, new Date().toISOString())
    })
    if (res.changes > 0) n++
  }
  return n
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path
}
