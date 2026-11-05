<template>
  <div class="tasks-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">任务管理</h1>
        <p class="page-subtitle">管理和跟踪所有任务进度</p>
      </div>
      <div class="header-actions">
        <a-radio-group v-model:value="viewMode" button-style="solid" class="view-toggle">
          <a-radio-button value="list">
            <component :is="UnorderedListOutlined" />
            列表
          </a-radio-button>
          <a-radio-button value="kanban">
            <component :is="AppstoreOutlined" />
            看板
          </a-radio-button>
        </a-radio-group>
        <a-button class="action-btn">
          <component :is="FilterOutlined" />
          筛选
        </a-button>
        <a-button type="primary" class="action-btn" @click="showCreateModal = true">
          <component :is="PlusOutlined" />
          新建任务
        </a-button>
      </div>
    </div>

    <a-row :gutter="[16, 16]" class="stats-cards">
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">全部任务</span>
          <span class="mini-stat-value">1,892</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">待开始</span>
          <span class="mini-stat-value text-gray">256</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">进行中</span>
          <span class="mini-stat-value text-blue">864</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">已完成</span>
          <span class="mini-stat-value text-green">772</span>
        </div>
      </a-col>
    </a-row>

    <a-card v-if="viewMode === 'list'" class="table-card" :bordered="false">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <a-input-search
            v-model:value="searchValue"
            placeholder="搜索任务标题或编号"
            class="search-input"
            allow-clear
          />
          <a-select v-model:value="filterStatus" class="filter-select" placeholder="状态">
            <a-select-option value="">全部状态</a-select-option>
            <a-select-option value="todo">待开始</a-select-option>
            <a-select-option value="inProgress">进行中</a-select-option>
            <a-select-option value="review">待审核</a-select-option>
            <a-select-option value="done">已完成</a-select-option>
          </a-select>
          <a-select v-model:value="filterPriority" class="filter-select" placeholder="优先级">
            <a-select-option value="">全部优先级</a-select-option>
            <a-select-option value="high">紧急</a-select-option>
            <a-select-option value="medium">高</a-select-option>
            <a-select-option value="low">普通</a-select-option>
          </a-select>
        </div>
        <div class="toolbar-right">
          <a-button class="icon-only-btn">
            <component :is="ReloadOutlined" />
          </a-button>
          <a-button class="icon-only-btn">
            <component :is="SettingOutlined" />
          </a-button>
        </div>
      </div>

      <a-table
        :columns="columns"
        :data-source="filteredTasks"
        :pagination="pagination"
        row-key="id"
        class="tasks-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <div class="title-cell">
              <span class="task-id">{{ record.code }}</span>
              <span class="task-title">{{ record.title }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'priority'">
            <a-tag :color="priorityColors[record.priority]" class="priority-tag">
              {{ priorityLabels[record.priority] }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColors[record.status]" class="status-tag">
              {{ statusLabels[record.status] }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'assignee'">
            <div class="assignee-cell">
              <a-avatar :size="28">
                <img :src="'https://api.dicebear.com/7.x/avataaars/svg?seed=' + record.assignee" :alt="record.assignee" />
              </a-avatar>
              <span>{{ record.assignee }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'deadline'">
            <div class="deadline-cell" :class="{ overdue: record.overdue }">
              <component :is="ClockCircleOutlined" />
              <span>{{ record.deadline }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a-button type="link" size="small">查看</a-button>
              <a-button type="link" size="small">编辑</a-button>
              <a-button type="link" size="small" danger>删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <div v-else class="kanban-board">
      <div class="kanban-column" v-for="column in kanbanColumns" :key="column.key">
        <div class="kanban-column-header">
          <div class="column-title-wrapper">
            <span class="column-dot" :class="column.colorClass"></span>
            <span class="column-title">{{ column.title }}</span>
            <span class="column-count">{{ column.tasks.length }}</span>
          </div>
          <button class="column-add-btn">
            <component :is="PlusOutlined" />
          </button>
        </div>
        <div class="kanban-cards">
          <div class="kanban-card" v-for="task in column.tasks" :key="task.id">
            <div class="card-top">
              <a-tag :color="priorityColors[task.priority]" size="small">{{ priorityLabels[task.priority] }}</a-tag>
              <span class="task-code">{{ task.code }}</span>
            </div>
            <h4 class="card-title">{{ task.title }}</h4>
            <p class="card-desc">{{ task.description }}</p>
            <div class="card-footer">
              <div class="card-assignee">
                <a-avatar :size="24">
                  <img :src="'https://api.dicebear.com/7.x/avataaars/svg?seed=' + task.assignee" :alt="task.assignee" />
                </a-avatar>
              </div>
              <div class="card-deadline" :class="{ overdue: task.overdue }">
                <component :is="ClockCircleOutlined" />
                {{ task.deadline }}
              </div>
            </div>
          </div>
          <div class="kanban-card add-card">
            <component :is="PlusOutlined" />
            <span>添加任务</span>
          </div>
        </div>
      </div>
    </div>

    <a-modal
      v-model:open="showCreateModal"
      :title="isEdit ? '编辑任务' : '新建任务'"
      :footer="null"
      :width="880"
      class="modal-landscape task-modal"
    >
      <a-form :model="form" layout="vertical" class="task-form">
        <a-row :gutter="16">
          <a-col :span="16">
            <a-form-item label="任务标题">
              <a-input v-model:value="form.title" placeholder="请输入任务标题" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="任务编号">
              <a-input v-model:value="form.code" placeholder="自动生成" disabled />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="优先级">
              <a-select v-model:value="form.priority" placeholder="请选择优先级">
                <a-select-option value="high">紧急</a-select-option>
                <a-select-option value="medium">高</a-select-option>
                <a-select-option value="low">普通</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态">
              <a-select v-model:value="form.status" placeholder="请选择状态">
                <a-select-option value="todo">待开始</a-select-option>
                <a-select-option value="inProgress">进行中</a-select-option>
                <a-select-option value="review">待审核</a-select-option>
                <a-select-option value="done">已完成</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="截止日期">
              <a-date-picker v-model:value="form.deadline" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="负责人">
              <a-select v-model:value="form.assignee" placeholder="请选择负责人">
                <a-select-option value="张三">张三</a-select-option>
                <a-select-option value="李四">李四</a-select-option>
                <a-select-option value="王五">王五</a-select-option>
                <a-select-option value="赵六">赵六</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="关联需求">
              <a-select v-model:value="form.requirementId" placeholder="请选择关联需求">
                <a-select-option value="REQ-001">用户登录功能优化</a-select-option>
                <a-select-option value="REQ-002">数据导出功能开发</a-select-option>
                <a-select-option value="REQ-003">移动端页面适配优化</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="任务描述">
          <a-textarea v-model:value="form.description" :rows="4" placeholder="请输入任务详细描述" />
        </a-form-item>
        <div class="form-footer">
          <a-button @click="showCreateModal = false">取消</a-button>
          <a-button type="primary" @click="handleSubmit">提交</a-button>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  PlusOutlined,
  FilterOutlined,
  ReloadOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
} from '@ant-design/icons-vue'

interface Task {
  id: string
  code: string
  title: string
  description: string
  priority: string
  status: string
  assignee: string
  deadline: string
  overdue: boolean
  requirementId?: string
}

const viewMode = ref<'list' | 'kanban'>('list')
const searchValue = ref('')
const filterStatus = ref('')
const filterPriority = ref('')
const showCreateModal = ref(false)
const isEdit = ref(false)

const form = ref({
  title: '',
  code: '',
  priority: 'medium',
  status: 'todo',
  assignee: undefined as string | undefined,
  deadline: undefined as any,
  description: '',
  requirementId: undefined as string | undefined,
})

const priorityColors: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
}

const priorityLabels: Record<string, string> = {
  high: '紧急',
  medium: '高',
  low: '普通',
}

const statusColors: Record<string, string> = {
  todo: 'default',
  inProgress: 'processing',
  review: 'warning',
  done: 'success',
}

const statusLabels: Record<string, string> = {
  todo: '待开始',
  inProgress: '进行中',
  review: '待审核',
  done: '已完成',
}

const columns = [
  { title: '任务标题', dataIndex: 'title', key: 'title', width: 300 },
  { title: '优先级', dataIndex: 'priority', key: 'priority', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '负责人', dataIndex: 'assignee', key: 'assignee', width: 140 },
  { title: '截止日期', dataIndex: 'deadline', key: 'deadline', width: 160 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' },
]

const tasks = ref<Task[]>([
  { id: '1', code: 'TASK-001', title: '设计登录页面UI', description: '设计现代化的登录页面，支持多种登录方式', priority: 'high', status: 'done', assignee: '张三', deadline: '2024-01-15', overdue: false },
  { id: '2', code: 'TASK-002', title: '实现登录接口', description: '后端登录接口开发，支持JWT认证', priority: 'high', status: 'inProgress', assignee: '李四', deadline: '2024-01-18', overdue: false },
  { id: '3', code: 'TASK-003', title: '编写单元测试', description: '为登录模块编写完整的单元测试', priority: 'medium', status: 'todo', assignee: '王五', deadline: '2024-01-20', overdue: false },
  { id: '4', code: 'TASK-004', title: '第三方登录集成', description: '集成微信、GitHub等第三方登录', priority: 'medium', status: 'review', assignee: '赵六', deadline: '2024-01-16', overdue: true },
  { id: '5', code: 'TASK-005', title: '导出功能UI设计', description: '设计数据导出功能的用户界面', priority: 'low', status: 'todo', assignee: '张三', deadline: '2024-01-25', overdue: false },
  { id: '6', code: 'TASK-006', title: 'Excel导出实现', description: '实现Excel格式的数据导出功能', priority: 'medium', status: 'inProgress', assignee: '李四', deadline: '2024-01-22', overdue: false },
  { id: '7', code: 'TASK-007', title: '移动端适配测试', description: '在各种移动设备上测试页面适配', priority: 'high', status: 'done', assignee: '王五', deadline: '2024-01-12', overdue: false },
  { id: '8', code: 'TASK-008', title: '性能优化', description: '优化页面加载速度和渲染性能', priority: 'high', status: 'inProgress', assignee: '赵六', deadline: '2024-01-19', overdue: false },
])

const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    const matchSearch = !searchValue.value ||
      task.title.toLowerCase().includes(searchValue.value.toLowerCase()) ||
      task.code.toLowerCase().includes(searchValue.value.toLowerCase())
    const matchStatus = !filterStatus.value || task.status === filterStatus.value
    const matchPriority = !filterPriority.value || task.priority === filterPriority.value
    return matchSearch && matchStatus && matchPriority
  })
})

