import { app } from 'electron'
import {
  appendFileSync,
  mkdirSync,
  existsSync,
  statSync,
  renameSync,
  readdirSync,
  unlinkSync
} from 'fs'
import { join } from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

class Logger {
  private logDir: string
  private currentLevel: LogLevel = 'info'
  private maxFileSize = 5 * 1024 * 1024 // 5MB 单文件上限
  private keepDays = 14

  constructor() {
    this.logDir = join(app.getPath('userData'), 'logs')
    if (!existsSync(this.logDir)) mkdirSync(this.logDir, { recursive: true })
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level
  }

  private getLogFile(): string {
    const today = new Date().toISOString().slice(0, 10)
    return join(this.logDir, `workbench-${today}.log`)
  }

  private rotateIfNeeded(file: string): void {
    try {
      if (!existsSync(file)) return
      const stat = statSync(file)
      if (stat.size >= this.maxFileSize) {
        const rotated = file.replace(/\.log$/, `-${Date.now()}.log`)
        renameSync(file, rotated)
      }
    } catch {
      // 轮转失败不影响主流程
    }
  }

  private write(level: LogLevel, tag: string, msg: string, extra?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.currentLevel]) return
    const time = new Date().toISOString()
    const line =
      `[${time}] [${level.toUpperCase()}] [${tag}] ${msg}` +
      (extra !== undefined ? ` ${safeStringify(extra)}` : '') +
      '\n'
    const file = this.getLogFile()
    this.rotateIfNeeded(file)
    try {
      appendFileSync(file, line, 'utf-8')
    } catch {
      // 写入失败不可恢复，静默
    }
    // 同步输出到控制台（开发可见）
    const consoleFn =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    consoleFn(line.trimEnd())
  }

  debug(tag: string, msg: string, extra?: unknown): void {
    this.write('debug', tag, msg, extra)
  }
  info(tag: string, msg: string, extra?: unknown): void {
    this.write('info', tag, msg, extra)
  }
  warn(tag: string, msg: string, extra?: unknown): void {
    this.write('warn', tag, msg, extra)
  }
  error(tag: string, msg: string, extra?: unknown): void {
    this.write('error', tag, msg, extra)
  }

  /** 清理过期日志文件 */
  purgeOldLogs(): void {
    try {
      const files = readdirSync(this.logDir).filter((f) => f.endsWith('.log'))
      const cutoff = Date.now() - this.keepDays * 24 * 3_600_000
      for (const f of files) {
        const full = join(this.logDir, f)
        const stat = statSync(full)
        if (stat.mtimeMs < cutoff) {
          unlinkSync(full)
        }
      }
    } catch {
      // ignore
    }
  }
}

function safeStringify(v: unknown): string {
  if (v instanceof Error) {
    return JSON.stringify({ name: v.name, message: v.message, stack: v.stack })
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

// 延迟初始化：app.getPath('userData') 必须在 app ready 后才能调用
let _logger: Logger | null = null

export function initLogger(level: LogLevel = 'info'): Logger {
  if (!_logger) {
    _logger = new Logger()
  }
  _logger.setLevel(level)
  _logger.purgeOldLogs()
  return _logger
}

export function getLogger(): Logger {
  if (!_logger) {
    // 兜底：在 initLogger 之前使用
    _logger = initLogger('info')
  }
  return _logger
}
