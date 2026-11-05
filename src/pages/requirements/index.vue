<template>
  <div class="requirements-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">需求管理</h1>
        <p class="page-subtitle">管理和跟踪所有产品需求</p>
      </div>
      <div class="header-actions">
        <a-button class="action-btn">
          <component :is="FilterOutlined" />
          筛选
        </a-button>
        <a-button type="primary" class="action-btn" @click="showCreateModal = true">
          <component :is="PlusOutlined" />
          新建需求
        </a-button>
      </div>
    </div>

    <a-row :gutter="[16, 16]" class="stats-cards">
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">全部需求</span>
          <span class="mini-stat-value">256</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">待处理</span>
          <span class="mini-stat-value text-orange">42</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">进行中</span>
          <span class="mini-stat-value text-blue">86</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">已完成</span>
          <span class="mini-stat-value text-green">128</span>
        </div>
      </a-col>
    </a-row>

    <a-card class="table-card" :bordered="false">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <a-input-search
            v-model:value="searchValue"
            placeholder="搜索需求标题或编号"
            class="search-input"
            allow-clear
          />
          <a-select v-model:value="filterStatus" class="filter-select" placeholder="状态">
            <a-select-option value="">全部状态</a-select-option>
            <a-select-option value="pending">待处理</a-select-option>
            <a-select-option value="inProgress">进行中</a-select-option>
            <a-select-option value="completed">已完成</a-select-option>
          </a-select>
          <a-select v-model:value="filterPriority" class="filter-select" placeholder="优先级">
            <a-select-option value="">全部优先级</a-select-option>
            <a-select-option value="high">高</a-select-option>
            <a-select-option value="medium">中</a-select-option>
            <a-select-option value="low">低</a-select-option>
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
        :data-source="filteredRequirements"
        :pagination="pagination"
        row-key="id"
        class="requirements-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <div class="title-cell">
              <span class="req-id">{{ record.id }}</span>
              <span class="req-title">{{ record.title }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'priority'">
            <a-tag :color="priorityColors[record.priority]" class="priority-tag">
              <component :is="priorityIcons[record.priority]" />
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
          <template v-else-if="column.key === 'progress'">
            <div class="progress-cell">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" :style="{ width: record.progress + '%' }"></div>
              </div>
              <span class="progress-text">{{ record.progress }}%</span>
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

    <a-modal
      v-model:open="showCreateModal"
      :title="isEdit ? '编辑需求' : '新建需求'"
      :footer="null"
      :width="880"
      class="modal-landscape requirement-modal"
    >
      <a-form :model="form" layout="vertical" class="requirement-form">
        <a-row :gutter="16">
          <a-col :span="16">
            <a-form-item label="需求标题">
              <a-input v-model:value="form.title" placeholder="请输入需求标题" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="需求编号">
              <a-input v-model:value="form.code" placeholder="自动生成" disabled />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="优先级">
              <a-select v-model:value="form.priority" placeholder="请选择优先级">
                <a-select-option value="high">高优先级</a-select-option>
                <a-select-option value="medium">中优先级</a-select-option>
                <a-select-option value="low">低优先级</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status" placeholder="请选择状态">
                <a-select-option value="pending">待处理</a-select-option>
                <a-select-option value="inProgress">进行中</a-select-option>
                <a-select-option value="completed">已完成</a-select-option>
              </a-select>
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
            <a-form-item label="截止日期">
              <a-date-picker v-model:value="form.deadline" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="需求描述">
          <a-textarea v-model:value="form.description" :rows="4" placeholder="请输入需求详细描述" />
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
  ExclamationCircleOutlined,
  MinusCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons-vue'

interface Requirement {
  id: string
  code: string
  title: string
  priority: string
  status: string
  assignee: string
  progress: number
  createdAt: string
  deadline: string
}

const searchValue = ref('')
const filterStatus = ref('')
const filterPriority = ref('')
const showCreateModal = ref(false)
const isEdit = ref(false)

const form = ref({
  title: '',
  code: '',
  priority: 'medium',
  status: 'pending',
  assignee: undefined as string | undefined,
  deadline: undefined as any,
  description: '',
})

const priorityColors: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
}

const priorityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const priorityIcons: Record<string, any> = {
  high: ExclamationCircleOutlined,
  medium: MinusCircleOutlined,
  low: InfoCircleOutlined,
}

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

const columns = [
  { title: '需求标题', dataIndex: 'title', key: 'title', width: 280 },
  { title: '优先级', dataIndex: 'priority', key: 'priority', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '负责人', dataIndex: 'assignee', key: 'assignee', width: 140 },
  { title: '进度', dataIndex: 'progress', key: 'progress', width: 180 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' },
]

const requirements = ref<Requirement[]>([
  { id: 'REQ-001', code: 'REQ-001', title: '用户登录功能优化，支持第三方登录', priority: 'high', status: 'inProgress', assignee: '张三', progress: 65, createdAt: '2024-01-15', deadline: '2024-02-01' },
  { id: 'REQ-002', code: 'REQ-002', title: '数据导出功能开发，支持Excel和CSV格式', priority: 'medium', status: 'pending', assignee: '李四', progress: 0, createdAt: '2024-01-14', deadline: '2024-02-15' },
  { id: 'REQ-003', code: 'REQ-003', title: '移动端页面适配优化', priority: 'high', status: 'completed', assignee: '王五', progress: 100, createdAt: '2024-01-13', deadline: '2024-01-30' },
  { id: 'REQ-004', code: 'REQ-004', title: '权限管理系统重构', priority: 'low', status: 'inProgress', assignee: '赵六', progress: 30, createdAt: '2024-01-12', deadline: '2024-02-28' },
  { id: 'REQ-005', code: 'REQ-005', title: '消息通知中心开发', priority: 'medium', status: 'pending', assignee: '张三', progress: 0, createdAt: '2024-01-11', deadline: '2024-03-01' },
  { id: 'REQ-006', code: 'REQ-006', title: '仪表盘数据可视化优化', priority: 'high', status: 'inProgress', assignee: '李四', progress: 80, createdAt: '2024-01-10', deadline: '2024-01-25' },
  { id: 'REQ-007', code: 'REQ-007', title: '用户行为分析功能', priority: 'low', status: 'completed', assignee: '王五', progress: 100, createdAt: '2024-01-09', deadline: '2024-01-28' },
  { id: 'REQ-008', code: 'REQ-008', title: '系统性能优化，提升页面加载速度', priority: 'high', status: 'inProgress', assignee: '赵六', progress: 45, createdAt: '2024-01-08', deadline: '2024-02-10' },
])

const filteredRequirements = computed(() => {
  return requirements.value.filter(req => {
    const matchSearch = !searchValue.value ||
      req.title.toLowerCase().includes(searchValue.value.toLowerCase()) ||
      req.code.toLowerCase().includes(searchValue.value.toLowerCase())
    const matchStatus = !filterStatus.value || req.status === filterStatus.value
    const matchPriority = !filterPriority.value || req.priority === filterPriority.value
    return matchSearch && matchStatus && matchPriority
  })
})

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 256,
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
.requirements-page {
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

.text-orange {
  color: #f59e0b;
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

.requirements-table {
  padding: 0 24px 24px;
}

.requirements-table :deep(.ant-table-thead > tr > th) {
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e5e7eb;
}

.requirements-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f3f4f6;
  padding: 16px 12px;
}

.requirements-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f9fafb;
}

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.req-id {
  font-size: 12px;
  color: #9ca3af;
  font-family: 'SF Mono', Monaco, monospace;
}

.req-title {
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

.progress-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar-bg {
  flex: 1;
  height: 6px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #374151 0%, #4b5563 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  min-width: 36px;
}

.requirement-modal :deep(.ant-modal-content) {
  border-radius: 16px;
}

.requirement-modal :deep(.ant-modal-header) {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.requirement-modal :deep(.ant-modal-title) {
  font-size: 18px;
  font-weight: 600;
}

.requirement-modal :deep(.ant-modal-body) {
  padding: 24px;
}

.requirement-form :deep(.ant-form-item-label > label) {
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
