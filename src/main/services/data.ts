import { app, dialog } from 'electron'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { db } from '../database/db'
import { getLogger } from './logger'

// 按依赖顺序列出所有需要导出/导入的表（被依赖方在前）
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
  'doc_links',
  'feedback_templates',
  'settings',
  'sync_state'
] as const

interface ExportPayload {
  version: number
  exportedAt: string
  appVersion: string
  tables: Record<string, Record<string, unknown>[]>
}

/** 导出全部数据为 JSON 字符串 */
export function exportAll(): string {
  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const table of EXPORT_TABLES) {
    tables[table] = db().prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
  }
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    tables
  }
  getLogger().info('data', '数据导出完成', { tables: EXPORT_TABLES.length })
  return JSON.stringify(payload, null, 2)
}

/** 让用户选择保存位置并写入备份文件，返回保存路径或 null（用户取消） */
export async function saveExportToFile(json: string): Promise<string | null> {
  const fileName = `workbench-backup-${formatToday()}.json`
  const res = await dialog.showSaveDialog({
    title: '导出数据备份',
    defaultPath: join(app.getPath('documents'), fileName),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (res.canceled || !res.filePath) return null
  writeFileSync(res.filePath, json, 'utf8')
  getLogger().info('data', '备份文件已保存', { path: res.filePath })
  return res.filePath
}

/** 让用户选择要导入的 JSON 文件，返回路径或 null（用户取消） */
export async function pickImportFile(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: '选择备份文件',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (res.canceled || res.filePaths.length === 0) return null
  return res.filePaths[0]
}

/**
 * 从文件导入数据：在一个事务中按反向顺序清空表，再按正向顺序 INSERT OR REPLACE。
 * 事务失败自动回滚。返回 { tables: 涉及表数, rows: 总行数 }
 */
export function importFromFile(filePath: string): { tables: number; rows: number } {
  if (!existsSync(filePath)) {
    throw new Error(`备份文件不存在: ${filePath}`)
  }
  const raw = readFileSync(filePath, 'utf8')
  const payload = JSON.parse(raw) as ExportPayload
  const tables = payload.tables ?? {}

  let tableCount = 0
  let rowCount = 0
  const conn = db()
  const importTx = conn.transaction(() => {
    // 反向顺序清空（先清依赖方，再清被依赖方）
    for (let i = EXPORT_TABLES.length - 1; i >= 0; i--) {
      conn.prepare(`DELETE FROM ${EXPORT_TABLES[i]}`).run()
    }
    // 正向顺序插入（先插被依赖方，再插依赖方）
    for (const table of EXPORT_TABLES) {
      const rows = tables[table]
      if (!rows || rows.length === 0) continue
      // 从首行取列名，构造动态 INSERT OR REPLACE
      const first = rows[0] as Record<string, unknown>
      const cols = Object.keys(first)
      if (cols.length === 0) continue
      const placeholders = cols.map(() => '?').join(', ')
      const stmt = conn.prepare(
        `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
      )
      for (const row of rows) {
        const r = row as Record<string, unknown>
        stmt.run(...cols.map((c) => r[c]))
        rowCount++
      }
      tableCount++
    }
  })
  importTx()
  getLogger().info('data', '数据导入完成', { tables: tableCount, rows: rowCount })
  return { tables: tableCount, rows: rowCount }
}

/** 生成 YYYYMMDD 格式日期字符串（用于备份文件名） */
function formatToday(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}