const kanbanColumns = [
  {
    key: 'todo',
    title: '待开始',
    colorClass: 'dot-gray',
    tasks: tasks.value.filter(t => t.status === 'todo'),
  },
  {
    key: 'inProgress',
    title: '进行中',
    colorClass: 'dot-blue',
    tasks: tasks.value.filter(t => t.status === 'inProgress'),
  },
  {
    key: 'review',
    title: '待审核',
    colorClass: 'dot-orange',
    tasks: tasks.value.filter(t => t.status === 'review'),
  },
  {
    key: 'done',
    title: '已完成',
    colorClass: 'dot-green',
    tasks: tasks.value.filter(t => t.status === 'done'),
  },
]

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 1892,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

function handleSubmit() {
  console.log('提交:', form.value)
  showCreateModal.value = false
}
</script>

<style scoped>
.tasks-page {
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
  letter-spacing: -0.5px;
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

.view-toggle {
  border-radius: 10px;
  overflow: hidden;
}

.action-btn {
  border-radius: 10px;
  height: 40px;
  padding: 0 20px;
  font-weight: 500;
}

.stats-cards {
  margin-bottom: 20px;
}

.mini-stat {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.mini-stat-label {
  font-size: 13px;
  color: #6b7280;
}

.mini-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}

.text-gray {
  color: #6b7280;
}

.text-blue {
  color: #374151;
}

.text-green {
  color: #10b981;
}

.table-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.table-card :deep(.ant-card-body) {
  padding: 0;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.search-input {
  width: 280px;
}

.search-input :deep(.ant-input-affix-wrapper) {
  border-radius: 10px;
}

.filter-select {
  width: 140px;
}

.filter-select :deep(.ant-select-selector) {
  border-radius: 10px !important;
}

.icon-only-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tasks-table {
  padding: 0 24px 24px;
}

.tasks-table :deep(.ant-table-thead > tr > th) {
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e5e7eb;
}

.tasks-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f3f4f6;
  padding: 16px 12px;
}

.tasks-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f9fafb;
}

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-id {
  font-size: 12px;
  color: #9ca3af;
  font-family: 'SF Mono', Monaco, monospace;
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.priority-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.assignee-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.deadline-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6b7280;
}

