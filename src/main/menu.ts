import { app, Menu, type BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import type { MenuAction, ViewName } from '@shared/types'
import { getLogger } from './services/logger'

/** 向渲染进程发送菜单动作（窗口存在且未销毁时） */
function sendAction(win: BrowserWindow | null, action: MenuAction): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu:action', action)
  }
}

/** 导航菜单项：7 个主视图，含快捷键（CmdOrCtrl 跨平台适配） */
const NAV_ITEMS: Array<{ label: string; view: ViewName; accelerator: string }> = [
  { label: '工作看板', view: 'dashboard', accelerator: 'CmdOrCtrl+1' },
  { label: '学生管理', view: 'students', accelerator: 'CmdOrCtrl+2' },
  { label: '班级管理', view: 'classes', accelerator: 'CmdOrCtrl+3' },
  { label: '备课中心', view: 'prep', accelerator: 'CmdOrCtrl+4' },
  { label: '授课中心', view: 'teaching', accelerator: 'CmdOrCtrl+5' },
  { label: '课后中心', view: 'post', accelerator: 'CmdOrCtrl+6' },
  { label: '设置', view: 'settings', accelerator: 'CmdOrCtrl+7' }
]

/**
 * 构建应用菜单：文件 / 编辑 / 视图 / 导航 / 帮助
 * @param getWindow 获取主窗口的函数（窗口可能在生命周期内变化）
 */
export function buildAppMenu(getWindow: () => BrowserWindow | null): Menu {
  const isDev = !app.isPackaged

  const template: Electron.MenuItemConstructorOptions[] = [
    // ============ 文件菜单 ============
    {
      label: '文件',
      submenu: [
        {
          label: '新增',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendAction(getWindow(), { type: 'new-item' })
        },
        { type: 'separator' },
        {
          label: '导出数据',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendAction(getWindow(), { type: 'export-data' })
        },
        {
          label: '导入数据',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendAction(getWindow(), { type: 'import-data' })
        },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    // ============ 编辑菜单 ============
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    // ============ 视图菜单 ============
    {
      label: '视图',
      submenu: [
        {
          label: '刷新当前视图',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendAction(getWindow(), { type: 'refresh' })
        },
        {
          label: '折叠/展开侧栏',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendAction(getWindow(), { type: 'toggle-sidebar' })
        },
        { type: 'separator' },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendAction(getWindow(), { type: 'zoom-in' })
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendAction(getWindow(), { type: 'zoom-out' })
        },
        {
          label: '重置缩放',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendAction(getWindow(), { type: 'zoom-reset' })
        },
        { type: 'separator' },
        {
          label: '重载窗口',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            const win = getWindow()
            if (win && !win.isDestroyed()) win.reload()
          }
        },
        // 开发者工具仅在开发环境显示（用 F12 避免与"导入数据"快捷键冲突）
        ...(isDev
          ? [
              {
                label: '开发者工具',
                accelerator: 'F12',
                click: () => {
                  const win = getWindow()
                  if (win && !win.isDestroyed()) win.webContents.toggleDevTools()
                }
              }
            ]
          : [])
      ]
    },
    // ============ 导航菜单 ============
    {
      label: '导航',
      submenu: NAV_ITEMS.map((item) => ({
        label: item.label,
        accelerator: item.accelerator,
        click: () => sendAction(getWindow(), { type: 'navigate', view: item.view })
      }))
    },
    // ============ 帮助菜单 ============
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog
              .showMessageBox({
                type: 'info',
                title: '关于',
                message: 'Scratch 教学工作台',
                detail: [
                  `版本：${app.getVersion()}`,
                  `Electron：${process.versions.electron}`,
                  `Chrome：${process.versions.chrome}`,
                  `Node：${process.versions.node}`,
                  `平台：${process.platform}`,
                  '作者：icedcoke23',
                  '许可：MIT'
                ].join('\n')
              })
              .catch((e) => getLogger().error('menu', '显示关于对话框失败', { error: e }))
          }
        },
        {
          label: '打开日志目录',
          click: () => {
            // 打开 userData/logs 子目录（日志文件实际存放位置）
            shell
              .openPath(join(app.getPath('userData'), 'logs'))
              .then((err) => {
                if (err) {
                  getLogger().error('menu', '打开日志目录失败', { error: err })
                }
              })
              .catch((e) => getLogger().error('menu', '打开日志目录失败', { error: e }))
          }
        },
        { type: 'separator' },
        {
          label: 'GitHub 仓库',
          click: () => {
            shell
              .openExternal('https://github.com/icedcoke23/workbench')
              .catch((e) => getLogger().error('menu', '打开 GitHub 仓库失败', { error: e }))
          }
        }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}
