import { db, uuid, parseJSON } from '../db'
import type {
  LessonPlan,
  LessonPlanCloneInput,
  LessonPlanInput,
  PlanResource,
  PlanResourceAttachInput,
  Resource,
  ResourceType
} from '@shared/types'
import * as ideaRepo from './ideas'

interface LessonPlanRow {
  id: string
  idea_version_id: string
  title: string | null
  objectives: string | null
  key_points: string | null
  preparation: string | null
  process: string | null
  reflection: string | null
  duration_minutes: number | null
  parent_plan_id: string | null
  created_at: string
  updated_at: string
}

interface JoinedRow extends LessonPlanRow {
  version_name: string | null
  idea_title: string | null
  idea_id: string | null
  lesson_count?: number
  used_classes?: string | null
  used_subjects?: string | null
  parent_plan_title?: string | null
  derived_count?: number
}

function mapRow(r: JoinedRow): LessonPlan {
  return {
    id: r.id,
    ideaVersionId: r.idea_version_id,
    versionName: r.version_name ?? undefined,
    ideaTitle: r.idea_title,
    ideaId: r.idea_id ?? undefined,
    title: r.title,
    objectives: r.objectives,
    keyPoints: r.key_points,
    preparation: r.preparation,
    process: r.process,
    reflection: r.reflection,
    durationMinutes: r.duration_minutes,
    parentPlanId: r.parent_plan_id,
    parentPlanTitle: r.parent_plan_title ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lessonCount: r.lesson_count ?? 0,
    usedClasses: r.used_classes ? r.used_classes.split('\n').filter(Boolean) : [],
    usedSubjects: r.used_subjects ? r.used_subjects.split('\n').filter(Boolean) : [],
    derivedCount: r.derived_count ?? 0
  }
}

/**
 * 列出全部教案，支持多维度过滤与聚合：
 * - ideaId：按点子过滤
 * - keyword：全文搜索（标题/目标/重难点/过程/反思/版本名/点子标题）
 * - classId：按使用班级过滤（JOIN lessons，仅返回该班级用过的教案）
 * - subject：按科目过滤（JOIN lessons.subject）
 * 同时聚合 lesson_count / used_classes / used_subjects，供前端展示使用情况。
 */
export function list(q?: {
  ideaId?: string
  keyword?: string
  classId?: string
  subject?: string
}): LessonPlan[] {
  let sql = `SELECT lp.*, iv.version_name, i.title AS idea_title, i.id AS idea_id,
               (SELECT COUNT(*) FROM lessons l WHERE l.idea_version_id = lp.idea_version_id) AS lesson_count,
               (SELECT GROUP_CONCAT(DISTINCT c.name, char(10)) FROM lessons l
                JOIN classes c ON c.id = l.class_id
                WHERE l.idea_version_id = lp.idea_version_id) AS used_classes,
               (SELECT GROUP_CONCAT(DISTINCT l.subject, char(10)) FROM lessons l
                WHERE l.idea_version_id = lp.idea_version_id AND l.subject IS NOT NULL) AS used_subjects,
               (SELECT COUNT(*) FROM lesson_plans child WHERE child.parent_plan_id = lp.id) AS derived_count,
               pp.title AS parent_plan_title
             FROM lesson_plans lp
             JOIN idea_versions iv ON iv.id = lp.idea_version_id
             JOIN ideas i ON i.id = iv.idea_id
             LEFT JOIN lesson_plans pp ON pp.id = lp.parent_plan_id`
  const where: string[] = []
  const params: unknown[] = []
  if (q?.ideaId) {
    where.push(`iv.idea_id = ?`)
    params.push(q.ideaId)
  }
  if (q?.keyword && q.keyword.trim()) {
    where.push(`(
      lp.title LIKE ? OR
      lp.objectives LIKE ? OR
      lp.key_points LIKE ? OR
      lp.preparation LIKE ? OR
      lp.process LIKE ? OR
      lp.reflection LIKE ? OR
      iv.version_name LIKE ? OR
      i.title LIKE ?
    )`)
    const kw = `%${q.keyword.trim()}%`
    params.push(kw, kw, kw, kw, kw, kw, kw, kw)
  }
  // 按班级过滤：仅返回该班级课次关联版本上有教案的记录
  if (q?.classId) {
    where.push(`EXISTS (SELECT 1 FROM lessons l WHERE l.idea_version_id = lp.idea_version_id AND l.class_id = ?)`)
    params.push(q.classId)
  }
  // 按科目过滤：仅返回该科目课次关联版本上有教案的记录
  if (q?.subject && q.subject.trim()) {
    where.push(`EXISTS (SELECT 1 FROM lessons l WHERE l.idea_version_id = lp.idea_version_id AND l.subject = ?)`)
    params.push(q.subject.trim())
  }
  if (where.length > 0) sql += ` WHERE ` + where.join(' AND ')
  sql += ` ORDER BY lp.updated_at DESC`
  return (db().prepare(sql).all(...params) as JoinedRow[]).map(mapRow)
}

