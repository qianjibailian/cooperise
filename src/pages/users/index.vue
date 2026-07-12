<template>
  <div class="users-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">用户管理</h1>
        <p class="page-subtitle">管理系统用户账户和权限</p>
      </div>
      <div class="header-actions">
        <a-button class="action-btn">
          <component :is="ImportOutlined" />
          导入
        </a-button>
        <a-button class="action-btn">
          <component :is="ExportOutlined" />
          导出
        </a-button>
        <a-button type="primary" class="action-btn" @click="showModal = true">
          <component :is="PlusOutlined" />
          新增用户
        </a-button>
      </div>
    </div>

    <a-row :gutter="[16, 16]" class="stats-cards">
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">总用户数</span>
          <span class="mini-stat-value">1,234</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">活跃用户</span>
          <span class="mini-stat-value text-green">986</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">禁用用户</span>
          <span class="mini-stat-value text-red">42</span>
        </div>
      </a-col>
      <a-col :xs="12" :sm="6">
        <div class="mini-stat">
          <span class="mini-stat-label">本月新增</span>
          <span class="mini-stat-value text-blue">128</span>
        </div>
      </a-col>
    </a-row>

    <a-card class="table-card" :bordered="false">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <a-input-search
            v-model:value="searchValue"
            placeholder="搜索用户名、邮箱、手机号"
            class="search-input"
            allow-clear
          />
          <a-select v-model:value="filterDept" class="filter-select" placeholder="部门">
            <a-select-option value="">全部部门</a-select-option>
            <a-select-option v-for="dept in departments" :key="dept.id" :value="dept.id">
              {{ dept.name }}
            </a-select-option>
          </a-select>
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
        :data-source="filteredUsers"
        :pagination="pagination"
        row-key="id"
        class="users-table"
      />
    </a-card>

    <a-modal
      v-model:open="showModal"
      :title="isEdit ? '编辑用户' : '新增用户'"
      :footer="null"
      :width="560"
      class="user-modal"
    >
      <a-form :model="form" layout="vertical" class="user-form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="用户名">
              <a-input v-model:value="form.username" placeholder="请输入用户名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="真实姓名">
              <a-input v-model:value="form.realName" placeholder="请输入真实姓名" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="邮箱">
              <a-input v-model:value="form.email" placeholder="请输入邮箱" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="手机号">
              <a-input v-model:value="form.phone" placeholder="请输入手机号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="部门">
              <a-select v-model:value="form.departmentId" placeholder="请选择部门">
                <a-select-option v-for="dept in departments" :key="dept.id" :value="dept.id">
                  {{ dept.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="性别">
              <a-select v-model:value="form.gender" placeholder="请选择性别">
                <a-select-option :value="1">男</a-select-option>
                <a-select-option :value="2">女</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status" placeholder="请选择状态">
                <a-select-option :value="1">启用</a-select-option>
                <a-select-option :value="0">禁用</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12" v-if="!isEdit">
            <a-form-item label="初始密码">
              <a-input-password v-model:value="form.password" placeholder="请输入初始密码" />
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
import { ref, computed, reactive, h } from 'vue'
import {
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'

interface User {
  id: number
  username: string
  realName: string
  email: string
  phone: string
  departmentName: string
  status: number
  gender: number
  createdAt: string
}

interface Department {
  id: number
  name: string
}

const searchValue = ref('')
const filterDept = ref<number | string>('')
const filterStatus = ref('')
const showModal = ref(false)
const isEdit = ref(false)

const columns = [
  {
    title: '用户信息',
    key: 'user',
    width: 240,
    customRender: ({ record }: { record: User }) => {
      return h('div', { class: 'user-cell' }, [
        h('a-avatar', { size: 40 }, {
          default: () => h('img', {
            src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + record.username,
            alt: record.username
          })
        }),
        h('div', { class: 'user-info' }, [
          h('span', { class: 'user-name' }, record.realName),
          h('span', { class: 'user-username' }, '@' + record.username)
        ])
      ])
    }
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    key: 'email',
    width: 200,
    customRender: ({ record }: { record: User }) => {
      return h('span', { class: 'text-email' }, record.email)
    }
  },
  {
    title: '手机号',
    dataIndex: 'phone',
    key: 'phone',
    width: 140,
    customRender: ({ record }: { record: User }) => {
      return h('span', { class: 'text-phone' }, record.phone)
    }
  },
  {
    title: '部门',
    dataIndex: 'departmentName',
    key: 'departmentName',
    width: 120,
    customRender: ({ record }: { record: User }) => {
      return h('a-tag', { color: 'blue' }, () => record.departmentName)
    }
  },
  {
    title: '性别',
    dataIndex: 'gender',
    key: 'gender',
    width: 80,
    customRender: ({ record }: { record: User }) => {
      if (record.gender === 1) return '男'
      if (record.gender === 2) return '女'
      return '-'
    }
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    customRender: ({ record }: { record: User }) => {
      return h('a-tag', {
        color: record.status === 1 ? 'success' : 'default',
        class: 'status-tag'
      }, () => record.status === 1 ? '启用' : '禁用')
    }
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 160,
    customRender: ({ record }: { record: User }) => {
      return h('span', { class: 'text-date' }, record.createdAt)
    }
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    fixed: 'right',
    customRender: ({ record }: { record: User }) => {
      return h('a-space', { size: 'small' }, () => [
        h('a-button', { type: 'link', size: 'small', onClick: () => editUser(record) }, () => '编辑'),
        h('a-button', { type: 'link', size: 'small', onClick: () => resetPassword(record) }, () => '重置密码'),
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

const users = ref<User[]>([
  { id: 1, username: 'admin', realName: '管理员', email: 'admin@example.com', phone: '13800138000', departmentName: '技术部', status: 1, gender: 1, createdAt: '2024-01-01 10:00:00' },
  { id: 2, username: 'user1', realName: '张三', email: 'user1@example.com', phone: '13800138001', departmentName: '产品部', status: 1, gender: 1, createdAt: '2024-01-02 10:00:00' },
  { id: 3, username: 'user2', realName: '李四', email: 'user2@example.com', phone: '13800138002', departmentName: '运营部', status: 0, gender: 2, createdAt: '2024-01-03 10:00:00' },
  { id: 4, username: 'user3', realName: '王五', email: 'user3@example.com', phone: '13800138003', departmentName: '技术部', status: 1, gender: 1, createdAt: '2024-01-04 10:00:00' },
  { id: 5, username: 'user4', realName: '赵六', email: 'user4@example.com', phone: '13800138004', departmentName: '设计部', status: 1, gender: 2, createdAt: '2024-01-05 10:00:00' },
])

const departments = ref<Department[]>([
  { id: 1, name: '技术部' },
  { id: 2, name: '产品部' },
  { id: 3, name: '运营部' },
  { id: 4, name: '设计部' },
])

const filteredUsers = computed(() => {
  return users.value.filter(user => {
    const matchSearch = !searchValue.value ||
      user.username.toLowerCase().includes(searchValue.value.toLowerCase()) ||
      user.realName.toLowerCase().includes(searchValue.value.toLowerCase()) ||
      user.email.toLowerCase().includes(searchValue.value.toLowerCase()) ||
      user.phone.includes(searchValue.value)
    const matchDept = filterDept.value === '' || user.departmentName === departments.value.find(d => d.id === filterDept.value)?.name
    const matchStatus = !filterStatus.value || String(user.status) === filterStatus.value
    return matchSearch && matchDept && matchStatus
  })
})

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 1234,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const form = reactive({
  username: '',
  realName: '',
  email: '',
  phone: '',
  departmentId: undefined as number | undefined,
  gender: undefined as number | undefined,
  status: 1,
  password: '',
})

function editUser(record: User) {
  isEdit.value = true
  form.username = record.username
  form.realName = record.realName
  form.email = record.email
  form.phone = record.phone
  form.departmentId = record.id
  form.gender = record.gender
  form.status = record.status
  showModal.value = true
}

function resetPassword(record: User) {
  console.log('重置密码:', record.username)
}

function toggleStatus(record: User) {
  console.log('切换状态:', record.username, record.status)
}

function handleSubmit() {
  console.log('提交:', form)
  showModal.value = false
}
</script>

<style scoped>
.users-page {
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

.users-table {
  padding: 0 24px 24px;
}

.users-table :deep(.ant-table-thead > tr > th) {
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e5e7eb;
}

.users-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f3f4f6;
  padding: 16px 12px;
}

.users-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f9fafb;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.user-username {
  font-size: 12px;
  color: #9ca3af;
}

.text-email {
  color: #374151;
}

.text-phone {
  font-family: 'SF Mono', Monaco, monospace;
  color: #6b7280;
}

.text-date {
  color: #6b7280;
  font-size: 13px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-modal :deep(.ant-modal-content) {
  border-radius: 16px;
}

.user-modal :deep(.ant-modal-header) {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.user-modal :deep(.ant-modal-title) {
  font-size: 18px;
  font-weight: 600;
}

.user-modal :deep(.ant-modal-body) {
  padding: 24px;
}

.user-form :deep(.ant-form-item-label > label) {
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
