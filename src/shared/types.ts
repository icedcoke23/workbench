// 跨进程共享的类型定义（主进程与渲染进程共用）

// ============ 通用 ============
export type ID = string

export interface Result<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export interface PageQuery {
  page?: number
  pageSize?: number
  keyword?: string
  tag?: string
}
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// ============ 学生 ============
export interface Student {
  id: ID
  name: string
  avatarPath?: string | null
  grade?: string | null
  tags: string[]
  createdAt: string
}
export interface StudentInput {
  name: string
  avatarPath?: string | null
  grade?: string | null
  tags?: string[]
}

// ============ 班级 ============
export type ClassType = 'regular' | 'training' | 'temp'
export interface ClassInfo {
  id: ID
  name: string
  type: ClassType
  scheduleRule?: ScheduleRule | null
  studentCount?: number
  createdAt: string
}
export interface ScheduleRule {
  weekday: number // 0=周日 ... 6=周六
  startTime: string // HH:mm
  endTime: string // HH:mm
  subject?: string
}
export interface ClassInput {
  name: string
  type?: ClassType
  scheduleRule?: ScheduleRule | null
  studentIds?: ID[]
}

// ============ 班级成员 ============
export interface Enrollment {
  id: ID
  studentId: ID
  classId: ID
  totalScore: number
  studentName?: string
  studentAvatar?: string | null
}

// ============ 点子库 ============
export type IdeaStatus = 'idea' | 'developing' | 'archived'
export interface Idea {
  id: ID
  title: string
  targetCourse?: string | null
  description?: string | null
  status: IdeaStatus
  versions?: IdeaVersion[]
  createdAt: string
  updatedAt: string
}
export interface IdeaVersion {
  id: ID
  ideaId: ID
  versionName: string
  filePath?: string | null
  notes?: string | null
  createdAt: string
}
export interface IdeaInput {
  title: string
  targetCourse?: string
  description?: string
  status?: IdeaStatus
}
export interface IdeaVersionInput {
  ideaId: ID
  versionName: string
  notes?: string
  filePath?: string
}

// ============ 教案 ============
export interface LessonPlan {
  id: ID
  ideaVersionId: ID
  versionName?: string
  ideaTitle?: string | null
  ideaId?: ID
  title?: string | null
  objectives?: string | null
  keyPoints?: string | null
  preparation?: string | null
  process?: string | null
  reflection?: string | null
  durationMinutes?: number | null
  createdAt: string
  updatedAt: string
  /** 使用该教案（关联版本）的课次数（list 时按需聚合，可能为空） */
  lessonCount?: number
  /** 使用该教案的班级名集合（list 时按需聚合） */
  usedClasses?: string[]
  /** 使用该教案的科目集合（list 时按需聚合） */
  usedSubjects?: string[]
  /** 关联的结构化素材列表（get/getByVersion 时按需附带，list 不附带） */
  resources?: PlanResource[]
}
/**
 * 教案关联的结构化素材（plan_resources 表）。
 * 与 preparation 文本里的 Markdown 死引用双轨共存：本字段为授课侧一键打开提供完整文件信息。
 */
export interface PlanResource {
  id: ID
  planId: ID
  resourceId: ID
  /** 关联到教案的哪个章节，默认 preparation */
  section: string
  sortOrder: number
  note?: string | null
  createdAt: string
  /** 资源快照（JOIN resources 表带出，便于前端直接渲染无需二次查询） */
  resource?: Resource
}
/** 挂载素材到教案的入参 */
export interface PlanResourceAttachInput {
  resourceId: ID
  section?: string
  sortOrder?: number
  note?: string | null
}
export interface LessonPlanInput {
  ideaVersionId: ID
  title?: string | null
  objectives?: string | null
  keyPoints?: string | null
  preparation?: string | null
  process?: string | null
  reflection?: string | null
  durationMinutes?: number | null
}
/** 教案克隆入参：将现有教案内容复制到新版本（反思不复制） */
export interface LessonPlanCloneInput {
  /** 目标点子 ID；不传则新建一个点子承载克隆版本 */
  ideaId?: ID
  /** 新点子标题（ideaId 为空时使用） */
  ideaTitle?: string
  /** 新版本名 */
  versionName: string
  /** 新教案标题；不传则沿用源教案标题加「（副本）」后缀 */
  title?: string | null
}

