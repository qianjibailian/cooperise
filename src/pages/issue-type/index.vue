<template>
  <div :class="['mgmt-page', { embedded: !!props.spaceCode }]">
    <header class="mgmt-header">
      <h2 class="mgmt-title">{{ props.spaceCode ? '' : '问题类型' }}</h2>
      <a-button type="primary" class="mgmt-create-btn" @click="openCreate">
        <PlusOutlined /> 新增
      </a-button>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索问题类型名称 / 编码"
          allow-clear
          class="mgmt-search"
          @press-enter="handleSearch"
          @change="onKeywordChange"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <a-segmented v-model:value="statusFilter" :options="STATUS_FILTERS" @change="handleSearch" />
        <a-tooltip title="刷新">
          <button class="mgmt-icon-btn" :disabled="loading" @click="loadIssueTypes"><ReloadOutlined /></button>
        </a-tooltip>
      </div>

      <a-table
        :columns="visibleColumns"
        :data-source="issueTypes"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 1300 }"
        class="mgmt-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'issueType'">
            <div class="type-cell">
              <span class="type-avatar" :style="{ background: record.color || DEFAULT_COLOR }"><component :is="issueTypeIconOf(record.iconUri)" /></span>
              <span class="type-name">{{ record.issueTypeName }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'issueTypeCode'">
            <span v-if="record.issueTypeCode" class="code-chip">{{ record.issueTypeCode }}</span>
            <span v-else class="text-muted">-</span>
          </template>
          <template v-else-if="column.key === 'space'">
            <SpaceTag :code="record.spaceCode" :name="record.spaceName" />
          </template>
          <template v-else-if="column.key === 'description'">
            <a-tooltip :title="record.description" placement="topLeft">
              <span class="ellipsis text-muted">{{ record.description || '-' }}</span>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'issueCount'">
            <span class="text-muted">{{ record.issueCount ?? '-' }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              size="small"
              :checked="record.status === 1"
              :loading="togglingId === record.id"
              @change="(v: boolean) => toggleStatus(record as IssueTypeItem, v)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-tooltip title="编辑">
                <span class="row-action" @click="openEdit(record as IssueTypeItem)"><EditOutlined /></span>
              </a-tooltip>
              <a-tooltip title="问题状态">
                <span class="row-action" @click="openStatusDrawer(record as IssueTypeItem)"><FlagOutlined /></span>
              </a-tooltip>
              <a-tooltip title="删除">
                <span class="row-action danger" @click="confirmDelete(record as IssueTypeItem)"><DeleteOutlined /></span>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑问题类型' : '新增问题类型'"
      :width="880"
      class="modal-landscape"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="问题类型名称" name="issueTypeName">
          <a-input v-model:value="form.issueTypeName" placeholder="如 需求 / 缺陷" :maxlength="32" />
        </a-form-item>
        <!-- 空间内管理时空间固定为当前空间，不再选择 -->
        <a-form-item v-if="!props.spaceCode" label="所属空间" name="spaceCode">
          <SpaceSelect v-model="form.spaceCode" size="middle" />
        </a-form-item>
        <a-form-item label="图标" name="iconUri">
          <div class="icon-options">
            <a-tooltip v-for="it in ISSUE_TYPE_ICONS" :key="it.key" :title="it.label">
              <button
                type="button"
                :class="['icon-option', { active: form.iconUri === it.key }]"
                :style="form.iconUri === it.key ? { background: form.color, borderColor: form.color } : undefined"
                :aria-label="it.label"
                @click="form.iconUri = it.key"
              >
                <component :is="it.icon" />
              </button>
            </a-tooltip>
          </div>
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
            <span class="color-preview">
              <span class="color-preview-icon" :style="{ background: form.color }"><component :is="issueTypeIconOf(form.iconUri)" /></span>
              {{ form.issueTypeName || '预览' }}
            </span>
          </div>
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="form.description" placeholder="选填" :rows="2" :maxlength="200" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-switch v-model:checked="statusChecked" checked-children="启用" un-checked-children="停用" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 问题状态维护 -->
    <a-drawer
      v-model:open="statusDrawerOpen"
      :width="560"
      destroy-on-close
      class="status-drawer"
    >
      <template #title>
        <div class="status-drawer-title">
          <span class="type-avatar sm" :style="{ background: statusType?.color || DEFAULT_COLOR }"><component :is="issueTypeIconOf(statusType?.iconUri)" /></span>
          <span>{{ statusType?.issueTypeName }} · 问题状态</span>
        </div>
      </template>
      <a-spin :spinning="statusLoading">
        <div class="status-drawer-hint">
          按流转顺序排列，可上下调整。
          <span v-if="statusIsDefault" class="status-default-tip">尚未配置，已预填默认状态</span>
        </div>
        <div class="status-editor">
          <div v-for="(st, idx) in statusRows" :key="st._key" class="status-row">
            <a-popover trigger="click" placement="bottomLeft" overlay-class-name="status-color-popover">
              <template #content>
                <div class="status-color-grid">
                  <button
                    v-for="c in STATUS_COLOR_OPTIONS"
                    :key="c"
                    type="button"
                    :class="['color-swatch', { active: st.color === c }]"
                    :style="{ background: c }"
                    :aria-label="c"
                    @click="st.color = c"
                  >
                    <CheckOutlined v-if="st.color === c" />
                  </button>
                </div>
              </template>
              <button type="button" class="status-color-btn" :aria-label="'选择颜色'">
                <span class="status-dot lg" :style="{ background: st.color }" />
              </button>
            </a-popover>
            <a-input v-model:value="st.statusName" placeholder="状态名称" :maxlength="20" class="status-name-input" />
            <div class="status-row-actions">
              <button type="button" class="status-icon-btn" :disabled="idx === 0" aria-label="上移" @click="moveStatus(idx, -1)"><ArrowUpOutlined /></button>
              <button type="button" class="status-icon-btn" :disabled="idx === statusRows.length - 1" aria-label="下移" @click="moveStatus(idx, 1)"><ArrowDownOutlined /></button>
              <button type="button" class="status-icon-btn danger" :disabled="statusRows.length <= 1" aria-label="删除" @click="removeStatus(idx)"><DeleteOutlined /></button>
            </div>
          </div>
          <button type="button" class="status-add-btn" @click="addStatus"><PlusOutlined /> 添加状态</button>
        </div>
        <div v-if="statusError" class="status-error">{{ statusError }}</div>
      </a-spin>
      <template #footer>
        <div class="status-drawer-footer">
          <a-button @click="statusDrawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="statusSaving" :disabled="statusLoading" @click="saveStatuses">保存</a-button>
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, type FormInstance, type TablePaginationConfig } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, CheckOutlined, ArrowUpOutlined, ArrowDownOutlined, FlagOutlined } from '@ant-design/icons-vue'
import {
  queryIssueTypes, createIssueType, updateIssueType, deleteIssueType,
  queryIssueTypeStatuses, saveIssueTypeStatuses,
  type IssueTypeItem, type IssueTypeSaveParams, type IssueTypeStatus,
} from '@/api/faiz'
import SpaceSelect from '@/components/SpaceSelect.vue'
import SpaceTag from '@/components/SpaceTag.vue'
import { useSpaces } from '@/utils/space-store'
import { ISSUE_TYPE_ICONS, DEFAULT_ISSUE_TYPE_ICON, issueTypeIconOf } from '@/utils/issueTypeIcons'

