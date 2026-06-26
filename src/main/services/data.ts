import { app, dialog } from 'electron'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { db } from '../database/db'

/** 需要导出的表清单（顺序尽量按依赖关系） */
const EXPORT_TABLES = [
  'students',
  'classes',
  'enrollments',
  'ideas',
  'idea_versions',
  'lessons',
  'lesson_records',
  'todos',
  'resources',
  'feedbacks',
  'feedback_templates',
  'doc_links',
  'settings',
  'sync_state'
] as const

interface ExportPayload {
  version: number
  exportedAt: string
  appVersion: string
  tables: Record<string, unknown[]>
}

/** 导出全部业务数据为 JSON 字符串 */
export function exportAll(): string {
  const conn = db()
  const tables: Record<string, unknown[]> = {}
  for (const t of EXPORT_TABLES) {
    tables[t] = conn.prepare(`SELECT * FROM ${t}`).all() as unknown[]
  }
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    tables
  }
  return JSON.stringify(payload, null, 2)
}

/** 将导出 JSON 写入用户选择的文件 */
export async function saveExportToFile(json: string): Promise<string> {
  const defaultName = `workbench-backup-${new Date().toISOString().slice(0, 10)}.json`
  const res = await dialog.showSaveDialog({
    title: '选择备份文件保存位置',
    defaultPath: defaultName,
    filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
  })
  if (res.canceled || !res.filePath) throw new Error('用户取消选择')
  writeFileSync(res.filePath, json, 'utf-8')
  return res.filePath
}

/** 弹出文件选择对话框，让用户选择导入文件 */
export async function pickImportFile(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: '选择要导入的备份文件',
    properties: ['openFile'],
    filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
  })
  if (res.canceled || res.filePaths.length === 0) return null
  return res.filePaths[0]
}

/** 从备份文件导入数据（覆盖现有数据） */
export function importFromFile(filePath: string): { tables: number; rows: number } {
  if (!existsSync(filePath)) throw new Error('文件不存在：' + filePath)
  const raw = readFileSync(filePath, 'utf-8')
  let payload: ExportPayload
  try {
    payload = JSON.parse(raw) as ExportPayload
  } catch (e) {
    throw new Error('文件解析失败：' + (e instanceof Error ? e.message : String(e)))
  }
  if (!payload.tables) throw new Error('备份文件格式不正确')

  const conn = db()
  const tx = conn.transaction(() => {
    // 先清空再导入（注意外键顺序：先删依赖方）
    const deleteOrder = [...EXPORT_TABLES].reverse()
    for (const t of deleteOrder) {
      conn.exec(`DELETE FROM ${t}`)
    }
    let tables = 0
    let rows = 0
    for (const t of EXPORT_TABLES) {
      const data = payload.tables[t]
      if (!data || data.length === 0) continue
      tables++
      // 动态获取列名
      const firstRow = data[0] as Record<string, unknown>
      const cols = Object.keys(firstRow)
      const placeholders = cols.map(() => '?').join(', ')
      const sql = `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`
      const stmt = conn.prepare(sql)
      for (const row of data) {
        const r = row as Record<string, unknown>
        stmt.run(...cols.map((c) => r[c]))
        rows++
      }
    }
    return { tables, rows }
  })
  return tx()
}

/** 获取默认导出目录路径（用于自动备份） */
export function defaultExportDir(): string {
  return join(app.getPath('userData'), 'backups')
}
