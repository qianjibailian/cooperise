<template>
  <div class="departments-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">部门管理</h1>
        <p class="page-subtitle">管理组织架构和部门信息</p>
      </div>
      <div class="header-actions">
        <a-button type="primary" class="action-btn" @click="showModal = true">
          <component :is="PlusOutlined" />
          新增部门
        </a-button>
      </div>
    </div>

    <a-row :gutter="[16, 16]" class="stats-cards">
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">部门总数</span>
          <span class="mini-stat-value">12</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">一级部门</span>
          <span class="mini-stat-value text-blue">4</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">启用部门</span>
          <span class="mini-stat-value text-green">10</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">总人数</span>
          <span class="mini-stat-value text-purple">256</span>
        </div>
      </a-col>
    </a-row>

    <a-row :gutter="20">
      <a-col :xs="24" :lg="8">
        <a-card class="tree-card" :bordered="false" title="组织架构">
          <div class="tree-toolbar">
            <a-input-search
              v-model:value="searchValue"
              placeholder="搜索部门"
              class="search-input"
              allow-clear
              size="small"
            />
          </div>
          <a-tree
            :tree-data="departmentTree"
            :expanded-keys="expandedKeys"
            :selected-keys="selectedKeys"
            @expand="onExpand"
            @select="onSelect"
            class="dept-tree"
            blockNode
          >
            <template #title="{ record }">
              <span class="tree-node-title">
                <component :is="record.children && record.children.length > 0 ? ApartmentOutlined : TeamOutlined" class="tree-icon" />
                {{ record.title }}
              </span>
            </template>
          </a-tree>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="16">
        <a-card class="table-card" :bordered="false">
          <div class="table-toolbar">
            <div class="toolbar-left">
              <span class="current-dept">
                当前部门：<strong>{{ currentDeptName }}</strong>
              </span>
            </div>
            <div class="toolbar-right">
              <a-button class="icon-only-btn">
                <component :is="ReloadOutlined" />
              </a-button>
              <a-button type="primary" size="small" @click="showAddChild = true">
                <component :is="PlusOutlined" />
                添加子部门
              </a-button>
            </div>
          </div>

          <a-table
            :columns="columns"
            :data-source="childDepartments"
            :pagination="pagination"
            row-key="key"
            class="depts-table"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'">
                <div class="name-cell">
                  <div class="dept-icon">
                    <component :is="TeamOutlined" />
                  </div>
                  <div class="dept-info">
                    <span class="dept-name">{{ record.title }}</span>
                    <span class="dept-code">{{ record.code }}</span>
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'" class="status-tag">
                  {{ record.status === 1 ? '启用' : '禁用' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'members'">
                <a-avatar-group :max-count="3" size="small">
                  <a-avatar style="background-color: #4b5563">张</a-avatar>
                  <a-avatar style="background-color: #374151">李</a-avatar>
                  <a-avatar style="background-color: #10b981">王</a-avatar>
                  <a-avatar style="background-color: #f59e0b">赵</a-avatar>
                </a-avatar-group>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a-button type="link" size="small" @click="editDepartment(record)">编辑</a-button>
                  <a-button type="link" size="small" @click="addChild(record)">添加子部门</a-button>
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
      </a-col>
    </a-row>

    <a-modal
      v-model:open="showModal"
      :title="isEdit ? '编辑部门' : '新增部门'"
      :footer="null"
      :width="520"
      class="dept-modal"
    >
      <a-form :model="form" layout="vertical" class="dept-form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="部门名称">
              <a-input v-model:value="form.name" placeholder="请输入部门名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="部门编码">
              <a-input v-model:value="form.code" placeholder="请输入部门编码" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="上级部门">
          <a-select v-model:value="form.parentId" placeholder="请选择上级部门" style="width: 100%">
            <a-select-option :value="0">顶级部门</a-select-option>
            <a-select-option :value="1">总部</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="部门描述">
          <a-textarea v-model:value="form.description" :rows="3" placeholder="请输入部门描述" />
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
  TeamOutlined,
  ApartmentOutlined,
} from '@ant-design/icons-vue'

interface Department {
  key: string
  title: string
  code: string
  status: number
  sortOrder: number
  memberCount?: number
  children?: Department[]
}

const searchValue = ref('')
const showModal = ref(false)
const showAddChild = ref(false)
const isEdit = ref(false)
const expandedKeys = ref<string[]>(['1'])
const selectedKeys = ref<string[]>(['1'])

const columns = [
  { title: '部门名称', dataIndex: 'title', key: 'title' },
  { title: '编码', dataIndex: 'code', key: 'code', width: 120 },
  { title: '成员', dataIndex: 'members', key: 'members', width: 140 },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' },
]

const departmentTree = ref<Department[]>([
  {
    key: '1',
    title: '总部',
    code: 'HQ',
    status: 1,
    sortOrder: 1,
    memberCount: 256,
    children: [
      {
        key: '2',
        title: '技术部',
        code: 'TECH',
        status: 1,
        sortOrder: 1,
        memberCount: 86,
        children: [
          { key: '2-1', title: '前端组', code: 'FE', status: 1, sortOrder: 1, memberCount: 20 },
          { key: '2-2', title: '后端组', code: 'BE', status: 1, sortOrder: 2, memberCount: 35 },
          { key: '2-3', title: '测试组', code: 'QA', status: 1, sortOrder: 3, memberCount: 16 },
          { key: '2-4', title: '运维组', code: 'OPS', status: 1, sortOrder: 4, memberCount: 15 },
        ],
      },
      {
        key: '3',
        title: '产品部',
        code: 'PROD',
        status: 1,
        sortOrder: 2,
        memberCount: 24,
        children: [
          { key: '3-1', title: '产品组', code: 'PM', status: 1, sortOrder: 1, memberCount: 12 },
          { key: '3-2', title: '设计组', code: 'UI', status: 1, sortOrder: 2, memberCount: 12 },
        ],
      },
      {
        key: '4',
        title: '运营部',
        code: 'OPER',
        status: 1,
        sortOrder: 3,
        memberCount: 42,
        children: [
          { key: '4-1', title: '运营组', code: 'OP', status: 1, sortOrder: 1, memberCount: 22 },
          { key: '4-2', title: '市场组', code: 'MKT', status: 1, sortOrder: 2, memberCount: 20 },
        ],
      },
      {
        key: '5',
        title: '人事部',
        code: 'HR',
        status: 1,
        sortOrder: 4,
        memberCount: 18,
      },
      {
        key: '6',
        title: '财务部',
        code: 'FIN',
        status: 1,
        sortOrder: 5,
        memberCount: 12,
      },
    ],
  },
])

const currentDeptName = computed(() => {
  function findTitle(nodes: Department[]): string | null {
    for (const node of nodes) {
      if (node.key === selectedKeys.value[0]) {
        return node.title
      }
      if (node.children) {
        const found = findTitle(node.children)
        if (found) return found
      }
    }
    return null
  }
  return findTitle(departmentTree.value) || '总部'
})

const childDepartments = computed(() => {
  function findChildren(nodes: Department[]): Department[] {
    for (const node of nodes) {
      if (node.key === selectedKeys.value[0]) {
        return node.children || []
      }
      if (node.children) {
        const found = findChildren(node.children)
        if (found) return found
      }
    }
    return []
  }
  return findChildren(departmentTree.value)
})

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const form = reactive({
  name: '',
  code: '',
  parentId: 0,
  description: '',
  sortOrder: 0,
  status: 1,
})

function onExpand(keys: string[]) {
  expandedKeys.value = keys
}

function onSelect(keys: string[]) {
  selectedKeys.value = keys
}

function editDepartment(record: Department) {
  isEdit.value = true
  form.name = record.title
  form.code = record.code
  form.sortOrder = record.sortOrder
  form.status = record.status
  showModal.value = true
}

function addChild(record: Department) {
  isEdit.value = false
  form.parentId = parseInt(record.key)
  showModal.value = true
}

function toggleStatus(record: Department) {
  console.log('切换状态:', record.title, record.status)
}

function handleSubmit() {
  console.log('提交:', form)
  showModal.value = false
}
</script>

<style scoped>
.departments-page {
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

.text-purple {
  color: #4b5563;
}

.tree-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  height: 100%;
}

.tree-card :deep(.ant-card-head) {
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
}

.tree-card :deep(.ant-card-head-title) {
  font-size: 16px;
  font-weight: 600;
}

.tree-card :deep(.ant-card-body) {
  padding: 16px 20px;
}

.tree-toolbar {
  margin-bottom: 16px;
}

.search-input :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
}