/** 图标颜色候选（Apple 系统色） */
const COLOR_OPTIONS = ['#0A84FF', '#5E5CE6', '#AF52DE', '#FF375F', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#30B0C7', '#8E8E93']
const DEFAULT_COLOR = COLOR_OPTIONS[0]

/** 问题状态颜色 */
const STATUS_COLOR_OPTIONS = ['#8E8E93', '#0A84FF', '#5E5CE6', '#AF52DE', '#FF9500', '#FFCC00', '#34C759', '#30B0C7', '#FF375F', '#FF3B30']

/** 表单内的状态行（_key 仅用于列表渲染） */
type StatusRow = IssueTypeStatus & { _key: number; color: string }
let statusKeySeq = 0
function toStatusRow(s: Partial<IssueTypeStatus>): StatusRow {
  return {
    id: s.id,
    statusName: s.statusName ?? '',
    statusCode: s.statusCode,
    color: s.color || '#0A84FF',
    sort: s.sort,
    _key: ++statusKeySeq,
  }
}
/** 新建问题类型时的默认状态 */
function defaultStatuses(): StatusRow[] {
  return [
    toStatusRow({ statusName: '待处理', color: '#8E8E93' }),
    toStatusRow({ statusName: '处理中', color: '#0A84FF' }),
    toStatusRow({ statusName: '已完成', color: '#34C759' }),
  ]
}

const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]

const columns = [
  { title: '问题类型', key: 'issueType', width: 200, fixed: 'left' as const },
  { title: '编码', key: 'issueTypeCode', width: 160 },
  { title: '所属空间', key: 'space', width: 200 },
  { title: '描述', key: 'description', ellipsis: true },
  { title: '事项数', key: 'issueCount', width: 90 },
  { title: '启用', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 130, fixed: 'right' as const },
]

const { spaceNameOf, orgCodeOfSpace } = useSpaces()

/** 在空间内管理（空间首页嵌入）时传入：列表只看该空间，新增 / 编辑固定归属该空间 */
const props = defineProps<{ spaceCode?: string }>()
const visibleColumns = computed(() => props.spaceCode ? columns.filter(c => c.key !== 'space') : columns)

