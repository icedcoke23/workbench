import { db, uuid } from '../db'
import type { Lesson, LessonInput, LessonRecord, ScoreAction } from '@shared/types'
import * as classRepo from './classes'

interface LessonRow {
  id: string
  class_id: string
  start_time: string
  end_time: string
  idea_version_id: string | null
  subject: string | null
  status: string
  feedback_sent: number
  created_at: string
}

function mapRow(r: LessonRow, className?: string, ideaTitle?: string | null): Lesson {
  return {
    id: r.id,
    classId: r.class_id,
    className,
    startTime: r.start_time,
    endTime: r.end_time,
    ideaVersionId: r.idea_version_id,
    ideaTitle,
    status: r.status as Lesson['status'],
    feedbackSent: r.feedback_sent === 1,
    subject: r.subject
  }
}

export function list(q: { classId?: string; from?: string; to?: string }): Lesson[] {
  let sql = `SELECT l.*, c.name as class_name, i.title as idea_title
             FROM lessons l
             LEFT JOIN classes c ON c.id = l.class_id
             LEFT JOIN idea_versions v ON v.id = l.idea_version_id
             LEFT JOIN ideas i ON i.id = v.idea_id
             WHERE 1=1`
  const params: unknown[] = []
  if (q.classId) {
    sql += ` AND l.class_id = ?`
    params.push(q.classId)
  }
  if (q.from) {
    sql += ` AND l.start_time >= ?`
    params.push(q.from)
  }
  if (q.to) {
    sql += ` AND l.start_time <= ?`
    params.push(q.to)
  }
  sql += ` ORDER BY l.start_time ASC`
  const rows = db().prepare(sql).all(...params) as Array<LessonRow & { class_name?: string; idea_title?: string }>
  return rows.map((r) => mapRow(r, r.class_name, r.idea_title ?? null))
}

export function get(id: string): Lesson | null {
  const row = db()
    .prepare(
      `SELECT l.*, c.name as class_name, i.title as idea_title
       FROM lessons l
       LEFT JOIN classes c ON c.id = l.class_id
       LEFT JOIN idea_versions v ON v.id = l.idea_version_id
       LEFT JOIN ideas i ON i.id = v.idea_id
       WHERE l.id = ?`
    )
    .get(id) as (LessonRow & { class_name?: string; idea_title?: string }) | undefined
  return row ? mapRow(row, row.class_name, row.idea_title ?? null) : null
}

export function create(input: LessonInput): Lesson {
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO lessons (id, class_id, start_time, end_time, idea_version_id, subject, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(id, input.classId, input.startTime, input.endTime, input.ideaVersionId ?? null, input.subject ?? null)
  return get(id)!
}

export function update(id: string, input: Partial<LessonInput>): Lesson | null {
  const cur = get(id)
  if (!cur) return null
  db()
    .prepare(
      `UPDATE lessons SET class_id = ?, start_time = ?, end_time = ?, idea_version_id = ?, subject = ? WHERE id = ?`
    )
    .run(
      input.classId ?? cur.classId,
      input.startTime ?? cur.startTime,
      input.endTime ?? cur.endTime,
      input.ideaVersionId ?? cur.ideaVersionId,
      input.subject ?? cur.subject ?? null,
      id
    )
  return get(id)
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM lessons WHERE id = ?`).run(id)
}

export function finish(id: string): Lesson | null {
  db().prepare(`UPDATE lessons SET status = 'finished' WHERE id = ?`).run(id)
  return get(id)
}

export function setFeedbackSent(id: string): void {
  db().prepare(`UPDATE lessons SET feedback_sent = 1 WHERE id = ?`).run(id)
}

interface RecordRow {
  id: string
  lesson_id: string
  student_id: string
  score_change: number
  participation_note: string | null
  is_picked: number
  created_at: string
  name?: string
}

function mapRecord(r: RecordRow): LessonRecord {
  return {
    id: r.id,
    lessonId: r.lesson_id,
    studentId: r.student_id,
    scoreChange: r.score_change,
    participationNote: r.participation_note,
    isPicked: r.is_picked === 1,
    createdAt: r.created_at,
    studentName: r.name
  }
}

export function records(lessonId: string): LessonRecord[] {
  const rows = db()
    .prepare(
      `SELECT r.*, s.name FROM lesson_records r
       LEFT JOIN students s ON s.id = r.student_id
       WHERE r.lesson_id = ? ORDER BY r.created_at ASC`
    )
    .all(lessonId) as RecordRow[]
  return rows.map(mapRecord)
}

export function score(action: ScoreAction): LessonRecord {
  const lesson = get(action.lessonId)
  if (!lesson) throw new Error('课次不存在')
  const id = uuid()
  // 用事务包裹两条写入，保证课堂记录与累计积分一致
  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO lesson_records (id, lesson_id, student_id, score_change, participation_note)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, action.lessonId, action.studentId, action.scoreChange, action.note ?? null)
    // 同步更新班级累计积分
    classRepo.addScore(lesson.classId, action.studentId, action.scoreChange)
  })()
  return records(action.lessonId).find((r) => r.id === id)!
}

/** 加权随机点名：未被点过/最近未点名的学生权重高 */
export function pickStudent(lessonId: string): { studentId: string } | null {
  const lesson = get(lessonId)
  if (!lesson) throw new Error('课次不存在')
  const members = classRepo.members(lesson.classId)
  if (members.length === 0) return null

  const pickedRows = db()
    .prepare(
      `SELECT student_id, MAX(created_at) as last_picked FROM lesson_records
       WHERE lesson_id = ? AND is_picked = 1 GROUP BY student_id`
    )
    .all(lessonId) as Array<{ student_id: string; last_picked: string | null }>

  const pickedMap = new Map<string, number>()
  const nowTs = Date.now()
  for (const r of pickedRows) {
    const t = r.last_picked ? new Date(r.last_picked).getTime() : 0
    // 距离上次点名越久，权重越高（衰减）
    const decayHours = (nowTs - t) / 3_600_000
    pickedMap.set(r.student_id, decayHours)
  }

  const weighted = members.map((m) => {
    const decay = pickedMap.get(m.id) ?? 9999 // 从未被点名，权重最高
    return { id: m.id, weight: 1 + decay } // 基础权重1 + 衰减
  })
  const total = weighted.reduce((s, w) => s + w.weight, 0)
  let r = Math.random() * total
  for (const w of weighted) {
    r -= w.weight
    if (r <= 0) {
      // 记录点名
      db()
        .prepare(
          `INSERT INTO lesson_records (id, lesson_id, student_id, score_change, is_picked)
           VALUES (?, ?, ?, 0, 1)`
        )
        .run(uuid(), lessonId, w.id)
      return { studentId: w.id }
    }
  }
  const fallback = weighted[0]
  db()
    .prepare(
      `INSERT INTO lesson_records (id, lesson_id, student_id, score_change, is_picked)
       VALUES (?, ?, ?, 0, 1)`
    )
    .run(uuid(), lessonId, fallback.id)
  return { studentId: fallback.id }
}
