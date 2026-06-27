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

/** 触发刷新：遍历所有监听器，逐个 try/catch 避免相互影响；兼容 async 监听器 */
export function triggerRefresh(): void {
  for (const fn of refreshListeners) {
    try {
      const r = fn() as unknown
      if (r && typeof (r as Promise<void>).then === 'function') {
        ;(r as Promise<void>).catch((e) =>
          console.error('[useShortcuts] refresh listener async error:', e)
        )
      }
    } catch (e) {
      // 忽略单个监听器的异常，继续通知其他监听器
      console.error('[useShortcuts] refresh listener error:', e)
    }
  }
}

// 新增项监听集合：每项绑定所属视图名，仅当前激活视图的监听器会被触发
const newItemListeners = new Set<{ fn: () => void; view: ViewName }>()

/**
 * 订阅新增项事件，返回取消订阅函数。
 * @param fn 回调
 * @param view 所属视图名，仅当用户当前处于该视图时才会触发
 */
export function subscribeNewItem(fn: () => void, view: ViewName): () => void {
  const entry = { fn, view }
  newItemListeners.add(entry)
  return () => newItemListeners.delete(entry)
}

/** 触发新增项：仅触发与当前激活视图匹配的监听器，逐个 try/catch */
export function triggerNewItem(currentView: ViewName): void {
  for (const entry of newItemListeners) {
    if (entry.view !== currentView) continue
    try {
      const r = entry.fn() as unknown
      if (r && typeof (r as Promise<void>).then === 'function') {
        ;(r as Promise<void>).catch((e) =>
          console.error('[useShortcuts] new-item listener async error:', e)
        )
      }
    } catch (e) {
      console.error('[useShortcuts] new-item listener error:', e)
    }
  }
}
