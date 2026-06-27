<template>
  <div class="page-container">
    <!-- ============ 课程选择区 ============ -->
    <template v-if="!teachingLesson">
      <div class="section-title"><PlayCircleOutlined /> 授课中心</div>

      <a-card :bordered="false" class="select-card">
        <a-space wrap size="middle">
          <a-select
            v-model:value="selectedClassId"
            placeholder="选择班级"
            style="width: 240px"
            :loading="classLoading"
            @change="loadLessons"
          >
            <a-select-option v-for="c in classes" :key="c.id" :value="c.id">
              {{ c.name }}
              <a-tag v-if="c.studentCount" style="margin-left: 6px">{{ c.studentCount }}人</a-tag>
            </a-select-option>
          </a-select>
          <a-date-picker
            v-model:value="selectedDate"
            placeholder="选择日期"
            style="width: 180px"
            @change="loadLessons"
          />
        </a-space>
      </a-card>

      <a-card :bordered="false" style="margin-top: 16px">
        <a-empty v-if="!selectedClassId" description="请选择班级查看当日课次" />
        <div v-else-if="lessonLoading" class="loading-wrap"><a-spin /></div>
        <a-empty v-else-if="lessons.length === 0" description="该日期暂无课次，可切换日期查看" />
        <a-row v-else :gutter="[16, 16]">
          <a-col v-for="l in lessons" :key="l.id" :xs="24" :sm="12" :md="8" :lg="6">
            <a-card
              hoverable
              size="small"
              :class="['lesson-card', { 'is-finished': l.status === 'finished' }]"
              @click="startTeaching(l)"
            >
              <div class="lesson-time">
                <ClockCircleOutlined />
                {{ fmtTime(l.startTime) }} - {{ fmtTime(l.endTime) }}
              </div>
              <div class="lesson-subject">{{ l.subject || l.className || '未命名课次' }}</div>
              <div class="lesson-status">
                <a-tag :color="statusColor(l.status)">{{ statusText(l.status) }}</a-tag>
              </div>
              <div v-if="l.status !== 'finished'" class="lesson-action">
                <a-button
                  type="primary"
                  size="small"
                  block
                  :ghost="l.status === 'teaching'"
                  @click.stop="startTeaching(l)"
                >
                  {{ l.status === 'teaching' ? '继续上课' : '一键上课' }}
                </a-button>
              </div>
            </a-card>
          </a-col>
        </a-row>
      </a-card>
    </template>

    <!-- ============ 授课模式 ============ -->
    <template v-else>
      <a-card :bordered="false" class="teaching-header">
        <div class="header-row">
          <div class="header-info">
            <a-tag color="blue">{{ currentClassName }}</a-tag>
            <span class="lesson-title">
              {{ fmtTime(teachingLesson.startTime) }} - {{ fmtTime(teachingLesson.endTime) }}
              <span v-if="teachingLesson.subject"> · {{ teachingLesson.subject }}</span>
            </span>
          </div>
          <a-space>
            <a-button size="large" :loading="launchingScratch" @click="launchScratch">
              <template #icon><CodeOutlined /></template>
              打开 Scratch
            </a-button>
            <a-button type="primary" size="large" :loading="picking" @click="randomPick">
              <template #icon><ThunderboltOutlined /></template>
              随机点名
            </a-button>
            <a-button danger size="large" @click="confirmFinish">
              <template #icon><PoweroffOutlined /></template>
              结束上课
            </a-button>
          </a-space>
        </div>
      </a-card>

      <!-- 随机点名结果横幅 -->
      <transition name="banner">
        <div v-if="pickResult" class="pick-banner">
          <a-avatar :size="72" :src="pickResult.avatarPath || undefined">
            {{ pickResult.avatarPath ? '' : pickResult.name.charAt(0) }}
          </a-avatar>
          <div class="pick-text">
            <div class="pick-name">{{ pickResult.name }}</div>
            <div class="pick-tip">被点到啦！</div>
          </div>
          <a-button class="pick-close" size="small" type="text" @click="pickResult = null">
            <CloseOutlined />
          </a-button>
        </div>
      </transition>

      <a-row :gutter="16" style="margin-top: 16px">
        <!-- 积分头像网格 -->
        <a-col :xs="24" :lg="17">
          <a-card :bordered="false" class="grid-card">
            <template #title>积分头像网格</template>
            <template #extra>
              <span class="grid-count">共 {{ students.length }} 名学生</span>
            </template>
            <a-spin :spinning="studentLoading">
              <a-empty
                v-if="!studentLoading && students.length === 0"
                description="该班级暂无学生"
              />
              <div v-else class="avatar-grid">
                <a-popover
                  v-for="s in students"
                  :key="s.id"
                  trigger="click"
                  placement="top"
                  :open="openId === s.id"
                  @open-change="(v) => onPopoverChange(s, v)"
                >
                  <template #content>
                    <div class="score-panel" @click.stop>
                      <div class="score-student">
                        {{ s.name }}
                        <span class="score-current">当前 {{ totals[s.id] || 0 }} 分</span>
                      </div>
                      <div class="score-btns">
                        <a-button type="primary" size="small" @click="doScore(s, 1)">+1</a-button>
                        <a-button type="primary" size="small" @click="doScore(s, 2)">+2</a-button>
                        <a-button size="small" danger @click="doScore(s, -1)">-1</a-button>
                        <a-button size="small" danger @click="doScore(s, -2)">-2</a-button>
                      </div>
                      <a-input
                        v-model:value="currentNote"
                        placeholder="点评内容（可选）"
                        size="small"
                        style="margin-top: 8px; width: 220px"
                        @press-enter="doScore(s, 1)"
                      />
                    </div>
                  </template>
                  <div class="avatar-cell" :class="{ picked: pickedId === s.id }">
                    <a-avatar :size="56" :src="s.avatarPath || undefined">
                      {{ s.avatarPath ? '' : s.name.charAt(0) }}
                    </a-avatar>
                    <div class="cell-name">{{ s.name }}</div>
                    <div class="cell-score">{{ totals[s.id] || 0 }} 分</div>
                    <div v-if="s.tags && s.tags.length" class="cell-tags">
                      <a-tag v-for="t in s.tags" :key="t">{{ t }}</a-tag>
                    </div>
                  </div>
                </a-popover>
              </div>
            </a-spin>
          </a-card>
        </a-col>

        <!-- 可视化计时器 -->
        <a-col :xs="24" :lg="7">
          <a-card :bordered="false" class="timer-card">
            <template #title>可视化计时器</template>
            <CountDownTimer />
          </a-card>
        </a-col>
      </a-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, onDeactivated, onActivated, defineComponent, h, watch } from 'vue'
