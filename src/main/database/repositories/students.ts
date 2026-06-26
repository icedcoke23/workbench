import { db, parseJSON, stringifyJSON, uuid } from '../db'
import type { PageQuery, Student, StudentInput } from '@shared/types'

interface StudentRow {
  id: string
  name: string
  avatar_path: string | null
  grade: string | null
  tags: string
  created_at: string
  updated_at: string
}

function mapRow(r: StudentRow): Student {
  return {
    id: r.id,
    name: r.name,
    avatarPath: r.avatar_path,
    grade: r.grade,
    tags: parseJSON<string[]>(r.tags, []),
    createdAt: r.created_at
  }
}

export function list(q?: PageQuery): Student[] {
  const limit = q?.pageSize ?? 1000
  const offset = ((q?.page ?? 1) - 1) * limit
  const keyword = q?.keyword?.trim()
  if (keyword) {
    return db()
      .prepare(`SELECT * FROM students WHERE name LIKE ? ORDER BY name LIMIT ? OFFSET ?`)
      .all(`%${keyword}%`, limit, offset)
      .map((r) => mapRow(r as StudentRow))
  }
  return db()
    .prepare(`SELECT * FROM students ORDER BY name LIMIT ? OFFSET ?`)
    .all(limit, offset)
    .map((r) => mapRow(r as StudentRow))
}

export function get(id: string): Student | null {
  const row = db().prepare(`SELECT * FROM students WHERE id = ?`).get(id) as StudentRow | undefined
  return row ? mapRow(row) : null
}

export function create(input: StudentInput): Student {
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO students (id, name, avatar_path, grade, tags) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, input.name, input.avatarPath ?? null, input.grade ?? null, stringifyJSON(input.tags ?? []))
  return get(id)!
}

export function update(id: string, input: Partial<StudentInput>): Student | null {
  const cur = get(id)
  if (!cur) return null
  db()
    .prepare(
      `UPDATE students SET name = ?, avatar_path = ?, grade = ?, tags = ? WHERE id = ?`
    )
    .run(
      input.name ?? cur.name,
      input.avatarPath ?? cur.avatarPath ?? null,
      input.grade ?? cur.grade ?? null,
      stringifyJSON(input.tags ?? cur.tags),
      id
    )
  return get(id)
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM students WHERE id = ?`).run(id)
}
