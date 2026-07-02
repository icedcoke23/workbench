// 教案备课就绪度计算（G15）：将二元的「关键章节非空」就绪信号深化为多维清单。
// 维度：教学目标 / 重难点 / 教学准备 / 教学过程 / 预计时长 / 关联素材 / 环节时长合理性
// 供 PrepView 编辑器实时展示清单、卡片展示就绪徽章、TeachingView 授课上下文展示摘要共用。

export type ReadinessLevel = 'draft' | 'partial' | 'ready'

export interface PlanReadinessItem {
  key: string
  label: string
  passed: boolean
  hint: string
}

export interface PlanReadiness {
  items: PlanReadinessItem[]
  passedCount: number
  totalCount: number
  /** 就绪百分比 0-100 */
  pct: number
  level: ReadinessLevel
  /** 核心项（教学目标 + 教学过程）是否全部通过 */
  corePassed: boolean
}

export interface PlanReadinessInput {
  objectives?: string | null
  keyPoints?: string | null
  preparation?: string | null
  process?: string | null
  durationMinutes?: number | null
  /** 关联素材数量；传 undefined 表示不评估该项（用于列表卡片等无素材数据的场景） */
  resourceCount?: number
}

/** 匹配 `### 环节名（约X分钟）` / `（约X-Y分钟）` 的环节时长标注 */
const SEGMENT_RE = /^###\s+(.+?)（约\s*(\d+)\s*(?:[-~到]\s*(\d+))?\s*分钟）/

/**
 * 解析「教学过程」中形如 `### 环节名（约X分钟）` / `（约X-Y分钟）` 的环节时长标注。
 * 与 PrepView 原内联解析逻辑对齐，统一为共享实现，避免规则漂移。
 */
export function parseProcessSegments(
  processText: string | null | undefined
): { name: string; minutes: number }[] {
  const text = processText || ''
  const segments: { name: string; minutes: number }[] = []
  let currentName: string | null = null
  let currentMin: number | null = null
  for (const line of text.split('\n')) {
    const m = line.match(SEGMENT_RE)
    if (m) {
      if (currentName !== null && currentMin !== null) {
        segments.push({ name: currentName, minutes: currentMin })
      }
      currentName = m[1].trim()
      currentMin = m[3] ? Math.round((Number(m[2]) + Number(m[3])) / 2) : Number(m[2])
    }
  }
  if (currentName !== null && currentMin !== null) {
    segments.push({ name: currentName, minutes: currentMin })
  }
  return segments
}

function hasText(v: string | null | undefined): boolean {
  return !!v && v.trim().length > 0
}

/**
 * 计算教案备课就绪度（多维清单）。
 * - 资源项仅在 resourceCount !== undefined 时纳入评估（编辑器有数据，卡片无数据）
 * - 环节时长合理性：≥2 个环节，且（未设总时长 或 环节总时长与预计相差 ≤5 分钟）
 * - 就绪等级：ready 需 pct ≥ 80 且核心项（目标+过程）通过；partial ≥ 34%；否则 draft
 */
export function computePlanReadiness(input: PlanReadinessInput): PlanReadiness {
  const objectivesOk = hasText(input.objectives)
  const keyPointsOk = hasText(input.keyPoints)
  const preparationOk = hasText(input.preparation)
  const processOk = hasText(input.process)
  const durationOk = input.durationMinutes != null && input.durationMinutes > 0

  const segments = parseProcessSegments(input.process)
  const segTotal = segments.reduce((s, x) => s + x.minutes, 0)
  let segmentsBalanced = false
  if (segments.length >= 2) {
    if (!durationOk) {
      segmentsBalanced = true // 有多环节但未设总时长，视为环节自洽
    } else {
      segmentsBalanced = Math.abs(segTotal - (input.durationMinutes as number)) <= 5
    }
  }

  const items: PlanReadinessItem[] = [
    { key: 'objectives', label: '教学目标', passed: objectivesOk, hint: '明确本节课要达成的目标' },
    { key: 'keyPoints', label: '教学重难点', passed: keyPointsOk, hint: '标注重点与难点' },
    { key: 'preparation', label: '教学准备', passed: preparationOk, hint: '列出素材、环境、教具' },
    { key: 'process', label: '教学过程', passed: processOk, hint: '分环节描述课堂推进' },
    { key: 'duration', label: '预计时长', passed: durationOk, hint: '设置本节课总时长' }
  ]
  if (input.resourceCount !== undefined) {
    const resourceOk = input.resourceCount > 0
    items.push({ key: 'resources', label: '关联素材', passed: resourceOk, hint: '至少挂载一个资源库素材' })
  }
  items.push({
    key: 'segments',
    label: '环节时长合理',
    passed: segmentsBalanced,
    hint: '≥2 个环节且总时长与预计匹配（±5 分钟）'
  })

  const passedCount = items.filter((i) => i.passed).length
  const totalCount = items.length
  const pct = Math.round((passedCount / totalCount) * 100)
  const corePassed = objectivesOk && processOk
  const level: ReadinessLevel =
    pct >= 80 && corePassed ? 'ready' : pct >= 34 ? 'partial' : 'draft'

  return { items, passedCount, totalCount, pct, level, corePassed }
}

/** 就绪等级 → 展示文本 */
export function readinessLevelText(level: ReadinessLevel): string {
  switch (level) {
    case 'ready':
      return '就绪'
    case 'partial':
      return '部分就绪'
    case 'draft':
      return '草稿'
  }
}

/** 就绪等级 → 标签颜色（Ant Design tag color） */
export function readinessLevelColor(level: ReadinessLevel): string {
  switch (level) {
    case 'ready':
      return 'green'
    case 'partial':
      return 'gold'
    case 'draft':
      return 'volcano'
  }
}
