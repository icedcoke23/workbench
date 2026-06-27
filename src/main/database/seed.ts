import { db, uuid } from './db'
import { seedBuiltinTemplates } from './repositories/feedback-templates'

/**
 * 种子数据：数据库为空时插入示例数据。
 * 1. 先播种内置反馈模板（失败仅记录错误，不阻断流程）
 * 2. students 表为空时插入示例学生、班级、关联、点子
 */
export function seedIfEmpty(): void {
  // 先播种内置反馈模板
  try {
    seedBuiltinTemplates()
  } catch (e) {
    console.error('播种内置模板失败', e)
  }

  // 检查 students 表是否为空
  const studentCount = (db().prepare(`SELECT COUNT(*) as c FROM students`).get() as { c: number }).c
  if (studentCount > 0) return

  // ============ 3 个示例学生 ============
  const zhangId = uuid()
  const liId = uuid()
  const wangId = uuid()
  const insertStudent = db().prepare(
    `INSERT INTO students (id, name, grade, tags) VALUES (?, ?, ?, ?)`
  )
  insertStudent.run(zhangId, '张小明', '三年级', JSON.stringify(['集训']))
  insertStudent.run(liId, '李大壮', '四年级', JSON.stringify(['常规']))
  insertStudent.run(wangId, '王小红', '二年级', JSON.stringify(['试听']))

  // ============ 2 个示例班级 ============
  const basicClassId = uuid()
  const trainingClassId = uuid()
  const insertClass = db().prepare(
    `INSERT INTO classes (id, name, type, schedule_rule) VALUES (?, ?, ?, ?)`
  )
  insertClass.run(basicClassId, '周六Scratch基础班', 'regular', null)
  insertClass.run(trainingClassId, '暑期集训营', 'training', null)

  // ============ enrollments 关联 ============
  const insertEnrollment = db().prepare(
    `INSERT INTO enrollments (id, student_id, class_id) VALUES (?, ?, ?)`
  )
  // 张小明 + 李大壮 到基础班
  insertEnrollment.run(uuid(), zhangId, basicClassId)
  insertEnrollment.run(uuid(), liId, basicClassId)
  // 全部 3 人到集训营
  insertEnrollment.run(uuid(), zhangId, trainingClassId)
  insertEnrollment.run(uuid(), liId, trainingClassId)
  insertEnrollment.run(uuid(), wangId, trainingClassId)

  // ============ 2 个示例点子 ============
  const insertIdea = db().prepare(
    `INSERT INTO ideas (id, title, description, status) VALUES (?, ?, ?, ?)`
  )
  insertIdea.run(
    uuid(),
    '太空冒险游戏',
    '一个控制飞船躲避陨石、收集能量晶体的太空冒险 Scratch 游戏，包含多关卡与计分系统。',
    'idea'
  )
  insertIdea.run(
    uuid(),
    '互动故事书',
    '通过点击选择分支剧情的互动故事书，包含多个结局与角色对话动画。',
    'idea'
  )
}
