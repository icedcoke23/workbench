<template>
  <div class="page-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-input-search
        v-model:value="keyword"
        placeholder="按班级名称搜索"
        style="width: 240px"
        allow-clear
        @search="loadClasses"
      />
      <a-space>
        <a-button @click="loadClasses"><ReloadOutlined /> 刷新</a-button>
        <a-button type="primary" @click="openCreate"><PlusOutlined /> 新增班级</a-button>
      </a-space>
    </div>

    <!-- 班级表格 -->
    <a-table
      :data-source="classes"
      :columns="columns"
      :loading="loading"
      row-key="id"
      :pagination="{ pageSize: 10, size: 'small' }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">{{ record.name }}</template>
        <template v-else-if="column.key === 'type'">
          <a-tag :color="classTypeColor[record.type as ClassType]">
            {{ classTypeText[record.type as ClassType] }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'schedule'">
          {{ formatSchedule(record.scheduleRule) }}
        </template>
        <template v-else-if="column.key === 'studentCount'">
          {{ record.studentCount ?? 0 }} 人
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatDate(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="openMembers(record)">
              <TeamOutlined /> 成员
            </a-button>
            <a-button type="link" size="small" @click="openEdit(record)">
              <EditOutlined /> 编辑
            </a-button>
            <a-popconfirm title="确认删除该班级？" @confirm="removeClass(record.id)">
              <a-button type="link" size="small" danger><DeleteOutlined /> 删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="formVisible"
      :title="editingId ? '编辑班级' : '新增班级'"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitForm"
    >
      <a-form layout="vertical">
        <a-form-item label="班级名称" required>
          <a-input v-model:value="form.name" placeholder="如：周六 Scratch 入门班" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="班级类型">
              <a-select v-model:value="form.type">
                <a-select-option value="regular">常规</a-select-option>
                <a-select-option value="training">集训</a-select-option>
                <a-select-option value="temp">试听</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="上课星期">
              <a-select v-model:value="form.weekday">
                <a-select-option v-for="(w, i) in WEEKDAY_OPTIONS" :key="i" :value="w.value">
                  {{ w.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="开始时间">
              <a-time-picker
                v-model:value="form.startTime"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="结束时间">
              <a-time-picker
                v-model:value="form.endTime"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="科目">
          <a-input v-model:value="form.subject" placeholder="如：Scratch 游戏" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 成员管理 Modal -->
    <a-modal
      v-model:open="membersVisible"
      :title="`成员管理 - ${membersClassName}`"
      width="560px"
      :footer="null"
    >
      <div class="members-add">
        <a-select
          v-model:value="selectedStudentIds"
          mode="multiple"
          placeholder="选择要添加的学生"
          :options="allStudentOptions"
          style="flex: 1"
          show-search
          option-filter-prop="label"
        />
        <a-button type="primary" :disabled="!selectedStudentIds.length" @click="addMembers">
          添加
        </a-button>
      </div>
      <a-table
        :data-source="members"
        :columns="memberColumns"
        row-key="id"
        size="small"
        :pagination="false"
        style="margin-top: 12px"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="member-name-cell">
              <a-avatar :size="24" :src="record.avatarPath || undefined">
                {{ record.avatarPath ? '' : record.name.charAt(0) }}
              </a-avatar>
              <span>{{ record.name }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" danger @click="removeMember(record.id)">
              移除
            </a-button>
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { call } from '@renderer/api'
import { subscribeRefresh, subscribeNewItem } from '@renderer/composables/useShortcuts'
import type { ClassInfo, ClassInput, ClassType, Student } from '@shared/types'

const classTypeText: Record<ClassType, string> = {
  regular: '常规',
  training: '集训',
  temp: '试听'
}
const classTypeColor: Record<ClassType, string> = {
  regular: 'blue',
  training: 'orange',
  temp: 'green'
}

// 星期选项：0=周日 ... 6=周六（与 ScheduleRule.weekday 一致）
const WEEKDAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
]
const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const classes = ref<ClassInfo[]>([])
const loading = ref(false)
const keyword = ref('')

const columns = [
  { title: '班级名称', key: 'name' },
  { title: '类型', key: 'type', width: 90 },
  { title: '上课时间', key: 'schedule' },
  { title: '人数', key: 'studentCount', width: 90 },
  { title: '创建时间', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 240, fixed: 'right' as const }
]

// 新增/编辑表单
const formVisible = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<{
  name: string
  type: ClassType
  weekday: number
  startTime: string
  endTime: string
  subject: string
}>({
  name: '',
  type: 'regular',
  weekday: 1,
  startTime: '09:00',
  endTime: '10:30',
  subject: ''
})

// 成员管理
const membersVisible = ref(false)
const membersClassName = ref('')
const currentClassId = ref<string | null>(null)
const members = ref<Student[]>([])
const allStudents = ref<Student[]>([])
const selectedStudentIds = ref<string[]>([])

const allStudentOptions = computed(() =>
  allStudents.value.map((s) => ({ value: s.id, label: s.name }))
)

const memberColumns = [
  { title: '学生', key: 'name' },
  { title: '操作', key: 'action', width: 80 }
]

function formatDate(d: string): string {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
}

function formatSchedule(rule: ClassInfo['scheduleRule']): string {
  if (!rule) return '-'
  return `${WEEKDAY_TEXT[rule.weekday] ?? ''} ${rule.startTime}-${rule.endTime}${
    rule.subject ? ' (' + rule.subject + ')' : ''
  }`
}

async function loadClasses(): Promise<void> {
  loading.value = true
  try {
    classes.value = await call(
      window.api.class.list({ keyword: keyword.value.trim() || undefined })
    )
  } catch (e) {
    message.error(String(e))
  } finally {
    loading.value = false
  }
}

function resetForm(): void {
  form.name = ''
  form.type = 'regular'
  form.weekday = 1
  form.startTime = '09:00'
  form.endTime = '10:30'
  form.subject = ''
  editingId.value = null
}

function openCreate(): void {
  resetForm()
  formVisible.value = true
}

function openEdit(record: ClassInfo): void {
  editingId.value = record.id
  form.name = record.name
  form.type = record.type
  form.weekday = record.scheduleRule?.weekday ?? 1
  form.startTime = record.scheduleRule?.startTime ?? '09:00'
  form.endTime = record.scheduleRule?.endTime ?? '10:30'
  form.subject = record.scheduleRule?.subject ?? ''
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  if (!form.name.trim()) {
    message.warning('请输入班级名称')
    return
  }
  const input: ClassInput = {
    name: form.name.trim(),
    type: form.type,
    scheduleRule: {
      weekday: form.weekday,
      startTime: form.startTime,
      endTime: form.endTime,
      subject: form.subject.trim() || undefined
    }
  }
  submitting.value = true
  try {
    if (editingId.value) {
      await call(window.api.class.update(editingId.value, input))
      message.success('已更新')
    } else {
      await call(window.api.class.create(input))
      message.success('已新增')
    }
    formVisible.value = false
    await loadClasses()
  } catch (e) {
    message.error(String(e))
  } finally {
    submitting.value = false
  }
}

async function removeClass(id: string): Promise<void> {
  try {
    await call(window.api.class.remove(id))
    message.success('已删除')
    await loadClasses()
  } catch (e) {
    message.error(String(e))
  }
}

async function openMembers(record: ClassInfo): Promise<void> {
  currentClassId.value = record.id
  membersClassName.value = record.name
  selectedStudentIds.value = []
  membersVisible.value = true
  try {
    const [mems, all] = await Promise.all([
      call(window.api.class.members(record.id)),
      call(window.api.student.list())
    ])
    members.value = mems
    allStudents.value = all
  } catch (e) {
    message.error(String(e))
  }
}

async function addMembers(): Promise<void> {
  if (!currentClassId.value || !selectedStudentIds.value.length) return
  try {
    await call(window.api.class.addMembers(currentClassId.value, selectedStudentIds.value))
    message.success('已添加成员')
    selectedStudentIds.value = []
    members.value = await call(window.api.class.members(currentClassId.value))
    await loadClasses()
  } catch (e) {
    message.error(String(e))
  }
}

async function removeMember(studentId: string): Promise<void> {
  if (!currentClassId.value) return
  try {
    await call(window.api.class.removeMember(currentClassId.value, studentId))
    message.success('已移除')
    members.value = await call(window.api.class.members(currentClassId.value))
    await loadClasses()
  } catch (e) {
    message.error(String(e))
  }
}

onMounted(() => {
  loadClasses()
  // 订阅全局刷新与新增事件
  subscribeRefresh(loadClasses)
  subscribeNewItem(openCreate)
})
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.member-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.members-add {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
