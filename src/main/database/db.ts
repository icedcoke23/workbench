import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { Database as DB } from 'better-sqlite3'
import schemaSql from './schema.sql?raw'
import { seedIfEmpty } from './seed'

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

  // 幂等迁移：为已存在的 lessons 表补充 per-lesson 反思列与 AI 达成度评估列
  // （CREATE TABLE IF NOT EXISTS 不会为已建表追加列，需 ALTER TABLE）
  migrateLessonsReflection(db)
  migrateLessonsAchievement(db)
  // 幂等迁移：为 lesson_plans 表补充 parent_plan_id 列（教案克隆血统追踪）
  migrateLessonPlansParent(db)

  // 先暴露实例，种子数据初始化内部需要通过 db() 取实例
  dbInstance = db

  // 初始化种子数据（内置模板 + 示例数据）
  try {
    seedIfEmpty()
  } catch (e) {
    console.error('种子数据初始化失败', e)
  }

  // 初始化同步状态行
  db.prepare(
    `INSERT OR IGNORE INTO sync_state (id, device_id) VALUES (1, ?)`
  ).run(randomUUID())

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

/**
 * 幂等迁移：为 lessons 表追加 reflection / reflected_at 列。
 * 通过 PRAGMA table_info 探测列是否已存在，避免重复 ALTER 报错。
 * 历史反思数据仍保留在 lesson_plans.reflection，读取时按 lesson 优先、
 * plan 兜底的方式合并展示，保证向前兼容。
 */
function migrateLessonsReflection(db: DB): void {
  const cols = db.prepare(`PRAGMA table_info(lessons)`).all() as Array<{ name: string }>
  const names = new Set(cols.map((c) => c.name))
  if (!names.has('reflection')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN reflection TEXT`)
  }
  if (!names.has('reflected_at')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN reflected_at DATETIME`)
  }
}

/**
 * 幂等迁移：为 lessons 表追加 AI 教学目标达成度评估列。
 * achievement_assessment 存评估全文，assessment_at 存生成时间。
 */
function migrateLessonsAchievement(db: DB): void {
  const cols = db.prepare(`PRAGMA table_info(lessons)`).all() as Array<{ name: string }>
  const names = new Set(cols.map((c) => c.name))
  if (!names.has('achievement_assessment')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN achievement_assessment TEXT`)
  }
  if (!names.has('assessment_at')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN assessment_at DATETIME`)
  }
}

/**
 * 幂等迁移：为 lesson_plans 表追加 parent_plan_id 列（教案克隆血统追踪）。
 * clonePlan 创建派生教案时写入源教案 ID，便于追溯派生关系。
 * 源教案被删除时 ON DELETE SET NULL，保留派生教案但断开血统链。
 */
function migrateLessonPlansParent(db: DB): void {
  const cols = db.prepare(`PRAGMA table_info(lesson_plans)`).all() as Array<{ name: string }>
  const names = new Set(cols.map((c) => c.name))
  if (!names.has('parent_plan_id')) {
    db.exec(`ALTER TABLE lesson_plans ADD COLUMN parent_plan_id TEXT`)
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
