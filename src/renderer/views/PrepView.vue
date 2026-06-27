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
                  <a-button size="small" @click="openEditIdeaModal(item)">
                    <EditOutlined /> 编辑
                  </a-button>
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
                          <span class="ver-name">
                            {{ ver.versionName }}
                            <a-tag v-if="!ver.filePath" color="default" size="small">空版本</a-tag>
                            <a-tag v-else color="green" size="small">有作品</a-tag>
                          </span>
                        </template>
                        <template #description>
                          <div class="ver-notes">{{ ver.notes || '无备注' }}</div>
                          <div class="ver-date">{{ formatDate(ver.createdAt) }}</div>
                        </template>
                      </a-list-item-meta>
                      <template #actions>
                        <a-button size="small" :loading="previewingId === ver.id" @click="openVersionPreview(ver)">
                          <EyeOutlined /> 预览
                        </a-button>
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
            style="width: 180px"
            placeholder="按标签筛选"
            allow-clear
            show-search
            :options="tagOptions"
            @change="loadResources"
          />
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
              <a-space :size="6">
                <a-button size="small" @click="openResourcePreview(record)">
                  <EyeOutlined /> 预览
                </a-button>
                <a-button size="small" @click="openEditResourceModal(record)">
                  <EditOutlined /> 编辑
                </a-button>
                <a-popconfirm title="确认删除该素材？" @confirm="removeResource(record.id)">
                  <a-button size="small" danger><DeleteOutlined /></a-button>
                </a-popconfirm>
              </a-space>
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
            message="Webview 嵌入语雀需登录，建议用浏览器打开"
            description="语雀文档在应用内嵌 Webview 中通常需要额外登录态，体验受限。如遇无法查看，请使用「在浏览器打开」按钮在外部浏览器中阅读。"
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
              <a-button :disabled="!docForm.url" @click="openDocInBrowser">
                <GlobalOutlined /> 在浏览器打开
              </a-button>
            </a-space>
          </a-form>
        </a-card>

        <!-- 已关联文档列表 -->
        <a-card title="已关联文档" class="docs-list-card" size="small" style="margin-top: 16px">
          <template #extra>
            <a-button size="small" @click="loadDocLinks"><ReloadOutlined /> 刷新</a-button>
          </template>
          <a-empty v-if="docLinks.length === 0" description="暂无关联文档" />
          <a-list v-else :data-source="docLinks" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta>
                  <template #title>
                    <a class="doc-link-title" @click="openDocUrl(item.url)">
                      {{ item.title || item.url }}
                    </a>
                  </template>
                  <template #description>
                    <span class="doc-link-meta">
                      <a-tag v-if="item.class_name" color="blue">{{ item.class_name }}</a-tag>
                      <span v-if="item.lesson_start_time">{{ formatDate(item.lesson_start_time) }}</span>
                      <span class="doc-link-url">{{ item.url }}</span>
                    </span>
                  </template>
                </a-list-item-meta>
                <template #actions>
                  <a-button size="small" @click="openDocUrl(item.url)">
                    <GlobalOutlined /> 打开
                  </a-button>
                  <a-popconfirm title="确认取消该文档关联？" @confirm="removeDocLink(item.id)">
                    <a-button size="small" danger><DeleteOutlined /></a-button>
                  </a-popconfirm>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <!-- ============ 新建/编辑点子 Modal ============ -->
    <a-modal
      v-model:open="newIdeaModalVisible"
      :title="editingIdeaId ? '编辑点子' : '新建点子'"
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
      <div v-else class="save-resource-form">
        <a-alert
          type="info"
          show-icon
          message="将作为通用素材保存到资源库，可在「资源库」标签页中管理。"
          style="margin-bottom: 12px"
        />
        <a-form layout="vertical">
          <a-form-item label="素材类型" required>
            <a-radio-group v-model:value="saveForm.resourceType">
              <a-radio-button value="sprite">角色</a-radio-button>
              <a-radio-button value="backdrop">背景</a-radio-button>
              <a-radio-button value="sound">音效</a-radio-button>
            </a-radio-group>
          </a-form-item>
        </a-form>
      </div>
    </a-modal>

    <!-- ============ 编辑资源 Modal（标签 + 名称） ============ -->
    <a-modal
      v-model:open="editResourceModalVisible"
      title="编辑素材"
      :confirm-loading="editResourceSubmitting"
      @ok="submitEditResource"
    >
      <a-form layout="vertical">
        <a-form-item label="名称" required>
          <a-input v-model:value="editResourceForm.name" placeholder="素材名称" />
        </a-form-item>
        <a-form-item label="标签">
          <a-select
            v-model:value="editResourceForm.tags"
            mode="tags"
            placeholder="输入标签后回车添加，可选择已有标签"
            :options="tagOptions"
            :token-separators="[',']"
            allow-clear
          />
          <div class="tag-tip">提示：输入文本后按回车或逗号添加标签，已使用的标签会自动出现在候选项中。</div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ============ 版本预览 Modal ============ -->
    <a-modal
      v-model:open="versionPreviewVisible"
      :title="`版本预览 - ${versionPreviewTitle}`"
      :footer="null"
      width="480px"
    >
      <a-spin :spinning="versionPreviewLoading">
        <div v-if="versionPreviewMeta" class="version-preview">
          <a-empty
            v-if="!versionPreviewMeta.hasFile"
            description="该版本暂无作品文件，点击「开始创作」可从空白开始创建"
          />
          <div v-else>
            <a-descriptions :column="2" size="small" bordered>
              <a-descriptions-item label="角色数">
                {{ versionPreviewMeta.spriteCount }}
              </a-descriptions-item>
              <a-descriptions-item label="脚本数">
                {{ versionPreviewMeta.scriptCount }}
              </a-descriptions-item>
              <a-descriptions-item label="造型数">
                {{ versionPreviewMeta.costumeCount }}
              </a-descriptions-item>
              <a-descriptions-item label="音效数">
                {{ versionPreviewMeta.soundCount }}
              </a-descriptions-item>
              <a-descriptions-item label="文件大小" :span="2">
                {{ formatFileSize(versionPreviewMeta.fileSize) }}
              </a-descriptions-item>
            </a-descriptions>
            <div v-if="versionPreviewMeta.spriteNames.length > 0" class="preview-sprites">
              <span class="preview-sprites-label">包含角色：</span>
              <a-tag v-for="name in versionPreviewMeta.spriteNames" :key="name" color="blue">
                {{ name }}
              </a-tag>
            </div>
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- ============ 资源预览 Modal ============ -->
    <a-modal
      v-model:open="resourcePreviewVisible"
      :title="`素材预览 - ${resourcePreviewTitle}`"
      :footer="null"
      width="520px"
    >
      <a-spin :spinning="resourcePreviewLoading">
        <div class="resource-preview">
          <a-empty
            v-if="!resourcePreviewUrl"
            description="无法预览该素材（文件可能已丢失或不支持预览）"
          />
          <div v-else-if="resourcePreviewType === 'sound'" class="preview-audio">
            <audio :src="resourcePreviewUrl" controls style="width: 100%"></audio>
          </div>
          <div v-else class="preview-image">
            <a-image :src="resourcePreviewUrl" :width="460" />
          </div>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

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
  EditOutlined,
  EyeOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { call } from '@renderer/api'
