<template>
  <div class="component-list-page">
    <!-- 搜索与操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <SearchOutlined class="search-icon" />
          <input v-model="searchValue" class="search-input" placeholder="搜索字段名称…" @keyup.enter="handleQuery()" />
          <div v-if="searchValue" class="search-clear" @click="searchValue = ''">
            <CloseCircleFilled />
          </div>
        </div>
        <button class="search-btn" @click="handleQuery"><SearchOutlined /> 查询</button>
      </div>
      <div class="toolbar-actions">
        <button
          class="delete-btn"
          @click="handleBatchDelete"
          :disabled="selectedRowKeys.length === 0"
        >
          <DeleteOutlined /><span>批量删除</span>
          <span v-if="selectedRowKeys.length > 0" class="badge">({{ selectedRowKeys.length }})</span>
        </button>
        <button v-if="props.showCreate" class="create-btn" @click="handleCreate">
          <PlusOutlined /><span>新增字段</span>
        </button>
      </div>
    </div>

    <!-- 筛选条件（系统字段页面开启） -->
    <div v-if="props.showFilters" class="filter-bar">
      <a-select
        v-model:value="filters.filedType"
        :options="fieldTypeOptions"
        placeholder="类型"
        allow-clear
        show-search
        option-filter-prop="label"
        class="filter-select filter-select-wide"
        @change="handleQuery"
      />
      <a-select v-model:value="filters.isRequired" :options="REQUIRED_FILTERS" placeholder="必填" allow-clear class="filter-select" @change="handleQuery" />
      <a-select v-if="!props.customOnly" v-model:value="filters.isSystem" :options="SYSTEM_FILTERS" placeholder="系统字段" allow-clear class="filter-select" @change="handleQuery" />
      <a-select
        v-model:value="filters.issueTypeCode"
        :options="issueTypeFilterOptions"
        placeholder="关联问题类型"
        allow-clear
        show-search
        option-filter-prop="label"
        class="filter-select filter-select-wide"
        @change="handleQuery"
      />
      <a-select v-model:value="filters.displayScene" :options="displaySceneOptions" placeholder="展示场景" allow-clear class="filter-select" @change="handleQuery" />
      <a-select v-model:value="filters.requiredScene" :options="displaySceneOptions" placeholder="必填场景" allow-clear class="filter-select" @change="handleQuery" />
      <a-select v-model:value="filters.editableScene" :options="displaySceneOptions" placeholder="可编辑场景" allow-clear class="filter-select" @change="handleQuery" />
      <button v-if="hasFilter" type="button" class="filter-reset" @click="resetFilters">重置筛选</button>
    </div>

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ totalCount }}</span><span class="stat-label">字段总数</span></div>
      <template v-if="showSystemColumn">
        <div class="stat-divider" />
        <div class="stat-item"><span class="stat-value stat-green">{{ systemCount }}</span><span class="stat-label">系统字段</span></div>
      </template>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <!-- 首次加载：骨架占位，数据回来后渲染表格 -->
      <div v-if="!initialized" class="page-skeleton">
        <a-skeleton active :paragraph="{ rows: 10 }" />
      </div>
      <a-table
        v-else
        :columns="columns"
        :data-source="tableData"
        :loading="loading"
        :pagination="false"
        :row-selection="{ selectedRowKeys: selectedRowKeys, onChange: onSelectChange }"
        row-key="id"
        size="middle"
        :scroll="{ x: props.showMetaColumns ? 'max-content' : 1900 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'fieldName'">
            <span class="cell-field-name">{{ record.fieldName }}</span>
          </template>
          <template v-else-if="column.key === 'type'">
            <a-tag :color="typeTagColor(record.type || record.filedType)">{{ formatTypeLabel(record.type || record.filedType) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'displayScene' || column.key === 'requiredScene' || column.key === 'editableScene'">
            <span v-if="scenesOfColumn(record, String(column.key)).length" class="cell-scenes">
              <span
                v-for="sc in scenesOfColumn(record, String(column.key))"
                :key="sc"
                :class="['scene-chip', `scene-chip-${String(column.key)}`]"
              >{{ sceneLabel(sc) }}</span>
            </span>
            <span v-else class="cell-muted">{{ column.key === 'displayScene' ? '不展示' : '无' }}</span>
          </template>
          <template v-else-if="column.key === 'isSystem'">
            <a-tag :color="record.isSystem ? 'purple' : 'default'">{{ record.isSystem ? '系统' : '自定义' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'issueTypeCodes'">
            <span v-if="record.issueTypeCodes?.length" class="cell-scenes">
              <span v-for="code in record.issueTypeCodes" :key="code" class="scene-chip scene-chip-issueType">{{ issueTypeNameOf(code) }}</span>
            </span>
            <span v-else class="cell-muted">{{ record.isSystem ? '全部' : '未关联' }}</span>
          </template>
          <template v-else-if="column.key === 'supportOperator'">
            <span v-if="record.supportOperator && record.supportOperator.length" class="cell-operators">
              <a-tag v-for="(op, i) in toOperatorTags(record.supportOperator)" :key="op.code || op.name || i" size="small" :title="op.code || undefined">
                {{ op.name }}<span v-if="op.identifier" class="op-identifier">{{ op.identifier }}</span>
              </a-tag>
            </span>
            <span v-else class="cell-muted">-</span>
          </template>
          <template v-else-if="column.key === 'creator' || column.key === 'updater'">
            <UserCell :raw="record[column.key]" />
          </template>
          <template v-else-if="column.key === 'createTime' || column.key === 'updateTime'">
            <span>{{ formatTime(record[column.key]) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a-button v-if="props.showEdit" type="link" size="small" @click="handleEdit(record)"><EditOutlined /> 编辑</a-button>
              <a-button type="link" size="small" danger @click="handleDelete(record)"><DeleteOutlined /> 删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar" v-if="!loading && totalCount > 0">
      <a-pagination
        v-model:current="page"
        v-model:page-size="pageSize"
        :total="totalCount"
        :show-size-changer="true"
        :show-quick-jumper="true"
        :page-size-options="['10', '20', '50', '100']"
        :show-total="(t: number) => `共 ${t} 条`"
        @change="handlePageChange"
        @showSizeChange="handleSizeChange"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <FieldEditModal
      v-model:open="showEditModal"
      :record="editingRecord"
      :api="fieldApi"
      :show-system-switch="props.showSystemSwitch && !props.customOnly"
      :force-custom="props.customOnly"
      :space-code="props.spaceCode"
      :disable-field-num="props.disableFieldNum"
      @saved="loadFields"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { personLabel, personAvatar, personInitial } from '@/utils/person'
import { Modal } from 'ant-design-vue'
import {
  SearchOutlined, CloseCircleFilled, PlusOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons-vue'
import {
  queryAvailableFields, createAvailableField, updateAvailableField,
  batchDeleteAvailableFields, getAvailableFieldDetail,
} from '@/api/faiz'
import type { AvailableFieldItem, AvailableFieldSavePayload } from '@/types/faiz'
import { queryIssueTypes, type IssueTypeItem } from '@/api/faiz'
import { fieldTypeOptions, formatTypeLabel, typeTagColor } from '@/types/fieldType'
import { toFieldOperator, type FieldOperator, type RawFieldOperator } from '@/types/fieldOperator'
import {
  SCENE_OPTIONS, sceneLabel, sortScenes, requiredScenesOf, editableScenesOf, type FieldRow,
} from '@/utils/fieldConfig'
import FieldEditModal from '@/components/FieldEditModal.vue'

// ---- 组件 props：可选字段与系统字段共用，通过 fieldApi 注入不同的接口实现 ----
interface FieldApi {
  query: (params: { page: number; pageSize: number; searchKey?: string } & FieldFilters) => Promise<{ success?: boolean; data?: { list?: FieldRow[]; total?: number } }>
  getDetail: (id: string | number) => Promise<{ success?: boolean; data?: FieldRow | null }>
  create: (data: AvailableFieldSavePayload) => Promise<{ success?: boolean }>
  update: (id: string | number, data: AvailableFieldSavePayload) => Promise<{ success?: boolean }>
  delete: (id: string | number) => Promise<{ success?: boolean }>
  batchDelete: (ids: Array<number | string>) => Promise<{ success?: boolean }>
}

const props = withDefaults(defineProps<{
  /** 字段 CRUD 接口集合，默认使用「可选字段」接口 */
  fieldApi?: FieldApi
  /** 是否展示「系统字段」列与统计（自定义字段页面无该字段，固定为自定义，默认不展示） */
  showSystemColumn?: boolean
  /** 是否展示筛选条件：类型 / 必填 / 系统字段 / 状态（需接口支持，默认不展示） */
  showFilters?: boolean
  /** 是否展示「新增字段」按钮（系统字段内置，不可新增，默认展示） */
  showCreate?: boolean
  /** 是否展示操作列「编辑」按钮（系统字段内置，不可编辑，默认展示） */
  showEdit?: boolean
  /** 是否展示表单「系统字段」开关（自定义字段固定为自定义，默认不展示） */
  showSystemSwitch?: boolean
  /** 是否展示元信息列：创建人/更新人/创建时间/更新时间（默认展示，与系统字段页面一致） */
  showMetaColumns?: boolean
  /** 弹窗中「字段编号」是否置灰（自定义字段页面默认置灰，系统字段页面可传 false 保持可编辑） */
  disableFieldNum?: boolean
  /** 只管理自定义字段：列表只查 isSystem=false，新增固定为自定义字段 */
  customOnly?: boolean
  /** 空间内：只展示关联了本空间问题类型的字段 */
  spaceCode?: string
}>(), {
  showSystemColumn: false,
  showFilters: false,
  showCreate: true,
  showEdit: true,
  showSystemSwitch: false,
  disableFieldNum: true,
  showMetaColumns: true,
  customOnly: false,
  spaceCode: '',
})

/** 后端 CustomFieldSaveRequest 用 filedType 接收类型，前端表单字段为 type，做映射 */
function mapPayload(data: AvailableFieldSavePayload): AvailableFieldSavePayload {
  return { ...data, filedType: data.type }
}

const defaultFieldApi: FieldApi = {
  query: queryAvailableFields,
  getDetail: getAvailableFieldDetail,
  create: (data) => createAvailableField(mapPayload(data)),
  update: (id, data) => updateAvailableField(String(id), mapPayload(data)),
  // 单个删除后端未提供，复用批量删除
  delete: (id) => batchDeleteAvailableFields([Number(id)]),
  batchDelete: batchDeleteAvailableFields,
}
const fieldApi = computed<FieldApi>(() => props.fieldApi || defaultFieldApi)

/** 表格展示：兼容对象与名称字符串 */
function toOperatorTags(list?: RawFieldOperator[] | null): FieldOperator[] {
  return (list ?? []).map(toFieldOperator).filter((o): o is FieldOperator => !!o)
}

// ---- 展示场景（规则见 @/utils/fieldConfig） ----
const displaySceneOptions = SCENE_OPTIONS

/** 列表三列（展示 / 必填 / 可编辑场景）：按场景枚举顺序展示；老数据未配置时按与表单一致的规则兜底 */
function scenesOfColumn(r: AvailableFieldItem, key: string): string[] {
  const list = key === 'requiredScene'
    ? requiredScenesOf(r)
    : key === 'editableScene'
      ? editableScenesOf(r)
      : (r.displayScene ?? [])
  return sortScenes(list)
}

// ---- 表格列定义（系统字段页面隐藏「系统字段」列） ----
const baseColumns = [
  { title: '字段名称', dataIndex: 'fieldName', key: 'fieldName', width: 180, ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '展示场景', dataIndex: 'displayScene', key: 'displayScene', width: 200 },
  { title: '必填场景', dataIndex: 'requiredScene', key: 'requiredScene', width: 200 },
  { title: '可编辑场景', dataIndex: 'editableScene', key: 'editableScene', width: 200 },
  { title: '系统字段', dataIndex: 'isSystem', key: 'isSystem', width: 90 },
  { title: '关联问题类型', dataIndex: 'issueTypeCodes', key: 'issueTypeCodes', width: 200 },
  { title: '操作符', dataIndex: 'supportOperator', key: 'supportOperator', width: 200 },
]
const metaColumns = [
  { title: '创建人', dataIndex: 'creator', key: 'creator', width: 120 },
  { title: '更新人', dataIndex: 'updater', key: 'updater', width: 120 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 170 },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime', width: 170 },
]
const columns = computed(() => {
  let list = props.showSystemColumn && !props.customOnly ? baseColumns : baseColumns.filter(c => c.key !== 'isSystem')
  if (props.showMetaColumns) {
    list = [...list, ...metaColumns]
  }
  return [...list, { title: '操作', key: 'action', fixed: 'right' as const, width: 160 }]
})

// ---- 状态 ----
const searchValue = ref('')
const tableData = ref<AvailableFieldItem[]>([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
/** 首次数据加载完成前只渲染骨架，避免先出现空表格 */
const initialized = ref(false)

const showEditModal = ref(false)
/** 正在编辑的字段行；为空表示新增 */
const editingRecord = ref<FieldRow | null>(null)

const selectedRowKeys = ref<string[]>([])
function onSelectChange(keys: string[]) {
  selectedRowKeys.value = keys
}

// ---- 计算属性 ----
const systemCount = computed(() => tableData.value.filter(r => r.isSystem).length)

// ---- 元信息格式化（创建人/更新人为 JSON 字符串，时间含 T 分隔符） ----
interface UserBrief {
  name: string
  id: string
  firstLetter: string
  avatar: string
  bg: string
}
function parseUserInfo(v: unknown): UserBrief | null {
  if (v == null || v === '') return null
  let obj: Record<string, unknown> | null = null
  if (typeof v === 'string') {
    try {
      obj = JSON.parse(v) as Record<string, unknown>
    } catch {
      return null
    }
  } else if (typeof v === 'object') {
    obj = v as Record<string, unknown>
  }
  if (!obj) return null
  // 人员统一展示：头像 + realName（coAccount）
  const name = personLabel(obj)
  if (!name) return null
  const idPart = ''
  const firstLetter = personInitial(obj)
  const avatar = personAvatar(obj)
  const palette = [
    'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
    'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
    'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)',
    'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
    'linear-gradient(135deg, #eb2f96 0%, #f759ab 100%)',
    'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)',
    'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
    'linear-gradient(135deg, #2f54eb 0%, #597ef7 100%)',
  ]
  return {
    name,
    id: idPart,
    firstLetter,
    avatar,
    bg: palette[name.charCodeAt(0) % palette.length],
  }
}

/** 用户单元格：头像（无头像显示渐变首字母）+ realName（coAccount） */
const UserCell = (props: { raw: unknown }) => {
  const u = parseUserInfo(props.raw)
  if (!u) return h('span', { class: 'cell-muted' }, '-')
  return h('span', { class: 'cell-user' }, [
    u.avatar
      ? h('img', { src: u.avatar, class: 'cell-user-avatar', alt: '' })
      : h('span', { class: 'cell-user-avatar cell-user-avatar-text', style: { background: u.bg } }, u.firstLetter),
    h('span', { class: 'cell-user-name' }, `${u.name}${u.id ? `（${u.id}）` : ''}`),
  ])
}

function formatTime(v?: string | null): string {
  if (!v) return '-'
  return v.replace('T', ' ').slice(0, 16)
}

// ---- 数据加载 ----
async function loadFields() {
  loading.value = true
  try {
    const res = await fieldApi.value.query({
      page: page.value,
      pageSize: pageSize.value,
      searchKey: searchValue.value.trim() || undefined,
      ...(props.showFilters ? queryFilters() : {}),
      ...scopeFilters(),
    })
    if (res.success) {
      tableData.value = (res.data?.list as unknown as AvailableFieldItem[]) || []
      totalCount.value = res.data?.total || 0
    }
  } catch {
  } finally {
    loading.value = false
    initialized.value = true
  }
}

function handleQuery() {
  page.value = 1
  loadFields()
}

// ---- 筛选条件：类型 / 必填 / 系统字段 / 状态 / 展示·必填·可编辑场景（未选为不限） ----
interface FieldFilters {
  filedType?: string
  isRequired?: boolean
  isSystem?: boolean
  /** 关联问题类型（单选筛选） */
  issueTypeCode?: string
  /** 场景筛选：字段在该场景展示 / 必填 / 可编辑 */
  displayScene?: string
  requiredScene?: string
  editableScene?: string
}
const REQUIRED_FILTERS = [{ label: '必填', value: true }, { label: '非必填', value: false }]
const SYSTEM_FILTERS = [{ label: '系统字段', value: true }, { label: '自定义字段', value: false }]
const filters = ref<FieldFilters>({})
const hasFilter = computed(() => Object.values(filters.value).some(v => v !== undefined && v !== null && v !== ''))

/** 只提交已选的条件 */
function activeFilters(): FieldFilters {
  return Object.fromEntries(
    Object.entries(filters.value).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as FieldFilters
}

/** 筛选 → 接口参数：问题类型单选转为 issueTypeCodes */
function queryFilters() {
  const { issueTypeCode, ...rest } = activeFilters()
  return issueTypeCode ? { ...rest, issueTypeCodes: [issueTypeCode] } : rest
}

/** 页面范围：只看自定义字段；空间内只看关联本空间问题类型的字段（用户选了问题类型时以用户选择为准） */
function scopeFilters() {
  const scope: { isSystem?: boolean; issueTypeCodes?: string[] } = {}
  if (props.customOnly) scope.isSystem = false
  if (props.spaceCode && !filters.value.issueTypeCode) scope.issueTypeCodes = spaceIssueTypeCodes.value
  return scope
}

// ---- 问题类型：名称回显 + 筛选选项（空间内只列本空间的） ----
const allIssueTypes = ref<IssueTypeItem[]>([])
async function loadIssueTypes() {
  try {
    const res = await queryIssueTypes({ page: 1, pageSize: 999 })
    allIssueTypes.value = res?.success ? res.data?.list || [] : []
  } catch {
    allIssueTypes.value = []
  }
}
const scopedIssueTypes = computed(() => allIssueTypes.value.filter(t => t.issueTypeCode
  && (!props.spaceCode || t.spaceCode === props.spaceCode)))
const spaceIssueTypeCodes = computed(() => scopedIssueTypes.value.map(t => t.issueTypeCode as string))
const issueTypeFilterOptions = computed(() => scopedIssueTypes.value.map(t => ({ value: t.issueTypeCode as string, label: t.issueTypeName })))
function issueTypeNameOf(code: string) {
  return allIssueTypes.value.find(t => t.issueTypeCode === code)?.issueTypeName ?? code
}

function resetFilters() {
  filters.value = {}
  handleQuery()
}

function handlePageChange(cur: number, size: number) {
  page.value = cur
  pageSize.value = size
  loadFields()
}

function handleSizeChange(_cur: number, size: number) {
  page.value = 1
  pageSize.value = size
  loadFields()
}

// ---- CRUD（表单与保存逻辑在 FieldEditModal） ----
function handleCreate() {
  editingRecord.value = null
  showEditModal.value = true
}

function handleEdit(record: AvailableFieldItem) {
  editingRecord.value = record as unknown as FieldRow
  showEditModal.value = true
}

function handleDelete(record: AvailableFieldItem) {
  Modal.confirm({
    title: '删除字段',
    content: `确定要删除「${record.fieldName}」吗？删除后不可恢复。`,
    okText: '删除', cancelText: '取消', okType: 'danger',
    onOk: async () => {
      try {
        const res = await fieldApi.value.delete(record.id)
        if (res.success) { loadFields() }
      } catch {}
    },
  })
}

function handleBatchDelete() {
  if (!selectedRowKeys.value.length) {
    return
  }
  Modal.confirm({
    title: '批量删除字段',
    content: `确定要删除选中的 ${selectedRowKeys.value.length} 个字段吗？删除后不可恢复。`,
    okText: '删除', cancelText: '取消', okType: 'danger',
    onOk: async () => {
      try {
        const ids = selectedRowKeys.value.map(k => Number(k)).filter(n => !Number.isNaN(n))
        const res = await fieldApi.value.batchDelete(ids)
        if (res.success) {
          selectedRowKeys.value = []
          loadFields()
        }
      } catch {}
    },
  })
}

onMounted(async () => {
  // 空间内需先拿到本空间的问题类型，才能按问题类型过滤字段
  await loadIssueTypes()
  loadFields()
})
</script>

<style scoped>
.op-identifier {
  margin-left: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #86868b;
}

.component-list-page {
  padding: 0 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
  /* 撑满右侧内容区：表格区域自适应剩余高度，内部滚动 */
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---- toolbar ---- */
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; flex-shrink: 0; }
.toolbar-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; flex-wrap: wrap; }
.search-box { flex: 1; min-width: 260px; position: relative; display: flex; align-items: center; background: #f5f5f7; border-radius: 14px; transition: background 0.2s, box-shadow 0.2s; }
.search-box:focus-within { background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 15%, transparent); }
.search-icon { font-size: 16px; color: #86868b; margin-left: 14px; flex-shrink: 0; }
.search-input { flex: 1; border: none; background: transparent; padding: 11px 12px 11px 10px; font-size: 15px; color: #1d1d1f; outline: none; font-family: inherit; }
.search-input::placeholder { color: #aeaeb2; }
.search-clear { padding: 0 12px; cursor: pointer; color: #aeaeb2; font-size: 16px; display: flex; align-items: center; }
.search-clear:hover { color: #6e6e73; }
.search-btn { display: inline-flex; align-items: center; gap: 6px; border: none; background: var(--c-primary); color: #fff; padding: 9px 18px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s; font-family: inherit; white-space: nowrap; }
.search-btn:hover { background: #2563eb; }
.toolbar-actions { display: flex; align-items: center; gap: 12px; }
/* ---- 列表场景列 ---- */
.cell-scenes { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.scene-chip { padding: 0 6px; font-size: 12px; line-height: 20px; border-radius: 5px; white-space: nowrap; }
.scene-chip-displayScene { color: #0a6cff; background: rgba(10, 132, 255, 0.1); }
.scene-chip-requiredScene { color: #d70015; background: rgba(255, 59, 48, 0.1); }
.scene-chip-issueType { color: #6e4bd8; background: rgba(175, 82, 222, 0.1); }
.scene-chip-editableScene { color: #248a3d; background: rgba(52, 199, 89, 0.12); }
.filter-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: -4px 0 16px; }
.filter-select { width: 128px; }
.filter-select-wide { width: 180px; }
.filter-select :deep(.ant-select-selector) { border-radius: 10px !important; }
.filter-reset { padding: 4px 8px; border: none; background: transparent; color: var(--c-primary); font-size: 13px; cursor: pointer; font-family: inherit; border-radius: 8px; }
.filter-reset:hover { background: color-mix(in srgb, var(--c-primary) 8%, transparent); }
.delete-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: 1px solid #e5e5ea; background: #fff; color: #ff3b30; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.delete-btn:hover:not(:disabled) { background: #fff1f0; border-color: #ff3b30; }
.delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.delete-btn .badge { color: #ff3b30; font-weight: 700; }
.create-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; background: #1d1d1f; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.create-btn:hover { background: #333; transform: scale(1.02); }

/* ---- stats ---- */
.stats-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-shrink: 0; }
.stat-item { display: flex; align-items: baseline; gap: 6px; }
.stat-value { font-size: 22px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.3px; }
.stat-label { font-size: 13px; color: #86868b; font-weight: 500; }
.stat-green { color: #34c759; }
.stat-blue { color: var(--c-primary); }
.stat-divider { width: 1px; height: 20px; background: #e5e5ea; }

/* ---- table ---- */
.table-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  overflow: hidden;
}

/* 表格自身撑满剩余高度并内部滚动（兼容 antd 拆分表头的结构） */
.table-wrapper :deep(.ant-table-wrapper),
.table-wrapper :deep(.ant-spin-nested-loading),
.table-wrapper :deep(.ant-spin-container),
.table-wrapper :deep(.ant-table),
.table-wrapper :deep(.ant-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 设置了 scroll.x 时 header / body 已拆分：表头固定，表体滚动 */
.table-wrapper :deep(.ant-table-header) {
  flex: none;
  overflow: hidden;
}
.table-wrapper :deep(.ant-table-body) {
  flex: 1;
  min-height: 0;
  overflow: auto !important;
}
/* 未拆分时整表滚动，表头吸顶 */
.table-wrapper :deep(.ant-table-content) {
  flex: 1;
  min-height: 0;
}
.table-wrapper :deep(.ant-table-thead > tr > th) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fafafa;
}
.cell-field-name { font-weight: 600; color: #1d1d1f; }

.cell-operators { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.cell-muted { color: #aeaeb2; }
:deep(.cell-user) { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; }
:deep(.cell-user-avatar) {
  width: 18px; height: 18px; border-radius: 50%; object-fit: cover;
  flex-shrink: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}
:deep(.cell-user-avatar-text) {
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 9px; font-weight: 700; user-select: none;
}
:deep(.cell-user-name) {
  color: #1f1f1f; font-size: 13px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}

/* ---- pagination ---- */
.pagination-bar { display: flex; justify-content: flex-end; padding: 24px 0 0; flex-shrink: 0; }

</style>
