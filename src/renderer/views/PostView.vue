<template>
  <div class="page-container">
    <a-tabs v-model:activeKey="activeTab">
      <!-- ============ 周反馈 ============ -->
      <a-tab-pane key="weekly" tab="周反馈">
        <a-space style="margin-bottom: 16px" wrap>
          <a-select
            v-model:value="classId"
            placeholder="选择班级"
            style="width: 200px"
            :options="classOptions"
            @change="onClassChange"
          />
          <a-select
            v-model:value="lessonId"
            placeholder="选择已结课课次"
            style="width: 340px"
            :options="lessonOptions"
            :disabled="!classId"
            allow-clear
          />
          <a-button
            type="primary"
            :loading="generating"
            :disabled="!lessonId"
            @click="generate"
          >
            <ThunderboltOutlined />
            AI 生成反馈
          </a-button>
        </a-space>

        <a-row :gutter="16">
          <a-col :span="14">
            <a-card title="反馈内容" size="small">
              <template #extra>
                <a-space>
                  <a-button
                    size="small"
                    :loading="saving"
                    :disabled="!currentFeedback"
                    @click="save"
                  >
                    <SaveOutlined />
                    保存
                  </a-button>
                  <a-button
                    size="small"
                    :loading="exporting"
                    :disabled="!currentFeedback"
                    @click="exportPdf"
                  >
                    <FilePdfOutlined />
                    导出PDF
                  </a-button>
                  <a-button
                    size="small"
                    :loading="sending"
                    :disabled="!currentFeedback"
                    @click="sendWeChat"
                  >
                    <WechatOutlined />
                    发送到企微
                  </a-button>
                </a-space>
              </template>
              <a-spin :spinning="generating" tip="AI 正在生成反馈...">
                <a-textarea
                  v-model:value="previewText"
                  :rows="14"
                  placeholder="选择已结课的课次并点击「AI 生成反馈」，生成内容可在此编辑后保存。"
                />
              </a-spin>
            </a-card>
          </a-col>

          <a-col :span="10">
            <a-card title="历史反馈" size="small">
              <a-table
                :data-source="feedbacks"
                :columns="feedbackColumns"
                :pagination="false"
                size="small"
                row-key="id"
                :scroll="{ y: 360 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'period'">
                    {{ formatPeriod(record) }}
                  </template>
                  <template v-else-if="column.key === 'status'">
                    <a-tag :color="record.status === 'published' ? 'green' : 'orange'">
                      {{ record.status === 'published' ? '已发布' : '草稿' }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.key === 'sentAt'">
                    {{ record.sentAt ? dayjs(record.sentAt).format('YYYY-MM-DD HH:mm') : '-' }}
                  </template>
                  <template v-else-if="column.key === 'action'">
                    <a-button type="link" size="small" @click="selectFeedback(record)">
                      选择
                    </a-button>
                  </template>
                </template>
              </a-table>
            </a-card>
          </a-col>
        </a-row>
      </a-tab-pane>

      <!-- ============ 季度报告 ============ -->
      <a-tab-pane key="quarterly" tab="季度报告">
        <a-alert
          v-if="!aiConfigured"
          type="info"
          show-icon
          message="AI 未配置"
          description="季度报告当前仅基于统计数据生成。如需 AI 生成分析建议，请前往「设置 → AI 配置」完成配置。"
          style="margin-bottom: 16px"
        />
        <a-card title="生成季度报告" size="small">
          <a-space style="margin-bottom: 16px" wrap>
            <a-select
              v-model:value="reportClassId"
              placeholder="选择班级"
              style="width: 200px"
              :options="classOptions"
            />
            <a-range-picker v-model:value="dateRange" :placeholder="['开始日期', '结束日期']" />
            <a-button
              type="primary"
              :loading="reporting"
              :disabled="!reportClassId || !dateRange"
              @click="generateReport"
            >
              <ThunderboltOutlined />
              生成报告
            </a-button>
            <a-button v-if="reportPdfPath" @click="openReport">
              <FolderOpenOutlined />
              打开报告
            </a-button>
          </a-space>

          <a-empty
            v-if="!reportHtml && !reporting"
            description="选择班级与日期范围后生成季度报告"
          />
          <iframe v-if="reportHtml" :srcdoc="reportHtml" class="report-frame" />
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  ThunderboltOutlined,
  SaveOutlined,
  FilePdfOutlined,
  WechatOutlined,
  FolderOpenOutlined
} from '@ant-design/icons-vue'
import dayjs, { type Dayjs } from 'dayjs'
import { call } from '@renderer/api'
import { subscribeRefresh } from '@renderer/composables/useShortcuts'
import type { ClassInfo, Feedback, Lesson } from '@shared/types'

