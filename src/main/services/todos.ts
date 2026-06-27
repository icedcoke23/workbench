import * as lessonRepo from '../database/repositories/lessons'
import * as todoRepo from '../database/repositories/todos'
import * as classRepo from '../database/repositories/classes'
import * as studentRepo from '../database/repositories/students'
import * as feedbackRepo from '../database/repositories/feedbacks'
import type { DashboardCharts, DashboardData, Lesson, Todo } from '@shared/types'

/** 重新生成自动待办并返回列表 */
export function regenerateAutoTodos(): Todo[] {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 3_600_000)

  const upcoming = lessonRepo.list({
    from: now.toISOString(),
    to: in24h.toISOString()
  })
  const finished = lessonRepo.list({}).filter(
    (l) => l.status === 'finished' && !l.feedbackSent
  )
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
    },
    charts: buildCharts(weekLessons)
  }
}

/** 构建仪表盘图表数据：周课次分布、班级学生数、反馈统计 */
function buildCharts(weekLessons: Lesson[]): DashboardCharts {
  // 周一到周日的课次数量（0=周一..6=周日）
  const weekdayLessonCounts = [0, 0, 0, 0, 0, 0, 0]
  for (const l of weekLessons) {
    const d = new Date(l.startTime).getDay() // 0=周日..6=周六
    const idx = d === 0 ? 6 : d - 1 // 转换为 0=周一..6=周日
    weekdayLessonCounts[idx]++
  }
  // 各班级学生数量
  const classStudentCounts = classRepo.list().map((c) => ({
    name: c.name,
    count: classRepo.members(c.id).length,
    type: c.type
  }))
  // 反馈草稿/已发布统计
  const allFeedbacks = feedbackRepo.list()
  const feedbackStats = {
    draft: allFeedbacks.filter((f) => f.status === 'draft').length,
    published: allFeedbacks.filter((f) => f.status === 'published').length
  }
  return { weekdayLessonCounts, classStudentCounts, feedbackStats }
}

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay() || 7 // 周日=7
  date.setDate(date.getDate() - day + 1) // 周一为起点
  date.setHours(0, 0, 0, 0)
  return date
}
