import * as lessonRepo from '../database/repositories/lessons'
import * as todoRepo from '../database/repositories/todos'
import * as classRepo from '../database/repositories/classes'
import * as studentRepo from '../database/repositories/students'
import type { DashboardData, Todo } from '@shared/types'

/** 重新生成自动待办并返回列表 */
export function regenerateAutoTodos(): Todo[] {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 3_600_000)
  const weekLater = new Date(now.getTime() + 7 * 24 * 3_600_000)

  const upcoming = lessonRepo.list({
    from: now.toISOString(),
    to: in24h.toISOString()
  })
  const finished = lessonRepo.list({}).filter(
    (l) => l.status === 'finished' && !l.feedbackSent
  )
  void weekLater
  return todoRepo.regenerateAuto(upcoming, finished)
}

/** 仪表盘聚合数据 */
export function buildDashboard(): DashboardData {
  const todos = todoRepo.list()
  // 本周课程
  const now = new Date()
  const weekStart = startOfWeek(now)
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3_600_000)
  const weekLessons = lessonRepo.list({
    from: weekStart.toISOString(),
    to: weekEnd.toISOString()
  })
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  const todayLessons = lessonRepo.list({
    from: todayStart.toISOString(),
    to: todayEnd.toISOString()
  })

  return {
    todos,
    weekLessons,
    todayLessons,
    stats: {
      totalStudents: studentRepo.list().length,
      totalClasses: classRepo.list().length,
      weekLessonCount: weekLessons.length,
      pendingFeedbackCount: todos.filter((t) => t.type === 'feedback' && t.status !== 'done').length
    }
  }
}

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay() || 7 // 周日=7
  date.setDate(date.getDate() - day + 1) // 周一为起点
  date.setHours(0, 0, 0, 0)
  return date
}
