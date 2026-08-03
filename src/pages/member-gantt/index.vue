<template>
  <div class="member-gantt-page">
    <!-- 顶部工具栏 -->
    <div class="page-header">
      <div class="page-title-wrap">
        <component :is="BarsOutlined" class="page-title-icon" />
        <h2 class="page-title">会员体系优化 · 甘特图</h2>
        <a-tag color="blue" class="project-tag">V2.0 规划</a-tag>
      </div>
      <div class="page-actions">
        <a-space :size="8">
          <a-select
            v-model:value="viewScale"
            size="middle"
            style="width: 140px"
            @change="handleScaleChange"
          >
            <a-select-option value="month">月视图</a-select-option>
            <a-select-option value="week">周视图</a-select-option>
            <a-select-option value="day">日视图</a-select-option>
          </a-select>
          <a-button :icon="h(ZoomInOutlined)" @click="zoomIn">放大</a-button>
          <a-button :icon="h(ZoomOutOutlined)" @click="zoomOut">缩小</a-button>
          <a-button type="primary" :icon="h(RedoOutlined)" @click="scrollToToday">
            定位到今天
          </a-button>
        </a-space>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">总任务数</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">里程碑</div>
        <div class="stat-value milestone">{{ stats.milestone }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">进行中</div>
        <div class="stat-value doing">{{ stats.doing }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已完成</div>
        <div class="stat-value done">{{ stats.done }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">整体进度</div>
        <div class="stat-progress-wrap">
          <a-progress
            :percent="Math.round(stats.overallProgress * 100)"
            :show-info="true"
            size="small"
            status="active"
          />
        </div>
      </div>
    </div>

    <!-- 甘特图主体 -->
    <div class="gantt-wrapper">
      <vxe-gantt
        ref="ganttRef"
        :data="ganttData"
        :columns="ganttColumns"
        height="100%"
        border="full"
        stripe
        :loading="false"
        show-overflow="ellipsis"
        :column-config="{ resizable: true }"
        :row-config="{ keyField: 'id', isHover: true, useKey: true }"
        :tree-config="{ childrenField: 'children', expandAll: true, indent: 16 }"
        :task-config="taskConfig"
        :task-view-config="taskViewConfig"
        :task-bar-config="taskBarConfig"
        :task-bar-tooltip-config="taskBarTooltipConfig"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, h } from 'vue'
import dayjs, { Dayjs } from 'dayjs'
import { Progress } from 'ant-design-vue'
import {
  BarsOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  RedoOutlined,
} from '@ant-design/icons-vue'
import type {
  VxeGanttPropTypes,
  VxeGanttConstructor,
} from 'vxe-pc-ui/types/components/gantt'

// ---------- 数据类型 ----------
interface GanttRow {
  id: number | string
  taskCode: string
  taskName: string
  owner: string
  phase: '需求' | '设计' | '开发' | '联调' | '测试' | '上线'
  startTime: string    // yyyy-MM-dd
  endTime: string      // yyyy-MM-dd
  progress: number     // 0-1
  taskType: 'task' | 'milestone'
  colorKey?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
  children?: GanttRow[]
}

// ---------- 颜色映射 ----------
const PHASE_COLOR: Record<GanttRow['phase'], string> = {
  '需求': '#722ed1', // 紫
  '设计': '#1890ff', // 蓝
  '开发': '#13c2c2', // 青
  '联调': '#faad14', // 橙
  '测试': '#52c41a', // 绿
  '上线': '#ff3b30', // 红
}

// ---------- 构建 mock 数据（会员体系 V2.0 WBS） ----------
function buildGanttData(): GanttRow[] {
  // 所有行共享一个全局递增数字 id，彻底避免 vxe-gantt 内部 index 撞 key
  let autoId = 1
  const nextId = () => autoId++

  // 以今天为 anchor，向前推 7 天作为需求阶段起点
  const anchor = dayjs().subtract(10, 'day')

  const mk = (
    offsetStart: number,
    days: number,
    name: string,
    code: string,
    phase: GanttRow['phase'],
    owner: string,
    progress: number,
    taskType: GanttRow['taskType'] = 'task',
  ): GanttRow => {
    const start: Dayjs = anchor.add(offsetStart, 'day')
    const end: Dayjs = start.add(Math.max(days - 1, 0), 'day')
    return {
      id: nextId(),
      taskCode: code,
      taskName: name,
      owner,
      phase,
      startTime: start.format('YYYY-MM-DD'),
      endTime: end.format('YYYY-MM-DD'),
      progress,
      taskType,
    }
  }

  // 阶段 1：会员等级体系重构（-10d 至 20d）
  const levelTasks: GanttRow[] = [
    mk(-10, 5, '等级规则评审会', 'L1-01', '需求', '李产品', 1),
    mk(-5, 5, '会员等级与权益 PRD', 'L1-02', '需求', '李产品', 1),
    mk(0, 4, '成长值算法文档', 'L1-03', '需求', '李产品', 1),
    mk(0, 6, '等级体系 UI 设计稿', 'L1-04', '设计', '王设计', 1),
    mk(6, 3, '设计走查 + 修改', 'L1-05', '设计', '王设计', 0.7),
    mk(5, 12, '用户等级中心重构', 'L1-06', '开发', '陈前端', 0.55),
    mk(5, 14, '成长值计算引擎', 'L1-07', '开发', '赵后端', 0.35),
    mk(12, 5, '等级变更消息推送', 'L1-08', '开发', '孙开发', 0.2),
    mk(18, 4, '前后端联调', 'L1-09', '联调', '陈前端', 0.1),
    mk(22, 5, '等级功能回归测试', 'L1-10', '测试', '钱 QA', 0),
  ]
  const levelMilestone: GanttRow = {
    id: nextId(),
    taskCode: 'L1-MS',
    taskName: '等级体系 V2.0 上线',
    owner: '张项目',
    phase: '上线',
    startTime: dayjs(levelTasks[levelTasks.length - 1].endTime).add(1, 'day').format('YYYY-MM-DD'),
    endTime: dayjs(levelTasks[levelTasks.length - 1].endTime).add(1, 'day').format('YYYY-MM-DD'),
    progress: 0,
    taskType: 'milestone',
  }

  // 阶段 2：积分体系升级（-3d 至 28d）
  const pointTasks: GanttRow[] = [
    mk(-3, 5, '积分获取规则梳理', 'P2-01', '需求', '李产品', 1),
    mk(2, 4, '积分消耗场景分析', 'P2-02', '需求', '李产品', 1),
    mk(4, 6, '积分商城 UI 稿', 'P2-03', '设计', '王设计', 0.9),
    mk(8, 14, '积分账户引擎', 'P2-04', '开发', '赵后端', 0.4),
    mk(8, 12, '积分商城前端', 'P2-05', '开发', '陈前端', 0.3),
    mk(16, 5, '积分过期机制', 'P2-06', '开发', '周开发', 0.2),
    mk(22, 5, '积分交易对账', 'P2-07', '联调', '赵后端', 0),
    mk(23, 2, '积分预发布数据演练', 'P2-09', '测试', '钱 QA', 0),
    mk(25, 5, '积分全量回归', 'P2-08', '测试', '钱 QA', 0),
  ]
  const pointMilestone: GanttRow = {
    id: nextId(),
    taskCode: 'P2-MS',
    taskName: '积分系统升级上线',
    owner: '张项目',
    phase: '上线',
    startTime: dayjs(pointTasks[pointTasks.length - 1].endTime).add(1, 'day').format('YYYY-MM-DD'),
    endTime: dayjs(pointTasks[pointTasks.length - 1].endTime).add(1, 'day').format('YYYY-MM-DD'),
    progress: 0,
    taskType: 'milestone',
  }

  // 阶段 3：付费会员 - 超级会员卡（5d 至 35d）
  const paidTasks: GanttRow[] = [
    mk(5, 6, '付费会员权益定义', 'S3-01', '需求', '李产品', 0.8),
    mk(8, 3, '定价模型评审', 'S3-02', '需求', '李产品', 0.6),
    mk(11, 7, '会员卡视觉 & 权益页', 'S3-03', '设计', '王设计', 0.5),
    mk(15, 10, '下单 & 支付链路', 'S3-04', '开发', '孙开发', 0.3),
    mk(15, 12, '会员卡权益中心', 'S3-05', '开发', '陈前端', 0.25),
    mk(18, 10, '会员卡后端服务', 'S3-06', '开发', '赵后端', 0.2),
    mk(26, 5, 'Apple/Android 内购联调', 'S3-07', '联调', '孙开发', 0),
    mk(28, 2, '开卡链路压测', 'S3-09', '测试', '钱 QA', 0),
    mk(29, 7, '付费会员全流程测试', 'S3-08', '测试', '钱 QA', 0),
    mk(31, 3, '会员续费提醒自动化', 'S3-10', '开发', '吴后端', 0),
    mk(33, 2, '会员资产台账 & 导出', 'S3-11', '开发', '郑数据', 0),
  ]
  const paidMilestone: GanttRow = {
    id: nextId(),
    taskCode: 'S3-MS',
    taskName: '超级会员卡上线',
    owner: '张项目',
    phase: '上线',
    startTime: dayjs(paidTasks[paidTasks.length - 1].endTime).add(2, 'day').format('YYYY-MM-DD'),
    endTime: dayjs(paidTasks[paidTasks.length - 1].endTime).add(2, 'day').format('YYYY-MM-DD'),
    progress: 0,
    taskType: 'milestone',
  }

  // 阶段 4：会员营销自动化（15d 至 42d）
  const mktTasks: GanttRow[] = [
    mk(15, 5, '营销场景与人群圈选 PRD', 'M4-01', '需求', '李产品', 0.6),
    mk(18, 3, '生命周期模板清单', 'M4-02', '需求', '李产品', 0.4),
    mk(20, 6, '营销画布 UI', 'M4-03', '设计', '王设计', 0.3),
    mk(25, 12, '营销画布前端', 'M4-04', '开发', '陈前端', 0.1),
    mk(25, 14, '触达渠道接入（短信/企微/Push）', 'M4-05', '开发', '吴后端', 0.1),
    mk(25, 15, '人群画像与圈选引擎', 'M4-06', '开发', '郑数据', 0.1),
    mk(36, 5, '全渠道联调', 'M4-07', '联调', '吴后端', 0),
    mk(38, 2, '灰度沙箱仿真演练', 'M4-09', '测试', '钱 QA', 0),
    mk(40, 5, '回归测试 & 灰度演练', 'M4-08', '测试', '钱 QA', 0),
    mk(42, 2, 'A/B 实验引擎', 'M4-10', '开发', '郑数据', 0),
    mk(43, 2, '策略效果归因分析', 'M4-11', '开发', '郑数据', 0),
    mk(44, 3, '运营看板埋点 & 监控', 'M4-12', '测试', '钱 QA', 0),
  ]
  const mktMilestone: GanttRow = {
    id: nextId(),
    taskCode: 'M4-MS',
    taskName: '营销自动化 GA',
    owner: '张项目',
    phase: '上线',
    startTime: dayjs(mktTasks[mktTasks.length - 1].endTime).add(2, 'day').format('YYYY-MM-DD'),
    endTime: dayjs(mktTasks[mktTasks.length - 1].endTime).add(2, 'day').format('YYYY-MM-DD'),
    progress: 0,
    taskType: 'milestone',
  }

  return [
    {
      id: nextId(), taskCode: 'PH-1', taskName: '会员等级体系重构',
      owner: '张项目', phase: '需求',
      startTime: levelTasks[0].startTime,
      endTime: levelMilestone.endTime,
      progress: Math.round((levelTasks.reduce((s, t) => s + t.progress, 0) / levelTasks.length) * 100) / 100,
      taskType: 'task',
      children: [...levelTasks, levelMilestone],
    },
    {
      id: nextId(), taskCode: 'PH-2', taskName: '积分体系升级',
      owner: '张项目', phase: '开发',
      startTime: pointTasks[0].startTime,
      endTime: pointMilestone.endTime,
      progress: Math.round((pointTasks.reduce((s, t) => s + t.progress, 0) / pointTasks.length) * 100) / 100,
      taskType: 'task',
      children: [...pointTasks, pointMilestone],
    },
    {
      id: nextId(), taskCode: 'PH-3', taskName: '付费会员 - 超级会员卡',
      owner: '张项目', phase: '开发',
      startTime: paidTasks[0].startTime,
      endTime: paidMilestone.endTime,
      progress: Math.round((paidTasks.reduce((s, t) => s + t.progress, 0) / paidTasks.length) * 100) / 100,
      taskType: 'task',
      children: [...paidTasks, paidMilestone],
    },
    {
      id: nextId(), taskCode: 'PH-4', taskName: '会员营销自动化',
      owner: '张项目', phase: '需求',
      startTime: mktTasks[0].startTime,
      endTime: mktMilestone.endTime,
      progress: Math.round((mktTasks.reduce((s, t) => s + t.progress, 0) / mktTasks.length) * 100) / 100,
      taskType: 'task',
      children: [...mktTasks, mktMilestone],
    },
  ]
}

// ---------- 列配置 ----------
const ganttColumns: VxeGanttPropTypes.Columns<GanttRow> = [
  { field: 'taskCode', title: '编号', width: 90, treeNode: true },
  { field: 'taskName', title: '任务名称', minWidth: 240 },
  {
    field: 'phase',
    title: '阶段',
    width: 90,
    slots: {
      default: ({ row }: { row: GanttRow }) =>
        h(
          'span',
          {
            style: {
              display: 'inline-block',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '12px',
              color: PHASE_COLOR[row.phase],
              background: PHASE_COLOR[row.phase] + '1A',
              border: `1px solid ${PHASE_COLOR[row.phase]}33`,
              lineHeight: '18px',
            },
          },
          row.phase,
        ),
    },
  },
  { field: 'owner', title: '负责人', width: 90 },
  { field: 'startTime', title: '开始', width: 110 },
  { field: 'endTime', title: '结束', width: 110 },
  {
    field: 'progress',
    title: '进度',
    width: 130,
    slots: {
      default: ({ row }: { row: GanttRow }) =>
        h(
          'div',
          { style: { padding: '0 6px', minWidth: '120px' } },
          [
            h(Progress, {
              percent: Math.round(row.progress * 100),
              size: 'small',
              showInfo: true,
              status: row.progress >= 1 ? 'success' : undefined,
            }),
          ],
        ),
    },
  },
]

// ---------- 甘特配置 ----------
const taskConfig: VxeGanttPropTypes.TaskConfig = {
  titleField: 'taskName',
  startField: 'startTime',
  endField: 'endTime',
  progressField: 'progress',
  typeField: 'taskType',
  dateFormat: 'yyyy-MM-dd',
}

const taskViewConfig = reactive<VxeGanttPropTypes.TaskViewConfig<GanttRow>>({
  showNowLine: true,
  scales: [
    { type: 'month' },
    { type: 'week' },
    { type: 'day' },
  ],
  viewStyle: {
    cellWidth: 34,
    // 启用 viewStyle.rowClassName 后，vxe-gantt 内部 tr 的 key 会走 rowid（keyField=id）分支
    // 而不是扁平 $rowIndex，彻底消除 Duplicate keys 警告
    rowClassName: 'vxe-gantt-row',
  },
})

const taskBarConfig: VxeGanttPropTypes.TaskBarConfig<GanttRow> = {
  showProgress: true,
  showContent: true,
  showTooltip: true,
  barStyle: ({ row }) => {
    if (row.taskType === 'milestone') {
      return {
        bgColor: '#ff3b30',
        completedBgColor: '#ff3b30',
        fontColor: '#fff',
        round: true,
      }
    }
    const phaseColor = PHASE_COLOR[row.phase] || '#1890ff'
    const lighten = phaseColor + '40'
    return {
      bgColor: lighten,
      completedBgColor: phaseColor,
      fontColor: '#262626',
      round: true,
    }
  },
}

const taskBarTooltipConfig: VxeGanttPropTypes.TaskBarTooltipConfig<GanttRow> = {
  theme: 'dark',
  useHtml: true,
  contentMethod: ({ row }) => {
    return `
      <div style="padding:6px 4px;min-width:200px">
        <div style="font-weight:600;margin-bottom:6px;color:#fff">${row.taskName}
          <span style="margin-left:6px;padding:0 6px;border-radius:8px;font-size:12px;
            background:${PHASE_COLOR[row.phase]}33;color:${PHASE_COLOR[row.phase]}">${row.phase}</span>
        </div>
        <div style="color:rgba(255,255,255,0.85);font-size:12px;line-height:1.8">
          负责人：${row.owner}<br/>
          时间：${row.startTime} 至 ${row.endTime}<br/>
          进度：${Math.round(row.progress * 100)}%
        </div>
      </div>`
  },
}

// ---------- 状态/视图 ----------
const ganttRef = ref<VxeGanttConstructor<GanttRow>>()
const ganttData = ref<GanttRow[]>([])
const viewScale = ref<'month' | 'week' | 'day'>('week')

// 统计
const stats = computed(() => {
  let total = 0
  let milestone = 0
  let doing = 0
  let done = 0
  let progressSum = 0
  const walk = (list: GanttRow[]) => {
    list.forEach((r) => {
      if (r.children && r.children.length) walk(r.children)
      // 只统计叶子节点
      if (!r.children || r.children.length === 0) {
        total++
        if (r.taskType === 'milestone') milestone++
        if (r.progress >= 1) done++
        else if (r.progress > 0) doing++
        progressSum += r.progress
      }
    })
  }
  walk(ganttData.value)
  return {
    total,
    milestone,
    doing,
    done,
    overallProgress: total ? progressSum / total : 0,
  }
})

// 视图缩放（通过调整 taskViewConfig.viewStyle.cellWidth 模拟缩放）
function zoomIn() {
  if (!taskViewConfig.viewStyle) return
  const cur = Number(taskViewConfig.viewStyle.cellWidth) || 34
  taskViewConfig.viewStyle.cellWidth = Math.min(cur + 8, 80)
  ganttRef.value?.refreshTaskView()
}
function zoomOut() {
  if (!taskViewConfig.viewStyle) return
  const cur = Number(taskViewConfig.viewStyle.cellWidth) || 34
  taskViewConfig.viewStyle.cellWidth = Math.max(cur - 8, 18)
  ganttRef.value?.refreshTaskView()
}
function scrollToToday() {
  ganttRef.value?.scrollToDateView(new Date())
}
function handleScaleChange(val: string) {
  if (!taskViewConfig.viewStyle) return
  if (val === 'month') {
    taskViewConfig.scales = [
      { type: 'quarter' },
      { type: 'month' },
    ]
    taskViewConfig.viewStyle.cellWidth = 80
  } else if (val === 'week') {
    taskViewConfig.scales = [
      { type: 'month' },
      { type: 'week' },
      { type: 'day' },
    ]
    taskViewConfig.viewStyle.cellWidth = 34
  } else {
    taskViewConfig.scales = [
      { type: 'week' },
      { type: 'day' },
    ]
    taskViewConfig.viewStyle.cellWidth = 40
  }
  ganttRef.value?.refreshTaskView()
}

onMounted(() => {
  const data = buildGanttData()
  ganttData.value = data
})
</script>

<style scoped lang="scss">
.member-gantt-page {
  height: calc(100vh - 72px);
  min-height: 640px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 顶部 */
.page-header {
  background: #fff;
  padding: 14px 20px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-title-icon {
  font-size: 20px;
  color: '#722ed1';
}
.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f1f1f;
}
.project-tag {
  margin-left: 4px;
}

/* 概览卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.stat-card {
  background: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 68px;
}
.stat-label {
  font-size: 12px;
  color: '#8c8c8c';
  margin-bottom: 6px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #1f1f1f;
  line-height: 1.2;
}
.stat-value.milestone { color: '#ff3b30'; }
.stat-value.doing     { color: '#1890ff'; }
.stat-value.done      { color: '#52c41a'; }
.stat-progress-wrap {
  padding-top: 4px;
  flex: 1;
  display: flex;
  align-items: center;
}

/* 甘特图容器 */
.gantt-wrapper {
  flex: 1;
  min-height: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 8px;
  overflow: hidden;
}
:deep(.vxe-gantt) {
  height: 100% !important;
}

@media (max-width: 1200px) {
  .stats-row { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 760px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
