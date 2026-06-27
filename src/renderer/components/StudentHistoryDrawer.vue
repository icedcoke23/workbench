<template>
  <a-drawer
    v-model:open="drawerOpen"
    title="学习历史"
    :width="640"
    :destroy-on-close="true"
  >
    <a-spin :spinning="loading">
      <template v-if="history">
        <!-- 学生头部 -->
        <div class="student-header">
          <a-avatar :size="56" :src="history.student.avatarPath || undefined">
            {{ history.student.avatarPath ? '' : history.student.name.charAt(0) }}
          </a-avatar>
          <div class="student-info">
            <div class="student-name">{{ history.student.name }}</div>
            <div class="student-meta">
              <span v-if="history.student.grade">{{ history.student.grade }}</span>
              <a-tag v-for="t in history.student.tags" :key="t">{{ t }}</a-tag>
            </div>
          </div>
        </div>

        <!-- 统计卡片 -->
        <a-row :gutter="12" class="stat-row">
          <a-col :span="6">
            <a-card :bordered="false" class="stat-card">
              <div class="stat-num">{{ history.stats.totalLessons }}</div>
              <div class="stat-label">总课次</div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card :bordered="false" class="stat-card">
              <div class="stat-num">{{ history.stats.totalScore }}</div>
              <div class="stat-label">累计积分</div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card :bordered="false" class="stat-card">
              <div class="stat-num">{{ history.stats.pickedCount }}</div>
              <div class="stat-label">被点名次数</div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card :bordered="false" class="stat-card">
              <div class="stat-num">{{ finishedRatePercent }}%</div>
              <div class="stat-label">完课率</div>
            </a-card>
          </a-col>
        </a-row>

        <!-- 班级列表 -->
        <div class="section-title">所在班级</div>
        <a-list :data-source="history.classes" size="small" bordered>
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta :title="item.name">
                <template #description>
                  <a-tag :color="classTypeColor[item.type]">{{ classTypeText[item.type] }}</a-tag>
                </template>
              </a-list-item-meta>
              <template #actions>
                <span class="class-score">积分 {{ item.totalScore }}</span>
              </template>
            </a-list-item>
          </template>
        </a-list>

        <!-- 课次时间线 -->
        <div class="section-title">课次记录</div>
        <a-empty v-if="history.lessons.length === 0" description="暂无课次记录" />
        <a-timeline v-else>
          <a-timeline-item v-for="lesson in history.lessons" :key="lesson.id">
            <div class="timeline-item">
              <div class="timeline-head">
                <span class="timeline-date">{{ formatDate(lesson.startTime) }}</span>
                <a-tag :color="lessonStatusColor[lesson.status]">
                  {{ lessonStatusText[lesson.status] }}
                </a-tag>
                <span v-if="lesson.subject" class="timeline-subject">{{ lesson.subject }}</span>
              </div>
              <div class="timeline-body">
                <span class="timeline-class">{{ lesson.className }}</span>
                <a-tag v-if="lesson.isPicked" color="gold">被点名</a-tag>
                <span
                  v-if="lesson.scoreChange !== 0"
                  class="timeline-score"
                  :class="{ positive: lesson.scoreChange > 0, negative: lesson.scoreChange < 0 }"
                >
                  积分 {{ lesson.scoreChange > 0 ? '+' : '' }}{{ lesson.scoreChange }}
                </span>
              </div>
              <div v-if="lesson.note" class="timeline-note">{{ lesson.note }}</div>
            </div>
          </a-timeline-item>
        </a-timeline>
      </template>
      <a-empty v-else-if="!loading" description="暂无数据" />
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { call } from '@renderer/api'
import type { StudentHistory, ClassType, LessonStatus } from '@shared/types'

const props = defineProps<{ open: boolean; studentId: string | null }>()
const emit = defineEmits<{ (e: 'update:open', open: boolean): void }>()

const history = ref<StudentHistory | null>(null)
const loading = ref(false)

// 抽屉开关双向绑定：读 props.open，写时 emit update:open
const drawerOpen = computed<boolean>({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

// 完课率百分比（0~1 -> 0~100，保留整数）
const finishedRatePercent = computed(() => {
  const rate = history.value?.stats.finishedRate ?? 0
  return Math.round(rate * 100)
})

// 班级类型文案与颜色
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

// 课次状态文案与颜色
const lessonStatusText: Record<LessonStatus, string> = {
  pending: '待上课',
  teaching: '进行中',
  finished: '已结束'
}
const lessonStatusColor: Record<LessonStatus, string> = {
  pending: 'default',
  teaching: 'processing',
  finished: 'success'
}

function formatDate(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD HH:mm')
}

// 监听抽屉打开与学生 ID，打开且有 ID 时加载历史
// 使用请求 token 避免竞态：快速切换学生时丢弃过期的请求结果
let reqId = 0
watch(
  [() => props.open, () => props.studentId],
  async ([open, id]) => {
    if (open && id) {
      const myId = ++reqId
      loading.value = true
      history.value = null
      try {
        const data = await call(window.api.studentHistory.get(id))
        if (myId !== reqId) return // 已被更新的请求取代，丢弃
        history.value = data
      } catch (e) {
        if (myId === reqId) message.error(String(e))
      } finally {
        if (myId === reqId) loading.value = false
      }
    } else if (!open) {
      // 关闭时清空数据
      history.value = null
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.student-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.student-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.student-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.student-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6b7280;
}
.stat-row {
  margin-bottom: 20px;
}
.stat-card {
  border-radius: 8px;
  text-align: center;
  background: #f9fafb;
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #4f46e5;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 16px 0 10px;
}
.class-score {
  font-weight: 600;
  color: #4f46e5;
}
.timeline-item {
  line-height: 1.6;
}
.timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.timeline-date {
  font-weight: 600;
  color: #1f2937;
}
.timeline-subject {
  font-size: 13px;
  color: #6b7280;
}
.timeline-body {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 13px;
}
.timeline-class {
  color: #4b5563;
}
.timeline-score.positive {
  color: #52c41a;
  font-weight: 600;
}
.timeline-score.negative {
  color: #ef4444;
  font-weight: 600;
}
.timeline-note {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  white-space: pre-wrap;
}
</style>
