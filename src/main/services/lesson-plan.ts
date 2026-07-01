import { resolveAISettings, streamAI, sanitizeUserInput } from './ai'
import { buildLessonPlanDraftUserMessage, getLessonPlanSystemPrompt } from '../lib/prompts'
import * as scratchService from './scratch'
import * as ideaRepo from '../database/repositories/ideas'

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
