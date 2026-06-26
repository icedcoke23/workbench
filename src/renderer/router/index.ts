import { createRouter, createMemoryHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@renderer/views/DashboardView.vue'),
    meta: { title: '工作看板', icon: 'DashboardOutlined' }
  },
  {
    path: '/prep',
    name: 'prep',
    component: () => import('@renderer/views/PrepView.vue'),
    meta: { title: '备课中心', icon: 'BulbOutlined' }
  },
  {
    path: '/teaching',
    name: 'teaching',
    component: () => import('@renderer/views/TeachingView.vue'),
    meta: { title: '授课中心', icon: 'PlayCircleOutlined' }
  },
  {
    path: '/post',
    name: 'post',
    component: () => import('@renderer/views/PostView.vue'),
    meta: { title: '课后中心', icon: 'FileTextOutlined' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@renderer/views/SettingsView.vue'),
    meta: { title: '设置', icon: 'SettingOutlined' }
  }
]

const router = createRouter({
  history: createMemoryHistory(),
  routes
})

export default router
