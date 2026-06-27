import { db, uuid } from '../db'

interface DocLink {
  id: string
  lesson_id: string
  url: string
  title: string | null
  created_at: string
}

/** 文档关联记录（含班级名，用于管理列表展示） */
export interface DocLinkWithLesson extends DocLink {
  class_name: string | null
  lesson_start_time: string | null
}

export function listByLesson(lessonId: string): DocLink[] {
  return db()
    .prepare(`SELECT * FROM doc_links WHERE lesson_id = ? ORDER BY created_at DESC`)
    .all(lessonId) as DocLink[]
}

/** 列出全部文档关联，含班级名与课次时间 */
export function listAll(): DocLinkWithLesson[] {
  return db()
    .prepare(
      `SELECT d.*, c.name AS class_name, l.start_time AS lesson_start_time
       FROM doc_links d
       LEFT JOIN lessons l ON l.id = d.lesson_id
       LEFT JOIN classes c ON c.id = l.class_id
       ORDER BY d.created_at DESC`
    )
    .all() as DocLinkWithLesson[]
}

export function link(lessonId: string, url: string, title: string): DocLink {
  const id = uuid()
  db()
    .prepare(`INSERT INTO doc_links (id, lesson_id, url, title) VALUES (?, ?, ?, ?)`)
    .run(id, lessonId, url, title)
  return listByLesson(lessonId).find((d) => d.id === id)!
}

/** 删除文档关联 */
export function remove(id: string): void {
  db().prepare(`DELETE FROM doc_links WHERE id = ?`).run(id)
}