import { message, Modal, Button as AButton, InputNumber as AInputNumber } from 'ant-design-vue'
import {
  PlayCircleOutlined,
  PoweroffOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CodeOutlined
} from '@ant-design/icons-vue'
import { call } from '@renderer/api'
import { subscribeRefresh } from '@renderer/composables/useShortcuts'
import type { ClassInfo, Lesson, Student } from '@shared/types'
import dayjs from 'dayjs'

// ============ 可视化计时器子组件（同文件内定义） ============
const CountDownTimer = defineComponent({
  name: 'CountDownTimer',
  setup() {
    const minutes = ref(5)
    const totalSeconds = ref(5 * 60)
    const remaining = ref(5 * 60)
    const running = ref(false)
    const isFullscreen = ref(false)
    const containerRef = ref<HTMLElement | null>(null)
    let intervalId: number | null = null

    const display = computed(() => {
      const m = Math.floor(remaining.value / 60)
      const s = remaining.value % 60
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    })

    function applyMinutes(): void {
      if (!running.value) {
        const v = Math.max(1, Math.floor(minutes.value || 1))
        totalSeconds.value = v * 60
        remaining.value = totalSeconds.value
      }
    }

    watch(minutes, applyMinutes)

    function clearTimer(): void {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    function beep(): void {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.value = 0.3
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
        osc.stop(ctx.currentTime + 1.2)
        osc.onended = () => {
          ctx.close().catch(() => {})
        }
      } catch {
        // 忽略音频错误
      }
    }

    function toggle(): void {
      if (running.value) {
        running.value = false
        clearTimer()
        return
      }
      if (remaining.value <= 0) {
        remaining.value = totalSeconds.value
      }
      running.value = true
      intervalId = window.setInterval(() => {
        if (remaining.value > 0) {
          remaining.value -= 1
          if (remaining.value === 0) {
            running.value = false
            clearTimer()
            beep()
            message.warning('时间到！')
          }
        }
      }, 1000)
    }

    function reset(): void {
      running.value = false
      clearTimer()
      remaining.value = totalSeconds.value
    }

    async function toggleFullscreen(): Promise<void> {
      const el = containerRef.value
      if (!el) return
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen()
        } else {
          await el.requestFullscreen()
        }
      } catch {
        // 忽略全屏错误
      }
    }

    function onFsChange(): void {
      isFullscreen.value = !!document.fullscreenElement
    }
    document.addEventListener('fullscreenchange', onFsChange)

    // keep-alive 停用时暂停计时器，避免后台响铃；重新激活时若仍在运行则恢复
    let wasRunning = false
    onDeactivated(() => {
      wasRunning = running.value
      if (running.value) {
        running.value = false
        clearTimer()
      }
    })
    onActivated(() => {
      if (wasRunning && !running.value && remaining.value > 0) {
        running.value = true
        intervalId = window.setInterval(() => {
          if (remaining.value > 0) {
            remaining.value -= 1
            if (remaining.value === 0) {
              running.value = false
              clearTimer()
              beep()
              message.warning('时间到！')
            }
          }
        }, 1000)
      }
      wasRunning = false
    })

    onBeforeUnmount(() => {
      clearTimer()
      document.removeEventListener('fullscreenchange', onFsChange)
    })

    return () =>
      h('div', { class: 'countdown-timer', ref: containerRef }, [
        h(
          'div',
          {
            class: ['countdown-display', { running: running.value, done: remaining.value === 0 }]
          },
          [
            h('div', { class: 'countdown-time' }, display.value),
            h(
              'div',
              { class: 'countdown-label' },
              running.value
                ? '倒计时中'
                : remaining.value === 0
                  ? '时间到'
                  : remaining.value === totalSeconds.value
                    ? '准备就绪'
                    : '已暂停'
            )
          ]
        ),
        h('div', { class: 'countdown-controls' }, [
          h(AInputNumber, {
            value: minutes.value,
            min: 1,
            max: 180,
            size: 'middle',
            disabled: running.value,
            addonAfter: '分钟',
            style: 'width: 150px',
            'onUpdate:value': (v: number | null) => {
              minutes.value = v ?? 1
            }
          } as Record<string, unknown>),
          h(
            AButton,
            { type: running.value ? 'default' : 'primary', onClick: toggle },
            () => (running.value ? '暂停' : '开始')
          ),
          h(AButton, { onClick: reset }, () => '重置'),
          h(
            AButton,
            { onClick: toggleFullscreen },
            () => (isFullscreen.value ? '退出全屏' : '全屏')
          )
        ])
      ])
  }
})

