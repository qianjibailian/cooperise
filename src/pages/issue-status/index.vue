<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <h2 class="mgmt-title">问题状态</h2>
      <a-button type="primary" class="mgmt-create-btn" @click="openCreate">
        <PlusOutlined /> 新增
      </a-button>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索状态名称 / 编码"
          allow-clear
          class="mgmt-search"
          @press-enter="handleSearch"
          @change="onKeywordChange"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <a-segmented v-model:value="categoryFilter" :options="CATEGORY_FILTERS" @change="handleSearch" />
        <a-segmented v-model:value="statusFilter" :options="STATUS_FILTERS" @change="handleSearch" />
        <a-tooltip title="刷新">
          <button class="mgmt-icon-btn" :disabled="loading" @click="loadIssueStatuses"><ReloadOutlined /></button>
        </a-tooltip>
      </div>

      <a-table
        :columns="columns"
        :data-source="issueStatuses"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 960 }"
        class="mgmt-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'issueStatus'">
            <span class="status-pill" :style="pillStyle(record.color)">
              <span class="status-dot" :style="{ background: record.color || DEFAULT_COLOR }" />
              {{ record.statusName }}
            </span>
          </template>
          <template v-else-if="column.key === 'statusCode'">
            <span v-if="record.statusCode" class="code-chip">{{ record.statusCode }}</span>
            <span v-else class="text-muted">-</span>
          </template>
          <template v-else-if="column.key === 'category'">
            <span :class="['category-tag', `category-${(record.category || '').toLowerCase()}`]">{{ categoryLabel(record.category) }}</span>
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
              @change="(v: boolean) => toggleStatus(record as IssueStatusItem, v)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-tooltip title="编辑">
                <span class="row-action" @click="openEdit(record as IssueStatusItem)"><EditOutlined /></span>
              </a-tooltip>
              <a-tooltip title="删除">
                <span class="row-action danger" @click="confirmDelete(record as IssueStatusItem)"><DeleteOutlined /></span>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑问题状态' : '新增问题状态'"
      :width="480"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="状态名称" name="statusName">
          <a-input v-model:value="form.statusName" placeholder="如 待处理 / 开发中 / 已完成" :maxlength="32" />
        </a-form-item>
        <a-form-item label="状态分类" name="category">
          <a-radio-group v-model:value="form.category" button-style="solid">
            <a-radio-button v-for="c in CATEGORY_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</a-radio-button>
          </a-radio-group>
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
            <span class="status-pill color-preview-pill" :style="pillStyle(form.color)">
              <span class="status-dot" :style="{ background: form.color }" />
              {{ form.statusName || '预览' }}
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, type FormInstance, type TablePaginationConfig } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons-vue'
import {
  queryIssueStatuses, createIssueStatus, updateIssueStatus, deleteIssueStatus,
  type IssueStatusItem, type IssueStatusSaveParams, type IssueStatusCategory,
} from '@/api/faiz'

/** 状态颜色候选（Apple 系统色） */
const COLOR_OPTIONS = ['#8E8E93', '#0A84FF', '#5E5CE6', '#AF52DE', '#FF9500', '#FFCC00', '#34C759', '#30B0C7', '#FF375F', '#FF3B30']
const DEFAULT_COLOR = COLOR_OPTIONS[0]

/** 状态分类：用于看板分列、统计完成率 */
const CATEGORY_OPTIONS: { label: string; value: IssueStatusCategory }[] = [
  { label: '待处理', value: 'TODO' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'DONE' },
]
const CATEGORY_FILTERS = [{ label: '全部分类', value: 'all' }, ...CATEGORY_OPTIONS]
function categoryLabel(v?: string) {
  return CATEGORY_OPTIONS.find(c => c.value === v)?.label || '-'
}

const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]

/** 状态胶囊：浅色底 + 同色文字 */
function pillStyle(color?: string) {
  const c = color || DEFAULT_COLOR
  return { color: c, background: `${c}1A` }
}

const columns = [
  { title: '问题状态', key: 'issueStatus', width: 200, fixed: 'left' as const },
  { title: '编码', key: 'statusCode', width: 160 },
  { title: '分类', key: 'category', width: 110 },
  { title: '描述', key: 'description', ellipsis: true },
  { title: '事项数', key: 'issueCount', width: 90 },
  { title: '启用', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' as const },
]

// ---- 列表 ----
const loading = ref(false)
const issueStatuses = ref<IssueStatusItem[]>([])
const keyword = ref('')
const statusFilter = ref('all')
const categoryFilter = ref<string>('all')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 个问题状态`,
}))

async function loadIssueStatuses() {
  loading.value = true
  try {
    const res = await queryIssueStatuses({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : Number(statusFilter.value),
      category: categoryFilter.value === 'all' ? undefined : (categoryFilter.value as IssueStatusCategory),
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res?.success) {
      issueStatuses.value = res.data?.list || []
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
  loadIssueStatuses()
}

/** 清空搜索框时立即刷新 */
function onKeywordChange() {
  if (!keyword.value) handleSearch()
}

function handleTableChange(p: TablePaginationConfig) {
  page.value = p.current || 1
  pageSize.value = p.pageSize || 20
  loadIssueStatuses()
}

/** 列表内快捷启用 / 停用 */
const togglingId = ref<number | null>(null)
async function toggleStatus(r: IssueStatusItem, checked: boolean) {
  togglingId.value = r.id
  try {
    const res = await updateIssueStatus({
      id: r.id,
      statusName: r.statusName,
      category: r.category,
      color: r.color,
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
const emptyForm = (): Omit<IssueStatusSaveParams, 'id'> & { description: string; sort: number; color: string } => ({
  statusName: '',
  category: 'TODO',
  color: DEFAULT_COLOR,
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
  statusName: [{ required: true, whitespace: true, message: '请输入状态名称' }],
  category: [{ required: true, message: '请选择状态分类' }],
}

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  modalOpen.value = true
}

function openEdit(r: IssueStatusItem) {
  editingId.value = r.id
  Object.assign(form, {
    statusName: r.statusName ?? '',
    category: r.category || 'TODO',
    color: r.color || DEFAULT_COLOR,
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
    const payload: IssueStatusSaveParams = {
      ...form,
      statusName: form.statusName.trim(),
      description: form.description.trim() || undefined,
      sort: editingId.value ? form.sort : undefined,
    }
    const res = editingId.value
      ? await updateIssueStatus({ ...payload, id: editingId.value })
      : await createIssueStatus(payload)
    if (res?.success) {
      modalOpen.value = false
      if (!editingId.value) page.value = 1
      loadIssueStatuses()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---- 删除 ----
function confirmDelete(r: IssueStatusItem) {
  Modal.confirm({
    title: `删除问题状态「${r.statusName}」？`,
    content: r.issueCount ? `已有 ${r.issueCount} 个事项处于该状态，删除后可能影响这些事项的展示与流转。` : '删除后不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteIssueStatus(r.id)
        if (res?.success) {
          if (issueStatuses.value.length === 1 && page.value > 1) page.value--
          loadIssueStatuses()
        }
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

onMounted(loadIssueStatuses)
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






.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
}

.color-preview-pill {
  margin-left: auto;
}

.category-tag {
  display: inline-block;
  padding: 0 8px;
  font-size: 12px;
  line-height: 22px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 6px;
}

.category-todo {
  color: #6e6e73;
  background: #f2f2f5;
}

.category-in_progress {
  color: #0a84ff;
  background: #e8f2ff;
}

.category-done {
  color: #248a3d;
  background: #e8f8ec;
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
