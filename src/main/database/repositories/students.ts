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
  const tag = q?.tag?.trim()

  // 同时支持关键词与标签筛选（标签存储为 JSON 数组，用 LIKE 匹配）
  const conditions: string[] = []
  const params: unknown[] = []
  if (keyword) {
    conditions.push('name LIKE ?')
    params.push(`%${keyword}%`)
  }
  if (tag) {
    conditions.push('tags LIKE ?')
    params.push(`%"${tag.replace(/"/g, '\\"')}"%`)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db()
    .prepare(`SELECT * FROM students ${where} ORDER BY name LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
  return rows.map((r) => mapRow(r as StudentRow))
}

/** 获取所有学生已使用过的标签（去重） */
export function allTags(): string[] {
  const rows = db().prepare(`SELECT tags FROM students`).all() as { tags: string | null }[]
  const set = new Set<string>()
  for (const r of rows) {
    const tags = parseJSON<string[]>(r.tags, [])
    for (const t of tags) set.add(t)
  }
  return Array.from(set).sort()
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
