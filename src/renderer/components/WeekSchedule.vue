<template>
  <div class="week-schedule">
    <a-row :gutter="8">
      <a-col v-for="col in columns" :key="col.label" :span="24 / 7" class="week-col">
        <div class="week-col-title">{{ col.label }}</div>
        <div v-if="col.lessons.length === 0" class="week-empty">无课</div>
        <div
          v-for="lesson in col.lessons"
          :key="lesson.id"
          class="lesson-card"
          :class="showPrepStage ? prepCardClass(lesson) : ''"
          @click="onClick(lesson)"
        >
          <div class="lesson-time">{{ formatTime(lesson.startTime) }}</div>
          <div class="lesson-name">{{ lesson.className || '未命名班级' }}</div>
          <div v-if="lesson.subject" class="lesson-subject">{{ lesson.subject }}</div>
          <div v-if="showPrepStage && lesson.prepStage" class="lesson-prep">
            <span class="prep-dot" :style="{ background: prepStageColor(lesson) }"></span>
            <span class="prep-text">{{ prepStageText(lesson) }}</span>
          </div>
        </div>
      </a-col>
    </a-row>

    <div v-if="showPrepLegend" class="prep-legend">
      <span
        v-for="item in PREP_LEGEND"
        :key="item.stage"
        class="prep-legend-item"
      >
        <span class="prep-dot" :style="{ background: item.color }"></span>
        {{ item.text }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Lesson, PrepStage } from '@shared/types'

const props = withDefaults(
  defineProps<{
    lessons: Lesson[]
    /** 是否在课次卡片上展示备课阶段色条与标签 */
    showPrepStage?: boolean
    /** 是否在底部展示备课阶段图例 */
    showPrepLegend?: boolean
  }>(),
  { showPrepStage: false, showPrepLegend: false }
)
const emit = defineEmits<{ (e: 'lesson-click', lesson: Lesson): void }>()

// 列顺序：周一 ~ 周日，对应 dayjs 的 day() 值（0=周日）
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0]

// 备课阶段 -> 颜色/文案（与 TeachingView/PrepView 保持一致）
const PREP_COLOR: Record<PrepStage, string> = {
  'no-version': '#bfbfbf',
  'no-plan': '#ff4d4f',
  'plan-incomplete': '#faad14',
  ready: '#52c41a'
}
const PREP_TEXT: Record<PrepStage, string> = {
  'no-version': '待关联',
  'no-plan': '待写教案',
  'plan-incomplete': '待完善',
  ready: '就绪'
}
const PREP_LEGEND: { stage: PrepStage; color: string; text: string }[] = [
  { stage: 'ready', color: PREP_COLOR.ready, text: '备课就绪' },
  { stage: 'plan-incomplete', color: PREP_COLOR['plan-incomplete'], text: '待完善教案' },
  { stage: 'no-plan', color: PREP_COLOR['no-plan'], text: '待写教案' },
  { stage: 'no-version', color: PREP_COLOR['no-version'], text: '待关联版本' }
]

function prepStageColor(lesson: Lesson): string {
  return PREP_COLOR[lesson.prepStage ?? 'no-version']
}
function prepStageText(lesson: Lesson): string {
  return PREP_TEXT[lesson.prepStage ?? 'no-version']
}
function prepCardClass(lesson: Lesson): string {
  return `prep-${lesson.prepStage ?? 'no-version'}`
}

// 按星期分组课程，并按开始时间升序排列
const columns = computed(() => {
  const map: Record<number, Lesson[]> = {}
  for (const wd of WEEKDAY_VALUES) map[wd] = []
  for (const lesson of props.lessons) {
    const wd = dayjs(lesson.startTime).day()
    if (!map[wd]) map[wd] = []
    map[wd].push(lesson)
  }
  for (const wd of WEEKDAY_VALUES) {
    map[wd].sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf())
  }
  return WEEKDAY_VALUES.map((wd, i) => ({
    label: WEEKDAY_LABELS[i],
    lessons: map[wd]
  }))
})

function formatTime(iso: string): string {
  return dayjs(iso).format('HH:mm')
}

function onClick(lesson: Lesson): void {
  emit('lesson-click', lesson)
}
</script>

<style scoped>
.week-schedule {
  width: 100%;
}
.week-col {
  min-height: 120px;
}
.week-col-title {
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
  text-align: center;
  padding: 6px 0;
  border-bottom: 1px solid #eef0f4;
  margin-bottom: 8px;
}
.week-empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 12px 0;
}
.lesson-card {
  position: relative;
  background: #f5f7ff;
  border: 1px solid #e0e7ff;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}
.lesson-card:hover {
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.18);
  transform: translateY(-1px);
}
/* 备课阶段左侧色条 */
.lesson-card.prep-ready::before,
.lesson-card.prep-no-plan::before,
.lesson-card.prep-plan-incomplete::before,
.lesson-card.prep-no-version::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 6px 0 0 6px;
}
.lesson-card.prep-ready::before {
  background: #52c41a;
}
.lesson-card.prep-no-plan::before {
  background: #ff4d4f;
}
.lesson-card.prep-plan-incomplete::before {
  background: #faad14;
}
.lesson-card.prep-no-version::before {
  background: #bfbfbf;
}
.lesson-time {
  font-size: 12px;
  font-weight: 600;
  color: #4f46e5;
}
.lesson-name {
  font-size: 13px;
  color: #1f2937;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lesson-subject {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}
.lesson-prep {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  font-size: 11px;
  color: #6b7280;
}
.prep-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.prep-text {
  line-height: 1;
}
.prep-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 6px;
  font-size: 12px;
  color: #595959;
}
.prep-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
