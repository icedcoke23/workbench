import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { API_METHODS } from '@shared/api'

// 预加载脚本：通过 contextBridge 暴露类型安全的 API 给渲染进程
// 通道命名规则：${domain}:${method}
//
// 注意：contextBridge 不支持 Proxy/Symbol/WeakMap 等元编程特性，
// 必须使用显式的方法定义（普通函数），否则 exposeInMainWorld 会抛出异常，
// 导致 window.api 为 undefined。

// 为每个命名空间的每个方法创建显式函数，避免使用 Proxy
const api: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>> = {}
for (const [ns, methods] of Object.entries(API_METHODS)) {
  api[ns] = {}
  for (const method of methods) {
    const channel = `${ns}:${method}`
    api[ns][method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }
}

// 事件监听（主 -> 渲染）
const events = {
  'scratch:save-request': (cb: (payload: unknown) => void) => {
    const listener = (_e: IpcRendererEvent, payload: unknown) => cb(payload)
    ipcRenderer.on('scratch:save-request', listener)
    return () => ipcRenderer.removeListener('scratch:save-request', listener)
  },
  'feedback:chunk': (cb: (delta: string) => void) => {
    const listener = (_e: IpcRendererEvent, delta: string) => cb(delta)
    ipcRenderer.on('feedback:chunk', listener)
    return () => ipcRenderer.removeListener('feedback:chunk', listener)
  },
  'sync:status': (cb: (status: unknown) => void) => {
    const listener = (_e: IpcRendererEvent, status: unknown) => cb(status)
    ipcRenderer.on('sync:status', listener)
    return () => ipcRenderer.removeListener('sync:status', listener)
  },
  'menu:action': (cb: (action: unknown) => void) => {
    const listener = (_e: IpcRendererEvent, action: unknown) => cb(action)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('events', events)
contextBridge.exposeInMainWorld('platform', process.platform)
