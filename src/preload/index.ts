import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { WorkbenchAPI, WorkbenchEvents } from '@shared/api'

// 预加载脚本：通过 contextBridge 暴露类型安全的 API 给渲染进程
// 通道命名规则：${domain}:${method}

const apiNamespaces: Array<keyof WorkbenchAPI> = [
  'student',
  'class',
  'lesson',
  'idea',
  'todo',
  'resource',
  'feedback',
  'feedbackTemplate',
  'schedule',
  'scratch',
  'settings',
  'dashboard',
  'data',
  'studentHistory',
  'doc',
  'file'
]

const api = {} as WorkbenchAPI

for (const ns of apiNamespaces) {
  const handler = {
    get(_target: unknown, method: string) {
      return (...args: unknown[]) => ipcRenderer.invoke(`${ns}:${method}`, ...args)
    }
  }
  api[ns] = new Proxy({} as never, handler) as never
}

// 事件监听（主 -> 渲染）
const events: WorkbenchEvents = {
  'scratch:save-request': (cb) => {
    const listener = (_e: IpcRendererEvent, payload: unknown) => cb(payload as never)
    ipcRenderer.on('scratch:save-request', listener)
    return () => ipcRenderer.removeListener('scratch:save-request', listener)
  },
  'feedback:chunk': (cb) => {
    const listener = (_e: IpcRendererEvent, delta: string) => cb(delta)
    ipcRenderer.on('feedback:chunk', listener)
    return () => ipcRenderer.removeListener('feedback:chunk', listener)
  },
  'sync:status': (cb) => {
    const listener = (_e: IpcRendererEvent, status: unknown) => cb(status as never)
    ipcRenderer.on('sync:status', listener)
    return () => ipcRenderer.removeListener('sync:status', listener)
  },
  'menu:action': (cb) => {
    const listener = (_e: IpcRendererEvent, action: unknown) => cb(action as never)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('events', events)
contextBridge.exposeInMainWorld('platform', process.platform)
