import { app, BrowserWindow, shell, Menu, dialog } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { join } from 'path'
import { initDatabase, closeDatabase } from './database/db'
import { registerIpc } from './ipc'
import { registerScratchIpc, setMainWindow, close as closeScratch } from './services/scratch'
import { regenerateAutoTodos } from './services/todos'
import { getSync } from './database/repositories/settings'
import { syncNow } from './services/sync'
import { initLogger, getLogger } from './services/logger'
import { buildAppMenu } from './menu'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  // 开发环境使用本地图标，打包后由 electron-builder 注入图标
  const iconPath = app.isPackaged ? undefined : join(__dirname, '../../build/icon.png')
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'Scratch 教学工作台',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 渲染进程崩溃时记录日志
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    getLogger().error('renderer', '渲染进程崩溃', { details })
  })

  // 开发环境加载 dev server，生产环境加载打包文件
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// 全局异常捕获（必须在 app ready 之前注册）
process.on('uncaughtException', (err) => {
  try {
    getLogger().error('main', '未捕获异常', { error: err })
  } catch {
    console.error('未捕获异常（logger 未就绪）:', err)
  }
})
process.on('unhandledRejection', (reason) => {
  try {
    getLogger().error('main', '未处理的 Promise 拒绝', { reason })
  } catch {
    console.error('未处理的 Promise 拒绝（logger 未就绪）:', reason)
  }
})

app.whenReady().then(() => {
  // 初始化日志
  initLogger(process.env.NODE_ENV === 'development' ? 'debug' : 'info')
  const log = getLogger()
  log.info('app', '应用启动', { version: app.getVersion(), platform: process.platform })

  // 初始化数据库
  const dbPath = join(app.getPath('userData'), 'workbench.db')
  let dbReady = true
  try {
    initDatabase(dbPath)
    log.info('db', '数据库已初始化', { path: dbPath })
  } catch (e) {
    dbReady = false
    log.error('db', '数据库初始化失败', { error: e })
    dialog.showErrorBox(
      '数据库初始化失败',
      `应用无法初始化数据库，可能原生模块加载失败。\n\n错误信息：${e instanceof Error ? e.message : String(e)}\n\n应用将继续启动，但部分功能可能不可用。`
    )
  }

  // 应用基础设置
  electronApp.setAppUserModelId('com.icedcoke23.workbench')
  Menu.setApplicationMenu(buildAppMenu(() => mainWindow))

  // 注册 IPC
  registerIpc(() => mainWindow)
  registerScratchIpc()

  const win = createWindow()
  setMainWindow(win)
  optimizer.watchWindowShortcuts(win)

  // 启动时自动生成待办
  if (dbReady) {
    try {
      regenerateAutoTodos()
    } catch (e) {
      log.error('app', '生成待办失败', { error: e })
    }

    // 启动时若开启自动同步，后台执行一次
    const sync = getSync()
    if (sync.enabled && sync.autoSync) {
      syncNow().catch((e) => log.error('sync', '启动同步失败', { error: e }))
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  setMainWindow(null)
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // 关闭 Scratch 编辑器子窗口，避免残留进程
  try {
    closeScratch()
  } catch {
    // 忽略关闭错误
  }
  closeDatabase()
})
