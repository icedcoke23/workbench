import { db, parseJSON, stringifyJSON, uuid } from '../db'
import type { Resource, ResourceInput } from '@shared/types'

interface ResourceRow {
  id: string
  name: string
  type: string
  file_path: string
  tags: string
  class_id: string | null
  created_at: string
}

function mapRow(r: ResourceRow): Resource {
  return {
    id: r.id,
    name: r.name,
    type: r.type as Resource['type'],
    filePath: r.file_path,
    tags: parseJSON<string[]>(r.tags, []),
    classId: r.class_id,
    createdAt: r.created_at
  }
}

export function list(q?: { type?: string; classId?: string; keyword?: string }): Resource[] {
  let sql = `SELECT * FROM resources WHERE 1=1`
  const params: unknown[] = []
  if (q?.type) {
    sql += ` AND type = ?`
    params.push(q.type)
  }
  if (q?.classId) {
    sql += ` AND class_id = ?`
    params.push(q.classId)
  }
  if (q?.keyword) {
    sql += ` AND name LIKE ?`
    params.push(`%${q.keyword}%`)
  }
  sql += ` ORDER BY created_at DESC`
  return (db().prepare(sql).all(...params) as ResourceRow[]).map(mapRow)
}

export function create(input: ResourceInput): Resource {
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO resources (id, name, type, file_path, tags, class_id) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.name, input.type, input.filePath, stringifyJSON(input.tags ?? []), input.classId ?? null)
  return list().find((r) => r.id === id)!
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM resources WHERE id = ?`).run(id)
}
