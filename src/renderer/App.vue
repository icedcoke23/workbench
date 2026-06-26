<template>
  <a-layout class="app-layout">
    <a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible width="210" class="app-sider">
      <div class="logo">
        <span class="logo-icon">🧩</span>
        <span v-if="!collapsed" class="logo-text">Scratch 工作台</span>
      </div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        theme="dark"
        mode="inline"
        @click="onMenuClick"
      >
        <a-menu-item key="dashboard">
          <DashboardOutlined />
          <span>工作看板</span>
        </a-menu-item>
        <a-menu-item key="prep">
          <BulbOutlined />
          <span>备课中心</span>
        </a-menu-item>
        <a-menu-item key="teaching">
          <PlayCircleOutlined />
          <span>授课中心</span>
        </a-menu-item>
        <a-menu-item key="post">
          <FileTextOutlined />
          <span>课后中心</span>
        </a-menu-item>
        <a-menu-item key="settings">
          <SettingOutlined />
          <span>设置</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="app-header">
        <component :is="collapseIcon" class="trigger" @click="collapsed = !collapsed" />
        <span class="header-title">{{ currentTitle }}</span>
        <div class="header-right">
          <a-tag v-if="syncEnabled" color="green">同步已开启</a-tag>
          <a-button type="text" size="small" @click="goSync" title="立即同步">
            <SyncOutlined />
          </a-button>
        </div>
      </a-layout-header>
      <a-layout-content class="app-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DashboardOutlined,
  BulbOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
  SyncOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { call } from '@renderer/api'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const syncEnabled = ref(false)

const selectedKeys = computed({
  get: () => [String(route.name ?? 'dashboard')],
  set: () => {}
})

const currentTitle = computed(() => (route.meta.title as string) ?? '工作看板')
const collapseIcon = computed(() => (collapsed.value ? MenuUnfoldOutlined : MenuFoldOutlined))

function onMenuClick({ key }: { key: string }): void {
  router.push({ name: key })
}

async function goSync(): Promise<void> {
  try {
    const res = await call(window.api.settings.syncNow())
    message[res.ok ? 'success' : 'warning'](res.message)
  } catch (e) {
    message.error(String(e))
  }
}

onMounted(async () => {
  try {
    const settings = await call(window.api.settings.get())
    syncEnabled.value = settings.sync.enabled
  } catch {
    // ignore
  }
})
</script>

<style scoped>
.app-layout {
  height: 100%;
}
.app-sider {
  background: #1e1f29;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}
.logo-icon {
  font-size: 22px;
}
.app-header {
  background: #fff;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #eef0f4;
}
.trigger {
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}
.header-title {
  font-size: 16px;
  font-weight: 600;
}
.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.app-content {
  height: calc(100vh - 56px);
  overflow: hidden;
}
:deep(.ant-layout-sider-children) {
  display: flex;
  flex-direction: column;
}
</style>
