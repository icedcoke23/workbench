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
        <template #title>
          <span class="lesson-list-title">当日课次</span>
        </template>
        <template #extra>
          <a-button
            size="small"
            type="primary"
            :disabled="!selectedClassId"
            @click="openCreateLesson"
          >
            <PlusOutlined /> 新增课次
          </a-button>
        </template>
        <a-empty v-if="!selectedClassId" description="请选择班级查看当日课次" />
        <div v-else-if="lessonLoading" class="loading-wrap"><a-spin /></div>
        <a-empty v-else-if="lessons.length === 0" description="该日期暂无课次，可点击「新增课次」添加" />
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
                <a-tag v-if="l.ideaTitle" color="purple" size="small">
                  <BulbOutlined /> {{ l.ideaTitle }}
                </a-tag>
                <a-tag
                  v-if="l.status === 'pending' && prepStageTag(l).text"
                  :color="prepStageTag(l).color"
                  size="small"
                  :class="{ 'prep-not-ready': prepStageTag(l).notReady }"
                >
                  {{ prepStageTag(l).text }}
                </a-tag>
              </div>
              <div class="lesson-card-actions" @click.stop>
                <a-button
                  v-if="l.status !== 'finished'"
                  type="primary"
                  size="small"
                  block
                  :ghost="l.status === 'teaching'"
                  @click="startTeaching(l)"
                >
                  {{ l.status === 'teaching' ? '继续上课' : '一键上课' }}
                </a-button>
                <a-space :size="4" class="lesson-edit-actions">
                  <a-button size="small" @click="openEditLesson(l)">
                    <EditOutlined /> 编辑
                  </a-button>
                  <a-popconfirm
                    title="确认删除该课次？相关课堂记录也将删除。"
                    @confirm="removeLesson(l.id)"
                  >
                    <a-button size="small" danger><DeleteOutlined /></a-button>
                  </a-popconfirm>
                </a-space>
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

      <!-- 备课上下文：关联版本的 Scratch 作品元信息 + 教案 + 关联文档 -->
      <a-card
        v-if="teachingLesson.ideaVersionId || prepDocs.length > 0"
        :bordered="false"
        class="prep-context-card"
        size="small"
      >
        <a-row :gutter="16">
          <!-- 版本作品元信息 -->
          <a-col v-if="teachingLesson.ideaVersionId" :xs="24" :lg="14">
            <div class="prep-section-title">
              <BulbOutlined /> 备课作品
            </div>
            <a-spin :spinning="prepVersionMetaLoading" size="small">
              <div v-if="prepVersionMeta" class="prep-meta">
                <template v-if="prepVersionMeta.hasFile">
                  <div class="prep-meta-stats">
                    <span><AppstoreOutlined /> 角色 {{ prepVersionMeta.spriteCount }}</span>
                    <span><CodeOutlined /> 脚本 {{ prepVersionMeta.scriptCount }}</span>
                    <span>造型 {{ prepVersionMeta.costumeCount }}</span>
                    <span>音效 {{ prepVersionMeta.soundCount }}</span>
                    <span class="prep-meta-size">{{ formatFileSize(prepVersionMeta.fileSize) }}</span>
                  </div>
                  <div v-if="prepVersionMeta.spriteNames.length" class="prep-meta-names">
                    角色：
                    <a-tag v-for="n in prepVersionMeta.spriteNames" :key="n" size="small">{{ n }}</a-tag>
                  </div>
                </template>
                <span v-else class="prep-meta-empty">该版本暂无作品文件，可点击「打开 Scratch」创作</span>
              </div>
              <span v-else class="prep-meta-empty">加载中…</span>
            </a-spin>
          </a-col>
          <!-- 关联文档 -->
          <a-col :xs="24" :lg="teachingLesson.ideaVersionId ? 10 : 24">
            <div class="prep-section-title">
              <FileTextOutlined /> 关联文档
            </div>
            <a-spin :spinning="prepDocsLoading" size="small">
              <a-empty
                v-if="!prepDocsLoading && prepDocs.length === 0"
                description="暂无关联文档"
                :image="undefined"
              />
              <div v-else class="prep-doc-list">
                <div v-for="d in prepDocs" :key="d.id" class="prep-doc-item">
                  <a class="prep-doc-title" @click="openDocLink(d.url)">
                    {{ d.title || d.url }}
                  </a>
                  <a-button size="small" type="link" @click="openDocLink(d.url)">
                    <GlobalOutlined /> 打开
                  </a-button>
                </div>
              </div>
            </a-spin>
          </a-col>
        </a-row>

        <!-- 教案：授课时按章节展开查看，便于教师按教案推进课堂 -->
        <a-divider v-if="teachingLesson.ideaVersionId" class="prep-plan-divider">
          <FormOutlined /> 教案
        </a-divider>
        <div v-if="teachingLesson.ideaVersionId" class="prep-plan-section">
          <a-spin :spinning="prepPlanLoading" size="small">
            <div v-if="prepPlan">
              <div class="prep-plan-header">
                <span class="prep-plan-title">{{ prepPlan.title || (prepPlan.versionName ? `${prepPlan.versionName} 教案` : '教案') }}</span>
                <a-tag v-if="prepPlan.durationMinutes" color="orange" size="small">
                  {{ prepPlan.durationMinutes }} 分钟
                </a-tag>
                <a-tag
                  v-for="sec in prepPlanFilledSections"
                  :key="sec"
                  color="green"
                  size="small"
                >{{ sec }}</a-tag>
              </div>
              <a-collapse
                v-if="prepPlanHasContent"
                v-model:active-key="prepPlanActiveKeys"
                ghost
                size="small"
                class="prep-plan-collapse"
              >
                <a-collapse-panel v-if="prepPlan.objectives" key="objectives" header="教学目标">
                  <div class="prep-plan-text">{{ prepPlan.objectives }}</div>
                </a-collapse-panel>
                <a-collapse-panel v-if="prepPlan.keyPoints" key="keyPoints" header="教学重难点">
                  <div class="prep-plan-text">{{ prepPlan.keyPoints }}</div>
                </a-collapse-panel>
                <a-collapse-panel v-if="prepPlan.preparation" key="preparation" header="教学准备">
                  <div class="prep-plan-text">{{ prepPlan.preparation }}</div>
                </a-collapse-panel>
                <a-collapse-panel v-if="prepPlan.process" key="process" header="教学过程">
                  <div class="prep-plan-text">{{ prepPlan.process }}</div>
                </a-collapse-panel>
                <a-collapse-panel v-if="prepPlan.reflection" key="reflection" header="课后反思">
                  <div class="prep-plan-text">{{ prepPlan.reflection }}</div>
                </a-collapse-panel>
              </a-collapse>
              <span v-else class="prep-meta-empty">该教案所有章节均未填写内容</span>
            </div>
            <span v-else class="prep-meta-empty">该版本尚未编写教案，可在「备课 → 教案」中创建</span>
          </a-spin>
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

    <!-- ============ 新建/编辑课次 Modal ============ -->
    <a-modal
      v-model:open="lessonModalVisible"
      :title="editingLessonId ? '编辑课次' : '新增课次'"
      :confirm-loading="lessonSubmitting"
      @ok="submitLesson"
    >
      <a-form layout="vertical">
        <a-form-item label="班级" required>
          <a-select
            v-model:value="lessonForm.classId"
            placeholder="选择班级"
            :options="classOptions"
            show-search
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item label="日期" required>
          <a-date-picker
            v-model:value="lessonForm.date"
            style="width: 100%"
            placeholder="选择日期"
          />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="开始时间" required>
              <a-time-picker
                v-model:value="lessonForm.startTime"
                style="width: 100%"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="09:00"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="结束时间" required>
              <a-time-picker
                v-model:value="lessonForm.endTime"
                style="width: 100%"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="10:30"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="科目">
          <a-input v-model:value="lessonForm.subject" placeholder="如：Scratch 图形编程" />
        </a-form-item>

        <a-divider style="margin: 8px 0">关联备课（可选）</a-divider>
        <a-form-item label="备课点子">
          <a-select
            v-model:value="lessonForm.ideaId"
            placeholder="选择备课点子"
            :options="ideaOptions"
            show-search
            option-filter-prop="label"
            allow-clear
            @change="onIdeaChange"
          />
        </a-form-item>
        <a-form-item v-if="lessonForm.ideaId" label="作品版本">
          <a-select
            v-model:value="lessonForm.ideaVersionId"
            placeholder="选择该点子的作品版本"
            :options="versionOptions"
            :not-found-content="versionOptions.length === 0 ? '该点子暂无版本' : undefined"
            allow-clear
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ============ 课后反思 Modal（结束上课引导填写） ============ -->
    <a-modal
      v-model:open="reflectionModalVisible"
      title="课后反思"
      :width="680"
      :mask-closable="false"
      :destroy-on-close="true"
    >
      <template #footer>
        <a-space>
          <a-button @click="reflectionModalVisible = false">取消</a-button>
          <a-button danger :loading="reflectionSubmitting" @click="finishWithoutReflection">
            直接结束上课
          </a-button>
          <a-button type="primary" :loading="reflectionSubmitting" @click="submitReflectionAndFinish">
            保存反思并结束
          </a-button>
        </a-space>
      </template>
      <a-alert
        type="info"
        show-icon
        message="本节课关联了备课教案，建议结束后填写课后反思"
        :description="reflectionContextDesc"
        style="margin-bottom: 12px"
      />
      <div v-if="reflectionObjectives" class="reflection-objectives">
        <span class="reflection-obj-label">本节课教学目标：</span>
        <span class="reflection-obj-text">{{ reflectionObjectives }}</span>
      </div>
      <a-textarea
        v-model:value="reflectionForm.text"
        :rows="8"
        placeholder="记录本节课的教学反思：目标达成情况、学生掌握程度、可改进之处、下次调整方向…"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, onDeactivated, onActivated, defineComponent, h, watch, reactive } from 'vue'
