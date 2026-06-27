import { db, uuid, now, parseJSON } from '../db'
import type { FeedbackTemplate, FeedbackTemplateInput, FeedbackTemplateCategory } from '@shared/types'

interface FeedbackTemplateRow {
  id: string
  name: string
  category: string
  content: string
  is_builtin: number
  sort_order: number | null
  created_at: string
  updated_at: string
}

// 字段映射：is_builtin -> isBuiltin, sort_order -> sortOrder, created_at -> createdAt, updated_at -> updatedAt
function mapRow(r: FeedbackTemplateRow): FeedbackTemplate {
  return {
    id: r.id,
    name: r.name,
    category: r.category as FeedbackTemplateCategory,
    content: r.content,
    isBuiltin: r.is_builtin === 1,
    sortOrder: r.sort_order ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

/** 列出反馈模板，可选按分类过滤 */
export function list(q?: { category?: string }): FeedbackTemplate[] {
  let sql = `SELECT * FROM feedback_templates WHERE 1=1`
  const params: unknown[] = []
  if (q?.category) {
    sql += ` AND category = ?`
    params.push(q.category)
  }
  sql += ` ORDER BY sort_order ASC, created_at ASC`
  return (db().prepare(sql).all(...params) as FeedbackTemplateRow[]).map(mapRow)
}

/** 根据 id 获取单个模板 */
export function get(id: string): FeedbackTemplate | null {
  const row = db().prepare(`SELECT * FROM feedback_templates WHERE id = ?`).get(id) as
    | FeedbackTemplateRow
    | undefined
  return row ? mapRow(row) : null
}

/** 创建模板：自动设置 is_builtin=0 及时间戳 */
export function create(input: FeedbackTemplateInput): FeedbackTemplate {
  const id = uuid()
  const ts = now()
  db()
    .prepare(
      `INSERT INTO feedback_templates (id, name, category, content, is_builtin, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.category ?? 'custom',
      input.content,
      input.sortOrder ?? 0,
      ts,
      ts
    )
  return get(id)!
}

/** 更新模板：内置模板禁止修改 */
export function update(id: string, input: Partial<FeedbackTemplateInput>): FeedbackTemplate | null {
  const cur = get(id)
  if (!cur) return null
  if (cur.isBuiltin) {
    throw new Error('内置模板不可修改')
  }
  const ts = now()
  db()
    .prepare(
      `UPDATE feedback_templates SET name = ?, category = ?, content = ?, sort_order = ?, updated_at = ? WHERE id = ?`
    )
    .run(
      input.name ?? cur.name,
      input.category ?? cur.category,
      input.content ?? cur.content,
      input.sortOrder ?? cur.sortOrder ?? 0,
      ts,
      id
    )
  return get(id)
}

/** 删除模板：内置模板禁止删除 */
export function remove(id: string): void {
  const cur = get(id)
  if (!cur) return
  if (cur.isBuiltin) {
    throw new Error('内置模板不可删除')
  }
  db().prepare(`DELETE FROM feedback_templates WHERE id = ?`).run(id)
}

/** 内置模板定义 */
const BUILTIN_TEMPLATES: Array<{
  id: string
  name: string
  category: FeedbackTemplateCategory
  content: string
  sortOrder: number
}> = [
  {
    id: 'builtin-general',
    name: '通用周反馈',
    category: 'general',
    sortOrder: 0,
    content:
      '尊敬的家长您好，{student_name} 同学在 {className} 本周（{week}）的课程中表现认真。本次课程围绕 {topic} 展开，孩子积极完成课堂任务，理解到位、操作熟练。课堂上能主动思考并提出问题，与同学配合默契，作品完成度较高。希望下周继续保持学习热情，按时完成课后小练习，进一步巩固所学知识。感谢您的支持与配合！'
  },
  {
    id: 'builtin-praise',
    name: '表扬鼓励型',
    category: 'praise',
    sortOrder: 1,
    content:
      '家长您好！本周特别想跟您分享 {student_name} 同学的精彩表现。{highlight} 孩子不仅完成了既定任务，还能主动帮助同伴解决难题，展现了出色的逻辑思维与动手能力。看到孩子脸上洋溢的成就感，老师由衷感到骄傲。期待孩子在后续课程中保持这份热情，继续突破自我，创作出更多优秀的作品，加油！'
  },
  {
    id: 'builtin-suggestion',
    name: '改进建议型',
    category: 'suggestion',
    sortOrder: 2,
    content:
      '家长您好，{student_name} 同学本周课堂整体表现不错，但在 {area} 方面仍有提升空间。建议 {suggestion}。老师会在后续课程中多加引导，也希望家长能在家中给予鼓励与陪伴。学习是一个循序渐进的过程，相信通过持续练习，孩子一定能稳步进步，取得更好的成绩。如有疑问欢迎随时沟通。'
  },
  {
    id: 'builtin-progress',
    name: '阶段进度报告',
    category: 'progress',
    sortOrder: 3,
    content:
      '家长您好，以下是 {student_name} 同学在 {period} 阶段的学习总结。本阶段学习已取得显著进步：{progress}。孩子逐步掌握了 Scratch 编程的核心概念，能够独立完成小型项目，逻辑思维和创造力均有明显提升。下一阶段目标为 {next_goal}，将重点训练算法思维与项目优化能力。感谢您一直以来的支持与信任！'
  }
]

/** 播种内置模板：仅当表为空时插入 4 个内置模板 */
export function seedBuiltinTemplates(): void {
  const count = (db().prepare(`SELECT COUNT(*) as c FROM feedback_templates`).get() as { c: number }).c
  if (count > 0) return
  const ts = now()
  const stmt = db().prepare(
    `INSERT INTO feedback_templates (id, name, category, content, is_builtin, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
  )
  const tx = db().transaction((items: typeof BUILTIN_TEMPLATES) => {
    for (const t of items) {
      stmt.run(t.id, t.name, t.category, t.content, t.sortOrder, ts, ts)
    }
  })
  tx(BUILTIN_TEMPLATES)
}

// parseJSON 在本文件中保留导入以便后续扩展（如将 content 中的结构化占位符配置解析为 JSON）
void parseJSON
