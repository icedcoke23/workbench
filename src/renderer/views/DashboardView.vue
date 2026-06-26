<template>
  <div class="page-container">
    <!-- 顶部统计卡片 -->
    <a-row :gutter="16" class="stat-row">
      <a-col :span="6">
        <a-card class="stat-card" :bordered="false">
          <div class="num">{{ stats.totalStudents }}</div>
          <div class="label"><TeamOutlined /> 学生数</div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card" :bordered="false">
          <div class="num">{{ stats.totalClasses }}</div>
          <div class="label"><BankOutlined /> 班级数</div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card" :bordered="false">
          <div class="num">{{ stats.weekLessonCount }}</div>
          <div class="label"><CalendarOutlined /> 本周课时</div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card" :bordered="false">
          <div class="num">{{ stats.pendingFeedbackCount }}</div>
          <div class="label"><BellOutlined /> 待反馈数</div>
        </a-card>
      </a-col>
    </a-row>

    <!-- AI 课表导入 -->
    <a-card title="AI 课表导入" class="section-card">
      <a-textarea
        v-model:value="scheduleText"
        placeholder="粘贴课表文本（班级、科目、时间、学生名单等），AI 将自动解析结构..."
        :rows="4"
        allow-clear
      />
      <a-space class="schedule-actions">
        <a-button type="primary" :loading="parsing" @click="onParseText">
          <ThunderboltOutlined /> 解析文本
        </a-button>
        <a-button :loading="parsing" @click="onParseImage">
          <PictureOutlined /> 上传截图解析
        </a-button>
      </a-space>

      <div v-if="parseResult" class="parse-result">
        <div class="parse-result-header">
          <span class="parse-result-title">
            解析结果（共 {{ parseResult.classes.length }} 个班级）
          </span>
          <a-button type="primary" :loading="importing" @click="onConfirmImport">
            <CheckOutlined /> 确认导入
          </a-button>
        </div>
        <a-table
          :columns="scheduleColumns"
          :data-source="parseResult.classes"
          row-key="name"
          size="small"
          :pagination="false"
          bordered
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.dataIndex === 'idx'">{{ index + 1 }}</template>
            <template v-else-if="column.dataIndex === 'weekday'">
              {{ weekdayText(record.weekday) }}
            </template>
            <template v-else-if="column.dataIndex === 'time'">
              {{ record.startTime }} - {{ record.endTime }}
            </template>
            <template v-else-if="column.dataIndex === 'studentCount'">
              {{ record.students.length }}
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <!-- 智能待办看板 -->
    <a-card title="智能待办" class="section-card">
      <template #extra>
        <a-space>
          <a-button size="small" :loading="regenerating" @click="onRegenerate">
            <ReloadOutlined /> 重新生成
          </a-button>
          <a-button size="small" type="primary" @click="openAddTodo">
            <PlusOutlined /> 新增
          </a-button>
        </a-space>
      </template>

      <div class="kanban">
        <div
          v-for="col in todoColumns"
          :key="col.status"
          class="kanban-col"
          :class="{ 'drag-over': dragOverCol === col.status }"
          @dragover.prevent="dragOverCol = col.status"
          @dragleave="onColDragLeave(col.status)"
          @drop="onDrop(col.status)"
        >
          <div class="kanban-col-header">
            <span class="kanban-col-title">
              <span class="dot" :class="`dot-${col.status}`"></span>
              {{ col.title }}
            </span>
            <a-badge :count="col.list.length" :number-style="{ backgroundColor: col.color }" />
          </div>
          <div class="kanban-list">
            <div
              v-for="todo in col.list"
              :key="todo.id"
              class="todo-card"
              draggable="true"
              @dragstart="onDragStart($event, todo.id)"
            >
              <div class="todo-card-head">
                <a-tag :color="typeColor(todo.type)" class="todo-tag">
                  {{ typeText(todo.type) }}
                </a-tag>
                <DeleteOutlined class="todo-delete" @click="onRemoveTodo(todo.id)" />
              </div>
              <div class="todo-title">{{ todo.title }}</div>
              <div v-if="todo.dueAt" class="todo-due">
                <ClockCircleOutlined /> {{ formatTime(todo.dueAt) }}
              </div>
            </div>
            <a-empty v-if="col.list.length === 0" :image="emptyImage" description="暂无待办" />
          </div>
        </div>
      </div>
    </a-card>

    <!-- 本周课程 -->
    <a-card title="本周课程" class="section-card">
      <a-empty v-if="weekLessons.length === 0" description="本周暂无课程" />
      <a-timeline v-else>
        <a-timeline-item
          v-for="lesson in weekLessons"
          :key="lesson.id"
          :color="lessonColor(lesson)"
        >
          <div class="lesson-item">
            <span class="lesson-time">{{ formatLessonTime(lesson.startTime) }}</span>
            <span class="lesson-class">{{ lesson.className || '未命名班级' }}</span>
            <a-tag v-if="lesson.subject" color="blue">{{ lesson.subject }}</a-tag>
            <a-tag v-if="lesson.feedbackSent" color="green">已反馈</a-tag>
            <a-tag v-else-if="lesson.status === 'finished'" color="orange">待反馈</a-tag>
            <a-tag v-if="lesson.status === 'teaching'" color="processing">授课中</a-tag>
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-card>

    <!-- 新增待办 Modal -->
    <a-modal
      v-model:open="addTodoVisible"
      title="新增待办"
      :confirm-loading="adding"
      ok-text="新增"
      cancel-text="取消"
      @ok="onSubmitAddTodo"
    >
      <a-input
        v-model:value="newTodoTitle"
        placeholder="请输入待办内容"
        allow-clear
        @press-enter="onSubmitAddTodo"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { message, Modal, Empty } from 'ant-design-vue'
