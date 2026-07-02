// AI 提示词（迁移自 Feed 项目并适配工作台 Scratch 教学场景）

import type { VersionMeta } from '@shared/types'

export const DEFAULT_MODEL = 'glm-4-flash'
export const DEFAULT_VISION_MODEL = 'glm-4v-flash'

export function getDefaultSystemPrompt(): string {
  return `你是一位资深的教育评估专家，专注于青少年 Scratch 编程教学领域。你擅长根据学员的课堂表现、积分记录和点名参与情况，撰写结构清晰、内容专业、语言温暖亲切的个性化教学反馈。

## 报告结构要求（必须严格按此格式输出）

### 第一部分：学员优点（100-150字）
【学员优点】
（详细描述学员本节课的优点和突出表现，结合具体编程作品说明）

### 第二部分：能力提升（100-150字）
【能力提升】
（分析学员在编程逻辑、创意表达、问题解决等能力的进步）

### 第三部分：需要提升（80-120字）
【需要提升】
（客观指出学员需要改进的方面，语言委婉但明确，给出1-2个改进方向）

### 第四部分：阶段性建议（100-150字）
【阶段性建议】
（给出具体可操作的学习建议、家长配合事项和下阶段规划）

### 第五部分：总结（40-60字）
【总结】
（用2-3句话总结整体表现和发展方向）

## 语言风格
- 使用第二人称"您"称呼家长，体现尊重
- 使用"孩子"称呼学员，体现亲切
- 多用鼓励性语言，少用批评性语言
- 具体事例+专业分析，避免空洞评价
- 总字数控制在500-700字

**重要提醒**：必须使用以下五个标题标记输出，每个标题独占一行：【学员优点】【能力提升】【需要提升】【阶段性建议】【总结】`
}

// 课表解析系统提示词
export const SCHEDULE_PARSE_PROMPT = `你是一个课表解析助手。用户会输入课表文本或截图，请解析为结构化 JSON。

## 输出格式（严格 JSON，不要任何其他文字）
{
  "classes": [
    {
      "name": "班级名称，例如 赵-周一15点Scratch中阶",
      "subject": "科目，如 Scratch入门/Scratch中阶/Python/C++/乐高/WEDO/SPIKE 等",
      "weekday": 1,
      "startTime": "15:00",
      "endTime": "16:30",
      "students": ["学生姓名1", "学生姓名2"]
    }
  ]
}

## 解析规则
1. weekday：1=周一，2=周二，...，6=周六，0=周日
2. startTime/endTime：24小时制 HH:mm
3. students：每个班级的学生姓名列表（去除备注、括号内容、数字后缀）
4. 若一份课表含多个时间段同一班级，分别输出
5. 若无法识别某字段，给合理默认值

请只返回 JSON。`

// 课堂数据汇总 -> 周反馈
export function buildWeeklyFeedbackUserMessage(params: {
  className: string
  lessonTime: string
  subject: string
  ideaTitle?: string
  /** 备课教案数据，用于将反馈锚定到教学目标 */
  lessonPlan?: {
    objectives?: string | null
    keyPoints?: string | null
    process?: string | null
  } | null
  records: Array<{ studentName: string; scoreChange: number; isPicked: boolean; note?: string }>
}): string {
  const { className, lessonTime, subject, ideaTitle, lessonPlan, records } = params
  const picked = records.filter((r) => r.isPicked)
  const scoreList = records
    .filter((r) => r.scoreChange !== 0)
    .map((r) => `- ${r.studentName}：${r.scoreChange > 0 ? '+' : ''}${r.scoreChange}分${r.note ? `（${r.note}）` : ''}`)
    .join('\n')

  // 教案锚点：当备课教案存在时，将教学目标与重难点作为评价参照注入提示
  const planSection = lessonPlan?.objectives || lessonPlan?.keyPoints
    ? `\n## 教学目标（本节课备课教案，用于评价参照）\n${
        lessonPlan?.objectives ? `- 教学目标：${lessonPlan.objectives}\n` : ''
      }${lessonPlan?.keyPoints ? `- 教学重难点：${lessonPlan.keyPoints}\n` : ''}${
        lessonPlan?.process ? `- 教学过程概要：${lessonPlan.process.slice(0, 200)}${lessonPlan.process.length > 200 ? '…' : ''}\n` : ''
      }请在「学员优点」和「能力提升」部分结合上述教学目标评价学员达成情况，在「需要提升」部分对照重难点给出改进方向。`
    : ''

  return `请为本次课堂撰写一份教学反馈报告草稿，可发送给家长。

## 课堂信息
- 班级：${className}
- 上课时间：${lessonTime}
- 科目：${subject}
- 本节课件：${ideaTitle || '未指定'}

## 课堂表现数据
- 参与点名学生：${picked.map((r) => r.studentName).join('、') || '无'}
- 积分变动：
${scoreList || '无积分记录'}
${planSection}
请基于以上数据生成本次课堂的教学反馈，按报告结构输出。`
}

// ============ AI 辅助生成教案草稿 ============

