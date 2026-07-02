import { db, uuid } from '../db'
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

/** 自动待办业务规格：以 (type, refLessonId) 为键 */
export interface AutoTodoSpec {
  type: 'prep' | 'feedback' | 'reflection'
  refLessonId: string
  title: string
  dueAt: string | null
}

function autoTodoKey(type: string, refLessonId: string | null | undefined): string {
  return `${type}:${refLessonId ?? ''}`
}

/**
 * 同步自动待办（备课/反馈/反思），以 (type, refLessonId) 为业务键做增量同步：
 * - 已存在：仅更新 title/dueAt，**保留用户设置的 status**（避免每次重新生成丢失进度）
 * - 不存在：新建（status='todo'）
 * - 条件已不再成立的旧自动待办（不在 desired 列表中）：清理删除
 * - 手动待办(type='manual')始终不受影响
 */
export function syncAutoTodos(desired: AutoTodoSpec[]): Todo[] {
  const tx = db().transaction(() => {
    const existing = (db()
      .prepare(`SELECT * FROM todos WHERE type IN ('prep','feedback','reflection')`)
      .all() as TodoRow[]).map(mapRow)
    const existingMap = new Map<string, Todo>()
    for (const t of existing) {
      existingMap.set(autoTodoKey(t.type, t.refLessonId), t)
    }
    const desiredKeys = new Set(desired.map((d) => autoTodoKey(d.type, d.refLessonId)))

    // 1. 清理条件已不成立的自动待办（如课次已完成备课/已发反馈）
    for (const [key, t] of existingMap) {
      if (!desiredKeys.has(key)) {
        db().prepare(`DELETE FROM todos WHERE id = ?`).run(t.id)
      }
    }

    // 2. upsert：保留 status，仅同步 title/dueAt
    for (const d of desired) {
      const key = autoTodoKey(d.type, d.refLessonId)
      const cur = existingMap.get(key)
      if (cur) {
        if (cur.title !== d.title || (cur.dueAt ?? null) !== (d.dueAt ?? null)) {
          db().prepare(`UPDATE todos SET title = ?, due_at = ? WHERE id = ?`).run(
            d.title,
            d.dueAt,
            cur.id
          )
        }
      } else {
        create({
          title: d.title,
          type: d.type,
          refLessonId: d.refLessonId,
          dueAt: d.dueAt ?? undefined
        })
      }
    }
  })
  tx()
  return list()
}
