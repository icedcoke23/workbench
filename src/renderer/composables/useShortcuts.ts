import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { MenuAction, ViewName } from '@shared/types'

// 快捷键 / 菜单动作处理函数集合（均为可选）
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
 * 快捷键 composable：订阅主进程菜单动作并分发到对应处理函数。
 * navigate 动作若未提供 onNavigate，则默认通过 router.push 跳转。
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const router = useRouter()

  function handleAction(action: MenuAction): void {
    switch (action.type) {
      case 'navigate':
        // 导航动作：优先使用自定义处理，否则默认路由跳转
        if (handlers.onNavigate) handlers.onNavigate(action.view)
        else router.push({ name: action.view })
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
      default:
        // reload / toggle-devtools / about 等动作不在此处理
        break
    }
  }

  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    // 订阅菜单动作事件，保存取消订阅函数
    unsubscribe = window.events['menu:action'](handleAction)
  })

  onUnmounted(() => {
    unsubscribe?.()
    unsubscribe = null
  })
}

// ============ 模块级事件总线 ============
// 刷新监听集合：供各视图订阅，触发刷新时遍历调用
const refreshListeners = new Set<() => void>()

/** 订阅刷新事件，返回取消订阅函数 */
export function subscribeRefresh(fn: () => void): () => void {
  refreshListeners.add(fn)
  return () => refreshListeners.delete(fn)
}

/** 触发刷新：遍历所有监听器，逐个 try/catch 避免相互影响 */
export function triggerRefresh(): void {
  for (const fn of refreshListeners) {
    try {
      fn()
    } catch (e) {
      // 忽略单个监听器的异常，继续通知其他监听器
      console.error('[useShortcuts] refresh listener error:', e)
    }
  }
}

// 新增项监听集合：供各视图订阅「新增」动作
const newItemListeners = new Set<() => void>()

/** 订阅新增项事件，返回取消订阅函数 */
export function subscribeNewItem(fn: () => void): () => void {
  newItemListeners.add(fn)
  return () => newItemListeners.delete(fn)
}

/** 触发新增项：遍历所有监听器，逐个 try/catch */
export function triggerNewItem(): void {
  for (const fn of newItemListeners) {
    try {
      fn()
    } catch (e) {
      console.error('[useShortcuts] new-item listener error:', e)
    }
  }
}
