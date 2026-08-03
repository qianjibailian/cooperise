<template>
  <div class="testing-calendar-page">
    <!-- 顶部工具栏 -->
    <div class="page-header">
      <div class="page-title-wrap">
        <component :is="CalendarOutlined" class="page-title-icon" />
        <h2 class="page-title">测试平台需求日历</h2>
      </div>
      <div class="page-actions">
        <a-space :size="8">
          <a-select
            v-model:value="filterStatus"
            size="middle"
            style="width: 140px"
            allow-clear
            placeholder="状态筛选"
          >
            <a-select-option value="">全部状态</a-select-option>
            <a-select-option value="10001">待处理</a-select-option>
            <a-select-option value="10002">进行中</a-select-option>
            <a-select-option value="10003">已完成</a-select-option>
          </a-select>
          <a-select
            v-model:value="filterPriority"
            size="middle"
            style="width: 140px"
            allow-clear
            placeholder="优先级筛选"
          >
            <a-select-option value="">全部优先级</a-select-option>
            <a-select-option value="1">紧急</a-select-option>
            <a-select-option value="2">高</a-select-option>
            <a-select-option value="3">中</a-select-option>
            <a-select-option value="4">低</a-select-option>
          </a-select>
          <a-input-search
            v-model:value="keyword"
            size="middle"
            placeholder="搜索编号/概要"
            style="width: 240px"
            allow-clear
          />
        </a-space>
      </div>
    </div>

    <div class="page-body">
      <!-- 左：日历 -->
      <div class="calendar-panel">
        <vxe-calendar
          ref="calendarRef"
          v-model="currentDate"
          type="month"
          height="100%"
          width="100%"
          :start-day="1"
          :festival-method="festivalMethod"
          :cell-style="cellStyle"
          label-format="yyyy 年 MM 月"
          value-format="yyyy-MM-dd"
          @cell-click="handleCellClick"
          @view-change="handleViewChange"
        />
      </div>

      <!-- 右：选中日期详情列表 -->
      <div class="detail-panel">
        <div class="detail-header">
          <div class="detail-title">
            <component :is="UnorderedListOutlined" class="detail-title-icon" />
            <span>{{ selectedDateLabel || '请选择日期' }}</span>
            <a-tag v-if="selectedDayIssues.length" color="blue" class="detail-count">
              {{ selectedDayIssues.length }} 条
            </a-tag>
          </div>
          <div class="detail-today">
            <a-button size="small" type="link" @click="jumpToday">今天</a-button>
          </div>
        </div>

        <div class="detail-legend">
          <div class="legend-item">
            <span class="legend-dot status-todo"></span>待处理
          </div>
          <div class="legend-item">
            <span class="legend-dot status-doing"></span>进行中
          </div>
          <div class="legend-item">
            <span class="legend-dot status-done"></span>已完成
          </div>
          <div class="legend-item">
            <span class="legend-dot priority-critical"></span>紧急
          </div>
        </div>

        <div v-if="!selectedDate" class="detail-empty">
          <a-empty description="点击左侧日历任意日期查看当日需求" />
        </div>
        <vxe-list
          v-else
          :data="selectedDayIssues"
          height="100%"
          :row-config="{ keyField: 'id', isHover: true, useKey: true }"
        >
          <template #default="{ items }">
            <div v-if="items.length === 0" class="detail-empty">
              <a-empty description="当日暂无事项" />
            </div>
            <vxe-card
              v-for="issue in items"
              :key="issue.id"
              size="small"
              :border="false"
              :padding="true"
              class="issue-card"
              :class="{
                'status-todo': issue.statusId === '10001',
                'status-doing': issue.statusId === '10002',
                'status-done': issue.statusId === '10003',
                'priority-critical': issue.priorityId === '1' || issue.priorityId === 1,
              }"
            >
              <div class="issue-card-head">
                <span class="issue-key">{{ issue.issueKey }}</span>
                <a-tag v-if="issue.statusId === '10001'" color="default" :bordered="false">待处理</a-tag>
                <a-tag v-else-if="issue.statusId === '10002'" color="processing" :bordered="false">进行中</a-tag>
                <a-tag v-else-if="issue.statusId === '10003'" color="success" :bordered="false">已完成</a-tag>
                <a-tag v-else color="default" :bordered="false">{{ issue.statusId }}</a-tag>
              </div>
              <div class="issue-summary" :title="issue.summary">{{ issue.summary }}</div>
              <div class="issue-card-foot">
                <div class="issue-meta">
                  <component :is="UserOutlined" class="meta-icon" />
                  <span>{{ issue.assigneeName || '未分配' }}</span>
                </div>
                <a-tag
                  v-if="issue.priorityId === '1' || issue.priorityId === 1"
                  color="red"
                  :bordered="false"
                  class="priority-tag"
                >紧急</a-tag>
                <a-tag v-else-if="issue.priorityId === '2' || issue.priorityId === 2" color="orange" :bordered="false">高</a-tag>
                <a-tag v-else-if="issue.priorityId === '3' || issue.priorityId === 3" color="blue" :bordered="false">中</a-tag>
                <a-tag v-else color="default" :bordered="false">低</a-tag>
              </div>
            </vxe-card>
          </template>
        </vxe-list>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import dayjs, { Dayjs } from 'dayjs'
