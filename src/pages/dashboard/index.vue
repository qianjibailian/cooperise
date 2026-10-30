<template>
  <div class="dashboard">
    <div class="page-header">
      <div>
        <h1 class="page-title">仪表盘</h1>
        <p class="page-subtitle">欢迎回来，这是您的工作概览</p>
      </div>
      <div class="header-actions">
        <a-range-picker />
        <a-button type="primary">
          <component :is="DownloadOutlined" />
          导出报表
        </a-button>
      </div>
    </div>

    <a-row :gutter="16" class="mb-6">
      <a-col :xs="24" :sm="12" :lg="6" v-for="stat in stats" :key="stat.label">
        <a-card class="shadow-sm hover:shadow-md transition-shadow">
          <a-statistic
            :title="stat.label"
            :value="stat.value"
            :suffix="stat.suffix"
            :value-style="{ color: stat.color }"
          >
            <template #prefix>
              <component :is="stat.icon" />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16" class="mb-6">
      <a-col :xs="24" :lg="16">
        <a-card title="需求与任务趋势" class="shadow-sm">
          <template #extra>
            <a-radio-group :default-value="'week'" size="small">
              <a-radio-button value="week">周</a-radio-button>
              <a-radio-button value="month">月</a-radio-button>
              <a-radio-button value="year">年</a-radio-button>
            </a-radio-group>
          </template>
          <div class="chart-area">
            <div class="chart-bars">
              <div class="chart-bar" v-for="(item, index) in chartData" :key="index">
                <div class="bar-wrapper">
                  <div class="bar bar-req" :style="{ height: item.requirements + '%' }"></div>
                  <div class="bar bar-task" :style="{ height: item.tasks + '%' }"></div>
                </div>
                <span class="bar-label">{{ item.label }}</span>
              </div>
            </div>
            <div class="chart-legend">
              <div class="legend-item">
                <span class="legend-dot dot-req"></span>
                <span>新增需求</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot dot-task"></span>
                <span>完成任务</span>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="8">
        <a-card title="任务完成率" class="shadow-sm">
          <div class="progress-section">
            <div class="progress-item" v-for="item in progressData" :key="item.label">
              <div class="progress-header">
                <span class="progress-label">{{ item.label }}</span>
                <span class="progress-value">{{ item.value }}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: item.value + '%', background: item.color }"></div>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <a-col :xs="24" :lg="12">
        <a-card title="最近需求" class="shadow-sm">
          <template #extra>
            <a-button type="link" size="small">查看全部</a-button>
          </template>
          <div class="list-section">
            <div class="list-item" v-for="item in recentRequirements" :key="item.id">
              <div class="flex items-center gap-3 flex-1">
                <a-tag color="blue">需求</a-tag>
                <span class="item-title">{{ item.title }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="item-date">{{ item.date }}</span>
                <a-tag :color="statusColors[item.status]">{{ statusLabels[item.status] }}</a-tag>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card title="我的任务" class="shadow-sm">
          <template #extra>
            <a-button type="link" size="small">查看全部</a-button>
          </template>
          <div class="list-section">
            <div class="list-item" v-for="item in myTasks" :key="item.id">
              <div class="flex items-center gap-3 flex-1">
                <a-tag color="green">任务</a-tag>
                <span class="item-title">{{ item.title }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="item-date" :class="{ 'text-red-500': item.overdue }">{{ item.deadline }}</span>
                <a-tag :color="taskStatusColors[item.status]">{{ taskStatusLabels[item.status] }}</a-tag>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import {
  UserOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  DownloadOutlined,
} from '@ant-design/icons-vue'

const stats = [
  { label: '总用户数', value: 1234, suffix: '人', icon: UserOutlined, color: '#3b82f6' },
  { label: '需求总数', value: 256, suffix: '项', icon: FileTextOutlined, color: '#10b981' },
  { label: '任务总数', value: 1892, suffix: '项', icon: CheckSquareOutlined, color: '#8b5cf6' },
  { label: '部门数量', value: 12, suffix: '个', icon: FileTextOutlined, color: '#f59e0b' },
]

const chartData = [
  { label: '周一', requirements: 45, tasks: 60 },
  { label: '周二', requirements: 52, tasks: 75 },
  { label: '周三', requirements: 38, tasks: 55 },
  { label: '周四', requirements: 65, tasks: 80 },
  { label: '周五', requirements: 48, tasks: 70 },
  { label: '周六', requirements: 20, tasks: 35 },
  { label: '周日', requirements: 15, tasks: 25 },
]

const progressData = [
  { label: '已完成', value: 75, color: '#10b981' },
  { label: '进行中', value: 20, color: '#3b82f6' },
  { label: '待处理', value: 5, color: '#f59e0b' },
]

const statusColors: Record<string, string> = {
  pending: 'default',
  inProgress: 'processing',
  completed: 'success',
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  inProgress: '进行中',
  completed: '已完成',
}

const taskStatusColors: Record<string, string> = {
  todo: 'default',
  inProgress: 'processing',
  review: 'warning',
  done: 'success',
}

const taskStatusLabels: Record<string, string> = {
  todo: '待开始',
  inProgress: '进行中',
  review: '待审核',
  done: '已完成',
}

const recentRequirements = [
  { id: 1, title: '用户登录功能优化', status: 'inProgress', date: '2天前' },
  { id: 2, title: '数据导出功能开发', status: 'pending', date: '5天前' },
  { id: 3, title: '移动端适配', status: 'completed', date: '1周前' },
  { id: 4, title: '权限管理系统重构', status: 'inProgress', date: '1周前' },
]

const myTasks = [
  { id: 1, title: '编写需求文档', deadline: '今天 18:00', status: 'inProgress', overdue: false },
  { id: 2, title: '代码审查', deadline: '明天 12:00', status: 'todo', overdue: false },
  { id: 3, title: '修复登录Bug', deadline: '昨天 18:00', status: 'review', overdue: true },
  { id: 4, title: 'UI设计评审', deadline: '后天 10:00', status: 'done', overdue: false },
]
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.page-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.mb-6 {
  margin-bottom: 24px;
}

.shadow-sm {
  box-shadow: 0 1px 2px 0 rgba(0, 0,0,0.05);
}

.chart-area {
  height: 280px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  flex: 1;
  gap: 12px;
  padding: 16px 0;
}

.chart-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.bar-wrapper {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 100%;
  min-height: 40px;
}

.bar {
  width: 16px;
  border-radius: 4px 4px 0 0;
  transition: height 0.5s ease;
}

.bar-req {
  background: var(--c-primary);
}

.bar-task {
  background: #93c5fd;
}

.bar-label {
  font-size: 12px;
  color: #6b7280;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #4b5563;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-req {
  background: var(--c-primary);
}

.dot-task {
  background: #93c5fd;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.progress-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: 14px;
  color: #4b5563;
  font-weight: 500;
}

.progress-value {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.progress-track {
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.list-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.list-item:hover {
  background: #f9fafb;
}

.item-title {
  font-size: 14px;
  color: #1f2937;
}

.item-date {
  font-size: 12px;
  color: #9ca3af;
}

.text-red-500 {
  color: #ef4444;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.gap-3 {
  gap: 12px;
}

.flex-1 {
  flex: 1;
}
</style>
