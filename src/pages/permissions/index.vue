<template>
  <div class="permissions-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">权限管理</h1>
        <p class="page-desc">菜单、按钮与接口权限点的统一视图，支持展开层级、搜索与启停</p>
      </div>
    </header>

    <section class="table-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <a-input
            v-model:value="searchValue"
            placeholder="搜索权限名称"
            class="search-input"
            allow-clear
          >
            <template #prefix><SearchOutlined class="search-icon" /></template>
          </a-input>
          <a-select v-model:value="filterType" class="filter-select" placeholder="全部类型">
            <a-select-option value="">全部类型</a-select-option>
            <a-select-option value="1">菜单</a-select-option>
            <a-select-option value="2">按钮</a-select-option>
            <a-select-option value="3">接口</a-select-option>
          </a-select>
        </div>
        <div class="toolbar-right">
          <a-tooltip title="刷新">
            <button type="button" class="ghost-icon-btn">
              <ReloadOutlined />
            </button>
          </a-tooltip>
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
            <div class="title-cell" :style="{ paddingLeft: record.level * 28 + 'px' }">
              <span
                v-if="record.hasChildren"
                class="expand-icon"
                :class="{ 'is-open': expandedKeys.includes(record.key) }"
                @click="toggleExpand(record.key)"
              >
                <RightOutlined />
              </span>
              <span v-else class="expand-icon-placeholder"></span>
              <span :class="['perm-badge', `perm-badge--t${record.type}`]">
                <component :is="typeIconOf(record.type)" />
              </span>
              <span class="perm-title">{{ record.title }}</span>
              <span :class="['type-chip', `type-chip--t${record.type}`]">{{ getTypeName(record.type) }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <span class="status-dot" :class="record.status === 1 ? 'is-on' : 'is-off'">
              <i class="status-dot-circle" />{{ record.status === 1 ? '启用' : '禁用' }}
            </span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a class="row-action" @click="editPermission(record)">编辑</a>
              <a
                class="row-action"
                :class="{ 'is-danger': record.status === 1 }"
                @click="toggleStatus(record)"
              >
                {{ record.status === 1 ? '禁用' : '启用' }}
              </a>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal
      v-model:open="showModal"
      :title="isEdit ? '编辑权限' : '新增权限'"
      :footer="null"
      :width="640"
      centered
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
              <a-input v-model:value="form.code" placeholder="如 admin:user:create" />
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
              <a-input-number v-model:value="form.sortOrder" :min="0" placeholder="默认 0" style="width: 100%" />
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
          <a-button class="cancel-btn" @click="showModal = false">取消</a-button>
          <a-button type="primary" class="confirm-btn" @click="handleSubmit">确认</a-button>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import {
  ReloadOutlined,
  SearchOutlined,
  RightOutlined,
  AppstoreOutlined,
  ApiOutlined,
  CodeOutlined,
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
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 90 },
  { title: '操作', key: 'action', width: 140, fixed: 'right' as const },
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
  /** 排序默认清空（不填提交时按 0 处理） */
  sortOrder: null as number | null,
  status: 1,
})

/** 类型 → 图标（菜单 / 按钮 / 接口） */
function typeIconOf(type: number) {
  const icons: Record<number, unknown> = { 1: AppstoreOutlined, 2: ApiOutlined, 3: CodeOutlined }
  return icons[type] || AppstoreOutlined
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
  form.sortOrder = record.sortOrder ?? null
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
/* Teambition 风格：浅灰底、轻量卡片、彩色图标标识、圆点状态、紧凑行高 */
.permissions-page {
  padding: 20px 24px 32px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
  letter-spacing: -0.2px;
}

.page-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: #8f959e;
}

.table-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 10px;
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #f0f1f3;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

/* 浅灰底无边框搜索框（Teambition 工具栏样式） */
.search-input {
  width: 260px;
}

.search-input :deep(.ant-input-affix-wrapper) {
  height: 34px;
  background: #f5f6f7;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: background 0.15s, border-color 0.15s;
}

.search-input :deep(.ant-input-affix-wrapper:hover),
.search-input :deep(.ant-input-affix-wrapper-focused) {
  background: #fff;
  border-color: #d0d3d6;
}

