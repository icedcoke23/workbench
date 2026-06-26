import { db } from './db'
import * as studentRepo from './repositories/students'
import * as classRepo from './repositories/classes'
import * as ideaRepo from './repositories/ideas'
import * as lessonRepo from './repositories/lessons'

/**
 * 首次启动时插入演示数据（仅在数据库完全为空时执行）
 * 方便用户首次打开时看到完整功能，而非空列表
 */
export function seedIfEmpty(): void {
  const conn = db()
  const count = conn.prepare('SELECT COUNT(*) as n FROM students').get() as { n: number }
  if (count.n > 0) return

  // ============ 学生 ============
  const students = [
    { name: '小明', tags: ['Scratch中阶'] },
    { name: '小红', tags: ['Scratch中阶', '集训'] },
    { name: '小华', tags: ['Scratch中阶'] },
    { name: '小亮', tags: ['集训'] },
    { name: '小芳', tags: ['Scratch中阶', '试听'] }
  ]
  const studentIds = students.map((s) =>
    studentRepo.create({ name: s.name, tags: s.tags })
  )

  // ============ 班级 ============
  const classRegular = classRepo.create({
    name: 'Scratch中阶-周三',
    type: 'regular',
    scheduleRule: { weekday: 3, startTime: '16:00', endTime: '17:30', subject: 'Scratch中阶' }
  })
  const classTraining = classRepo.create({
    name: 'Scratch集训班',
    type: 'training',
    scheduleRule: { weekday: 6, startTime: '09:00', endTime: '11:00', subject: 'Scratch集训' }
  })

  // 中阶班：前3名学生；集训班：第2、4名学生
  classRepo.addMembers(classRegular.id, [studentIds[0].id, studentIds[1].id, studentIds[2].id])
  classRepo.addMembers(classTraining.id, [studentIds[1].id, studentIds[3].id])

  // ============ 课次（本周） ============
  const today = new Date()
  const dayOfWeek = today.getDay()

  // 本周三的课次
  const wedOffset = (3 - dayOfWeek + 7) % 7 || 7
  const wedDate = new Date(today)
  wedDate.setDate(today.getDate() + wedOffset)
  wedDate.setHours(16, 0, 0, 0)
  const wedEnd = new Date(wedDate)
  wedEnd.setHours(17, 30, 0, 0)

  lessonRepo.create({
    classId: classRegular.id,
    startTime: wedDate.toISOString(),
    endTime: wedEnd.toISOString(),
    subject: 'Scratch中阶'
  })

  // 本周六集训
  const satOffset = (6 - dayOfWeek + 7) % 7 || 7
  const satDate = new Date(today)
  satDate.setDate(today.getDate() + satOffset)
  satDate.setHours(9, 0, 0, 0)
  const satEnd = new Date(satDate)
  satEnd.setHours(11, 0, 0, 0)

  lessonRepo.create({
    classId: classTraining.id,
    startTime: satDate.toISOString(),
    endTime: satEnd.toISOString(),
    subject: 'Scratch集训'
  })

  // ============ 点子库 ============
  const idea1 = ideaRepo.create({
    title: '太空大冒险',
    targetCourse: 'Scratch中阶',
    description: '制作一个太空飞船躲避陨石的游戏，学习克隆、碰撞检测和变量。',
    status: 'developing'
  })
  ideaRepo.createVersion({
    ideaId: idea1.id,
    versionName: 'v1.0',
    notes: '基础版本：飞船移动 + 陨石下落'
  })

  const idea2 = ideaRepo.create({
    title: '动画故事书',
    targetCourse: 'Scratch初阶',
    description: '多场景切换的动画故事，学习广播、造型切换和声音播放。',
    status: 'idea'
  })
  void idea2
}
