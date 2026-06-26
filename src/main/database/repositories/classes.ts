import { db, parseJSON, stringifyJSON, uuid } from '../db'
import type { ClassInfo, ClassInput, PageQuery, Student } from '@shared/types'
import { get as getStudent } from './students'

interface ClassRow {
  id: string
  name: string
  type: string
  schedule_rule: string | null
  created_at: string
}

function mapRow(r: ClassRow, studentCount = 0): ClassInfo {
  return {
    id: r.id,
    name: r.name,
    type: r.type as ClassInfo['type'],
    scheduleRule: parseJSON(r.schedule_rule, null),
    studentCount,
    createdAt: r.created_at
  }
}

export function list(_q?: PageQuery): ClassInfo[] {
  const rows = db()
    .prepare(`SELECT * FROM classes ORDER BY created_at DESC`)
    .all() as ClassRow[]
  const countStmt = db().prepare(
    `SELECT COUNT(*) as c FROM enrollments WHERE class_id = ?`
  )
  return rows.map((r) => mapRow(r, (countStmt.get(r.id) as { c: number }).c))
}

export function get(id: string): ClassInfo | null {
  const row = db().prepare(`SELECT * FROM classes WHERE id = ?`).get(id) as ClassRow | undefined
  if (!row) return null
  const c = (db().prepare(`SELECT COUNT(*) as c FROM enrollments WHERE class_id = ?`).get(id) as { c: number }).c
  return mapRow(row, c)
}

export function create(input: ClassInput): ClassInfo {
  const id = uuid()
  db()
    .prepare(`INSERT INTO classes (id, name, type, schedule_rule) VALUES (?, ?, ?, ?)`)
    .run(
      id,
      input.name,
      input.type ?? 'regular',
      stringifyJSON(input.scheduleRule ?? null)
    )
  if (input.studentIds?.length) {
    const stmt = db().prepare(
      `INSERT OR IGNORE INTO enrollments (id, student_id, class_id) VALUES (?, ?, ?)`
    )
    for (const sid of input.studentIds) stmt.run(uuid(), sid, id)
  }
  return get(id)!
}

export function update(id: string, input: Partial<ClassInput>): ClassInfo | null {
  const cur = get(id)
  if (!cur) return null
  db()
    .prepare(`UPDATE classes SET name = ?, type = ?, schedule_rule = ? WHERE id = ?`)
    .run(
      input.name ?? cur.name,
      input.type ?? cur.type,
      stringifyJSON(input.scheduleRule ?? cur.scheduleRule),
      id
    )
  return get(id)
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM classes WHERE id = ?`).run(id)
}

export function members(classId: string): Student[] {
  const rows = db()
    .prepare(
      `SELECT s.* FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE e.class_id = ? ORDER BY s.name`
    )
    .all(classId) as Array<Record<string, unknown>>
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    avatarPath: (r.avatar_path as string) ?? null,
    grade: (r.grade as string) ?? null,
    tags: parseJSON<string[]>(r.tags as string, []),
    createdAt: r.created_at as string
  }))
}

export function addMembers(classId: string, studentIds: string[]): void {
  const stmt = db().prepare(
    `INSERT OR IGNORE INTO enrollments (id, student_id, class_id) VALUES (?, ?, ?)`
  )
  const tx = db().transaction((ids: string[]) => {
    for (const sid of ids) stmt.run(uuid(), sid, classId)
  })
  tx(studentIds)
}

export function removeMember(classId: string, studentId: string): void {
  db()
    .prepare(`DELETE FROM enrollments WHERE class_id = ? AND student_id = ?`)
    .run(classId, studentId)
}

export function getTotalScore(classId: string, studentId: string): number {
  const row = db()
    .prepare(
      `SELECT total_score FROM enrollments WHERE class_id = ? AND student_id = ?`
    )
    .get(classId, studentId) as { total_score: number } | undefined
  return row?.total_score ?? 0
}

export function addScore(classId: string, studentId: string, delta: number): void {
  db()
    .prepare(
      `UPDATE enrollments SET total_score = total_score + ? WHERE class_id = ? AND student_id = ?`
    )
    .run(delta, classId, studentId)
}

export { getStudent }