// ============ 授课中心主状态 ============
const classes = ref<ClassInfo[]>([])
const lessons = ref<Lesson[]>([])
const students = ref<Student[]>([])
const teachingLesson = ref<Lesson | null>(null)

const selectedClassId = ref<string | undefined>(undefined)
const selectedDate = ref<dayjs.Dayjs>(dayjs())

const classLoading = ref(false)
const lessonLoading = ref(false)
const studentLoading = ref(false)
const picking = ref(false)
const launchingScratch = ref(false)

const totals = ref<Record<string, number>>({})
const openId = ref<string | null>(null)
const pickedId = ref<string | null>(null)
const pickResult = ref<Student | null>(null)
const currentNote = ref('')

const currentClassName = computed(
  () =>
    classes.value.find((c) => c.id === selectedClassId.value)?.name ||
    teachingLesson.value?.className ||
    '当前班级'
)

// ============ 工具函数 ============
function fmtTime(iso: string): string {
  return dayjs(iso).format('HH:mm')
}

function statusText(s: Lesson['status']): string {
  return s === 'pending' ? '待上课' : s === 'teaching' ? '授课中' : '已结束'
}

function statusColor(s: Lesson['status']): string {
  return s === 'pending' ? 'default' : s === 'teaching' ? 'processing' : 'success'
}

