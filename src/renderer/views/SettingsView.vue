<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { h } from 'vue'
import {
  SaveOutlined,
  SyncOutlined,
  DownloadOutlined,
  UploadOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { call } from '@renderer/api'
import type {
  AISettings,
  AppSettings,
  ScratchSettings,
  SyncSettings,
  WeChatSettings
} from '@shared/types'

const activeTab = ref<'ai' | 'sync' | 'wechat' | 'scratch' | 'backup'>('ai')
const loading = ref(true)

// 数据备份
const exporting = ref(false)
const importing = ref(false)
const lastExportPath = ref('')
const lastImportInfo = ref<{ tables: number; rows: number } | null>(null)

const ai = reactive<AISettings>({
  useCustomAI: false,
  baseUrl: '',
  apiKey: '',
  modelId: '',
  visionModelId: '',
  systemPrompt: '',
  maxConcurrent: 1
})

const sync = reactive<SyncSettings>({
  enabled: false,
  serverUrl: '',
  token: '',
  lastSyncAt: null,
  autoSync: false
})

const wechat = reactive<WeChatSettings>({
  defaultGroupName: '',
  searchHotkey: '',
  sendDelayMs: 500,
  autoActivate: false
})

const scratch = reactive<ScratchSettings>({
  guiUrl: 'http://localhost:8601',
  autoLaunch: false,
  workspaceDir: ''
})

const savingAi = ref(false)
const savingSync = ref(false)
const savingWechat = ref(false)
const savingScratch = ref(false)
const testingAi = ref(false)
const testingSync = ref(false)
const syncing = ref(false)

function applySettings(s: AppSettings): void {
  Object.assign(ai, s.ai)
  Object.assign(sync, s.sync)
  Object.assign(wechat, s.wechat)
  Object.assign(scratch, s.scratch)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const s = await call(window.api.settings.get())
    applySettings(s)
  } catch (e) {
    message.error('加载设置失败：' + String(e))
  } finally {
    loading.value = false
  }
}

async function saveAi(): Promise<void> {
  savingAi.value = true
  try {
    await call(window.api.settings.saveAI({ ...ai }))
    message.success('AI 配置已保存')
  } catch (e) {
    message.error(String(e))
  } finally {
    savingAi.value = false
  }
}

async function testAi(): Promise<void> {
  testingAi.value = true
  try {
    const res = await call(window.api.settings.testAI())
    if (res.ok) message.success(res.message || '连接成功')
    else message.warning(res.message || '连接失败')
  } catch (e) {
    message.error(String(e))
  } finally {
    testingAi.value = false
  }
}

async function saveSync(): Promise<void> {
  savingSync.value = true
  try {
    await call(window.api.settings.saveSync({ ...sync }))
    message.success('同步配置已保存')
  } catch (e) {
    message.error(String(e))
  } finally {
    savingSync.value = false
  }
}

async function testSync(): Promise<void> {
  testingSync.value = true
  try {
    const res = await call(window.api.settings.testSync())
    if (res.ok) message.success(res.message || '连接成功')
    else message.warning(res.message || '连接失败')
  } catch (e) {
    message.error(String(e))
  } finally {
    testingSync.value = false
  }
}

async function syncNow(): Promise<void> {
  syncing.value = true
  try {
    const res = await call(window.api.settings.syncNow())
    if (res.ok) message.success(res.message || '同步完成')
    else message.warning(res.message || '同步失败')
    // 同步后刷新 lastSyncAt
    try {
      const s = await call(window.api.settings.get())
      Object.assign(sync, s.sync)
    } catch {
      /* ignore */
    }
  } catch (e) {
    message.error(String(e))
  } finally {
    syncing.value = false
  }
}

async function saveWechat(): Promise<void> {
  savingWechat.value = true
  try {
    await call(window.api.settings.saveWeChat({ ...wechat }))
    message.success('企业微信配置已保存')
  } catch (e) {
    message.error(String(e))
  } finally {
    savingWechat.value = false
  }
}

async function saveScratch(): Promise<void> {
  savingScratch.value = true
  try {
    await call(window.api.settings.saveScratch({ ...scratch }))
    message.success('Scratch 配置已保存')
  } catch (e) {
    message.error(String(e))
  } finally {
    savingScratch.value = false
  }
}

// ============ 数据备份 ============
async function onExport(): Promise<void> {
  exporting.value = true
  try {
    const json = await call(window.api.data.export())
    const path = await call(window.api.data.saveExportToFile(json))
    lastExportPath.value = path
    message.success('已导出备份：' + path, 6)
  } catch (e) {
    message.error(String(e))
  } finally {
    exporting.value = false
  }
}

