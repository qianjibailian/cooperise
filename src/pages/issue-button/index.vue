<template>
  <div :class="['mgmt-page', { embedded: !!props.spaceCode }]">
    <header class="mgmt-header">
      <h2 class="mgmt-title">{{ props.spaceCode ? '' : '按钮管理' }}</h2>
      <a-button type="primary" class="mgmt-create-btn" @click="openCreate">
        <PlusOutlined /> 新增
      </a-button>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-select
          v-model:value="typeFilter"
          :options="typeFilterOptions"
          :loading="typesLoading"
          allow-clear
          placeholder="全部问题类型"
          class="mgmt-filter"
          @change="onTypeFilterChange"
        />
        <a-select
          v-model:value="statusCodeFilter"
          :options="statusOptionsOf(typeFilter)"
          :disabled="!typeFilter"
          allow-clear
          placeholder="全部状态"
          class="mgmt-filter"
          @change="handleSearch"
        />
        <a-input
          v-model:value="keyword"
          placeholder="搜索按钮名称"
          allow-clear
          class="mgmt-search"
          @press-enter="handleSearch"
          @change="onKeywordChange"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <a-segmented v-model:value="enableFilter" :options="ENABLE_FILTERS" @change="handleSearch" />
        <a-tooltip title="刷新">
          <button class="mgmt-icon-btn" :disabled="loading" @click="loadButtons"><ReloadOutlined /></button>
        </a-tooltip>
      </div>

      <a-table
        :columns="columns"
        :data-source="buttons"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 1000 }"
        class="mgmt-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'button'">
            <span :class="['btn-preview', record.buttonStyle || 'default']">{{ record.buttonName }}</span>
          </template>
          <template v-else-if="column.key === 'actionType'">
            <a-tag :color="ACTION_COLOR[record.actionType as IssueButtonActionType]" class="action-tag">
              {{ ACTION_LABEL[record.actionType as IssueButtonActionType] || record.actionType }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'issueType'">
            <span v-if="record.issueTypeCode">{{ record.issueTypeName || record.issueTypeCode }}</span>
            <a-tag v-else class="generic-tag">所有类型</a-tag>
          </template>
          <template v-else-if="column.key === 'statusName'">
            <a-tooltip v-if="record.statusCodes?.length" :title="statusLabel(record as IssueButtonItem)" placement="topLeft">
              <span class="ellipsis">{{ statusLabel(record as IssueButtonItem) }}</span>
            </a-tooltip>
            <span v-else class="text-muted">所有状态</span>
          </template>
          <template v-else-if="column.key === 'targetStatusName'">
            <template v-if="isWorkflowAction(record.actionType)">
              <span v-if="record.targetStatusCode">{{ record.targetStatusName || record.targetStatusCode }}</span>
              <span v-else class="text-muted">{{ record.actionType === 'ROLLBACK' ? '首个回退节点' : '首个后续节点' }}</span>
            </template>
            <span v-else class="text-muted">-</span>
          </template>
          <template v-else-if="column.key === 'description'">
            <a-tooltip :title="record.description" placement="topLeft">
              <span class="ellipsis text-muted">{{ record.description || '-' }}</span>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              size="small"
              :checked="record.status === 1"
              :loading="togglingId === record.id"
              @change="(v: boolean) => toggleStatus(record as IssueButtonItem, v)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-tooltip title="编辑">
                <span class="row-action" @click="openEdit(record as IssueButtonItem)"><EditOutlined /></span>
              </a-tooltip>
              <a-tooltip title="删除">
                <span class="row-action danger" @click="confirmDelete(record as IssueButtonItem)"><DeleteOutlined /></span>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑按钮' : '新增按钮'"
      :width="560"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <div class="form-grid">
          <a-form-item label="按钮名称" name="buttonName">
            <a-input v-model:value="form.buttonName" placeholder="如 提交测试 / 打回" :maxlength="64" />
          </a-form-item>
          <a-form-item label="动作类型" name="actionType">
            <a-select v-model:value="form.actionType" :options="ACTION_OPTIONS" @change="onFormActionChange" />
          </a-form-item>
        </div>
        <div class="form-grid">
          <a-form-item label="问题类型" name="issueTypeCode">
            <a-select v-model:value="form.issueTypeCode" :options="formTypeOptions" @change="onFormTypeChange" />
          </a-form-item>
          <a-form-item label="适用状态" name="statusCodes">
            <a-select
              v-model:value="form.statusCodes"
              mode="multiple"
              :options="statusOptionsOf(form.issueTypeCode)"
              :disabled="!form.issueTypeCode"
              :loading="!!form.issueTypeCode && statusLoadingCode === form.issueTypeCode"
              :max-tag-count="2"
              allow-clear
              placeholder="所有状态"
              @change="onFormStatusesChange"
            />
          </a-form-item>
        </div>
        <a-form-item v-if="isWorkflowAction(form.actionType)" label="目标状态" name="targetStatusCode">
          <a-select
            v-model:value="form.targetStatusCode"
            :options="targetStatusOptions"
            :disabled="!form.issueTypeCode"
          />
          <div class="form-hint">
            按流程配置流转：事项当前节点走不到目标状态时，该按钮在事项详情中不展示
          </div>
        </a-form-item>
        <a-form-item label="按钮样式" name="buttonStyle">
          <a-radio-group v-model:value="form.buttonStyle" button-style="solid">
            <a-radio-button v-for="s in STYLE_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="form.description" placeholder="选填" :rows="2" :maxlength="256" />
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
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import {
  queryIssueButtons, createIssueButton, updateIssueButton, deleteIssueButton,
  queryIssueTypes, queryIssueTypeStatuses,
  type IssueButtonItem, type IssueButtonSaveParams, type IssueButtonActionType, type IssueButtonStyle,
  type IssueTypeItem, type IssueTypeStatus,
} from '@/api/faiz'

const ACTION_LABEL: Record<IssueButtonActionType, string> = {
  TRANSITION: '状态流转',
  ROLLBACK: '回退',
  EDIT: '编辑',
  COPY: '复制',
  ASSIGN: '指派',
  SPLIT: '拆分任务',
  DELETE: '删除',
  CUSTOM: '自定义',
}
const ACTION_COLOR: Record<IssueButtonActionType, string> = {
  TRANSITION: 'blue',
  ROLLBACK: 'orange',
  EDIT: 'cyan',
  COPY: 'purple',
  ASSIGN: 'geekblue',
  SPLIT: 'magenta',
  DELETE: 'red',
  CUSTOM: 'default',
}
const ACTION_OPTIONS = (Object.keys(ACTION_LABEL) as IssueButtonActionType[]).map(k => ({ label: ACTION_LABEL[k], value: k }))

const STYLE_OPTIONS: { label: string; value: IssueButtonStyle }[] = [
  { label: '主要', value: 'primary' },
  { label: '默认', value: 'default' },
  { label: '危险', value: 'danger' },
]

const ENABLE_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]

