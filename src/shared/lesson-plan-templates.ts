// 教案模板库：预置常见 Scratch 课型模板，供教师一键套用并按学情调整

export type LessonPlanTemplateCategory = 'beginner' | 'intermediate' | 'project'

export interface LessonPlanTemplate {
  id: string
  name: string
  category: LessonPlanTemplateCategory
  durationMinutes: number
  description: string
  objectives: string
  keyPoints: string
  preparation: string
  process: string
}

export const LESSON_PLAN_TEMPLATE_CATEGORY_TEXT: Record<LessonPlanTemplateCategory, string> = {
  beginner: '入门课',
  intermediate: '进阶课',
  project: '项目课'
}

export const LESSON_PLAN_TEMPLATE_CATEGORY_COLOR: Record<LessonPlanTemplateCategory, string> = {
  beginner: 'green',
  intermediate: 'blue',
  project: 'purple'
}

export const LESSON_PLAN_TEMPLATES: LessonPlanTemplate[] = [
  {
    id: 'tpl-scratch-first-experience',
    name: 'Scratch 初体验',
    category: 'beginner',
    durationMinutes: 45,
    description: '面向首次接触 Scratch 的学员，认识舞台、角色与积木，完成一个简单的"打招呼"作品。',
    objectives: `- 认识 Scratch 界面的舞台、角色区与积木区
- 学会使用「当绿旗被点击」「说」积木让角色说话
- 体验拖拽积木编程的过程，建立"指令驱动角色"的初步认知`,
    keyPoints: `- 重点：拖拽积木并拼接成脚本，理解事件触发（绿旗）与外观（说）的关系
- 难点：理解"指令—角色—舞台"的对应关系，避免把积木拖错位置`,
    preparation: `- Scratch 编辑器（在线或离线版）已就绪
- 投影演示"打招呼"成品效果
- 学员账号或本地工程已创建`,
    process: `### 情境导入（约5分钟）
教师展示一个会说话的小猫作品，提问"它是怎么开口说话的？"引出 Scratch。

### 认识界面（约10分钟）
带学员依次认识舞台、角色区、积木分类（事件、外观），演示拖拽一个积木到脚本区。

### 教师示范（约8分钟）
示范拼接「当绿旗被点击」+「说 你好！2 秒」，点击绿旗看效果。

### 学员练习（约15分钟）
学员完成自己的"打招呼"作品，鼓励修改说话内容、时长，尝试多个角色。

### 展示交流（约5分钟）
2-3 名学员展示作品，教师点评创意。

### 课堂总结（约2分钟）
回顾"绿旗触发—角色说话"的核心逻辑，预告下节课"让角色动起来"。`
  },
  {
    id: 'tpl-sequence-and-loop',
    name: '序列与循环',
    category: 'intermediate',
    durationMinutes: 60,
    description: '理解代码的顺序执行与循环结构，通过"巡逻小猫"作品掌握重复执行积木。',
    objectives: `- 理解脚本自上而下顺序执行的特性
- 掌握「重复执行」「重复执行 N 次」两种循环积木的适用场景
- 能用循环优化重复指令，体会"循环简化代码"的价值`,
    keyPoints: `- 重点：区分无限循环与计数循环，能在作品中正确选用
- 难点：循环体边界识别（哪些积木应放进循环内），避免逻辑错位`,
    preparation: `- Scratch 编辑器已就绪
- 准备"巡逻小猫"半成品工程（小猫已就位、舞台已设置边界）
- 巡逻路径示意图（白板或投屏）`,
    process: `### 复习导入（约5分钟）
回顾上节课"打招呼"，提问"如果想让小猫走 10 步怎么办？"引出顺序指令的繁琐。

### 教师示范（约12分钟）
先用 10 个「移动 10 步」拼出顺序脚本，再引入「重复执行 10 次」改写，对比代码量。

### 概念讲解（约8分钟）
讲解无限循环（重复执行）与计数循环（重复执行 N 次）的区别，举生活例子（绕操场跑圈）。

### 学员练习（约20分钟）
学员完成"巡逻小猫"：小猫沿舞台边缘来回走动，遇到边缘反弹。鼓励尝试嵌套动作（走+转身）。

### 小组讨论（约8分钟）
分组讨论"哪些场景适合无限循环，哪些适合计数循环"，每组举一个例子。

### 展示评价（约5分钟）
学员展示作品，教师从"循环使用是否恰当"角度点评。

### 课堂总结（约2分钟）
回顾循环两种形态，强调"循环体"概念，预告下节课"条件判断"。`
  },
  {
    id: 'tpl-condition-and-sensing',
    name: '条件与侦测',
    category: 'intermediate',
    durationMinutes: 60,
    description: '学习条件判断与侦测积木，实现"碰到颜色就..."的交互效果，制作简易追逐游戏。',
    objectives: `- 掌握「如果...那么」「如果...那么...否则」条件积木
- 学会使用侦测类积木（碰到颜色、碰到鼠标指针）
- 能组合循环+条件实现持续的交互判定`,
    keyPoints: `- 重点：条件积木与循环配合，实现"持续侦测—响应"的逻辑
- 难点：侦测条件的触发时机理解，避免条件永不成立或逻辑死锁`,
    preparation: `- Scratch 编辑器已就绪
- 准备追逐游戏素材（玩家角色、目标角色、舞台背景含指定颜色区域）
- 颜色选取器使用说明（投屏）`,
    process: `### 复习导入（约5分钟）
回顾循环，提问"小猫一直走，碰到墙该怎么办？"引出条件判断。

### 教师示范（约12分钟）
示范「如果 碰到颜色 那么说出目标！」，放入无限循环，演示触发效果。

### 概念讲解（约8分钟）
讲解条件分支（如果/否则），结合侦测积木说明"持续检查"需要循环包裹。

### 学员练习（约20分钟）
学员完成追逐游戏：玩家角色跟随鼠标，碰到目标角色得分；鼓励加入"否则"分支处理未碰到的情况。

### 小组讨论（约8分钟）
讨论"条件放不进循环会怎样"，动手实验验证猜想。

### 展示评价（约5分钟）
学员展示作品，互评交互是否流畅。

### 课堂总结（约2分钟）
回顾"循环+条件"组合模式，预告下节课综合项目创作。`
  },
  {
    id: 'tpl-project-creation',
    name: '项目式创作',
    category: 'project',
    durationMinutes: 90,
    description: '综合运用序列、循环、条件与侦测，学员自主设计并完成一个小型互动作品。',
    objectives: `- 综合运用已学积木完成一个有明确主题的互动作品
- 经历"构思—设计—实现—调试—展示"的完整项目流程
- 培养问题分解与自主调试能力`,
    keyPoints: `- 重点：项目拆解为可实现的小任务，逐步实现并整合
- 难点：多角色多脚本的协作调试，发现并修复逻辑错误`,
    preparation: `- Scratch 编辑器已就绪
- 准备项目主题清单（如：迷宫闯关、互动故事、答题游戏）供学员选择
- 调试提示卡（常见错误排查清单）
- 投影计时器用于阶段时间管理`,
    process: `### 情境导入（约5分钟）
教师展示几个往届优秀作品，激发创作热情，说明今日目标：完成自己的互动作品。

### 选题与设计（约15分钟）
学员选择主题，在草稿纸上画出角色、舞台与交互流程草图，教师巡回确认可行性。

### 分步实现（约40分钟）
学员按设计图分步实现：先搭主角色脚本，再加交互，最后润色。教师巡回答疑，引导而非代劳。

### 调试优化（约15分钟）
专设调试环节，学员互测作品找 bug，对照调试提示卡自主修复。鼓励"先描述问题再改代码"。

### 展示评价（约12分钟）
每位学员展示作品 1-2 分钟，观众用"一个优点+一个建议"格式反馈。

### 课堂总结（约3分钟）
回顾项目流程，肯定学员的坚持与创意，预告下次展示日或迭代方向。`
  }
]