// ---- 列表 ----
const loading = ref(false)
const issueTypes = ref<IssueTypeItem[]>([])
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
  showTotal: (t: number) => `共 ${t} 个问题类型`,
}))

async function loadIssueTypes() {
  loading.value = true
  try {
    const res = await queryIssueTypes({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : Number(statusFilter.value),
      spaceCode: props.spaceCode,
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res?.success) {
      const list = res.data?.list || []
      // 后端按 spaceCode 筛选就绪前兜底：只排除明确属于其他空间的数据，未关联空间的历史数据照常展示
      issueTypes.value = props.spaceCode ? list.filter(t => !t.spaceCode || t.spaceCode === props.spaceCode) : list
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
  loadIssueTypes()
}

/** 清空搜索框时立即刷新 */
function onKeywordChange() {
  if (!keyword.value) handleSearch()
}

function handleTableChange(p: TablePaginationConfig) {
  page.value = p.current || 1
  pageSize.value = p.pageSize || 20
  loadIssueTypes()
}

/** 列表内快捷启用 / 停用 */
const togglingId = ref<number | null>(null)
async function toggleStatus(r: IssueTypeItem, checked: boolean) {
  togglingId.value = r.id
  try {
    const res = await updateIssueType({
      id: r.id,
      issueTypeName: r.issueTypeName,
      organizationCode: r.organizationCode ?? await orgCodeOfSpace(r.spaceCode),
      spaceCode: r.spaceCode,
      spaceName: r.spaceName || spaceNameOf(r.spaceCode) || undefined,
      color: r.color,
      iconUri: r.iconUri,
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
/** 编辑中记录的原组织编码：所属空间未关联组织时兜底 */
const editingOrgCode = ref<string | undefined>()
/** 不单独选组织：提交时取所属空间的组织编码 */
const emptyForm = (): Omit<IssueTypeSaveParams, 'id' | 'organizationCode'> & { description: string; sort: number } => ({
  issueTypeName: '',
  spaceCode: undefined as string | undefined,
  color: DEFAULT_COLOR,
  iconUri: DEFAULT_ISSUE_TYPE_ICON as string | null,
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
  issueTypeName: [{ required: true, whitespace: true, message: '请输入问题类型名称' }],
  spaceCode: [{ required: true, message: '请选择所属空间' }],
}

// ---- 问题状态抽屉 ----
const statusDrawerOpen = ref(false)
const statusType = ref<IssueTypeItem | null>(null)
const statusRows = ref<StatusRow[]>([])
const statusLoading = ref(false)
const statusSaving = ref(false)
const statusIsDefault = ref(false)
const statusError = ref('')

async function openStatusDrawer(r: IssueTypeItem) {
  statusType.value = r
  statusRows.value = []
  statusIsDefault.value = false
  statusError.value = ''
  statusDrawerOpen.value = true
  statusLoading.value = true
  try {
    const res = await queryIssueTypeStatuses(r.issueTypeCode || '')
    const list = res?.success ? res.data || [] : []
    statusRows.value = list.length ? list.map(toStatusRow) : defaultStatuses()
    statusIsDefault.value = !list.length
  } catch {
    statusRows.value = defaultStatuses()
    statusIsDefault.value = true
  } finally {
    statusLoading.value = false
  }
}

function addStatus() {
  statusRows.value.push(toStatusRow({ statusName: '' }))
}
function removeStatus(idx: number) {
  statusRows.value.splice(idx, 1)
}
function moveStatus(idx: number, delta: number) {
  const to = idx + delta
  if (to < 0 || to >= statusRows.value.length) return
  const [row] = statusRows.value.splice(idx, 1)
  statusRows.value.splice(to, 0, row)
}

function validateStatuses(): string {
  const names = statusRows.value.map(s => s.statusName.trim())
  if (!names.length) return '请至少添加一个状态'
  if (names.some(n => !n)) return '请填写所有状态名称'
  if (new Set(names).size !== names.length) return '状态名称不能重复'
  return ''
}

async function saveStatuses() {
  if (!statusType.value) return
  statusError.value = validateStatuses()
  if (statusError.value) return
  statusSaving.value = true
  try {
    const res = await saveIssueTypeStatuses({ issueTypeCode: statusType.value.issueTypeCode || '', statuses: serializeStatuses(statusRows.value) })
    if (res?.success) statusDrawerOpen.value = false
  } catch {
    // 请求层已统一提示
  } finally {
    statusSaving.value = false
  }
}

/** 提交用：去掉渲染 key，按顺序写入 sort */
function serializeStatuses(rows: Partial<IssueTypeStatus>[]): IssueTypeStatus[] {
  return rows.map((s, i) => ({
    id: s.id,
    statusName: (s.statusName ?? '').trim(),
    color: s.color,
    sort: i + 1,
  }))
}

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm(), { spaceCode: props.spaceCode })
  modalOpen.value = true
}

function openEdit(r: IssueTypeItem) {
  editingId.value = r.id
  editingOrgCode.value = r.organizationCode
  Object.assign(form, {
    issueTypeName: r.issueTypeName ?? '',
    spaceCode: r.spaceCode || props.spaceCode,
    color: r.color || DEFAULT_COLOR,
    iconUri: r.iconUri || DEFAULT_ISSUE_TYPE_ICON,
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
    const payload: IssueTypeSaveParams = {
      ...form,
      organizationCode: (await orgCodeOfSpace(form.spaceCode)) ?? (editingId.value ? editingOrgCode.value : undefined),
      spaceName: spaceNameOf(form.spaceCode) || undefined,
      issueTypeName: form.issueTypeName.trim(),
      // 始终提交描述（清空时传空串），否则后端无法清空已有描述
      description: form.description.trim(),
      sort: editingId.value ? form.sort : undefined,
    }
    const res = editingId.value
      ? await updateIssueType({ ...payload, id: editingId.value })
      : await createIssueType(payload)
    if (res?.success) {
      modalOpen.value = false
      if (!editingId.value) page.value = 1
      loadIssueTypes()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---- 删除 ----
function confirmDelete(r: IssueTypeItem) {
  Modal.confirm({
    title: `删除问题类型「${r.issueTypeName}」？`,
    content: r.issueCount ? `已有 ${r.issueCount} 个事项使用该问题类型，删除后可能影响这些事项的展示。` : '删除后不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteIssueType(r.id)
        if (res?.success) {
          if (issueTypes.value.length === 1 && page.value > 1) page.value--
          loadIssueTypes()
        }
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

onMounted(() => {
  loadIssueTypes()
})
</script>

<style scoped>
.mgmt-page {
  padding: 20px 24px 32px;
}

.mgmt-page.embedded {
  padding: 0;
}

.mgmt-page.embedded .mgmt-card {
  padding: 0;
  border: none;
  box-shadow: none;
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

.type-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.type-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
  background: #ff9f0a;
}

.type-name {
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

.icon-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.icon-option {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 15px;
  color: #3a3a3c;
  background: #f5f5f7;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

.icon-option:hover {
  background: #e8e8ed;
  transform: scale(1.06);
}

.icon-option.active {
  color: #fff;
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
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.15s, box-shadow 0.15s;
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(15, 23, 42, 0.18);
}

.color-preview {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 2px 10px 2px 4px;
  font-size: 12px;
  color: #3a3a3c;
  background: #f5f5f7;
  border-radius: 999px;
}

.color-preview-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
  border-radius: 6px;
}




.status-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
}

.status-dot.lg {
  width: 12px;
  height: 12px;
}


.status-drawer-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.type-avatar.sm {
  width: 24px;
  height: 24px;
  font-size: 12px;
  border-radius: 7px;
}

.status-drawer-hint {
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 20px;
  color: #8e8e93;
}

.status-default-tip {
  margin-left: 6px;
  padding: 0 6px;
  color: #c93400;
  background: #fff4e5;
  border-radius: 6px;
}

.status-error {
  margin-top: 8px;
  font-size: 12px;
  color: #ff3b30;
}

.status-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.status-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: #fafafc;
  border: 1px solid #eef0f3;
  border-radius: 12px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-color-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: #fff;
  border: 1px solid #e5e5ea;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.status-color-btn:hover {
  border-color: #c7c7cc;
}

.status-name-input {
  flex: 1;
  min-width: 0;
}

.status-row-actions {
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
}

.status-icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 12px;
  color: #6e6e73;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.status-icon-btn:hover:not(:disabled) {
  color: #1d1d1f;
  background: #e9e9ee;
}

.status-icon-btn.danger:hover:not(:disabled) {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.1);
}

.status-icon-btn:disabled {
  color: #d1d1d6;
  cursor: not-allowed;
}

.status-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  font-size: 13px;
  color: var(--c-primary);
  background: #fff;
  border: 1px dashed #c7d8f5;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.status-add-btn:hover {
  background: #f0f6ff;
  border-color: var(--c-primary);
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

<style>
.status-color-popover .ant-popover-inner {
  padding: 10px;
  border-radius: 12px;
}

.status-color-grid {
  display: grid;
  grid-template-columns: repeat(5, 24px);
  gap: 8px;
}

.status-color-grid .color-swatch {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 11px;
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.15s, box-shadow 0.15s;
}

.status-color-grid .color-swatch:hover {
  transform: scale(1.1);
}

.status-color-grid .color-swatch.active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(15, 23, 42, 0.18);
}
</style>
