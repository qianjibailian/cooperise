<template>
  <div class="roles-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">角色管理</h1>
        <p class="page-subtitle">管理系统角色和权限分配</p>
      </div>
      <div class="header-actions">
        <a-button type="primary" class="action-btn" @click="showModal = true">
          <component :is="PlusOutlined" />
          新增角色
        </a-button>
      </div>
    </div>

    <a-row :gutter="[16, 16]" class="stats-cards">
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">角色总数</span>
          <span class="mini-stat-value">24</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">启用角色</span>
          <span class="mini-stat-value text-green">22</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">禁用角色</span>
          <span class="mini-stat-value text-red">2</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">本月新增</span>
          <span class="mini-stat-value text-blue">5</span>
        </div>
      </a-col>
    </a-row>

    <a-card class="table-card" :bordered="false">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <a-input-search
            v-model:value="searchValue"
            placeholder="搜索角色名称或编码"
            class="search-input"
            allow-clear
          />
          <a-select v-model:value="filterStatus" class="filter-select" placeholder="状态">
            <a-select-option value="">全部状态</a-select-option>
            <a-select-option value="1">启用</a-select-option>
            <a-select-option value="0">禁用</a-select-option>
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
        :data-source="filteredRoles"
        :pagination="pagination"
        row-key="id"
        class="roles-table"
      />
    </a-card>

    <a-modal
      v-model:open="showModal"
      :title="isEdit ? '编辑角色' : '新增角色'"
      :footer="null"
      :width="520"
      class="role-modal"
    >
      <a-form :model="form" layout="vertical" class="role-form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="角色名称">
              <a-input v-model:value="form.name" placeholder="请输入角色名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="角色编码">
              <a-input v-model:value="form.code" placeholder="请输入角色编码" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="角色描述">
          <a-textarea v-model:value="form.description" :rows="3" placeholder="请输入角色描述" />
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

    <a-modal
      v-model:open="showPermModal"
      title="分配权限"
      :footer="null"
      :width="520"
      class="perm-modal"
    >
      <a-tree
        checkable
        :tree-data="permissionTree"
        :checked-keys="checkedPerms"
        @check="onPermCheck"
        class="perm-tree"
      />
      <div class="form-footer">
        <a-button @click="showPermModal = false">取消</a-button>
        <a-button type="primary" @click="handlePermSubmit">确认</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, h } from 'vue'
import {
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'

interface Role {
  id: number
  name: string
  code: string
  description: string
  status: number
  sortOrder: number
  createdAt: string
}

const searchValue = ref('')
const filterStatus = ref('')
const showModal = ref(false)
const showPermModal = ref(false)
const isEdit = ref(false)

const columns = [
  {
    title: '角色名称',
    dataIndex: 'name',
    key: 'name',
    width: 240,
    customRender: ({ record }: { record: Role }) => {
      return h('div', { class: 'name-cell' }, [
        h('div', { class: 'role-avatar' }, [
          h(TeamOutlined)
        ]),
        h('div', { class: 'role-info' }, [
          h('span', { class: 'role-name' }, record.name),
          h('span', { class: 'role-code' }, record.code)
        ])
      ])
    }
  },
  { title: '描述', dataIndex: 'description', key: 'description' },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    customRender: ({ record }: { record: Role }) => {
      return h('a-tag', {
        color: record.status === 1 ? 'success' : 'default',
        class: 'status-tag'
      }, () => record.status === 1 ? '启用' : '禁用')
    }
  },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  {
    title: '操作',
    key: 'action',
    width: 240,
    fixed: 'right',
    customRender: ({ record }: { record: Role }) => {
      return h('a-space', { size: 'small' }, () => [
        h('a-button', { type: 'link', size: 'small', onClick: () => editRole(record) }, () => '编辑'),
        h('a-button', { type: 'link', size: 'small', onClick: () => assignPermissions(record) }, () => '分配权限'),
        h('a-button', {
          type: 'link',
          size: 'small',
          danger: record.status === 1,
          onClick: () => toggleStatus(record)
        }, () => record.status === 1 ? '禁用' : '启用')
      ])
    }
  },
]

