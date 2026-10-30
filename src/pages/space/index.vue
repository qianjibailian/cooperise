<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <h2 class="mgmt-title">空间</h2>
      <a-button type="primary" class="mgmt-create-btn" @click="openCreate">
        <PlusOutlined /> 新建空间
      </a-button>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索空间名称 / 编码"
          allow-clear
          class="mgmt-search"
          @press-enter="handleSearch"
          @change="onKeywordChange"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <OrgTreeSelect
          v-model="orgFilter"
          :tree-data="orgTree"
          placeholder="全部组织"
          class="org-filter"
          @update:model-value="handleSearch"
        />
        <a-segmented v-model:value="statusFilter" :options="STATUS_FILTERS" @change="handleSearch" />
        <a-tooltip title="刷新">
          <button class="mgmt-icon-btn" :disabled="loading" @click="loadSpaces"><ReloadOutlined /></button>
        </a-tooltip>
      </div>

      <a-table
        :columns="columns"
        :data-source="spaces"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 1290 }"
        class="mgmt-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'space'">
            <div class="space-cell">
              <span class="space-avatar" :style="{ background: record.color || DEFAULT_COLOR }">{{ avatarText(record.spaceName) }}</span>
              <span class="space-name">{{ record.spaceName }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'spaceKey'">
            <span v-if="record.spaceKey" class="key-chip">{{ record.spaceKey }}</span>
            <span v-else class="text-muted">-</span>
          </template>
          <template v-else-if="column.key === 'spaceCode'">
            <span class="code-chip">{{ record.spaceCode || '-' }}</span>
          </template>
          <template v-else-if="column.key === 'organization'">
            <a-tooltip v-if="orgLabelOf(record as SpaceItem)" :title="record.organizationPathName || orgLabelOf(record as SpaceItem)" placement="topLeft" :mouse-enter-delay="0.3">
              <span class="org-chip"><ApartmentOutlined /><span class="ellipsis">{{ orgLabelOf(record as SpaceItem) }}</span></span>
            </a-tooltip>
            <span v-else class="text-muted">-</span>
          </template>
          <template v-else-if="column.key === 'owner'">
            <span v-if="record.ownerMemberId" class="user-cell">
              <a-avatar :size="22" class="user-avatar">{{ avatarText(record.ownerName || record.ownerMemberId) }}</a-avatar>
              <span class="ellipsis">{{ record.ownerName || record.ownerMemberId }}</span>
            </span>
            <span v-else class="text-muted">-</span>
          </template>
          <template v-else-if="column.key === 'description'">
            <a-tooltip :title="record.description" placement="topLeft">
              <span class="ellipsis text-muted">{{ record.description || '-' }}</span>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'updateTime'">
            <span class="text-muted">{{ formatTime(record.updateTime) }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              size="small"
              :checked="record.status === 1"
              :loading="togglingId === record.id"
              @change="(v: boolean) => toggleStatus(record as SpaceItem, v)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-tooltip title="编辑">
                <span class="row-action" @click="openEdit(record as SpaceItem)"><EditOutlined /></span>
              </a-tooltip>
              <a-tooltip title="删除">
                <span class="row-action danger" @click="confirmDelete(record as SpaceItem)"><DeleteOutlined /></span>
              </a-tooltip>
              <button type="button" class="enter-btn" @click="enterSpace(record as SpaceItem)">进入空间 <RightOutlined /></button>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新建 / 编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑空间' : '新建空间'"
      :width="520"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="空间名称" name="spaceName">
          <a-input v-model:value="form.spaceName" placeholder="如 研发协作空间" :maxlength="128" />
        </a-form-item>
        <!-- 空间标识用于生成问题单号，保存后不可修改，避免历史单号前缀不一致 -->
        <a-form-item label="空间标识" name="spaceKey" :extra="keyLocked ? '空间标识已用于生成问题单号，不可修改' : `问题单号前缀，最多 5 位大写字母，如 ${form.spaceKey || 'RD'}-000042`">
          <a-input
            :value="form.spaceKey"
            placeholder="如 RD"
            :maxlength="5"
            :disabled="keyLocked"
            @update:value="(v: string) => (form.spaceKey = v.toUpperCase().replace(/[^A-Z]/g, ''))"
          />
        </a-form-item>
        <!-- 空间编码由后端自动生成：新建不展示，编辑时只读 -->
        <a-form-item v-if="editingId" label="空间编码">
          <a-input :value="editingCode" disabled />
        </a-form-item>
        <a-form-item label="所属组织" name="organizationId">
          <OrgTreeSelect v-model="form.organizationId" :tree-data="orgTree" />
        </a-form-item>
        <a-form-item label="负责人" name="ownerMemberId">
          <a-select
            v-model:value="form.ownerMemberId"
            show-search
            allow-clear
            :filter-option="false"
            :options="userOptions"
            :loading="userLoading"
            placeholder="搜索并选择负责人（选填）"
            @search="searchUsers"
            @dropdown-visible-change="(o: boolean) => o && ensureUsers()"
          />
        </a-form-item>
        <a-form-item label="颜色" name="color">
          <div class="color-swatches">
            <button
              v-for="c in COLOR_OPTIONS"
              :key="c"
              type="button"
              :class="['color-swatch', { active: form.color === c }]"
              :style="{ background: c }"
              :aria-label="c"
              @click="form.color = c"
            >
              <CheckOutlined v-if="form.color === c" />
            </button>
            <span class="color-preview" :style="{ background: form.color }">{{ avatarText(form.spaceName) || '空' }}</span>
          </div>
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="form.description" placeholder="空间用途说明（选填）" :maxlength="500" :auto-size="{ minRows: 2, maxRows: 4 }" show-count />
        </a-form-item>
        <a-form-item label="启用" name="status">
          <a-switch v-model:checked="statusChecked" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { personLabel } from '@/utils/person'
import { Modal, type FormInstance, type TablePaginationConfig } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { useRouter } from 'vue-router'
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined, CheckOutlined, RightOutlined } from '@ant-design/icons-vue'
import {
  querySpaces, createSpace, updateSpace, deleteSpace, getOrganizationTree, queryUsers,
  type SpaceItem, type SpaceSaveParams, type OrganizationNode,
} from '@/api/faiz'
import type { UserItem } from '@/types/faiz'
import OrgTreeSelect from '@/components/OrgTreeSelect.vue'
import { findOrgCode, findOrgIdByCode } from '@/utils/orgTree'
import { useSpaces } from '@/utils/space-store'

/** 空间颜色候选（与问题类型一致，Apple 系统色） */
const COLOR_OPTIONS = ['#0A84FF', '#5E5CE6', '#AF52DE', '#FF375F', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#30B0C7', '#8E8E93']
const DEFAULT_COLOR = COLOR_OPTIONS[0]

const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]

const columns = [
  { title: '空间', key: 'space', width: 220, fixed: 'left' as const },
  { title: '标识', key: 'spaceKey', width: 90 },
  { title: '编码', key: 'spaceCode', width: 130 },
  { title: '所属组织', key: 'organization', width: 180 },
  { title: '负责人', key: 'owner', width: 140 },
  { title: '描述', key: 'description', ellipsis: true },
  { title: '更新时间', key: 'updateTime', width: 160 },
  { title: '启用', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 190, fixed: 'right' as const },
]

/** 头像文字：取名称首字（英文取前两位大写） */
function avatarText(name?: string) {
  const s = (name || '').trim()
  if (!s) return ''
  return /^[a-zA-Z]/.test(s) ? s.slice(0, 2).toUpperCase() : s.slice(0, 1)
}

/** 后端 LocalDateTime（ISO 字符串）→ YYYY-MM-DD HH:mm */
function formatTime(v?: string | null): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ---- 组织树（筛选 / 表单共用） ----
const orgTree = ref<OrganizationNode[]>([])
async function loadOrgTree() {
  try {
    const res = await getOrganizationTree()
    if (res?.success) orgTree.value = res.data || []
  } catch {
    // 请求层已统一提示
  }
}
/** 按组织编码在树中取名称（接口未返回 organizationName 时兜底） */
function orgNameOf(code?: string): string {
  if (!code) return ''
  const walk = (nodes: OrganizationNode[]): string => {
    for (const n of nodes) {
      if (n.organizationCode === code) return n.organizationName
      const hit = n.children?.length ? walk(n.children) : ''
      if (hit) return hit
    }
    return ''
  }
  return walk(orgTree.value)
}
function orgLabelOf(r: SpaceItem) {
  return r.organizationName || orgNameOf(r.organizationCode)
}

/** 空间变更后刷新共享缓存（问题类型 / 模板 / 工作流的空间下拉与回显） */
const { ensureLoaded: ensureSpaceCache } = useSpaces()
function refreshSpaceCache() {
  ensureSpaceCache(true)
}

// ---- 列表 ----
const loading = ref(false)
const spaces = ref<SpaceItem[]>([])
const keyword = ref('')
const statusFilter = ref('all')
const orgFilter = ref<number | undefined>()
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 个空间`,
}))

async function loadSpaces() {
  loading.value = true
  try {
    const res = await querySpaces({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : Number(statusFilter.value),
      organizationId: orgFilter.value,
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res?.success) {
      spaces.value = res.data?.list || []
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
  loadSpaces()
}

/** 清空搜索框时立即刷新 */
function onKeywordChange() {
  if (!keyword.value) handleSearch()
}

function handleTableChange(p: TablePaginationConfig) {
  page.value = p.current || 1
  pageSize.value = p.pageSize || 20
  loadSpaces()
}

/** 空间 → 保存入参（列表快捷启停用：原样回传其余字段） */
function toSaveParams(r: SpaceItem): SpaceSaveParams {
  return {
    id: r.id,
    spaceName: r.spaceName,
    spaceKey: r.spaceKey || '',
    organizationCode: r.organizationCode ?? findOrgCode(orgTree.value, r.organizationId),
    ownerMemberId: r.ownerMemberId,
    color: r.color,
    description: r.description,
    sort: r.sort,
    status: r.status,
  }
}

/** 列表内快捷启用 / 停用 */
const togglingId = ref<number | null>(null)
async function toggleStatus(r: SpaceItem, checked: boolean) {
  togglingId.value = r.id
  try {
    const res = await updateSpace({ ...toSaveParams(r), status: checked ? 1 : 0 })
    if (res?.success) {
      r.status = checked ? 1 : 0
      refreshSpaceCache()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    togglingId.value = null
  }
}

// ---- 负责人选择（远程搜索，按 memberId 关联） ----
const userLoading = ref(false)
/** memberId → 展示名，保证已选用户在搜索结果变化后仍能回显 */
const userNameMap = reactive<Record<string, string>>({})
const userResult = ref<string[]>([])
const userOptions = computed(() => {
  const ids = [...new Set([...userResult.value, ...(form.ownerMemberId ? [form.ownerMemberId] : [])])]
  return ids.map(id => ({ value: id, label: userNameMap[id] || id }))
})
/** 用户编号：新接口 memberId，旧接口 userNo */
function memberIdOf(u: UserItem) {
  return u.memberId || u.userNo
}
/** 人员展示：realName（coAccount） */
function userLabel(u: UserItem) {
  return personLabel(u as unknown as Record<string, unknown>) || String(memberIdOf(u) ?? '')
}
let userSeq = 0
let userTimer: ReturnType<typeof setTimeout> | undefined
async function fetchUsers(kw: string) {
  const seq = ++userSeq
  userLoading.value = true
  try {
    const res = await queryUsers({ keyword: kw, isActive: 1, page: 1, pageSize: 50 })
    if (seq !== userSeq || !res?.success) return
    const list = res.data?.list || []
    for (const u of list) userNameMap[memberIdOf(u)] = userLabel(u)
    userResult.value = list.map(memberIdOf).filter(Boolean)
  } catch {
    // 请求层已统一提示
  } finally {
    if (seq === userSeq) userLoading.value = false
  }
}
function searchUsers(kw: string) {
  clearTimeout(userTimer)
  userTimer = setTimeout(() => fetchUsers(kw.trim()), 300)
}
/** 下拉首次展开时拉取默认用户列表 */
function ensureUsers() {
  if (!userResult.value.length && !userLoading.value) fetchUsers('')
}

// ---- 新建 / 编辑 ----
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
/** 编辑中空间的编码（只读展示） */
const editingCode = ref('')
/** 已保存过标识的空间不可再改标识（历史空间无标识时允许补填） */
const keyLocked = ref(false)
/** 表单内组织用 ID 选择（组织树），提交时换算成组织编码 organizationCode */
const emptyForm = () => ({
  spaceName: '',
  spaceKey: '',
  organizationId: undefined as number | undefined,
  ownerMemberId: undefined as string | undefined,
  color: DEFAULT_COLOR,
  description: '',
  sort: undefined as number | undefined,
  status: 1,
})
const form = reactive(emptyForm())
const statusChecked = computed({
  get: () => form.status === 1,
  set: (v: boolean) => { form.status = v ? 1 : 0 },
})

const rules: Record<string, Rule[]> = {
  spaceName: [{ required: true, whitespace: true, message: '请输入空间名称' }],
  spaceKey: [
    { required: true, message: '请输入空间标识' },
    { pattern: /^[A-Z]{1,5}$/, message: '最多 5 位大写字母' },
  ],
  organizationId: [{ required: true, type: 'number', message: '请选择所属组织' }],
}

function openCreate() {
  editingId.value = null
  keyLocked.value = false
  Object.assign(form, emptyForm())
  modalOpen.value = true
}

function openEdit(r: SpaceItem) {
  editingId.value = r.id
  editingCode.value = r.spaceCode
  keyLocked.value = !!r.spaceKey
  if (r.ownerMemberId && r.ownerName && !userNameMap[r.ownerMemberId]) userNameMap[r.ownerMemberId] = r.ownerName
  Object.assign(form, {
    spaceName: r.spaceName ?? '',
    spaceKey: r.spaceKey ?? '',
    organizationId: r.organizationId ?? findOrgIdByCode(orgTree.value, r.organizationCode),
    ownerMemberId: r.ownerMemberId || undefined,
    color: r.color || DEFAULT_COLOR,
    description: r.description ?? '',
    sort: r.sort,
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
    const payload: SpaceSaveParams = {
      spaceName: form.spaceName.trim(),
      spaceKey: form.spaceKey,
      organizationCode: findOrgCode(orgTree.value, form.organizationId),
      // 允许清空负责人：传空串，后端置空
      ownerMemberId: form.ownerMemberId || '',
      color: form.color,
      description: form.description.trim(),
      sort: form.sort,
      status: form.status,
    }
    const res = editingId.value
      ? await updateSpace({ ...payload, id: editingId.value })
      : await createSpace(payload)
    if (res?.success) {
      modalOpen.value = false
      refreshSpaceCache()
      if (!editingId.value) page.value = 1
      loadSpaces()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---- 进入空间 ----
const router = useRouter()
function enterSpace(r: SpaceItem) {
  router.push({ name: 'SpaceHome', params: { spaceCode: r.spaceCode } })
}

// ---- 删除 ----
function confirmDelete(r: SpaceItem) {
  Modal.confirm({
    title: `删除空间「${r.spaceName}」？`,
    content: '删除后空间内的成员关系将被移除，且不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteSpace(r.id)
        if (res?.success) {
          refreshSpaceCache()
          if (spaces.value.length === 1 && page.value > 1) page.value--
          loadSpaces()
        }
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

onMounted(() => {
  loadSpaces()
  loadOrgTree()
})
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
  box-shadow: 0 2px 8px rgba(10, 132, 255, 0.24);
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

.org-filter {
  width: 200px;
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

.space-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.space-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.space-name {
  font-weight: 500;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.key-chip {
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #0a84ff;
  background: #eef5ff;
  border-radius: 6px;
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

.org-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  color: #30b0c7;
  background: #e8f7fa;
  border-radius: 999px;
}

.org-chip .ellipsis {
  color: #1d1d1f;
}

.user-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
}

.user-avatar {
  flex-shrink: 0;
  font-size: 11px;
  background: #0a84ff;
}

.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 11px;
  color: #fff;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s;
}

.color-swatch:hover {
  transform: scale(1.12);
}

.color-swatch.active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(0, 0, 0, 0.12);
}

.color-preview {
  margin-left: auto;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.row-actions {
  display: inline-flex;
  align-items: center;
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

.enter-btn {
  height: 28px;
  margin-left: 6px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #0a84ff;
  background: #eef5ff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.enter-btn:hover {
  background: #dcebff;
}

.enter-btn :deep(.anticon) {
  font-size: 10px;
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
