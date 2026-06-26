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

// ============ 课程/课次 ============
export type LessonStatus = 'pending' | 'teaching' | 'finished'
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
export type TodoType = 'prep' | 'feedback' | 'manual'
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
  maxConcurrent?: number
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
