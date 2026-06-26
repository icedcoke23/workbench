<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  ThunderboltOutlined,
  SaveOutlined,
  FilePdfOutlined,
  WechatOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  PlusOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'
import dayjs, { type Dayjs } from 'dayjs'
import { call } from '@renderer/api'
import type {
  ClassInfo,
  Feedback,
  FeedbackTemplate,
  FeedbackTemplateCategory,
  FeedbackTemplateInput,
  Lesson
} from '@shared/types'

const activeTab = ref<'weekly' | 'quarterly' | 'templates'>('weekly')

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
    const fb = await call(window.api.feedback.generate(lessonId.value))
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
    const res = await call(window.api.feedback.sendWeChat(currentFeedback.value.id))
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

// ============ 反馈模板 ============
const templates = ref<FeedbackTemplate[]>([])
const templatesLoading = ref(false)
const templateFilter = reactive<{ category: string }>({ category: '' })
const templateModalVisible = ref(false)
const templateSubmitting = ref(false)
const editingTemplate = ref<FeedbackTemplate | null>(null)
const templateForm = reactive<FeedbackTemplateInput>({
  name: '',
  category: 'custom',
  content: ''
})

const templateCategoryText: Record<FeedbackTemplateCategory, string> = {
  general: '通用',
  praise: '表扬鼓励',
  suggestion: '改进建议',
  progress: '进度报告',
  custom: '自定义'
}
const templateCategoryColor: Record<FeedbackTemplateCategory, string> = {
  general: 'blue',
  praise: 'gold',
  suggestion: 'orange',
  progress: 'purple',
  custom: 'default'
}

async function loadTemplates(): Promise<void> {
  templatesLoading.value = true
  try {
    const q = templateFilter.category ? { category: templateFilter.category } : undefined
    templates.value = await call(window.api.feedbackTemplate.list(q))
  } catch (e) {
    message.error(String(e))
  } finally {
    templatesLoading.value = false
  }
}

function openNewTemplate(): void {
  editingTemplate.value = null
  templateForm.name = ''
  templateForm.category = 'custom'
  templateForm.content = ''
  templateModalVisible.value = true
}

function openEditTemplate(item: FeedbackTemplate): void {
  editingTemplate.value = item
  templateForm.name = item.name
  templateForm.category = item.category
  templateForm.content = item.content
  templateModalVisible.value = true
}

async function submitTemplate(): Promise<void> {
  if (!templateForm.name.trim()) {
    message.warning('请输入模板名称')
    return
  }
  if (!templateForm.content.trim()) {
    message.warning('请输入模板内容')
    return
  }
  templateSubmitting.value = true
  try {
    if (editingTemplate.value) {
      await call(
        window.api.feedbackTemplate.update(editingTemplate.value.id, {
          name: templateForm.name.trim(),
          category: templateForm.category,
          content: templateForm.content
        })
      )
      message.success('模板已更新')
    } else {
      await call(
        window.api.feedbackTemplate.create({
          name: templateForm.name.trim(),
          category: templateForm.category,
          content: templateForm.content
        })
      )
      message.success('模板已创建')
    }
    templateModalVisible.value = false
    await loadTemplates()
  } catch (e) {
    message.error(String(e))
  } finally {
    templateSubmitting.value = false
  }
}

async function removeTemplate(id: string): Promise<void> {
  try {
    await call(window.api.feedbackTemplate.remove(id))
    message.success('已删除模板')
    await loadTemplates()
  } catch (e) {
    message.error(String(e))
  }
}

function useTemplate(item: FeedbackTemplate): void {
  // 将模板内容填入周反馈编辑区
  previewText.value = item.content
  activeTab.value = 'weekly'
  message.success(`已应用模板「${item.name}」，可编辑后保存`)
}

onMounted(async () => {
  offChunk = (window.events['feedback:chunk'] as unknown as FeedbackChunkRegistrar)((delta) => {
    if (delta === '[DONE]') {
      // 流结束，等待 generate 返回最终 Feedback 后清空 generating
      return
    }
    previewText.value += delta
  })

  await loadClasses()
  if (classId.value) await onClassChange(classId.value)
  await loadTemplates()

  try {
    const settings = await call(window.api.settings.get())
    aiConfigured.value = !!(settings.ai.useCustomAI && settings.ai.apiKey)
  } catch {
    /* ignore */
  }

  offRefresh = subscribeRefresh(() => {
    loadClasses()
    loadTemplates()
  })
})