const activeTab = ref<'weekly' | 'quarterly'>('weekly')

// 周反馈
const classes = ref<ClassInfo[]>([])
const classId = ref<string | undefined>()
const lessons = ref<Lesson[]>([])
const lessonId = ref<string | undefined>()
const feedbacks = ref<Feedback[]>([])
const previewText = ref('')
const currentFeedback = ref<Feedback | null>(null)
const generating = ref(false)
const saving = ref(false)
const exporting = ref(false)
const sending = ref(false)
const aiConfigured = ref(true)

// 季度报告
const reportClassId = ref<string | undefined>()
const dateRange = ref<[Dayjs, Dayjs] | undefined>()
const reportHtml = ref('')
const reportPdfPath = ref('')
const reporting = ref(false)

const classOptions = computed(() =>
  classes.value.map((c) => ({ label: c.name, value: c.id }))
)

const lessonOptions = computed(() =>
  lessons.value
    .filter((l) => l.status === 'finished')
    .map((l) => ({
      label: `${dayjs(l.startTime).format('MM-DD HH:mm')} ${l.subject || l.ideaTitle || ''}`.trim(),
      value: l.id
    }))
)

const feedbackColumns = [
  { title: '周期', key: 'period' },
  { title: '状态', key: 'status', width: 90 },
  { title: '发送时间', key: 'sentAt', width: 160 },
  { title: '操作', key: 'action', width: 80 }
]

function formatPeriod(r: Feedback): string {
  return `${(r.periodStart || '').slice(0, 10)} ~ ${(r.periodEnd || '').slice(0, 10)}`
}

// feedback:chunk 监听器注册（preload 实现为 (cb) => unsub，类型声明略有偏差，这里做类型断言）
type FeedbackChunkRegistrar = (cb: (delta: string) => void) => () => void
let offChunk: (() => void) | null = null
// 全局刷新订阅取消函数
let offRefresh: (() => void) | null = null

async function loadClasses(): Promise<void> {
  try {
    classes.value = await call(window.api.class.list())
    if (classes.value.length && !classId.value) classId.value = classes.value[0].id
  } catch (e) {
    message.error(String(e))
  }
}

async function loadLessons(cid: string): Promise<void> {
  try {
    lessons.value = await call(window.api.lesson.list({ classId: cid }))
  } catch (e) {
    message.error(String(e))
  }
}

async function loadFeedbacks(cid: string): Promise<void> {
  try {
    feedbacks.value = await call(window.api.feedback.list({ classId: cid }))
  } catch (e) {
    message.error(String(e))
  }
}

async function onClassChange(val: string | undefined): Promise<void> {
  if (!val) {
    lessons.value = []
    feedbacks.value = []
    lessonId.value = undefined
    currentFeedback.value = null
    previewText.value = ''
    return
  }
  lessonId.value = undefined
  currentFeedback.value = null
  previewText.value = ''
  await Promise.all([loadLessons(val), loadFeedbacks(val)])
}

