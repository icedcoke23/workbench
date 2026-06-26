import * as lessonRepo from '../database/repositories/lessons'
import * as todoRepo from '../database/repositories/todos'
import * as classRepo from '../database/repositories/classes'
import * as studentRepo from '../database/repositories/students'
import * as feedbackRepo from '../database/repositories/feedbacks'
import type { DashboardCharts, DashboardData, Todo } from '@shared/types'

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

  // 图表数据
  const charts = buildCharts(weekLessons)

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
    charts
  }
}

/** 构建仪表盘图表数据 */
function buildCharts(weekLessons: ReturnType<typeof lessonRepo.list>): DashboardCharts {
  // 1. 本周每日课时分布（0=周一 ... 6=周日）
  const weekdayLessonCounts = [0, 0, 0, 0, 0, 0, 0]
  for (const l of weekLessons) {
    const d = new Date(l.startTime).getDay() // 0=周日
    const idx = d === 0 ? 6 : d - 1 // 转换为 0=周一
    weekdayLessonCounts[idx]++
  }

  // 2. 班级学生数分布
  const classes = classRepo.list()
  const classStudentCounts = classes.map((c) => ({
    name: c.name,
    count: classRepo.members(c.id).length,
    type: c.type
  }))

  // 3. 反馈状态统计
  const allFeedbacks = feedbackRepo.list()
  const feedbackStats = {
    draft: allFeedbacks.filter((f) => f.status === 'draft').length,
    published: allFeedbacks.filter((f) => f.status === 'published').length
  }

  return {
    weekdayLessonCounts,
    classStudentCounts,
    feedbackStats
  }
}

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay() || 7 // 周日=7
  date.setDate(date.getDate() - day + 1) // 周一为起点
  date.setHours(0, 0, 0, 0)
  return date
}