onUnmounted(() => {
  offChunk?.()
  offChunk = null
  offRefresh?.()
  offRefresh = null
})
</script>

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

      <!-- ============ 反馈模板 ============ -->
      <a-tab-pane key="templates" tab="反馈模板">
        <div class="templates-toolbar">
          <a-space>
            <a-select
              v-model:value="templateFilter.category"
              style="width: 160px"
              placeholder="全部分类"
              allow-clear
              @change="loadTemplates"
            >
              <a-select-option value="">全部分类</a-select-option>
              <a-select-option value="general">通用</a-select-option>
              <a-select-option value="praise">表扬鼓励</a-select-option>
              <a-select-option value="suggestion">改进建议</a-select-option>
              <a-select-option value="progress">进度报告</a-select-option>
              <a-select-option value="custom">自定义</a-select-option>
            </a-select>
            <a-button @click="loadTemplates"><ReloadOutlined /> 刷新</a-button>
            <a-button type="primary" @click="openNewTemplate">
              <PlusOutlined /> 新建模板
            </a-button>
          </a-space>
        </div>

        <a-list
          :data-source="templates"
          :loading="templatesLoading"
          :locale="{ emptyText: '暂无模板，点击「新建模板」创建' }"
        >
          <template #renderItem="{ item }">
            <a-card class="template-card" size="small">
              <template #title>
                <span class="template-title">
                  {{ item.name }}
                  <a-tag v-if="item.isBuiltin" color="blue" class="builtin-tag">内置</a-tag>
                  <a-tag :color="templateCategoryColor[item.category]">
                    {{ templateCategoryText[item.category] }}
                  </a-tag>
                </span>
              </template>
              <template #extra>
                <a-space :size="6">
                  <a-button size="small" @click="useTemplate(item)">
                    <CopyOutlined /> 使用
                  </a-button>
                  <a-button size="small" :disabled="item.isBuiltin" @click="openEditTemplate(item)">
                    <EditOutlined /> 编辑
                  </a-button>
                  <a-popconfirm
                    :title="item.isBuiltin ? '内置模板不可删除' : '确认删除该模板？'"
                    :disabled="item.isBuiltin"
                    @confirm="removeTemplate(item.id)"
                  >
                    <a-button size="small" danger :disabled="item.isBuiltin">
                      <DeleteOutlined />
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </template>
              <pre class="template-content">{{ item.content }}</pre>
            </a-card>
          </template>
        </a-list>
      </a-tab-pane>
    </a-tabs>

    <!-- ============ 新建/编辑模板 Modal ============ -->
    <a-modal
      v-model:open="templateModalVisible"
      :title="editingTemplate ? '编辑模板' : '新建模板'"
      :confirm-loading="templateSubmitting"
      width="640px"
      @ok="submitTemplate"
    >
      <a-form layout="vertical">
        <a-form-item label="模板名称" required>
          <a-input v-model:value="templateForm.name" placeholder="如：周末集训反馈模板" />
        </a-form-item>
        <a-form-item label="分类">
          <a-select v-model:value="templateForm.category">
            <a-select-option value="general">通用</a-select-option>
            <a-select-option value="praise">表扬鼓励</a-select-option>
            <a-select-option value="suggestion">改进建议</a-select-option>
            <a-select-option value="progress">进度报告</a-select-option>
            <a-select-option value="custom">自定义</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="模板内容" required>
          <a-textarea
            v-model:value="templateForm.content"
            :rows="10"
            placeholder="模板内容支持占位符，如 {className}、{student_name}、{topic} 等，生成时会自动替换"
          />
        </a-form-item>
        <a-alert
          type="info"
          show-icon
          message="可用占位符"
          description="{className} 班级名 / {student_name} 学生名 / {topic} 主题 / {total_score} 积分 / {picked_count} 点名次数 / {period} 周期"
        />
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.report-frame {
  width: 100%;
  height: 70vh;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}
.templates-toolbar {
  margin-bottom: 16px;
}
.template-card {
  margin-bottom: 12px;
}
.template-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.builtin-tag {
  margin-left: 4px;
}
.template-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "Microsoft YaHei", "PingFang SC", monospace;
  font-size: 13px;
  color: #374151;
  background: #f9fafb;
  padding: 12px;
  border-radius: 6px;
  max-height: 240px;
  overflow-y: auto;
}
</style>
