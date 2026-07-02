import { ipcMain, BrowserWindow } from 'electron'
import { db, tryRun, tryRunAsync } from '../database/db'
import type { Resource } from '@shared/types'
import * as studentRepo from '../database/repositories/students'
import * as classRepo from '../database/repositories/classes'
import * as lessonRepo from '../database/repositories/lessons'
import * as ideaRepo from '../database/repositories/ideas'
import * as lessonPlanRepo from '../database/repositories/lesson-plans'
import * as lessonPlanTemplateRepo from '../database/repositories/lesson-plan-templates'
import * as todoRepo from '../database/repositories/todos'
import * as resourceRepo from '../database/repositories/resources'
import * as feedbackRepo from '../database/repositories/feedbacks'
import * as feedbackTemplateRepo from '../database/repositories/feedback-templates'
import * as docRepo from '../database/repositories/docs'
import * as settingsRepo from '../database/repositories/settings'
import * as scheduleService from '../services/schedule'
import * as feedbackService from '../services/feedback'
import * as pdfService from '../services/pdf'
import * as todoService from '../services/todos'
import * as fileService from '../services/file'
import * as syncService from '../services/sync'
import * as wechatService from '../services/wechat'
import * as dataService from '../services/data'
import * as historyService from '../services/history'
import * as lessonPlanService from '../services/lesson-plan'
import { resolveAISettings, invokeAI } from '../services/ai'
import * as scratchService from '../services/scratch'
import { app } from 'electron'
import { join } from 'path'