import {
  TeamOutlined,
  BankOutlined,
  CalendarOutlined,
  BellOutlined,
  ThunderboltOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import { call } from '@renderer/api'
import dayjs from 'dayjs'
import type {
  DashboardData,
  Lesson,
  ScheduleParseResult,
  Todo,
  TodoStatus,
  TodoType
} from '@shared/types'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const stats = ref<DashboardData['stats']>({
  totalStudents: 0,
  totalClasses: 0,
  weekLessonCount: 0,
  pendingFeedbackCount: 0
})
const todos = ref<Todo[]>([])
const weekLessons = ref<Lesson[]>([])

const scheduleText = ref('')
const parseResult = ref<ScheduleParseResult | null>(null)
const parsing = ref(false)
const importing = ref(false)
const regenerating = ref(false)

const addTodoVisible = ref(false)
const newTodoTitle = ref('')
const adding = ref(false)

const draggingId = ref<string | null>(null)
const dragOverCol = ref<TodoStatus | null>(null)

const emptyImage = Empty.PRESENTED_IMAGE_SIMPLE

const scheduleColumns = [
  { title: '#', dataIndex: 'idx', width: 50 },
  { title: '班级名', dataIndex: 'name' },
  { title: '科目', dataIndex: 'subject', width: 100 },
  { title: '星期', dataIndex: 'weekday', width: 80 },
  { title: '时间', dataIndex: 'time', width: 180 },
  { title: '学生数', dataIndex: 'studentCount', width: 80 }
]

const todoColumns = computed(() => [
  {
    status: 'todo' as TodoStatus,
    title: '待办',
    color: '#1677ff',
    list: todos.value.filter((t) => t.status === 'todo')
  },
  {
    status: 'doing' as TodoStatus,
    title: '进行中',
    color: '#faad14',
    list: todos.value.filter((t) => t.status === 'doing')
  },
  {
    status: 'done' as TodoStatus,
    title: '已完成',
    color: '#52c41a',
    list: todos.value.filter((t) => t.status === 'done')
  }
])

function weekdayText(w: number): string {
  return WEEKDAYS[w] ?? '-'
}
function typeText(t: TodoType): string {
  return t === 'prep' ? '备课' : t === 'feedback' ? '反馈' : '手动'
}
function typeColor(t: TodoType): string {
  return t === 'prep' ? 'blue' : t === 'feedback' ? 'orange' : 'green'
}
function formatTime(s: string): string {
  return dayjs(s).format('M月D日 HH:mm')
}
function formatLessonTime(s: string): string {
  const d = dayjs(s)
  return `${WEEKDAYS[d.day()] ?? ''} ${d.format('M月D日 HH:mm')}`
}
function lessonColor(lesson: Lesson): string {
  if (lesson.feedbackSent) return 'green'
  if (lesson.status === 'finished') return 'orange'
  return 'blue'
}

async function loadDashboard(): Promise<void> {
  try {
    const data = await call(window.api.dashboard.get())
    stats.value = data.stats
    todos.value = data.todos ?? []
    weekLessons.value = data.weekLessons ?? []
  } catch (e) {
    message.error(String(e))
  }
}

async function onParseText(): Promise<void> {
  if (!scheduleText.value.trim()) {
    message.warning('请先粘贴课表文本')
    return
  }
  parsing.value = true
  try {
    const res = await call(window.api.schedule.parseText(scheduleText.value))
    parseResult.value = res
    if (!res.classes.length) message.warning('未解析到任何班级信息')
    else message.success(`解析到 ${res.classes.length} 个班级`)
  } catch (e) {
    message.error(String(e))
  } finally {
    parsing.value = false
  }
}

async function onParseImage(): Promise<void> {
  parsing.value = true
  try {
    const imgPath = await call(window.api.file.pickImage())
    const res = await call(window.api.schedule.parseImage(imgPath))
    parseResult.value = res
    if (!res.classes.length) message.warning('未解析到任何班级信息')
    else message.success(`解析到 ${res.classes.length} 个班级`)
  } catch (e) {
    message.error(String(e))
  } finally {
    parsing.value = false
  }
}

async function onConfirmImport(): Promise<void> {
  if (!parseResult.value) return
  importing.value = true
  try {
    const res = await call(window.api.schedule.import(parseResult.value))
    message.success(`导入成功：${res.classes} 个班级 / ${res.students} 名学生 / ${res.lessons} 节课`)
    parseResult.value = null
    scheduleText.value = ''
    await loadDashboard()
  } catch (e) {
    message.error(String(e))
  } finally {
    importing.value = false
  }
}

async function onRegenerate(): Promise<void> {
  regenerating.value = true
  try {
    await call(window.api.todo.regenerate())
    message.success('已重新生成待办')
    await loadDashboard()
  } catch (e) {
    message.error(String(e))
  } finally {
    regenerating.value = false
  }
}

function openAddTodo(): void {
  newTodoTitle.value = ''
  addTodoVisible.value = true
}

async function onSubmitAddTodo(): Promise<void> {
  const title = newTodoTitle.value.trim()
  if (!title) {
    message.warning('请输入待办内容')
    return
  }
  adding.value = true
  try {
    await call(window.api.todo.create({ title, type: 'manual' }))
    message.success('已新增待办')
    addTodoVisible.value = false
    await loadDashboard()
  } catch (e) {
    message.error(String(e))
  } finally {
    adding.value = false
  }
}

function onRemoveTodo(id: string): void {
  Modal.confirm({
    title: '删除待办',
    icon: h(ExclamationCircleOutlined),
    content: '确定删除此待办吗？该操作不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await call(window.api.todo.remove(id))
        message.success('已删除')
        await loadDashboard()
      } catch (e) {
        message.error(String(e))
      }
    }
  })
}

