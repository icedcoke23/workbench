import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { MenuAction, ViewName } from '@shared/types'

/**
 * 菜单 / 快捷键动作处理器映射
 * 渲染进程注册各动作的回调，由主进程菜单触发
 */
export interface ShortcutHandlers {
  onNavigate?: (view: ViewName) => void
  onToggleSidebar?: () => void
  onNewItem?: () => void
  onRefresh?: () => void
  onExportData?: () => void
  onImportData?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
}

/**
 * 菜单快捷键 composable
 *
 * 监听主进程通过菜单加速器触发的 `menu:action` 事件，
 * 分发到传入的处理器。导航类动作默认走 vue-router。
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const router = useRouter()

  const handleAction = (action: MenuAction): void => {
    switch (action.type) {
      case 'navigate':
        if (handlers.onNavigate) {
          handlers.onNavigate(action.view)
        } else {
          router.push({ name: action.view }).catch(() => {})
        }
        break
      case 'toggle-sidebar':
        handlers.onToggleSidebar?.()
        break
      case 'new-item':
        handlers.onNewItem?.()
        break
      case 'refresh':
        handlers.onRefresh?.()
        break
      case 'export-data':
        handlers.onExportData?.()
        break
      case 'import-data':
        handlers.onImportData?.()
        break
      case 'zoom-in':
        handlers.onZoomIn?.()
        break
      case 'zoom-out':
        handlers.onZoomOut?.()
        break
      case 'zoom-reset':
        handlers.onZoomReset?.()
        break
      // reload / toggle-devtools / about 由主进程直接处理，不会到达渲染进程
      default:
        break
    }
  }

  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    unsubscribe = window.events['menu:action'](handleAction)
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  })
}

/**
 * 视图刷新事件总线
 * 允许任意视图订阅 refresh 动作，由当前激活的视图响应
 */
const refreshListeners = new Set<() => void>()

export function subscribeRefresh(fn: () => void): () => void {
  refreshListeners.add(fn)
  return () => {
    refreshListeners.delete(fn)
  }
}

export function triggerRefresh(): void {
  refreshListeners.forEach((fn) => {
    try {
      fn()
    } catch (e) {
      console.error('refresh handler error:', e)
    }
  })
}

/**
 * 新增事件总线
 * 允许任意视图订阅 new-item 动作
 */
const newItemListeners = new Set<() => void>()

export function subscribeNewItem(fn: () => void): () => void {
  newItemListeners.add(fn)
  return () => {
    newItemListeners.delete(fn)
  }
}

export function triggerNewItem(): void {
  newItemListeners.forEach((fn) => {
    try {
      fn()
    } catch (e) {
      console.error('new-item handler error:', e)
    }
  })
}