/** 注册全部 IPC 处理器 */
export function registerIpc(getMainWindow: () => BrowserWindow | null): void {
  // ============ 学生 ============
  ipcMain.handle('student:list', (_e, q) => tryRun(() => studentRepo.list(q)))
  ipcMain.handle('student:get', (_e, id) => tryRun(() => studentRepo.get(id)))
  ipcMain.handle('student:create', (_e, input) => tryRun(() => studentRepo.create(input)))
  ipcMain.handle('student:update', (_e, id, input) => tryRun(() => studentRepo.update(id, input)))
  ipcMain.handle('student:remove', (_e, id) => tryRun(() => studentRepo.remove(id)))
  ipcMain.handle('student:allTags', () => tryRun(() => studentRepo.allTags()))

  // ============ 班级 ============
  ipcMain.handle('class:list', (_e, q) => tryRun(() => classRepo.list(q)))
  ipcMain.handle('class:get', (_e, id) => tryRun(() => classRepo.get(id)))
  ipcMain.handle('class:create', (_e, input) => tryRun(() => classRepo.create(input)))
  ipcMain.handle('class:update', (_e, id, input) => tryRun(() => classRepo.update(id, input)))
  ipcMain.handle('class:remove', (_e, id) => tryRun(() => classRepo.remove(id)))
  ipcMain.handle('class:members', (_e, classId) => tryRun(() => classRepo.members(classId)))
  ipcMain.handle('class:addMembers', (_e, classId, ids) => tryRun(() => classRepo.addMembers(classId, ids)))
  ipcMain.handle('class:removeMember', (_e, classId, sid) => tryRun(() => classRepo.removeMember(classId, sid)))

  // ============ 课次 ============
  ipcMain.handle('lesson:list', (_e, q) => tryRun(() => lessonRepo.list(q ?? {})))
  ipcMain.handle('lesson:get', (_e, id) => tryRun(() => lessonRepo.get(id)))
  ipcMain.handle('lesson:create', (_e, input) => tryRun(() => lessonRepo.create(input)))
  ipcMain.handle('lesson:update', (_e, id, input) => tryRun(() => lessonRepo.update(id, input)))
  ipcMain.handle('lesson:remove', (_e, id) => tryRun(() => lessonRepo.remove(id)))
  ipcMain.handle('lesson:finish', (_e, id) => tryRun(() => lessonRepo.finish(id)))
  ipcMain.handle('lesson:setReflection', (_e, id, text) =>
    tryRun(() => lessonRepo.setReflection(id, text))
  )
  ipcMain.handle('lesson:assess', async (e, lessonId) =>
    tryRunAsync(async () => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? getMainWindow()
      const full = await lessonPlanService.assessAchievement(lessonId, (delta) => {
        win?.webContents.send('lesson:assessChunk', delta)
      })
      win?.webContents.send('lesson:assessChunk', '[DONE]')
      return full
    })
  )
  ipcMain.handle('lesson:records', (_e, lessonId) => tryRun(() => lessonRepo.records(lessonId)))
  ipcMain.handle('lesson:score', (_e, action) => tryRun(() => lessonRepo.score(action)))
  ipcMain.handle('lesson:pick', (_e, lessonId) =>
    tryRun(() => {
      const r = lessonRepo.pickStudent(lessonId)
      if (!r) throw new Error('班级无学生')
      const s = studentRepo.get(r.studentId)
      if (!s) throw new Error('学生不存在')
      return s
    })
  )

  // ============ 点子库 ============
  ipcMain.handle('idea:list', () => tryRun(() => ideaRepo.list()))
  ipcMain.handle('idea:get', (_e, id) => tryRun(() => ideaRepo.get(id)))
  ipcMain.handle('idea:create', (_e, input) => tryRun(() => ideaRepo.create(input)))
  ipcMain.handle('idea:update', (_e, id, input) => tryRun(() => ideaRepo.update(id, input)))
  ipcMain.handle('idea:remove', (_e, id) => tryRun(() => ideaRepo.remove(id)))
  ipcMain.handle('idea:createVersion', (_e, input) => tryRun(() => ideaRepo.createVersion(input)))
  ipcMain.handle('idea:updateVersion', (_e, id, input) => tryRun(() => ideaRepo.updateVersion(id, input)))
  ipcMain.handle('idea:removeVersion', (_e, id) => tryRun(() => ideaRepo.removeVersion(id)))
  ipcMain.handle('idea:getVersionMeta', (_e, id) => tryRunAsync(() => scratchService.getVersionMeta(id)))

  // ============ 教案 ============
  ipcMain.handle('lessonPlan:list', (_e, q) => tryRun(() => lessonPlanRepo.list(q)))
  ipcMain.handle('lessonPlan:get', (_e, id) => tryRun(() => lessonPlanRepo.get(id)))
  ipcMain.handle('lessonPlan:getByVersion', (_e, versionId) => tryRun(() => lessonPlanRepo.getByVersion(versionId)))
  ipcMain.handle('lessonPlan:upsert', (_e, input) => tryRun(() => lessonPlanRepo.upsert(input)))
  ipcMain.handle('lessonPlan:remove', (_e, id) => tryRun(() => lessonPlanRepo.remove(id)))
  ipcMain.handle('lessonPlan:clone', (_e, sourcePlanId, input) =>
    tryRun(() => lessonPlanRepo.clonePlan(sourcePlanId, input))
  )
  // 教案-资源结构化关联（G13）
  ipcMain.handle('lessonPlan:listResources', (_e, planId) =>
    tryRun(() => lessonPlanRepo.listResources(planId))
  )
  ipcMain.handle('lessonPlan:attachResource', (_e, planId, input) =>
    tryRun(() => lessonPlanRepo.attachResource(planId, input))
  )
  ipcMain.handle('lessonPlan:detachResource', (_e, planId, resourceId, section) =>
    tryRun(() => lessonPlanRepo.detachResource(planId, resourceId, section))
  )
  ipcMain.handle('lessonPlan:generateDraft', async (e, versionId, durationMinutes) =>
    tryRunAsync(async () => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? getMainWindow()
      const full = await lessonPlanService.generateDraft(versionId, durationMinutes, (delta) => {
        win?.webContents.send('lessonPlan:chunk', delta)
      })
      win?.webContents.send('lessonPlan:chunk', '[DONE]')
      return full
    })
  )
  ipcMain.handle('lessonPlan:exportMarkdown', (_e, id) =>
    tryRunAsync(() => lessonPlanService.exportMarkdown(id))
  )
  ipcMain.handle('lessonPlan:exportPdf', (_e, id) =>
    tryRunAsync(() => lessonPlanService.exportPdf(id))
  )
  ipcMain.handle('lessonPlan:prepOverview', () =>
    tryRun(() => lessonPlanService.buildPrepOverview())
  )
  ipcMain.handle('lessonPlan:review', async (e, planId) =>
    tryRunAsync(async () => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? getMainWindow()
      const full = await lessonPlanService.reviewPlan(planId, (delta) => {
        win?.webContents.send('lessonPlan:reviewChunk', delta)
      })
      win?.webContents.send('lessonPlan:reviewChunk', '[DONE]')
      return full
    })
  )

  // ============ 教案模板（用户自定义） ============
  ipcMain.handle('lessonPlanTemplate:list', () => tryRun(() => lessonPlanTemplateRepo.list()))
  ipcMain.handle('lessonPlanTemplate:create', (_e, input) =>
    tryRun(() => lessonPlanTemplateRepo.create(input))
  )
  ipcMain.handle('lessonPlanTemplate:update', (_e, id, input) =>
    tryRun(() => lessonPlanTemplateRepo.update(id, input))
  )
  ipcMain.handle('lessonPlanTemplate:remove', (_e, id) =>
    tryRun(() => lessonPlanTemplateRepo.remove(id))
  )

  // ============ 待办 ============
  ipcMain.handle('todo:list', () => tryRun(() => todoRepo.list()))
  ipcMain.handle('todo:create', (_e, input) => tryRun(() => todoRepo.create(input)))
  ipcMain.handle('todo:update', (_e, id, input) => tryRun(() => todoRepo.update(id, input)))
  ipcMain.handle('todo:remove', (_e, id) => tryRun(() => todoRepo.remove(id)))
  ipcMain.handle('todo:regenerate', () => tryRun(() => todoService.regenerateAutoTodos()))

  // ============ 资源库 ============
  ipcMain.handle('resource:list', (_e, q) => tryRun(() => resourceRepo.list(q)))
  ipcMain.handle('resource:create', (_e, input) => tryRun(() => resourceRepo.create(input)))
  ipcMain.handle('resource:update', (_e, id, input) => tryRun(() => resourceRepo.update(id, input)))
  ipcMain.handle('resource:remove', (_e, id) => tryRun(() => resourceRepo.remove(id)))
  ipcMain.handle('resource:allTags', () => tryRun(() => resourceRepo.allTags()))
  ipcMain.handle('resource:importFile', async (_e, filePath, type) =>
    tryRunAsync(async () => {
      const { name, filePath: dest } = await fileService.importResourceFile(filePath, type)
      return resourceRepo.create({ name, type, filePath: dest })
    })
  )
  ipcMain.handle('resource:readFile', (_e, filePath) => tryRun(() => fileService.readFileAsDataUrl(filePath)))

  // ============ 反馈/报告 ============
  ipcMain.handle('feedback:list', (_e, q) => tryRun(() => feedbackRepo.list(q)))
  ipcMain.handle('feedback:get', (_e, id) => tryRun(() => feedbackRepo.get(id)))
  ipcMain.handle('feedback:save', (_e, input) => tryRun(() => feedbackRepo.save(input)))
  ipcMain.handle('feedback:remove', (_e, id) => tryRun(() => feedbackRepo.remove(id)))
  ipcMain.handle('feedback:generate', async (e, lessonId) =>
    tryRunAsync(async () => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? getMainWindow()
      const full = await feedbackService.generateWeekly(lessonId, (delta) => {
        win?.webContents.send('feedback:chunk', delta)
      })
      win?.webContents.send('feedback:chunk', '[DONE]')
      lessonRepo.setFeedbackSent(lessonId)
      return full
    })
  )
  ipcMain.handle('feedback:generateReport', async (_e, q) =>
    tryRunAsync(async () => {
      const cls = classRepo.get(q.classId)
      const className = cls?.name ?? ''
      const lessons = lessonRepo.list({ classId: q.classId, from: q.from, to: q.to })
      const members = classRepo.members(q.classId)
      const students = members.map((m) => {
        const stats = db()
          .prepare(
            `SELECT
               COALESCE(SUM(CASE WHEN r.is_picked=1 THEN 1 ELSE 0 END),0) as picked,
               COUNT(DISTINCT r.lesson_id) as lessons
             FROM lesson_records r
             JOIN lessons l ON l.id = r.lesson_id
             WHERE l.class_id = ? AND r.student_id = ?
               AND l.start_time >= ? AND l.start_time <= ?`
          )
          .get(q.classId, m.id, q.from, q.to) as { picked: number; lessons: number }
        return {
          name: m.name,
          avatar: m.avatarPath,
          totalScore: classRepo.getTotalScore(q.classId, m.id),
          pickedCount: stats.picked,
          lessonCount: stats.lessons
        }
      })
      const html = feedbackService.buildReportHtml({
        className,
        from: q.from,
        to: q.to,
        students,
        lessonCount: lessons.length
      })
      const outDir = join(app.getPath('userData'), 'exports')
      const pdfPath = await pdfService.renderHtmlToPdf(html, outDir, `季度报告-${className}`)
      return { html, pdfPath }
    })
  )
  ipcMain.handle('feedback:exportPdf', async (_e, feedbackId) =>
    tryRunAsync(async () => {
      const fb = feedbackRepo.get(feedbackId)
      if (!fb) throw new Error('反馈不存在')
      const html = pdfService.wrapContentHtml(
        `教学反馈 - ${fb.periodStart.slice(0, 10)}`,
        fb.content || fb.aiReport || ''
      )
      const outDir = join(app.getPath('userData'), 'exports')
      return pdfService.renderHtmlToPdf(html, outDir, '教学反馈')
    })
  )
  ipcMain.handle('feedback:sendWeChat', async (_e, feedbackId) =>
    tryRunAsync(async () => {
      const fb = feedbackRepo.get(feedbackId)
      if (!fb) throw new Error('反馈不存在')
      const res = await wechatService.sendToWeChat({ text: fb.content || fb.aiReport || '' })
      if (res.ok) feedbackRepo.markSent(feedbackId, '企业微信')
      return res
    })
  )

  // ============ 反馈模板 ============
  ipcMain.handle('feedbackTemplate:list', (_e, q) => tryRun(() => feedbackTemplateRepo.list(q)))
  ipcMain.handle('feedbackTemplate:create', (_e, input) => tryRun(() => feedbackTemplateRepo.create(input)))
  ipcMain.handle('feedbackTemplate:update', (_e, id, input) => tryRun(() => feedbackTemplateRepo.update(id, input)))
  ipcMain.handle('feedbackTemplate:remove', (_e, id) => tryRun(() => feedbackTemplateRepo.remove(id)))

  // ============ AI 课表导入 ============
  ipcMain.handle('schedule:parseText', async (_e, text) =>
    tryRunAsync(() => scheduleService.parseText(text))
  )
  ipcMain.handle('schedule:parseImage', async (_e, imagePath) =>
    tryRunAsync(() => scheduleService.parseImage(imagePath))
  )
  ipcMain.handle('schedule:import', async (_e, result) =>
    tryRun(() => scheduleService.importResult(result))
  )

  // ============ 设置 ============
  ipcMain.handle('settings:get', () => tryRun(() => settingsRepo.getAll()))
  ipcMain.handle('settings:saveAI', (_e, s) => tryRun(() => { settingsRepo.setAI(s); return s }))
  ipcMain.handle('settings:saveSync', (_e, s) => tryRun(() => { settingsRepo.setSync(s); return s }))
  ipcMain.handle('settings:saveWeChat', (_e, s) => tryRun(() => { settingsRepo.setWeChat(s); return s }))
  ipcMain.handle('settings:saveScratch', (_e, s) => tryRun(() => { settingsRepo.setScratch(s); return s }))
  ipcMain.handle('settings:testAI', async () =>
    tryRunAsync(async () => {
      const s = resolveAISettings()
      if (!s) return { ok: false, message: 'AI 未配置' }
      try {
        const r = await invokeAI(s, [{ role: 'user', content: '你好，请回复 OK' }], 0.1, 15_000)
        return { ok: true, message: r ? `连接成功：${r.slice(0, 20)}` : '连接成功' }
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) }
      }
    })
  )
  ipcMain.handle('settings:testSync', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? getMainWindow()
    return tryRunAsync(() =>
      syncService.testConnection((status) => win?.webContents.send('sync:status', status))
    )
  })
  ipcMain.handle('settings:syncNow', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? getMainWindow()
    return tryRunAsync(() =>
      syncService.syncNow((status) => win?.webContents.send('sync:status', status))
    )
  })

  // ============ 仪表盘 ============
  ipcMain.handle('dashboard:get', () => tryRun(() => todoService.buildDashboard()))

  // ============ 数据备份 ============
  ipcMain.handle('data:export', () => tryRun(() => dataService.exportAll()))
  ipcMain.handle('data:saveExportToFile', (_e, json) =>
    tryRunAsync(async () => dataService.saveExportToFile(json))
  )
  ipcMain.handle('data:pickImportFile', async () => tryRunAsync(async () => dataService.pickImportFile()))
  ipcMain.handle('data:importFromFile', (_e, filePath) =>
    tryRunAsync(async () => dataService.importFromFile(filePath))
  )

  // ============ 学生学习历史 ============
  ipcMain.handle('studentHistory:get', (_e, studentId) => tryRun(() => historyService.getStudentHistory(studentId)))

  // ============ Scratch ============
  ipcMain.handle('scratch:launch', async (_e, versionId) =>
    tryRunAsync(() => scratchService.launch(versionId))
  )
  ipcMain.handle('scratch:close', () => tryRun(() => scratchService.close()))
  ipcMain.handle('scratch:saveToIdea', async (_e, payload, target) =>
    tryRunAsync(() => scratchService.saveToIdea(payload, target))
  )
  ipcMain.handle('scratch:saveToResource', async (_e, payload, type) =>
    tryRunAsync(() => scratchService.saveToResource(payload, type))
  )
  ipcMain.handle('scratch:pickResourceFile', async () =>
    tryRunAsync(async () => {
      const p = await fileService.pickResourceFile()
      if (!p) throw new Error('取消选择')
      // 按扩展名推断类型，导入并创建资源记录
      const ext = p.toLowerCase().split('.').pop() || ''
      const type: Resource['type'] = ext === 'wav' || ext === 'mp3' ? 'sound' : 'sprite'
      const { name, filePath } = await fileService.importResourceFile(p, type)
      return resourceRepo.create({ name, type, filePath, tags: [] })
    })
  )

  // ============ 文档中心 ============
  ipcMain.handle('doc:openUrl', async (_e, url) =>
    tryRunAsync(async () => {
      const { shell } = await import('electron')
      await shell.openExternal(url)
    })
  )
  ipcMain.handle('doc:linkToLesson', (_e, lessonId, url, title) =>
    tryRun(() => docRepo.link(lessonId, url, title))
  )
  ipcMain.handle('doc:listLinks', (_e, lessonId) => tryRun(() => docRepo.listByLesson(lessonId)))
  ipcMain.handle('doc:listAll', () => tryRun(() => docRepo.listAll()))
  ipcMain.handle('doc:removeLink', (_e, id) => tryRun(() => docRepo.remove(id)))
  // G17: 教案级文档挂载
  ipcMain.handle('doc:listByPlan', (_e, planId) => tryRun(() => docRepo.listByPlan(planId)))
  ipcMain.handle('doc:linkToPlan', (_e, planId, url, title) =>
    tryRun(() => docRepo.linkPlan(planId, url, title))
  )

  // ============ 文件 ============
  ipcMain.handle('file:pickImage', async () =>
    tryRunAsync(async () => {
      const p = await fileService.pickImage()
      if (!p) throw new Error('取消选择')
      return p
    })
  )
  ipcMain.handle('file:saveAvatar', async (_e, src, name) => tryRunAsync(() => fileService.saveAvatar(src, name)))
  ipcMain.handle('file:readImageBase64', (_e, path) => tryRun(() => fileService.readImageBase64(path)))
}
