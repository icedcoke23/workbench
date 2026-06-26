import { db } from '../database/db'
import * as studentRepo from '../database/repositories/students'
import type { StudentHistory } from '@shared/types'

/** 获取学生学习历史：所在班级、参与课次、积分统计等 */
export function getStudentHistory(studentId: string): StudentHistory {
  const student = studentRepo.get(studentId)
  if (!student) throw new Error('学生不存在')

  // 1. 所在班级
  const classRows = db()
    .prepare(
      `SELECT c.id, c.name, c.type, e.total_score
       FROM enrollments e
       JOIN classes c ON c.id = e.class_id
       WHERE e.student_id = ?
       ORDER BY c.name ASC`
    )
    .all(studentId) as Array<{
      id: string
      name: string
      type: string
      total_score: number
    }>

  const classes = classRows.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type as StudentHistory['classes'][number]['type'],
    totalScore: c.total_score
  }))

  // 2. 参与的课次记录（通过 lesson_records 关联）
  const recordRows = db()
    .prepare(
      `SELECT l.id, l.start_time, l.status, l.subject,
              c.name as class_name,
              r.score_change, r.is_picked, r.participation_note
       FROM lesson_records r
       JOIN lessons l ON l.id = r.lesson_id
       JOIN classes c ON c.id = l.class_id
       WHERE r.student_id = ?
       ORDER BY l.start_time DESC`
    )
    .all(studentId) as Array<{
      id: string
      start_time: string
      status: string
      subject: string | null
      class_name: string
      score_change: number
      is_picked: number
      participation_note: string | null
    }>

  const lessons = recordRows.map((r) => ({
    id: r.id,
    className: r.class_name,
    startTime: r.start_time,
    status: r.status as StudentHistory['lessons'][number]['status'],
    subject: r.subject,
    scoreChange: r.score_change,
    isPicked: r.is_picked === 1,
    note: r.participation_note
  }))

  // 3. 统计
  const totalLessons = new Set(recordRows.map((r) => r.id)).size
  const totalScore = classRows.reduce((s, c) => s + c.total_score, 0)
  const pickedCount = recordRows.filter((r) => r.is_picked === 1).length
  const finishedCount = recordRows.filter(
    (r) => r.status === 'finished'
  ).length
  const finishedRate = totalLessons > 0 ? finishedCount / totalLessons : 0

  return {
    student,
    classes,
    lessons,
    stats: {
      totalLessons,
      totalScore,
      pickedCount,
      finishedRate: Math.round(finishedRate * 100) / 100
    }
  }
}

/** 获取班级总课时数（用于 Dashboard 进一步统计，可选） */
export function getClassLessonCount(classId: string): number {
  const row = db()
    .prepare(`SELECT COUNT(*) as n FROM lessons WHERE class_id = ?`)
    .get(classId) as { n: number }
  return row.n
}
