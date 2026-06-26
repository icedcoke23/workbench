import { db, uuid } from '../db'
import type { Idea, IdeaInput, IdeaVersion, IdeaVersionInput } from '@shared/types'

interface IdeaRow {
  id: string
  title: string
  target_course: string | null
  description: string | null
  status: string
  created_at: string
  updated_at: string
}
interface VersionRow {
  id: string
  idea_id: string
  version_name: string
  file_path: string | null
  notes: string | null
  created_at: string
}

function mapVersion(r: VersionRow): IdeaVersion {
  return {
    id: r.id,
    ideaId: r.idea_id,
    versionName: r.version_name,
    filePath: r.file_path,
    notes: r.notes,
    createdAt: r.created_at
  }
}

function mapIdea(r: IdeaRow, versions: IdeaVersion[]): Idea {
  return {
    id: r.id,
    title: r.title,
    targetCourse: r.target_course,
    description: r.description,
    status: r.status as Idea['status'],
    versions,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function list(): Idea[] {
  const rows = db().prepare(`SELECT * FROM ideas ORDER BY updated_at DESC`).all() as IdeaRow[]
  const vStmt = db().prepare(`SELECT * FROM idea_versions WHERE idea_id = ? ORDER BY created_at DESC`)
  return rows.map((r) => mapIdea(r, (vStmt.all(r.id) as VersionRow[]).map(mapVersion)))
}

export function get(id: string): Idea | null {
  const row = db().prepare(`SELECT * FROM ideas WHERE id = ?`).get(id) as IdeaRow | undefined
  if (!row) return null
  const versions = (db().prepare(`SELECT * FROM idea_versions WHERE idea_id = ? ORDER BY created_at DESC`).all(id) as VersionRow[]).map(mapVersion)
  return mapIdea(row, versions)
}

export function create(input: IdeaInput): Idea {
  const id = uuid()
  db()
    .prepare(`INSERT INTO ideas (id, title, target_course, description, status) VALUES (?, ?, ?, ?, ?)`)
    .run(id, input.title, input.targetCourse ?? null, input.description ?? null, input.status ?? 'idea')
  return get(id)!
}

export function update(id: string, input: Partial<IdeaInput>): Idea | null {
  const cur = get(id)
  if (!cur) return null
  db()
    .prepare(`UPDATE ideas SET title = ?, target_course = ?, description = ?, status = ? WHERE id = ?`)
    .run(
      input.title ?? cur.title,
      input.targetCourse ?? cur.targetCourse ?? null,
      input.description ?? cur.description ?? null,
      input.status ?? cur.status,
      id
    )
  return get(id)
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM ideas WHERE id = ?`).run(id)
}

export function createVersion(input: IdeaVersionInput): IdeaVersion {
  const id = uuid()
  db()
    .prepare(`INSERT INTO idea_versions (id, idea_id, version_name, file_path, notes) VALUES (?, ?, ?, ?, ?)`)
    .run(id, input.ideaId, input.versionName, input.filePath ?? null, input.notes ?? null)
  const row = db().prepare(`SELECT * FROM idea_versions WHERE id = ?`).get(id) as VersionRow
  return mapVersion(row)
}

export function getVersion(id: string): IdeaVersion | null {
  const row = db().prepare(`SELECT * FROM idea_versions WHERE id = ?`).get(id) as VersionRow | undefined
  return row ? mapVersion(row) : null
}

export function removeVersion(id: string): void {
  db().prepare(`DELETE FROM idea_versions WHERE id = ?`).run(id)
}