.dept-tree :deep(.ant-tree-node-content-wrapper) {
  height: 36px;
  line-height: 36px;
  border-radius: 8px;
}

.dept-tree :deep(.ant-tree-node-selected .ant-tree-node-content-wrapper) {
  background: #eff6ff;
  color: #374151;
}

.tree-node-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tree-icon {
  color: #4b5563;
  font-size: 16px;
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

.current-dept {
  font-size: 14px;
  color: #6b7280;
}

.current-dept strong {
  color: #1f2937;
  font-weight: 600;
}

.toolbar-left {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.icon-only-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.depts-table {
  padding: 0 24px 24px;
}

.depts-table :deep(.ant-table-thead > tr > th) {
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e5e7eb;
}

.depts-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f3f4f6;
  padding: 16px 12px;
}

.depts-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f9fafb;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dept-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #374151 0%, #6b7280 100%);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  flex-shrink: 0;
}

.dept-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dept-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.dept-code {
  font-size: 12px;
  color: #9ca3af;
  font-family: 'SF Mono', Monaco, monospace;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dept-modal :deep(.ant-modal-content) {
  border-radius: 16px;
}

.dept-modal :deep(.ant-modal-header) {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.dept-modal :deep(.ant-modal-title) {
  font-size: 18px;
  font-weight: 600;
}

.dept-modal :deep(.ant-modal-body) {
  padding: 24px;
}

.dept-form :deep(.ant-form-item-label > label) {
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
