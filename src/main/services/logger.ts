import { mkdirSync, appendFileSync, readdirSync, unlinkSync, statSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// 日志级别与顺序（索引越大级别越高）
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error']

// 文件大小阈值：5MB 触发轮转
const MAX_SIZE = 5 * 1024 * 1024
// 旧日志保留天数
const RETAIN_DAYS = 14

type LogMeta = Record<string, unknown>

/** 日志格式化：[YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [scope] msg {meta JSON} */
function formatLine(level: LogLevel, scope: string, msg: string, meta?: LogMeta): string {
  const ts = timestamp()
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
  return `[${ts}] [${level.toUpperCase()}] [${scope}] ${msg}${metaStr}`
}

/** 生成 YYYY-MM-DD HH:mm:ss.SSS 格式时间戳 */
function timestamp(): string {
  const d = new Date()
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  return `${date} ${time}`
}

/** 生成 YYYY-MM-DD 格式日期字符串（用于日志文件名） */
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

/** 日志目录路径：userData/logs */
function logsDir(): string {
  return join(app.getPath('userData'), 'logs')
}

/** 当天日志文件路径 */
function currentLogFile(): string {
  return join(logsDir(), `workbench-${todayStr()}.log`)
}

/** 文件日志器：按级别写入文件并同步输出到控制台 */
class Logger {
  private level: LogLevel

  constructor(level: LogLevel) {
    this.level = level
  }

  /** 动态调整日志级别 */
  setLevel(level: LogLevel): void {
    this.level = level
  }

  debug(scope: string, msg: string, meta?: LogMeta): void {
    this.write('debug', scope, msg, meta)
  }

  info(scope: string, msg: string, meta?: LogMeta): void {
    this.write('info', scope, msg, meta)
  }

  warn(scope: string, msg: string, meta?: LogMeta): void {
    this.write('warn', scope, msg, meta)
  }

  error(scope: string, msg: string, meta?: LogMeta): void {
    this.write('error', scope, msg, meta)
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(this.level)
  }

  private write(level: LogLevel, scope: string, msg: string, meta?: LogMeta): void {
    if (!this.shouldLog(level)) return
    const line = formatLine(level, scope, msg, meta)
    // 同步输出到控制台
    if (level === 'error') {
      console.error(line)
    } else if (level === 'warn') {
      console.warn(line)
    } else {
      console.log(line)
    }
    // 写入文件
    try {
      const filePath = currentLogFile()
      appendFileSync(filePath, line + '\n', 'utf8')
      rotateIfNeeded(filePath)
    } catch (e) {
      // 文件写入失败时仅打印控制台，避免影响主流程
      console.error('日志写入文件失败', e)
    }
  }
}

/** 控制台兜底日志器：initLogger 之前使用，仅输出到 console，避免崩溃 */
class ConsoleLogger {
  debug(scope: string, msg: string, meta?: LogMeta): void {
    console.log(formatLine('debug', scope, msg, meta))
  }

  info(scope: string, msg: string, meta?: LogMeta): void {
    console.log(formatLine('info', scope, msg, meta))
  }

  warn(scope: string, msg: string, meta?: LogMeta): void {
    console.warn(formatLine('warn', scope, msg, meta))
  }

  error(scope: string, msg: string, meta?: LogMeta): void {
    console.error(formatLine('error', scope, msg, meta))
  }
}

/** 文件轮转：超过 5MB 则重命名为 .1.log（先删除已有的 .1.log） */
function rotateIfNeeded(filePath: string): void {
  try {
    const stat = statSync(filePath)
    if (stat.size <= MAX_SIZE) return
    const rotated = filePath.replace(/\.log$/, '.1.log')
    if (existsSync(rotated)) {
      unlinkSync(rotated)
    }
    renameSync(filePath, rotated)
  } catch {
    // 轮转失败忽略，下次写入会重新尝试
  }
}

/** 清理 14 天前的 .log 文件 */
function purgeOldLogs(): void {
  const dir = logsDir()
  if (!existsSync(dir)) return
  const cutoff = Date.now() - RETAIN_DAYS * 24 * 3_600_000
  let files: string[]
  try {
    files = readdirSync(dir)
  } catch {
    return
  }
  for (const f of files) {
    if (!f.endsWith('.log')) continue
    const full = join(dir, f)
    try {
      const stat = statSync(full)
      if (stat.mtimeMs < cutoff) {
        unlinkSync(full)
      }
    } catch {
      // 单个文件清理失败忽略
    }
  }
}

// 单例实例：未初始化时为 null，getLogger 返回控制台兜底日志器
let loggerInstance: Logger | null = null
const fallbackLogger = new ConsoleLogger()

/** 初始化日志器：创建日志目录、清理旧日志、设置级别 */
export function initLogger(level: LogLevel): Logger {
  mkdirSync(logsDir(), { recursive: true })
  purgeOldLogs()
  loggerInstance = new Logger(level)
  return loggerInstance
}

/** 获取日志器实例；initLogger 之前调用返回控制台兜底日志器 */
export function getLogger(): Logger | ConsoleLogger {
  return loggerInstance ?? fallbackLogger
}
