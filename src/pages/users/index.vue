<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <h2 class="mgmt-title">用户管理</h2>
      <a-button type="primary" class="mgmt-create-btn" @click="openCreate">
        <PlusOutlined /> 新增
      </a-button>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索姓名 / 工号 / 英文名 / 部门"
          allow-clear
          class="mgmt-search"
          @press-enter="handleSearch"
          @change="onKeywordChange"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <a-segmented v-model:value="activeFilter" :options="ACTIVE_FILTERS" @change="handleSearch" />
        <a-tooltip title="刷新">
          <button class="mgmt-icon-btn" :disabled="loading" @click="loadUsers"><ReloadOutlined /></button>
        </a-tooltip>
      </div>

      <a-table
        :columns="columns"
        :data-source="users"
        :loading="loading"
        :pagination="pagination"
        :row-key="(r: UserItem) => r.id ?? r.userNo"
        :scroll="{ x: 970 }"
        class="mgmt-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'user'">
            <div class="user-cell">
              <a-avatar :size="32" :src="record.avatarUrl || undefined" class="user-avatar">
                {{ initials(record) }}
              </a-avatar>
              <div class="user-cell-text">
                <div class="user-cell-name">{{ record.realName || record.coAccount || record.userCoAccount || '-' }}</div>
                <div v-if="userSubLine(record)" class="user-cell-sub">{{ userSubLine(record) }}</div>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'email'">
            <span class="text-muted">{{ record.email || '-' }}</span>
          </template>
          <template v-else-if="column.key === 'dept'">
            <span v-if="!record.deptInfo" class="text-muted">-</span>
            <a-tooltip v-else :title="splitDept(record.deptInfo).join(' / ')" placement="topLeft" :mouse-enter-delay="0.3">
              <div class="dept-cell">
                <span class="dept-icon"><ApartmentOutlined /></span>
                <div class="dept-text">
                  <span class="dept-name">{{ splitDept(record.deptInfo).slice(-1)[0] }}</span>
                  <span v-if="splitDept(record.deptInfo).length > 1" class="dept-path">
                    {{ splitDept(record.deptInfo).slice(0, -1).join(' / ') }}
                  </span>
                </div>
              </div>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'position'">
            <span v-if="!record.positionName" class="text-muted">-</span>
            <span v-else class="position-chip"><IdcardOutlined /><span class="position-chip-text">{{ record.positionName }}</span></span>
          </template>
          <template v-else-if="column.key === 'roles'">
            <span v-if="!record.roleNames?.length" class="text-muted">-</span>
            <a-tag v-for="r in record.roleNames" v-else :key="r" class="soft-tag">{{ r }}</a-tag>
          </template>
          <template v-else-if="column.key === 'isActive'">
            <span :class="['status-pill', isActiveUser(record) ? 'on' : 'off']">
              {{ isActiveUser(record) ? '在职' : '离职' }}
            </span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-tooltip title="编辑">
                <span class="row-action" @click="openEdit(record as UserItem)"><EditOutlined /></span>
              </a-tooltip>
              <a-tooltip title="删除">
                <span class="row-action danger" @click="confirmDelete(record as UserItem)"><DeleteOutlined /></span>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑用户' : '新增用户'"
      :width="560"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="姓名" name="realName">
              <a-input v-model:value="form.realName" placeholder="如 沈元" :maxlength="32" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="工号" name="coAccount">
              <a-input
                :value="editingId ? form.coAccount : ''"
                :placeholder="editingId ? '-' : '保存后自动生成'"
                disabled
                class="readonly-input"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="英文名" name="userEnName">
              <a-input v-model:value="form.userEnName" placeholder="如 Allen Shen" :maxlength="64" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="邮箱" name="email">
              <a-input v-model:value="form.email" placeholder="登录邮箱" :maxlength="128" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="组织" name="deptId">
              <OrgTreeSelect v-model="form.deptId" :tree-data="orgTree" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="岗位" name="positionId">
              <a-select
                v-model:value="form.positionId"
                :options="sortedPositionOptions"
                placeholder="选择岗位"
                allow-clear
                show-search
                option-filter-prop="label"
                popup-class-name="role-select-popup position-select-popup"
                :list-height="280"
                class="position-select"
              >
                <template #suffixIcon><IdcardOutlined /></template>
                <template #option="{ label, orgName, sameOrg }">
                  <span class="role-option">
                    <span class="role-option-avatar position-option-avatar"><IdcardOutlined /></span>
                    <span class="role-option-text">
                      <span class="role-option-name">{{ label }}</span>
                      <span v-if="orgName" class="role-option-desc">{{ orgName }}</span>
                    </span>
                    <span v-if="sameOrg" class="position-option-hint">本组织</span>
                  </span>
                </template>
                <template #notFoundContent>
                  <div class="role-option-empty">暂无可用岗位，请先在「岗位管理」中添加</div>
                </template>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="角色" name="roleIds">
              <a-select
                v-model:value="form.roleIds"
                mode="multiple"
                :options="roleOptions"
                placeholder="选择角色"
                allow-clear
                option-filter-prop="label"
                :menu-item-selected-icon="h(CheckOutlined)"
                :max-tag-count="4"
                popup-class-name="role-select-popup"
                :list-height="280"
                class="role-select"
              >
                <template #suffixIcon><TeamOutlined /></template>
                <template #option="{ label, description }">
                  <span class="role-option">
                    <span class="role-option-avatar"><TeamOutlined /></span>
                    <span class="role-option-text">
                      <span class="role-option-name">{{ label }}</span>
                      <span v-if="description" class="role-option-desc">{{ description }}</span>
                    </span>
                  </span>
                </template>
                <template #tagRender="{ label, closable, onClose }">
                  <span class="role-tag">
                    <TeamOutlined class="role-tag-icon" />
                    <span class="role-tag-text">{{ label }}</span>
                    <CloseOutlined v-if="closable" class="role-tag-close" @mousedown.prevent @click="onClose" />
                  </span>
                </template>
                <template #notFoundContent>
                  <div class="role-option-empty">暂无可用角色，请先在「角色管理」中添加</div>
                </template>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-if="!editingId" :span="12">
            <a-form-item label="初始密码" name="password">
              <a-input-password v-model:value="form.password" placeholder="6-32 位" autocomplete="new-password" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="在职状态" name="isActive">
              <a-switch v-model:checked="activeChecked" checked-children="在职" un-checked-children="离职" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { Modal, type FormInstance, type TablePaginationConfig } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined,
  TeamOutlined, CheckOutlined, CloseOutlined, IdcardOutlined,
} from '@ant-design/icons-vue'
import {
  queryUsers, createUser, updateUser, deleteUser, getOrganizationTree, queryRoles, queryPositions,
  type UserSaveParams, type OrganizationNode,
} from '@/api/faiz'
import type { UserItem } from '@/types/faiz'
import OrgTreeSelect from '@/components/OrgTreeSelect.vue'

