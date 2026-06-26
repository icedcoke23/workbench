import { app, Menu, BrowserWindow, dialog, shell } from 'electron'
import type { MenuAction, ViewName } from '@shared/types'
import { getLogger } from './services/logger'

/**
 * 向渲染进程发送菜单动作
 */
function sendAction(win: BrowserWindow | null, action: MenuAction): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu:action', action)
  }
}

/**
 * 视图列表（用于导航菜单）
 */
const NAV_ITEMS: Array<{ label: string; view: ViewName; accelerator: string }> = [
  { label: '工作看板', view: 'dashboard', accelerator: 'CommandOrControl+1' },
  { label: '学生管理', view: 'students', accelerator: 'CommandOrControl+2' },
  { label: '班级管理', view: 'classes', accelerator: 'CommandOrControl+3' },
  { label: '备课中心', view: 'prep', accelerator: 'CommandOrControl+4' },
  { label: '授课中心', view: 'teaching', accelerator: 'CommandOrControl+5' },
  { label: '课后中心', view: 'post', accelerator: 'CommandOrControl+6' },
  { label: '设置', view: 'settings', accelerator: 'CommandOrControl+7' }
]

/**
 * 构建应用菜单（含快捷键加速器）
 * @param getWindow 获取当前主窗口的函数
 */
export function buildAppMenu(getWindow: () => BrowserWindow | null): Menu {
  const isDev = !app.isPackaged

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新增',
          accelerator: 'CommandOrControl+N',
          click: () => sendAction(getWindow(), { type: 'new-item' })
        },
        { type: 'separator' },
        {
          label: '导出数据...',
          accelerator: 'CommandOrControl+Shift+E',
          click: () => sendAction(getWindow(), { type: 'export-data' })
        },
        {
          label: '导入数据...',
          accelerator: 'CommandOrControl+Shift+I',
          click: () => sendAction(getWindow(), { type: 'import-data' })
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CommandOrControl+Q',
          role: 'quit'
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo', accelerator: 'CommandOrControl+Z' },
        { label: '重做', role: 'redo', accelerator: 'CommandOrControl+Shift+Z' },
        { type: 'separator' },
        { label: '剪切', role: 'cut', accelerator: 'CommandOrControl+X' },
        { label: '复制', role: 'copy', accelerator: 'CommandOrControl+C' },
        { label: '粘贴', role: 'paste', accelerator: 'CommandOrControl+V' },
        { label: '全选', role: 'selectAll', accelerator: 'CommandOrControl+A' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '刷新当前视图',
          accelerator: 'CommandOrControl+R',
          click: () => sendAction(getWindow(), { type: 'refresh' })
        },
        {
          label: '折叠/展开侧栏',
          accelerator: 'CommandOrControl+B',
          click: () => sendAction(getWindow(), { type: 'toggle-sidebar' })
        },
        { type: 'separator' },
        {
          label: '放大',
          accelerator: 'CommandOrControl+=',
          click: () => sendAction(getWindow(), { type: 'zoom-in' })
        },
        {
          label: '缩小',
          accelerator: 'CommandOrControl+-',
          click: () => sendAction(getWindow(), { type: 'zoom-out' })
        },
        {
          label: '重置缩放',
          accelerator: 'CommandOrControl+0',
          click: () => sendAction(getWindow(), { type: 'zoom-reset' })
        },
        { type: 'separator' },
        {
          label: '重载窗口',
          accelerator: 'CommandOrControl+Shift+R',
          click: () => {
            const win = getWindow()
            if (win) win.reload()
          }
        },
        ...(isDev
          ? [
              {
                label: '开发者工具',
                accelerator: 'CommandOrControl+Shift+I',
                click: () => {
                  const win = getWindow()
                  if (win) win.webContents.toggleDevTools()
                }
              } as Electron.MenuItemConstructorOptions
            ]
          : [])
      ]
    },
    {
      label: '导航',
      submenu: NAV_ITEMS.map((item) => ({
        label: item.label,
        accelerator: item.accelerator,
        click: () => sendAction(getWindow(), { type: 'navigate', view: item.view })
      }))
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 Scratch 教学工作台',
          click: () => {
            const log = getLogger()
            log.info('menu', '打开关于对话框')
            dialog
              .showMessageBox({
                type: 'info',
                title: '关于',
                message: 'Scratch 教学工作台',
                detail: [
                  `版本：${app.getVersion()}`,
                  `Electron：${process.versions.electron}`,
                  `Chrome：${process.versions.chrome}`,
                  `Node.js：${process.versions.node}`,
                  `平台：${process.platform} ${process.arch}`,
                  '',
                  '作者：icedcoke23',
                  '许可：MIT'
                ].join('\n'),
                buttons: ['确定']
              })
              .catch((e) => log.error('menu', '显示关于对话框失败', e))
          }
        },
        {
          label: '打开日志目录',
          click: () => {
            const logPath = app.getPath('userData')
            shell.openPath(logPath).catch(() => {})
          }
        },
        { type: 'separator' },
        {
          label: 'GitHub 仓库',
          click: () => {
            shell.openExternal('https://github.com/icedcoke23/workbench').catch(() => {})
          }
        }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}
