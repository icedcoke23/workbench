import { app, BrowserWindow, shell, Menu } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { join } from 'path'
import { initDatabase, closeDatabase } from './database/db'
import { registerIpc } from './ipc'
import { registerScratchIpc, setMainWindow } from './services/scratch'
import { regenerateAutoTodos } from './services/todos'
import { getSync } from './database/repositories/settings'
import { syncNow, setSyncWindow } from './services/sync'

let mainWindow: BrowserWindow | null = null
let syncTimer: NodeJS.Timeout | null = null

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'Scratch 教学工作台',
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

  // 开发环境加载 dev server，生产环境加载打包文件
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  // 初始化数据库
  const dbPath = join(app.getPath('userData'), 'workbench.db')
  initDatabase(dbPath)

  // 应用基础设置
  electronApp.setAppUserModelId('com.icedcoke23.workbench')
  Menu.setApplicationMenu(null)

  // 注册 IPC
  registerIpc(() => mainWindow)
  registerScratchIpc()

  const win = createWindow()
  setMainWindow(win)
  setSyncWindow(win)
  optimizer.watchWindowShortcuts(win)

  // 启动时自动生成待办
  try {
    regenerateAutoTodos()
  } catch (e) {
    console.error('生成待办失败', e)
  }

  // 启动时若开启自动同步，后台执行一次 + 定时同步（每 10 分钟）
  const sync = getSync()
  if (sync.enabled && sync.autoSync) {
    syncNow().catch((e) => console.error('启动同步失败', e))
    syncTimer = setInterval(() => {
      syncNow().catch((e) => console.error('定时同步失败', e))
    }, 10 * 60 * 1000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  setMainWindow(null)
  setSyncWindow(null)
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  closeDatabase()
})
