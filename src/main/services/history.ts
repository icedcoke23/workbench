import { db } from '../database/db'
import * as studentRepo from '../database/repositories/students'
import type { StudentHistory, ClassType, LessonStatus } from '@shared/types'

interface ClassHistoryRow {
  id: string
  name: string
  type: string
  totalScore: number
}

interface LessonHistoryRow {
  id: string
  className: string
  startTime: string
  status: string
  subject: string | null
  scoreChange: number
  isPicked: number
  note: string | null
}

/** 获取学生学习历史聚合数据 */
export function getStudentHistory(studentId: string): StudentHistory {
  const student = studentRepo.get(studentId)
  if (!student) {
    throw new Error('学生不存在')
  }

  // 班级列表：enrollments JOIN classes
  const classRows = db()
    .prepare(
      `SELECT c.id, c.name, c.type, e.total_score as totalScore
       FROM enrollments e JOIN classes c ON c.id = e.class_id
       WHERE e.student_id = ? ORDER BY c.created_at ASC`
    )
    .all(studentId) as ClassHistoryRow[]
  const classes = classRows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as ClassType,
    totalScore: r.totalScore
  }))

  // 课次列表：lesson_records JOIN lessons JOIN classes
  const lessonRows = db()
    .prepare(
      `SELECT l.id, c.name as className, l.start_time as startTime, l.status, l.subject,
              r.score_change as scoreChange, r.is_picked as isPicked, r.participation_note as note
       FROM lesson_records r
       JOIN lessons l ON l.id = r.lesson_id
       JOIN classes c ON c.id = l.class_id
       WHERE r.student_id = ? ORDER BY l.start_time DESC`
    )
    .all(studentId) as LessonHistoryRow[]
  const lessons = lessonRows.map((r) => ({
    id: r.id,
    className: r.className,
    startTime: r.startTime,
    status: r.status as LessonStatus,
    subject: r.subject,
    scoreChange: r.scoreChange,
    isPicked: r.isPicked === 1,
    note: r.note
  }))

  // 统计数据
  const totalLessons = lessons.length
  const totalScore = lessons.reduce((s, l) => s + l.scoreChange, 0)
  const pickedCount = lessons.filter((l) => l.isPicked).length
  const finishedCount = lessons.filter((l) => l.status === 'finished').length
  const finishedRate = totalLessons > 0 ? finishedCount / totalLessons : 0

  return {
    student,
    classes,
    lessons,
    stats: {
      totalLessons,
      totalScore,
      pickedCount,
      finishedRate
    }
  }
}

/** 辅助函数：获取指定班级的课次数量 */
export function getClassLessonCount(classId: string): number {
  const row = db().prepare(`SELECT COUNT(*) as c FROM lessons WHERE class_id = ?`).get(classId) as
    | { c: number }
    | undefined
  return row?.c ?? 0
}
