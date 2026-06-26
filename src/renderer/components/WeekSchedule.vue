<script setup lang="ts">
import { computed, ref } from 'vue'
import { LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import type { Lesson } from '@shared/types'

const props = defineProps<{ lessons: Lesson[] }>()
const emit = defineEmits<{
  (e: 'lesson-click', lesson: Lesson): void
  (e: 'cell-click', day: dayjs.Dayjs, hour: number): void
}>()

const weekStart = ref<dayjs.Dayjs>(dayjs().startOf('week'))

const weekDays = computed(() => {
  return Array.from({ length: 7 }, (_, i) => weekStart.value.add(i, 'day'))
})

const hours = Array.from({ length: 14 }, (_, i) => i + 8) // 8:00 - 21:00

const rangeText = computed(() => {
  const s = weekStart.value
  const e = weekStart.value.add(6, 'day')
  return `${s.format('YYYY-MM-DD')} ~ ${e.format('YYYY-MM-DD')}`
})

function weekdayShort(d: number): string {
  return ['日', '一', '二', '三', '四', '五', '六'][d]
}
function fmtTime(s: string): string {
  return dayjs(s).format('HH:mm')
}
function isToday(d: dayjs.Dayjs): boolean {
  return d.isSame(dayjs(), 'day')
}

function changeWeek(delta: number): void {
  weekStart.value = weekStart.value.add(delta * 7, 'day')
}
function goToday(): void {
  weekStart.value = dayjs().startOf('week')
}

function lessonsAt(day: dayjs.Dayjs, hour: number): Lesson[] {
  return props.lessons.filter((l) => {
    const start = dayjs(l.startTime)
    return start.isSame(day, 'day') && start.hour() === hour
  })
}

function lessonStyle(lesson: Lesson): Record<string, string> {
  const startMin = dayjs(lesson.startTime).minute()
  const endHour = dayjs(lesson.endTime).hour()
  const endMin = dayjs(lesson.endTime).minute()
  const startHour = dayjs(lesson.startTime).hour()
  const durationMin = (endHour - startHour) * 60 + (endMin - startMin)
  return {
    top: `${(startMin / 60) * 100}%`,
    height: `${(durationMin / 60) * 100}%`
  }
}

function onCellClick(day: dayjs.Dayjs, hour: number): void {
  emit('cell-click', day, hour)
}
</script>

<template>
  <div class="week-schedule">
    <div class="ws-header">
      <div class="ws-nav">
        <a-button size="small" @click="changeWeek(-1)"><LeftOutlined /></a-button>
        <span class="ws-range">{{ rangeText }}</span>
        <a-button size="small" @click="changeWeek(1)"><RightOutlined /></a-button>
      </div>
      <a-button size="small" @click="goToday">本周</a-button>
    </div>

    <div class="ws-grid">
      <div class="ws-corner">时间</div>
      <div
        v-for="(day, i) in weekDays"
        :key="i"
        class="ws-day-header"
        :class="{ today: isToday(day) }"
      >
        {{ weekdayShort(day.day()) }}
        <span class="ws-date">{{ day.format('M/D') }}</span>
      </div>

      <template v-for="hour in hours" :key="hour">
        <div class="ws-hour">{{ hour }}:00</div>
        <div
          v-for="(day, i) in weekDays"
          :key="`${i}-${hour}`"
          class="ws-cell"
          :class="{ today: isToday(day) }"
          @click="onCellClick(day, hour)"
        >
          <div
            v-for="lesson in lessonsAt(day, hour)"
            :key="lesson.id"
            class="ws-lesson"
            :class="`status-${lesson.status}`"
            :style="lessonStyle(lesson)"
            @click.stop="$emit('lesson-click', lesson)"
          >
            <div class="ws-lesson-time">{{ fmtTime(lesson.startTime) }}-{{ fmtTime(lesson.endTime) }}</div>
            <div class="ws-lesson-name">{{ lesson.className || '未命名' }}</div>
            <a-tag v-if="lesson.subject" class="ws-lesson-sub">{{ lesson.subject }}</a-tag>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.week-schedule {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.ws-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #eef0f4;
}
.ws-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ws-range {
  font-weight: 600;
  font-size: 13px;
  min-width: 200px;
  text-align: center;
}
.ws-grid {
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  font-size: 12px;
}
.ws-corner,
.ws-day-header {
  padding: 8px 4px;
  text-align: center;
  background: #fafbfc;
  border-bottom: 1px solid #eef0f4;
  border-right: 1px solid #eef0f4;
  font-weight: 600;
  color: #4c4c4c;
}
.ws-day-header.today {
  color: #1677ff;
  background: #e6f4ff;
}
.ws-date {
  display: block;
  font-size: 11px;
  font-weight: 400;
  color: #999;
  margin-top: 2px;
}
.ws-hour {
  padding: 4px;
  text-align: right;
  color: #999;
  border-right: 1px solid #eef0f4;
  border-bottom: 1px solid #f5f5f5;
  font-size: 11px;
}
.ws-cell {
  position: relative;
  min-height: 50px;
  border-right: 1px solid #f5f5f5;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
}
.ws-cell.today {
  background: #fafcff;
}
.ws-cell:hover {
  background: #f0f7ff;
}
.ws-lesson {
  position: absolute;
  left: 2px;
  right: 2px;
  background: #e6f4ff;
  border-left: 3px solid #1677ff;
  border-radius: 4px;
  padding: 4px 6px;
  overflow: hidden;
  cursor: pointer;
  z-index: 1;
}
.ws-lesson.status-finished {
  background: #f6ffed;
  border-left-color: #52c41a;
}
.ws-lesson.status-teaching {
  background: #fff7e6;
  border-left-color: #faad14;
}
.ws-lesson-time {
  font-size: 10px;
  color: #888;
}
.ws-lesson-name {
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-lesson-sub {
  font-size: 10px;
  margin: 0;
  padding: 0 4px;
  line-height: 16px;
}
</style>