.deadline-cell.overdue {
  color: #ef4444;
}

.kanban-board {
  display: flex;
  gap: 20px;
  overflow-x: auto;
  padding-bottom: 20px;
}

.kanban-column {
  min-width: 300px;
  flex: 1;
  background: #f3f4f6;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.kanban-column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.column-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.column-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-gray {
  background: #9ca3af;
}

.dot-blue {
  background: #374151;
}

.dot-orange {
  background: #f59e0b;
}

.dot-green {
  background: #10b981;
}

.column-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.column-count {
  background: #e5e7eb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.column-add-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.2s ease;
}

.column-add-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.kanban-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.kanban-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  cursor: grab;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.kanban-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1);
}

.kanban-card:active {
  cursor: grabbing;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.task-code {
  font-size: 12px;
  color: #9ca3af;
  font-family: 'SF Mono', Monaco, monospace;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.card-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 16px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-assignee {
  display: flex;
  gap: 4px;
}

.card-deadline {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.card-deadline.overdue {
  color: #ef4444;
}

.add-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #6b7280;
  font-size: 14px;
  border: 2px dashed #cbd5e1;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-card:hover {
  border-color: #374151;
  color: #374151;
  background: #eff6ff;
  transform: none;
  box-shadow: none;
}

.task-modal :deep(.ant-modal-content) {
  border-radius: 16px;
}

.task-modal :deep(.ant-modal-header) {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.task-modal :deep(.ant-modal-title) {
  font-size: 18px;
  font-weight: 600;
}

.task-modal :deep(.ant-modal-body) {
  padding: 24px;
}

.task-form :deep(.ant-form-item-label > label) {
  font-weight: 500;
  color: #374151;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #f3f4f6;
}
</style>