import { message, Modal, Button as AButton, InputNumber as AInputNumber } from 'ant-design-vue'
import {
  PlayCircleOutlined,
  PoweroffOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  FormOutlined,
  FileTextOutlined,
  GlobalOutlined,
  AppstoreOutlined
} from '@ant-design/icons-vue'
import { call } from '@renderer/api'
import { subscribeRefresh } from '@renderer/composables/useShortcuts'
import type {
  ClassInfo,
  Idea,
  Lesson,
  LessonInput,
  LessonPlan,
  LessonPlanInput,
  Student,
  VersionMeta,
  DocLinkWithLesson
} from '@shared/types'
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

// 备课上下文（授课模式展示关联版本的教案、作品元信息、文档）
const prepVersionMeta = ref<VersionMeta | null>(null)
const prepVersionMetaLoading = ref(false)
const prepDocs = ref<DocLinkWithLesson[]>([])
const prepDocsLoading = ref(false)
const prepPlan = ref<LessonPlan | null>(null)
const prepPlanLoading = ref(false)
const prepPlanActiveKeys = ref<string[]>(['process'])

// 课后反思 Modal（课次结束引导填写）
const reflectionModalVisible = ref(false)
const reflectionSubmitting = ref(false)
const reflectionForm = reactive({
  text: '',
  ideaVersionId: '' as string
})

