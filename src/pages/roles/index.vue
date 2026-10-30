<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <h2 class="mgmt-title">角色管理</h2>
      <a-button type="primary" class="mgmt-create-btn" @click="openCreate">
        <PlusOutlined /> 新增
      </a-button>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索角色名称 / 编码"
          allow-clear
          class="mgmt-search"
          @press-enter="handleSearch"
          @change="onKeywordChange"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <a-segmented v-model:value="statusFilter" :options="STATUS_FILTERS" @change="handleSearch" />
        <a-tooltip title="刷新">
          <button class="mgmt-icon-btn" :disabled="loading" @click="loadRoles"><ReloadOutlined /></button>
        </a-tooltip>
      </div>

      <a-table
        :columns="columns"
        :data-source="roles"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 860 }"
        class="mgmt-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <div class="role-cell">
              <span class="role-avatar"><TeamOutlined /></span>
              <span class="role-name">{{ record.roleName }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'roleCode'">
            <span v-if="record.roleCode" class="code-chip">{{ record.roleCode }}</span>
            <span v-else class="text-muted">-</span>
          </template>
          <template v-else-if="column.key === 'description'">
            <a-tooltip :title="record.description" placement="topLeft">
              <span class="ellipsis text-muted">{{ record.description || '-' }}</span>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'userCount'">
            <span class="text-muted">{{ record.userCount ?? '-' }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              size="small"
              :checked="record.status === 1"
              :loading="togglingId === record.id"
              @change="(v: boolean) => toggleStatus(record as RoleItem, v)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-tooltip title="编辑">
                <span class="row-action" @click="openEdit(record as RoleItem)"><EditOutlined /></span>
              </a-tooltip>
              <a-tooltip title="删除">
                <span class="row-action danger" @click="confirmDelete(record as RoleItem)"><DeleteOutlined /></span>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑角色' : '新增角色'"
      :width="480"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="角色名称" name="roleName">
          <a-input v-model:value="form.roleName" placeholder="如 项目管理员" :maxlength="32" />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="form.description" placeholder="选填" :rows="2" :maxlength="200" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-switch v-model:checked="statusChecked" checked-children="启用" un-checked-children="停用" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, type FormInstance, type TablePaginationConfig } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons-vue'
import { queryRoles, createRole, updateRole, deleteRole, type RoleItem, type RoleSaveParams } from '@/api/faiz'

const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]

const columns = [
  { title: '角色', key: 'role', width: 200, fixed: 'left' as const },
  { title: '编码', key: 'roleCode', width: 180 },
  { title: '描述', key: 'description', ellipsis: true },
  { title: '用户数', key: 'userCount', width: 90 },
  { title: '启用', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' as const },
]

// ---- 列表 ----
const loading = ref(false)
const roles = ref<RoleItem[]>([])
const keyword = ref('')
const statusFilter = ref('all')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 个角色`,
}))

async function loadRoles() {
  loading.value = true
  try {
    const res = await queryRoles({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : Number(statusFilter.value),
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res?.success) {
      roles.value = res.data?.list || []
      total.value = Number(res.data?.total || 0)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadRoles()
}

/** 清空搜索框时立即刷新 */
function onKeywordChange() {
  if (!keyword.value) handleSearch()
}

function handleTableChange(p: TablePaginationConfig) {
  page.value = p.current || 1
  pageSize.value = p.pageSize || 20
  loadRoles()
}

/** 列表内快捷启用 / 停用 */
const togglingId = ref<number | null>(null)
async function toggleStatus(r: RoleItem, checked: boolean) {
  togglingId.value = r.id
  try {
    const res = await updateRole({
      id: r.id,
      roleName: r.roleName,
      description: r.description,
      sort: r.sort,
      status: checked ? 1 : 0,
    })
    if (res?.success) r.status = checked ? 1 : 0
  } catch {
    // 请求层已统一提示
  } finally {
    togglingId.value = null
  }
}

// ---- 新增 / 编辑 ----
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const emptyForm = (): Required<Omit<RoleSaveParams, 'id'>> => ({
  roleName: '',
  description: '',
  sort: 0,
  status: 1,
})
const form = reactive(emptyForm())
const statusChecked = computed({
  get: () => form.status === 1,
  set: (v: boolean) => { form.status = v ? 1 : 0 },
})

const rules: Record<string, Rule[]> = {
  roleName: [{ required: true, whitespace: true, message: '请输入角色名称' }],
}

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  modalOpen.value = true
}

function openEdit(r: RoleItem) {
  editingId.value = r.id
  Object.assign(form, {
    roleName: r.roleName ?? '',
    description: r.description ?? '',
    sort: r.sort ?? 0,
    status: r.status ?? 1,
  })
  modalOpen.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload: RoleSaveParams = {
      ...form,
      roleName: form.roleName.trim(),
      description: form.description.trim() || undefined,
      sort: editingId.value ? form.sort : undefined,
    }
    const res = editingId.value
      ? await updateRole({ ...payload, id: editingId.value })
      : await createRole(payload)
    if (res?.success) {
      modalOpen.value = false
      if (!editingId.value) page.value = 1
      loadRoles()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---- 删除 ----
function confirmDelete(r: RoleItem) {
  Modal.confirm({
    title: `删除角色「${r.roleName}」？`,
    content: r.userCount ? `该角色下有 ${r.userCount} 个用户，删除后这些用户将失去该角色。` : '删除后不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteRole(r.id)
        if (res?.success) {
          if (roles.value.length === 1 && page.value > 1) page.value--
          loadRoles()
        }
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

onMounted(loadRoles)
</script>

<style scoped>
.mgmt-page {
  padding: 20px 24px 32px;
}

.mgmt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.mgmt-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
}

.mgmt-create-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-weight: 500;
  box-shadow: 0 2px 8px transparent;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--c-primary) 24%, transparent);
}

.mgmt-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mgmt-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mgmt-search {
  width: 300px;
  height: 34px;
  border-radius: 10px;
  background: #f5f5f7;
  border-color: transparent;
}

.mgmt-search:hover,
.mgmt-search:focus-within {
  background: #fff;
  border-color: #d2d2d7;
}

.mgmt-search :deep(.ant-input) {
  background: transparent;
}

.mgmt-search-icon {
  color: #aeaeb2;
}

.mgmt-icon-btn {
  margin-left: auto;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6e6e73;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.mgmt-icon-btn:hover:not(:disabled) {
  background: #f2f2f5;
}

.mgmt-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 500;
  color: #86868b;
  background: #fafafc;
}

.mgmt-table :deep(.ant-table-tbody > tr > td) {
  font-size: 13px;
}

.role-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.role-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
  background: #5e5ce6;
}

.role-name {
  font-weight: 500;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-chip {
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 6px;
}

.text-muted {
  color: #6e6e73;
}

.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: inline-flex;
  gap: 2px;
}

.row-action {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #6e6e73;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.row-action:hover {
  color: #1d1d1f;
  background: #e9e9ee;
}

.row-action.danger {
  color: #ff453a;
}

.row-action.danger:hover {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.1);
}

@media (max-width: 768px) {
  .mgmt-page {
    padding: 16px;
  }

  .mgmt-toolbar {
    flex-wrap: wrap;
  }

  .mgmt-search {
    flex: 1 1 100%;
    width: auto;
  }
}
</style>
