<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  BulbOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  PlusOutlined,
  PlusCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  LinkOutlined,
  GlobalOutlined,
  EyeOutlined,
  CloseOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { call } from '@renderer/api'
import type {
  Idea,
  IdeaStatus,
  Resource,
  ResourceType,
  Lesson,
  ScratchSavePayload
} from '@shared/types'
import { subscribeRefresh, subscribeNewItem } from '@renderer/composables/useShortcuts'

// ============ 公共 ============
const activeTab = ref<'ideas' | 'resources' | 'docs'>('ideas')

function formatDate(d: string): string {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
}

const ideaStatusText: Record<IdeaStatus, string> = {
  idea: '点子',
  developing: '开发中',
  archived: '已归档'
}
const ideaStatusColor: Record<IdeaStatus, string> = {
  idea: 'blue',
  developing: 'gold',
  archived: 'default'
}
const resourceTypeText: Record<ResourceType, string> = {
  backdrop: '背景',
  sprite: '角色',
  sound: '音效'
}
const resourceTypeColor: Record<ResourceType, string> = {
  backdrop: 'blue',
  sprite: 'green',
  sound: 'purple'
}

// ============ 点子库 ============
const ideas = ref<Idea[]>([])
const ideasLoading = ref(false)
const expandedMap = reactive<Record<string, boolean>>({})