function onImport(): void {
  Modal.confirm({
    title: '确认导入数据',
    icon: h(ExclamationCircleOutlined),
    content: '导入操作将清空并覆盖当前所有数据，且不可恢复。建议先导出当前数据备份。是否继续？',
    okText: '确认导入',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      importing.value = true
      try {
        const filePath = await call(window.api.data.pickImportFile())
        if (!filePath) {
          importing.value = false
          return
        }
        const info = await call(window.api.data.importFromFile(filePath))
        lastImportInfo.value = info
        message.success(`导入成功：${info.tables} 张表 / ${info.rows} 条记录`)
        await load()
      } catch (e) {
        message.error(String(e))
      } finally {
        importing.value = false
      }
    }
  })
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <a-spin :spinning="loading">
      <a-tabs v-model:activeKey="activeTab">
        <!-- ============ AI 配置 ============ -->
        <a-tab-pane key="ai" tab="AI 配置">
          <a-card>
            <a-alert
              type="info"
              show-icon
              style="margin-bottom: 16px"
              message="兼容 OpenAI 协议的第三方服务"
              description="本应用支持任何兼容 OpenAI 接口的服务商，例如：智谱 GLM、DeepSeek、通义千问、Moonshot、OpenAI 等。请填入对应服务商的 BaseUrl、API Key 与模型 ID。"
            />
            <a-form layout="vertical" :model="ai">
              <a-form-item label="启用自定义 AI">
                <a-switch v-model:checked="ai.useCustomAI" />
                <span class="form-hint">关闭后将无法使用 AI 生成反馈/解析课表等功能</span>
              </a-form-item>
              <a-form-item label="Base URL">
                <a-input
                  v-model:value="ai.baseUrl"
                  placeholder="https://open.bigmodel.cn/api/paas/v4"
                />
              </a-form-item>
              <a-form-item label="API Key">
                <a-input-password
                  v-model:value="ai.apiKey"
                  placeholder="sk-..."
                  autocomplete="off"
                />
              </a-form-item>
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="文本模型 ID">
                    <a-input v-model:value="ai.modelId" placeholder="glm-4-flash" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="视觉模型 ID（可选）">
                    <a-input v-model:value="ai.visionModelId" placeholder="glm-4v" />
                  </a-form-item>
                </a-col>
              </a-row>
              <a-form-item label="System Prompt">
                <a-textarea
                  v-model:value="ai.systemPrompt"
                  :rows="4"
                  placeholder="系统提示词，用于定义 AI 的角色与输出风格"
                />
              </a-form-item>
            </a-form>
            <div class="form-actions">
              <a-button type="primary" :loading="savingAi" @click="saveAi">
                <SaveOutlined />
                保存
              </a-button>
              <a-button :loading="testingAi" @click="testAi">测试连接</a-button>
            </div>
          </a-card>
        </a-tab-pane>

        <!-- ============ 同步配置 ============ -->
        <a-tab-pane key="sync" tab="同步配置">
          <a-card>
            <a-form layout="vertical" :model="sync">
              <a-form-item label="启用同步">
                <a-switch v-model:checked="sync.enabled" />
              </a-form-item>
              <a-form-item label="服务器地址">
                <a-input
                  v-model:value="sync.serverUrl"
                  placeholder="https://your-sync-server.com"
                />
              </a-form-item>
              <a-form-item label="访问 Token">
                <a-input-password v-model:value="sync.token" autocomplete="off" />
              </a-form-item>
              <a-form-item label="自动同步">
                <a-switch v-model:checked="sync.autoSync" />
                <span class="form-hint">开启后将在后台定时同步数据</span>
              </a-form-item>
              <a-form-item v-if="sync.lastSyncAt" label="上次同步时间">
                <span>{{ dayjs(sync.lastSyncAt).format('YYYY-MM-DD HH:mm:ss') }}</span>
              </a-form-item>
            </a-form>
            <div class="form-actions">
              <a-button type="primary" :loading="savingSync" @click="saveSync">
                <SaveOutlined />
                保存
              </a-button>
              <a-button :loading="testingSync" @click="testSync">测试连接</a-button>
              <a-button :loading="syncing" @click="syncNow">
                <SyncOutlined />
                立即同步
              </a-button>
            </div>
          </a-card>
        </a-tab-pane>

        <!-- ============ 企业微信 ============ -->
        <a-tab-pane key="wechat" tab="企业微信">
          <a-card>
            <a-alert
              type="warning"
              show-icon
              style="margin-bottom: 16px"
              message="使用须知"
              description="本功能仅 Windows 系统可用；使用前请先打开并登录企业微信客户端；自动化通过模拟键盘输入实现，发送过程中请勿操作键盘与鼠标。"
            />
            <a-form layout="vertical" :model="wechat">
              <a-form-item label="默认群名">
                <a-input
                  v-model:value="wechat.defaultGroupName"
                  placeholder="如：周六 Scratch 班家长群"
                />
              </a-form-item>
              <a-form-item label="搜索快捷键">
                <a-input v-model:value="wechat.searchHotkey" placeholder="如：Ctrl+F" />
              </a-form-item>
              <a-form-item label="发送延迟">
                <a-input-number
                  v-model:value="wechat.sendDelayMs"
                  :min="0"
                  :step="100"
                  style="width: 220px"
                >
                  <template #addonAfter>毫秒</template>
                </a-input-number>
              </a-form-item>
              <a-form-item label="自动激活企业微信窗口">
                <a-switch v-model:checked="wechat.autoActivate" />
              </a-form-item>
            </a-form>
            <div class="form-actions">
              <a-button type="primary" :loading="savingWechat" @click="saveWechat">
                <SaveOutlined />
                保存
              </a-button>
            </div>
          </a-card>
        </a-tab-pane>

        <!-- ============ Scratch ============ -->
        <a-tab-pane key="scratch" tab="Scratch">
          <a-card>
            <a-alert
              type="info"
              show-icon
              style="margin-bottom: 16px"
              message="本地 scratch-gui 启动方式"
              description="在本地 scratch-gui 项目目录执行 `npm install && npm start`，默认服务地址为 http://localhost:8601。启动成功后将该地址填入下方「GUI 服务地址」即可。"
            />
            <a-form layout="vertical" :model="scratch">
              <a-form-item label="GUI 服务地址">
                <a-input
                  v-model:value="scratch.guiUrl"
                  placeholder="http://localhost:8601"
                />
              </a-form-item>
              <a-form-item label="自动启动 GUI">
                <a-switch v-model:checked="scratch.autoLaunch" />
                <span class="form-hint">进入授课相关页面时自动打开本地 GUI</span>
              </a-form-item>
              <a-form-item label="工作目录">
                <a-input
                  v-model:value="scratch.workspaceDir"
                  placeholder="如：D:\\ScratchProjects"
                />
              </a-form-item>
            </a-form>
            <div class="form-actions">
              <a-button type="primary" :loading="savingScratch" @click="saveScratch">
                <SaveOutlined />
                保存
              </a-button>
            </div>
          </a-card>
        </a-tab-pane>

        <!-- ============ 数据备份 ============ -->
        <a-tab-pane key="backup" tab="数据备份">
          <a-card>
            <a-alert
              type="info"
              show-icon
              style="margin-bottom: 16px"
              message="数据备份与恢复"
              description="可一键导出全部业务数据（学生、班级、课次、点子、反馈等）为 JSON 备份文件，或从备份文件恢复数据。导入操作会覆盖现有数据，请谨慎使用。"
            />

            <a-row :gutter="16">
              <a-col :span="12">
                <a-card class="backup-card" size="small" title="导出备份">
                  <p class="backup-desc">将当前全部数据导出为 JSON 文件，保存到本地。</p>
                  <a-button
                    type="primary"
                    :loading="exporting"
                    @click="onExport"
                  >
                    <DownloadOutlined />
                    立即导出
                  </a-button>
                  <div v-if="lastExportPath" class="backup-result">
                    上次导出：{{ lastExportPath }}
                  </div>
                </a-card>
              </a-col>
              <a-col :span="12">
                <a-card class="backup-card" size="small" title="导入恢复">
                  <p class="backup-desc">从备份 JSON 文件恢复数据（将覆盖现有数据）。</p>
                  <a-button
                    :loading="importing"
                    @click="onImport"
                  >
                    <UploadOutlined />
                    选择文件导入
                  </a-button>
                  <div v-if="lastImportInfo" class="backup-result">
                    上次导入：{{ lastImportInfo.tables }} 张表 / {{ lastImportInfo.rows }} 条记录
                  </div>
                </a-card>
              </a-col>
            </a-row>

            <a-divider />

            <a-alert
              type="warning"
              show-icon
              message="注意事项"
              description="1. 导入会清空并覆盖当前所有数据，建议先导出一份备份；2. 备份文件包含敏感信息（学生姓名等），请妥善保管；3. 日志文件位于应用数据目录的 logs 子文件夹。"
            />
          </a-card>
        </a-tab-pane>
      </a-tabs>
    </a-spin>
  </div>
</template>

<style scoped>
.form-actions {
  margin-top: 8px;
  display: flex;
  gap: 12px;
}
.form-hint {
  margin-left: 12px;
  color: #9ca3af;
  font-size: 12px;
}
.backup-card {
  min-height: 160px;
}
.backup-desc {
  color: #6b7280;
  margin: 0 0 12px;
  font-size: 13px;
}
.backup-result {
  margin-top: 12px;
  font-size: 12px;
  color: #6b7280;
  word-break: break-all;
}
</style>
