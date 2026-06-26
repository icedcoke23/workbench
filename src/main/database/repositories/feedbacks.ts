import { db, uuid } from '../db'
import type { Feedback } from '@shared/types'

interface FeedbackRow {
  id: string
  lesson_id: string | null
  class_id: string
  period_start: string
  period_end: string
  content: string | null
  ai_report: string | null
  status: string
  sent_at: string | null
  sent_channel: string | null
  created_at: string
  updated_at: string
}

function mapRow(r: FeedbackRow): Feedback {
  return {
    id: r.id,
    lessonId: r.lesson_id,
    classId: r.class_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    content: r.content ?? '',
    aiReport: r.ai_report,
    status: r.status as Feedback['status'],
    sentAt: r.sent_at,
    sentChannel: r.sent_channel,
    createdAt: r.created_at
  }
}

export function list(q?: { classId?: string; from?: string; to?: string }): Feedback[] {
  let sql = `SELECT * FROM feedbacks WHERE 1=1`
  const params: unknown[] = []
  if (q?.classId) {
    sql += ` AND class_id = ?`
    params.push(q.classId)
  }
  if (q?.from) {
    sql += ` AND period_end >= ?`
    params.push(q.from)
  }
  if (q?.to) {
    sql += ` AND period_start <= ?`
    params.push(q.to)
  }
  sql += ` ORDER BY created_at DESC`
  return (db().prepare(sql).all(...params) as FeedbackRow[]).map(mapRow)
}

export function get(id: string): Feedback | null {
  const row = db().prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(id) as FeedbackRow | undefined
  return row ? mapRow(row) : null
}

export function save(input: Partial<Feedback> & { classId: string; periodStart: string; periodEnd: string }): Feedback {
  if (input.id) {
    const cur = get(input.id)
    if (cur) {
      db()
        .prepare(
          `UPDATE feedbacks SET lesson_id = ?, class_id = ?, period_start = ?, period_end = ?,
           content = ?, ai_report = ?, status = ?, sent_at = ?, sent_channel = ? WHERE id = ?`
        )
        .run(
          input.lessonId ?? cur.lessonId ?? null,
          input.classId,
          input.periodStart,
          input.periodEnd,
          input.content ?? cur.content,
          input.aiReport ?? cur.aiReport,
          input.status ?? cur.status,
          input.sentAt ?? cur.sentAt ?? null,
          input.sentChannel ?? cur.sentChannel ?? null,
          input.id
        )
      return get(input.id)!
    }
  }
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO feedbacks (id, lesson_id, class_id, period_start, period_end, content, ai_report, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.lessonId ?? null,
      input.classId,
      input.periodStart,
      input.periodEnd,
      input.content ?? '',
      input.aiReport ?? null,
      input.status ?? 'draft'
    )
  return get(id)!
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM feedbacks WHERE id = ?`).run(id)
}

export function markSent(id: string, channel: string): void {
  db()
    .prepare(`UPDATE feedbacks SET sent_at = ?, sent_channel = ?, status = 'published' WHERE id = ?`)
    .run(new Date().toISOString(), channel, id)
}
