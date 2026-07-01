import { resolveAISettings, streamAI, sanitizeUserInput } from './ai'
import { buildLessonPlanDraftUserMessage, getLessonPlanSystemPrompt } from '../lib/prompts'
import * as scratchService from './scratch'
import * as ideaRepo from '../database/repositories/ideas'
import * as lessonPlanRepo from '../database/repositories/lesson-plans'
import { app, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import type { LessonPlan } from '@shared/types'

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

/** 将教案内容渲染为 Markdown 字符串 */
function buildLessonPlanMarkdown(plan: LessonPlan): string {
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

  return `# ${title}

> ${metaParts.join(' · ')}

${section('教学目标', plan.objectives)}
${section('教学重难点', plan.keyPoints)}
${section('教学准备', plan.preparation)}
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

  const md = buildLessonPlanMarkdown(plan)
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
