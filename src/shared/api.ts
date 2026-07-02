import type {
  AISettings,
  AppSettings,
  ArchiveTarget,
  ClassInfo,
  ClassInput,
  DashboardData,
  Feedback,
  FeedbackTemplate,
  FeedbackTemplateInput,
  ID,
  Idea,
  IdeaInput,
  IdeaVersion,
  IdeaVersionInput,
  Lesson,
  LessonInput,
  LessonPlan,
  LessonPlanInput,
  LessonPlanCloneInput,
  LessonPlanTemplateRecord,
  PlanResource,
  PlanResourceAttachInput,
  LessonPlanTemplateRecordInput,
  LessonRecord,
  MenuAction,
  PageQuery,
  PrepOverview,
  PrepReadinessSnapshot,
  KnowledgeCoverage,
  KnowledgeCoverageGaps,
  Resource,
  ResourceInput,
  Result,
  ScratchSavePayload,
  ScoreAction,
  Student,
  StudentHistory,
  StudentInput,
  SyncSettings,
  Todo,
  VersionMeta,
  DocLinkWithLesson,
  PlanDocLink,
  WeChatSettings,
  ScheduleParseResult,
  ScratchSettings
} from './types'

// API 命名空间与方法名清单（运行时常量，供 preload 生成显式方法）
// 与 WorkbenchAPI 接口保持同步：新增方法时需同时更新此处
export const API_METHODS: Record<string, string[]> = {
  student: ['list', 'get', 'create', 'update', 'remove', 'allTags'],
  class: ['list', 'get', 'create', 'update', 'remove', 'members', 'addMembers', 'removeMember'],
  lesson: ['list', 'get', 'create', 'update', 'remove', 'finish', 'setReflection', 'assess', 'records', 'score', 'pick'],
  idea: ['list', 'get', 'create', 'update', 'remove', 'createVersion', 'updateVersion', 'removeVersion', 'getVersionMeta'],
  lessonPlan: ['list', 'get', 'getByVersion', 'upsert', 'remove', 'clone', 'generateDraft', 'exportMarkdown', 'exportPdf', 'prepOverview', 'readinessTrend', 'knowledgeCoverage', 'knowledgeCoverageGaps', 'review', 'listResources', 'attachResource', 'detachResource'],
  lessonPlanTemplate: ['list', 'create', 'update', 'remove'],
  todo: ['list', 'create', 'update', 'remove', 'regenerate'],
  resource: ['list', 'create', 'update', 'remove', 'importFile', 'allTags', 'readFile'],
  feedback: ['list', 'get', 'save', 'remove', 'generate', 'generateReport', 'exportPdf', 'sendWeChat'],
  feedbackTemplate: ['list', 'create', 'update', 'remove'],
  schedule: ['parseText', 'parseImage', 'import'],
  scratch: ['launch', 'close', 'saveToIdea', 'saveToResource', 'pickResourceFile'],
  settings: ['get', 'saveAI', 'saveSync', 'saveWeChat', 'saveScratch', 'testAI', 'testSync', 'syncNow'],
  dashboard: ['get'],
  data: ['export', 'importFromFile', 'pickImportFile', 'saveExportToFile'],
  studentHistory: ['get'],
  doc: ['openUrl', 'linkToLesson', 'listLinks', 'listAll', 'removeLink', 'listByPlan', 'linkToPlan'],
  file: ['pickImage', 'saveAvatar', 'readImageBase64']
}