// ============ 数据加载 ============
async function loadLessons(): Promise<void> {
  if (!selectedClassId.value || !selectedDate.value) {
    lessons.value = []
    return
  }
  lessonLoading.value = true
  try {
    const from = selectedDate.value.startOf('day').toISOString()
    const to = selectedDate.value.endOf('day').toISOString()
    lessons.value = await call(
      window.api.lesson.list({ classId: selectedClassId.value, from, to })
    )
  } catch (e) {
    message.error(String(e))
    lessons.value = []
  } finally {
    lessonLoading.value = false
  }
}

async function loadStudents(): Promise<void> {
  if (!selectedClassId.value) return
  studentLoading.value = true
  try {
    students.value = await call(window.api.class.members(selectedClassId.value))
  } catch (e) {
    message.error(String(e))
    students.value = []
  } finally {
    studentLoading.value = false
  }
}

async function loadRecords(): Promise<void> {
  if (!teachingLesson.value) return
  try {
    const records = await call(window.api.lesson.records(teachingLesson.value.id))
    const map: Record<string, number> = {}
    for (const r of records) {
      map[r.studentId] = (map[r.studentId] || 0) + r.scoreChange
    }
    totals.value = map
  } catch (e) {
    message.error(String(e))
  }
}

// ============ 授课流程 ============
async function startTeaching(l: Lesson): Promise<void> {
  if (l.status === 'finished') return
  teachingLesson.value = l
  pickedId.value = null
  pickResult.value = null
  openId.value = null
  currentNote.value = ''
  totals.value = {}
  await loadStudents()
  await loadRecords()
}

function onPopoverChange(s: Student, v: boolean): void {
  openId.value = v ? s.id : null
  if (v) currentNote.value = ''
}

async function doScore(s: Student, change: number): Promise<void> {
  if (!teachingLesson.value) return
  try {
    await call(
      window.api.lesson.score({
        lessonId: teachingLesson.value.id,
        studentId: s.id,
        scoreChange: change,
        note: currentNote.value || undefined
      })
    )
    message.success(`${s.name} ${change > 0 ? '+' : ''}${change} 分`)
    currentNote.value = ''
    openId.value = null
    await loadRecords()
  } catch (e) {
    message.error(String(e))
  }
}

async function randomPick(): Promise<void> {
  if (!teachingLesson.value) return
  picking.value = true
  try {
    const student = await call(window.api.lesson.pick(teachingLesson.value.id))
    if (!student) {
      message.warning('班级暂无学生')
      return
    }
    pickResult.value = student
    pickedId.value = student.id
    window.setTimeout(() => {
      if (pickedId.value === student.id) pickedId.value = null
    }, 1500)
    await loadRecords()
  } catch (e) {
    message.error(String(e))
  } finally {
    picking.value = false
  }
}

async function launchScratch(): Promise<void> {
  launchingScratch.value = true
  try {
    // 若当前课次关联了点子版本，则加载该版本；否则打开空白编辑器
    const versionId = teachingLesson.value?.ideaVersionId || undefined
    await call(window.api.scratch.launch(versionId))
    message.success('已打开 Scratch 编辑器')
  } catch (e) {
    message.error(`启动失败：${e instanceof Error ? e.message : String(e)}`)
  } finally {
    launchingScratch.value = false
  }
}