async function generate(): Promise<void> {
  if (!lessonId.value) return
  generating.value = true
  previewText.value = ''
  currentFeedback.value = null
  try {
    // generate 实际返回保存后的 Feedback 对象（类型声明为 string，这里断言）
    const fb = (await call(window.api.feedback.generate(lessonId.value))) as unknown as Feedback
    currentFeedback.value = fb
    previewText.value = fb.content || ''
    await loadFeedbacks(fb.classId)
    message.success('反馈已生成')
  } catch (e) {
    message.error(String(e))
  } finally {
    generating.value = false
  }
}

async function save(): Promise<void> {
  if (!currentFeedback.value) {
    message.warning('请先生成或选择一条反馈')
    return
  }
  const fb = currentFeedback.value
  saving.value = true
  try {
    const saved = await call(
      window.api.feedback.save({
        id: fb.id,
        content: previewText.value,
        classId: fb.classId,
        periodStart: fb.periodStart,
        periodEnd: fb.periodEnd
      })
    )
    currentFeedback.value = saved
    await loadFeedbacks(fb.classId)
    message.success('已保存')
  } catch (e) {
    message.error(String(e))
  } finally {
    saving.value = false
  }
}

async function exportPdf(): Promise<void> {
  if (!currentFeedback.value) return
  exporting.value = true
  try {
    const path = await call(window.api.feedback.exportPdf(currentFeedback.value.id))
    message.success('已导出 PDF：' + path, 6)
  } catch (e) {
    message.error(String(e))
  } finally {
    exporting.value = false
  }
}

async function sendWeChat(): Promise<void> {
  if (!currentFeedback.value) return
  sending.value = true
  try {
    // sendWeChat 实际返回 { ok, message }（类型声明为 void，这里断言）
    const res = (await call(
      window.api.feedback.sendWeChat(currentFeedback.value.id)
    )) as unknown as { ok: boolean; message: string }
    if (res.ok) message.success(res.message || '已发送到企业微信')
    else message.warning(res.message || '发送失败')
    await loadFeedbacks(currentFeedback.value.classId)
  } catch (e) {
    message.error(String(e))
  } finally {
    sending.value = false
  }
}

function selectFeedback(r: Feedback): void {
  currentFeedback.value = r
  previewText.value = r.content || ''
  activeTab.value = 'weekly'
}

async function generateReport(): Promise<void> {
  if (!reportClassId.value || !dateRange.value) return
  reporting.value = true
  reportHtml.value = ''
  reportPdfPath.value = ''
  try {
    const [from, to] = dateRange.value
    const res = await call(
      window.api.feedback.generateReport({
        classId: reportClassId.value,
        from: from.startOf('day').toISOString(),
        to: to.endOf('day').toISOString()
      })
    )
    reportHtml.value = res.html
    reportPdfPath.value = res.pdfPath
    message.success('报告已生成：' + res.pdfPath, 6)
  } catch (e) {
    message.error(String(e))
  } finally {
    reporting.value = false
  }
}

async function openReport(): Promise<void> {
  if (!reportPdfPath.value) return
  try {
    await call(window.api.doc.openUrl('file://' + reportPdfPath.value))
  } catch (e) {
    message.error(String(e))
  }
}

onMounted(async () => {
  offChunk = (window.events['feedback:chunk'] as unknown as FeedbackChunkRegistrar)((delta) => {
    if (delta === '[DONE]') {
      // 流结束，等待 generate 返回最终 Feedback 后清空 generating
      return
    }
    previewText.value += delta
  })

  // 订阅全局刷新事件：刷新时重新加载班级列表
  // 注：任务描述中的 loadTemplates 在本视图不存在，此处仅刷新班级数据
  offRefresh = subscribeRefresh(() => {
    loadClasses()
  })

  await loadClasses()
  if (classId.value) await onClassChange(classId.value)

  try {
    const settings = await call(window.api.settings.get())
    aiConfigured.value = !!(settings.ai.useCustomAI && settings.ai.apiKey)
  } catch {
    /* ignore */
  }
})

onUnmounted(() => {
  offChunk?.()
  offChunk = null
  offRefresh?.()
  offRefresh = null
})
</script>

<style scoped>
.report-frame {
  width: 100%;
  height: 70vh;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}
</style>
