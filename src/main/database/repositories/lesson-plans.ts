import { db, uuid } from '../db'
import type { LessonPlan, LessonPlanInput } from '@shared/types'

interface LessonPlanRow {
  id: string
  idea_version_id: string
  title: string | null
  objectives: string | null
  key_points: string | null
  preparation: string | null
  process: string | null
  reflection: string | null
  duration_minutes: number | null
  created_at: string
  updated_at: string
}

interface JoinedRow extends LessonPlanRow {
  version_name: string | null
  idea_title: string | null
  idea_id: string | null
  lesson_count?: number
}

function mapRow(r: JoinedRow): LessonPlan {
  return {
    id: r.id,
    ideaVersionId: r.idea_version_id,
    versionName: r.version_name ?? undefined,
    ideaTitle: r.idea_title,
    ideaId: r.idea_id ?? undefined,
    title: r.title,
    objectives: r.objectives,
    keyPoints: r.key_points,
    preparation: r.preparation,
    process: r.process,
    reflection: r.reflection,
    durationMinutes: r.duration_minutes,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

/** 列出全部教案，可按 ideaId 过滤、按 keyword 全文搜索；带版本名与点子标题 */
export function list(q?: { ideaId?: string; keyword?: string }): LessonPlan[] {
  let sql = `SELECT lp.*, iv.version_name, i.title AS idea_title, i.id AS idea_id
             FROM lesson_plans lp
             JOIN idea_versions iv ON iv.id = lp.idea_version_id
             JOIN ideas i ON i.id = iv.idea_id`
  const where: string[] = []
  const params: unknown[] = []
  if (q?.ideaId) {
    where.push(`iv.idea_id = ?`)
    params.push(q.ideaId)
  }
  if (q?.keyword && q.keyword.trim()) {
    where.push(`(
      lp.title LIKE ? OR
      lp.objectives LIKE ? OR
      lp.key_points LIKE ? OR
      lp.preparation LIKE ? OR
      lp.process LIKE ? OR
      lp.reflection LIKE ? OR
      iv.version_name LIKE ? OR
      i.title LIKE ?
    )`)
    const kw = `%${q.keyword.trim()}%`
    params.push(kw, kw, kw, kw, kw, kw, kw, kw)
  }
  if (where.length > 0) sql += ` WHERE ` + where.join(' AND ')
  sql += ` ORDER BY lp.updated_at DESC`
  return (db().prepare(sql).all(...params) as JoinedRow[]).map(mapRow)
}

export function get(id: string): LessonPlan | null {
  const row = db()
    .prepare(
      `SELECT lp.*, iv.version_name, i.title AS idea_title, i.id AS idea_id
       FROM lesson_plans lp
       JOIN idea_versions iv ON iv.id = lp.idea_version_id
       JOIN ideas i ON i.id = iv.idea_id
       WHERE lp.id = ?`
    )
    .get(id) as JoinedRow | undefined
  return row ? mapRow(row) : null
}

/** 按版本 ID 查询教案（1:1 关联），不存在返回 null */
export function getByVersion(versionId: string): LessonPlan | null {
  const row = db()
    .prepare(
      `SELECT lp.*, iv.version_name, i.title AS idea_title, i.id AS idea_id
       FROM lesson_plans lp
       JOIN idea_versions iv ON iv.id = lp.idea_version_id
       JOIN ideas i ON i.id = iv.idea_id
       WHERE lp.idea_version_id = ?`
    )
    .get(versionId) as JoinedRow | undefined
  return row ? mapRow(row) : null
}

/** 空字符串归一化为 null */
function normStr(v: string | null | undefined): string | null {
  if (v == null) return null
  const s = v.trim()
  return s.length === 0 ? null : s
}

/** 数值归一化：null/NaN -> null，否则取非负整数 */
function normNum(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null
  return Math.max(0, Math.floor(v))
}

/**
 * 按 ideaVersionId 幂等 upsert 教案。
 * - 已存在：仅更新传入的字段（undefined 表示不修改）
 * - 不存在：插入新行
 * 空字符串归一化为 null。
 */
export function upsert(input: LessonPlanInput): LessonPlan {
  const existing = getByVersion(input.ideaVersionId)
  if (existing) {
    const next: Record<string, string | number | null> = {}
    if (input.title !== undefined) next.title = normStr(input.title)
    if (input.objectives !== undefined) next.objectives = normStr(input.objectives)
    if (input.keyPoints !== undefined) next.keyPoints = normStr(input.keyPoints)
    if (input.preparation !== undefined) next.preparation = normStr(input.preparation)
    if (input.process !== undefined) next.process = normStr(input.process)
    if (input.reflection !== undefined) next.reflection = normStr(input.reflection)
    if (input.durationMinutes !== undefined) next.duration_minutes = normNum(input.durationMinutes)
    if (Object.keys(next).length === 0) return existing
    const sets = Object.keys(next).map((k) => `${k} = ?`).join(', ')
    db().prepare(`UPDATE lesson_plans SET ${sets} WHERE id = ?`).run(...Object.values(next), existing.id)
    return get(existing.id)!
  }
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO lesson_plans (id, idea_version_id, title, objectives, key_points, preparation, process, reflection, duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.ideaVersionId,
      normStr(input.title ?? null),
      normStr(input.objectives ?? null),
      normStr(input.keyPoints ?? null),
      normStr(input.preparation ?? null),
      normStr(input.process ?? null),
      normStr(input.reflection ?? null),
      normNum(input.durationMinutes ?? null)
    )
  return get(id)!
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM lesson_plans WHERE id = ?`).run(id)
}