function onDragStart(e: DragEvent, id: string): void {
  draggingId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}

function onColDragLeave(status: TodoStatus): void {
  if (dragOverCol.value === status) dragOverCol.value = null
}

async function onDrop(status: TodoStatus): Promise<void> {
  const id = draggingId.value
  dragOverCol.value = null
  draggingId.value = null
  if (!id) return
  const target = todos.value.find((t) => t.id === id)
  if (target && target.status === status) return
  try {
    await call(window.api.todo.update(id, { status }))
    message.success('已更新待办状态')
    await loadDashboard()
  } catch (e) {
    message.error(String(e))
  }
}

onMounted(loadDashboard)
</script>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.stat-card .num {
  font-size: 28px;
  font-weight: 700;
  color: #4f46e5;
  line-height: 1.2;
}
.stat-card .label {
  font-size: 13px;
  color: #6b7280;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.section-card {
  margin-bottom: 16px;
  border-radius: 10px;
}
.schedule-actions {
  margin-top: 12px;
}
.parse-result {
  margin-top: 16px;
}
.parse-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.parse-result-title {
  font-weight: 600;
  color: #1f2937;
}
.kanban {
  display: flex;
  gap: 16px;
}
.kanban-col {
  flex: 1;
  min-width: 0;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  min-height: 320px;
  border: 2px dashed transparent;
  transition: background 0.15s, border-color 0.15s;
}
.kanban-col.drag-over {
  background: #eef2ff;
  border-color: #a5b4fc;
}
.kanban-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;
}
.kanban-col-title {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot-todo {
  background: #1677ff;
}
.dot-doing {
  background: #faad14;
}
.dot-done {
  background: #52c41a;
}
.kanban-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.todo-card {
  background: #fff;
  border-radius: 6px;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  cursor: grab;
  border: 1px solid #eef0f4;
  transition: box-shadow 0.15s, transform 0.15s;
}
.todo-card:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}
.todo-card:active {
  cursor: grabbing;
}
.todo-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.todo-tag {
  margin: 0;
}
.todo-delete {
  color: #9ca3af;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
}
.todo-delete:hover {
  color: #ef4444;
}
.todo-title {
  font-size: 13px;
  color: #1f2937;
  line-height: 1.5;
  word-break: break-word;
}
.todo-due {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
}
.lesson-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lesson-time {
  font-weight: 600;
  color: #1f2937;
}
.lesson-class {
  color: #4b5563;
}
</style>