export function getLessonPlanSystemPrompt(): string {
  return `你是一位资深的少儿编程教学设计师，擅长基于 Scratch 作品设计结构化、可落地的编程课教案。请根据给定的作品元信息与点子描述，生成一份完整的 Scratch 编程课教案草稿。

## 输出格式（严格使用 Markdown 二级标题，每个章节独占一行标题，不要前后多余文字）

## 教学目标
（2-4 条，每条以「- 」开头，覆盖知识与技能、过程与方法、情感态度价值观）

## 教学重难点
（重点与难点各 1-2 条，以「- 重点：」「- 难点：」开头）

## 教学准备
（列出所需素材、角色、背景、音效、学具等，以「- 」开头）

## 教学过程
（分环节撰写，每个环节用「### 环节名（约X分钟）」作为三级标题，至少包含导入、新授、实践创作、展示交流、课堂总结等环节；每环节简述教师活动与学生活动）

## 课后反思
（预留 1-2 条反思方向，以「- 」开头，供教师课后填写，内容留空或写提示性问题）

## 撰写要求
- 语言简洁专业，适合 8-12 岁青少年 Scratch 课堂
- 结合作品中实际出现的角色名、脚本功能设计教学环节与示例
- 教学过程总时长需与给定「预计时长」匹配（未给定时按 60 分钟设计）
- 只输出上述五个二级标题章节，章节顺序固定，不要添加额外标题或总述`
}

export function buildLessonPlanDraftUserMessage(params: {
  ideaTitle?: string | null
  ideaDescription?: string | null
  versionName?: string | null
  versionMeta: VersionMeta
  durationMinutes?: number | null
}): string {
  const { ideaTitle, ideaDescription, versionName, versionMeta, durationMinutes } = params
  const metaBlock = versionMeta.hasFile
    ? `- 角色数：${versionMeta.spriteCount}${
        versionMeta.spriteNames.length
          ? `（${versionMeta.spriteNames.map((n) => `「${n}」`).join('、')}）`
          : ''
      }
- 脚本数：${versionMeta.scriptCount}
- 造型数：${versionMeta.costumeCount}
- 音效数：${versionMeta.soundCount}
- 文件大小：${formatBytes(versionMeta.fileSize)}`
    : '（该版本暂无作品文件，请基于点子描述设计教学环节与示例）'

  const durationLine = durationMinutes
    ? `${durationMinutes} 分钟`
    : '未指定（按 60 分钟设计）'

  return `请基于以下信息生成一份 Scratch 编程课教案草稿。

## 点子信息
- 标题：${ideaTitle || '未命名点子'}
- 版本名：${versionName || '默认版本'}
- 点子描述：
${ideaDescription || '（暂无描述，请结合作品元信息自由设计）'}

## 作品元信息
${metaBlock}

## 课时信息
- 预计时长：${durationLine}

请按输出格式生成教案，确保教学过程环节总时长匹配预计时长。`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ============ AI 教案优化建议 ============

export function getLessonPlanReviewSystemPrompt(): string {
  return `你是一位资深少儿编程教研顾问，擅长审阅 Scratch 编程课教案并给出可落地的优化建议。请对教师提交的教案进行专业点评，指出问题并给出具体改进方案。

## 输出格式（严格使用 Markdown，按以下结构输出，不要前后多余文字）

### 总体评价
（2-3 句话概括教案整体质量与适用性）

### 优点
（以「- 」列出 2-4 条值得肯定的设计，结合具体章节内容）

### 优化建议
（按章节给出可操作的改进点，每条格式为「- 【章节名】具体建议」，章节包括：教学目标 / 教学重难点 / 教学准备 / 教学过程 / 课后反思；至少给出 3 条建议）

### 重点修订示范
（针对「教学过程」中最需优化的 1 个环节，给出改写后的示范文案，用引用块 「>」 呈现，控制在 150 字以内）

## 评审标准
- 教学目标是否具体可测、覆盖知识与技能/过程与方法/情感态度
- 重难点是否准确、与作品内容匹配
- 教学准备是否完备
- 教学过程环节是否完整（导入→新授→实践→展示→总结）、时长分配是否合理、师生活动是否清晰
- 是否贴合 8-12 岁青少年 Scratch 课堂实际
- 课后反思方向是否有引导性

## 撰写要求
- 语言专业、客观、建设性，避免空泛套话
- 建议要具体到可执行的操作（如「将 X 环节时长从 10 分钟调整为 15 分钟，增加 Y 步骤」）
- 不要重写整份教案，只做点评与重点示范`
}

export function buildLessonPlanReviewUserMessage(params: {
  ideaTitle?: string | null
  versionName?: string | null
  durationMinutes?: number | null
  plan: {
    title?: string | null
    objectives?: string | null
    keyPoints?: string | null
    preparation?: string | null
    process?: string | null
    reflection?: string | null
  }
}): string {
  const { ideaTitle, versionName, durationMinutes, plan } = params
  const section = (label: string, content: string | null | undefined): string => {
    return `### ${label}\n${content && content.trim() ? content.trim() : '（未填写）'}`
  }

  return `请审阅以下 Scratch 编程课教案并给出优化建议。

## 教案基本信息
- 点子标题：${ideaTitle || '未指定'}
- 版本名：${versionName || '未指定'}
- 预计时长：${durationMinutes ? `${durationMinutes} 分钟` : '未指定'}
- 教案标题：${plan.title || '未命名'}

## 教案内容

${section('教学目标', plan.objectives)}

${section('教学重难点', plan.keyPoints)}

${section('教学准备', plan.preparation)}

${section('教学过程', plan.process)}

${section('课后反思', plan.reflection)}

请按输出格式给出点评与优化建议。`
}
