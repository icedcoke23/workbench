// 教学环节片段库：常用的结构化教学环节 Markdown 片段，可插入「教学过程」文本框

export interface TeachingSegmentSnippet {
  id: string
  name: string
  suggestedMinutes: number
  content: string
}

export const TEACHING_SEGMENT_SNIPPETS: TeachingSegmentSnippet[] = [
  {
    id: 'seg-context-intro',
    name: '情境导入',
    suggestedMinutes: 5,
    content: `### 情境导入（约5分钟）
教师通过【情境/故事/实物】引出本课主题，提问"【引导问题】"激发学员兴趣，自然过渡到新知学习。

- 活动设计：【请填写具体导入方式】
- 预期反应：学员能主动联想到【相关经验】`
  },
  {
    id: 'seg-review-intro',
    name: '复习导入',
    suggestedMinutes: 5,
    content: `### 复习导入（约5分钟）
回顾上节课【核心知识点】，通过提问/小练习激活记忆，引出本课的衔接内容。

- 复习要点：【请填写上节课关键内容】
- 衔接提问：【如何从旧知过渡到新知】`
  },
  {
    id: 'seg-teacher-demo',
    name: '教师示范',
    suggestedMinutes: 10,
    content: `### 教师示范（约10分钟）
教师演示【具体操作/技能】，边操作边讲解关键步骤与易错点。

- 示范内容：【请填写演示的核心操作】
- 讲解要点：【强调的注意事项】
- 互动设计：示范中穿插提问"接下来该怎么做？"`
  },
  {
    id: 'seg-student-practice',
    name: '学生练习',
    suggestedMinutes: 15,
    content: `### 学员练习（约15分钟）
学员动手完成【练习任务】，教师巡回指导，关注进度差异。

- 练习任务：【请填写具体任务描述】
- 分层设计：基础组完成【A】，进阶组挑战【B】
- 巡视重点：【常见错误/需个别辅导的学员】`
  },
  {
    id: 'seg-group-discussion',
    name: '小组讨论',
    suggestedMinutes: 8,
    content: `### 小组讨论（约8分钟）
围绕【讨论问题】分组交流，每组形成结论后派代表发言。

- 讨论问题：【请填写待研讨的核心问题】
- 分组方式：【2-4人一组/异质分组】
- 产出要求：每组用一句话总结观点`
  },
  {
    id: 'seg-showcase-eval',
    name: '展示评价',
    suggestedMinutes: 8,
    content: `### 展示评价（约8分钟）
选取 2-3 名学员展示作品/答案，全班用"一个优点+一个建议"格式反馈。

- 展示对象：【选择有代表性的学员作品】
- 评价维度：【创意/完成度/技术运用】
- 教师点评：肯定亮点，点明改进方向`
  },
  {
    id: 'seg-class-summary',
    name: '课堂总结',
    suggestedMinutes: 3,
    content: `### 课堂总结（约3分钟）
回顾本课【核心知识点】，梳理学习路径，预告下节课内容。

- 知识回顾：【本课关键概念清单】
- 学员自评：举手示意"我掌握了/还需练习"
- 课后衔接：【预告下节课主题】`
  },
  {
    id: 'seg-homework',
    name: '作业布置',
    suggestedMinutes: 2,
    content: `### 作业布置（约2分钟）
布置课后任务，巩固本课所学并延伸思考。

- 必做任务：【请填写基础巩固任务】
- 选做挑战：【拓展性任务，鼓励学有余力的学员】
- 提交方式：【下次课展示/拍照上传】`
  }
]
