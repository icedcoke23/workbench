<template>
  <div class="page-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-input-search
        v-model:value="keyword"
        placeholder="按姓名搜索学生"
        style="width: 240px"
        allow-clear
        @search="loadStudents"
      />
      <a-space>
        <a-button @click="loadStudents"><ReloadOutlined /> 刷新</a-button>
        <a-button type="primary" @click="openCreate"><PlusOutlined /> 新增学生</a-button>
      </a-space>
    </div>

    <!-- 学生表格 -->
    <a-table
      :data-source="students"
      :columns="columns"
      :loading="loading"
      row-key="id"
      :pagination="{ pageSize: 10, size: 'small' }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <div class="student-name-cell">
            <a-avatar :size="28" :src="record.avatarPath || undefined">
              {{ record.avatarPath ? '' : record.name.charAt(0) }}
            </a-avatar>
            <span>{{ record.name }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'grade'">
          {{ record.grade || '-' }}
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
          <a-space :size="4">
            <a-button type="link" size="small" @click="openHistory(record)">
              <HistoryOutlined /> 历史
            </a-button>
            <a-button type="link" size="small" @click="openEdit(record)">
              <EditOutlined /> 编辑
            </a-button>
            <a-popconfirm title="确认删除该学生？" @confirm="removeStudent(record.id)">
              <a-button type="link" size="small" danger><DeleteOutlined /> 删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="formVisible"
      :title="editingId ? '编辑学生' : '新增学生'"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitForm"
    >
      <a-form layout="vertical">
        <a-form-item label="姓名" required>
          <a-input v-model:value="form.name" placeholder="请输入学生姓名" />
        </a-form-item>
        <a-form-item label="年级">
          <a-input v-model:value="form.grade" placeholder="如：三年级" />
        </a-form-item>
        <a-form-item label="标签">
          <a-select
            v-model:value="form.tags"
            mode="tags"
            placeholder="输入后回车添加标签"
            style="width: 100%"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 学习历史抽屉 -->
    <StudentHistoryDrawer v-model:open="historyOpen" :student-id="historyStudentId" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { call } from '@renderer/api'
import { subscribeRefresh, subscribeNewItem } from '@renderer/composables/useShortcuts'
import StudentHistoryDrawer from '@renderer/components/StudentHistoryDrawer.vue'
import type { Student, StudentInput } from '@shared/types'

const students = ref<Student[]>([])
const loading = ref(false)
const keyword = ref('')

const columns = [
  { title: '姓名', key: 'name' },
  { title: '年级', key: 'grade', width: 100 },
  { title: '标签', key: 'tags' },
  { title: '创建时间', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 260, fixed: 'right' as const }
]

// 新增/编辑表单
const formVisible = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<{ name: string; grade: string; tags: string[] }>({
  name: '',
  grade: '',
  tags: []
})

// 学习历史抽屉
const historyOpen = ref(false)
const historyStudentId = ref<string | null>(null)

function formatDate(d: string): string {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
}

async function loadStudents(): Promise<void> {
  loading.value = true
  try {
    students.value = await call(
      window.api.student.list({ keyword: keyword.value.trim() || undefined })
    )
  } catch (e) {
    message.error(String(e))
  } finally {
    loading.value = false
  }
}

function resetForm(): void {
  form.name = ''
  form.grade = ''
  form.tags = []
  editingId.value = null
}

function openCreate(): void {
  resetForm()
  formVisible.value = true
}

function openEdit(record: Student): void {
  editingId.value = record.id
  form.name = record.name
  form.grade = record.grade || ''
  form.tags = [...(record.tags || [])]
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  if (!form.name.trim()) {
    message.warning('请输入学生姓名')
    return
  }
  const input: StudentInput = {
    name: form.name.trim(),
    grade: form.grade.trim() || undefined,
    tags: form.tags
  }
  submitting.value = true
  try {
    if (editingId.value) {
      await call(window.api.student.update(editingId.value, input))
      message.success('已更新')
    } else {
      await call(window.api.student.create(input))
      message.success('已新增')
    }
    formVisible.value = false
    await loadStudents()
  } catch (e) {
    message.error(String(e))
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
    message.error(String(e))
  }
}

function openHistory(s: Student): void {
  historyStudentId.value = s.id
  historyOpen.value = true
}

let offRefresh: (() => void) | null = null
let offNewItem: (() => void) | null = null
onMounted(() => {
  loadStudents()
  // 订阅全局刷新与新增事件
  offRefresh = subscribeRefresh(loadStudents)
  offNewItem = subscribeNewItem(openCreate, 'students')
})
onUnmounted(() => {
  offRefresh?.()
  offRefresh = null
  offNewItem?.()
  offNewItem = null
})
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.student-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.text-muted {
  color: #9ca3af;
}
</style>
