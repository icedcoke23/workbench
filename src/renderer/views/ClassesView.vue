<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  BankOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TeamOutlined,
  ClockCircleOutlined
} from '@ant-design/icons-vue'
import { call } from '@renderer/api'
import dayjs from 'dayjs'
import type { ClassInfo, ClassType, Student } from '@shared/types'
import { subscribeRefresh, subscribeNewItem } from '@renderer/composables/useShortcuts'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const classes = ref<ClassInfo[]>([])
const loading = ref(false)
const keyword = ref('')

const filteredClasses = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return classes.value
  return classes.value.filter((c) => c.name.includes(kw))
})

function typeText(t: ClassType): string {
  return t === 'training' ? '集训' : t === 'temp' ? '临时' : '常规'
}
function typeColor(t: ClassType): string {
  return t === 'training' ? 'volcano' : t === 'temp' ? 'purple' : 'blue'
}
function weekdayText(w: number): string {
  return WEEKDAYS[w] ?? '-'
}

const formVisible = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<{
  name: string
  type: ClassType
  scheduleWeekday: number | undefined
  scheduleStart: dayjs.Dayjs | null
  scheduleEnd: dayjs.Dayjs | null
  scheduleSubject: string
}>({
  name: '',
  type: 'regular',
  scheduleWeekday: undefined,
  scheduleStart: null,
  scheduleEnd: null,
  scheduleSubject: ''
})

const membersVisible = ref(false)
const membersLoading = ref(false)
const currentClass = ref<ClassInfo | null>(null)
const members = ref<Student[]>([])

const addMemberVisible = ref(false)
const candidateStudents = ref<Student[]>([])
const selectedStudentIds = ref<string[]>([])
const candidateColumns = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '年级', dataIndex: 'grade', key: 'grade' }
]