// 渲染进程可调用的全部 API 契约（preload 实现，主进程响应）
export interface WorkbenchAPI {
  // 学生
  student: {
    list: (q?: PageQuery) => Promise<Result<Student[]>>
    get: (id: ID) => Promise<Result<Student>>
    create: (input: StudentInput) => Promise<Result<Student>>
    update: (id: ID, input: Partial<StudentInput>) => Promise<Result<Student>>
    remove: (id: ID) => Promise<Result<void>>
    allTags: () => Promise<Result<string[]>>
  }
  // 班级
  class: {
    list: (q?: PageQuery) => Promise<Result<ClassInfo[]>>
    get: (id: ID) => Promise<Result<ClassInfo>>
    create: (input: ClassInput) => Promise<Result<ClassInfo>>
    update: (id: ID, input: Partial<ClassInput>) => Promise<Result<ClassInfo>>
    remove: (id: ID) => Promise<Result<void>>
    members: (classId: ID) => Promise<Result<Student[]>>
    addMembers: (classId: ID, studentIds: ID[]) => Promise<Result<void>>
    removeMember: (classId: ID, studentId: ID) => Promise<Result<void>>
  }
  // 课次
  lesson: {
    list: (q: { classId?: ID; from?: string; to?: string }) => Promise<Result<Lesson[]>>
    get: (id: ID) => Promise<Result<Lesson>>
    create: (input: LessonInput) => Promise<Result<Lesson>>
    update: (id: ID, input: Partial<LessonInput>) => Promise<Result<Lesson>>
    remove: (id: ID) => Promise<Result<void>>
    finish: (id: ID) => Promise<Result<Lesson>>
    setReflection: (id: ID, text: string | null) => Promise<Result<Lesson>>
    assess: (lessonId: ID) => Promise<Result<string>>
    records: (lessonId: ID) => Promise<Result<LessonRecord[]>>
    score: (action: ScoreAction) => Promise<Result<LessonRecord>>
    pick: (lessonId: ID) => Promise<Result<Student>>
  }
  // 点子库
  idea: {
    list: (q?: PageQuery) => Promise<Result<Idea[]>>
    get: (id: ID) => Promise<Result<Idea>>
    create: (input: IdeaInput) => Promise<Result<Idea>>
    update: (id: ID, input: Partial<IdeaInput>) => Promise<Result<Idea>>
    remove: (id: ID) => Promise<Result<void>>
    createVersion: (input: IdeaVersionInput) => Promise<Result<IdeaVersion>>
    updateVersion: (versionId: ID, input: Partial<Pick<IdeaVersionInput, 'versionName' | 'notes'>>) => Promise<Result<IdeaVersion>>
    removeVersion: (versionId: ID) => Promise<Result<void>>
    getVersionMeta: (versionId: ID) => Promise<Result<VersionMeta>>
  }
  // 教案
  lessonPlan: {
    list: (q?: {
      ideaId?: ID
      keyword?: string
      classId?: ID
      subject?: string
      knowledgePoint?: string
    }) => Promise<Result<LessonPlan[]>>
    get: (id: ID) => Promise<Result<LessonPlan>>
    getByVersion: (versionId: ID) => Promise<Result<LessonPlan | null>>
    upsert: (input: LessonPlanInput) => Promise<Result<LessonPlan>>
    remove: (id: ID) => Promise<Result<void>>
    clone: (sourcePlanId: ID, input: LessonPlanCloneInput) => Promise<Result<LessonPlan>>
    listResources: (planId: ID) => Promise<Result<PlanResource[]>>
    attachResource: (planId: ID, input: PlanResourceAttachInput) => Promise<Result<PlanResource>>
    detachResource: (planId: ID, resourceId: ID, section?: string) => Promise<Result<void>>
    generateDraft: (versionId: ID, durationMinutes?: number | null) => Promise<Result<string>>
    exportMarkdown: (id: ID) => Promise<Result<string | null>>
    exportPdf: (id: ID) => Promise<Result<string | null>>
    prepOverview: () => Promise<Result<PrepOverview>>
    readinessTrend: (days?: number) => Promise<Result<PrepReadinessSnapshot[]>>
    knowledgeCoverage: () => Promise<Result<KnowledgeCoverage>>
    knowledgeCoverageGaps: () => Promise<Result<KnowledgeCoverageGaps>>
    review: (planId: ID) => Promise<Result<string>>
  }
  // 教案模板（用户自定义）
  lessonPlanTemplate: {
    list: () => Promise<Result<LessonPlanTemplateRecord[]>>
    create: (input: LessonPlanTemplateRecordInput) => Promise<Result<LessonPlanTemplateRecord>>
    update: (id: ID, input: Partial<LessonPlanTemplateRecordInput>) => Promise<Result<LessonPlanTemplateRecord>>
    remove: (id: ID) => Promise<Result<void>>
  }
  // 待办
  todo: {
    list: () => Promise<Result<Todo[]>>
    create: (input: { title: string; type?: Todo['type']; refLessonId?: ID }) => Promise<Result<Todo>>
    update: (id: ID, input: Partial<Pick<Todo, 'title' | 'status'>>) => Promise<Result<Todo>>
    remove: (id: ID) => Promise<Result<void>>
    regenerate: () => Promise<Result<Todo[]>>
  }
  // 资源库
  resource: {
    list: (q?: { type?: string; classId?: ID; keyword?: string; tag?: string }) => Promise<Result<Resource[]>>
    create: (input: ResourceInput) => Promise<Result<Resource>>
    update: (id: ID, input: Partial<ResourceInput>) => Promise<Result<Resource>>
    remove: (id: ID) => Promise<Result<void>>
    importFile: (filePath: string, type: Resource['type']) => Promise<Result<Resource>>
    allTags: () => Promise<Result<string[]>>
    readFile: (filePath: string) => Promise<Result<string>>
  }
  // 反馈/报告
  feedback: {
    list: (q?: { classId?: ID; from?: string; to?: string }) => Promise<Result<Feedback[]>>
    get: (id: ID) => Promise<Result<Feedback>>
    save: (input: Partial<Feedback> & { classId: ID; periodStart: string; periodEnd: string }) => Promise<Result<Feedback>>
    remove: (id: ID) => Promise<Result<void>>
    generate: (lessonId: ID) => Promise<Result<Feedback>>
    generateReport: (q: { classId: ID; from: string; to: string }) => Promise<Result<{ html: string; pdfPath: string }>>
    exportPdf: (feedbackId: ID) => Promise<Result<string>>
    sendWeChat: (feedbackId: ID) => Promise<Result<{ ok: boolean; message: string }>>
  }
  // 反馈模板
  feedbackTemplate: {
    list: (q?: { category?: string }) => Promise<Result<FeedbackTemplate[]>>
    create: (input: FeedbackTemplateInput) => Promise<Result<FeedbackTemplate>>
    update: (id: ID, input: Partial<FeedbackTemplateInput>) => Promise<Result<FeedbackTemplate>>
    remove: (id: ID) => Promise<Result<void>>
  }
  // AI 课表导入
  schedule: {
    parseText: (text: string) => Promise<Result<ScheduleParseResult>>
    parseImage: (imagePath: string) => Promise<Result<ScheduleParseResult>>
    import: (result: ScheduleParseResult) => Promise<Result<{ classes: number; students: number; lessons: number }>>
  }
  // Scratch
  scratch: {
    launch: (versionId?: ID) => Promise<Result<void>>
    close: () => Promise<Result<void>>
    saveToIdea: (payload: ScratchSavePayload, target: ArchiveTarget) => Promise<Result<IdeaVersion>>
    saveToResource: (payload: ScratchSavePayload, type?: Resource['type']) => Promise<Result<Resource>>
    pickResourceFile: () => Promise<Result<Resource>>
  }
  // 设置
  settings: {
    get: () => Promise<Result<AppSettings>>
    saveAI: (s: AISettings) => Promise<Result<AISettings>>
    saveSync: (s: SyncSettings) => Promise<Result<SyncSettings>>
    saveWeChat: (s: WeChatSettings) => Promise<Result<WeChatSettings>>
    saveScratch: (s: ScratchSettings) => Promise<Result<ScratchSettings>>
    testAI: () => Promise<Result<{ ok: boolean; message: string }>>
    testSync: () => Promise<Result<{ ok: boolean; message: string }>>
    syncNow: () => Promise<Result<{ ok: boolean; message: string }>>
  }
  // 仪表盘
  dashboard: {
    get: () => Promise<Result<DashboardData>>
  }
  // 数据备份/导出/导入
  data: {
    export: () => Promise<Result<string>>
    importFromFile: (filePath: string) => Promise<Result<{ tables: number; rows: number }>>
    pickImportFile: () => Promise<Result<string | null>>
    saveExportToFile: (json: string) => Promise<Result<string>>
  }
  // 学生学习历史
  studentHistory: {
    get: (studentId: ID) => Promise<Result<StudentHistory>>
  }
  // 文档中心（语雀）
  doc: {
    openUrl: (url: string) => Promise<Result<void>>
    linkToLesson: (lessonId: ID, url: string, title: string) => Promise<Result<void>>
    listLinks: (lessonId: ID) => Promise<Result<Array<{ id: ID; url: string; title: string }>>>
    listAll: () => Promise<Result<DocLinkWithLesson[]>>
    removeLink: (id: ID) => Promise<Result<void>>
    listByPlan: (planId: ID) => Promise<Result<PlanDocLink[]>>
    linkToPlan: (planId: ID, url: string, title: string) => Promise<Result<PlanDocLink>>
  }
  // 文件
  file: {
    pickImage: () => Promise<Result<string>>
    saveAvatar: (srcPath: string, studentName: string) => Promise<Result<string>>
    readImageBase64: (path: string) => Promise<Result<string>>
  }
}

// 事件（主 -> 渲染）：每个属性是"注册监听"函数，返回取消订阅函数
export interface WorkbenchEvents {
  'scratch:save-request': (cb: (payload: ScratchSavePayload) => void) => () => void
  'feedback:chunk': (cb: (delta: string) => void) => () => void
  'lessonPlan:chunk': (cb: (delta: string) => void) => () => void
  'lessonPlan:reviewChunk': (cb: (delta: string) => void) => () => void
  'lesson:assessChunk': (cb: (delta: string) => void) => () => void
  'sync:status': (cb: (status: { running: boolean; message: string }) => void) => () => void
  'menu:action': (cb: (action: MenuAction) => void) => () => void
}
