import { db, uuid } from '../db'
import type { LessonPlanTemplateRecord, LessonPlanTemplateRecordInput } from '@shared/types'

interface LessonPlanTemplateRow {
  id: string
  name: string
  category: string
  description: string | null
  duration_minutes: number | null
  objectives: string | null
  key_points: string | null
  preparation: string | null
  process: string | null
  created_at: string
  updated_at: string
}

function mapRow(r: LessonPlanTemplateRow): LessonPlanTemplateRecord {
  return {
    id: r.id,
    name: r.name,
    category: 'custom',
    description: r.description,
    durationMinutes: r.duration_minutes,
    objectives: r.objectives,
    keyPoints: r.key_points,
    preparation: r.preparation,
    process: r.process,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

/** 列出全部用户自定义教案模板，按创建时间降序 */
export function list(): LessonPlanTemplateRecord[] {
  const rows = db()
    .prepare(`SELECT * FROM lesson_plan_templates ORDER BY created_at DESC`)
    .all() as LessonPlanTemplateRow[]
  return rows.map(mapRow)
}

export function get(id: string): LessonPlanTemplateRecord | null {
  const row = db()
    .prepare(`SELECT * FROM lesson_plan_templates WHERE id = ?`)
    .get(id) as LessonPlanTemplateRow | undefined
  return row ? mapRow(row) : null
}

/** 空字符串归一化为 null */
function normStr(v: string | null | undefined): string | null {
  if (v == null) return null
  const s = v.trim()
  return s.length === 0 ? null : s
}

function normNum(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null
  return Math.max(0, Math.floor(v))
}

export function create(input: LessonPlanTemplateRecordInput): LessonPlanTemplateRecord {
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO lesson_plan_templates (id, name, category, description, duration_minutes, objectives, key_points, preparation, process)
       VALUES (?, ?, 'custom', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name.trim(),
      normStr(input.description ?? null),
      normNum(input.durationMinutes ?? null),
      normStr(input.objectives ?? null),
      normStr(input.keyPoints ?? null),
      normStr(input.preparation ?? null),
      normStr(input.process ?? null)
    )
  return get(id)!
}

export function update(
  id: string,
  input: Partial<LessonPlanTemplateRecordInput>
): LessonPlanTemplateRecord | null {
  const cur = get(id)
  if (!cur) return null
  const next: Record<string, string | number | null> = {}
  if (input.name !== undefined) next.name = input.name.trim()
  if (input.description !== undefined) next.description = normStr(input.description)
  if (input.durationMinutes !== undefined) next.duration_minutes = normNum(input.durationMinutes)
  if (input.objectives !== undefined) next.objectives = normStr(input.objectives)
  if (input.keyPoints !== undefined) next.key_points = normStr(input.keyPoints)
  if (input.preparation !== undefined) next.preparation = normStr(input.preparation)
  if (input.process !== undefined) next.process = normStr(input.process)
  if (Object.keys(next).length === 0) return cur
  const sets = Object.keys(next).map((k) => `${k} = ?`).join(', ')
  db().prepare(`UPDATE lesson_plan_templates SET ${sets} WHERE id = ?`).run(
    ...Object.values(next),
    id
  )
  return get(id)
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM lesson_plan_templates WHERE id = ?`).run(id)
}