async function loadClasses(): Promise<void> {
  loading.value = true
  try {
    classes.value = await call(window.api.class.list())
  } catch (e) {
    message.error(`加载失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.name = ''
  form.type = 'regular'
  form.scheduleWeekday = undefined
  form.scheduleStart = null
  form.scheduleEnd = null
  form.scheduleSubject = ''
  formVisible.value = true
}

function openEdit(c: ClassInfo): void {
  editingId.value = c.id
  form.name = c.name
  form.type = c.type
  form.scheduleWeekday = c.scheduleRule?.weekday
  form.scheduleStart = c.scheduleRule?.startTime ? dayjs(c.scheduleRule.startTime, 'HH:mm') : null
  form.scheduleEnd = c.scheduleRule?.endTime ? dayjs(c.scheduleRule.endTime, 'HH:mm') : null
  form.scheduleSubject = c.scheduleRule?.subject ?? ''
  formVisible.value = true
}

async function onSubmit(): Promise<void> {
  if (!form.name.trim()) {
    message.warning('请输入班级名称')
    return
  }
  submitting.value = true
  try {
    const scheduleRule =
      form.scheduleWeekday !== undefined && form.scheduleStart && form.scheduleEnd
        ? {
            weekday: form.scheduleWeekday,
            startTime: form.scheduleStart.format('HH:mm'),
            endTime: form.scheduleEnd.format('HH:mm'),
            subject: form.scheduleSubject.trim() || undefined
          }
        : null
    const input = { name: form.name.trim(), type: form.type, scheduleRule }
    if (editingId.value) {
      await call(window.api.class.update(editingId.value, input))
      message.success('已更新')
    } else {
      await call(window.api.class.create(input))
      message.success('已新增班级')
    }
    formVisible.value = false
    await loadClasses()
  } catch (e) {
    message.error(`保存失败：${String(e instanceof Error ? e.message : e)}`)
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
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function openMembers(c: ClassInfo): Promise<void> {
  currentClass.value = c
  membersVisible.value = true
  await loadMembers(c.id)
}

async function loadMembers(classId: string): Promise<void> {
  membersLoading.value = true
  try {
    members.value = await call(window.api.class.members(classId))
  } catch (e) {
    message.error(`加载成员失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    membersLoading.value = false
  }
}

async function openAddMember(): Promise<void> {
  try {
    const all = await call(window.api.student.list())
    const memberIds = new Set(members.value.map((m) => m.id))
    candidateStudents.value = all.filter((s) => !memberIds.has(s.id))
    selectedStudentIds.value = []
    addMemberVisible.value = true
  } catch (e) {
    message.error(`加载学生列表失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

function onSelectChange(keys: string[]): void {
  selectedStudentIds.value = keys
}

async function onAddMembers(): Promise<void> {
  if (!currentClass.value || selectedStudentIds.value.length === 0) {
    message.warning('请选择要添加的学生')
    return
  }
  try {
    await call(window.api.class.addMembers(currentClass.value.id, selectedStudentIds.value))
    message.success(`已添加 ${selectedStudentIds.value.length} 名成员`)
    addMemberVisible.value = false
    await loadMembers(currentClass.value.id)
    await loadClasses()
  } catch (e) {
    message.error(`添加失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeMember(studentId: string): Promise<void> {
  if (!currentClass.value) return
  try {
    await call(window.api.class.removeMember(currentClass.value.id, studentId))
    message.success('已移除')
    await loadMembers(currentClass.value.id)
    await loadClasses()
  } catch (e) {
    message.error(`移除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

onMounted(() => {
  loadClasses()
  subscribeRefresh(loadClasses)
  subscribeNewItem(openCreate)
})
</script>

<template>
  <div class="page-container">
    <div class="section-title"><BankOutlined /> 班级管理</div>

    <a-card :bordered="false">
      <div class="toolbar">
        <a-input-search
          v-model:value="keyword"
          placeholder="按名称搜索班级"
          style="width: 260px"
          allow-clear
          @search="loadClasses"
        />
        <a-space>
          <a-button @click="loadClasses"><ReloadOutlined /> 刷新</a-button>
          <a-button type="primary" @click="openCreate"><PlusOutlined /> 新增班级</a-button>
        </a-space>
      </div>

      <a-row :gutter="[16, 16]">
        <a-col v-for="c in filteredClasses" :key="c.id" :xs="24" :sm="12" :md="8" :lg="6">
          <a-card
            hoverable
            size="small"
            :class="['class-card', `type-${c.type}`]"
            @click="openMembers(c)"
          >
            <div class="class-name">
              {{ c.name }}
              <a-tag :color="typeColor(c.type)" style="margin-left: 4px">{{ typeText(c.type) }}</a-tag>
            </div>
            <div v-if="c.scheduleRule" class="class-schedule">
              <ClockCircleOutlined />
              {{ weekdayText(c.scheduleRule.weekday) }}
              {{ c.scheduleRule.startTime }} - {{ c.scheduleRule.endTime }}
            </div>
            <div class="class-meta">
              <TeamOutlined /> {{ c.studentCount ?? 0 }} 名学生
            </div>
            <div class="class-actions" @click.stop>
              <a-button size="small" @click="openEdit(c)"><EditOutlined /></a-button>
              <a-popconfirm title="确认删除该班级？" @confirm="removeClass(c.id)">
                <a-button size="small" danger><DeleteOutlined /></a-button>
              </a-popconfirm>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <a-empty v-if="filteredClasses.length === 0" description="暂无班级" />
    </a-card>

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="formVisible"
      :title="editingId ? '编辑班级' : '新增班级'"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="onSubmit"
    >
      <a-form layout="vertical" :model="form">
        <a-form-item label="班级名称" required>
          <a-input v-model:value="form.name" placeholder="如：Scratch中阶-周三" />
        </a-form-item>
        <a-form-item label="班级类型">
          <a-radio-group v-model:value="form.type">
            <a-radio value="regular">常规班</a-radio>
            <a-radio value="training">集训班</a-radio>
            <a-radio value="temp">临时班</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="排课规则">
          <a-space wrap>
            <a-select v-model:value="form.scheduleWeekday" style="width: 100px" placeholder="星期">
              <a-select-option v-for="(w, i) in WEEKDAYS" :key="i" :value="i">{{ w }}</a-select-option>
            </a-select>
            <a-time-picker
              v-model:value="form.scheduleStart"
              format="HH:mm"
              placeholder="开始"
              style="width: 110px"
            />
            <a-time-picker
              v-model:value="form.scheduleEnd"
              format="HH:mm"
              placeholder="结束"
              style="width: 110px"
            />
          </a-space>
        </a-form-item>
        <a-form-item label="科目">
          <a-input v-model:value="form.scheduleSubject" placeholder="如：Scratch中阶" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 成员管理 Drawer -->
    <a-drawer
      v-model:open="membersVisible"
      :title="`${currentClass?.name ?? ''} - 成员管理`"
      width="520"
    >
      <div v-if="currentClass" class="members-section">
        <div class="members-toolbar">
          <span>共 {{ members.length }} 名成员</span>
          <a-button type="primary" size="small" @click="openAddMember">
            <PlusOutlined /> 添加成员
          </a-button>
        </div>
        <a-list :data-source="members" :loading="membersLoading">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta
                :title="item.name"
                :description="item.grade || '未设置年级'"
              >
                <template #avatar>
                  <a-avatar :src="item.avatarPath || undefined">
                    {{ item.avatarPath ? '' : item.name.charAt(0) }}
                  </a-avatar>
                </template>
              </a-list-item-meta>
              <template #actions>
                <a-tag v-for="t in item.tags" :key="t" color="blue">{{ t }}</a-tag>
                <a-popconfirm title="确认移除该成员？" @confirm="removeMember(item.id)">
                  <a-button size="small" danger>移除</a-button>
                </a-popconfirm>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </div>
    </a-drawer>

    <!-- 添加成员 Modal -->
    <a-modal
      v-model:open="addMemberVisible"
      title="添加成员到班级"
      ok-text="添加"
      cancel-text="取消"
      @ok="onAddMembers"
    >
      <a-table
        :data-source="candidateStudents"
        :columns="candidateColumns"
        :row-selection="{ selectedRowKeys: selectedStudentIds, onChange: onSelectChange }"
        row-key="id"
        size="small"
        :pagination="false"
      />
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
.class-card {
  position: relative;
  transition: all 0.2s;
}
.class-card.type-training {
  border-left: 3px solid #fa541c;
}
.class-card.type-temp {
  border-left: 3px dashed #722ed1;
}
.class-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.class-schedule {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.class-meta {
  font-size: 13px;
  color: #4f46e5;
}
.class-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
}
.members-section {
  padding: 0 4px;
}
.members-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
</style>
