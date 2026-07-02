import { resolveAISettings, streamAI, sanitizeUserInput } from './ai'
import {
  buildLessonPlanDraftUserMessage,
  getLessonPlanSystemPrompt,
  buildLessonPlanReviewUserMessage,
  getLessonPlanReviewSystemPrompt,
  getAchievementAssessmentSystemPrompt,
  buildAchievementAssessmentUserMessage
} from '../lib/prompts'
import * as scratchService from './scratch'
import * as pdfService from './pdf'
import * as ideaRepo from '../database/repositories/ideas'
import * as lessonPlanRepo from '../database/repositories/lesson-plans'
import * as lessonRepo from '../database/repositories/lessons'
import * as docRepo from '../database/repositories/docs'
import { db } from '../database/db'
import { app, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import type {
  LessonPlan,
  PlanDocLink,
  PlanResource,
  PrepOverview,
  PrepOverviewLesson,
  PrepStage
} from '@shared/types'
import { computePlanReadiness } from '@shared/plan-readiness'

/**
 * AI 辅助生成教案草稿（流式，通过 onChunk 回调推送增量）。
 *
 * 基于关联的 Scratch 作品版本元信息（角色/脚本/造型/音效）+ 点子标题与描述，
 * 调用 AI 生成结构化 Markdown 教案草稿，返回完整文本。调用方可按二级标题
 * 切分后填入教案 5 个章节字段。
 *
 * @param versionId 关联的作品版本 ID
 * @param durationMinutes 预计课时（分钟），未传则由 AI 按 60 分钟设计
 * @param onChunk 流式增量回调
 */
export async function generateDraft(
  versionId: string,
  durationMinutes?: number | null,
  onChunk?: (delta: string) => void
): Promise<string> {
  const settings = resolveAISettings()
  if (!settings) throw new Error('AI 未配置，请在设置中配置第三方 AI 参数')

  const version = ideaRepo.getVersion(versionId)
  if (!version) throw new Error('作品版本不存在')

  const idea = ideaRepo.get(version.ideaId)
  const versionMeta = await scratchService.getVersionMeta(versionId)

  const userMessage = buildLessonPlanDraftUserMessage({
    ideaTitle: idea?.title,
    ideaDescription: idea?.description ?? undefined,
    versionName: version.versionName,
    versionMeta,
    durationMinutes: durationMinutes ?? undefined
  })

  const fullText = await streamAI(
    settings,
    [
      { role: 'system', content: getLessonPlanSystemPrompt() },
      { role: 'user', content: sanitizeUserInput(userMessage, 4000) }
    ],
    (delta) => onChunk?.(delta),
    0.7
  )

  return fullText
}

/**
 * AI 教案优化建议（流式，通过 onChunk 回调推送增量）。
 *
 * 读取指定教案的完整内容，连同点子标题、版本名、预计时长交给 AI，
 * 输出结构化点评与优化建议（总体评价 / 优点 / 优化建议 / 重点修订示范）。
 *
 * @param planId 教案 ID
 * @param onChunk 流式增量回调
 */
export async function reviewPlan(
  planId: string,
  onChunk?: (delta: string) => void
): Promise<string> {
  const settings = resolveAISettings()
  if (!settings) throw new Error('AI 未配置，请在设置中配置第三方 AI 参数')

  const plan = lessonPlanRepo.get(planId)
  if (!plan) throw new Error('教案不存在')

  const version = plan.ideaVersionId ? ideaRepo.getVersion(plan.ideaVersionId) : null
  const idea = version ? ideaRepo.get(version.ideaId) : null

  const userMessage = buildLessonPlanReviewUserMessage({
    ideaTitle: idea?.title,
    versionName: version?.versionName,
    durationMinutes: plan.durationMinutes,
    plan: {
      title: plan.title,
      objectives: plan.objectives,
      keyPoints: plan.keyPoints,
      preparation: plan.preparation,
      process: plan.process,
      reflection: plan.reflection
    }
  })

  const fullText = await streamAI(
    settings,
    [
      { role: 'system', content: getLessonPlanReviewSystemPrompt() },
      { role: 'user', content: sanitizeUserInput(userMessage, 6000) }
    ],
    (delta) => onChunk?.(delta),
    0.6
  )

  return fullText
}

/**
 * AI 教学目标达成度评估（流式，通过 onChunk 回调推送增量）。
 *
 * 汇聚指定课次的教案目标 + 课堂表现记录（积分/点名）+ 教师课后反思，
 * 调用 AI 逐条评估教学目标达成度并给出改进建议。生成完成后落库到
 * lessons.achievement_assessment，避免重复生成。
 *
 * @param lessonId 课次 ID
 * @param onChunk 流式增量回调
 */
export async function assessAchievement(
  lessonId: string,
  onChunk?: (delta: string) => void
): Promise<string> {
  const settings = resolveAISettings()
  if (!settings) throw new Error('AI 未配置，请在设置中配置第三方 AI 参数')

  const lesson = lessonRepo.get(lessonId)
  if (!lesson) throw new Error('课次不存在')
  if (lesson.status !== 'finished') {
    throw new Error('仅已结课的课次可进行达成度评估')
  }

  // 拉取关联教案（目标/重难点/过程）作为评估锚点
  let plan: LessonPlan | null = null
  if (lesson.ideaVersionId) {
    plan = lessonPlanRepo.getByVersion(lesson.ideaVersionId)
  }

  // 拉取课堂记录（积分/点名/参与备注）作为客观依据
  const records = lessonRepo.records(lessonId).map((r) => ({
    studentName: r.studentName ?? '未命名学生',
    scoreChange: r.scoreChange,
    isPicked: r.isPicked,
    note: r.participationNote ?? undefined
  }))

  const lessonTime = `${lesson.startTime.slice(0, 16).replace('T', ' ')} ~ ${lesson.endTime
    .slice(11, 16)
    .replace('T', ' ')}`

  const userMessage = buildAchievementAssessmentUserMessage({
    className: lesson.className,
    subject: lesson.subject,
    lessonTime,
    ideaTitle: lesson.ideaTitle,
    plan: plan
      ? {
          objectives: plan.objectives,
          keyPoints: plan.keyPoints,
          process: plan.process
        }
      : {},
    reflection: lesson.reflection,
    records
  })

  const fullText = await streamAI(
    settings,
    [
      { role: 'system', content: getAchievementAssessmentSystemPrompt() },
      { role: 'user', content: sanitizeUserInput(userMessage, 6000) }
    ],
    (delta) => onChunk?.(delta),
    0.5
  )

  // 落库：流式输出完成后持久化评估结果
  lessonRepo.setAchievementAssessment(lessonId, fullText)

  return fullText
}

/** 资源类型 → 中文标签（导出文档素材清单用） */
function resourceTypeLabel(t: string): string {
  if (t === 'backdrop') return '背景'
  if (t === 'sprite') return '角色'
  if (t === 'sound') return '音效'
  return '素材'
}

/** 将关联素材渲染为 Markdown 列表（追加到教学准备章节末尾） */
function renderResourcesMd(resources: PlanResource[]): string {
  if (!resources.length) return ''
  const lines = resources.map((pr) => {
    const type = pr.resource ? resourceTypeLabel(pr.resource.type) : '素材'
    const name = pr.resource?.name ?? '未知素材'
    const tags = pr.resource?.tags?.length ? `（标签: ${pr.resource.tags.join('、')}）` : ''
    return `- 【${type}】${name}${tags}`
  })
  return `\n\n### 关联素材清单\n\n${lines.join('\n')}\n`
}

/**
 * 将教案级关联文档渲染为 Markdown 列表（追加到教学准备章节末尾，素材清单之后）。
 * G18: 导出 Markdown/PDF 时包含外部文档（语雀/PPT/工作表等），便于跨课次复用。
 */
function renderDocsMd(docs: PlanDocLink[]): string {
  if (!docs.length) return ''
  const lines = docs.map((d) => {
    const title = d.title?.trim() || d.url
    return `- [${title}](${d.url})`
  })
  return `\n\n### 关联文档清单\n\n${lines.join('\n')}\n`
}

/** 将教案内容渲染为 Markdown 字符串 */
function buildLessonPlanMarkdown(
  plan: LessonPlan,
  resources?: PlanResource[],
  docs?: PlanDocLink[]
): string {
  const title = plan.title || (plan.versionName ? `${plan.versionName} 教案` : '未命名教案')
  const metaParts: string[] = []
  if (plan.ideaTitle) metaParts.push(`点子：${plan.ideaTitle}`)
  if (plan.versionName) metaParts.push(`版本：${plan.versionName}`)
  if (plan.durationMinutes) metaParts.push(`预计时长：${plan.durationMinutes} 分钟`)
  metaParts.push(`创建：${plan.createdAt}`)
  metaParts.push(`更新：${plan.updatedAt}`)

  const section = (heading: string, content: string | null | undefined): string => {
    return `## ${heading}\n\n${content && content.trim() ? content.trim() : '（未填写）'}\n`
  }

  // 教学准备章节末尾追加结构化素材清单（若有），其后追加教案级关联文档清单（G18）
  const prepContent =
    (plan.preparation ?? '') +
    (resources && resources.length ? renderResourcesMd(resources) : '') +
    (docs && docs.length ? renderDocsMd(docs) : '')

  return `# ${title}

> ${metaParts.join(' · ')}

${section('教学目标', plan.objectives)}
${section('教学重难点', plan.keyPoints)}
${section('教学准备', prepContent)}
${section('教学过程', plan.process)}
${section('课后反思', plan.reflection)}
`
}

/**
 * 将指定教案导出为 Markdown 文件，弹出保存对话框让用户选择位置。
 * @returns 保存路径；用户取消返回 null
 */
export async function exportMarkdown(planId: string): Promise<string | null> {
  const plan = lessonPlanRepo.get(planId)
  if (!plan) throw new Error('教案不存在')

  const resources = lessonPlanRepo.listResources(planId)
  const docs = docRepo.listByPlan(planId)
  const md = buildLessonPlanMarkdown(plan, resources, docs)
  const title = plan.title || (plan.versionName ? `${plan.versionName} 教案` : '未命名教案')
  // 文件名安全化：去除 Windows/Mac 不允许的字符
  const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
  const fileName = `${safeName}.md`

  const res = await dialog.showSaveDialog({
    title: '导出教案为 Markdown',
    defaultPath: join(app.getPath('documents'), fileName),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (res.canceled || !res.filePath) return null
  writeFileSync(res.filePath, md, 'utf8')
  return res.filePath
}

/**
 * 将教案 Markdown 子集（# / ## / ### 标题、- 列表、**粗体**、> 引用、`[text](url)` 链接、空行分段）
 * 转换为 HTML 片段。转义优先，避免注入。
 */
function renderMdSubsetToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // 将 Markdown 链接 [text](url) 转为 <a> 标签（G18：关联文档清单需要可点击链接）
  const convertLinks = (s: string): string =>
    s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
      const safeUrl = url.replace(/"/g, '&quot;')
      return `<a href="${safeUrl}">${label}</a>`
    })
  // 按空行切分为块，逐块转换
  const blocks = escaped.split(/\n{2,}/)
  const htmlBlocks: string[] = []
  let listBuf: string[] = []
  const flushList = (): void => {
    if (listBuf.length > 0) {
      htmlBlocks.push(`<ul>${listBuf.join('')}</ul>`)
      listBuf = []
    }
  }
  for (const raw of blocks) {
    const block = raw.trim()
    if (block === '') continue
    // 引用块
    if (block.startsWith('&gt;')) {
      flushList()
      const inner = block.replace(/^&gt;\s?/gm, '').replace(/\n/g, '<br>')
      htmlBlocks.push(`<blockquote>${inner}</blockquote>`)
      continue
    }
    // 标题
    const h3 = block.match(/^###\s+(.+)$/)
    if (h3 && !block.includes('\n')) {
      flushList()
      htmlBlocks.push(`<h3>${h3[1]}</h3>`)
      continue
    }
    const h2 = block.match(/^##\s+(.+)$/)
    if (h2 && !block.includes('\n')) {
      flushList()
      htmlBlocks.push(`<h2>${h2[1]}</h2>`)
      continue
    }
    const h1 = block.match(/^#\s+(.+)$/)
    if (h1 && !block.includes('\n')) {
      flushList()
      htmlBlocks.push(`<h1>${h1[1]}</h1>`)
      continue
    }
    // 列表块（可能多行 - 项）
    if (/^- /.test(block)) {
      const items = block
        .split('\n')
        .filter((l) => l.startsWith('- '))
        .map((l) => `<li>${convertLinks(l.slice(2))}</li>`)
      listBuf.push(...items)
      continue
    }
    // 普通段落
    flushList()
    const para = convertLinks(block)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
    htmlBlocks.push(`<p>${para}</p>`)
  }
  flushList()
  return htmlBlocks.join('\n')
}

/** 将教案渲染为带样式的完整 HTML，供 printToPDF 使用 */
function buildLessonPlanHtml(
  plan: LessonPlan,
  resources?: PlanResource[],
  docs?: PlanDocLink[]
): string {
  const title = plan.title || (plan.versionName ? `${plan.versionName} 教案` : '未命名教案')
  const metaParts: string[] = []
  if (plan.ideaTitle) metaParts.push(`点子：${plan.ideaTitle}`)
  if (plan.versionName) metaParts.push(`版本：${plan.versionName}`)
  if (plan.durationMinutes) metaParts.push(`预计时长：${plan.durationMinutes} 分钟`)
  metaParts.push(`创建：${plan.createdAt.slice(0, 16).replace('T', ' ')}`)
  metaParts.push(`更新：${plan.updatedAt.slice(0, 16).replace('T', ' ')}`)

  const section = (heading: string, content: string | null | undefined): string => {
    const body = content && content.trim() ? renderMdSubsetToHtml(content.trim()) : '<p class="empty">（未填写）</p>'
    return `<h2>${heading}</h2>\n${body}`
  }

  // 教学准备章节末尾追加结构化素材清单（若有），其后追加教案级关联文档清单（G18）
  const prepContent =
    (plan.preparation ?? '') +
    (resources && resources.length ? renderResourcesMd(resources) : '') +
    (docs && docs.length ? renderDocsMd(docs) : '')

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Microsoft YaHei","PingFang SC","Helvetica Neue",sans-serif; color:#222; line-height:1.8; font-size:14px; }
    h1 { color:#4f46e5; font-size:24px; text-align:center; margin:0 0 8px; }
    .meta { text-align:center; color:#6b7280; font-size:12px; margin-bottom:24px; }
    h2 { color:#4f46e5; font-size:17px; border-left:5px solid #4f46e5; padding-left:10px; margin-top:22px; }
    h3 { color:#374151; font-size:15px; margin:14px 0 4px; }
    p { margin:6px 0; }
    ul { margin:6px 0; padding-left:22px; }
    li { margin:3px 0; }
    a { color:#4f46e5; text-decoration:none; word-break:break-all; }
    blockquote { margin:8px 0; padding:8px 12px; background:#f6f8fa; border-left:3px solid #d1d5db; color:#4b5563; }
    .empty { color:#9ca3af; font-style:italic; }
    strong { color:#111827; }
  </style></head><body>
    <h1>${title}</h1>
    <div class="meta">${metaParts.join(' · ')}</div>
    ${section('教学目标', plan.objectives)}
    ${section('教学重难点', plan.keyPoints)}
    ${section('教学准备', prepContent)}
    ${section('教学过程', plan.process)}
    ${section('课后反思', plan.reflection)}
  </body></html>`
}

/**
 * 将指定教案导出为 PDF 文件，弹出保存对话框让用户选择位置。
 * @returns 保存路径；用户取消返回 null
 */
export async function exportPdf(planId: string): Promise<string | null> {
  const plan = lessonPlanRepo.get(planId)
  if (!plan) throw new Error('教案不存在')

  const title = plan.title || (plan.versionName ? `${plan.versionName} 教案` : '未命名教案')
  const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
  const fileName = `${safeName}.pdf`

  const res = await dialog.showSaveDialog({
    title: '导出教案为 PDF',
    defaultPath: join(app.getPath('documents'), fileName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (res.canceled || !res.filePath) return null

  const html = buildLessonPlanHtml(plan, lessonPlanRepo.listResources(planId), docRepo.listByPlan(planId))
  const outDir = join(app.getPath('userData'), 'exports')
  const tmpPdf = await pdfService.renderHtmlToPdf(html, outDir, `教案-${safeName}`)
  // renderHtmlToPdf 自带时间戳后缀；复制到用户选择的目标路径
  const { copyFile } = await import('fs/promises')
  await copyFile(tmpPdf, res.filePath)
  return res.filePath
}

/** 近期未备课课次的时间窗口（天） */
const PREP_OVERVIEW_DAYS = 7

/**
 * 构建备课进度看板数据：
 * - 聚合统计全部版本数、已编写教案数、关键章节齐全数（粗粒度，向后兼容）
 * - G16: 拉取全部教案 + 各教案关联素材数，用共享 computePlanReadiness 计算就绪等级，
 *   聚合为 draft/partial/ready 三档分布，与编辑器/卡片/授课侧的就绪定义完全一致
 * - 列出近期（默认 7 天）待上课且备课未就绪的课次，按开始时间升序
 *
 * 课次的 prepStage 已由 lessons repo 的 SQL JOIN 派生，此处直接读取，
 * 无需逐课次查询教案，避免 N+1。就绪等级在主进程 TS 计算（个人工作台数据量小，
 * 无需下沉 SQL），保证规则单一来源。
 */
export function buildPrepOverview(): PrepOverview {
  const row = db()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM idea_versions) AS total_versions,
         (SELECT COUNT(*) FROM lesson_plans) AS versions_with_plan,
         (SELECT COUNT(*) FROM lesson_plans
          WHERE objectives IS NOT NULL AND objectives != ''
            AND process IS NOT NULL AND process != '') AS versions_complete`
    )
    .get() as { total_versions: number; versions_with_plan: number; versions_complete: number }

  const totalVersions = row.total_versions || 0
  const versionsWithPlan = row.versions_with_plan || 0
  const versionsWithCompletePlan = row.versions_complete || 0

  // G16: 拉取全部教案 + 关联素材数，按就绪等级聚合
  const plans = db()
    .prepare(
      `SELECT lp.objectives, lp.key_points, lp.preparation, lp.process, lp.duration_minutes,
              (SELECT COUNT(*) FROM plan_resources WHERE plan_id = lp.id) AS resource_count
       FROM lesson_plans lp`
    )
    .all() as Array<{
    objectives: string | null
    key_points: string | null
    preparation: string | null
    process: string | null
    duration_minutes: number | null
    resource_count: number
  }>

  // 无教案的版本直接归入 draft；有教案的按 computePlanReadiness 定级
  let draft = totalVersions - versionsWithPlan
  let partial = 0
  let ready = 0
  for (const p of plans) {
    const r = computePlanReadiness({
      objectives: p.objectives,
      keyPoints: p.key_points,
      preparation: p.preparation,
      process: p.process,
      durationMinutes: p.duration_minutes,
      resourceCount: p.resource_count
    })
    if (r.level === 'ready') ready++
    else if (r.level === 'partial') partial++
    else draft++
  }
  const readinessPct = totalVersions === 0 ? 0 : Math.round((ready / totalVersions) * 100)

  const now = new Date()
  const horizon = new Date(now.getTime() + PREP_OVERVIEW_DAYS * 24 * 3_600_000)
  const upcoming = lessonRepo.list({
    from: now.toISOString(),
    to: horizon.toISOString()
  })

  const upcomingUnprepared: PrepOverviewLesson[] = upcoming
    .filter((l) => l.status === 'pending' && l.prepStage && l.prepStage !== 'ready')
    .map((l) => ({
      lessonId: l.id,
      startTime: l.startTime,
      endTime: l.endTime,
      className: l.className,
      subject: l.subject,
      ideaTitle: l.ideaTitle,
      ideaVersionId: l.ideaVersionId,
      prepStage: l.prepStage as PrepStage
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  return {
    totalVersions,
    versionsWithPlan,
    versionsWithCompletePlan,
    readinessPct,
    readinessBreakdown: { draft, partial, ready },
    upcomingUnprepared
  }
}
