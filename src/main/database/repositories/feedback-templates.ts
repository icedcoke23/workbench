import { db, uuid } from '../db'
import type { FeedbackTemplate, FeedbackTemplateInput } from '@shared/types'

interface TemplateRow {
  id: string
  name: string
  category: string
  content: string
  is_builtin: number
  sort_order: number
  created_at: string
  updated_at: string
}

function mapRow(r: TemplateRow): FeedbackTemplate {
  return {
    id: r.id,
    name: r.name,
    category: r.category as FeedbackTemplate['category'],
    content: r.content,
    isBuiltin: r.is_builtin === 1,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function list(q?: { category?: string }): FeedbackTemplate[] {
  let sql = `SELECT * FROM feedback_templates WHERE 1=1`
  const params: unknown[] = []
  if (q?.category) {
    sql += ` AND category = ?`
    params.push(q.category)
  }
  sql += ` ORDER BY sort_order ASC, created_at ASC`
  return (db().prepare(sql).all(...params) as TemplateRow[]).map(mapRow)
}

export function get(id: string): FeedbackTemplate | null {
  const row = db().prepare(`SELECT * FROM feedback_templates WHERE id = ?`).get(id) as
    | TemplateRow
    | undefined
  return row ? mapRow(row) : null
}

export function create(input: FeedbackTemplateInput): FeedbackTemplate {
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO feedback_templates (id, name, category, content, is_builtin, sort_order)
       VALUES (?, ?, ?, ?, 0, ?)`
    )
    .run(
      id,
      input.name,
      input.category ?? 'custom',
      input.content,
      input.sortOrder ?? 0
    )
  return get(id)!
}

export function update(id: string, input: Partial<FeedbackTemplateInput>): FeedbackTemplate | null {
  const cur = get(id)
  if (!cur) return null
  if (cur.isBuiltin) throw new Error('内置模板不可修改')
  db()
    .prepare(
      `UPDATE feedback_templates SET name = ?, category = ?, content = ?, sort_order = ? WHERE id = ?`
    )
    .run(
      input.name ?? cur.name,
      input.category ?? cur.category,
      input.content ?? cur.content,
      input.sortOrder ?? cur.sortOrder ?? 0,
      id
    )
  return get(id)!
}

export function remove(id: string): void {
  const cur = get(id)
  if (cur?.isBuiltin) throw new Error('内置模板不可删除')
  db().prepare(`DELETE FROM feedback_templates WHERE id = ?`).run(id)
}

/** 插入内置模板（仅在表为空时调用） */
export function seedBuiltinTemplates(): void {
  const count = db().prepare(`SELECT COUNT(*) as n FROM feedback_templates`).get() as { n: number }
  if (count.n > 0) return

  const builtins: Array<{ name: string; category: string; content: string }> = [
    {
      name: '通用周反馈',
      category: 'general',
      content: `本周课堂总结：

【课堂表现】
{className} 的同学们本周学习了 {topic}。整体课堂氛围 {atmosphere}，多数同学能跟上节奏并完成课堂任务。

【知识点掌握】
{knowledge_points}

【下节课建议】
{suggestion}

感谢家长们的配合与支持！`
    },
    {
      name: '表扬鼓励型',
      category: 'praise',
      content: `本周表扬：

{student_name} 同学本周表现非常棒！
- 课堂专注度：{focus}
- 任务完成度：{completion}
- 团队协作：{teamwork}

特别表扬：{highlight}

继续保持，期待下节课的精彩表现！`
    },
    {
      name: '改进建议型',
      category: 'suggestion',
      content: `本周学习情况与建议：

【当前进度】
{progress}

【需要加强的方面】
{weakness}

【家庭练习建议】
{homework}

如有疑问欢迎随时沟通，我们一起帮助孩子进步！`
    },
    {
      name: '阶段进度报告',
      category: 'progress',
      content: `阶段学习报告（{period}）

【本期内容】
{topics}

【掌握情况】
{mastery}

【积分与点名】
累计积分：{total_score}
点名次数：{picked_count}

【下阶段计划】
{next_plan}`
    }
  ]

  const stmt = db().prepare(
    `INSERT INTO feedback_templates (id, name, category, content, is_builtin, sort_order)
     VALUES (?, ?, ?, ?, 1, ?)`
  )
  builtins.forEach((b, i) => {
    stmt.run(uuid(), b.name, b.category, b.content, i)
  })
}