/**
 * 一键克隆教案：将源教案内容复制到新版本（反思不复制，属于课后内容）。
 * - 若指定 ideaId，在其下创建新版本；否则新建一个点子承载克隆版本
 * - 新版本自动创建空作品文件路径（null），教师可后续上传
 * - 新教案标题默认沿用源标题加「（副本）」后缀
 * 返回克隆后的新教案。
 */
export function clonePlan(sourcePlanId: string, input: LessonPlanCloneInput): LessonPlan {
  const source = get(sourcePlanId)
  if (!source) throw new Error('源教案不存在')

  // 确定目标点子：复用现有或新建
  let ideaId = input.ideaId
  if (!ideaId) {
    const ideaTitle = input.ideaTitle?.trim() || source.ideaTitle || `${source.title || '克隆教案'} 点子`
    const idea = ideaRepo.create({ title: ideaTitle })
    ideaId = idea.id
  }

  // 创建新版本
  const version = ideaRepo.createVersion({
    ideaId,
    versionName: input.versionName.trim() || '克隆版本'
  })

  // 复制教案内容（反思清空）
  const newTitle =
    input.title !== undefined
      ? input.title
      : source.title
        ? `${source.title}（副本）`
        : null

  const cloned = upsert({
    ideaVersionId: version.id,
    title: newTitle,
    objectives: source.objectives,
    keyPoints: source.keyPoints,
    preparation: source.preparation,
    process: source.process,
    reflection: null,
    durationMinutes: source.durationMinutes
  })

  // 记录克隆血统：parent_plan_id 指向源教案，便于追溯派生关系
  db().prepare(`UPDATE lesson_plans SET parent_plan_id = ? WHERE id = ?`).run(sourcePlanId, cloned.id)

  // 一并复制结构化素材关联：派生教案通常需要相同的素材
  const sourceResources = listResources(sourcePlanId)
  for (const pr of sourceResources) {
    db()
      .prepare(
        `INSERT OR IGNORE INTO plan_resources (id, plan_id, resource_id, section, sort_order, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(uuid(), cloned.id, pr.resourceId, pr.section, pr.sortOrder, pr.note)
  }

  // 一并复制教案级文档挂载（G17）：派生教案复用源教案的外部文档/URL
  const sourceDocs = db()
    .prepare(`SELECT url, title FROM doc_links WHERE plan_id = ?`)
    .all(sourcePlanId) as Array<{ url: string; title: string | null }>
  for (const d of sourceDocs) {
    db()
      .prepare(`INSERT INTO doc_links (id, plan_id, url, title) VALUES (?, ?, ?, ?)`)
      .run(uuid(), cloned.id, d.url, d.title)
  }

  return get(cloned.id)!
}

export function get(id: string): LessonPlan | null {
  const row = db()
    .prepare(
      `SELECT lp.*, iv.version_name, i.title AS idea_title, i.id AS idea_id,
              pp.title AS parent_plan_title
       FROM lesson_plans lp
       JOIN idea_versions iv ON iv.id = lp.idea_version_id
       JOIN ideas i ON i.id = iv.idea_id
       LEFT JOIN lesson_plans pp ON pp.id = lp.parent_plan_id
       WHERE lp.id = ?`
    )
    .get(id) as JoinedRow | undefined
  return row ? mapRow(row) : null
}

/** 按版本 ID 查询教案（1:1 关联），不存在返回 null */
export function getByVersion(versionId: string): LessonPlan | null {
  const row = db()
    .prepare(
      `SELECT lp.*, iv.version_name, i.title AS idea_title, i.id AS idea_id,
              pp.title AS parent_plan_title
       FROM lesson_plans lp
       JOIN idea_versions iv ON iv.id = lp.idea_version_id
       JOIN ideas i ON i.id = iv.idea_id
       LEFT JOIN lesson_plans pp ON pp.id = lp.parent_plan_id
       WHERE lp.idea_version_id = ?`
    )
    .get(versionId) as JoinedRow | undefined
  return row ? mapRow(row) : null
}

/** 空字符串归一化为 null */
function normStr(v: string | null | undefined): string | null {
  if (v == null) return null
  const s = v.trim()
  return s.length === 0 ? null : s
}

/** 数值归一化：null/NaN -> null，否则取非负整数 */
function normNum(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null
  return Math.max(0, Math.floor(v))
}

/**
 * 按 ideaVersionId 幂等 upsert 教案。
 * - 已存在：仅更新传入的字段（undefined 表示不修改）
 * - 不存在：插入新行
 * 空字符串归一化为 null。
 */
export function upsert(input: LessonPlanInput): LessonPlan {
  const existing = getByVersion(input.ideaVersionId)
  if (existing) {
    const next: Record<string, string | number | null> = {}
    if (input.title !== undefined) next.title = normStr(input.title)
    if (input.objectives !== undefined) next.objectives = normStr(input.objectives)
    if (input.keyPoints !== undefined) next.keyPoints = normStr(input.keyPoints)
    if (input.preparation !== undefined) next.preparation = normStr(input.preparation)
    if (input.process !== undefined) next.process = normStr(input.process)
    if (input.reflection !== undefined) next.reflection = normStr(input.reflection)
    if (input.durationMinutes !== undefined) next.duration_minutes = normNum(input.durationMinutes)
    if (Object.keys(next).length === 0) return existing
    const sets = Object.keys(next).map((k) => `${k} = ?`).join(', ')
    db().prepare(`UPDATE lesson_plans SET ${sets} WHERE id = ?`).run(...Object.values(next), existing.id)
    return get(existing.id)!
  }
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO lesson_plans (id, idea_version_id, title, objectives, key_points, preparation, process, reflection, duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.ideaVersionId,
      normStr(input.title ?? null),
      normStr(input.objectives ?? null),
      normStr(input.keyPoints ?? null),
      normStr(input.preparation ?? null),
      normStr(input.process ?? null),
      normStr(input.reflection ?? null),
      normNum(input.durationMinutes ?? null)
    )
  return get(id)!
}

export function remove(id: string): void {
  db().prepare(`DELETE FROM lesson_plans WHERE id = ?`).run(id)
}

// ============ 教案-资源结构化关联（G13） ============

interface PlanResourceRow {
  id: string
  plan_id: string
  resource_id: string
  section: string
  sort_order: number
  note: string | null
  created_at: string
  // JOIN resources 带出的字段
  r_name: string
  r_type: string
  r_file_path: string
  r_tags: string
  r_class_id: string | null
  r_created_at: string
}

function mapPlanResourceRow(r: PlanResourceRow): PlanResource {
  const resource: Resource = {
    id: r.resource_id,
    name: r.r_name,
    type: r.r_type as ResourceType,
    filePath: r.r_file_path,
    tags: parseJSON<string[]>(r.r_tags, []),
    classId: r.r_class_id,
    createdAt: r.r_created_at
  }
  return {
    id: r.id,
    planId: r.plan_id,
    resourceId: r.resource_id,
    section: r.section,
    sortOrder: r.sort_order,
    note: r.note,
    createdAt: r.created_at,
    resource
  }
}

/**
 * 列出教案关联的全部结构化素材（JOIN resources 带出文件信息）。
 * 按 section 分组、sort_order 升序排列，便于前端按章节渲染。
 */
export function listResources(planId: string): PlanResource[] {
  const rows = db()
    .prepare(
      `SELECT pr.id, pr.plan_id, pr.resource_id, pr.section, pr.sort_order, pr.note, pr.created_at,
              r.name AS r_name, r.type AS r_type, r.file_path AS r_file_path,
              r.tags AS r_tags, r.class_id AS r_class_id, r.created_at AS r_created_at
       FROM plan_resources pr
       JOIN resources r ON r.id = pr.resource_id
       WHERE pr.plan_id = ?
       ORDER BY pr.section ASC, pr.sort_order ASC, pr.created_at ASC`
    )
    .all(planId) as PlanResourceRow[]
  return rows.map(mapPlanResourceRow)
}

/**
 * 挂载素材到教案（幂等：UNIQUE(plan_id, resource_id, section) 冲突时更新 sortOrder/note）。
 * section 默认 'preparation'。
 */
export function attachResource(planId: string, input: PlanResourceAttachInput): PlanResource {
  const section = input.section?.trim() || 'preparation'
  const sortOrder = input.sortOrder ?? 0
  const note = input.note?.trim() || null
  const id = uuid()
  db()
    .prepare(
      `INSERT INTO plan_resources (id, plan_id, resource_id, section, sort_order, note)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(plan_id, resource_id, section) DO UPDATE SET
         sort_order = excluded.sort_order,
         note = excluded.note`
    )
    .run(id, planId, input.resourceId, section, sortOrder, note)
  const row = db()
    .prepare(
      `SELECT pr.id, pr.plan_id, pr.resource_id, pr.section, pr.sort_order, pr.note, pr.created_at,
              r.name AS r_name, r.type AS r_type, r.file_path AS r_file_path,
              r.tags AS r_tags, r.class_id AS r_class_id, r.created_at AS r_created_at
       FROM plan_resources pr
       JOIN resources r ON r.id = pr.resource_id
       WHERE pr.id = ?`
    )
    .get(id) as PlanResourceRow
  return mapPlanResourceRow(row)
}

/** 解除素材关联（不删资源本身）。section 为空时删除该资源在该教案下的全部 section 关联。 */
export function detachResource(
  planId: string,
  resourceId: string,
  section?: string
): void {
  if (section && section.trim()) {
    db()
      .prepare(
        `DELETE FROM plan_resources WHERE plan_id = ? AND resource_id = ? AND section = ?`
      )
      .run(planId, resourceId, section.trim())
  } else {
    db()
      .prepare(`DELETE FROM plan_resources WHERE plan_id = ? AND resource_id = ?`)
      .run(planId, resourceId)
  }
}

/** 统计某资源被多少份教案引用（删除资源前给前端提示用） */
export function countPlanUsageOfResource(resourceId: string): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS n FROM plan_resources WHERE resource_id = ?`)
    .get(resourceId) as { n: number }
  return row?.n ?? 0
}

/**
 * 统计某教案的派生数量（被克隆了多少份）。
 * 用于源教案卡片展示「已派生 N 份」徽章，体现教案的复用价值。
 */
export function countDerivedPlans(planId: string): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS n FROM lesson_plans WHERE parent_plan_id = ?`)
    .get(planId) as { n: number }
  return row?.n ?? 0
}
