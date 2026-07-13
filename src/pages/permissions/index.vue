<template>
  <div class="permissions-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">权限管理</h1>
        <p class="page-subtitle">管理系统权限配置</p>
      </div>
      <div class="header-actions">
        <a-button type="primary" class="action-btn" @click="showModal = true">
          <component :is="PlusOutlined" />
          新增权限
        </a-button>
      </div>
    </div>

    <a-row :gutter="[16, 16]" class="stats-cards">
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">权限总数</span>
          <span class="mini-stat-value">128</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">菜单权限</span>
          <span class="mini-stat-value text-blue">42</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">按钮权限</span>
          <span class="mini-stat-value text-green">56</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">接口权限</span>
          <span class="mini-stat-value text-orange">30</span>
        </div>
      </a-col>
    </a-row>

    <a-card class="table-card" :bordered="false">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <a-input-search
            v-model:value="searchValue"
            placeholder="搜索权限名称"
            class="search-input"
            allow-clear
          />
          <a-select v-model:value="filterType" class="filter-select" placeholder="类型">
            <a-select-option value="">全部类型</a-select-option>
            <a-select-option value="1">菜单</a-select-option>
            <a-select-option value="2">按钮</a-select-option>
            <a-select-option value="3">接口</a-select-option>
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
        :data-source="flatPermissions"
        :pagination="pagination"
        row-key="key"
        class="permissions-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <div class="title-cell" :style="{ paddingLeft: record.level * 24 + 'px' }">
              <span v-if="record.hasChildren" class="expand-icon" @click="toggleExpand(record.key)">
                <component :is="expandedKeys.includes(record.key) ? DownOutlined : RightOutlined" />
              </span>
              <span v-else class="expand-icon-placeholder"></span>
              <span class="perm-title">{{ record.title }}</span>
              <a-tag :color="getTypeColor(record.type)" class="type-tag">
                {{ getTypeName(record.type) }}
              </a-tag>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'" class="status-tag">
              {{ record.status === 1 ? '启用' : '禁用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a-button type="link" size="small" @click="editPermission(record)">编辑</a-button>
              <a-button
                type="link"
                size="small"
                :danger="record.status === 1"
                @click="toggleStatus(record)"
              >
                {{ record.status === 1 ? '禁用' : '启用' }}
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="showModal"
      :title="isEdit ? '编辑权限' : '新增权限'"
      :footer="null"
      :width="560"
      class="perm-modal"
    >
      <a-form :model="form" layout="vertical" class="perm-form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="权限名称">
              <a-input v-model:value="form.name" placeholder="请输入权限名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="权限编码">
              <a-input v-model:value="form.code" placeholder="请输入权限编码" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="权限类型">
              <a-select v-model:value="form.type" placeholder="请选择类型" style="width: 100%">
                <a-select-option :value="1">菜单</a-select-option>
                <a-select-option :value="2">按钮</a-select-option>
                <a-select-option :value="3">接口</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="父权限">
              <a-select v-model:value="form.parentId" placeholder="请选择父权限" style="width: 100%">
                <a-select-option :value="0">顶级权限</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item v-if="form.type === 1" label="路由路径">
          <a-input v-model:value="form.path" placeholder="请输入路由路径" />
        </a-form-item>
        <a-form-item v-if="form.type === 3" label="请求方法">
          <a-select v-model:value="form.method" placeholder="请选择请求方法" style="width: 100%">
            <a-select-option value="GET">GET</a-select-option>
            <a-select-option value="POST">POST</a-select-option>
            <a-select-option value="PUT">PUT</a-select-option>
            <a-select-option value="DELETE">DELETE</a-select-option>
          </a-select>
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="排序">
              <a-input-number v-model:value="form.sortOrder" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status" placeholder="请选择状态" style="width: 100%">
                <a-select-option :value="1">启用</a-select-option>
                <a-select-option :value="0">禁用</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <div class="form-footer">
          <a-button @click="showModal = false">取消</a-button>
          <a-button type="primary" @click="handleSubmit">确认</a-button>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import {
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'

interface Permission {
  key: string
  title: string
  type: number
  status: number
  sortOrder: number
  level: number
  hasChildren: boolean
  children?: Permission[]
}

const searchValue = ref('')
const filterType = ref('')
const showModal = ref(false)
const isEdit = ref(false)
const expandedKeys = ref<string[]>(['1'])

const columns = [
  { title: '权限名称', dataIndex: 'title', key: 'title' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

const permissionTree = ref<Permission[]>([
  {
    key: '1',
    title: '系统管理',
    type: 1,
    status: 1,
    sortOrder: 1,
    level: 0,
    hasChildren: true,
    children: [
      { key: '1-1', title: '用户管理', type: 1, status: 1, sortOrder: 1, level: 1, hasChildren: false },
      { key: '1-2', title: '角色管理', type: 1, status: 1, sortOrder: 2, level: 1, hasChildren: false },
      { key: '1-3', title: '权限管理', type: 1, status: 1, sortOrder: 3, level: 1, hasChildren: false },
    ],
  },
  {
    key: '2',
    title: '需求管理',
    type: 1,
    status: 1,
    sortOrder: 2,
    level: 0,
    hasChildren: true,
    children: [
      { key: '2-1', title: '需求列表', type: 1, status: 1, sortOrder: 1, level: 1, hasChildren: false },
      { key: '2-2', title: '创建需求', type: 2, status: 1, sortOrder: 2, level: 1, hasChildren: false },
      { key: '2-3', title: '编辑需求', type: 2, status: 1, sortOrder: 3, level: 1, hasChildren: false },
      { key: '2-4', title: '删除需求', type: 2, status: 1, sortOrder: 4, level: 1, hasChildren: false },
    ],
  },
  {
    key: '3',
    title: '任务管理',
    type: 1,
    status: 1,
    sortOrder: 3,
    level: 0,
    hasChildren: true,
    children: [
      { key: '3-1', title: '任务列表', type: 1, status: 1, sortOrder: 1, level: 1, hasChildren: false },
      { key: '3-2', title: '看板视图', type: 1, status: 1, sortOrder: 2, level: 1, hasChildren: false },
      { key: '3-3', title: '创建任务', type: 2, status: 1, sortOrder: 3, level: 1, hasChildren: false },
    ],
  },
])

function flattenTree(tree: Permission[], expanded: string[]): Permission[] {
  const result: Permission[] = []
  function traverse(nodes: Permission[]) {
    for (const node of nodes) {
      result.push(node)
      if (node.children && node.children.length > 0 && expanded.includes(node.key)) {
        traverse(node.children)
      }
    }
  }
  traverse(tree)
  return result
}

const flatPermissions = computed(() => {
  let result = flattenTree(permissionTree.value, expandedKeys.value)
  if (searchValue.value) {
    result = result.filter(p =>
      p.title.toLowerCase().includes(searchValue.value.toLowerCase())
    )
  }
  if (filterType.value) {
    result = result.filter(p => String(p.type) === filterType.value)
  }
  return result
})

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 128,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const form = reactive({
  name: '',
  code: '',
  type: 1,
  parentId: 0,
  path: '',
  method: '',
  sortOrder: 0,
  status: 1,
})

function getTypeColor(type: number) {
  const colors: Record<number, string> = {
    1: 'blue',
    2: 'green',
    3: 'orange',
  }
  return colors[type] || 'default'
}

function getTypeName(type: number) {
  const names: Record<number, string> = {
    1: '菜单',
    2: '按钮',
    3: '接口',
  }
  return names[type] || '未知'
}

function toggleExpand(key: string) {
  const index = expandedKeys.value.indexOf(key)
  if (index > -1) {
    expandedKeys.value.splice(index, 1)
  } else {
    expandedKeys.value.push(key)
  }
}

function editPermission(record: Permission) {
  isEdit.value = true
  form.name = record.title
  form.type = record.type
  form.sortOrder = record.sortOrder
  form.status = record.status
  showModal.value = true
}

function toggleStatus(record: Permission) {
  console.log('切换状态:', record.title, record.status)
}

function handleSubmit() {
  console.log('提交:', form)
  showModal.value = false
}
</script>

<style scoped>
.permissions-page {
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

.text-blue {
  color: #374151;
}

.text-green {
  color: #10b981;
}

.text-orange {
  color: #f59e0b;
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

.permissions-table {
  padding: 0 24px 24px;
}

.permissions-table :deep(.ant-table-thead > tr > th) {
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e5e7eb;
}

.permissions-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f3f4f6;
  padding: 16px 12px;
}

.permissions-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f9fafb;
}

.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expand-icon {
  cursor: pointer;
  color: #6b7280;
  font-size: 12px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.expand-icon:hover {
  color: #374151;
}

.expand-icon-placeholder {
  width: 16px;
  height: 16px;
}

.perm-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.type-tag {
  margin-left: 8px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.perm-modal :deep(.ant-modal-content) {
  border-radius: 16px;
}

.perm-modal :deep(.ant-modal-header) {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.perm-modal :deep(.ant-modal-title) {
  font-size: 18px;
  font-weight: 600;
}

.perm-modal :deep(.ant-modal-body) {
  padding: 24px;
}

.perm-form :deep(.ant-form-item-label > label) {
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