const columns = [
  { title: '按钮', key: 'button', width: 160, fixed: 'left' as const },
  { title: '动作', key: 'actionType', width: 100 },
  { title: '问题类型', key: 'issueType', width: 130 },
  { title: '适用状态', key: 'statusName', width: 160 },
  { title: '目标状态', key: 'targetStatusName', width: 130 },
  { title: '描述', key: 'description', ellipsis: true },
  { title: '启用', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' as const },
]

/** 适用状态展示：名称以「、」连接 */
function statusLabel(r: IssueButtonItem) {
  const codes = r.statusCodes || []
  return codes.map((c, i) => r.statusNames?.[i] || c).join('、')
}

function isWorkflowAction(t?: string) {
  return t === 'TRANSITION' || t === 'ROLLBACK'
}

/** 在空间内管理（空间首页嵌入）时传入：问题类型只列该空间的，且必须选定一个类型 */
const props = defineProps<{ spaceCode?: string }>()

// ---- 问题类型 & 状态（下拉数据） ----
const typesLoading = ref(false)
const issueTypes = ref<IssueTypeItem[]>([])
const typeFilterOptions = computed(() =>
  issueTypes.value.filter(t => t.issueTypeCode).map(t => ({ label: t.issueTypeName, value: t.issueTypeCode as string })))

async function loadIssueTypes() {
  typesLoading.value = true
  try {
    const res = await queryIssueTypes({ spaceCode: props.spaceCode, page: 1, pageSize: 999 })
    if (res?.success) {
      const list = res.data?.list || []
      issueTypes.value = props.spaceCode ? list.filter(t => !t.spaceCode || t.spaceCode === props.spaceCode) : list
    }
  } catch {
    // 请求层已统一提示
  } finally {
    typesLoading.value = false
  }
}

/** 问题类型编码 → 状态列表（按需加载并缓存） */
const statusMap = reactive<Record<string, IssueTypeStatus[]>>({})
const statusLoadingCode = ref<string | null>(null)
async function ensureStatuses(code?: string | null) {
  if (!code || statusMap[code]) return
  statusLoadingCode.value = code
  try {
    const res = await queryIssueTypeStatuses(code)
    statusMap[code] = res?.success ? res.data || [] : []
  } catch {
    statusMap[code] = []
  } finally {
    if (statusLoadingCode.value === code) statusLoadingCode.value = null
  }
}
function statusOptionsOf(code?: string | null) {
  return (code ? statusMap[code] || [] : [])
    .filter(s => s.statusCode)
    .map(s => ({ label: s.statusName, value: s.statusCode as string }))
}

// ---- 列表 ----
const loading = ref(false)
const buttons = ref<IssueButtonItem[]>([])
const typeFilter = ref<string | undefined>()
const statusCodeFilter = ref<string | undefined>()
const keyword = ref('')
const enableFilter = ref('all')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 个按钮`,
}))

/** 空间内查全部问题类型时一次拉取的上限（按钮配置量小，前端过滤 + 分页） */
const SPACE_ALL_FETCH_SIZE = 9999

async function loadButtons() {
  // 空间内查全部问题类型：按钮不带空间维度，后端会返回所有空间的按钮，
  // 这里拉全量后只保留本空间问题类型 + 通用（类型为空）按钮，再在前端分页
  const spaceAll = !!props.spaceCode && !typeFilter.value
  loading.value = true
  try {
    const res = await queryIssueButtons({
      keyword: keyword.value.trim() || undefined,
      issueTypeCode: typeFilter.value,
      statusCode: statusCodeFilter.value,
      status: enableFilter.value === 'all' ? undefined : Number(enableFilter.value),
      page: spaceAll ? 1 : page.value,
      pageSize: spaceAll ? SPACE_ALL_FETCH_SIZE : pageSize.value,
    })
    if (res?.success) {
      const list = res.data?.list || []
      if (spaceAll) {
        const codes = new Set(typeFilterOptions.value.map(o => o.value))
        const mine = list.filter(b => !b.issueTypeCode || codes.has(b.issueTypeCode))
        total.value = mine.length
        const start = (page.value - 1) * pageSize.value
        buttons.value = mine.slice(start, start + pageSize.value)
      } else {
        buttons.value = list
        total.value = Number(res.data?.total || 0)
      }
    }
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadButtons()
}

function onTypeFilterChange() {
  statusCodeFilter.value = undefined
  ensureStatuses(typeFilter.value)
  handleSearch()
}

/** 清空搜索框时立即刷新 */
function onKeywordChange() {
  if (!keyword.value) handleSearch()
}

function handleTableChange(p: TablePaginationConfig) {
  page.value = p.current || 1
  pageSize.value = p.pageSize || 20
  loadButtons()
}

/** 记录 → 保存入参（列表快捷启停、编辑共用） */
function toSaveParams(r: IssueButtonItem): IssueButtonSaveParams {
  return {
    id: r.id,
    buttonName: r.buttonName,
    actionType: r.actionType,
    issueTypeCode: r.issueTypeCode || null,
    statusCodes: r.statusCodes || [],
    targetStatusCode: r.targetStatusCode || null,
    buttonStyle: r.buttonStyle || 'default',
    status: r.status,
    description: r.description || null,
  }
}

/** 列表内快捷启用 / 停用 */
const togglingId = ref<number | null>(null)
async function toggleStatus(r: IssueButtonItem, checked: boolean) {
  togglingId.value = r.id
  try {
    const res = await updateIssueButton({ ...toSaveParams(r), status: checked ? 1 : 0 })
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

/** 下拉里「所有类型 / 自动」用空串表示、「所有状态」用空数组表示，提交时空串转 null */
const emptyForm = () => ({
  buttonName: '',
  actionType: 'TRANSITION' as IssueButtonActionType,
  issueTypeCode: '',
  statusCodes: [] as string[],
  targetStatusCode: '',
  buttonStyle: 'default' as IssueButtonStyle,
  description: '',
  status: 1,
})
const form = reactive(emptyForm())
const statusChecked = computed({
  get: () => form.status === 1,
  set: (v: boolean) => { form.status = v ? 1 : 0 },
})

const formTypeOptions = computed(() => [
  // 空间内也允许配置通用按钮，但会作用于所有空间的问题类型，需在名称里点明
  { label: props.spaceCode ? '所有类型（全局通用）' : '所有类型', value: '' },
  ...typeFilterOptions.value,
])

const targetStatusOptions = computed(() => [
  { label: form.actionType === 'ROLLBACK' ? '自动（流程中首个回退节点）' : '自动（流程中首个后续节点）', value: '' },
  ...statusOptionsOf(form.issueTypeCode).filter(o => !form.statusCodes.includes(o.value)),
])

const rules: Record<string, Rule[]> = {
  buttonName: [{ required: true, whitespace: true, message: '请输入按钮名称' }],
  actionType: [{ required: true, message: '请选择动作类型' }],
}

function onFormTypeChange() {
  form.statusCodes = []
  form.targetStatusCode = ''
  ensureStatuses(form.issueTypeCode)
}

/** 目标状态不能是适用状态之一：被选为适用状态时清空 */
function onFormStatusesChange() {
  if (form.statusCodes.includes(form.targetStatusCode)) form.targetStatusCode = ''
}

function onFormActionChange() {
  if (!isWorkflowAction(form.actionType)) form.targetStatusCode = ''
}

function openCreate() {
  editingId.value = null
  // 默认归属当前筛选的问题类型 / 状态
  Object.assign(form, emptyForm(), {
    issueTypeCode: typeFilter.value || '',
    statusCodes: statusCodeFilter.value ? [statusCodeFilter.value] : [],
  })
  ensureStatuses(form.issueTypeCode)
  modalOpen.value = true
}

function openEdit(r: IssueButtonItem) {
  editingId.value = r.id
  Object.assign(form, {
    buttonName: r.buttonName ?? '',
    actionType: r.actionType,
    issueTypeCode: r.issueTypeCode || '',
    statusCodes: [...(r.statusCodes || [])],
    targetStatusCode: r.targetStatusCode || '',
    buttonStyle: r.buttonStyle || 'default',
    description: r.description ?? '',
    status: r.status ?? 1,
  })
  ensureStatuses(form.issueTypeCode)
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
    const payload: IssueButtonSaveParams = {
      buttonName: form.buttonName.trim(),
      actionType: form.actionType,
      issueTypeCode: form.issueTypeCode || null,
      statusCodes: form.issueTypeCode ? form.statusCodes : [],
      targetStatusCode: isWorkflowAction(form.actionType) ? form.targetStatusCode || null : null,
      buttonStyle: form.buttonStyle,
      status: form.status,
      // 始终提交描述（清空时传 null），后端按 null 清空
      description: form.description.trim() || null,
    }
    const res = editingId.value
      ? await updateIssueButton({ ...payload, id: editingId.value })
      : await createIssueButton(payload)
    if (res?.success) {
      modalOpen.value = false
      if (!editingId.value) page.value = 1
      loadButtons()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---- 删除 ----
function confirmDelete(r: IssueButtonItem) {
  Modal.confirm({
    title: `删除按钮「${r.buttonName}」？`,
    content: r.issueTypeCode ? '删除后不可恢复。' : '这是所有问题类型通用的按钮，删除后所有空间都不再展示。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteIssueButton(r.id)
        if (res?.success) {
          if (buttons.value.length === 1 && page.value > 1) page.value--
          loadButtons()
        }
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

onMounted(async () => {
  // 默认查全部问题类型；空间内需先拿到本空间的问题类型用于过滤
  await loadIssueTypes()
  loadButtons()
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

.mgmt-filter {
  width: 160px;
}

.mgmt-filter :deep(.ant-select-selector) {
  height: 34px !important;
  align-items: center;
  border-radius: 10px !important;
}

.mgmt-search {
  width: 240px;
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

/* 按钮预览：按配置的样式渲染 */
.btn-preview {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 26px;
  padding: 0 10px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid #d9d9d9;
  border-radius: 7px;
  color: #1d1d1f;
  background: #fff;
}

.btn-preview.primary {
  color: #fff;
  background: var(--c-primary);
  border-color: var(--c-primary);
}

.btn-preview.danger {
  color: #ff3b30;
  border-color: color-mix(in srgb, #ff3b30 45%, #fff);
}

.action-tag,
.generic-tag {
  margin: 0;
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #86868b;
}

@media (max-width: 768px) {
  .mgmt-page {
    padding: 16px;
  }

  .mgmt-toolbar {
    flex-wrap: wrap;
  }

  .mgmt-filter,
  .mgmt-search {
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