const roles = ref<Role[]>([
  { id: 1, name: '超级管理员', code: 'admin', description: '拥有系统所有权限', status: 1, sortOrder: 0, createdAt: '2024-01-01 10:00:00' },
  { id: 2, name: '普通用户', code: 'user', description: '普通用户权限', status: 1, sortOrder: 1, createdAt: '2024-01-02 10:00:00' },
  { id: 3, name: '产品经理', code: 'pm', description: '产品管理相关权限', status: 1, sortOrder: 2, createdAt: '2024-01-03 10:00:00' },
  { id: 4, name: '开发人员', code: 'developer', description: '开发相关权限', status: 1, sortOrder: 3, createdAt: '2024-01-04 10:00:00' },
  { id: 5, name: '测试人员', code: 'tester', description: '测试相关权限', status: 0, sortOrder: 4, createdAt: '2024-01-05 10:00:00' },
])

const filteredRoles = computed(() => {
  return roles.value.filter(role => {
    const matchSearch = !searchValue.value ||
      role.name.toLowerCase().includes(searchValue.value.toLowerCase()) ||
      role.code.toLowerCase().includes(searchValue.value.toLowerCase())
    const matchStatus = !filterStatus.value || String(role.status) === filterStatus.value
    return matchSearch && matchStatus
  })
})

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 24,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const form = reactive({
  name: '',
  code: '',
  description: '',
  sortOrder: 0,
  status: 1,
})

const permissionTree = ref([
  {
    title: '系统管理',
    key: '1',
    children: [
      { title: '用户管理', key: '2' },
      { title: '角色管理', key: '3' },
      { title: '权限管理', key: '4' },
    ],
  },
])

const checkedPerms = ref<string[]>(['1', '2'])

function editRole(record: Role) {
  isEdit.value = true
  form.name = record.name
  form.code = record.code
  form.description = record.description
  form.sortOrder = record.sortOrder
  form.status = record.status
  showModal.value = true
}

function assignPermissions(record: Role) {
  console.log('分配权限:', record.name)
  showPermModal.value = true
}

function toggleStatus(record: Role) {
  console.log('切换状态:', record.name, record.status)
}

function onPermCheck(checkedKeys: string[], _info: unknown) {
  checkedPerms.value = checkedKeys
}

function handleSubmit() {
  console.log('提交:', form)
  showModal.value = false
}

function handlePermSubmit() {
  console.log('权限分配:', checkedPerms.value)
  showPermModal.value = false
}
</script>

<style scoped>
.roles-page {
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

.text-green {
  color: #10b981;
}

.text-red {
  color: #ef4444;
}

.text-blue {
  color: #374151;
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

.roles-table {
  padding: 0 24px 24px;
}

.roles-table :deep(.ant-table-thead > tr > th) {
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e5e7eb;
}

.roles-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f3f4f6;
  padding: 16px 12px;
}

.roles-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f9fafb;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #4b5563 0%, #9ca3af 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  flex-shrink: 0;
}

.role-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.role-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.role-code {
  font-size: 12px;
  color: #9ca3af;
  font-family: 'SF Mono', Monaco, monospace;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.role-modal :deep(.ant-modal-content),
.perm-modal :deep(.ant-modal-content) {
  border-radius: 16px;
}

.role-modal :deep(.ant-modal-header),
.perm-modal :deep(.ant-modal-header) {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.role-modal :deep(.ant-modal-title),
.perm-modal :deep(.ant-modal-title) {
  font-size: 18px;
  font-weight: 600;
}

.role-modal :deep(.ant-modal-body),
.perm-modal :deep(.ant-modal-body) {
  padding: 24px;
}

.role-form :deep(.ant-form-item-label > label) {
  font-weight: 500;
  color: #374151;
}

.perm-tree {
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  max-height: 400px;
  overflow-y: auto;
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