// ============ 课程/课次 ============
export type LessonStatus = 'pending' | 'teaching' | 'finished'

/**
 * 备课进度阶段（由课次关联版本与教案内容派生）：
 * - no-version：未关联备课作品版本
 * - no-plan：已关联版本但未编写教案
 * - plan-incomplete：教案已存在但「教学目标」或「教学过程」关键章节为空
 * - ready：备课完成
 */
export type PrepStage = 'no-version' | 'no-plan' | 'plan-incomplete' | 'ready'

export interface Lesson {
  id: ID
  classId: ID
  className?: string
  startTime: string
  endTime: string
  ideaVersionId?: string | null
  ideaTitle?: string | null
  status: LessonStatus
  feedbackSent: boolean
  subject?: string | null
  /** 备课进度阶段（list/get 时由 SQL JOIN 派生，可能为空表示未计算） */
  prepStage?: PrepStage
  /** 课后反思（per-lesson 存储，避免同版本多课次互相覆盖） */
  reflection?: string | null
  /** 反思填写时间（ISO），为空表示未填写 */
  reflectedAt?: string | null
  /** AI 教学目标达成度评估全文（per-lesson 存储） */
  achievementAssessment?: string | null
  /** 评估生成时间（ISO），为空表示未生成 */
  assessmentAt?: string | null
}

/** 备课进度看板：跨点子/版本的备课完成情况汇总 */
export interface PrepOverview {
  /** 全部作品版本数 */
  totalVersions: number
  /** 已编写教案的版本数 */
  versionsWithPlan: number
  /** 教案关键章节（目标+过程）齐全的版本数 */
  versionsWithCompletePlan: number
  /** 备课就绪率（0-100） */
  readinessPct: number
  /** 近期待上课且备课未就绪的课次（按开始时间升序） */
  upcomingUnprepared: PrepOverviewLesson[]
}

export interface PrepOverviewLesson {
  lessonId: ID
  startTime: string
  endTime: string
  className?: string
  subject?: string | null
  ideaTitle?: string | null
  ideaVersionId?: string | null
  prepStage: PrepStage
}
export interface LessonInput {
  classId: ID
  startTime: string
  endTime: string
  ideaVersionId?: string | null
  subject?: string
}

// ============ 课堂记录 ============
export interface LessonRecord {
  id: ID
  lessonId: ID
  studentId: ID
  scoreChange: number
  participationNote?: string | null
  isPicked: boolean
  createdAt: string
  studentName?: string
}
export interface ScoreAction {
  lessonId: ID
  studentId: ID
  scoreChange: number
  note?: string
}

// ============ 待办 ============
export type TodoType = 'prep' | 'feedback' | 'reflection' | 'manual'
export type TodoStatus = 'todo' | 'doing' | 'done'
export interface Todo {
  id: ID
  title: string
  type: TodoType
  status: TodoStatus
  refLessonId?: string | null
  refIdeaId?: string | null
  dueAt?: string | null
  createdAt: string
}

// ============ 资源库 ============
export type ResourceType = 'backdrop' | 'sprite' | 'sound'
export interface Resource {
  id: ID
  name: string
  type: ResourceType
  filePath: string
  tags: string[]
  classId?: string | null
  createdAt: string
}
export interface ResourceInput {
  name: string
  type: ResourceType
  filePath: string
  tags?: string[]
  classId?: string | null
}

// ============ 反馈/报告 ============
export interface Feedback {
  id: ID
  lessonId?: string | null
  classId: ID
  periodStart: string
  periodEnd: string
  content: string
  aiReport?: string | null
  status: 'draft' | 'published'
  sentAt?: string | null
  sentChannel?: string | null
  createdAt: string
}

// ============ AI ============
export interface AISettings {
  apiKey: string
  baseUrl: string
  modelId: string
  visionModelId?: string
  systemPrompt: string
  useCustomAI: boolean
}
export interface ScheduleParseResult {
  classes: Array<{
    name: string
    subject: string
    weekday: number
    startTime: string
    endTime: string
    students: string[]
  }>
}

