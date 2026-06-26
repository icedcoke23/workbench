import { db, uuid } from '../db'
import type { Lesson } from '@shared/types'
import type { Todo } from '@shared/types'

interface TodoRow {
  id: string
  title: string
  type: string
  status: string
  ref_lesson_id: string | null
  ref_idea_id: string | null
  due_at: string | null
  created_at: string
}

function mapRow(r: TodoRow): Todo {
  return {
    id: r.id,
    title: r.title,
    type: r.type as Todo['type'],
    status: r.status as Todo['status'],
    refLessonId: r.ref_lesson_id,
    refIdeaId: r.ref_idea_id,
    dueAt: r.due_at,
    createdAt: r.created_at
  }
}

export function list(): Todo[] {
  return (db().prepare(`SELECT * FROM todos ORDER BY created_at DESC`).all() as TodoRow[]).map(mapRow)
}

export function create(input: {
  title: string
  type?: Todo['type']
  refLessonId?: string
  refIdeaId?: string
  dueAt?: string
}): Todo {
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO todos (id, title, type, status, ref_lesson_id, ref_idea_id, due_at)
       VALUES (?, ?, ?, 'todo', ?, ?, ?)`
    )
    .run(
      id,
      input.title,
      input.type ?? 'manual',
      input.refLessonId ?? null,
      input.refIdeaId ?? null,
      input.dueAt ?? null
    )
  return list().find((t) => t.id === id)!
}

export function update(id: string, input: Partial<Pick<Todo, 'title' | 'status'>>): Todo | null {
  const cur = list().find((t) => t.id === id)
  if (!cur) return null
  db()
    .prepare(`UPDATE todos SET title = ?, status = ? WHERE id = ?`)
    .run(input.title ?? cur.title, input.status ?? cur.status, id)
  return list().find((t) => t.id === id) ?? null
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM todos WHERE id = ?`).run(id)
}

export function removeByLesson(lessonId: string, type: Todo['type']): void {
  db().prepare(`DELETE FROM todos WHERE ref_lesson_id = ? AND type = ?`).run(lessonId, type)
}

/**
 * 根据规则自动生成待办：
 * - 备课待办：未来 24h 内课程未关联备课课件
 * - 反馈待办：已结束课程未发反馈（24h 有效期）
 */
export function regenerateAuto(upcoming: Lesson[], finished: Lesson[]): Todo[] {
  const tx = db().transaction(() => {
    // 清理旧的自动待办（保留手动）
    db().prepare(`DELETE FROM todos WHERE type IN ('prep','feedback')`).run()

    const in24h = Date.now() + 24 * 3_600_000
    for (const l of upcoming) {
      const startTs = new Date(l.startTime).getTime()
      if (startTs <= in24h && !l.ideaVersionId) {
        create({
          title: `备课待办：${l.className ?? '课程'} ${l.startTime}`,
          type: 'prep',
          refLessonId: l.id,
          dueAt: l.startTime
        })
      }
    }
    for (const l of finished) {
      if (!l.feedbackSent) {
        const due = new Date(new Date(l.endTime).getTime() + 24 * 3_600_000).toISOString()
        create({
          title: `反馈待办：${l.className ?? '课程'} ${l.startTime}`,
          type: 'feedback',
          refLessonId: l.id,
          dueAt: due
        })
      }
    }
  })
  tx()
  return list()
}
