import { resolveAISettings, invokeAI, invokeVision, sanitizeUserInput, extractJSON } from './ai'
import { SCHEDULE_PARSE_PROMPT } from '../lib/prompts'
import { readFileSync } from 'fs'
import * as classRepo from '../database/repositories/classes'
import * as studentRepo from '../database/repositories/students'
import * as lessonRepo from '../database/repositories/lessons'
import type { ScheduleParseResult } from '@shared/types'

function toWeekday(s: unknown): number {
  const n = Number(s)
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n
  const map: Record<string, number> = {
    日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6
  }
  const m = String(s).match(/周(.)|星期(.)/)
  if (m) return map[m[1] || m[2]] ?? 1
  return 1
}

function normalize(raw: unknown): ScheduleParseResult {
  const obj = raw as { classes?: unknown[] }
  const classes = Array.isArray(obj.classes) ? obj.classes : []
  return {
    classes: classes.map((c) => {
      const item = c as Record<string, unknown>
      return {
        name: String(item.name ?? ''),
        subject: String(item.subject ?? 'Scratch'),
        weekday: toWeekday(item.weekday),
        startTime: String(item.startTime ?? '09:00'),
        endTime: String(item.endTime ?? '10:30'),
        students: Array.isArray(item.students)
          ? item.students.map((s) => String(s).trim()).filter(Boolean)
          : []
      }
    })
  }
}

export async function parseText(text: string): Promise<ScheduleParseResult> {
  const settings = resolveAISettings()
  if (!settings) throw new Error('AI 未配置，请在设置中配置第三方 AI 参数')
  const resp = await invokeAI(
    settings,
    [
      { role: 'system', content: SCHEDULE_PARSE_PROMPT },
      { role: 'user', content: `请解析以下课表：\n${sanitizeUserInput(text, 4000)}` }
    ],
    0.1
  )
  return normalize(extractJSON(resp))
}

export async function parseImage(imagePath: string): Promise<ScheduleParseResult> {
  const settings = resolveAISettings()
  if (!settings) throw new Error('AI 未配置，请在设置中配置第三方 AI 参数')
  const buf = readFileSync(imagePath)
  const base64 = buf.toString('base64')
  const resp = await invokeVision(settings, base64, SCHEDULE_PARSE_PROMPT, '请解析这张课表截图并返回结构化 JSON。')
  return normalize(extractJSON(resp))
}

/** 将解析结果写入数据库：自动创建/复用班级、学生，并为本周生成课次。
 * 重复导入同一课表时，按 name+weekday+startTime 复用已有班级，避免重复创建。 */
export function importResult(result: ScheduleParseResult): {
  classes: number
  students: number
  lessons: number
} {
  const existingStudents = new Map<string, string>() // name -> id
  for (const s of studentRepo.list()) existingStudents.set(s.name, s.id)

  // 班级去重键：name|weekday|startTime
  const existingClasses = new Map<string, string>() // key -> classId
  for (const c of classRepo.list()) {
    const rule = c.scheduleRule
    if (rule && typeof rule.weekday === 'number' && rule.startTime) {
      existingClasses.set(`${c.name}|${rule.weekday}|${rule.startTime}`, c.id)
    }
  }

  let classCount = 0
  let lessonCount = 0
  const newStudentNames = new Set<string>()

  for (const c of result.classes) {
    const key = `${c.name}|${c.weekday}|${c.startTime}`
    let clsId = existingClasses.get(key)
    let isNewClass = false
    if (!clsId) {
      // 创建新班级
      const cls = classRepo.create({
        name: c.name,
        type: 'regular',
        scheduleRule: {
          weekday: c.weekday,
          startTime: c.startTime,
          endTime: c.endTime,
          subject: c.subject
        }
      })
      clsId = cls.id
      existingClasses.set(key, clsId)
      isNewClass = true
      classCount++
    }

    // 学生入班（已存在的班级也补充成员）
    const studentIds: string[] = []
    for (const name of c.students) {
      let sid = existingStudents.get(name)
      if (!sid) {
        const s = studentRepo.create({ name })
        existingStudents.set(name, s.id)
        newStudentNames.add(name)
        sid = s.id
      }
      studentIds.push(sid)
    }
    if (studentIds.length) classRepo.addMembers(clsId, studentIds)

    // 仅对新班级生成本周课次，避免重复导入产生重复课次
    if (isNewClass) {
      const lessonStart = nextWeekdayDate(c.weekday, c.startTime)
      const lessonEnd = nextWeekdayDate(c.weekday, c.endTime)
      lessonRepo.create({
        classId: clsId,
        startTime: lessonStart,
        endTime: lessonEnd,
        subject: c.subject
      })
      lessonCount++
    }
  }

  return { classes: classCount, students: newStudentNames.size, lessons: lessonCount }
}

/** 计算本周（或下周）指定星期的时间。
 * 若目标日是今天且时间已过，则推到下周同一天，避免生成过去课次。 */
function nextWeekdayDate(weekday: number, time: string): string {
  const now = new Date()
  const curDay = now.getDay()
  let diff = weekday - curDay
  if (diff < 0) diff += 7
  const date = new Date(now)
  date.setDate(now.getDate() + diff)
  const parts = time.split(':').map(Number)
  const h = Number.isFinite(parts[0]) ? parts[0] : 0
  const m = Number.isFinite(parts[1]) ? parts[1] : 0
  date.setHours(h, m, 0, 0)
  // 若是今天且时间已过，推到下周
  if (diff === 0 && date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 7)
  }
  return date.toISOString()
}
