<template>
  <div class="page-container">
    <a-tabs v-model:activeKey="activeTab" class="prep-tabs">
      <!-- ============ 点子库 ============ -->
      <a-tab-pane key="ideas">
        <template #tab>
          <span><BulbOutlined /> 点子库</span>
        </template>

        <div class="tab-toolbar">
          <span class="section-title">点子库</span>
          <a-space>
            <a-button @click="loadIdeas"><ReloadOutlined /> 刷新</a-button>
            <a-button type="primary" @click="openNewIdeaModal"><PlusOutlined /> 新建点子</a-button>
          </a-space>
        </div>

        <a-list
          :data-source="ideas"
          :loading="ideasLoading"
          :locale="{ emptyText: '暂无点子，点击「新建点子」开始记录灵感' }"
        >
          <template #renderItem="{ item }">
            <a-card class="idea-card" size="small">
              <template #title>
                <div class="idea-title">
                  <span class="idea-name">{{ item.title }}</span>
                  <a-space :size="6">
                    <a-tag v-if="item.targetCourse" color="blue">{{ item.targetCourse }}</a-tag>
                    <a-tag :color="ideaStatusColor[item.status]">{{ ideaStatusText[item.status] }}</a-tag>
                  </a-space>
                </div>
              </template>
              <template #extra>
                <a-space :size="6">
                  <a-button size="small" @click="openEditIdeaModal(item)">
                    <EditOutlined /> 编辑
                  </a-button>
                  <a-button size="small" @click="openNewVersionModal(item)">
                    <PlusCircleOutlined /> 新建版本
                  </a-button>
                  <a-popconfirm title="确认删除该点子？相关版本也将删除。" @confirm="removeIdea(item.id)">
                    <a-button size="small" danger><DeleteOutlined /></a-button>
                  </a-popconfirm>
                </a-space>
              </template>

              <p v-if="item.description" class="idea-desc">{{ item.description }}</p>
              <p v-else class="idea-desc idea-desc-empty">暂无描述</p>

              <div class="idea-meta">
                <span>创建于 {{ formatDate(item.createdAt) }}</span>
                <span>更新于 {{ formatDate(item.updatedAt) }}</span>
              </div>

              <div class="version-toggle">
                <a-button type="link" size="small" @click="toggleVersions(item.id)">
                  {{ expandedMap[item.id] ? '收起版本' : '展开版本' }}（{{ item.versions?.length || 0 }}）
                </a-button>
              </div>

              <div v-if="expandedMap[item.id]" class="version-list">
                <a-empty
                  v-if="!item.versions || item.versions.length === 0"
                  description="暂无版本，点击「新建版本」归档你的 Scratch 作品"
                  :image="undefined"
                />
                <a-list v-else :data-source="item.versions" size="small">
                  <template #renderItem="{ item: ver }">
                    <a-list-item>
                      <a-list-item-meta>
                        <template #title>
                          <span class="ver-name">
                            {{ ver.versionName }}
                            <a-tag v-if="!ver.filePath" color="default" size="small">空版本</a-tag>
                            <a-tag v-else color="green" size="small">有作品</a-tag>
                          </span>
                        </template>
                        <template #description>
                          <div class="ver-notes">{{ ver.notes || '无备注' }}</div>
                          <div class="ver-date">{{ formatDate(ver.createdAt) }}</div>
                        </template>
                      </a-list-item-meta>
                      <template #actions>
                        <a-button size="small" :loading="previewingId === ver.id" @click="openVersionPreview(ver)">
                          <EyeOutlined /> 预览
                        </a-button>
                        <a-button type="primary" size="small" @click="launchVersion(ver.id)">
                          <PlayCircleOutlined /> 开始创作
                        </a-button>
                        <a-button size="small" @click="openPlanForVersion(ver.id)">
                          <FormOutlined /> 教案
                        </a-button>
                        <a-popconfirm title="确认删除该版本？" @confirm="removeVersion(ver.id)">
                          <a-button size="small" danger><DeleteOutlined /></a-button>
                        </a-popconfirm>
                      </template>
                    </a-list-item>
                  </template>
                </a-list>
              </div>
            </a-card>
          </template>
        </a-list>
      </a-tab-pane>

      <!-- ============ 教案 ============ -->
      <a-tab-pane key="plans">
        <template #tab>
          <span><FormOutlined /> 教案</span>
        </template>

        <div class="tab-toolbar">
          <span class="section-title">教案</span>
          <a-space wrap>
            <a-input-search
              v-model:value="planKeyword"
              placeholder="搜索教案（标题/目标/重难点/过程/反思/版本名/点子）"
              style="width: 280px"
              allow-clear
              @search="loadPlans"
            />
            <a-select
              v-model:value="planFilterClassId"
              placeholder="按班级筛选"
              style="width: 180px"
              allow-clear
              :options="planClassOptions"
              @change="loadPlans"
            />
            <a-select
              v-model:value="planFilterSubject"
              placeholder="按科目筛选"
              style="width: 160px"
              allow-clear
              :options="planSubjectOptions"
              @change="loadPlans"
            />
            <a-button @click="loadPlans"><ReloadOutlined /> 刷新</a-button>
            <a-button @click="openTemplateGallery"><CopyOutlined /> 从模板新建</a-button>
            <a-button type="primary" @click="openNewPlanModal"><PlusOutlined /> 新建教案</a-button>
          </a-space>
        </div>

        <!-- 备课进度看板 -->
        <a-card
          v-if="prepOverview"
          class="prep-overview-card"
          size="small"
          :loading="prepOverviewLoading"
        >
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12" :md="6">
              <a-statistic title="作品版本" :value="prepOverview.totalVersions" />
            </a-col>
            <a-col :xs="24" :sm="12" :md="6">
              <a-statistic
                title="已写教案"
                :value="prepOverview.versionsWithPlan"
                :suffix="`/ ${prepOverview.totalVersions}`"
              />
            </a-col>
            <a-col :xs="24" :sm="12" :md="6">
              <a-statistic
                title="备课就绪"
                :value="prepOverview.readinessBreakdown.ready"
                :value-style="{ color: prepOverview.readinessPct >= 80 ? '#3f8600' : prepOverview.readinessPct >= 50 ? '#d48806' : '#cf1322' }"
                :suffix="`/ ${prepOverview.totalVersions}`"
              />
            </a-col>
            <a-col :xs="24" :sm="12" :md="6">
              <div class="overview-readiness">
                <span class="overview-readiness-label">就绪率</span>
                <a-progress
                  type="circle"
                  :percent="prepOverview.readinessPct"
                  :width="56"
                  :stroke-color="prepOverview.readinessPct >= 80 ? '#52c41a' : prepOverview.readinessPct >= 50 ? '#faad14' : '#ff4d4f'"
                />
              </div>
            </a-col>
          </a-row>

          <!-- G16: 就绪等级分布堆叠条 -->
          <div v-if="prepOverview.totalVersions > 0" class="overview-breakdown">
            <div class="overview-breakdown-bar">
              <a-tooltip
                :title="`草稿：${prepOverview.readinessBreakdown.draft} 个版本（无教案或刚起步）`"
              >
                <div
                  class="overview-breakdown-seg seg-draft"
                  :style="{ width: (prepOverview.readinessBreakdown.draft / prepOverview.totalVersions * 100) + '%' }"
                />
              </a-tooltip>
              <a-tooltip
                :title="`部分就绪：${prepOverview.readinessBreakdown.partial} 个版本（已写教案但维度不全）`"
              >
                <div
                  class="overview-breakdown-seg seg-partial"
                  :style="{ width: (prepOverview.readinessBreakdown.partial / prepOverview.totalVersions * 100) + '%' }"
                />
              </a-tooltip>
              <a-tooltip
                :title="`就绪：${prepOverview.readinessBreakdown.ready} 个版本（多维校验通过）`"
              >
                <div
                  class="overview-breakdown-seg seg-ready"
                  :style="{ width: (prepOverview.readinessBreakdown.ready / prepOverview.totalVersions * 100) + '%' }"
                />
              </a-tooltip>
            </div>
            <div class="overview-breakdown-legend">
              <span class="legend-item"><i class="dot dot-draft" />草稿 {{ prepOverview.readinessBreakdown.draft }}</span>
              <span class="legend-item"><i class="dot dot-partial" />部分就绪 {{ prepOverview.readinessBreakdown.partial }}</span>
              <span class="legend-item"><i class="dot dot-ready" />就绪 {{ prepOverview.readinessBreakdown.ready }}</span>
            </div>
          </div>

          <!-- G20: 就绪率趋势 sparkline -->
          <div
            v-if="readinessTrend.length >= 2"
            class="overview-trend"
          >
            <div class="overview-trend-header">
              <span class="overview-trend-title"><LineChartOutlined /> 近 {{ readinessTrend.length }} 天就绪率趋势</span>
              <span class="overview-trend-summary">
                <span class="ts-item">最新 <b>{{ trendSummary.latest }}%</b></span>
                <span class="ts-item">均值 <b>{{ trendSummary.avg }}%</b></span>
                <span
                  class="ts-item"
                  :class="{ 'ts-up': (trendSummary.delta ?? 0) >= 0, 'ts-down': (trendSummary.delta ?? 0) < 0 }"
                >
                  较首日 {{ (trendSummary.delta ?? 0) >= 0 ? '+' : '' }}{{ trendSummary.delta }}%
                </span>
              </span>
            </div>
            <svg
              class="overview-trend-svg"
              :viewBox="`0 0 ${TREND_W} ${TREND_H}`"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#52c41a" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="#52c41a" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="trendSparkline.areaPath" fill="url(#trendArea)" />
              <path
                :d="trendSparkline.linePath"
                fill="none"
                stroke="#52c41a"
                stroke-width="1.5"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              <circle
                v-for="(p, i) in trendSparkline.points"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="2"
                :fill="i === trendSparkline.points.length - 1 ? '#52c41a' : '#fff'"
                :stroke="'#52c41a'"
                :stroke-width="1"
              >
                <title>{{ p.date }}：{{ p.pct }}%</title>
              </circle>
            </svg>
          </div>

          <div
            v-if="prepOverview.upcomingUnprepared.length > 0"
            class="overview-backlog"
          >
            <div class="overview-backlog-title">
              <ScheduleOutlined /> 近 7 天待备课课次（{{ prepOverview.upcomingUnprepared.length }}）
            </div>
            <div class="overview-backlog-list">
              <div
                v-for="item in prepOverview.upcomingUnprepared.slice(0, 8)"
                :key="item.lessonId"
                class="overview-backlog-item"
                @click="item.ideaVersionId && openPlanForVersion(item.ideaVersionId)"
              >
                <span class="ob-time">{{ fmtOverviewTime(item.startTime) }}</span>
                <span class="ob-class">{{ item.className || item.subject || '课程' }}</span>
                <a-tag :color="overviewStageTag(item.prepStage).color" size="small">
                  {{ overviewStageTag(item.prepStage).text }}
                </a-tag>
                <a-tag v-if="item.ideaTitle" color="purple" size="small">{{ item.ideaTitle }}</a-tag>
                <EditOutlined v-if="item.ideaVersionId" class="ob-edit-icon" />
              </div>
            </div>
            <div v-if="prepOverview.upcomingUnprepared.length > 8" class="overview-backlog-more">
              还有 {{ prepOverview.upcomingUnprepared.length - 8 }} 节待备课课次…
            </div>
          </div>
          <a-alert
            v-else
            type="success"
            show-icon
            message="近期课次备课就绪"
            description="未来 7 天内没有备课未完成的待上课课次。"
            style="margin-top: 12px"
          />
        </a-card>

        <a-alert
          type="info"
          show-icon
          message="教案与作品版本 1:1 关联"
          description="每个备课版本可编写一份结构化教案，包含教学目标、重难点、准备、过程、反思五个章节。教案随版本同步，跨设备可见。"
          style="margin-bottom: 16px"
        />

        <a-list
          :data-source="plans"
          :loading="plansLoading"
          :locale="{ emptyText: '暂无教案，可从「点子库 → 版本」点击「教案」按钮开始编写，或点击「新建教案」' }"
        >
          <template #renderItem="{ item }">
            <a-card class="plan-card" size="small">
              <template #title>
                <div class="plan-title">
                  <span class="plan-name">{{ item.title || `${item.versionName ?? '未命名版本'} 教案` }}</span>
                  <a-space :size="6">
                    <a-tag v-if="item.ideaTitle" color="purple">{{ item.ideaTitle }}</a-tag>
                    <a-tag color="blue">{{ item.versionName || '未命名版本' }}</a-tag>
                    <a-tag v-if="item.durationMinutes" color="orange">
                      <ScheduleOutlined /> {{ item.durationMinutes }} 分钟
                    </a-tag>
                    <a-tooltip v-if="item.parentPlanTitle" title="点击查看源教案">
                      <a-tag
                        color="cyan"
                        style="cursor: pointer"
                        @click="openPlanForVersionById(item.parentPlanId!)"
                      >
                        <BranchesOutlined /> 派生自：{{ item.parentPlanTitle }}
                      </a-tag>
                    </a-tooltip>
                    <a-tag v-if="item.derivedCount && item.derivedCount > 0" color="geekblue">
                      <ForkOutlined /> 已派生 {{ item.derivedCount }} 份
                    </a-tag>
                    <a-tooltip
                      :title="`${cardReadiness(item).passedCount}/${cardReadiness(item).totalCount} 项就绪：${cardReadiness(item).items.map((i) => (i.passed ? '✓' : '✗') + i.label).join(' · ')}`"
                    >
                      <a-tag :color="readinessLevelColor(cardReadiness(item).level)">
                        <CheckCircleOutlined /> {{ readinessLevelText(cardReadiness(item).level) }} {{ cardReadiness(item).pct }}%
                      </a-tag>
                    </a-tooltip>
                  </a-space>
                </div>
              </template>
              <template #extra>
                <a-space :size="6">
                  <a-button size="small" @click="openPlanForVersion(item.ideaVersionId)">
                    <EditOutlined /> 编辑
                  </a-button>
                  <a-tooltip title="一键克隆到新版本（持久化保存）">
                    <a-button
                      size="small"
                      :loading="cloningId === item.id"
                      @click="openClonePlanModal(item)"
                    >
                      <CopyOutlined /> 克隆
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="复制内容到编辑器（作为模板，手动选版本保存）">
                    <a-button size="small" :loading="duplicatingId === item.id" @click="duplicatePlan(item)">
                      <SnippetsOutlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="导出为 Markdown 文件">
                    <a-button size="small" :loading="exportingId === item.id" @click="exportPlan(item)">
                      <DownloadOutlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="导出为 PDF 文件">
                    <a-button size="small" :loading="exportingId === item.id" @click="exportPlanPdf(item)">
                      <FilePdfOutlined />
                    </a-button>
                  </a-tooltip>
                  <a-popconfirm title="确认删除该教案？作品版本不受影响。" @confirm="removePlan(item.id)">
                    <a-button size="small" danger><DeleteOutlined /></a-button>
                  </a-popconfirm>
                </a-space>
              </template>

              <div class="plan-sections">
                <a-tag
                  v-for="sec in planFilledSections(item)"
                  :key="sec"
                  color="green"
                  size="small"
                >{{ sec }}</a-tag>
                <span v-if="planFilledSections(item).length === 0" class="plan-empty-sections">
                  暂未填写任何章节内容
                </span>
              </div>

              <!-- G21: 知识点标签 -->
              <div v-if="item.knowledgePoints && item.knowledgePoints.length" class="plan-knowledge">
                <TagsOutlined />
                <a-tag
                  v-for="kp in item.knowledgePoints"
                  :key="kp"
                  color="geekblue"
                  size="small"
                >{{ kp }}</a-tag>
              </div>

              <!-- 历史使用情况：班级/科目/课次数 -->
              <div v-if="item.lessonCount || (item.usedClasses && item.usedClasses.length)" class="plan-usage">
                <span v-if="item.lessonCount" class="plan-usage-item">
                  <CalendarOutlined /> 已用 {{ item.lessonCount }} 课次
                </span>
                <span v-if="item.usedClasses && item.usedClasses.length" class="plan-usage-item">
                  <BankOutlined /> {{ item.usedClasses.join('、') }}
                </span>
                <span v-if="item.usedSubjects && item.usedSubjects.length" class="plan-usage-item">
                  <TagOutlined /> {{ item.usedSubjects.join('、') }}
                </span>
              </div>

              <div v-if="item.objectives" class="plan-preview-block">
                <span class="plan-preview-label">教学目标：</span>
                <span class="plan-preview-text">{{ truncateMd(item.objectives) }}</span>
              </div>
              <div v-if="item.process" class="plan-preview-block">
                <span class="plan-preview-label">教学过程：</span>
                <span class="plan-preview-text">{{ truncateMd(item.process) }}</span>
              </div>

              <div class="plan-meta">
                <span>创建于 {{ formatDate(item.createdAt) }}</span>
                <span>更新于 {{ formatDate(item.updatedAt) }}</span>
              </div>
            </a-card>
          </template>
        </a-list>
      </a-tab-pane>

      <!-- ============ 备课日历 ============ -->
      <a-tab-pane key="calendar">
        <template #tab>
          <span><CalendarOutlined /> 备课日历</span>
        </template>

        <div class="tab-toolbar">
          <span class="section-title">备课日历</span>
          <a-space>
            <a-button @click="shiftCalendarWeek(-1)"><LeftOutlined /> 上一周</a-button>
            <a-button @click="shiftCalendarWeek(0)">本周</a-button>
            <a-button @click="shiftCalendarWeek(1)">下一周 <RightOutlined /></a-button>
          </a-space>
        </div>

        <div class="calendar-range">
          {{ calendarRangeText }}
          <span class="calendar-range-sub">（共 {{ calendarLessons.length }} 节课次）</span>
        </div>

        <a-alert
          type="info"
          show-icon
          :message="`按备课阶段着色：绿=就绪 / 橙=待完善 / 红=待写教案 / 灰=待关联版本。点击课次可跳转编辑教案。`"
          style="margin: 12px 0"
        />

        <a-spin :spinning="calendarLoading">
          <WeekSchedule
            :lessons="calendarLessons"
            :show-prep-stage="true"
            :show-prep-legend="true"
            @lesson-click="onCalendarLessonClick"
          />
        </a-spin>
      </a-tab-pane>

      <!-- ============ 资源库 ============ -->
      <a-tab-pane key="resources">
        <template #tab>
          <span><AppstoreOutlined /> 资源库</span>
        </template>

        <div class="tab-toolbar">
          <span class="section-title">资源库</span>
          <a-space>
            <a-button @click="loadResources"><ReloadOutlined /> 刷新</a-button>
            <a-button type="primary" @click="importResource"><ImportOutlined /> 导入素材</a-button>
          </a-space>
        </div>

        <div class="filter-row">
          <a-select
            v-model:value="resourceFilter.type"
            style="width: 140px"
            @change="loadResources"
          >
            <a-select-option value="">全部类型</a-select-option>
            <a-select-option value="backdrop">背景</a-select-option>
            <a-select-option value="sprite">角色</a-select-option>
            <a-select-option value="sound">音效</a-select-option>
          </a-select>
          <a-select
            v-model:value="resourceFilter.tag"
            style="width: 180px"
            placeholder="按标签筛选"
            allow-clear
            show-search
            :options="tagOptions"
            @change="loadResources"
          />
          <a-input-search
            v-model:value="resourceFilter.keyword"
            placeholder="按名称搜索素材"
            style="width: 260px"
            allow-clear
            @search="loadResources"
          />
        </div>

        <a-table
          :data-source="resources"
          :columns="resourceColumns"
          :loading="resourcesLoading"
          row-key="id"
          :pagination="{ pageSize: 8, size: 'small' }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <a-tag :color="resourceTypeColor[record.type as ResourceType]">
                {{ resourceTypeText[record.type as ResourceType] }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'tags'">
              <template v-if="record.tags && record.tags.length">
                <a-tag v-for="t in record.tags" :key="t">{{ t }}</a-tag>
              </template>
              <span v-else class="text-muted">-</span>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDate(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space :size="6">
                <a-button size="small" @click="openResourcePreview(record)">
                  <EyeOutlined /> 预览
                </a-button>
                <a-button size="small" @click="openEditResourceModal(record)">
                  <EditOutlined /> 编辑
                </a-button>
                <a-popconfirm title="确认删除该素材？" @confirm="removeResource(record.id)">
                  <a-button size="small" danger><DeleteOutlined /></a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- ============ 文档中心 ============ -->
      <a-tab-pane key="docs">
        <template #tab>
          <span><FileTextOutlined /> 文档中心</span>
        </template>

        <span class="section-title">文档中心</span>

        <a-card class="docs-card" size="small">
          <a-alert
            class="docs-alert"
            type="info"
            show-icon
            message="Webview 嵌入语雀需登录，建议用浏览器打开"
            description="语雀文档在应用内嵌 Webview 中通常需要额外登录态，体验受限。如遇无法查看，请使用「在浏览器打开」按钮在外部浏览器中阅读。"
          />

          <a-form layout="vertical" class="docs-form">
            <a-form-item label="语雀文档 URL">
              <a-input
                v-model:value="docForm.url"
                placeholder="https://www.yuque.com/..."
                allow-clear
              />
            </a-form-item>
            <a-form-item label="文档标题">
              <a-input v-model:value="docForm.title" placeholder="为该文档起一个标题" allow-clear />
            </a-form-item>
            <a-form-item label="关联课次">
              <a-select
                v-model:value="docForm.lessonId"
                placeholder="选择要关联的课次"
                :loading="lessonsLoading"
                :options="lessonOptions"
                show-search
                option-filter-prop="label"
                allow-clear
              />
            </a-form-item>
            <a-space>
              <a-button
                type="primary"
                :disabled="!canLinkDoc"
                @click="linkDoc"
              >
                <LinkOutlined /> 关联到课次
              </a-button>
              <a-button :disabled="!docForm.url" @click="openDocInBrowser">
                <GlobalOutlined /> 在浏览器打开
              </a-button>
            </a-space>
          </a-form>
        </a-card>

        <!-- 已关联文档列表 -->
        <a-card title="已关联文档" class="docs-list-card" size="small" style="margin-top: 16px">
          <template #extra>
            <a-button size="small" @click="loadDocLinks"><ReloadOutlined /> 刷新</a-button>
          </template>
          <a-empty v-if="docLinks.length === 0" description="暂无关联文档" />
          <a-list v-else :data-source="docLinks" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta>
                  <template #title>
                    <a class="doc-link-title" @click="openDocUrl(item.url)">
                      {{ item.title || item.url }}
                    </a>
                  </template>
                  <template #description>
                    <span class="doc-link-meta">
                      <a-tag v-if="item.class_name" color="blue">{{ item.class_name }}</a-tag>
                      <span v-if="item.lesson_start_time">{{ formatDate(item.lesson_start_time) }}</span>
                      <span class="doc-link-url">{{ item.url }}</span>
                    </span>
                  </template>
                </a-list-item-meta>
                <template #actions>
                  <a-button size="small" @click="openDocUrl(item.url)">
                    <GlobalOutlined /> 打开
                  </a-button>
                  <a-popconfirm title="确认取消该文档关联？" @confirm="removeDocLink(item.id)">
                    <a-button size="small" danger><DeleteOutlined /></a-button>
                  </a-popconfirm>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <!-- ============ 新建/编辑点子 Modal ============ -->
    <a-modal
      v-model:open="newIdeaModalVisible"
      :title="editingIdeaId ? '编辑点子' : '新建点子'"
      :confirm-loading="newIdeaSubmitting"
      @ok="submitNewIdea"
    >
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="newIdeaForm.title" placeholder="一句话描述你的灵感" />
        </a-form-item>
        <a-form-item label="目标课程">
          <a-input v-model:value="newIdeaForm.targetCourse" placeholder="如：Scratch 入门、Python 进阶" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="newIdeaForm.description" :rows="3" placeholder="详细描述点子内容、教学目标等" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="newIdeaForm.status">
            <a-select-option value="idea">点子</a-select-option>
            <a-select-option value="developing">开发中</a-select-option>
            <a-select-option value="archived">已归档</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ============ 新建版本 Modal ============ -->
    <a-modal
      v-model:open="newVersionModalVisible"
      :title="`新建版本 - ${newVersionIdeaTitle}`"
      :confirm-loading="newVersionSubmitting"
      @ok="submitNewVersion"
    >
      <a-form layout="vertical">
        <a-form-item label="版本名称" required>
          <a-input v-model:value="newVersionForm.versionName" placeholder="如 v1.0" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="newVersionForm.notes" :rows="3" placeholder="本次版本的改动说明（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ============ Scratch 保存归档 Modal ============ -->
    <a-modal
      v-model:open="saveModalVisible"
      title="保存到"
      :confirm-loading="saveSubmitting"
      :ok-text="saveTarget === 'idea' ? '保存到点子库' : '保存到资源库'"
      @ok="submitSave"
    >
      <a-radio-group v-model:value="saveTarget" class="save-radio">
        <a-radio value="idea">保存到点子库（作为某点子的新版本）</a-radio>
        <a-radio value="resource">保存到资源库（作为可复用素材）</a-radio>
      </a-radio-group>

      <div v-if="saveTarget === 'idea'" class="save-idea-form">
        <a-form layout="vertical">
          <a-form-item label="所属点子" required>
            <a-select
              v-model:value="saveForm.ideaId"
              placeholder="选择目标点子"
              :loading="saveIdeasLoading"
              :options="ideaSelectOptions"
              show-search
              option-filter-prop="label"
            />
          </a-form-item>
          <a-form-item label="版本名称" required>
            <a-input v-model:value="saveForm.versionName" placeholder="如 v1.0" />
          </a-form-item>
          <a-form-item label="备注">
            <a-textarea v-model:value="saveForm.notes" :rows="3" placeholder="版本备注（可选）" />
          </a-form-item>
        </a-form>
      </div>
      <div v-else class="save-resource-form">
        <a-alert
          type="info"
          show-icon
          message="将作为通用素材保存到资源库，可在「资源库」标签页中管理。"
          style="margin-bottom: 12px"
        />
        <a-form layout="vertical">
          <a-form-item label="素材类型" required>
            <a-radio-group v-model:value="saveForm.resourceType">
              <a-radio-button value="sprite">角色</a-radio-button>
              <a-radio-button value="backdrop">背景</a-radio-button>
              <a-radio-button value="sound">音效</a-radio-button>
            </a-radio-group>
          </a-form-item>
        </a-form>
      </div>
    </a-modal>

    <!-- ============ 编辑资源 Modal（标签 + 名称） ============ -->
    <a-modal
      v-model:open="editResourceModalVisible"
      title="编辑素材"
      :confirm-loading="editResourceSubmitting"
      @ok="submitEditResource"
    >
      <a-form layout="vertical">
        <a-form-item label="名称" required>
          <a-input v-model:value="editResourceForm.name" placeholder="素材名称" />
        </a-form-item>
        <a-form-item label="标签">
          <a-select
            v-model:value="editResourceForm.tags"
            mode="tags"
            placeholder="输入标签后回车添加，可选择已有标签"
            :options="tagOptions"
            :token-separators="[',']"
            allow-clear
          />
          <div class="tag-tip">提示：输入文本后按回车或逗号添加标签，已使用的标签会自动出现在候选项中。</div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ============ 版本预览 Modal ============ -->
    <a-modal
      v-model:open="versionPreviewVisible"
      :title="`版本预览 - ${versionPreviewTitle}`"
      :footer="null"
      width="480px"
    >
      <a-spin :spinning="versionPreviewLoading">
        <div v-if="versionPreviewMeta" class="version-preview">
          <a-empty
            v-if="!versionPreviewMeta.hasFile"
            description="该版本暂无作品文件，点击「开始创作」可从空白开始创建"
          />
          <div v-else>
            <a-descriptions :column="2" size="small" bordered>
              <a-descriptions-item label="角色数">
                {{ versionPreviewMeta.spriteCount }}
              </a-descriptions-item>
              <a-descriptions-item label="脚本数">
                {{ versionPreviewMeta.scriptCount }}
              </a-descriptions-item>
              <a-descriptions-item label="造型数">
                {{ versionPreviewMeta.costumeCount }}
              </a-descriptions-item>
              <a-descriptions-item label="音效数">
                {{ versionPreviewMeta.soundCount }}
              </a-descriptions-item>
              <a-descriptions-item label="文件大小" :span="2">
                {{ formatFileSize(versionPreviewMeta.fileSize) }}
              </a-descriptions-item>
            </a-descriptions>
            <div v-if="versionPreviewMeta.spriteNames.length > 0" class="preview-sprites">
              <span class="preview-sprites-label">包含角色：</span>
              <a-tag v-for="name in versionPreviewMeta.spriteNames" :key="name" color="blue">
                {{ name }}
              </a-tag>
            </div>
          </div>

          <!-- 教案摘要：预览版本时同步展示备课教案完成度，便于判断该版本是否可直接用于授课 -->
          <div class="preview-plan">
            <div class="preview-plan-head">
              <FormOutlined />
              <span class="preview-plan-title">
                {{ versionPreviewPlan ? (versionPreviewPlan.title || '教案') : '教案' }}
              </span>
              <a-tag v-if="versionPreviewPlan?.durationMinutes" color="orange" size="small">
                <ScheduleOutlined /> {{ versionPreviewPlan.durationMinutes }} 分钟
              </a-tag>
              <a-tag v-if="versionPreviewPlan" color="green" size="small">
                已填 {{ versionPreviewPlanSections.length }}/5
              </a-tag>
              <a-tag v-else color="default" size="small">未编写</a-tag>
            </div>
            <div v-if="versionPreviewPlanSections.length > 0" class="preview-plan-sections">
              <a-tag
                v-for="sec in versionPreviewPlanSections"
                :key="sec"
                color="green"
                size="small"
              >{{ sec }}</a-tag>
            </div>
            <div v-if="versionPreviewPlan?.objectives" class="preview-plan-block">
              <span class="preview-plan-label">教学目标：</span>
              <span class="preview-plan-text">{{ truncateMd(versionPreviewPlan.objectives) }}</span>
            </div>
            <div v-if="versionPreviewPlan?.process" class="preview-plan-block">
              <span class="preview-plan-label">教学过程：</span>
              <span class="preview-plan-text">{{ truncateMd(versionPreviewPlan.process) }}</span>
            </div>
            <a-button
              size="small"
              type="link"
              style="padding: 4px 0 0"
              @click="editPlanFromPreview"
            >
              <EditOutlined /> {{ versionPreviewPlan ? '编辑教案' : '编写教案' }}
            </a-button>
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- ============ 资源预览 Modal ============ -->
    <a-modal
      v-model:open="resourcePreviewVisible"
      :title="`素材预览 - ${resourcePreviewTitle}`"
      :footer="null"
      width="520px"
    >
      <a-spin :spinning="resourcePreviewLoading">
        <div class="resource-preview">
          <a-empty
            v-if="!resourcePreviewUrl"
            description="无法预览该素材（文件可能已丢失或不支持预览）"
          />
          <div v-else-if="resourcePreviewType === 'sound'" class="preview-audio">
            <audio :src="resourcePreviewUrl" controls style="width: 100%"></audio>
          </div>
          <div v-else class="preview-image">
            <a-image :src="resourcePreviewUrl" :width="460" />
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- ============ 教案编辑器 Modal ============ -->
    <a-modal
      v-model:open="planEditorVisible"
      :title="planEditorIsEdit ? '编辑教案' : '新建教案'"
      :confirm-loading="planSubmitting"
      width="820px"
      :ok-text="planEditorIsEdit ? '保存' : '创建'"
      @ok="submitPlan"
    >
      <a-form layout="vertical" class="plan-form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="所属点子">
              <a-select
                v-model:value="planForm.ideaId"
                placeholder="选择点子"
                :options="planIdeaOptions"
                show-search
                option-filter-prop="label"
                @change="onPlanIdeaChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="关联版本" required>
              <a-select
                v-model:value="planForm.ideaVersionId"
                placeholder="选择版本"
                :options="planVersionOptions"
                :disabled="!planForm.ideaId"
                show-search
                option-filter-prop="label"
                @change="onPlanVersionChange"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="教案标题">
          <a-input
            v-model:value="planForm.title"
            placeholder="可选，留空则使用「版本名 教案」"
          />
        </a-form-item>
        <a-form-item label="预计时长（分钟）">
          <a-input-number
            v-model:value="planForm.durationMinutes"
            :min="0"
            :max="300"
            placeholder="如 45"
            style="width: 200px"
          />
        </a-form-item>
        <a-form-item label="知识点标签">
          <a-select
            v-model:value="planForm.knowledgePoints"
            mode="tags"
            placeholder="回车添加知识点，如「循环」「变量」「碰撞检测」"
            :token-separators="[',']"
            style="width: 100%"
          />
        </a-form-item>

        <!-- AI 辅助生成教案草稿 -->
        <div class="plan-ai-toolbar">
          <a-button
            type="primary"
            ghost
            :loading="planAiGenerating"
            :disabled="!canGeneratePlanDraft"
            @click="generatePlanDraft"
          >
            <template #icon><ThunderboltOutlined /></template>
            AI 生成教案草稿
          </a-button>
          <span v-if="!aiConfigured" class="plan-ai-hint">
            未配置 AI，请在「设置」中配置第三方 AI 参数
          </span>
          <span v-else-if="!planForm.ideaVersionId" class="plan-ai-hint">
            请先选择关联版本
          </span>
          <span v-else-if="planAiGenerating" class="plan-ai-hint">
            正在生成…
          </span>
          <a-tooltip title="将当前教案四章节内容保存为可复用的自定义模板">
            <a-button
              :disabled="!planForm.title.trim() || !planForm.objectives && !planForm.keyPoints && !planForm.preparation && !planForm.process"
              @click="saveCurrentAsTemplate"
            >
              <template #icon><SaveOutlined /></template>
              保存为模板
            </a-button>
          </a-tooltip>
        </div>
        <div v-if="planAiGenerating && planAiDraftText" class="plan-ai-preview">
          <div class="plan-ai-preview-label">AI 实时输出：</div>
          <pre class="plan-ai-preview-text">{{ planAiDraftText }}</pre>
        </div>

        <a-collapse
          :default-active-key="['objectives', 'process']"
          class="plan-collapse"
        >
          <a-collapse-panel key="objectives" header="教学目标">
            <a-textarea
              v-model:value="planForm.objectives"
              :rows="4"
              placeholder="本节课要达成的教学目标，支持 Markdown"
            />
          </a-collapse-panel>
          <a-collapse-panel key="keyPoints" header="教学重难点">
            <a-textarea
              v-model:value="planForm.keyPoints"
              :rows="4"
              placeholder="教学重点与难点"
            />
          </a-collapse-panel>
          <a-collapse-panel key="preparation" header="教学准备">
            <div class="segment-toolbar">
              <a-button size="small" @click="openResourcePicker">
                <AppstoreOutlined /> 插入资源库素材
              </a-button>
              <span class="segment-toolbar-hint">从资源库选择素材，插入到此处作为准备清单</span>
            </div>
            <!-- 已挂载素材 chip 列表（G13）：结构化关联，授课侧可一键打开 -->
            <div v-if="allPlanResources.length" class="plan-resource-chips">
              <span
                v-for="pr in allPlanResources"
                :key="pr.id"
                class="plan-resource-chip"
                :class="`chip-${pr.resource?.type ?? 'default'}`"
              >
                <span class="chip-type">{{ pr.resource?.type ? resourceTypeText[pr.resource.type] : '素材' }}</span>
                <span class="chip-name">{{ pr.resource?.name ?? '未知素材' }}</span>
                <a-button
                  type="text"
                  size="small"
                  class="chip-remove"
                  @click="removePlanResource(pr)"
                >
                  <CloseOutlined />
                </a-button>
              </span>
            </div>
            <a-textarea
              ref="preparationTextareaRef"
              v-model:value="planForm.preparation"
              :rows="3"
              placeholder="课前准备事项：素材、环境、教具等；可点击上方按钮插入资源库素材"
            />
          </a-collapse-panel>
          <a-collapse-panel key="process" header="教学过程">
            <div class="segment-toolbar">
              <a-dropdown :trigger="['click']">
                <a-button size="small">
                  <PlusOutlined /> 插入教学环节
                </a-button>
                <template #overlay>
                  <a-menu @click="onSegmentMenuClick">
                    <a-menu-item
                      v-for="snip in teachingSnippets"
                      :key="snip.id"
                    >
                      <div class="segment-menu-item">
                        <span class="segment-menu-name">{{ snip.name }}</span>
                        <span class="segment-menu-time">约 {{ snip.suggestedMinutes }} 分钟</span>
                      </div>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
              <span class="segment-toolbar-hint">在光标位置插入结构化教学片段</span>
            </div>
            <a-textarea
              ref="processTextareaRef"
              v-model:value="planForm.process"
              :rows="6"
              placeholder="课堂推进步骤，可分阶段描述；可点击上方按钮快速插入教学环节片段"
            />
            <a-alert
              v-if="planForm.process"
              :type="processDurationStatus"
              show-icon
              :message="processDurationHint"
              style="margin-top: 8px"
            />
          </a-collapse-panel>
          <a-collapse-panel key="reflection" header="课后反思">
            <a-textarea
              v-model:value="planForm.reflection"
              :rows="4"
              placeholder="课后填写：哪些环节效果好、哪些需改进"
            />
          </a-collapse-panel>
          <a-collapse-panel key="docs" header="关联文档（教案级）">
            <div class="segment-toolbar">
              <a-input
                v-model:value="planDocForm.url"
                placeholder="文档链接（如语雀/PPT/工作表 URL）"
                style="width: 280px"
                @press-enter="addPlanDoc"
              />
              <a-input
                v-model:value="planDocForm.title"
                placeholder="标题（可选）"
                style="width: 180px"
                @press-enter="addPlanDoc"
              />
              <a-button size="small" type="primary" @click="addPlanDoc">
                <PlusOutlined /> 添加
              </a-button>
            </div>
            <div v-if="allPlanDocs.length" class="plan-doc-list">
              <div v-for="d in allPlanDocs" :key="d.id" class="plan-doc-item">
                <LinkOutlined class="plan-doc-icon" />
                <a class="plan-doc-link" @click="openPlanDoc(d.url)">
                  {{ d.title || d.url }}
                </a>
                <a-button
                  type="text"
                  size="small"
                  class="plan-doc-remove"
                  @click="removePlanDoc(d)"
                >
                  <CloseOutlined />
                </a-button>
              </div>
            </div>
            <span v-else class="plan-doc-empty">暂无关联文档，可挂载语雀/PPT/工作表等外部资料到教案，跨课次复用</span>
          </a-collapse-panel>
        </a-collapse>

        <!-- 备课就绪度清单（G15）：随编辑实时刷新，逐项引导补齐 -->
        <div class="plan-readiness-panel">
          <div class="plan-readiness-head">
            <span class="plan-readiness-title">
              <CheckCircleOutlined /> 备课就绪度
            </span>
            <a-tag :color="readinessLevelColor(planEditorReadiness.level)">
              {{ readinessLevelText(planEditorReadiness.level) }}
            </a-tag>
            <a-progress
              :percent="planEditorReadiness.pct"
              :stroke-color="readinessLevelColor(planEditorReadiness.level) === 'green' ? '#52c41a' : readinessLevelColor(planEditorReadiness.level) === 'gold' ? '#faad14' : '#ff4d4f'"
              :show-info="true"
              size="small"
              style="flex: 1; min-width: 120px; margin: 0 12px"
            />
            <span class="plan-readiness-count">
              {{ planEditorReadiness.passedCount }} / {{ planEditorReadiness.totalCount }}
            </span>
          </div>
          <div class="plan-readiness-items">
            <a-tooltip
              v-for="item in planEditorReadiness.items"
              :key="item.key"
              :title="item.hint"
            >
              <span
                class="plan-readiness-item"
                :class="{ 'is-passed': item.passed, 'is-missing': !item.passed }"
              >
                <CheckCircleOutlined v-if="item.passed" />
                <ClockCircleOutlined v-else />
                {{ item.label }}
              </span>
            </a-tooltip>
          </div>
        </div>

        <a-alert
          v-if="planEditorVersionHasPlan && !planEditorIsEdit"
          type="warning"
          show-icon
          message="该版本已有教案"
          description="保存将覆盖现有教案内容。"
          style="margin-top: 12px"
        />

        <!-- AI 教案优化建议（G7-3） -->
        <div class="plan-review-toolbar">
          <a-button
            type="primary"
            ghost
            :loading="planReviewing"
            :disabled="!canReviewPlan"
            @click="reviewCurrentPlan"
          >
            <template #icon><ThunderboltOutlined /></template>
            AI 优化建议
          </a-button>
          <span v-if="!aiConfigured" class="plan-ai-hint">
            未配置 AI，请在「设置」中配置第三方 AI 参数
          </span>
          <span v-else-if="!editingPlanId" class="plan-ai-hint">
            请先保存教案，再获取优化建议
          </span>
          <span v-else-if="planReviewing" class="plan-ai-hint">
            正在分析教案…
          </span>
          <span v-else class="plan-ai-hint">
            基于当前教案内容生成点评与改进建议（点击会先保存最新内容）
          </span>
        </div>
        <div v-if="planReviewing || planReviewText" class="plan-review-panel">
          <div class="plan-review-label">
            <span>AI 优化建议：</span>
            <span class="plan-review-actions">
              <a-button
                v-if="reviewDemoText && !planReviewing"
                size="small"
                type="link"
                @click="applyReviewDemoToProcess"
              >应用示范到教学过程</a-button>
              <a-button
                v-if="planReviewText && !planReviewing"
                size="small"
                type="link"
                @click="planReviewText = ''"
              >清空</a-button>
            </span>
          </div>
          <pre class="plan-review-text">{{ planReviewText || '正在生成…' }}</pre>
        </div>
      </a-form>
    </a-modal>

    <!-- ============ 教案克隆 Modal ============ -->
    <a-modal
      v-model:open="clonePlanVisible"
      title="一键克隆教案"
      :width="560"
      :confirm-loading="cloning"
      ok-text="克隆"
      cancel-text="取消"
      @ok="confirmClonePlan"
    >
      <a-alert
        type="info"
        show-icon
        message="将源教案内容复制到新版本，反思不复制"
        description="克隆会在目标点子下创建新版本并持久化保存教案内容，便于基于历史教案快速派生新备课。"
        style="margin-bottom: 12px"
      />
      <a-form layout="vertical">
        <a-form-item label="源教案">
          <a-input :value="clonePlanSourceTitle" disabled />
        </a-form-item>
        <a-form-item label="目标点子">
          <a-radio-group v-model:value="clonePlanTargetMode">
            <a-radio value="new">新建点子</a-radio>
            <a-radio value="existing">选择已有点子</a-radio>
          </a-radio-group>
          <a-input
            v-if="clonePlanTargetMode === 'new'"
            v-model:value="clonePlanForm.ideaTitle"
            placeholder="新点子标题（留空则沿用源教案点子标题）"
            style="margin-top: 8px"
          />
          <a-select
            v-else
            v-model:value="clonePlanForm.ideaId"
            placeholder="选择目标点子"
            style="width: 100%; margin-top: 8px"
            :options="cloneIdeaOptions"
            show-search
            :filter-option="filterIdeaOption"
          />
        </a-form-item>
        <a-form-item label="新版本名" required>
          <a-input v-model:value="clonePlanForm.versionName" placeholder="如：v2 / 优化版 / 某某班定制版" />
        </a-form-item>
        <a-form-item label="新教案标题">
          <a-input
            v-model:value="clonePlanForm.title"
            placeholder="留空则沿用源标题加「（副本）」后缀"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ============ 教案模板库 Modal ============ -->
    <a-modal
      v-model:open="templateGalleryVisible"
      title="教案模板库"
      :footer="null"
      width="780px"
    >
      <a-alert
        type="info"
        show-icon
        message="选用模板会预填教案的四个章节内容"
        description="反思章节不会预填（属课后内容）。选用后请选择关联版本，并按实际学情调整内容后保存。"
        style="margin-bottom: 16px"
      />
      <div class="tpl-filter">
        <a-radio-group v-model:value="templateFilterCategory" button-style="solid">
          <a-radio-button value="">全部</a-radio-button>
          <a-radio-button
            v-for="cat in templateCategories"
            :key="cat"
            :value="cat"
          >
            {{ cat === 'custom' ? '我的模板' : LESSON_PLAN_TEMPLATE_CATEGORY_TEXT[cat] }}
          </a-radio-button>
        </a-radio-group>
        <span class="tpl-filter-hint">
          内置模板不可修改；「我的模板」由你从教案保存，可随时选用或删除。
        </span>
      </div>
      <a-list
        :data-source="filteredTemplates"
        :loading="customTemplatesLoading"
        :grid="{ gutter: 16, column: 2 }"
        :locale="{ emptyText: '该分类暂无模板' }"
      >
        <template #renderItem="{ item }">
          <a-card class="tpl-card" size="small" hoverable>
            <template #title>
              <div class="tpl-title">
                <span class="tpl-name">{{ item.name }}</span>
                <a-tag
                  :color="item.source === 'custom' ? 'magenta' : LESSON_PLAN_TEMPLATE_CATEGORY_COLOR[item.category as LessonPlanTemplateCategory]"
                  size="small"
                >
                  {{ item.source === 'custom' ? '我的模板' : LESSON_PLAN_TEMPLATE_CATEGORY_TEXT[item.category as LessonPlanTemplateCategory] }}
                </a-tag>
              </div>
            </template>
            <template #extra>
              <a-tag v-if="item.durationMinutes" color="orange" size="small">
                <ScheduleOutlined /> {{ item.durationMinutes }} 分钟
              </a-tag>
            </template>
            <p class="tpl-desc">{{ item.description || '（无描述）' }}</p>
            <div class="tpl-sections">
              <a-tag v-if="item.objectives" color="green" size="small">目标</a-tag>
              <a-tag v-if="item.keyPoints" color="blue" size="small">重难点</a-tag>
              <a-tag v-if="item.preparation" color="cyan" size="small">准备</a-tag>
              <a-tag v-if="item.process" color="purple" size="small">过程</a-tag>
            </div>
            <div class="tpl-actions">
              <a-button
                type="primary"
                size="small"
                style="flex: 1"
                @click="applyTemplate(item)"
              >
                选用此模板
              </a-button>
              <a-popconfirm
                v-if="item.source === 'custom'"
                title="确认删除该自定义模板？"
                @confirm="removeCustomTemplate(item.id)"
              >
                <a-button size="small" danger><DeleteOutlined /></a-button>
              </a-popconfirm>
            </div>
          </a-card>
        </template>
      </a-list>
    </a-modal>

    <!-- ============ 资源库选择器 Modal（插入教学准备） ============ -->
    <a-modal
      v-model:open="resourcePickerVisible"
      title="选择资源库素材"
      :footer="null"
      width="640px"
    >
      <a-alert
        type="info"
        show-icon
        message="点击素材将其以 Markdown 列表项插入「教学准备」光标处"
        style="margin-bottom: 12px"
      />
      <div class="resource-picker-filter">
        <a-select
          v-model:value="resourcePickerFilter.type"
          style="width: 120px"
          placeholder="类型"
          allow-clear
          @change="loadResourcePicker"
        >
          <a-select-option value="backdrop">背景</a-select-option>
          <a-select-option value="sprite">角色</a-select-option>
          <a-select-option value="sound">音效</a-select-option>
        </a-select>
        <a-input-search
          v-model:value="resourcePickerFilter.keyword"
          placeholder="按名称搜索"
          style="width: 220px"
          allow-clear
          @search="loadResourcePicker"
        />
      </div>
      <a-list
        :data-source="resourcePickerList"
        :loading="resourcePickerLoading"
        :locale="{ emptyText: '没有匹配的素材' }"
        size="small"
      >
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #title>
                <span>{{ item.name }}</span>
                <a-tag size="small" style="margin-left: 6px">
                  {{ item.type === 'backdrop' ? '背景' : item.type === 'sprite' ? '角色' : '音效' }}
                </a-tag>
              </template>
              <template #description>
                <span v-if="item.tags && item.tags.length" class="rp-tags">
                  标签：{{ item.tags.join('、') }}
                </span>
                <span v-else class="rp-tags">无标签</span>
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-button size="small" type="primary" @click="insertResource(item)">
                插入
              </a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  BulbOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  PlusOutlined,
  PlusCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  LinkOutlined,
  GlobalOutlined,
  EditOutlined,
  EyeOutlined,
  FormOutlined,
  ScheduleOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
  DownloadOutlined,
  CopyOutlined,
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  FilePdfOutlined,
  SnippetsOutlined,
  BankOutlined,
  TagOutlined,
  CloseOutlined,
  BranchesOutlined,
  ForkOutlined,
  TagsOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import { call } from '@renderer/api'
import { subscribeRefresh, subscribeNewItem } from '@renderer/composables/useShortcuts'
import WeekSchedule from '@renderer/components/WeekSchedule.vue'
import {
  LESSON_PLAN_TEMPLATES,
  LESSON_PLAN_TEMPLATE_CATEGORY_TEXT,
  LESSON_PLAN_TEMPLATE_CATEGORY_COLOR
} from '@shared/lesson-plan-templates'
import type { LessonPlanTemplateCategory } from '@shared/lesson-plan-templates'
import { SaveOutlined } from '@ant-design/icons-vue'
import { TEACHING_SEGMENT_SNIPPETS } from '@shared/lesson-plan-snippets'
import type { TeachingSegmentSnippet } from '@shared/lesson-plan-snippets'
import {
  computePlanReadiness,
  parseProcessSegments,
  readinessLevelText,
  readinessLevelColor
} from '@shared/plan-readiness'
import type {
  Idea,
  IdeaStatus,
  IdeaVersion,
  Resource,
  ResourceType,
  Lesson,
  LessonPlan,
  LessonPlanInput,
  LessonPlanCloneInput,
  PlanResource,
  LessonPlanTemplateRecord,
  LessonPlanTemplateRecordInput,
  PrepOverview,
  PrepReadinessSnapshot,
  PrepStage,
  ScratchSavePayload,
  VersionMeta,
  DocLinkWithLesson,
  PlanDocLink
} from '@shared/types'

// ============ 公共 ============
const activeTab = ref<'ideas' | 'plans' | 'calendar' | 'resources' | 'docs'>('ideas')

function formatDate(d: string): string {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
}

const ideaStatusText: Record<IdeaStatus, string> = {
  idea: '点子',
  developing: '开发中',
  archived: '已归档'
}
const ideaStatusColor: Record<IdeaStatus, string> = {
  idea: 'blue',
  developing: 'gold',
  archived: 'default'
}
const resourceTypeText: Record<ResourceType, string> = {
  backdrop: '背景',
  sprite: '角色',
  sound: '音效'
}
const resourceTypeColor: Record<ResourceType, string> = {
  backdrop: 'blue',
  sprite: 'green',
  sound: 'purple'
}

// ============ 点子库 ============
const ideas = ref<Idea[]>([])
const ideasLoading = ref(false)
const expandedMap = reactive<Record<string, boolean>>({})

async function loadIdeas(): Promise<void> {
  ideasLoading.value = true
  try {
    ideas.value = await call(window.api.idea.list())
  } catch (e) {
    message.error(`加载点子失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    ideasLoading.value = false
  }
}

function toggleVersions(id: string): void {
  expandedMap[id] = !expandedMap[id]
}

async function launchVersion(versionId: string): Promise<void> {
  try {
    await call(window.api.scratch.launch(versionId))
    message.success('已打开 Scratch 编辑器并加载该版本')
  } catch (e) {
    message.error(`启动失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeIdea(id: string): Promise<void> {
  try {
    await call(window.api.idea.remove(id))
    message.success('已删除点子')
    await loadIdeas()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeVersion(versionId: string): Promise<void> {
  try {
    await call(window.api.idea.removeVersion(versionId))
    message.success('已删除版本')
    await loadIdeas()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// ============ 教案 ============
const plans = ref<LessonPlan[]>([])
const plansLoading = ref(false)
const planKeyword = ref('')
// 历史教案按班级/科目检索（G12）
const planFilterClassId = ref<string | undefined>(undefined)
const planFilterSubject = ref<string | undefined>(undefined)
const planClassOptions = ref<Array<{ label: string; value: string }>>([])
const planSubjectOptions = ref<Array<{ label: string; value: string }>>([])
// 备课进度看板（G6-4）
const prepOverview = ref<PrepOverview | null>(null)
const prepOverviewLoading = ref(false)
// G20: 就绪度趋势日快照（近 30 天），看板加载后绘制趋势曲线
const readinessTrend = ref<PrepReadinessSnapshot[]>([])
const readinessTrendLoading = ref(false)
const planEditorVisible = ref(false)
const planEditorIsEdit = ref(false)
const planEditorVersionHasPlan = ref(false)
const planSubmitting = ref(false)
/** 当前编辑中的教案 ID（仅编辑已有教案时有值，供 AI 优化建议使用） */
const editingPlanId = ref<string | null>(null)
// 教案-资源结构化关联（G13）：编辑器内展示的已挂载素材 chip
const planResources = ref<PlanResource[]>([])
/**
 * 新建态未保存时缓存的待挂载资源（保存成功后批量 attach）。
 * 存 PlanResource 形状（合成 id 以 pending: 前缀），便于与已挂载项统一渲染 chip。
 */
const pendingAttachResources = ref<PlanResource[]>([])
/** 编辑器内展示的全部素材 chip（已挂载 + 待挂载），用于统一渲染 */
const allPlanResources = computed<PlanResource[]>(() => [
  ...planResources.value,
  ...pendingAttachResources.value
])
// 教案级文档挂载（G17）：已保存的关联文档
const planDocs = ref<PlanDocLink[]>([])
// 新建态未保存时缓存的待挂载文档（id 以 pending: 前缀），保存后批量 linkToPlan
const pendingPlanDocs = ref<PlanDocLink[]>([])
/** 编辑器内展示的全部文档（已挂载 + 待挂载） */
const allPlanDocs = computed<PlanDocLink[]>(() => [
  ...planDocs.value,
  ...pendingPlanDocs.value
])
// 文档输入表单
const planDocForm = reactive({ url: '', title: '' })
// AI 辅助生成教案草稿
const planAiGenerating = ref(false)
const aiConfigured = ref(false)
const planAiDraftText = ref('')
// AI 教案优化建议（G7-3）
const planReviewing = ref(false)
const planReviewText = ref('')
// 教案模板库（G6-1 + G9-1 自定义模板）
const templateGalleryVisible = ref(false)
const templateFilterCategory = ref<LessonPlanTemplateCategory | 'custom' | ''>('')
/** 模板库展示用的统一形状：内置（static）与自定义（record）合并 */
type GalleryTemplate = {
  source: 'builtin' | 'custom'
  /** 内置用静态 id，自定义用数据库 id */
  id: string
  name: string
  category: LessonPlanTemplateCategory | 'custom'
  description: string
  durationMinutes: number | null
  objectives: string | null
  keyPoints: string | null
  preparation: string | null
  process: string | null
}
const customTemplates = ref<LessonPlanTemplateRecord[]>([])
const customTemplatesLoading = ref(false)
const templateCategories = computed<Array<LessonPlanTemplateCategory | 'custom'>>(() => {
  const set = new Set<LessonPlanTemplateCategory | 'custom'>()
  for (const t of LESSON_PLAN_TEMPLATES) set.add(t.category)
  if (customTemplates.value.length > 0) set.add('custom')
  return [...set]
})
/** 合并内置 + 自定义模板，并按分类过滤 */
const filteredTemplates = computed<GalleryTemplate[]>(() => {
  const cat = templateFilterCategory.value
  const builtin: GalleryTemplate[] = LESSON_PLAN_TEMPLATES.map((t) => ({
    source: 'builtin',
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    durationMinutes: t.durationMinutes,
    objectives: t.objectives,
    keyPoints: t.keyPoints,
    preparation: t.preparation,
    process: t.process
  }))
  const custom: GalleryTemplate[] = customTemplates.value.map((t) => ({
    source: 'custom',
    id: t.id,
    name: t.name,
    category: 'custom',
    description: t.description ?? '',
    durationMinutes: t.durationMinutes,
    objectives: t.objectives,
    keyPoints: t.keyPoints,
    preparation: t.preparation,
    process: t.process
  }))
  const all = [...builtin, ...custom]
  if (!cat) return all
  return all.filter((t) => t.category === cat)
})
// 教学环节片段（G6-2）
const teachingSnippets = ref<TeachingSegmentSnippet[]>(TEACHING_SEGMENT_SNIPPETS)
const processTextareaRef = ref<{ resizableTextArea?: { textArea?: HTMLTextAreaElement } } | null>(null)
// 资源库素材选择器（G6-3）
const preparationTextareaRef = ref<{ resizableTextArea?: { textArea?: HTMLTextAreaElement } } | null>(null)
const resourcePickerVisible = ref(false)
const resourcePickerLoading = ref(false)
const resourcePickerList = ref<Resource[]>([])
const resourcePickerFilter = reactive<{ type: string; keyword: string }>({ type: '', keyword: '' })
const planForm = reactive<{
  ideaVersionId: string | undefined
  ideaId: string | undefined
  title: string
  objectives: string
  keyPoints: string
  preparation: string
  process: string
  reflection: string
  durationMinutes: number | null
  /** G21: 知识点标签 */
  knowledgePoints: string[]
}>({
  ideaVersionId: undefined,
  ideaId: undefined,
  title: '',
  objectives: '',
  keyPoints: '',
  preparation: '',
  process: '',
  reflection: '',
  durationMinutes: null,
  knowledgePoints: []
})

// ============ 教学过程环节时长汇总校验（G8-2） ============
/**
 * 解析「教学过程」中形如 `### 环节名（约X分钟）` / `（约X-Y分钟）` 的时长标注，
 * 汇总各环节时长并与预计时长对比，供编辑器实时提示。
 */
const processDurationSummary = computed(() => {
  // 复用共享解析逻辑（G15 统一），与就绪度计算保持同一规则源
  const segments = parseProcessSegments(planForm.process)
  const total = segments.reduce((s, x) => s + x.minutes, 0)
  const expected = planForm.durationMinutes
  return { segments, total, expected }
})

/** 时长校验状态：success / warning / error / info */
const processDurationStatus = computed<'success' | 'warning' | 'error' | 'info'>(() => {
  const { total, expected } = processDurationSummary.value
  if (total === 0) return 'info'
  if (expected == null) return 'info'
  const diff = Math.abs(total - expected)
  if (diff === 0) return 'success'
  if (diff <= 5) return 'warning'
  return 'error'
})

/** 时长校验提示文案 */
const processDurationHint = computed(() => {
  const { segments, total, expected } = processDurationSummary.value
  if (total === 0) {
    return '未识别到环节时长标注（建议在环节标题后加「（约X分钟）」）'
  }
  const segPart = segments.map((s) => `${s.name} ${s.minutes}分钟`).join(' · ')
  if (expected == null) {
    return `环节总时长 ${total} 分钟（${segPart}）— 未设置预计时长`
  }
  const diff = total - expected
  if (diff === 0) {
    return `环节总时长 ${total} 分钟，与预计时长匹配（${segPart}）`
  }
  const sign = diff > 0 ? '超出' : '少'
  const abs = Math.abs(diff)
  return `环节总时长 ${total} 分钟，${sign}预计时长 ${expected} 分钟 ${abs} 分钟（${segPart}）`
})

// ============ 备课就绪度清单（G15） ============
/**
 * 编辑器实时就绪度：基于 planForm 当前内容 + 已挂载/待挂载素材数量计算。
 * 随编辑实时刷新，引导教师补齐缺失维度。
 */
const planEditorReadiness = computed(() =>
  computePlanReadiness({
    objectives: planForm.objectives,
    keyPoints: planForm.keyPoints,
    preparation: planForm.preparation,
    process: planForm.process,
    durationMinutes: planForm.durationMinutes,
    resourceCount: allPlanResources.value.length
  })
)

/**
 * 教案卡片的就绪度（不含资源项：列表未附带 resources，避免误判）。
 * 用于卡片展示就绪徽章。
 */
function cardReadiness(plan: LessonPlan) {
  return computePlanReadiness({
    objectives: plan.objectives,
    keyPoints: plan.keyPoints,
    preparation: plan.preparation,
    process: plan.process,
    durationMinutes: plan.durationMinutes
  })
}

const planIdeaOptions = computed(() =>
  ideas.value.map((i) => ({ value: i.id, label: i.title }))
)

/** 教案编辑器中当前点子下的版本列表 */
const planVersionOptions = computed(() => {
  if (!planForm.ideaId) return []
  const idea = ideas.value.find((i) => i.id === planForm.ideaId)
  return (idea?.versions ?? []).map((v) => ({
    value: v.id,
    label: v.versionName
  }))
})

async function loadPlans(): Promise<void> {
  plansLoading.value = true
  try {
    const q: { keyword?: string; classId?: string; subject?: string } = {}
    const kw = planKeyword.value.trim()
    if (kw) q.keyword = kw
    if (planFilterClassId.value) q.classId = planFilterClassId.value
    if (planFilterSubject.value) q.subject = planFilterSubject.value
    plans.value = await call(window.api.lessonPlan.list(Object.keys(q).length ? q : undefined))
  } catch (e) {
    message.error(`加载教案失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    plansLoading.value = false
  }
}

/**
 * 加载教案筛选下拉选项（G12）：
 * - 班级：从班级库拉取全部班级
 * - 科目：从课次列表中提取 distinct 非空 subject
 */
async function loadPlanFilterOptions(): Promise<void> {
  try {
    const [classes, lessonList] = await Promise.all([
      call(window.api.class.list()),
      call(window.api.lesson.list({}))
    ])
    planClassOptions.value = classes.map((c) => ({ label: c.name, value: c.id }))
    const subjectSet = new Set<string>()
    lessonList.forEach((l: Lesson) => {
      if (l.subject && l.subject.trim()) subjectSet.add(l.subject.trim())
    })
    planSubjectOptions.value = Array.from(subjectSet)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((s) => ({ label: s, value: s }))
  } catch {
    planClassOptions.value = []
    planSubjectOptions.value = []
  }
}

// ============ 备课进度看板（G6-4） ============
async function loadPrepOverview(): Promise<void> {
  prepOverviewLoading.value = true
  try {
    // 先加载看板：buildPrepOverview 会幂等记录当日就绪快照
    prepOverview.value = await call(window.api.lessonPlan.prepOverview())
    // 再加载趋势（包含刚写入的当日快照），并行不阻塞看板渲染
    readinessTrendLoading.value = true
    call(window.api.lessonPlan.readinessTrend(30))
      .then((trend) => {
        readinessTrend.value = trend
      })
      .catch((e) => {
        // 趋势加载失败不影响看板主功能
        console.warn('加载就绪趋势失败', e)
        readinessTrend.value = []
      })
      .finally(() => {
        readinessTrendLoading.value = false
      })
  } catch (e) {
    message.error(`加载备课看板失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    prepOverviewLoading.value = false
  }
}

/** 看板待办列表中备课阶段 → 标签文本/颜色 */
function overviewStageTag(stage: PrepStage): { text: string; color: string } {
  switch (stage) {
    case 'no-version':
      return { text: '待关联版本', color: 'volcano' }
    case 'no-plan':
      return { text: '待写教案', color: 'orange' }
    case 'plan-incomplete':
      return { text: '待完善教案', color: 'gold' }
    case 'ready':
      return { text: '就绪', color: 'green' }
  }
}

// ============ G20: 就绪度趋势 sparkline ============
const TREND_W = 280
const TREND_H = 48
/** SVG 折线点坐标（含 area 路径），仅 ≥2 个快照时有意义 */
const trendSparkline = computed<{ linePath: string; areaPath: string; points: Array<{ x: number; y: number; pct: number; date: string }> }>(() => {
  const snaps = readinessTrend.value
  const n = snaps.length
  if (n === 0) return { linePath: '', areaPath: '', points: [] }
  const pad = 4
  const w = TREND_W - pad * 2
  const h = TREND_H - pad * 2
  const pts = snaps.map((s, i) => {
    const x = pad + (n === 1 ? w / 2 : (i / (n - 1)) * w)
    const y = pad + (1 - s.readinessPct / 100) * h
    return { x, y, pct: s.readinessPct, date: s.snapshotDate }
  })
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(pad + h).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad + h).toFixed(1)} Z`
  return { linePath, areaPath, points: pts }
})
/** 趋势摘要：最新值 / 区间均值 / 较首日变化 */
const trendSummary = computed<{ latest: number | null; avg: number | null; delta: number | null }>(() => {
  const snaps = readinessTrend.value
  if (snaps.length === 0) return { latest: null, avg: null, delta: null }
  const latest = snaps[snaps.length - 1].readinessPct
  const avg = Math.round(snaps.reduce((s, x) => s + x.readinessPct, 0) / snaps.length)
  const delta = latest - snaps[0].readinessPct
  return { latest, avg, delta }
})

function fmtOverviewTime(iso: string): string {
  return dayjs(iso).format('MM-DD HH:mm')
}

// ============ 备课日历（G7-2） ============
const calendarLessons = ref<Lesson[]>([])
const calendarLoading = ref(false)
// 周偏移：0=本周，-1=上周，1=下周，依此类推
const calendarWeekOffset = ref(0)

const calendarRangeText = computed(() => {
  const base = dayjs().startOf('week').add(1, 'day') // 周一为一周起点
  const start = base.add(calendarWeekOffset.value, 'week')
  const end = start.add(6, 'day')
  return `${start.format('YYYY-MM-DD')} ~ ${end.format('YYYY-MM-DD')}`
})

async function loadCalendarLessons(): Promise<void> {
  calendarLoading.value = true
  try {
    const base = dayjs().startOf('week').add(1, 'day')
    const start = base.add(calendarWeekOffset.value, 'week')
    const end = start.add(7, 'day')
    calendarLessons.value = await call(
      window.api.lesson.list({ from: start.format('YYYY-MM-DD'), to: end.format('YYYY-MM-DD') })
    )
  } catch (e) {
    message.error(`加载课次日历失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    calendarLoading.value = false
  }
}

function shiftCalendarWeek(offset: number): void {
  if (offset === 0) {
    calendarWeekOffset.value = 0
  } else {
    calendarWeekOffset.value += offset
  }
  loadCalendarLessons()
}

function onCalendarLessonClick(lesson: Lesson): void {
  if (lesson.ideaVersionId) {
    openPlanForVersion(lesson.ideaVersionId)
  } else {
    Modal.info({
      title: '该课次尚未关联备课版本',
      content: '请到「教学」页为该课次关联点子版本后再编写教案。',
      okText: '知道了'
    })
  }
}

/** 计算教案已填写的章节标签 */
function planFilledSections(p: LessonPlan): string[] {
  const out: string[] = []
  if (p.objectives) out.push('教学目标')
  if (p.keyPoints) out.push('重难点')
  if (p.preparation) out.push('教学准备')
  if (p.process) out.push('教学过程')
  if (p.reflection) out.push('课后反思')
  return out
}

/** 截断 Markdown 文本用于预览（去标记符号 + 限长） */
function truncateMd(md: string): string {
  const plain = md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
  return plain.length > 80 ? plain.slice(0, 80) + '…' : plain
}

function resetPlanForm(): void {
  planForm.ideaVersionId = undefined
  planForm.ideaId = undefined
  planForm.title = ''
  planForm.objectives = ''
  planForm.keyPoints = ''
  planForm.preparation = ''
  planForm.process = ''
  planForm.reflection = ''
  planForm.durationMinutes = null
  planForm.knowledgePoints = []
  planEditorVersionHasPlan.value = false
  editingPlanId.value = null
  planReviewText.value = ''
  planResources.value = []
  pendingAttachResources.value = []
  planDocs.value = []
  pendingPlanDocs.value = []
  planDocForm.url = ''
  planDocForm.title = ''
}

function openNewPlanModal(): void {
  planEditorIsEdit.value = false
  resetPlanForm()
  planEditorVisible.value = true
}

// ============ 教案模板库（G6-1 + G9-1 自定义模板） ============
async function loadCustomTemplates(): Promise<void> {
  customTemplatesLoading.value = true
  try {
    customTemplates.value = await call(window.api.lessonPlanTemplate.list())
  } catch (e) {
    message.error(`加载自定义模板失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    customTemplatesLoading.value = false
  }
}

function openTemplateGallery(): void {
  templateFilterCategory.value = ''
  loadCustomTemplates()
  templateGalleryVisible.value = true
}

/** 选用模板：预填教案四章节内容并打开编辑器，需用户补选关联版本后保存 */
function applyTemplate(tpl: GalleryTemplate): void {
  planEditorIsEdit.value = false
  resetPlanForm()
  planForm.title = tpl.name
  planForm.objectives = tpl.objectives ?? ''
  planForm.keyPoints = tpl.keyPoints ?? ''
  planForm.preparation = tpl.preparation ?? ''
  planForm.process = tpl.process ?? ''
  planForm.durationMinutes = tpl.durationMinutes ?? null
  templateGalleryVisible.value = false
  planEditorVisible.value = true
  message.info('已套用模板，请选择关联版本并按学情调整后保存')
}

/** 将当前编辑器中的教案内容保存为自定义模板 */
async function saveCurrentAsTemplate(): Promise<void> {
  if (!planForm.title.trim()) {
    message.warning('请先填写教案标题作为模板名')
    return
  }
  const input: LessonPlanTemplateRecordInput = {
    name: planForm.title.trim(),
    description: planForm.objectives ? planForm.objectives.slice(0, 80) : null,
    durationMinutes: planForm.durationMinutes,
    objectives: planForm.objectives || null,
    keyPoints: planForm.keyPoints || null,
    preparation: planForm.preparation || null,
    process: planForm.process || null
  }
  try {
    await call(window.api.lessonPlanTemplate.create(input))
    message.success('已保存为自定义模板')
    await loadCustomTemplates()
  } catch (e) {
    message.error(`保存模板失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

/** 删除自定义模板（内置模板不可删） */
async function removeCustomTemplate(id: string): Promise<void> {
  try {
    await call(window.api.lessonPlanTemplate.remove(id))
    message.success('已删除模板')
    await loadCustomTemplates()
  } catch (e) {
    message.error(`删除模板失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// ============ 教学环节片段插入（G6-2） ============
function snippetById(id: string): TeachingSegmentSnippet | undefined {
  return teachingSnippets.value.find((s) => s.id === id)
}

/** 下拉菜单点击：以 menu key 取对应片段插入到「教学过程」光标处 */
function onSegmentMenuClick(info: { key: unknown }): void {
  const snip = snippetById(String(info.key))
  if (snip) insertSegment(snip, processTextareaRef.value, 'process')
}

/**
 * 在指定文本框的光标位置插入片段内容；无光标信息时追加到末尾。
 * @param field 控制插入到 planForm 的哪个章节
 */
function insertSegment(
  snip: TeachingSegmentSnippet,
  textareaRef: { resizableTextArea?: { textArea?: HTMLTextAreaElement } } | null,
  field: 'process'
): void {
  const el = textareaRef?.resizableTextArea?.textArea
  const content = snip.content
  if (!el) {
    planForm[field] = planForm[field] ? `${planForm[field]}\n\n${content}` : content
    return
  }
  const start = el.selectionStart ?? planForm[field].length
  const end = el.selectionEnd ?? planForm[field].length
  const before = planForm[field].slice(0, start)
  const after = planForm[field].slice(end)
  const needNewlineBefore = before.length > 0 && !before.endsWith('\n')
  const needNewlineAfter = after.length > 0 && !after.startsWith('\n')
  const inserted = `${needNewlineBefore ? '\n\n' : ''}${content}${needNewlineAfter ? '\n\n' : ''}`
  planForm[field] = before + inserted + after
  nextTick(() => {
    const pos = (before + inserted).length
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

// ============ 资源库素材插入教学准备（G6-3） ============
async function loadResourcePicker(): Promise<void> {
  resourcePickerLoading.value = true
  try {
    const q: { type?: ResourceType; keyword?: string } = {}
    if (resourcePickerFilter.type) q.type = resourcePickerFilter.type as ResourceType
    if (resourcePickerFilter.keyword) q.keyword = resourcePickerFilter.keyword
    resourcePickerList.value = await call(window.api.resource.list(q))
  } catch (e) {
    message.error(`加载素材失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    resourcePickerLoading.value = false
  }
}

function openResourcePicker(): void {
  resourcePickerFilter.type = ''
  resourcePickerFilter.keyword = ''
  resourcePickerVisible.value = true
  loadResourcePicker()
}

/**
 * 将选中的资源以 Markdown 列表项插入「教学准备」光标处，
 * 同时建立结构化关联（双轨兼容）：
 * - 编辑态（editingPlanId 有值）：直接 attachResource 落库并刷新 chip 列表
 * - 新建态：缓存到 pendingAttachResources，submitPlan 后批量 attach
 */
async function insertResource(res: Resource): Promise<void> {
  const typeText = res.type === 'backdrop' ? '背景' : res.type === 'sprite' ? '角色' : '音效'
  const tagPart = res.tags && res.tags.length ? `（标签: ${res.tags.join('、')}）` : ''
  const line = `- 【${typeText}】${res.name}${tagPart}`
  const el = preparationTextareaRef.value?.resizableTextArea?.textArea
  if (!el) {
    planForm.preparation = planForm.preparation
      ? `${planForm.preparation}\n${line}`
      : line
  } else {
    const start = el.selectionStart ?? planForm.preparation.length
    const end = el.selectionEnd ?? planForm.preparation.length
    const before = planForm.preparation.slice(0, start)
    const after = planForm.preparation.slice(end)
    const needNewlineBefore = before.length > 0 && !before.endsWith('\n')
    planForm.preparation = `${before}${needNewlineBefore ? '\n' : ''}${line}${after.startsWith('\n') || after.length === 0 ? '' : '\n'}${after}`
    nextTick(() => {
      const pos = (before + (needNewlineBefore ? '\n' : '') + line).length
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }
  // 结构化关联：避免同一资源重复挂载
  const alreadyAttached = planResources.value.some((pr) => pr.resourceId === res.id)
  const alreadyPending = pendingAttachResources.value.some((pr) => pr.resourceId === res.id)
  if (alreadyAttached || alreadyPending) return
  if (editingPlanId.value) {
    try {
      const attached = await call(
        window.api.lessonPlan.attachResource(editingPlanId.value, {
          resourceId: res.id,
          section: 'preparation'
        })
      )
      planResources.value = [...planResources.value, attached]
    } catch (e) {
      message.error(`关联素材失败：${String(e instanceof Error ? e.message : e)}`)
    }
  } else {
    // 新建态：合成 pending PlanResource（带资源快照）便于 chip 渲染
    const synthetic: PlanResource = {
      id: `pending:${res.id}`,
      planId: '',
      resourceId: res.id,
      section: 'preparation',
      sortOrder: pendingAttachResources.value.length,
      note: null,
      createdAt: new Date().toISOString(),
      resource: res
    }
    pendingAttachResources.value = [...pendingAttachResources.value, synthetic]
  }
}

/** 移除已挂载素材：编辑态调用 detachResource，新建态从 pending 列表移除 */
async function removePlanResource(pr: PlanResource): Promise<void> {
  if (pr.id.startsWith('pending:')) {
    pendingAttachResources.value = pendingAttachResources.value.filter(
      (r) => r.id !== pr.id
    )
    return
  }
  if (editingPlanId.value) {
    try {
      await call(
        window.api.lessonPlan.detachResource(editingPlanId.value, pr.resourceId, pr.section)
      )
    } catch (e) {
      message.error(`移除素材失败：${String(e instanceof Error ? e.message : e)}`)
      return
    }
    planResources.value = planResources.value.filter((r) => r.id !== pr.id)
  }
}

// ============ 教案级文档挂载（G17） ============
/**
 * 添加文档到当前教案：编辑态直接 linkToPlan 持久化；
 * 新建态缓存到 pendingPlanDocs，submitPlan 后批量挂载。
 */
async function addPlanDoc(): Promise<void> {
  const url = planDocForm.url.trim()
  if (!url) {
    message.warning('请填写文档链接')
    return
  }
  const title = planDocForm.title.trim() || url
  if (editingPlanId.value) {
    try {
      const doc = await call(window.api.doc.linkToPlan(editingPlanId.value, url, title))
      planDocs.value = [...planDocs.value, doc]
    } catch (e) {
      message.error(`关联文档失败：${String(e instanceof Error ? e.message : e)}`)
      return
    }
  } else {
    const synthetic: PlanDocLink = {
      id: `pending:${Date.now()}`,
      planId: '',
      url,
      title,
      createdAt: new Date().toISOString()
    }
    pendingPlanDocs.value = [...pendingPlanDocs.value, synthetic]
  }
  planDocForm.url = ''
  planDocForm.title = ''
}

/** 移除文档：编辑态调用 removeLink，新建态从 pending 列表移除 */
async function removePlanDoc(doc: PlanDocLink): Promise<void> {
  if (doc.id.startsWith('pending:')) {
    pendingPlanDocs.value = pendingPlanDocs.value.filter((d) => d.id !== doc.id)
    return
  }
  try {
    await call(window.api.doc.removeLink(doc.id))
  } catch (e) {
    message.error(`移除文档失败：${String(e instanceof Error ? e.message : e)}`)
    return
  }
  planDocs.value = planDocs.value.filter((d) => d.id !== doc.id)
}

/** 在系统浏览器打开文档链接 */
async function openPlanDoc(url: string): Promise<void> {
  try {
    await call(window.api.doc.openUrl(url))
  } catch (e) {
    message.error(`打开文档失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

/** 从版本入口打开教案编辑器：自动加载已有教案内容，无则新建 */
async function openPlanForVersion(versionId: string): Promise<void> {
  planEditorIsEdit.value = false
  resetPlanForm()
  planForm.ideaVersionId = versionId
  planEditorVisible.value = true
  try {
    const existing = await call(window.api.lessonPlan.getByVersion(versionId))
    if (existing) {
      planEditorIsEdit.value = true
      planEditorVersionHasPlan.value = true
      editingPlanId.value = existing.id
      planForm.ideaId = existing.ideaId
      planForm.title = existing.title ?? ''
      planForm.objectives = existing.objectives ?? ''
      planForm.keyPoints = existing.keyPoints ?? ''
      planForm.preparation = existing.preparation ?? ''
      planForm.process = existing.process ?? ''
      planForm.reflection = existing.reflection ?? ''
      planForm.durationMinutes = existing.durationMinutes ?? null
      planForm.knowledgePoints = existing.knowledgePoints ?? []
      // 加载已挂载的结构化素材 chip
      planResources.value = await call(window.api.lessonPlan.listResources(existing.id))
      // 加载教案级文档（G17）
      planDocs.value = await call(window.api.doc.listByPlan(existing.id))
    }
  } catch (e) {
    message.error(`加载教案失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

/**
 * 按教案 ID 打开编辑器（G14 血统树：从「派生自」徽章跳转到源教案）。
 * 通过 lessonPlan.get 取到 ideaVersionId 后复用 openPlanForVersion 流程。
 */
async function openPlanForVersionById(planId: string): Promise<void> {
  try {
    const plan = await call(window.api.lessonPlan.get(planId))
    if (!plan) {
      message.warning('源教案已不存在（可能已被删除）')
      return
    }
    await openPlanForVersion(plan.ideaVersionId)
  } catch (e) {
    message.error(`加载源教案失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

function onPlanIdeaChange(): void {
  planForm.ideaVersionId = undefined
  planEditorVersionHasPlan.value = false
}

async function onPlanVersionChange(versionId: string): Promise<void> {
  if (!versionId) return
  planEditorVersionHasPlan.value = false
  try {
    const existing = await call(window.api.lessonPlan.getByVersion(versionId))
    if (existing) {
      planEditorVersionHasPlan.value = true
      // 切换到已有教案版本时预填充内容，避免覆盖时丢失
      planEditorIsEdit.value = true
      planForm.title = existing.title ?? ''
      planForm.objectives = existing.objectives ?? ''
      planForm.keyPoints = existing.keyPoints ?? ''
      planForm.preparation = existing.preparation ?? ''
      planForm.process = existing.process ?? ''
      planForm.reflection = existing.reflection ?? ''
      planForm.durationMinutes = existing.durationMinutes ?? null
      // 同步加载该教案的文档（G17）
      editingPlanId.value = existing.id
      planDocs.value = await call(window.api.doc.listByPlan(existing.id))
      pendingPlanDocs.value = []
    } else {
      planEditorIsEdit.value = false
      planForm.title = ''
      planForm.objectives = ''
      planForm.keyPoints = ''
      planForm.preparation = ''
      planForm.process = ''
      planForm.reflection = ''
      planForm.durationMinutes = null
      editingPlanId.value = null
      planDocs.value = []
      pendingPlanDocs.value = []
    }
  } catch {
    // 忽略，用户可继续手动填写
  }
}

async function submitPlan(): Promise<void> {
  if (!planForm.ideaVersionId) {
    message.warning('请选择关联版本')
    return
  }
  planSubmitting.value = true
  try {
    const input: LessonPlanInput = {
      ideaVersionId: planForm.ideaVersionId,
      title: planForm.title.trim() || null,
      objectives: planForm.objectives.trim() || null,
      keyPoints: planForm.keyPoints.trim() || null,
      preparation: planForm.preparation.trim() || null,
      process: planForm.process.trim() || null,
      reflection: planForm.reflection.trim() || null,
      durationMinutes: planForm.durationMinutes,
      knowledgePoints: planForm.knowledgePoints
    }
    const wasEdit = planEditorIsEdit.value
    const saved = await call(window.api.lessonPlan.upsert(input))
    editingPlanId.value = saved.id
    planEditorIsEdit.value = true
    // 新建态缓存的待挂载素材：保存成功后批量 attach 到新教案
    if (pendingAttachResources.value.length > 0) {
      try {
        const attached: PlanResource[] = []
        for (const pr of pendingAttachResources.value) {
          const a = await call(
            window.api.lessonPlan.attachResource(saved.id, {
              resourceId: pr.resourceId,
              section: pr.section,
              sortOrder: pr.sortOrder
            })
          )
          attached.push(a)
        }
        planResources.value = attached
      } catch (e) {
        message.error(`素材关联失败：${String(e instanceof Error ? e.message : e)}`)
      }
      pendingAttachResources.value = []
    }
    // 新建态缓存的待挂载文档（G17）：保存成功后批量 linkToPlan
    if (pendingPlanDocs.value.length > 0) {
      try {
        const linked: PlanDocLink[] = []
        for (const d of pendingPlanDocs.value) {
          const doc = await call(window.api.doc.linkToPlan(saved.id, d.url, d.title ?? ''))
          linked.push(doc)
        }
        planDocs.value = linked
      } catch (e) {
        message.error(`文档关联失败：${String(e instanceof Error ? e.message : e)}`)
      }
      pendingPlanDocs.value = []
    }
    message.success(wasEdit ? '教案已保存' : '教案已创建')
    planEditorVisible.value = false
    await loadPlans()
    await loadPrepOverview()
  } catch (e) {
    message.error(`保存失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    planSubmitting.value = false
  }
}

/**
 * 将 AI 返回的 Markdown 教案文本按二级标题切分为 5 个章节。
 * 兼容 ## / ### 与「教学重难点/重难点/教学重点」「课后反思/教学反思/反思」等变体。
 */
function splitLessonPlanMarkdown(text: string): {
  objectives: string
  keyPoints: string
  preparation: string
  process: string
  reflection: string
} {
  const sections = {
    objectives: '',
    keyPoints: '',
    preparation: '',
    process: '',
    reflection: ''
  }
  const headerMap: Array<{ key: keyof typeof sections; pattern: RegExp }> = [
    { key: 'objectives', pattern: /^#{1,3}\s*教学目标\s*$/ },
    { key: 'keyPoints', pattern: /^#{1,3}\s*(教学重难点|重难点|教学重点|重点难点)\s*$/ },
    { key: 'preparation', pattern: /^#{1,3}\s*教学准备\s*$/ },
    { key: 'process', pattern: /^#{1,3}\s*教学过程\s*$/ },
    { key: 'reflection', pattern: /^#{1,3}\s*(课后反思|教学反思|反思)\s*$/ }
  ]
  let current: keyof typeof sections | null = null
  for (const line of text.split('\n')) {
    const matched = headerMap.find((h) => h.pattern.test(line.trim()))
    if (matched) {
      current = matched.key
      continue
    }
    if (current) {
      sections[current] += line + '\n'
    }
  }
  for (const k of Object.keys(sections) as Array<keyof typeof sections>) {
    sections[k] = sections[k].trim()
  }
  return sections
}

/** AI 是否可生成草稿：已选关联版本且 AI 已配置且未在生成中 */
const canGeneratePlanDraft = computed(
  () => !!planForm.ideaVersionId && aiConfigured.value && !planAiGenerating.value
)

/** 触发 AI 生成教案草稿（流式） */
async function generatePlanDraft(): Promise<void> {
  if (!planForm.ideaVersionId) {
    message.warning('请先选择关联版本')
    return
  }
  // 任一章节已有内容时确认覆盖
  const hasContent =
    planForm.objectives ||
    planForm.keyPoints ||
    planForm.preparation ||
    planForm.process ||
    planForm.reflection
  if (hasContent) {
    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: 'AI 生成将覆盖现有教案',
        content: 'AI 草稿会替换当前 5 个章节的内容，是否继续？',
        okText: '覆盖并生成',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
    if (!confirmed) return
  }

  planAiGenerating.value = true
  planAiDraftText.value = ''
  try {
    const full = await call(
      window.api.lessonPlan.generateDraft(planForm.ideaVersionId, planForm.durationMinutes)
    )
    // 流式期间 chunk 已累加到 planAiDraftText，这里以最终返回值为准切分
    const sections = splitLessonPlanMarkdown(full || planAiDraftText.value)
    if (sections.objectives) planForm.objectives = sections.objectives
    if (sections.keyPoints) planForm.keyPoints = sections.keyPoints
    if (sections.preparation) planForm.preparation = sections.preparation
    if (sections.process) planForm.process = sections.process
    if (sections.reflection) planForm.reflection = sections.reflection
    message.success('教案草稿已生成，请检查并按需调整')
  } catch (e) {
    message.error(`AI 生成失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    planAiGenerating.value = false
    planAiDraftText.value = ''
  }
}

// ============ AI 教案优化建议（G7-3） ============
/** 是否可以发起 AI 优化建议：已配置 AI 且当前正在编辑已保存的教案 */
const canReviewPlan = computed(
  () => !!editingPlanId.value && aiConfigured.value && !planReviewing.value
)

/**
 * 基于当前教案内容发起 AI 优化建议。
 * 先将编辑器中的最新内容保存（确保 AI 点评基于最新版本），再流式拉取建议，
 * 增量累加到 planReviewText 供实时预览。
 */
async function reviewCurrentPlan(): Promise<void> {
  if (!editingPlanId.value || !planForm.ideaVersionId) {
    message.warning('请先保存教案再获取优化建议')
    return
  }
  if (!aiConfigured.value) {
    message.warning('未配置 AI，请在「设置」中配置第三方 AI 参数')
    return
  }
  planReviewing.value = true
  planReviewText.value = ''
  try {
    // 先保存当前编辑内容，确保 AI 点评基于最新版本
    const input: LessonPlanInput = {
      ideaVersionId: planForm.ideaVersionId,
      title: planForm.title.trim() || null,
      objectives: planForm.objectives.trim() || null,
      keyPoints: planForm.keyPoints.trim() || null,
      preparation: planForm.preparation.trim() || null,
      process: planForm.process.trim() || null,
      reflection: planForm.reflection.trim() || null,
      durationMinutes: planForm.durationMinutes,
      knowledgePoints: planForm.knowledgePoints
    }
    const saved = await call(window.api.lessonPlan.upsert(input))
    editingPlanId.value = saved.id
    planEditorIsEdit.value = true

    await call(window.api.lessonPlan.review(saved.id))
    // 流式期间 chunk 已累加到 planReviewText，无需额外处理
    message.success('AI 优化建议已生成')
  } catch (e) {
    message.error(`AI 优化建议失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    planReviewing.value = false
  }
}

/**
 * 从 AI 优化建议文本中提取「重点修订示范」章节下的引用块内容，
 * 供一键追加到「教学过程」。提取失败时返回空字符串。
 */
const reviewDemoText = computed(() => {
  const text = planReviewText.value
  if (!text) return ''
  // 定位「重点修订示范」标题，取其后到下一个 ### 或文末之间的引用行
  const m = text.match(/###\s*重点修订示范[\s\S]*?(?=###|$)/)
  if (!m) return ''
  const block = m[0]
  const quoteLines = block
    .split('\n')
    .filter((l) => l.trim().startsWith('>'))
    .map((l) => l.replace(/^\s*>\s?/, ''))
  return quoteLines.join('\n').trim()
})

/** 将 AI 示范文本追加到「教学过程」末尾（带分隔标题，便于人工再调整） */
function applyReviewDemoToProcess(): void {
  const demo = reviewDemoText.value
  if (!demo) {
    message.warning('未识别到可应用的示范文本')
    return
  }
  const block = `\n\n### AI 建议修订示范（待人工调整）\n${demo}`
  planForm.process = planForm.process ? `${planForm.process}${block}` : block
  message.success('已追加到「教学过程」末尾，请检查并调整')
}

async function removePlan(id: string): Promise<void> {
  try {
    await call(window.api.lessonPlan.remove(id))
    message.success('已删除教案')
    await loadPlans()
    await loadPrepOverview()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// 教案导出 / 复制为模板
const exportingId = ref<string | null>(null)
const duplicatingId = ref<string | null>(null)

// 教案克隆（G12）：一键复制到新版本并持久化保存
const clonePlanVisible = ref(false)
const cloning = ref(false)
const cloningId = ref<string | null>(null)
const clonePlanSourceId = ref<string | null>(null)
const clonePlanSourceTitle = ref('')
const clonePlanTargetMode = ref<'new' | 'existing'>('new')
const clonePlanForm = reactive<{
  ideaId: string | undefined
  ideaTitle: string
  versionName: string
  title: string
}>({
  ideaId: undefined,
  ideaTitle: '',
  versionName: '',
  title: ''
})
/** 目标点子下拉选项（从点子库派生） */
const cloneIdeaOptions = computed(() =>
  ideas.value.map((i) => ({ value: i.id, label: i.title }))
)

/** 导出指定教案为 Markdown 文件（主进程弹出保存对话框） */
async function exportPlan(plan: LessonPlan): Promise<void> {
  exportingId.value = plan.id
  try {
    const savedPath = await call(window.api.lessonPlan.exportMarkdown(plan.id))
    if (savedPath) {
      message.success(`已导出到：${savedPath}`)
    } else {
      message.info('已取消导出')
    }
  } catch (e) {
    message.error(`导出失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    exportingId.value = null
  }
}

/** 导出指定教案为 PDF 文件（主进程渲染 HTML 后 printToPDF，弹出保存对话框） */
async function exportPlanPdf(plan: LessonPlan): Promise<void> {
  exportingId.value = plan.id
  try {
    const savedPath = await call(window.api.lessonPlan.exportPdf(plan.id))
    if (savedPath) {
      message.success(`已导出 PDF 到：${savedPath}`)
    } else {
      message.info('已取消导出')
    }
  } catch (e) {
    message.error(`导出 PDF 失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    exportingId.value = null
  }
}

/**
 * 复制现有教案作为模板：在编辑器中预填所有章节内容，但清空关联版本与反思，
 * 让用户选择新版本后保存为一份独立教案，便于复用同一份备课结构。
 */
async function duplicatePlan(plan: LessonPlan): Promise<void> {
  duplicatingId.value = plan.id
  try {
    planEditorIsEdit.value = false
    resetPlanForm()
    // 复制章节内容作为模板；反思属于课后内容，不复用
    planForm.title = plan.title ? `${plan.title}（副本）` : ''
    planForm.objectives = plan.objectives ?? ''
    planForm.keyPoints = plan.keyPoints ?? ''
    planForm.preparation = plan.preparation ?? ''
    planForm.process = plan.process ?? ''
    planForm.reflection = ''
    planForm.durationMinutes = plan.durationMinutes ?? null
    planEditorVisible.value = true
    message.info('已复制教案内容为模板，请选择关联版本后保存')
  } finally {
    duplicatingId.value = null
  }
}

/**
 * 打开教案克隆弹窗：将源教案内容复制到新版本并持久化保存。
 * 与 duplicatePlan 的区别在于克隆会直接落库为独立教案，无需二次保存。
 */
function openClonePlanModal(plan: LessonPlan): void {
  cloningId.value = plan.id
  clonePlanSourceId.value = plan.id
  clonePlanSourceTitle.value =
    plan.title || `${plan.versionName ?? '未命名版本'} 教案`
  clonePlanTargetMode.value = 'new'
  clonePlanForm.ideaId = undefined
  // 默认沿用源点子标题，便于用户调整
  clonePlanForm.ideaTitle = plan.ideaTitle ?? ''
  // 默认版本名沿用源版本加 -clone 后缀，提示这是一个派生版本
  clonePlanForm.versionName = plan.versionName
    ? `${plan.versionName}-克隆`
    : '克隆版本'
  // 留空以触发后端「源标题 +（副本）」后缀默认逻辑
  clonePlanForm.title = ''
  clonePlanVisible.value = true
  cloningId.value = null
}

/** a-select 自定义过滤：按 label 模糊匹配 */
function filterIdeaOption(input: string, option: { label: string }): boolean {
  if (!option?.label) return false
  return option.label.toLowerCase().includes((input || '').toLowerCase())
}

/** 确认克隆：调用 lessonPlan.clone 落库并刷新列表 */
async function confirmClonePlan(): Promise<void> {
  if (clonePlanTargetMode.value === 'existing' && !clonePlanForm.ideaId) {
    message.warning('请选择目标点子')
    return
  }
  if (!clonePlanForm.versionName.trim()) {
    message.warning('请填写新版本名')
    return
  }
  cloning.value = true
  try {
    if (!clonePlanSourceId.value) throw new Error('未指定源教案')
    const input: LessonPlanCloneInput = {
      versionName: clonePlanForm.versionName.trim(),
      title: clonePlanForm.title.trim() ? clonePlanForm.title.trim() : null
    }
    if (clonePlanTargetMode.value === 'existing') {
      input.ideaId = clonePlanForm.ideaId
    } else {
      input.ideaTitle = clonePlanForm.ideaTitle.trim()
    }
    await call(window.api.lessonPlan.clone(clonePlanSourceId.value, input))
    message.success('已克隆到新版本')
    clonePlanVisible.value = false
    await loadIdeas()
    await loadPlans()
    await loadPrepOverview()
  } catch (e) {
    message.error(`克隆失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    cloning.value = false
  }
}

// 版本预览
const versionPreviewVisible = ref(false)
const versionPreviewLoading = ref(false)
const versionPreviewTitle = ref('')
const versionPreviewMeta = ref<VersionMeta | null>(null)
const versionPreviewPlan = ref<LessonPlan | null>(null)
const versionPreviewVersionId = ref<string | null>(null)
const previewingId = ref<string | null>(null)

/** 版本预览中已填写的教案章节标签 */
const versionPreviewPlanSections = computed<string[]>(() => {
  const p = versionPreviewPlan.value
  if (!p) return []
  const out: string[] = []
  if (p.objectives) out.push('教学目标')
  if (p.keyPoints) out.push('重难点')
  if (p.preparation) out.push('教学准备')
  if (p.process) out.push('教学过程')
  if (p.reflection) out.push('课后反思')
  return out
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function openVersionPreview(ver: IdeaVersion): Promise<void> {
  versionPreviewTitle.value = ver.versionName
  versionPreviewMeta.value = null
  versionPreviewPlan.value = null
  versionPreviewVersionId.value = ver.id
  versionPreviewVisible.value = true
  previewingId.value = ver.id
  versionPreviewLoading.value = true
  try {
    // 并行拉取作品元信息与教案，减少预览等待
    const [meta, plan] = await Promise.all([
      call(window.api.idea.getVersionMeta(ver.id)),
      call(window.api.lessonPlan.getByVersion(ver.id))
    ])
    versionPreviewMeta.value = meta
    versionPreviewPlan.value = plan ?? null
  } catch (e) {
    message.error(`预览失败：${String(e instanceof Error ? e.message : e)}`)
    versionPreviewVisible.value = false
  } finally {
    versionPreviewLoading.value = false
    previewingId.value = null
  }
}

/** 从版本预览跳转编写/编辑教案：关闭预览 Modal 并打开教案编辑器 */
function editPlanFromPreview(): void {
  const vid = versionPreviewVersionId.value
  versionPreviewVisible.value = false
  if (vid) openPlanForVersion(vid)
}

// 新建/编辑点子
const newIdeaModalVisible = ref(false)
const newIdeaSubmitting = ref(false)
const editingIdeaId = ref<string | null>(null)
const newIdeaForm = reactive({
  title: '',
  targetCourse: '',
  description: '',
  status: 'idea' as IdeaStatus
})

function openNewIdeaModal(): void {
  editingIdeaId.value = null
  newIdeaForm.title = ''
  newIdeaForm.targetCourse = ''
  newIdeaForm.description = ''
  newIdeaForm.status = 'idea'
  newIdeaModalVisible.value = true
}

function openEditIdeaModal(idea: Idea): void {
  editingIdeaId.value = idea.id
  newIdeaForm.title = idea.title
  newIdeaForm.targetCourse = idea.targetCourse ?? ''
  newIdeaForm.description = idea.description ?? ''
  newIdeaForm.status = idea.status
  newIdeaModalVisible.value = true
}

async function submitNewIdea(): Promise<void> {
  if (!newIdeaForm.title.trim()) {
    message.warning('请输入标题')
    return
  }
  newIdeaSubmitting.value = true
  try {
    const payload = {
      title: newIdeaForm.title.trim(),
      targetCourse: newIdeaForm.targetCourse.trim() || undefined,
      description: newIdeaForm.description.trim() || undefined,
      status: newIdeaForm.status
    }
    if (editingIdeaId.value) {
      await call(window.api.idea.update(editingIdeaId.value, payload))
      message.success('点子已更新')
    } else {
      await call(window.api.idea.create(payload))
      message.success('点子已创建')
    }
    newIdeaModalVisible.value = false
    await loadIdeas()
  } catch (e) {
    message.error(`${editingIdeaId.value ? '更新' : '创建'}失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    newIdeaSubmitting.value = false
  }
}

// 新建版本
const newVersionModalVisible = ref(false)
const newVersionSubmitting = ref(false)
const newVersionIdeaTitle = ref('')
const newVersionForm = reactive({
  ideaId: '',
  versionName: '',
  notes: ''
})

function openNewVersionModal(idea: Idea): void {
  newVersionIdeaTitle.value = idea.title
  newVersionForm.ideaId = idea.id
  newVersionForm.versionName = ''
  newVersionForm.notes = ''
  newVersionModalVisible.value = true
}

async function submitNewVersion(): Promise<void> {
  if (!newVersionForm.versionName.trim()) {
    message.warning('请输入版本名称')
    return
  }
  newVersionSubmitting.value = true
  try {
    await call(
      window.api.idea.createVersion({
        ideaId: newVersionForm.ideaId,
        versionName: newVersionForm.versionName.trim(),
        notes: newVersionForm.notes.trim() || undefined
      })
    )
    message.success('版本已创建')
    newVersionModalVisible.value = false
    await loadIdeas()
  } catch (e) {
    message.error(`创建失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    newVersionSubmitting.value = false
  }
}

// ============ 资源库 ============
const resources = ref<Resource[]>([])
const resourcesLoading = ref(false)
const resourceFilter = reactive<{ type: string; keyword: string; tag: string | undefined }>({
  type: '',
  keyword: '',
  tag: undefined
})

const resourceColumns = [
  { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '标签', dataIndex: 'tags', key: 'tags' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 180 }
]

// 全部可用标签（用于筛选下拉与编辑时的可选项）
const allTags = ref<string[]>([])
const tagOptions = computed(() => allTags.value.map((t) => ({ value: t, label: t })))

async function loadAllTags(): Promise<void> {
  try {
    allTags.value = await call(window.api.resource.allTags())
  } catch {
    // 忽略错误，保留旧值
  }
}

async function loadResources(): Promise<void> {
  resourcesLoading.value = true
  try {
    resources.value = await call(
      window.api.resource.list({
        type: resourceFilter.type || undefined,
        keyword: resourceFilter.keyword.trim() || undefined,
        tag: resourceFilter.tag || undefined
      })
    )
  } catch (e) {
    message.error(`加载素材失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    resourcesLoading.value = false
  }
}

async function importResource(): Promise<void> {
  try {
    const res = await call(window.api.scratch.pickResourceFile())
    message.success(`已导入素材：${res.name}`)
    await loadResources()
    await loadAllTags()
  } catch (e) {
    message.error(`导入失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeResource(id: string): Promise<void> {
  try {
    await call(window.api.resource.remove(id))
    message.success('已删除素材')
    await loadResources()
    await loadAllTags()
  } catch (e) {
    message.error(`删除失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// 资源预览
const resourcePreviewVisible = ref(false)
const resourcePreviewLoading = ref(false)
const resourcePreviewTitle = ref('')
const resourcePreviewUrl = ref('')
const resourcePreviewType = ref<ResourceType | ''>('')

async function openResourcePreview(record: Resource): Promise<void> {
  resourcePreviewTitle.value = record.name
  resourcePreviewUrl.value = ''
  resourcePreviewType.value = record.type
  resourcePreviewVisible.value = true
  resourcePreviewLoading.value = true
  try {
    const dataUrl = await call(window.api.resource.readFile(record.filePath))
    resourcePreviewUrl.value = dataUrl
  } catch (e) {
    message.error(`预览失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    resourcePreviewLoading.value = false
  }
}

// 资源编辑（标签 + 名称）
const editResourceModalVisible = ref(false)
const editResourceSubmitting = ref(false)
const editResourceForm = reactive<{ id: string; name: string; tags: string[] }>({
  id: '',
  name: '',
  tags: []
})

function openEditResourceModal(record: Resource): void {
  editResourceForm.id = record.id
  editResourceForm.name = record.name
  editResourceForm.tags = [...(record.tags || [])]
  editResourceModalVisible.value = true
}

async function submitEditResource(): Promise<void> {
  const name = editResourceForm.name.trim()
  if (!name) {
    message.warning('请输入名称')
    return
  }
  // 清理标签：去空白、去重
  const tags = Array.from(
    new Set(editResourceForm.tags.map((t) => t.trim()).filter(Boolean))
  )
  editResourceSubmitting.value = true
  try {
    await call(
      window.api.resource.update(editResourceForm.id, { name, tags })
    )
    message.success('已更新')
    editResourceModalVisible.value = false
    await loadResources()
    await loadAllTags()
  } catch (e) {
    message.error(`更新失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    editResourceSubmitting.value = false
  }
}

// ============ 文档中心 ============
const lessons = ref<Lesson[]>([])
const lessonsLoading = ref(false)
const docForm = reactive<{ url: string; title: string; lessonId: string | undefined }>({
  url: '',
  title: '',
  lessonId: undefined
})

const lessonOptions = computed(() =>
  lessons.value.map((l) => ({
    value: l.id,
    label: `${l.className || '未命名班级'} · ${formatDate(l.startTime)}`
  }))
)

const canLinkDoc = computed(
  () => !!docForm.url.trim() && !!docForm.title.trim() && !!docForm.lessonId
)

async function loadLessons(): Promise<void> {
  lessonsLoading.value = true
  try {
    lessons.value = await call(window.api.lesson.list({}))
  } catch (e) {
    message.error(`加载课次失败：${String(e instanceof Error ? e.message : e)}`)
  } finally {
    lessonsLoading.value = false
  }
}

async function linkDoc(): Promise<void> {
  if (!canLinkDoc.value || !docForm.lessonId) return
  try {
    await call(
      window.api.doc.linkToLesson(docForm.lessonId, docForm.url.trim(), docForm.title.trim())
    )
    message.success('已关联到课次')
    docForm.url = ''
    docForm.title = ''
    docForm.lessonId = undefined
    await loadDocLinks()
  } catch (e) {
    message.error(`关联失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function openDocInBrowser(): Promise<void> {
  const url = docForm.url.trim()
  if (!url) {
    message.warning('请先填写语雀文档 URL')
    return
  }
  try {
    await call(window.api.doc.openUrl(url))
  } catch (e) {
    message.error(`打开失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// 已关联文档列表
const docLinks = ref<DocLinkWithLesson[]>([])

async function loadDocLinks(): Promise<void> {
  try {
    docLinks.value = await call(window.api.doc.listAll())
  } catch (e) {
    message.error(`加载文档列表失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function removeDocLink(id: string): Promise<void> {
  try {
    await call(window.api.doc.removeLink(id))
    message.success('已取消关联')
    await loadDocLinks()
  } catch (e) {
    message.error(`取消关联失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

async function openDocUrl(url: string): Promise<void> {
  try {
    await call(window.api.doc.openUrl(url))
  } catch (e) {
    message.error(`打开失败：${String(e instanceof Error ? e.message : e)}`)
  }
}

// ============ Scratch 保存归档 ============
const saveModalVisible = ref(false)
const saveSubmitting = ref(false)
const saveTarget = ref<'idea' | 'resource'>('idea')
const saveIdeasLoading = ref(false)
const saveForm = reactive<{
  ideaId: string | undefined
  versionName: string
  notes: string
  resourceType: ResourceType
}>({
  ideaId: undefined,
  versionName: '',
  notes: '',
  resourceType: 'sprite'
})
let pendingSavePayload: ScratchSavePayload | null = null

const ideaSelectOptions = computed(() =>
  ideas.value.map((i) => ({ value: i.id, label: i.title }))
)

async function handleScratchSave(payload: ScratchSavePayload): Promise<void> {
  pendingSavePayload = payload
  saveTarget.value = 'idea'
  saveForm.ideaId = undefined
  saveForm.versionName = ''
  saveForm.notes = ''
  saveForm.resourceType = 'sprite'
  // 刷新点子列表，确保下拉框可选到最新点子
  saveIdeasLoading.value = true
  try {
    ideas.value = await call(window.api.idea.list())
  } catch {
    // 忽略，使用已有列表
  } finally {
    saveIdeasLoading.value = false
  }
  saveModalVisible.value = true
}

async function submitSave(): Promise<void> {
  if (!pendingSavePayload) {
    saveModalVisible.value = false
    return
  }
  if (saveTarget.value === 'idea') {
    if (!saveForm.ideaId) {
      message.warning('请选择所属点子')
      return
    }
    if (!saveForm.versionName.trim()) {
      message.warning('请输入版本名称')
      return
    }
    saveSubmitting.value = true
    try {
      await call(
        window.api.scratch.saveToIdea(pendingSavePayload, {
          ideaId: saveForm.ideaId,
          versionName: saveForm.versionName.trim(),
          notes: saveForm.notes.trim() || undefined
        })
      )
      message.success('已保存到点子库')
      saveModalVisible.value = false
      pendingSavePayload = null
      await loadIdeas()
    } catch (e) {
      message.error(`保存失败：${String(e instanceof Error ? e.message : e)}`)
    } finally {
      saveSubmitting.value = false
    }
  } else {
    saveSubmitting.value = true
    try {
      await call(window.api.scratch.saveToResource(pendingSavePayload, saveForm.resourceType))
      message.success('已保存到资源库')
      saveModalVisible.value = false
      pendingSavePayload = null
      if (activeTab.value === 'resources') await loadResources()
    } catch (e) {
      message.error(`保存失败：${String(e instanceof Error ? e.message : e)}`)
    } finally {
      saveSubmitting.value = false
    }
  }
}

// 事件订阅（preload 的 subscribe 函数：传入 handler，返回 unsubscribe）
type SaveHandler = (payload: ScratchSavePayload) => void
type SubscribeSave = (handler: SaveHandler) => () => void
let offScratchSave: (() => void) | null = null
// 全局刷新与新增项订阅取消函数
let offRefresh: (() => void) | null = null
let offNewItem: (() => void) | null = null
// 教案草稿流式 chunk 订阅
type PlanChunkRegistrar = (cb: (delta: string) => void) => () => void
let offPlanChunk: (() => void) | null = null
// 教案优化建议流式 chunk 订阅
let offPlanReviewChunk: (() => void) | null = null

onMounted(() => {
  loadIdeas()
  loadResources()
  loadAllTags()
  loadLessons()
  loadDocLinks()
  loadPlans()
  loadPrepOverview()
  loadCalendarLessons()
  loadPlanFilterOptions()

  const subscribe = window.events['scratch:save-request'] as unknown as SubscribeSave
  offScratchSave = subscribe((payload) => {
    handleScratchSave(payload)
  })

  // 订阅教案草稿流式输出：累加到 planAiDraftText 供实时预览
  offPlanChunk = (window.events['lessonPlan:chunk'] as unknown as PlanChunkRegistrar)((delta) => {
    if (delta === '[DONE]') return
    planAiDraftText.value += delta
  })

  // 订阅教案优化建议流式输出：累加到 planReviewText 供实时预览
  offPlanReviewChunk = (window.events['lessonPlan:reviewChunk'] as unknown as PlanChunkRegistrar)(
    (delta) => {
      if (delta === '[DONE]') return
      planReviewText.value += delta
    }
  )

  // 检测 AI 是否已配置，控制「AI 生成草稿」按钮可用性
  call(window.api.settings.get())
    .then((s) => {
      aiConfigured.value = !!(s.ai.useCustomAI && s.ai.apiKey)
    })
    .catch(() => {
      aiConfigured.value = false
    })

  // 订阅全局刷新事件：刷新时重新加载点子库、资源库、标签、课次、文档、教案
  offRefresh = subscribeRefresh(() => {
    loadIdeas()
    loadResources()
    loadAllTags()
    loadLessons()
    loadDocLinks()
    loadPlans()
    loadPrepOverview()
    loadCalendarLessons()
    loadCustomTemplates()
    loadPlanFilterOptions()
  })
  // 订阅全局新增事件：触发新建点子弹窗
  offNewItem = subscribeNewItem(openNewIdeaModal, 'prep')
})

onUnmounted(() => {
  offScratchSave?.()
  offScratchSave = null
  offRefresh?.()
  offRefresh = null
  offNewItem?.()
  offNewItem = null
  offPlanChunk?.()
  offPlanChunk = null
  offPlanReviewChunk?.()
  offPlanReviewChunk = null
})
</script>

<style scoped>
.prep-tabs {
  height: 100%;
}
.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.calendar-range {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  padding: 8px 12px;
  background: #f5f7ff;
  border-radius: 6px;
}
.calendar-range-sub {
  font-weight: 400;
  color: #6b7280;
  font-size: 13px;
  margin-left: 4px;
}
.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.idea-card {
  margin-bottom: 12px;
}
.idea-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.idea-name {
  font-weight: 600;
}
.idea-desc {
  color: #374151;
  margin: 0 0 8px;
  white-space: pre-wrap;
}
.idea-desc-empty {
  color: #9ca3af;
}
.idea-meta {
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  gap: 16px;
}
.version-toggle {
  margin-top: 4px;
}
.version-list {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
}
.ver-name {
  font-weight: 600;
}
.ver-notes {
  color: #4b5563;
}
.ver-date {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}
.version-preview {
  min-height: 120px;
}
.preview-sprites {
  margin-top: 12px;
}
.preview-sprites-label {
  color: #6b7280;
  margin-right: 8px;
}
.preview-plan {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}
.preview-plan-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}
.preview-plan-title {
  font-weight: 600;
  color: #1f2937;
}
.preview-plan-sections {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.preview-plan-block {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #4b5563;
}
.preview-plan-label {
  color: #6b7280;
  margin-right: 4px;
}
.preview-plan-text {
  color: #374151;
}
.resource-preview {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-image {
  text-align: center;
}
.preview-audio {
  width: 100%;
  padding: 24px 0;
}
.filter-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.docs-card {
  max-width: 640px;
}
.docs-list-card {
  max-width: 640px;
}
.doc-link-title {
  color: #1677ff;
  cursor: pointer;
}
.doc-link-title:hover {
  text-decoration: underline;
}
.doc-link-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.doc-link-url {
  color: #9ca3af;
  font-size: 12px;
  word-break: break-all;
}
.docs-alert {
  margin-bottom: 16px;
}
.docs-form {
  max-width: 560px;
}
.text-muted {
  color: #9ca3af;
}
.save-radio {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.save-idea-form {
  border-top: 1px solid #eef0f4;
  padding-top: 12px;
}
.save-resource-form {
  border-top: 1px solid #eef0f4;
  padding-top: 12px;
}
.tag-tip {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}
.plan-card {
  margin-bottom: 12px;
}
.plan-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.plan-name {
  font-weight: 600;
}
.plan-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.plan-empty-sections {
  font-size: 12px;
  color: #9ca3af;
}
/* G21: 知识点标签 */
.plan-knowledge {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  color: #6b7280;
  font-size: 12px;
}
.plan-knowledge .anticon {
  margin-right: 2px;
}
.plan-usage {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 6px 0 8px;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: #4b5563;
}
.plan-usage-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #4b5563;
}
.plan-usage-item :deep(.anticon) {
  color: #8b5cf6;
}
.plan-preview-block {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 4px;
}
.plan-preview-label {
  color: #6b7280;
}
.plan-preview-text {
  color: #374151;
}
.plan-meta {
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  gap: 16px;
  margin-top: 8px;
}
.plan-form {
  max-width: 760px;
}
.plan-collapse {
  margin-top: 8px;
}
.plan-collapse :deep(.ant-collapse-header) {
  font-weight: 500;
}
.plan-ai-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 0 8px;
}
.plan-ai-hint {
  font-size: 12px;
  color: #9ca3af;
}
.plan-ai-preview {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #f6f8fa;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  max-height: 220px;
  overflow: auto;
}
.plan-ai-preview-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}
.plan-ai-preview-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}
/* AI 教案优化建议 */
.plan-review-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 8px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}
.plan-review-panel {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 6px;
  max-height: 320px;
  overflow: auto;
}
.plan-review-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #874d00;
  margin-bottom: 4px;
}
.plan-review-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.plan-review-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

/* 备课就绪度清单（G15） */
.plan-readiness-panel {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
}
.plan-readiness-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.plan-readiness-title {
  font-size: 13px;
  font-weight: 600;
  color: #135200;
  white-space: nowrap;
}
.plan-readiness-count {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}
.plan-readiness-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.plan-readiness-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 10px;
  cursor: default;
}
.plan-readiness-item.is-passed {
  color: #389e0d;
  background: #d9f7be;
}
.plan-readiness-item.is-missing {
  color: #874d00;
  background: #fff7e6;
}

/* 教案级文档挂载（G17） */
.plan-doc-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.plan-doc-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f6f8fa;
  border-radius: 4px;
}
.plan-doc-icon {
  color: #874d00;
  font-size: 12px;
}
.plan-doc-link {
  flex: 1;
  color: #1677ff;
  cursor: pointer;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plan-doc-link:hover {
  text-decoration: underline;
}
.plan-doc-remove {
  color: #9ca3af;
  flex-shrink: 0;
}
.plan-doc-empty {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #9ca3af;
}

/* 教案模板库 */
.tpl-filter {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.tpl-filter-hint {
  font-size: 12px;
  color: #9ca3af;
}
.tpl-card {
  height: 100%;
}
.tpl-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.tpl-name {
  font-weight: 600;
}
.tpl-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 8px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tpl-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tpl-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

/* 教学环节片段 / 资源插入工具条 */
.segment-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.segment-toolbar-hint {
  font-size: 12px;
  color: #9ca3af;
}
/* 教案-资源关联 chip（G13） */
.plan-resource-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.plan-resource-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: #f0f5ff;
  border: 1px solid #d6e4ff;
  color: #1d39c4;
}
.plan-resource-chip .chip-type {
  font-size: 11px;
  padding: 0 4px;
  border-radius: 4px;
  background: #597ef7;
  color: #fff;
}
.plan-resource-chip.chip-sprite {
  background: #f6ffed;
  border-color: #b7eb8f;
  color: #389e0d;
}
.plan-resource-chip.chip-sprite .chip-type {
  background: #52c41a;
}
.plan-resource-chip.chip-sound {
  background: #fff7e6;
  border-color: #ffd591;
  color: #d46b08;
}
.plan-resource-chip.chip-sound .chip-type {
  background: #fa8c16;
}
.plan-resource-chip .chip-remove {
  padding: 0 2px;
  height: 18px;
  font-size: 11px;
  color: #9ca3af;
}
.plan-resource-chip .chip-remove:hover {
  color: #ff4d4f;
}
.segment-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 200px;
}
.segment-menu-name {
  font-size: 13px;
}
.segment-menu-time {
  font-size: 12px;
  color: #9ca3af;
}

/* 资源库选择器 */
.resource-picker-filter {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.rp-tags {
  font-size: 12px;
  color: #9ca3af;
}

/* 备课进度看板 */
.prep-overview-card {
  margin-bottom: 16px;
  margin-top: 12px;
}
.overview-readiness {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.overview-readiness-label {
  font-size: 12px;
  color: #6b7280;
}

/* G16: 就绪等级分布堆叠条 */
.overview-breakdown {
  margin-top: 12px;
}
.overview-breakdown-bar {
  display: flex;
  height: 10px;
  width: 100%;
  border-radius: 5px;
  overflow: hidden;
  background: #f3f4f6;
}
.overview-breakdown-seg {
  height: 100%;
  min-width: 0;
  transition: width 0.2s ease;
}
.overview-breakdown-seg.seg-draft {
  background: #ff7875;
}
.overview-breakdown-seg.seg-partial {
  background: #faad14;
}
.overview-breakdown-seg.seg-ready {
  background: #52c41a;
}
.overview-breakdown-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}
.overview-breakdown-legend .legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.overview-breakdown-legend .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.overview-breakdown-legend .dot-draft {
  background: #ff7875;
}
.overview-breakdown-legend .dot-partial {
  background: #faad14;
}
.overview-breakdown-legend .dot-ready {
  background: #52c41a;
}
/* G20: 就绪率趋势 sparkline */
.overview-trend {
  margin-top: 14px;
  border-top: 1px dashed #e5e7eb;
  padding-top: 10px;
}
.overview-trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.overview-trend-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}
.overview-trend-summary {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}
.overview-trend-summary .ts-item b {
  color: #1f2937;
  margin-left: 2px;
}
.overview-trend-summary .ts-up {
  color: #3f8600;
}
.overview-trend-summary .ts-down {
  color: #cf1322;
}
.overview-trend-svg {
  width: 100%;
  height: 48px;
  display: block;
}
.overview-backlog {
  margin-top: 14px;
  border-top: 1px dashed #e5e7eb;
  padding-top: 10px;
}
.overview-backlog-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}
.overview-backlog-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.overview-backlog-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.overview-backlog-item:hover {
  background: #f5f7ff;
}
.ob-time {
  font-size: 12px;
  font-weight: 600;
  color: #4f46e5;
  min-width: 92px;
}
.ob-class {
  font-size: 13px;
  color: #1f2937;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ob-edit-icon {
  font-size: 12px;
  color: #9ca3af;
}
.overview-backlog-more {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 6px;
  text-align: center;
}
</style>
