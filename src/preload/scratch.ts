import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// 注入到 Scratch GUI 窗口的桥接 API
// 魔改后的 scratch-gui 在保存/请求资源时调用本接口
contextBridge.exposeInMainWorld('scratchBridge', {
  // 保存：将项目 JSON 发送给主进程归档
  saveProject: (projectJson: unknown, fileName?: string) =>
    ipcRenderer.send('scratch:save', { projectJson, fileName }),
  // 请求本地资源库列表
  requestResources: () => ipcRenderer.send('scratch:request-resources'),
  // 接收资源列表
  onResources: (cb: (resources: unknown[]) => void) => {
    const listener = (_e: IpcRendererEvent, list: unknown[]) => cb(list)
    ipcRenderer.on('scratch:resources', listener)
    return () => ipcRenderer.removeListener('scratch:resources', listener)
  },
  // 接收待加载的项目（用于"开始创作"加载某版本）
  onLoadProject: (cb: (projectJson: unknown) => void) => {
    const listener = (_e: IpcRendererEvent, projectJson: unknown) => cb(projectJson)
    ipcRenderer.on('scratch:load-project', listener)
    return () => ipcRenderer.removeListener('scratch:load-project', listener)
  },
  // 读取本地资源文件为 base64（拖拽到舞台用）
  readResource: (filePath: string) =>
    ipcRenderer.invoke('scratch:read-resource', filePath)
})