.search-input :deep(.ant-input) {
  background: transparent;
}

.search-icon {
  color: #a9adb3;
}

.filter-select {
  width: 120px;
}

.filter-select :deep(.ant-select-selector) {
  height: 34px;
  background: #f5f6f7 !important;
  border: 1px solid transparent !important;
  border-radius: 8px !important;
}

.filter-select :deep(.ant-select-selector .ant-select-selection-item) {
  line-height: 32px;
}

.filter-select :deep(.ant-select-arrow) {
  color: #8f959e;
}

/* 右侧幽灵图标按钮 */
.ghost-icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: #646a73;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.ghost-icon-btn:hover {
  color: #1f2329;
  background: #f0f1f3;
}

.permissions-table {
  padding: 0 20px 16px;
}

.permissions-table :deep(.ant-table-thead > tr > th) {
  background: transparent;
  color: #8f959e;
  font-weight: 500;
  font-size: 12px;
  border-bottom: 1px solid #f0f1f3;
  padding: 10px 12px;
}

.permissions-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f5f6f7;
  padding: 11px 12px;
  font-size: 13px;
}

.permissions-table :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: none;
}

.permissions-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f7f8fa;
}

/* 名称单元格：缩进 + 展开箭头 + 类型图标 */
.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.expand-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #8f959e;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.18s ease, color 0.15s, background 0.15s;
}

.expand-icon.is-open {
  transform: rotate(90deg);
}

.expand-icon:hover {
  color: #1f2329;
  background: #eceef0;
}

.expand-icon-placeholder {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* 类型彩色圆角图标（Teambition 应用图标风格） */
.perm-badge {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border-radius: 7px;
}

.perm-badge--t1 {
  color: #5b6bf6;
  background: #eef0ff;
}

.perm-badge--t2 {
  color: #0a8fe0;
  background: #e6f4fd;
}

.perm-badge--t3 {
  color: #14a575;
  background: #e6f7f0;
}

.perm-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 类型轻量小标签 */
.type-chip {
  flex-shrink: 0;
  padding: 1px 8px;
  font-size: 12px;
  line-height: 18px;
  border-radius: 4px;
}

.type-chip--t1 {
  color: #5b6bf6;
  background: #eef0ff;
}

.type-chip--t2 {
  color: #0a8fe0;
  background: #e6f4fd;
}

.type-chip--t3 {
  color: #14a575;
  background: #e6f7f0;
}

/* 状态：小圆点 + 文字（替代大色块 tag） */
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #646a73;
}

.status-dot-circle {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.is-on .status-dot-circle {
  background: #14a575;
}

.status-dot.is-off .status-dot-circle {
  background: #bbbfc4;
}

.status-dot.is-off {
  color: #8f959e;
}

/* 行内操作：浅灰文字链接 */
.row-actions {
  display: inline-flex;
  gap: 14px;
}

.row-action {
  font-size: 13px;
  color: #646a73;
  cursor: pointer;
  transition: color 0.15s;
}

.row-action:hover {
  color: #3370ff;
}

.row-action.is-danger:hover {
  color: #d83931;
}

/* 弹窗：轻圆角、紧凑表单 */
.perm-modal :deep(.ant-modal-content) {
  border-radius: 12px;
  padding: 0;
}

.perm-modal :deep(.ant-modal-header) {
  padding: 18px 24px;
  border-bottom: 1px solid #f0f1f3;
  margin-bottom: 0;
}

.perm-modal :deep(.ant-modal-title) {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.perm-modal :deep(.ant-modal-body) {
  padding: 20px 24px 24px;
}

.perm-form :deep(.ant-form-item-label > label) {
  font-size: 13px;
  font-weight: 500;
  color: #646a73;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid #f0f1f3;
}

.cancel-btn {
  border-radius: 8px;
}

.confirm-btn {
  border-radius: 8px;
}

@media (max-width: 768px) {
  .permissions-page {
    padding: 16px;
  }

  .search-input {
    flex: 1 1 100%;
    width: auto;
  }
}
</style>
