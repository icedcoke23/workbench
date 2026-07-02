import * as lessonRepo from '../database/repositories/lessons'
import * as todoRepo from '../database/repositories/todos'
import type { AutoTodoSpec } from '../database/repositories/todos'
import * as classRepo from '../database/repositories/classes'
import * as studentRepo from '../database/repositories/students'
import * as feedbackRepo from '../database/repositories/feedbacks'
import * as lessonPlanService from './lesson-plan'
import type { DashboardCharts, DashboardData, Lesson, Todo } from '@shared/types'

/** 备课待办提前窗口（小时）：未来该窗口内备课未完成的课次生成备课待办 */
const PREP_LEAD_HOURS = 24
/** 反馈待办有效期（小时）：课次结束后该窗口内未发反馈则生成反馈待办 */
const FEEDBACK_DUE_HOURS = 24
/** 反思待办有效期（小时）：课次结束后该窗口内未填反思则生成反思待办 */
const REFLECTION_DUE_HOURS = 48

/**
 * G25: 读取课次的备课就绪状态并返回待办标注文本；已就绪返回空字符串（不生成待办）。
 *
 * 用精确就绪等级（computePlanReadiness，与看板统计同口径）替代粗粒度 SQL
 * prep_stage（后者仅检查 objectives+process 非空）。无版本/无教案按粗粒度
 * 直接判定；有教案的用精确等级，避免「统计为 partial 却不生成待办」的矛盾。
 */
function prepReadinessLabel(lesson: Lesson): string {
  const coarse = lesson.prepStage ?? 'no-version'
  if (coarse === 'no-version') return '待关联备课版本'
  if (coarse === 'no-plan') return '待编写教案'
  // plan-incomplete 或 coarse-ready：用精确等级判定是否就绪
  const level = lessonPlanService.getReadinessLevelForVersion(lesson.ideaVersionId)
  return level === 'ready' ? '' : '待完善教案'
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
  // 已结课但未填写反思的课次（per-lesson 反思字段为空）
  const reflectionPending = lessonRepo.list({}).filter(
    (l) => l.status === 'finished' && !l.reflection
  )

  const desired: AutoTodoSpec[] = []

  // 备课待办：未来窗口内备课未完成的课次，按就绪状态标注具体缺失项
  for (const l of upcoming) {
    const label = prepReadinessLabel(l)
    if (!label) continue // 已就绪，不生成待办
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

  // 反思待办：已结课未填反思的课次，限定在结束后窗口期内提醒
  for (const l of reflectionPending) {
    const due = new Date(
      new Date(l.endTime).getTime() + REFLECTION_DUE_HOURS * 3_600_000
    ).toISOString()
    desired.push({
      type: 'reflection',
      refLessonId: l.id,
      title: `反思待办：${l.className ?? '课程'} ${l.startTime}`,
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
      pendingPrepCount: todos.filter((t) => t.type === 'prep' && t.status !== 'done').length,
      pendingReflectionCount: todos.filter((t) => t.type === 'reflection' && t.status !== 'done').length
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