// 课次手动管理 Modal 状态
const lessonModalVisible = ref(false)
const lessonSubmitting = ref(false)
const editingLessonId = ref<string | null>(null)
const lessonForm = reactive({
  classId: '' as string,
  date: dayjs() as dayjs.Dayjs,
  startTime: '09:00' as string,
  endTime: '10:30' as string,
  subject: '' as string,
  ideaId: '' as string,
  ideaVersionId: '' as string
})

// 备课点子与版本（用于课次关联备课成果）
const ideas = ref<Idea[]>([])

const classOptions = computed(() =>
  classes.value.map((c) => ({ label: c.name, value: c.id }))
)

const ideaOptions = computed(() =>
  ideas.value.map((i) => ({ label: i.title, value: i.id }))
)

/** 当前选中的点子下的版本选项 */
const versionOptions = computed(() => {
  if (!lessonForm.ideaId) return []
  const idea = ideas.value.find((i) => i.id === lessonForm.ideaId)
  return (idea?.versions ?? []).map((v) => ({
    label: v.versionName,
    value: v.id
  }))
})

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

/** 课次备课阶段 → 标签文本/颜色/是否未就绪，用于在课次卡片上提示备课缺口 */
function prepStageTag(l: Lesson): { text: string; color: string; notReady: boolean } {
  const stage = l.prepStage
  if (!stage) return { text: '', color: 'default', notReady: false }
  switch (stage) {
    case 'no-version':
      return { text: '待关联版本', color: 'volcano', notReady: true }
    case 'no-plan':
      return { text: '待写教案', color: 'orange', notReady: true }
    case 'plan-incomplete':
      return { text: '待完善教案', color: 'gold', notReady: true }
    case 'ready':
      return { text: '备课就绪', color: 'green', notReady: false }
  }
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

/** 加载备课点子列表（含版本），供课次关联备课成果使用 */
async function loadIdeas(): Promise<void> {
  try {
    ideas.value = await call(window.api.idea.list())
  } catch (e) {
    console.error('[teaching] 加载备课点子失败', e)
    ideas.value = []
  }
}

// ============ 课次手动管理 ============
/** 将日期 + HH:mm 组合为 ISO 字符 */
function combineDateTime(date: dayjs.Dayjs, hhmm: string): string {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10))
  return date.hour(h || 0).minute(m || 0).second(0).millisecond(0).toISOString()
}