// ============ 设置 ============
export interface SyncSettings {
  enabled: boolean
  serverUrl: string
  token: string
  lastSyncAt?: string | null
  autoSync: boolean
}
export interface WeChatSettings {
  defaultGroupName: string
  searchHotkey: string
  sendDelayMs: number
  autoActivate: boolean
}
export interface ScratchSettings {
  guiUrl: string
  autoLaunch: boolean
  workspaceDir: string
}
export interface AppSettings {
  ai: AISettings
  sync: SyncSettings
  wechat: WeChatSettings
  scratch: ScratchSettings
}

// ============ 仪表盘聚合 ============
export interface DashboardData {
  todos: Todo[]
  weekLessons: Lesson[]
  todayLessons: Lesson[]
  stats: {
    totalStudents: number
    totalClasses: number
    weekLessonCount: number
    pendingFeedbackCount: number
    pendingPrepCount: number
    pendingReflectionCount: number
  }
  charts?: DashboardCharts
}

export interface DashboardCharts {
  weekdayLessonCounts: number[]
  classStudentCounts: Array<{ name: string; count: number; type: ClassType }>
  feedbackStats: { draft: number; published: number }
}

// ============ 反馈模板 ============
export type FeedbackTemplateCategory =
  | 'general'
  | 'praise'
  | 'suggestion'
  | 'progress'
  | 'custom'
export interface FeedbackTemplate {
  id: ID
  name: string
  category: FeedbackTemplateCategory
  content: string
  isBuiltin: boolean
  sortOrder?: number
  createdAt: string
  updatedAt: string
}
export interface FeedbackTemplateInput {
  name: string
  category?: FeedbackTemplateCategory
  content: string
  sortOrder?: number
}

// ============ 教案模板（用户自定义） ============
/**
 * 用户自定义教案模板。与静态 LESSON_PLAN_TEMPLATES 结构对齐，
 * category 固定为 'custom'（内置模板仍由静态数据提供，不入库）。
 */
export interface LessonPlanTemplateRecord {
  id: ID
  name: string
  category: 'custom'
  description: string | null
  durationMinutes: number | null
  objectives: string | null
  keyPoints: string | null
  preparation: string | null
  process: string | null
  createdAt: string
  updatedAt: string
}
export interface LessonPlanTemplateRecordInput {
  name: string
  description?: string | null
  durationMinutes?: number | null
  objectives?: string | null
  keyPoints?: string | null
  preparation?: string | null
  process?: string | null
}

// ============ 学生学习历史 ============
export interface StudentHistory {
  student: Student
  classes: Array<{ id: ID; name: string; type: ClassType; totalScore: number }>
  lessons: Array<{
    id: ID
    className: string
    startTime: string
    status: LessonStatus
    subject?: string | null
    scoreChange: number
    isPicked: boolean
    note?: string | null
  }>
  stats: {
    totalLessons: number
    totalScore: number
    pickedCount: number
    finishedRate: number
  }
}

// ============ Scratch 保存事件 ============
export interface ScratchSavePayload {
  projectJson: unknown
  fileName?: string
}
export interface ArchiveTarget {
  ideaId: string
  versionName: string
  notes?: string
}

/** 版本作品元信息，用于在不打开编辑器的情况下快速预览 */
export interface VersionMeta {
  hasFile: boolean
  spriteCount: number
  scriptCount: number
  costumeCount: number
  soundCount: number
  spriteNames: string[]
  fileSize: number
}

/** 文档关联记录（含班级名，用于管理列表展示） */
export interface DocLinkWithLesson {
  id: string
  lesson_id: string
  url: string
  title: string | null
  created_at: string
  class_name: string | null
  lesson_start_time: string | null
}

// ============ 菜单 / 快捷键 ============
export type ViewName =
  | 'dashboard'
  | 'students'
  | 'classes'
  | 'prep'
  | 'teaching'
  | 'post'
  | 'settings'

export type MenuAction =
  | { type: 'navigate'; view: ViewName }
  | { type: 'toggle-sidebar' }
  | { type: 'new-item' }
  | { type: 'refresh' }
  | { type: 'export-data' }
  | { type: 'import-data' }
  | { type: 'reload' }
  | { type: 'toggle-devtools' }
  | { type: 'zoom-in' }
  | { type: 'zoom-out' }
  | { type: 'zoom-reset' }
  | { type: 'about' }