import { subscribeRefresh, subscribeNewItem } from '@renderer/composables/useShortcuts'
import type {
  Idea,
  IdeaStatus,
  IdeaVersion,
  Resource,
  ResourceType,
  Lesson,
  ScratchSavePayload,
  VersionMeta,
  DocLinkWithLesson
} from '@shared/types'

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

// 版本预览
const versionPreviewVisible = ref(false)
const versionPreviewLoading = ref(false)
const versionPreviewTitle = ref('')
const versionPreviewMeta = ref<VersionMeta | null>(null)
const previewingId = ref<string | null>(null)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function openVersionPreview(ver: IdeaVersion): Promise<void> {
  versionPreviewTitle.value = ver.versionName
  versionPreviewMeta.value = null
  versionPreviewVisible.value = true
  previewingId.value = ver.id
  versionPreviewLoading.value = true
  try {
    const meta = await call(window.api.idea.getVersionMeta(ver.id))
    versionPreviewMeta.value = meta
  } catch (e) {
    message.error(`预览失败：${String(e instanceof Error ? e.message : e)}`)
    versionPreviewVisible.value = false
  } finally {
    versionPreviewLoading.value = false
    previewingId.value = null
  }
}

// 新建/编辑点子
const newIdeaModalVisible = ref(false)
const newIdeaSubmitting = ref(false)
const editingIdeaId = ref<string | null>(null)
const newIdeaForm = reactive({
  title: '',
  targetCourse: '',
  description: '',
  status: 'idea' as IdeaStatus
})

