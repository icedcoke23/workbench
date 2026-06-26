import { resolveAISettings, streamAI, sanitizeUserInput } from './ai'
import { buildWeeklyFeedbackUserMessage } from '../lib/prompts'
import * as lessonRepo from '../database/repositories/lessons'
import * as classRepo from '../database/repositories/classes'
import * as feedbackRepo from '../database/repositories/feedbacks'
import type { Feedback } from '@shared/types'

/** 生成单节课周反馈（流式，通过 onChunk 回调推送增量） */
export async function generateWeekly(
  lessonId: string,
  onChunk?: (delta: string) => void
): Promise<Feedback> {
  const settings = resolveAISettings()
  if (!settings) throw new Error('AI 未配置，请在设置中配置第三方 AI 参数')

  const lesson = lessonRepo.get(lessonId)
  if (!lesson) throw new Error('课次不存在')
  const cls = classRepo.get(lesson.classId)
  const records = lessonRepo.records(lessonId)

  const userMessage = buildWeeklyFeedbackUserMessage({
    className: cls?.name ?? '',
    lessonTime: lesson.startTime,
    subject: lesson.subject ?? 'Scratch',
    ideaTitle: lesson.ideaTitle ?? undefined,
    records: records.map((r) => ({
      studentName: r.studentName ?? '',
      scoreChange: r.scoreChange,
      isPicked: r.isPicked,
      note: r.participationNote ?? undefined
    }))
  })

  const fullText = await streamAI(
    settings,
    [
      { role: 'system', content: settings.systemPrompt },
      { role: 'user', content: sanitizeUserInput(userMessage, 4000) }
    ],
    (delta) => onChunk?.(delta),
    0.7
  )

  const periodStart = lesson.startTime
  const periodEnd = lesson.endTime
  const fb = feedbackRepo.save({
    lessonId,
    classId: lesson.classId,
    periodStart,
    periodEnd,
    content: fullText,
    aiReport: fullText,
    status: 'draft'
  })
  return fb
}

/** 季度报告：聚合班级一段时间数据，生成 HTML 供 PDF 渲染 */
export function buildReportHtml(params: {
  className: string
  from: string
  to: string
  students: Array<{ name: string; avatar?: string | null; totalScore: number; pickedCount: number; lessonCount: number }>
  lessonCount: number
}): string {
  const { className, from, to, students, lessonCount } = params
  const rows = students
    .map(
      (s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${s.lessonCount}</td>
        <td>${s.pickedCount}</td>
        <td><strong>${s.totalScore}</strong></td>
      </tr>`
    )
    .join('')

  const topStudents = [...students].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3)

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; color: #222; }
  .cover { text-align: center; padding: 60px 0; page-break-after: always; }
  .cover h1 { font-size: 34px; color: #4f46e5; margin-bottom: 12px; }
  .cover .sub { font-size: 18px; color: #666; margin: 8px 0; }
  h2 { color: #4f46e5; border-left: 5px solid #4f46e5; padding-left: 10px; margin-top: 28px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: center; }
  th { background: #f3f4f6; }
  .stat { display: flex; gap: 24px; margin: 16px 0; }
  .stat .card { flex: 1; background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; }
  .stat .num { font-size: 28px; font-weight: bold; color: #4f46e5; }
  .stat .label { font-size: 13px; color: #888; }
  .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; }
</style></head><body>
  <div class="cover">
    <h1>季度学习报告</h1>
    <div class="sub">班级：${escapeHtml(className)}</div>
    <div class="sub">统计周期：${from.slice(0, 10)} ~ ${to.slice(0, 10)}</div>
    <div class="sub">生成时间：${new Date().toLocaleString('zh-CN')}</div>
  </div>
  <h2>本期概览</h2>
  <div class="stat">
    <div class="card"><div class="num">${students.length}</div><div class="label">学员人数</div></div>
    <div class="card"><div class="num">${lessonCount}</div><div class="label">课时数</div></div>
    <div class="card"><div class="num">${topStudents[0]?.totalScore ?? 0}</div><div class="label">最高积分</div></div>
  </div>
  <h2>学员表现明细</h2>
  <table>
    <thead><tr><th>排名</th><th>姓名</th><th>课时</th><th>点名次数</th><th>累计积分</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">暂无数据</td></tr>'}</tbody>
  </table>
  <h2>本期之星</h2>
  <p>${topStudents.map((s) => escapeHtml(s.name)).join('、') || '暂无'}</p>
  <div class="footer">本报告由 Scratch 教学工作台 自动生成</div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