import {
  CalendarOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import type {
  VxeCalendarDefines,
} from 'vxe-pc-ui/types/components/calendar'

// ---------- 类型 ----------
interface CalendarIssue {
  id: number
  issueKey: string
  summary: string
  statusId: string
  priorityId: string | number
  dueDate: string       // yyyy-MM-dd，用来决定出现在哪个日期格子
  assigneeName: string
  createdAt: string
}

// ---------- 状态/优先级 配色 ----------
const STATUS_COLOR: Record<string, string> = {
  '10001': '#8c8c8c', // 待处理 - 灰
  '10002': '#1890ff', // 进行中 - 蓝
  '10003': '#52c41a', // 已完成 - 绿
}

// ---------- 生成 mock 数据（测试平台需求，按截止日期散布到本月及前后） ----------
function buildMockIssues(): CalendarIssue[] {
  const assignees = ['张测试', '李质量', '王QA', '赵工程师', '陈验收', '未分配']
  const summaries = [
    '登录模块接口回归测试',
    '用户中心压力测试报告评审',
    '支付流程兼容性测试-安卓',
    '支付流程兼容性测试-iOS',
    '权限模块冒烟用例补全',
    '新用户注册流程端到端测试',
    '首页性能优化前后对比测试',
    '导出Excel大数据量测试',
    '订单超时取消规则边界用例',
    'APP 启动崩溃问题回归',
    'H5 优惠券核销流程验证',
    '消息推送到达率抽样测试',
    'Webhook 回调链路异常场景',
    '积分兑换并发压测',
    '风控规则命中场景验证',
    '数据大屏接口异常容错',
    'Sprint 收尾全量回归（P0）',
    '灰度发布流量切换演练',
  ]
  const statuses: (keyof typeof STATUS_COLOR)[] = ['10001', '10002', '10003']
  const now = dayjs()
  const start = now.startOf('month').subtract(7, 'day')

  const list: CalendarIssue[] = []
  let seq = 1
  summaries.forEach((summary, i) => {
    // 每条需求一个截止日，前后散布到约 40 天范围
    const due: Dayjs = start.add(i * 2, 'day')
    const countForDay = (i % 3) + 1 // 每天 1~3 条，凑密度
    for (let j = 0; j < countForDay; j++) {
      const status = statuses[(i + j) % statuses.length]
      const priorityId = String(((i + j) % 4) + 1)
      list.push({
        id: 10000 + seq,
        issueKey: `QA-${String(20000 + seq)}`,
        summary,
        statusId: status,
        priorityId,
        dueDate: due.add(j, 'day').format('YYYY-MM-DD'),
        assigneeName: assignees[(i + j) % assignees.length],
        createdAt: due.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      })
      seq++
    }
  })
  return list
}

// ---------- 筛选 ----------
const allIssues = ref<CalendarIssue[]>([])
const filterStatus = ref<string>('')
const filterPriority = ref<string>('')
const keyword = ref<string>('')

const filteredIssues = computed<CalendarIssue[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  return allIssues.value.filter((it) => {
    if (filterStatus.value && it.statusId !== filterStatus.value) return false
    if (filterPriority.value && String(it.priorityId) !== String(filterPriority.value)) return false
    if (kw) {
      const hay = (it.issueKey + ' ' + it.summary).toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

// 以 dueDate 为 key 聚合，供 festivalMethod / cell-click 查
const issuesByDate = computed<Record<string, CalendarIssue[]>>(() => {
  const map: Record<string, CalendarIssue[]> = {}
  for (const it of filteredIssues.value) {
    ;(map[it.dueDate] ||= []).push(it)
  }
  return map
})

// ---------- 日历 ----------
const calendarRef = ref<any>(null)
const currentDate = ref<string>(dayjs().format('YYYY-MM-DD'))
const selectedDate = ref<string | null>(null)

const selectedDateLabel = computed<string>(() =>
  selectedDate.value ? dayjs(selectedDate.value).format('YYYY 年 MM 月 DD 日 dddd').replace(
    /星期(\S)/,
    '星期$1',
  ) : '',
)

const selectedDayIssues = computed<CalendarIssue[]>(() =>
  selectedDate.value ? issuesByDate.value[selectedDate.value] || [] : [],
)

// 根据状态优先级决定日期上的主色
function dateMarker(list: CalendarIssue[]): {
  color: string
  label: string
  extra: string
} {
  // 紧急优先显示红色，否则按最靠前的状态色
  if (list.some((i) => String(i.priorityId) === '1')) {
    return { color: '#ff3b30', label: '有紧急项', extra: `${list.length}` }
  }
  // 按优先级：待处理 > 进行中 > 已完成 决定标记色
  const order = ['10001', '10002', '10003']
  let color = STATUS_COLOR['10001'] || '#8c8c8c'
  for (const s of order) {
    if (list.some((i) => i.statusId === s)) {
      color = STATUS_COLOR[s]
      break
    }
  }
  return { color, label: `${list.length} 条`, extra: `${list.length}` }
}

function festivalMethod(
  params: VxeCalendarDefines.DateFestivalParams,
): VxeCalendarDefines.DateFestivalInfo | null | void {
  const dateKey = dayjs(params.date).format('YYYY-MM-DD')
  const list = issuesByDate.value[dateKey]
  if (!list || list.length === 0) return null
  const m = dateMarker(list)
  return {
    notice: true,
    important: list.some((i) => String(i.priorityId) === '1' || i.statusId === '10002'),
    className: `tc-festival tc-status-${
      list.some((i) => String(i.priorityId) === '1')
        ? 'critical'
        : list.find((i) => i.statusId === '10002')
        ? 'doing'
        : list.find((i) => i.statusId === '10003')
        ? 'done'
        : 'todo'
    }`,
    style: {
      // 通知小圆点颜色由 vxe 默认，这里通过 style 让 extra 文案颜色同步
    },
    extra: m.extra,
    label: undefined, // 不展示 label，避免挤
  }
}

function cellStyle(
  params: VxeCalendarDefines.CellStyleParams,
): void | null | Partial<CSSStyleDeclaration> {
  const dateKey = dayjs(params.date).format('YYYY-MM-DD')
  const list = issuesByDate.value[dateKey]
  if (!list || list.length === 0) return null
  const critical = list.some((i) => String(i.priorityId) === '1')
  return {
    background: critical
      ? 'linear-gradient(180deg, rgba(255,59,48,0.06), rgba(255,59,48,0.02))'
      : list.some((i) => i.statusId === '10002')
      ? 'linear-gradient(180deg, rgba(24,144,255,0.06), rgba(24,144,255,0.02))'
      : undefined,
  }
}

function handleCellClick(params: VxeCalendarDefines.ClickEventParams) {
  if (params.viewType !== 'month') return
  selectedDate.value = dayjs(params.date).format('YYYY-MM-DD')
}

function handleViewChange(params: VxeCalendarDefines.ViewChangeEventParams) {
  // 当前视图切换到了非月视图时，清空选中，避免歧义
  if (params.viewType !== 'month') return
}

function jumpToday() {
  selectedDate.value = dayjs().format('YYYY-MM-DD')
  currentDate.value = selectedDate.value
}

// ---------- 生命周期 ----------
onMounted(() => {
  allIssues.value = buildMockIssues()
  // 默认选中今天，如果今天没数据就选第一个有数据的日期
  const today = dayjs().format('YYYY-MM-DD')
  if (issuesByDate.value[today]) {
    selectedDate.value = today
  } else {
    const firstKey = Object.keys(issuesByDate.value).sort()[0]
    if (firstKey) selectedDate.value = firstKey
  }
})
</script>

<style scoped lang="scss">
.testing-calendar-page {
  height: calc(100vh - 72px);
  min-height: 600px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 顶部 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
  gap: 16px;
  flex-wrap: wrap;
}
.page-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-title-icon {
  font-size: 20px;
  color: #1890ff;
}
.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f1f1f;
}
.page-actions {
  flex-shrink: 0;
}

/* 主体两栏 */
.page-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 1px;
  background: #f0f0f0;
}
.calendar-panel {
  flex: 0 0 65%;
  min-width: 0;
  background: #fff;
  padding: 12px;
  overflow: hidden;
}
.detail-panel {
  flex: 1;
  min-width: 0;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 右侧头部 */
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}
.detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
}
.detail-title-icon {
  color: #8c8c8c;
}
.detail-count {
  margin-left: 2px;
}

/* 图例 */
.detail-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #595959;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.legend-dot.status-todo { background: #8c8c8c; }
.legend-dot.status-doing { background: #1890ff; }
.legend-dot.status-done { background: #52c41a; }
.legend-dot.priority-critical { background: #ff3b30; }

/* 空状态 */
.detail-empty {
  padding: 48px 0;
}

/* 事项卡片 */
:deep(.vxe-list) {
  height: 100% !important;
  padding: 12px;
  overflow-y: auto;
}
.issue-card {
  margin-bottom: 10px;
  border-radius: 6px !important;
  border: 1px solid #f0f0f0 !important;
  background: #fff;
  position: relative;
  transition: all 0.15s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}
.issue-card:hover {
  border-color: #d9eaff !important;
  box-shadow: 0 2px 6px rgba(24, 144, 255, 0.08);
  transform: translateY(-1px);
}
.issue-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
  background: #8c8c8c;
}
.issue-card.status-todo::before { background: #8c8c8c; }
.issue-card.status-doing::before { background: #1890ff; }
.issue-card.status-done::before { background: #52c41a; }
.issue-card.priority-critical::before { background: #ff3b30; }

.issue-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.issue-key {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  color: #1890ff;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.issue-summary {
  font-size: 13px;
  color: #262626;
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.issue-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.issue-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #8c8c8c;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta-icon {
  font-size: 12px;
}
.priority-tag {
  flex-shrink: 0;
}

/* 日历标记样式覆盖（vxe-calendar festivalMethod 返回的 className 会作用在节日标签上） */
:deep(.vxe-calendar) {
  height: 100% !important;
}
:deep(.vxe-calendar--month .vxe-calendar--date .vxe-cell) {
  min-height: 80px;
}
/* 将右上角 extra 做成带颜色的小徽标 */
:deep(.tc-festival .vxe-calendar--festival-extra) {
  font-size: 11px;
  padding: 0 4px;
  border-radius: 10px;
  background: #e6f7ff;
  color: #1890ff;
  line-height: 14px;
  font-weight: 600;
}
:deep(.tc-festival.tc-status-critical .vxe-calendar--festival-extra) {
  background: #fff1f0;
  color: #ff3b30;
}
:deep(.tc-festival.tc-status-doing .vxe-calendar--festival-extra) {
  background: #e6f7ff;
  color: #1890ff;
}
:deep(.tc-festival.tc-status-done .vxe-calendar--festival-extra) {
  background: #f6ffed;
  color: #52c41a;
}
:deep(.tc-festival.tc-status-todo .vxe-calendar--festival-extra) {
  background: #f5f5f5;
  color: #595959;
}
/* 左上 notice 小圆点颜色 */
:deep(.tc-festival.tc-status-critical .vxe-calendar--notice) {
  background-color: #ff3b30 !important;
}
:deep(.tc-festival.tc-status-doing .vxe-calendar--notice) {
  background-color: #1890ff !important;
}
:deep(.tc-festival.tc-status-done .vxe-calendar--notice) {
  background-color: #52c41a !important;
}
:deep(.tc-festival.tc-status-todo .vxe-calendar--notice) {
  background-color: #8c8c8c !important;
}

/* 响应式：窄屏两栏堆叠 */
@media (max-width: 1100px) {
  .page-body {
    flex-direction: column;
  }
  .calendar-panel {
    flex: 0 0 55%;
  }
}
</style>
