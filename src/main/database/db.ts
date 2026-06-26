import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { Database as DB } from 'better-sqlite3'
import schemaSql from './schema.sql?raw'

export type { DB }

let dbInstance: DB | null = null

/** 初始化数据库连接（在 app ready 后调用） */
export function initDatabase(dbPath: string): DB {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // 执行建表脚本
  db.exec(schemaSql)

  // 初始化同步状态行
  db.prepare(
    `INSERT OR IGNORE INTO sync_state (id, device_id) VALUES (1, ?)`
  ).run(randomUUID())

  dbInstance = db
  return db
}

/** 获取数据库实例 */
export function db(): DB {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return dbInstance
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

// ============ 通用工具 ============
export function uuid(): string {
  return randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

/** 安全解析 JSON 数组/对象 */
export function parseJSON<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback
  if (typeof raw !== 'string') return raw as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function stringifyJSON(value: unknown): string {
  return JSON.stringify(value ?? [])
}

/** 包裹执行，捕获异常为 Result */
export function tryRun<T>(fn: () => T): { ok: true; data: T } | { ok: false; error: string } {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function tryRunAsync<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
