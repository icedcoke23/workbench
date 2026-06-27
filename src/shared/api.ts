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
  LessonRecord,
  MenuAction,
  PageQuery,
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
  WeChatSettings,
  ScheduleParseResult,
  ScratchSettings
} from './types'

// 渲染进程可调用的全部 API 契约（preload 实现，主进程响应）
export interface WorkbenchAPI {
  // 学生
  student: {
    list: (q?: PageQuery) => Promise<Result<Student[]>>
    get: (id: ID) => Promise<Result<Student>>
    create: (input: StudentInput) => Promise<Result<Student>>
    update: (id: ID, input: Partial<StudentInput>) => Promise<Result<Student>>
    remove: (id: ID) => Promise<Result<void>>
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
    removeVersion: (versionId: ID) => Promise<Result<void>>
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
    saveToResource: (payload: ScratchSavePayload) => Promise<Result<Resource>>
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
  'sync:status': (cb: (status: { running: boolean; message: string }) => void) => () => void
  'menu:action': (cb: (action: MenuAction) => void) => () => void
}