/** 根据版本 ID 反查所属点子 ID */
function findIdeaIdByVersion(versionId: string | null | undefined): string {
  if (!versionId) return ''
  for (const idea of ideas.value) {
    if (idea.versions?.some((v) => v.id === versionId)) return idea.id
  }
  return ''
}

function openCreateLesson(): void {
  editingLessonId.value = null
  lessonForm.classId = selectedClassId.value ?? ''
  lessonForm.date = selectedDate.value ?? dayjs()
  lessonForm.startTime = '09:00'
  lessonForm.endTime = '10:30'
  lessonForm.subject = ''
  lessonForm.ideaId = ''
  lessonForm.ideaVersionId = ''
  lessonModalVisible.value = true
}

function openEditLesson(l: Lesson): void {
  editingLessonId.value = l.id
  const start = dayjs(l.startTime)
  const end = dayjs(l.endTime)
  lessonForm.classId = l.classId
  lessonForm.date = start
  lessonForm.startTime = start.format('HH:mm')
  lessonForm.endTime = end.format('HH:mm')
  lessonForm.subject = l.subject ?? ''
  lessonForm.ideaVersionId = l.ideaVersionId ?? ''
  lessonForm.ideaId = findIdeaIdByVersion(l.ideaVersionId)
  lessonModalVisible.value = true
}

/** 切换点子时清空已选版本，避免版本不属于该点子 */
function onIdeaChange(): void {
  lessonForm.ideaVersionId = ''
}