function openNewIdeaModal(): void {
  editingIdeaId.value = null
  newIdeaForm.title = ''
  newIdeaForm.targetCourse = ''
  newIdeaForm.description = ''
  newIdeaForm.status = 'idea'
  newIdeaModalVisible.value = true
}

function openEditIdeaModal(idea: Idea): void {
  editingIdeaId.value = idea.id
  newIdeaForm.title = idea.title
  newIdeaForm.targetCourse = idea.targetCourse ?? ''
  newIdeaForm.description = idea.description ?? ''
  newIdeaForm.status = idea.status
  newIdeaModalVisible.value = true
}

async function submitNewIdea(): Promise<void> {
  if (!newIdeaForm.title.trim()) {
    message.warning('请输入标题')
    return
  }
  newIdeaSubmitting.value = true
  try {
    const payload = {
      title: newIdeaForm.title.trim(),
      targetCourse: newIdeaForm.targetCourse.trim() || undefined,
      description: newIdeaForm.description.trim() || undefined,
      status: newIdeaForm.status
    }
    if (editingIdeaId.value) {
      await call(window.api.idea.update(editingIdeaId.value, payload))
      message.success('点子已更新')
    } else {
      await call(window.api.idea.create(payload))
      message.success('点子已创建')
    }
    newIdeaModalVisible.value = false
    await loadIdeas()
  } catch (e) {
    message.error(`${editingIdeaId.value ? '更新' : '创建'}失败：${String(e instanceof Error ? e.message : e)}`)
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
const resourceFilter = reactive<{ type: string; keyword: string; tag: string | undefined }>({
  type: '',
  keyword: '',
  tag: undefined
})

const resourceColumns = [
  { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '标签', dataIndex: 'tags', key: 'tags' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 180 }
]

// 全部可用标签（用于筛选下拉与编辑时的可选项）
const allTags = ref<string[]>([])
const tagOptions = computed(() => allTags.value.map((t) => ({ value: t, label: t })))

async function loadAllTags(): Promise<void> {
  try {
    allTags.value = await call(window.api.resource.allTags())
  } catch {
    // 忽略错误，保留旧值
  }
}

async function loadResources(): Promise<void> {
  resourcesLoading.value = true
  try {
    resources.value = await call(
      window.api.resource.list({
        type: resourceFilter.type || undefined,
        keyword: resourceFilter.keyword.trim() || undefined,
        tag: resourceFilter.tag || undefined
      })
    )
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
    await loadAllTags()
  } catch (e) {
    message.error(`导入失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeResource(id: string): Promise<void> {
  try {
    await call(window.api.resource.remove(id))
    message.success('已删除素材')
    await loadResources()
    await loadAllTags()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// 资源预览
const resourcePreviewVisible = ref(false)
const resourcePreviewLoading = ref(false)
const resourcePreviewTitle = ref('')
const resourcePreviewUrl = ref('')
const resourcePreviewType = ref<ResourceType | ''>('')

async function openResourcePreview(record: Resource): Promise<void> {
  resourcePreviewTitle.value = record.name
  resourcePreviewUrl.value = ''
  resourcePreviewType.value = record.type
  resourcePreviewVisible.value = true
  resourcePreviewLoading.value = true
  try {
    const dataUrl = await call(window.api.resource.readFile(record.filePath))
    resourcePreviewUrl.value = dataUrl
  } catch (e) {
    message.error(`预览失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    resourcePreviewLoading.value = false
  }
}

// 资源编辑（标签 + 名称）
const editResourceModalVisible = ref(false)
const editResourceSubmitting = ref(false)
const editResourceForm = reactive<{ id: string; name: string; tags: string[] }>({
  id: '',
  name: '',
  tags: []
})

function openEditResourceModal(record: Resource): void {
  editResourceForm.id = record.id
  editResourceForm.name = record.name
  editResourceForm.tags = [...(record.tags || [])]
  editResourceModalVisible.value = true
}

async function submitEditResource(): Promise<void> {
  const name = editResourceForm.name.trim()
  if (!name) {
    message.warning('请输入名称')
    return
  }
  // 清理标签：去空白、去重
  const tags = Array.from(
    new Set(editResourceForm.tags.map((t) => t.trim()).filter(Boolean))
  )
  editResourceSubmitting.value = true
  try {
    await call(
      window.api.resource.update(editResourceForm.id, { name, tags })
    )
    message.success('已更新')
    editResourceModalVisible.value = false
    await loadResources()
    await loadAllTags()
  } catch (e) {
    message.error(`更新失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    editResourceSubmitting.value = false
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
    await loadDocLinks()
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

// 已关联文档列表
const docLinks = ref<DocLinkWithLesson[]>([])

async function loadDocLinks(): Promise<void> {
  try {
    docLinks.value = await call(window.api.doc.listAll())
  } catch (e) {
    message.error(`加载文档列表失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeDocLink(id: string): Promise<void> {
  try {
    await call(window.api.doc.removeLink(id))
    message.success('已取消关联')
    await loadDocLinks()
  } catch (e) {
    message.error(`取消关联失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function openDocUrl(url: string): Promise<void> {
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
const saveForm = reactive<{
  ideaId: string | undefined
  versionName: string
  notes: string
  resourceType: ResourceType
}>({
  ideaId: undefined,
  versionName: '',
  notes: '',
  resourceType: 'sprite'
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
  saveForm.resourceType = 'sprite'
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
      await call(window.api.scratch.saveToResource(pendingSavePayload, saveForm.resourceType))
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
// 全局刷新与新增项订阅取消函数
let offRefresh: (() => void) | null = null
let offNewItem: (() => void) | null = null

onMounted(() => {
  loadIdeas()
  loadResources()
  loadAllTags()
  loadLessons()
  loadDocLinks()

  const subscribe = window.events['scratch:save-request'] as unknown as SubscribeSave
  offScratchSave = subscribe((payload) => {
    handleScratchSave(payload)
  })

  // 订阅全局刷新事件：刷新时重新加载点子库、资源库、标签、课次、文档
  offRefresh = subscribeRefresh(() => {
    loadIdeas()
    loadResources()
    loadAllTags()
    loadLessons()
    loadDocLinks()
  })
  // 订阅全局新增事件：触发新建点子弹窗
  offNewItem = subscribeNewItem(openNewIdeaModal, 'prep')
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
.version-preview {
  min-height: 120px;
}
.preview-sprites {
  margin-top: 12px;
}
.preview-sprites-label {
  color: #6b7280;
  margin-right: 8px;
}
.resource-preview {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-image {
  text-align: center;
}
.preview-audio {
  width: 100%;
  padding: 24px 0;
}
.filter-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.docs-card {
  max-width: 640px;
}
.docs-list-card {
  max-width: 640px;
}
.doc-link-title {
  color: #1677ff;
  cursor: pointer;
}
.doc-link-title:hover {
  text-decoration: underline;
}
.doc-link-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.doc-link-url {
  color: #9ca3af;
  font-size: 12px;
  word-break: break-all;
}
.docs-alert {
  margin-bottom: 16px;
}
.docs-form {
  max-width: 560px;
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
.save-resource-form {
  border-top: 1px solid #eef0f4;
  padding-top: 12px;
}
.tag-tip {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}
</style>