function confirmFinish(): void {
  Modal.confirm({
    title: '确认结束上课？',
    content: '结束后本节课将无法继续记录积分。',
    okText: '结束上课',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      if (!teachingLesson.value) return
      try {
        await call(window.api.lesson.finish(teachingLesson.value.id))
        message.success('已结束上课')
        teachingLesson.value = null
        students.value = []
        totals.value = {}
        pickResult.value = null
        await loadLessons()
      } catch (e) {
        message.error(String(e))
      }
    }
  })
}

onMounted(async () => {
  classLoading.value = true
  try {
    classes.value = await call(window.api.class.list())
  } catch (e) {
    message.error(String(e))
  } finally {
    classLoading.value = false
  }

  // 订阅全局刷新事件：刷新时重新加载班级列表
  offRefresh = subscribeRefresh(async () => {
    try {
      classes.value = await call(window.api.class.list())
    } catch (e) {
      message.error(String(e))
    }
  })
})

let offRefresh: (() => void) | null = null
onUnmounted(() => {
  offRefresh?.()
  offRefresh = null
})
</script>

<style scoped>
.select-card {
  margin-bottom: 16px;
}
.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.lesson-card {
  transition: all 0.2s;
}
.lesson-card.is-finished {
  opacity: 0.6;
}
.lesson-time {
  font-size: 13px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
}
.lesson-subject {
  font-size: 16px;
  font-weight: 600;
  margin: 6px 0;
  color: #1f2937;
}
.lesson-status {
  margin-bottom: 8px;
}
.teaching-header {
  margin-bottom: 16px;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.header-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
}
.lesson-title {
  font-weight: 600;
  color: #1f2937;
}
.grid-count {
  font-size: 13px;
  color: #6b7280;
}
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 18px 12px;
  padding: 4px;
}
.avatar-cell .cell-name {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.avatar-cell .cell-score {
  font-size: 12px;
  color: #4f46e5;
  font-weight: 600;
  margin-top: 2px;
}
.avatar-cell .cell-tags {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
}
.avatar-cell :deep(.ant-avatar) {
  border: 2px solid transparent;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.avatar-cell.picked :deep(.ant-avatar) {
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.45);
}
.score-panel {
  width: 240px;
}
.score-student {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.score-current {
  font-size: 12px;
  color: #6b7280;
  font-weight: 400;
  margin-left: 4px;
}
.score-btns {
  display: flex;
  gap: 6px;
}
.score-btns :deep(.ant-btn) {
  flex: 1;
}
.pick-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: #fff;
  padding: 20px 24px;
  border-radius: 10px;
  position: relative;
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.3);
}
.pick-name {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}
.pick-tip {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 2px;
}
.pick-close {
  position: absolute;
  top: 8px;
  right: 8px;
  color: #fff;
}
.pick-close :deep(.anticon) {
  color: #fff;
}
.banner-enter-active,
.banner-leave-active {
  transition: all 0.3s ease;
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>

<style>
/* 计时器子组件样式（非 scoped：子组件通过 render function 渲染） */
.countdown-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 8px 4px;
}
.countdown-timer:fullscreen {
  background: #1e1f29;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
  gap: 32px;
}
.countdown-timer:fullscreen .countdown-time {
  font-size: 26vmin;
}
.countdown-timer:fullscreen .countdown-label {
  font-size: 4vmin;
}
.countdown-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 32px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #eef0f4;
  width: 100%;
}
.countdown-display.running {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-color: #6ee7b7;
}
.countdown-display.done {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-color: #fca5a5;
}
.countdown-time {
  font-size: 64px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #1f2937;
  line-height: 1;
  letter-spacing: 2px;
}
.countdown-display.running .countdown-time {
  color: #059669;
}
.countdown-display.done .countdown-time {
  color: #dc2626;
}
.countdown-label {
  font-size: 13px;
  color: #6b7280;
  margin-top: 8px;
}
.countdown-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