async function loadIdeas(): Promise<void> {
  ideasLoading.value = true
  try {
    ideas.value = await call(window.api.idea.list())
  } catch (e) {
    message.error(`加载点子失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    ideasLoading.value = false
  }
}

function toggleVersions(id: string): void {
  expandedMap[id] = !expandedMap[id]
}

async function launchVersion(versionId: string): Promise<void> {
  try {
    await call(window.api.scratch.launch(versionId))
    message.success('已打开 Scratch 编辑器并加载该版本')
  } catch (e) {
    message.error(`启动失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeIdea(id: string): Promise<void> {
  try {
    await call(window.api.idea.remove(id))
    message.success('已删除点子')
    await loadIdeas()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeVersion(versionId: string): Promise<void> {
  try {
    await call(window.api.idea.removeVersion(versionId))
    message.success('已删除版本')
    await loadIdeas()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// 新建点子
const newIdeaModalVisible = ref(false)
const newIdeaSubmitting = ref(false)
const newIdeaForm = reactive({
  title: '',
  targetCourse: '',
  description: '',
  status: 'idea' as IdeaStatus
})

function openNewIdeaModal(): void {
  newIdeaForm.title = ''
  newIdeaForm.targetCourse = ''
  newIdeaForm.description = ''
  newIdeaForm.status = 'idea'
  newIdeaModalVisible.value = true
}

async function submitNewIdea(): Promise<void> {
  if (!newIdeaForm.title.trim()) {
    message.warning('请输入标题')
    return
  }
  newIdeaSubmitting.value = true
  try {
    await call(
      window.api.idea.create({
        title: newIdeaForm.title.trim(),
        targetCourse: newIdeaForm.targetCourse.trim() || undefined,
        description: newIdeaForm.description.trim() || undefined,
        status: newIdeaForm.status
      })
    )
    message.success('点子已创建')
    newIdeaModalVisible.value = false
    await loadIdeas()
  } catch (e) {
    message.error(`创建失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    newIdeaSubmitting.value = false
  }
}

// 新建版本
const newVersionModalVisible = ref(false)
const newVersionSubmitting = ref(false)
const newVersionIdeaTitle = ref('')
const newVersionForm = reactive({
  ideaId: '',
  versionName: '',
  notes: ''
})

function openNewVersionModal(idea: Idea): void {
  newVersionIdeaTitle.value = idea.title
  newVersionForm.ideaId = idea.id
  newVersionForm.versionName = ''
  newVersionForm.notes = ''
  newVersionModalVisible.value = true
}

async function submitNewVersion(): Promise<void> {
  if (!newVersionForm.versionName.trim()) {
    message.warning('请输入版本名称')
    return
  }
  newVersionSubmitting.value = true
  try {
    await call(
      window.api.idea.createVersion({
        ideaId: newVersionForm.ideaId,
        versionName: newVersionForm.versionName.trim(),
        notes: newVersionForm.notes.trim() || undefined
      })
    )
    message.success('版本已创建')
    newVersionModalVisible.value = false
    await loadIdeas()
  } catch (e) {
    message.error(`创建失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    newVersionSubmitting.value = false
  }
}

// ============ 资源库 ============
const resources = ref<Resource[]>([])
const resourcesLoading = ref(false)
const resourceTags = ref<string[]>([])
const resourceFilter = reactive<{ type: string; keyword: string; tag: string }>({
  type: '',
  keyword: '',
  tag: ''
})

const resourceColumns = [
  { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '标签', dataIndex: 'tags', key: 'tags' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 110 }
]

async function loadResources(): Promise<void> {
  resourcesLoading.value = true
  try {
    const [list, tags] = await Promise.all([
      call(
        window.api.resource.list({
          type: resourceFilter.type || undefined,
          keyword: resourceFilter.keyword.trim() || undefined,
          tag: resourceFilter.tag || undefined
        })
      ),
      call(window.api.resource.allTags())
    ])
    resources.value = list
    resourceTags.value = tags
  } catch (e) {
    message.error(`加载素材失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    resourcesLoading.value = false
  }
}

async function importResource(): Promise<void> {
  try {
    const res = await call(window.api.scratch.pickResourceFile())
    message.success(`已导入素材：${res.name}`)
    await loadResources()
  } catch (e) {
    message.error(`导入失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeResource(id: string): Promise<void> {
  try {
    await call(window.api.resource.remove(id))
    message.success('已删除素材')
    await loadResources()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// ============ 文档中心 ============
const lessons = ref<Lesson[]>([])
const lessonsLoading = ref(false)
const docForm = reactive<{ url: string; title: string; lessonId: string | undefined }>({
  url: '',
  title: '',
  lessonId: undefined
})

// 文档嵌入预览
const embeddedDocUrl = ref('')
const embeddedDocTitle = ref('')
const webviewUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function embedDoc(): void {
  if (!docForm.url) return
  embeddedDocUrl.value = docForm.url
  embeddedDocTitle.value = docForm.title || docForm.url
}
function closeEmbed(): void {
  embeddedDocUrl.value = ''
  embeddedDocTitle.value = ''
}

const lessonOptions = computed(() =>
  lessons.value.map((l) => ({
    value: l.id,
    label: `${l.className || '未命名班级'} · ${formatDate(l.startTime)}`
  }))
)

const canLinkDoc = computed(
  () => !!docForm.url.trim() && !!docForm.title.trim() && !!docForm.lessonId
)

async function loadLessons(): Promise<void> {
  lessonsLoading.value = true
  try {
    lessons.value = await call(window.api.lesson.list({}))
  } catch (e) {
    message.error(`加载课次失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    lessonsLoading.value = false
  }
}

async function linkDoc(): Promise<void> {
  if (!canLinkDoc.value || !docForm.lessonId) return
  try {
    await call(
      window.api.doc.linkToLesson(docForm.lessonId, docForm.url.trim(), docForm.title.trim())
    )
    message.success('已关联到课次')
    docForm.url = ''
    docForm.title = ''
    docForm.lessonId = undefined
  } catch (e) {
    message.error(`关联失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function openDocInBrowser(): Promise<void> {
  const url = docForm.url.trim()
  if (!url) {
    message.warning('请先填写语雀文档 URL')
    return
  }
  try {
    await call(window.api.doc.openUrl(url))
  } catch (e) {
    message.error(`打开失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// ============ Scratch 保存归档 ============
const saveModalVisible = ref(false)
const saveSubmitting = ref(false)
const saveTarget = ref<'idea' | 'resource'>('idea')
const saveIdeasLoading = ref(false)
const saveForm = reactive<{ ideaId: string | undefined; versionName: string; notes: string }>({
  ideaId: undefined,
  versionName: '',
  notes: ''
})
let pendingSavePayload: ScratchSavePayload | null = null

const ideaSelectOptions = computed(() =>
  ideas.value.map((i) => ({ value: i.id, label: i.title }))
)

async function handleScratchSave(payload: ScratchSavePayload): Promise<void> {
  pendingSavePayload = payload
  saveTarget.value = 'idea'
  saveForm.ideaId = undefined
  saveForm.versionName = ''
  saveForm.notes = ''
  // 刷新点子列表，确保下拉框可选到最新点子
  saveIdeasLoading.value = true
  try {
    ideas.value = await call(window.api.idea.list())
  } catch {
    // 忽略，使用已有列表
  } finally {
    saveIdeasLoading.value = false
  }
  saveModalVisible.value = true
}

async function submitSave(): Promise<void> {
  if (!pendingSavePayload) {
    saveModalVisible.value = false
    return
  }
  if (saveTarget.value === 'idea') {
    if (!saveForm.ideaId) {
      message.warning('请选择所属点子')
      return
    }
    if (!saveForm.versionName.trim()) {
      message.warning('请输入版本名称')
      return
    }
    saveSubmitting.value = true
    try {
      await call(
        window.api.scratch.saveToIdea(pendingSavePayload, {
          ideaId: saveForm.ideaId,
          versionName: saveForm.versionName.trim(),
          notes: saveForm.notes.trim() || undefined
        })
      )
      message.success('已保存到点子库')
      saveModalVisible.value = false
      pendingSavePayload = null
      await loadIdeas()
    } catch (e) {
      message.error(`保存失败：${String(e instanceof Error ? e.message : e)}`)
    } finally {
      saveSubmitting.value = false
    }
  } else {
    saveSubmitting.value = true
    try {
      await call(window.api.scratch.saveToResource(pendingSavePayload))
      message.success('已保存到资源库')
      saveModalVisible.value = false
      pendingSavePayload = null
      if (activeTab.value === 'resources') await loadResources()
    } catch (e) {
      message.error(`保存失败：${String(e instanceof Error ? e.message : e)}`)
    } finally {
      saveSubmitting.value = false
    }
  }
}

// 事件订阅（preload 的 subscribe 函数：传入 handler，返回 unsubscribe）
type SaveHandler = (payload: ScratchSavePayload) => void
type SubscribeSave = (handler: SaveHandler) => () => void
let offScratchSave: (() => void) | null = null
let offRefresh: (() => void) | null = null
let offNewItem: (() => void) | null = null

onMounted(() => {
  loadIdeas()
  loadResources()
  loadLessons()

  const subscribe = window.events['scratch:save-request'] as unknown as SubscribeSave
  offScratchSave = subscribe((payload) => {
    handleScratchSave(payload)
  })

  // 快捷键订阅
  offRefresh = subscribeRefresh(() => {
    loadIdeas()
    loadResources()
    loadLessons()
  })
  offNewItem = subscribeNewItem(openNewIdeaModal)
})

onUnmounted(() => {
  offScratchSave?.()
  offScratchSave = null
  offRefresh?.()
  offRefresh = null
  offNewItem?.()
  offNewItem = null
})
</script>

<template>
  <div class="page-container">
    <a-tabs v-model:activeKey="activeTab" class="prep-tabs">
      <!-- ============ 点子库 ============ -->
      <a-tab-pane key="ideas">
        <template #tab>
          <span><BulbOutlined /> 点子库</span>
        </template>

        <div class="tab-toolbar">
          <span class="section-title">点子库</span>
          <a-space>
            <a-button @click="loadIdeas"><ReloadOutlined /> 刷新</a-button>
            <a-button type="primary" @click="openNewIdeaModal"><PlusOutlined /> 新建点子</a-button>
          </a-space>
        </div>

        <a-list
          :data-source="ideas"
          :loading="ideasLoading"
          :locale="{ emptyText: '暂无点子，点击「新建点子」开始记录灵感' }"
        >
          <template #renderItem="{ item }">
            <a-card class="idea-card" size="small">
              <template #title>
                <div class="idea-title">
                  <span class="idea-name">{{ item.title }}</span>
                  <a-space :size="6">
                    <a-tag v-if="item.targetCourse" color="blue">{{ item.targetCourse }}</a-tag>
                    <a-tag :color="ideaStatusColor[item.status]">{{ ideaStatusText[item.status] }}</a-tag>
                  </a-space>
                </div>
              </template>
              <template #extra>
                <a-space :size="6">
                  <a-button size="small" @click="openNewVersionModal(item)">
                    <PlusCircleOutlined /> 新建版本
                  </a-button>
                  <a-popconfirm title="确认删除该点子？相关版本也将删除。" @confirm="removeIdea(item.id)">
                    <a-button size="small" danger><DeleteOutlined /></a-button>
                  </a-popconfirm>
                </a-space>
              </template>

              <p v-if="item.description" class="idea-desc">{{ item.description }}</p>
              <p v-else class="idea-desc idea-desc-empty">暂无描述</p>

              <div class="idea-meta">
                <span>创建于 {{ formatDate(item.createdAt) }}</span>
                <span>更新于 {{ formatDate(item.updatedAt) }}</span>
              </div>

              <div class="version-toggle">
                <a-button type="link" size="small" @click="toggleVersions(item.id)">
                  {{ expandedMap[item.id] ? '收起版本' : '展开版本' }}（{{ item.versions?.length || 0 }}）
                </a-button>
              </div>

              <div v-if="expandedMap[item.id]" class="version-list">
                <a-empty
                  v-if="!item.versions || item.versions.length === 0"
                  description="暂无版本，点击「新建版本」归档你的 Scratch 作品"
                  :image="undefined"
                />
                <a-list v-else :data-source="item.versions" size="small">
                  <template #renderItem="{ item: ver }">
                    <a-list-item>
                      <a-list-item-meta>
                        <template #title>
                          <span class="ver-name">{{ ver.versionName }}</span>
                        </template>
                        <template #description>
                          <div class="ver-notes">{{ ver.notes || '无备注' }}</div>
                          <div class="ver-date">{{ formatDate(ver.createdAt) }}</div>
                        </template>
                      </a-list-item-meta>
                      <template #actions>
                        <a-button type="primary" size="small" @click="launchVersion(ver.id)">
                          <PlayCircleOutlined /> 开始创作
                        </a-button>
                        <a-popconfirm title="确认删除该版本？" @confirm="removeVersion(ver.id)">
                          <a-button size="small" danger><DeleteOutlined /></a-button>
                        </a-popconfirm>
                      </template>
                    </a-list-item>
                  </template>
                </a-list>
              </div>
            </a-card>
          </template>
        </a-list>
      </a-tab-pane>

      <!-- ============ 资源库 ============ -->
      <a-tab-pane key="resources">
        <template #tab>
          <span><AppstoreOutlined /> 资源库</span>
        </template>

        <div class="tab-toolbar">
          <span class="section-title">资源库</span>
          <a-space>
            <a-button @click="loadResources"><ReloadOutlined /> 刷新</a-button>
            <a-button type="primary" @click="importResource"><ImportOutlined /> 导入素材</a-button>
          </a-space>
        </div>

        <div class="filter-row">
          <a-select
            v-model:value="resourceFilter.type"
            style="width: 140px"
            @change="loadResources"
          >
            <a-select-option value="">全部类型</a-select-option>
            <a-select-option value="backdrop">背景</a-select-option>
            <a-select-option value="sprite">角色</a-select-option>
            <a-select-option value="sound">音效</a-select-option>
          </a-select>
          <a-select
            v-model:value="resourceFilter.tag"
            style="width: 160px"
            placeholder="全部标签"
            allow-clear
            @change="loadResources"
          >
            <a-select-option v-for="t in resourceTags" :key="t" :value="t">
              {{ t }}
            </a-select-option>
          </a-select>
          <a-input-search
            v-model:value="resourceFilter.keyword"
            placeholder="按名称搜索素材"
            style="width: 260px"
            allow-clear
            @search="loadResources"
          />
        </div>

        <a-table
          :data-source="resources"
          :columns="resourceColumns"
          :loading="resourcesLoading"
          row-key="id"
          :pagination="{ pageSize: 8, size: 'small' }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <a-tag :color="resourceTypeColor[record.type as ResourceType]">
                {{ resourceTypeText[record.type as ResourceType] }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'tags'">
              <template v-if="record.tags && record.tags.length">
                <a-tag v-for="t in record.tags" :key="t">{{ t }}</a-tag>
              </template>
              <span v-else class="text-muted">-</span>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDate(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-popconfirm title="确认删除该素材？" @confirm="removeResource(record.id)">
                <a-button size="small" danger><DeleteOutlined /> 删除</a-button>
              </a-popconfirm>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- ============ 文档中心 ============ -->
      <a-tab-pane key="docs">
        <template #tab>
          <span><FileTextOutlined /> 文档中心</span>
        </template>

        <span class="section-title">文档中心</span>

        <a-card class="docs-card" size="small">
          <a-alert
            class="docs-alert"
            type="info"
            show-icon
            message="应用内嵌入语雀文档预览"
            description="在 URL 中粘贴语雀文档地址，点击「嵌入预览」即可在应用内查看。首次使用需在 webview 中登录语雀账号。如遇登录受限，可使用「在浏览器打开」。"
          />

          <a-form layout="vertical" class="docs-form">
            <a-form-item label="语雀文档 URL">
              <a-input
                v-model:value="docForm.url"
                placeholder="https://www.yuque.com/..."
                allow-clear
              />
            </a-form-item>
            <a-form-item label="文档标题">
              <a-input v-model:value="docForm.title" placeholder="为该文档起一个标题" allow-clear />
            </a-form-item>
            <a-form-item label="关联课次">
              <a-select
                v-model:value="docForm.lessonId"
                placeholder="选择要关联的课次"
                :loading="lessonsLoading"
                :options="lessonOptions"
                show-search
                option-filter-prop="label"
                allow-clear
              />
            </a-form-item>
            <a-space>
              <a-button
                type="primary"
                :disabled="!canLinkDoc"
                @click="linkDoc"
              >
                <LinkOutlined /> 关联到课次
              </a-button>
              <a-button :disabled="!docForm.url" @click="embedDoc">
                <EyeOutlined /> 嵌入预览
              </a-button>
              <a-button :disabled="!docForm.url" @click="openDocInBrowser">
                <GlobalOutlined /> 在浏览器打开
              </a-button>
            </a-space>
          </a-form>
        </a-card>

        <!-- Webview 嵌入预览区 -->
        <a-card v-if="embeddedDocUrl" class="docs-preview" size="small" :bordered="true">
          <template #title>
            <span><EyeOutlined /> {{ embeddedDocTitle || '文档预览' }}</span>
          </template>
          <template #extra>
            <a-button size="small" type="text" @click="closeEmbed"><CloseOutlined /></a-button>
          </template>
          <webview
            :src="embeddedDocUrl"
            class="docs-webview"
            :useragent="webviewUserAgent"
            allowpopups
          />
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <!-- ============ 新建点子 Modal ============ -->
    <a-modal
      v-model:open="newIdeaModalVisible"
      title="新建点子"
      :confirm-loading="newIdeaSubmitting"
      @ok="submitNewIdea"
    >
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="newIdeaForm.title" placeholder="一句话描述你的灵感" />
        </a-form-item>
        <a-form-item label="目标课程">
          <a-input v-model:value="newIdeaForm.targetCourse" placeholder="如：Scratch 入门、Python 进阶" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="newIdeaForm.description" :rows="3" placeholder="详细描述点子内容、教学目标等" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="newIdeaForm.status">
            <a-select-option value="idea">点子</a-select-option>
            <a-select-option value="developing">开发中</a-select-option>
            <a-select-option value="archived">已归档</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ============ 新建版本 Modal ============ -->
    <a-modal
      v-model:open="newVersionModalVisible"
      :title="`新建版本 - ${newVersionIdeaTitle}`"
      :confirm-loading="newVersionSubmitting"
      @ok="submitNewVersion"
    >
      <a-form layout="vertical">
        <a-form-item label="版本名称" required>
          <a-input v-model:value="newVersionForm.versionName" placeholder="如 v1.0" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="newVersionForm.notes" :rows="3" placeholder="本次版本的改动说明（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ============ Scratch 保存归档 Modal ============ -->
    <a-modal
      v-model:open="saveModalVisible"
      title="保存到"
      :confirm-loading="saveSubmitting"
      :ok-text="saveTarget === 'idea' ? '保存到点子库' : '保存到资源库'"
      @ok="submitSave"
    >
      <a-radio-group v-model:value="saveTarget" class="save-radio">
        <a-radio value="idea">保存到点子库（作为某点子的新版本）</a-radio>
        <a-radio value="resource">保存到资源库（作为可复用素材）</a-radio>
      </a-radio-group>

      <div v-if="saveTarget === 'idea'" class="save-idea-form">
        <a-form layout="vertical">
          <a-form-item label="所属点子" required>
            <a-select
              v-model:value="saveForm.ideaId"
              placeholder="选择目标点子"
              :loading="saveIdeasLoading"
              :options="ideaSelectOptions"
              show-search
              option-filter-prop="label"
            />
          </a-form-item>
          <a-form-item label="版本名称" required>
            <a-input v-model:value="saveForm.versionName" placeholder="如 v1.0" />
          </a-form-item>
          <a-form-item label="备注">
            <a-textarea v-model:value="saveForm.notes" :rows="3" placeholder="版本备注（可选）" />
          </a-form-item>
        </a-form>
      </div>
      <div v-else class="save-resource-tip">
        <a-alert
          type="info"
          show-icon
          message="将作为通用素材保存到资源库，可在「资源库」标签页中管理。"
        />
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.prep-tabs {
  height: 100%;
}
.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.idea-card {
  margin-bottom: 12px;
}
.idea-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.idea-name {
  font-weight: 600;
}
.idea-desc {
  color: #374151;
  margin: 0 0 8px;
  white-space: pre-wrap;
}
.idea-desc-empty {
  color: #9ca3af;
}
.idea-meta {
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  gap: 16px;
}
.version-toggle {
  margin-top: 4px;
}
.version-list {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
}
.ver-name {
  font-weight: 600;
}
.ver-notes {
  color: #4b5563;
}
.ver-date {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}
.filter-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.docs-card {
  max-width: 640px;
}
.docs-alert {
  margin-bottom: 16px;
}
.docs-form {
  max-width: 560px;
}
.docs-preview {
  margin-top: 16px;
}
.docs-webview {
  display: block;
  width: 100%;
  height: 520px;
  border: 1px solid #eef0f4;
  border-radius: 6px;
  background: #fff;
}
.text-muted {
  color: #9ca3af;
}
.save-radio {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.save-idea-form {
  border-top: 1px solid #eef0f4;
  padding-top: 12px;
}
.save-resource-tip {
  border-top: 1px solid #eef0f4;
  padding-top: 12px;
}
</style>
