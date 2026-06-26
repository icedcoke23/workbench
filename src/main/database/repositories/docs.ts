import { db, uuid } from '../db'

interface DocLink {
  id: string
  lesson_id: string
  url: string
  title: string | null
  created_at: string
}

export function listByLesson(lessonId: string): DocLink[] {
  return db()
    .prepare(`SELECT * FROM doc_links WHERE lesson_id = ? ORDER BY created_at DESC`)
    .all(lessonId) as DocLink[]
}

export function link(lessonId: string, url: string, title: string): DocLink {
  const id = uuid()
  db()
    .prepare(`INSERT INTO doc_links (id, lesson_id, url, title) VALUES (?, ?, ?, ?)`)
    .run(id, lessonId, url, title)
  return listByLesson(lessonId).find((d) => d.id === id)!
}