const ACTIVE_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '在职', value: '1' },
  { label: '离职', value: '0' },
]

const columns = [
  { title: '用户', key: 'user', width: 220, fixed: 'left' as const },
  { title: '邮箱', key: 'email', width: 220 },
  { title: '部门', key: 'dept', width: 240 },
  { title: '岗位', key: 'position', width: 150 },
  { title: '角色', key: 'roles', width: 200 },
  { title: '状态', key: 'isActive', width: 90 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' as const },
]

// ---- 列表 ----
const loading = ref(false)
const users = ref<UserItem[]>([])
const keyword = ref('')
const activeFilter = ref('all')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 人`,
}))

/** 部门路径「全球运营中心/C端产品部」→ 各级名称 */
function splitDept(path?: string | null): string[] {
  return (path || '').split('/').map(x => x.trim()).filter(Boolean)
}

function isActiveUser(u: UserItem) {
  return u.isActive === 1 || u.isActive === true
}

/** 姓名下方的副标题：工号 · 英文名（姓名缺失时工号已作为主标题，不再重复） */
function userSubLine(u: UserItem) {
  const account = u.coAccount || u.userCoAccount
  return [u.realName ? account : '', u.userEnName].filter(Boolean).join(' · ')
}

function initials(u: UserItem) {
  if (u.realName) return u.realName.slice(-2)
  const name = u.coAccount || u.userCoAccount || u.userEnName || '用'
  return name.slice(0, 1).toUpperCase()
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await queryUsers({
      keyword: keyword.value.trim(),
      isActive: activeFilter.value === 'all' ? undefined : Number(activeFilter.value),
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res?.success) {
      users.value = res.data?.list || []
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
  loadUsers()
}

/** 清空搜索框时立即刷新 */
function onKeywordChange() {
  if (!keyword.value) handleSearch()
}

function handleTableChange(p: TablePaginationConfig) {
  page.value = p.current || 1
  pageSize.value = p.pageSize || 20
  loadUsers()
}

// ---- 下拉数据：部门树 / 岗位 / 角色 ----
const orgTree = ref<OrganizationNode[]>([])
const roleOptions = ref<{ label: string; value: number; description?: string }[]>([])
const positionOptions = ref<{ label: string; value: number; orgId?: number; orgName?: string }[]>([])

/** 所选组织下的岗位排在前面并标注「本组织」 */
const sortedPositionOptions = computed(() => {
  const orgId = form.deptId != null ? Number(form.deptId) : undefined
  return positionOptions.value
    .map(o => ({ ...o, sameOrg: orgId != null && o.orgId === orgId }))
    .sort((a, b) => Number(b.sameOrg) - Number(a.sameOrg))
})

async function loadOptions() {
  const [orgRes, roleRes, posRes] = await Promise.allSettled([
    getOrganizationTree(),
    queryRoles({ page: 1, pageSize: 999, status: 1 }),
    queryPositions({ page: 1, pageSize: 999, status: 1 }),
  ])
  if (posRes.status === 'fulfilled' && posRes.value?.success) {
    positionOptions.value = (posRes.value.data?.list || []).map(p => ({
      label: p.positionName,
      value: p.id,
      orgId: p.organizationId,
      orgName: p.organizationPathName || p.organizationName,
    }))
  }
  if (orgRes.status === 'fulfilled' && orgRes.value?.success) orgTree.value = orgRes.value.data || []
  if (roleRes.status === 'fulfilled' && roleRes.value?.success) {
    roleOptions.value = (roleRes.value.data?.list || []).map(r => ({ label: r.roleName, value: r.id, description: r.description }))
  }
}

// ---- 新增 / 编辑 ----
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const emptyForm = (): Omit<UserSaveParams, 'id'> => ({
  realName: '',
  coAccount: '',
  email: '',
  userEnName: '',
  deptId: undefined,
  isActive: 1,
  positionId: undefined,
  roleIds: [],
  password: '',
})
const form = reactive(emptyForm())
const activeChecked = computed({
  get: () => form.isActive === 1,
  set: (v: boolean) => { form.isActive = v ? 1 : 0 },
})

const rules = computed<Record<string, Rule[]>>(() => ({
  realName: [{ required: true, whitespace: true, message: '请输入姓名' }],
  email: [
    { required: true, whitespace: true, message: '请输入邮箱' },
    { type: 'email', message: '邮箱格式不正确' },
  ],
  password: editingId.value ? [] : [
    { required: true, message: '请输入初始密码' },
    { min: 6, max: 32, message: '密码长度需为 6-32 位' },
  ],
}))

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  modalOpen.value = true
  loadOptions()
}

function openEdit(u: UserItem) {
  editingId.value = u.id ?? null
  Object.assign(form, {
    ...emptyForm(),
    realName: u.realName || '',
    coAccount: u.coAccount || u.userCoAccount || '',
    email: u.email || '',
    userEnName: u.userEnName || '',
    deptId: u.deptId ? (Number.isNaN(Number(u.deptId)) ? u.deptId : Number(u.deptId)) : undefined,
    isActive: isActiveUser(u) ? 1 : 0,
    positionId: u.positionId ?? undefined,
    roleIds: [...(u.roleIds || [])],
  })
  modalOpen.value = true
  loadOptions()
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload: UserSaveParams = {
      ...form,
      realName: form.realName.trim(),
      coAccount: undefined,
      email: form.email.trim(),
      userEnName: form.userEnName?.trim() || undefined,
      deptId: form.deptId != null ? String(form.deptId) : undefined,
      password: editingId.value ? undefined : form.password,
    }
    const res = editingId.value
      ? await updateUser({ ...payload, id: editingId.value })
      : await createUser(payload)
    if (res?.success) {
      modalOpen.value = false
      if (!editingId.value) page.value = 1
      loadUsers()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---- 删除 ----
function confirmDelete(u: UserItem) {
  if (u.id == null) return
  const id = u.id
  Modal.confirm({
    title: `删除用户「${u.realName || u.coAccount || u.userCoAccount || u.email}」？`,
    content: '删除后该用户将无法登录，且不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteUser(id)
        if (res?.success) {
          // 删除当前页最后一条时回到上一页
          if (users.value.length === 1 && page.value > 1) page.value--
          loadUsers()
        }
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

onMounted(loadUsers)
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

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.user-avatar {
  flex-shrink: 0;
  font-weight: 600;
  background: linear-gradient(135deg, var(--c-primary), #5e5ce6);
}

.user-cell-text {
  min-width: 0;
}

.user-cell-name {
  font-weight: 500;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-cell-sub {
  font-size: 12px;
  color: #86868b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-muted {
  color: #6e6e73;
}

/* 工号只读：系统生成，弱化为灰色背景 */
.readonly-input,
.readonly-input:hover {
  color: #3a3a3c;
  background: #f5f5f7;
  border-color: transparent;
  cursor: default;
}

.dept-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dept-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 12px;
  color: #30b0c7;
  background: #e8f7fa;
}

.dept-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}

.dept-name {
  font-weight: 500;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dept-path {
  font-size: 12px;
  color: #aeaeb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.position-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  color: #c93400;
  background: #fff4e5;
  border-radius: 999px;
}

.position-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.soft-tag {
  margin: 2px 4px 2px 0;
  color: var(--c-primary);
  background: var(--c-primary-bg);
  border: none;
  border-radius: 6px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.status-pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill.on {
  color: #248a3d;
}

.status-pill.on::before {
  background: #34c759;
}

.status-pill.off {
  color: #8e8e93;
}

.status-pill.off::before {
  background: #c7c7cc;
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

<style>
/* 角色下拉 */
.role-select-popup {
  padding: 6px !important;
  border-radius: 12px !important;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06) !important;
}

.role-select-popup .ant-select-item-option {
  min-height: 40px;
  margin-bottom: 2px;
  padding: 4px 10px;
  border-radius: 8px;
  align-items: center;
}

.role-select-popup .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: #f5f5f7;
}

.role-select-popup .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  background: #f3f2ff;
}

.role-select-popup .ant-select-item-option-selected .role-option-name {
  font-weight: 600;
  color: #5e5ce6;
}

.role-select-popup .ant-select-item-option-state {
  display: flex;
  align-items: center;
  color: #5e5ce6;
}

.role-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.role-option-avatar {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 12px;
  color: #fff;
  background: #5e5ce6;
}

.role-option-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}

.role-option-name {
  font-size: 13px;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-option-desc {
  font-size: 12px;
  color: #86868b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-option-empty {
  padding: 16px 8px;
  font-size: 13px;
  text-align: center;
  color: #86868b;
}

/* 岗位下拉：沿用角色下拉样式，主色换成橙色 */
.position-option-avatar {
  background: #ff9f0a;
}

.position-option-hint {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  color: #c93400;
  background: #fff4e5;
  border-radius: 999px;
}

.position-select-popup .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  background: #fff4e5;
}

.position-select-popup .ant-select-item-option-selected .role-option-name {
  color: #c93400;
}

/* 已选角色胶囊 */
.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 180px;
  height: 24px;
  margin: 2px 4px 2px 0;
  padding: 0 6px 0 8px;
  font-size: 12px;
  color: #5e5ce6;
  background: #f3f2ff;
  border-radius: 999px;
}

.role-tag-icon {
  font-size: 11px;
}

.role-tag-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-tag-close {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: #8e8cf0;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.role-tag-close:hover {
  color: #fff;
  background: #5e5ce6;
}

/* 超出 maxTagCount 的「+N」胶囊 */
.role-select .ant-select-selection-overflow-item-rest .ant-select-selection-item {
  height: 24px;
  margin: 2px 0;
  padding: 0 8px;
  font-size: 12px;
  line-height: 22px;
  color: #6e6e73;
  background: #f2f2f5;
  border: none;
  border-radius: 999px;
}

</style>
