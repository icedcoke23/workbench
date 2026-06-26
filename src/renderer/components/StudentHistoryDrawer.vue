<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { BankOutlined, HistoryOutlined, FlagOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { call } from '@renderer/api'
import type { ClassType, LessonStatus, StudentHistory } from '@shared/types'

const props = defineProps<{
  open: boolean
  studentId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const loading = ref(false)
const history = ref<StudentHistory | null>(null)

const drawerTitle = computed(() => {
  return history.value?.student.name
    ? `${history.value.student.name} 的学习历史`
    : '学生学习历史'
})

const classTypeText: Record<ClassType, string> = {
  regular: '常规班',
  training: '集训班',
  temp: '临时班'
}
const classTypeColor: Record<ClassType, string> = {
  regular: 'blue',
  training: 'volcano',
  temp: 'purple'
}
const lessonStatusText: Record<LessonStatus, string> = {
  pending: '待上课',
  teaching: '授课中',
  finished: '已结束'
}
const lessonStatusColor: Record<LessonStatus, string> = {
  pending: 'default',
  teaching: 'processing',
  finished: 'success'
}

function formatDateTime(s: string): string {
  return dayjs(s).format('YYYY-MM-DD HH:mm')
}

async function loadHistory(studentId: string): Promise<void> {
  loading.value = true
  try {
    history.value = await call(window.api.studentHistory.get(studentId))
  } catch (e) {
    message.error(String(e))
    history.value = null
  } finally {
    loading.value = false
  }
}

function onClose(): void {
  emit('update:open', false)
}

watch(
  () => [props.open, props.studentId] as const,
  ([isOpen, sid]) => {
    if (isOpen && sid) {
      loadHistory(sid)
    } else if (!isOpen) {
      history.value = null
    }
  },
  { immediate: true }
)
</script>

<template>
  <a-drawer
    :open="open"
    :title="drawerTitle"
    width="640"
    placement="right"
    @close="onClose"
  >
    <a-spin :spinning="loading">
      <template v-if="history">
        <!-- 学生基本信息 -->
        <div class="student-header">
          <a-avatar :size="64" :src="history.student.avatarPath || undefined">
            {{ history.student.avatarPath ? '' : history.student.name.charAt(0) }}
          </a-avatar>
          <div class="student-meta">
            <div class="student-name">{{ history.student.name }}</div>
            <div class="student-info">
              <a-tag v-if="history.student.grade">{{ history.student.grade }}</a-tag>
              <a-tag v-for="t in history.student.tags" :key="t" color="blue">{{ t }}</a-tag>
            </div>
          </div>
        </div>

        <!-- 统计卡片 -->
        <a-row :gutter="12" class="stat-row">
          <a-col :span="6">
            <div class="stat-cell">
              <div class="stat-num">{{ history.stats.totalLessons }}</div>
              <div class="stat-label">参与课次</div>
            </div>
          </a-col>
          <a-col :span="6">
            <div class="stat-cell">
              <div class="stat-num">{{ history.stats.totalScore }}</div>
              <div class="stat-label">累计积分</div>
            </div>
          </a-col>
          <a-col :span="6">
            <div class="stat-cell">
              <div class="stat-num">{{ history.stats.pickedCount }}</div>
              <div class="stat-label">点名次数</div>
            </div>
          </a-col>
          <a-col :span="6">
            <div class="stat-cell">
              <div class="stat-num">{{ Math.round(history.stats.finishedRate * 100) }}%</div>
              <div class="stat-label">结课率</div>
            </div>
          </a-col>
        </a-row>

        <!-- 所在班级 -->
        <div class="section-title">
          <BankOutlined /> 所在班级（{{ history.classes.length }}）
        </div>
        <a-empty
          v-if="history.classes.length === 0"
          description="尚未加入任何班级"
          :image="undefined"
        />
        <a-list v-else :data-source="history.classes" size="small">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <span class="class-name">{{ item.name }}</span>
                  <a-tag
                    :color="classTypeColor[item.type]"
                    style="margin-left: 8px"
                  >
                    {{ classTypeText[item.type] }}
                  </a-tag>
                </template>
                <template #description>
                  累计积分：<strong>{{ item.totalScore }}</strong>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>

        <!-- 课堂记录时间线 -->
        <div class="section-title">
          <HistoryOutlined /> 课堂记录（{{ history.lessons.length }}）
        </div>
        <a-empty
          v-if="history.lessons.length === 0"
          description="暂无课堂记录"
          :image="undefined"
        />
        <a-timeline v-else class="history-timeline">
          <a-timeline-item
            v-for="lesson in history.lessons"
            :key="lesson.id + lesson.startTime"
            :color="lesson.status === 'finished' ? 'green' : 'blue'"
          >
            <div class="lesson-row">
              <div class="lesson-head">
                <span class="lesson-date">{{ formatDateTime(lesson.startTime) }}</span>
                <a-tag :color="lessonStatusColor[lesson.status]">
                  {{ lessonStatusText[lesson.status] }}
                </a-tag>
                <span v-if="lesson.subject" class="lesson-subject">{{ lesson.subject }}</span>
              </div>
              <div class="lesson-class">{{ lesson.className }}</div>
              <div class="lesson-records">
                <span v-if="lesson.isPicked" class="record-tag picked">
                  <FlagOutlined /> 被点名
                </span>
                <span v-if="lesson.scoreChange !== 0" :class="['record-tag', lesson.scoreChange > 0 ? 'plus' : 'minus']">
                  积分 {{ lesson.scoreChange > 0 ? '+' : '' }}{{ lesson.scoreChange }}
                </span>
                <span v-if="lesson.note" class="record-note">{{ lesson.note }}</span>
              </div>
            </div>
          </a-timeline-item>
        </a-timeline>
      </template>
      <a-empty v-else description="暂无数据" />
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.student-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eef0f4;
}
.student-name {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}
.student-info {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.stat-row {
  margin-bottom: 20px;
}
.stat-cell {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
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
  margin: 20px 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.class-name {
  font-weight: 600;
}
.history-timeline {
  margin-top: 8px;
}
.lesson-row {
  padding-bottom: 4px;
}
.lesson-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lesson-date {
  font-weight: 600;
  color: #1f2937;
}
.lesson-subject {
  font-size: 13px;
  color: #6b7280;
}
.lesson-class {
  font-size: 13px;
  color: #6b7280;
  margin: 2px 0;
}
.lesson-records {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.record-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.record-tag.picked {
  background: #fef3c7;
  color: #92400e;
}
.record-tag.plus {
  background: #d1fae5;
  color: #065f46;
}
.record-tag.minus {
  background: #fee2e2;
  color: #991b1b;
}
.record-note {
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}
</style>
