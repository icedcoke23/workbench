import * as lessonRepo from '../database/repositories/lessons'
import * as todoRepo from '../database/repositories/todos'
import type { AutoTodoSpec } from '../database/repositories/todos'
import * as classRepo from '../database/repositories/classes'
import * as studentRepo from '../database/repositories/students'
import * as feedbackRepo from '../database/repositories/feedbacks'
import * as lessonPlanRepo from '../database/repositories/lesson-plans'
import type { DashboardCharts, DashboardData, Lesson, Todo } from '@shared/types'

/** 备课待办提前窗口（小时）：未来该窗口内备课未完成的课次生成备课待办 */
const PREP_LEAD_HOURS = 24
/** 反馈待办有效期（小时）：课次结束后该窗口内未发反馈则生成反馈待办 */
const FEEDBACK_DUE_HOURS = 24

/** 备课进度阶段 */
type PrepStage = 'no-version' | 'no-plan' | 'plan-incomplete' | 'ready'

/**
 * 评估单节课的备课进度阶段：
 * - no-version：未关联备课作品版本
 * - no-plan：已关联版本但未编写教案
 * - plan-incomplete：教案已存在但「教学目标」或「教学过程」关键章节为空
 * - ready：备课完成（有关联版本 + 教案含目标与过程）
 */
function assessPrepStage(lesson: Lesson): { stage: PrepStage; label: string } {
  if (!lesson.ideaVersionId) {
    return { stage: 'no-version', label: '待关联备课版本' }
  }
  const plan = lessonPlanRepo.getByVersion(lesson.ideaVersionId)
  if (!plan) {
    return { stage: 'no-plan', label: '待编写教案' }
  }
  if (!plan.objectives || !plan.process) {
    return { stage: 'plan-incomplete', label: '待完善教案' }
  }
  return { stage: 'ready', label: '' }
}

/** 重新生成自动待办并返回列表 */
export function regenerateAutoTodos(): Todo[] {
  const now = new Date()
  const prepDeadline = new Date(now.getTime() + PREP_LEAD_HOURS * 3_600_000)

  const upcoming = lessonRepo.list({
    from: now.toISOString(),
    to: prepDeadline.toISOString()
  })
  const finished = lessonRepo.list({}).filter(
    (l) => l.status === 'finished' && !l.feedbackSent
  )

  const desired: AutoTodoSpec[] = []

  // 备课待办：未来窗口内备课未完成的课次，按进度阶段标注具体缺失项
  for (const l of upcoming) {
    const { stage, label } = assessPrepStage(l)
    if (stage === 'ready') continue
    desired.push({
      type: 'prep',
      refLessonId: l.id,
      title: `备课待办：${l.className ?? '课程'} ${l.startTime} · ${label}`,
      dueAt: l.startTime
    })
  }

  // 反馈待办：已结束未发反馈的课次
  for (const l of finished) {
    const due = new Date(
      new Date(l.endTime).getTime() + FEEDBACK_DUE_HOURS * 3_600_000
    ).toISOString()
    desired.push({
      type: 'feedback',
      refLessonId: l.id,
      title: `反馈待办：${l.className ?? '课程'} ${l.startTime}`,
      dueAt: due
    })
  }

  return todoRepo.syncAutoTodos(desired)
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
      pendingFeedbackCount: todos.filter((t) => t.type === 'feedback' && t.status !== 'done').length,
      pendingPrepCount: todos.filter((t) => t.type === 'prep' && t.status !== 'done').length
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