async function submitLesson(): Promise<void> {
  if (!lessonForm.classId) {
    message.warning('请选择班级')
    return
  }
  if (!lessonForm.startTime || !lessonForm.endTime) {
    message.warning('请填写开始与结束时间')
    return
  }
  lessonSubmitting.value = true
  try {
    const payload: LessonInput = {
      classId: lessonForm.classId,
      startTime: combineDateTime(lessonForm.date, lessonForm.startTime),
      endTime: combineDateTime(lessonForm.date, lessonForm.endTime),
      subject: lessonForm.subject.trim() || undefined,
      ideaVersionId: lessonForm.ideaVersionId || undefined
    }
    if (editingLessonId.value) {
      await call(window.api.lesson.update(editingLessonId.value, payload))
      message.success('课次已更新')
    } else {
      await call(window.api.lesson.create(payload))
      message.success('课次已创建')
    }
    lessonModalVisible.value = false
    // 创建/编辑后切换到对应班级与日期并刷新
    selectedClassId.value = lessonForm.classId
    selectedDate.value = lessonForm.date
    await loadLessons()
  } catch (e) {
    message.error(`${editingLessonId.value ? '更新' : '创建'}失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    lessonSubmitting.value = false
  }
}

async function removeLesson(id: string): Promise<void> {
  try {
    await call(window.api.lesson.remove(id))
    message.success('课次已删除')
    await loadLessons()
  } catch (e) {
    message.error(String(e))
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

/** 加载备课上下文：关联版本的作品元信息、教案、关联文档，三者并行拉取 */
async function loadPrepContext(): Promise<void> {
  const versionId = teachingLesson.value?.ideaVersionId
  const lessonId = teachingLesson.value?.id
  // 重置状态
  prepVersionMeta.value = null
  prepPlan.value = null
  prepDocs.value = []
  if (!versionId && !lessonId) return

  // 并行加载，互不阻塞
  if (versionId) {
    prepVersionMetaLoading.value = true
    call(window.api.idea.getVersionMeta(versionId))
      .then((meta) => { prepVersionMeta.value = meta })
      .catch(() => { prepVersionMeta.value = null })
      .finally(() => { prepVersionMetaLoading.value = false })

    prepPlanLoading.value = true
    call(window.api.lessonPlan.getByVersion(versionId))
      .then((p) => { prepPlan.value = p ?? null })
      .catch(() => { prepPlan.value = null })
      .finally(() => { prepPlanLoading.value = false })
  }

  if (lessonId) {
    prepDocsLoading.value = true
    call(window.api.doc.listLinks(lessonId))
      .then((links) => {
        // listLinks 返回简化的 { id, url, title }，需适配 DocLinkWithLesson 展示
        prepDocs.value = (links as Array<{ id: string; url: string; title: string }>).map((l) => ({
          id: l.id,
          lesson_id: lessonId,
          url: l.url,
          title: l.title,
          created_at: '',
          class_name: null,
          lesson_start_time: null
        })) as unknown as DocLinkWithLesson[]
      })
      .catch(() => { prepDocs.value = [] })
      .finally(() => { prepDocsLoading.value = false })
  }
}

/** 教案已填写的章节标签 */
const prepPlanFilledSections = computed<string[]>(() => {
  const p = prepPlan.value
  if (!p) return []
  const out: string[] = []
  if (p.objectives) out.push('教学目标')
  if (p.keyPoints) out.push('重难点')
  if (p.preparation) out.push('教学准备')
  if (p.process) out.push('教学过程')
  if (p.reflection) out.push('课后反思')
  return out
})

/** 教案是否有任何章节内容 */
const prepPlanHasContent = computed<boolean>(() => {
  const p = prepPlan.value
  if (!p) return false
  return !!(p.objectives || p.keyPoints || p.preparation || p.process || p.reflection)
})

/** 课后反思 Modal 的上下文描述 */
const reflectionContextDesc = computed(() => {
  const plan = prepPlan.value
  const verName = plan?.versionName || '当前版本'
  return `关联版本：${verName}。反思将保存到该教案「课后反思」章节，作为后续教学改进参考。`
})

/** 课后反思时展示的本节课教学目标（对照目标反思达成情况） */
const reflectionObjectives = computed(() => prepPlan.value?.objectives || '')

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function openDocLink(url: string): Promise<void> {
  try {
    await call(window.api.doc.openUrl(url))
  } catch (e) {
    message.error(`打开失败：${String(e instanceof Error ? e.message : e)}`)
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
  loadPrepContext()
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

async function confirmFinish(): Promise<void> {
  if (!teachingLesson.value) return
  const versionId = teachingLesson.value.ideaVersionId
  // 若关联了备课版本，拉取最新教案判断「课后反思」是否已填写
  let plan: LessonPlan | null = null
  if (versionId) {
    try {
      plan = (await call(window.api.lessonPlan.getByVersion(versionId))) ?? null
      // 同步刷新授课页教案状态，保证后续展示一致
      prepPlan.value = plan
    } catch {
      plan = null
    }
  }
  // 已关联版本、教案存在、但课后反思为空 -> 引导填写反思
  if (versionId && plan && !plan.reflection) {
    reflectionForm.text = ''
    reflectionForm.ideaVersionId = versionId
    reflectionModalVisible.value = true
    return
  }
  // 否则走原确认流程
  Modal.confirm({
    title: '确认结束上课？',
    content: '结束后本节课将无法继续记录积分。',
    okText: '结束上课',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => doFinish(false)
  })
}

/** 真正执行结束课次：可选先保存课后反思 */
async function doFinish(saveReflection: boolean): Promise<void> {
  if (!teachingLesson.value) return
  reflectionSubmitting.value = true
  try {
    if (saveReflection && reflectionForm.ideaVersionId) {
      const input: LessonPlanInput = {
        ideaVersionId: reflectionForm.ideaVersionId,
        reflection: reflectionForm.text.trim() || null
      }
      await call(window.api.lessonPlan.upsert(input))
    }
    await call(window.api.lesson.finish(teachingLesson.value.id))
    message.success('已结束上课')
    reflectionModalVisible.value = false
    teachingLesson.value = null
    students.value = []
    totals.value = {}
    pickResult.value = null
    prepPlan.value = null
    await loadLessons()
  } catch (e) {
    message.error(String(e))
  } finally {
    reflectionSubmitting.value = false
  }
}

/** 保存课后反思并结束上课 */
async function submitReflectionAndFinish(): Promise<void> {
  await doFinish(true)
}

/** 不填写反思，直接结束上课 */
function finishWithoutReflection(): void {
  void doFinish(false)
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
  // 加载备课点子，供课次关联备课版本
  await loadIdeas()

  // 订阅全局刷新事件：刷新时重新加载班级列表与备课点子
  offRefresh = subscribeRefresh(async () => {
    try {
      classes.value = await call(window.api.class.list())
    } catch (e) {
      message.error(String(e))
    }
    await loadIdeas()
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
.prep-not-ready {
  animation: prep-pulse 1.8s ease-in-out infinite;
}
@keyframes prep-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
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
.lesson-list-title {
  font-size: 15px;
  font-weight: 600;
}
.lesson-card-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lesson-edit-actions {
  display: flex;
  justify-content: flex-end;
}
.teaching-header {
  margin-bottom: 16px;
}
.prep-context-card {
  margin-bottom: 16px;
  background: #fafbfc;
}
.prep-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 8px;
}
.prep-meta-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #374151;
}
.prep-meta-size {
  color: #9ca3af;
}
.prep-meta-names {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.prep-meta-empty {
  font-size: 12px;
  color: #9ca3af;
}
.prep-doc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.prep-doc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}
.prep-doc-title {
  color: #2563eb;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prep-doc-title:hover {
  text-decoration: underline;
}
.prep-plan-divider {
  margin: 16px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
}
.prep-plan-section {
  min-height: 32px;
}
.prep-plan-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.prep-plan-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.prep-plan-collapse {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}
.prep-plan-collapse :deep(.ant-collapse-header) {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  padding: 8px 12px !important;
}
.prep-plan-collapse :deep(.ant-collapse-content-box) {
  padding: 8px 12px !important;
}
.prep-plan-text {
  font-size: 13px;
  line-height: 1.7;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
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
.reflection-objectives {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #f6f8fa;
  border-left: 3px solid #4f46e5;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
}
.reflection-obj-label {
  color: #4f46e5;
  font-weight: 500;
}
.reflection-obj-text {
  color: #4b5563;
  white-space: pre-wrap;
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
