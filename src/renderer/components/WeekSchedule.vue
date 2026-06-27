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
          @click="onClick(lesson)"
        >
          <div class="lesson-time">{{ formatTime(lesson.startTime) }}</div>
          <div class="lesson-name">{{ lesson.className || '未命名班级' }}</div>
          <div v-if="lesson.subject" class="lesson-subject">{{ lesson.subject }}</div>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Lesson } from '@shared/types'

const props = defineProps<{ lessons: Lesson[] }>()
const emit = defineEmits<{ (e: 'lesson-click', lesson: Lesson): void }>()

// 列顺序：周一 ~ 周日，对应 dayjs 的 day() 值（0=周日）
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0]

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
</style>
