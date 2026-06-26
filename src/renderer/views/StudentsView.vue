<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  HistoryOutlined
} from '@ant-design/icons-vue'
import { call } from '@renderer/api'
import dayjs from 'dayjs'
import type { Student } from '@shared/types'
import StudentHistoryDrawer from '@renderer/components/StudentHistoryDrawer.vue'
import { subscribeRefresh, subscribeNewItem } from '@renderer/composables/useShortcuts'

const students = ref<Student[]>([])
const loading = ref(false)
const keyword = ref('')
const filterTag = ref<string | undefined>(undefined)
const allTags = ref<string[]>([])

// 学生学习历史抽屉
const historyOpen = ref(false)
const historyStudentId = ref<string | null>(null)

function openHistory(s: Student): void {
  historyStudentId.value = s.id
  historyOpen.value = true
}

const columns = [
  { title: '姓名', key: 'name', width: 200 },
  { title: '年级', key: 'grade', width: 120 },
  { title: '标签', key: 'tags' },
  { title: '创建时间', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 260 }
]

const formVisible = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<{ name: string; grade: string; avatarPath: string; tags: string[] }>({
  name: '',
  grade: '',
  avatarPath: '',
  tags: []
})

function formatDate(s: string): string {
  return dayjs(s).format('YYYY-MM-DD')
}

async function loadStudents(): Promise<void> {
  loading.value = true
  try {
    const list = await call(window.api.student.list({ keyword: keyword.value.trim() || undefined }))
    // 本地按标签过滤（repo 不直接支持 tag 查询）
    students.value = filterTag.value
      ? list.filter((s) => s.tags.includes(filterTag.value!))
      : list
    // 收集所有标签
    const tagSet = new Set<string>()
    list.forEach((s) => s.tags.forEach((t) => tagSet.add(t)))
    allTags.value = [...tagSet].sort()
  } catch (e) {
    message.error(`加载失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.name = ''
  form.grade = ''
  form.avatarPath = ''
  form.tags = []
  formVisible.value = true
}

function openEdit(s: Student): void {
  editingId.value = s.id
  form.name = s.name
  form.grade = s.grade ?? ''
  form.avatarPath = s.avatarPath ?? ''
  form.tags = [...s.tags]
  formVisible.value = true
}

async function pickAvatar(): Promise<void> {
  try {
    const srcPath = await call(window.api.file.pickImage())
    if (!srcPath) return
    const savedPath = await call(window.api.file.saveAvatar(srcPath, form.name || 'student'))
    form.avatarPath = savedPath
  } catch (e) {
    message.error(`选择头像失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function onSubmit(): Promise<void> {
  if (!form.name.trim()) {
    message.warning('请输入学生姓名')
    return
  }
  submitting.value = true
  try {
    const input = {
      name: form.name.trim(),
      grade: form.grade.trim() || null,
      avatarPath: form.avatarPath || null,
      tags: form.tags
    }
    if (editingId.value) {
      await call(window.api.student.update(editingId.value, input))
      message.success('已更新')
    } else {
      await call(window.api.student.create(input))
      message.success('已新增学生')
    }
    formVisible.value = false
    await loadStudents()
  } catch (e) {
    message.error(`保存失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    submitting.value = false
  }
}

async function removeStudent(id: string): Promise<void> {
  try {
    await call(window.api.student.remove(id))
    message.success('已删除')
    await loadStudents()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

onMounted(() => {
  loadStudents()
  subscribeRefresh(loadStudents)
  subscribeNewItem(openCreate)
})
</script>

<template>
  <div class="page-container">
    <div class="section-title"><TeamOutlined /> 学生管理</div>

    <a-card :bordered="false">
      <div class="toolbar">
        <a-input-search
          v-model:value="keyword"
          placeholder="按姓名搜索学生"
          style="width: 260px"
          allow-clear
          @search="loadStudents"
        />
        <a-space>
          <a-select
            v-model:value="filterTag"
            style="width: 160px"
            placeholder="全部标签"
            allow-clear
            @change="loadStudents"
          >
            <a-select-option v-for="t in allTags" :key="t" :value="t">{{ t }}</a-select-option>
          </a-select>
          <a-button @click="loadStudents"><ReloadOutlined /> 刷新</a-button>
          <a-button type="primary" @click="openCreate"><PlusOutlined /> 新增学生</a-button>
        </a-space>
      </div>

      <a-table
        :data-source="students"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 12, size: 'small' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-avatar :size="32" :src="record.avatarPath || undefined">
              {{ record.avatarPath ? '' : record.name.charAt(0) }}
            </a-avatar>
            <span style="margin-left: 8px">{{ record.name }}</span>
          </template>
          <template v-else-if="column.key === 'grade'">
            {{ record.grade || '-' }}
          </template>
          <template v-else-if="column.key === 'tags'">
            <a-tag v-for="t in record.tags" :key="t" color="blue">{{ t }}</a-tag>
            <span v-if="!record.tags.length" class="text-muted">-</span>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button size="small" @click="openHistory(record)"><HistoryOutlined /> 历史</a-button>
            <a-button size="small" @click="openEdit(record)"><EditOutlined /> 编辑</a-button>
            <a-popconfirm title="确认删除该学生？" @confirm="removeStudent(record.id)">
              <a-button size="small" danger><DeleteOutlined /> 删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 学生学习历史抽屉 -->
    <StudentHistoryDrawer v-model:open="historyOpen" :student-id="historyStudentId" />

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="formVisible"
      :title="editingId ? '编辑学生' : '新增学生'"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="onSubmit"
    >
      <a-form layout="vertical" :model="form">
        <a-form-item label="姓名" required>
          <a-input v-model:value="form.name" placeholder="请输入学生姓名" />
        </a-form-item>
        <a-form-item label="年级">
          <a-input v-model:value="form.grade" placeholder="如：三年级" />
        </a-form-item>
        <a-form-item label="头像">
          <a-space align="center">
            <a-avatar :size="64" :src="form.avatarPath || undefined">
              {{ form.avatarPath ? '' : form.name?.charAt(0) || '?' }}
            </a-avatar>
            <a-button @click="pickAvatar"><UploadOutlined /> 选择图片</a-button>
            <a-button v-if="form.avatarPath" danger size="small" @click="form.avatarPath = ''">
              清除
            </a-button>
          </a-space>
        </a-form-item>
        <a-form-item label="标签">
          <a-select
            v-model:value="form.tags"
            mode="tags"
            placeholder="输入标签后回车，如：集训、试听"
            style="width: 100%"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.text-muted {
  color: #bbb;
}
</style>
