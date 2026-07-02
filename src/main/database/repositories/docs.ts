import { db, uuid } from '../db'
import type { PlanDocLink } from '@shared/types'

interface DocLink {
  id: string
  lesson_id: string
  url: string
  title: string | null
  created_at: string
}

interface PlanDocLinkRow {
  id: string
  plan_id: string
  url: string
  title: string | null
  created_at: string
}

function mapPlanDocRow(r: PlanDocLinkRow): PlanDocLink {
  return {
    id: r.id,
    planId: r.plan_id,
    url: r.url,
    title: r.title,
    createdAt: r.created_at
  }
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

// ============ 教案级文档挂载（G17） ============

/**
 * 列出教案关联的全部外部文档（按创建时间倒序）。
 * 供编辑器展示已挂载文档清单、授课侧展示继承文档。
 */
export function listByPlan(planId: string): PlanDocLink[] {
  const rows = db()
    .prepare(
      `SELECT id, plan_id, url, title, created_at FROM doc_links
       WHERE plan_id = ? ORDER BY created_at DESC`
    )
    .all(planId) as PlanDocLinkRow[]
  return rows.map(mapPlanDocRow)
}

/**
 * 挂载外部文档到教案。返回新建的关联记录。
 * 与 per-lesson 的 link() 双轨：同一张 doc_links 表，plan_id 非空即教案级。
 */
export function linkPlan(planId: string, url: string, title: string): PlanDocLink {
  const id = uuid()
  db()
    .prepare(`INSERT INTO doc_links (id, plan_id, url, title) VALUES (?, ?, ?, ?)`)
    .run(id, planId, url, title)
  return listByPlan(planId).find((d) => d.id === id)!
}
