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

export function list(q?: {
  type?: string
  classId?: string
  keyword?: string
  tag?: string
}): Resource[] {
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
  if (q?.tag) {
    // 通过 JSON_EACH 在 tags 数组中匹配指定标签
    sql += ` AND EXISTS (SELECT 1 FROM JSON_EACH(resources.tags) WHERE JSON_EACH.value = ?)`
    params.push(q.tag)
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

/** 更新资源：未传入的字段沿用原值，返回更新后的资源 */
export function update(id: string, input: Partial<ResourceInput>): Resource {
  const cur = list().find((r) => r.id === id)
  if (!cur) throw new Error('资源不存在')
  db()
    .prepare(
      `UPDATE resources SET name = ?, type = ?, file_path = ?, tags = ?, class_id = ? WHERE id = ?`
    )
    .run(
      input.name ?? cur.name,
      input.type ?? cur.type,
      input.filePath ?? cur.filePath,
      stringifyJSON(input.tags ?? cur.tags),
      input.classId ?? cur.classId ?? null,
      id
    )
  return list().find((r) => r.id === id)!
}

/** 收集所有资源的 tags 并去重，返回字符串数组 */
export function allTags(): string[] {
  const rows = db().prepare(`SELECT tags FROM resources`).all() as { tags: string }[]
  const set = new Set<string>()
  for (const r of rows) {
    const tags = parseJSON<string[]>(r.tags, [])
    for (const t of tags) set.add(t)
  }
  return [...set]
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM resources WHERE id = ?`).run(id)
}
