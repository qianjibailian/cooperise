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

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ totalCount }}</span><span class="stat-label">字段总数</span></div>
      <template v-if="showSystemColumn">
        <div class="stat-divider" />
        <div class="stat-item"><span class="stat-value stat-green">{{ systemCount }}</span><span class="stat-label">系统字段</span></div>
      </template>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-blue">{{ activeCount }}</span><span class="stat-label">生效中</span></div>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <a-table
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
          <template v-else-if="column.key === 'required'">
            <a-tag :color="record.isRequired ? 'red' : 'default'">{{ record.isRequired ? '是' : '否' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'isSystem'">
            <a-tag :color="record.isSystem ? 'purple' : 'default'">{{ record.isSystem ? '系统' : '自定义' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'obsolete'">
            <a-tag :color="record.obsolete ? 'red' : 'green'">{{ record.obsolete ? '已废弃' : '生效中' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'supportOperator'">
            <span v-if="record.supportOperator && record.supportOperator.length" class="cell-operators">
              <a-tag v-for="op in record.supportOperator" :key="op" size="small">{{ op }}</a-tag>
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
    <a-modal
      v-model:open="showEditModal"
      :title="isEdit ? '编辑字段' : '新增字段'"
      width="680px"
      :footer="null"
      destroy-on-close
      class="edit-modal"
    >
      <a-form :model="editForm" layout="vertical">
        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="字段名称" required>
              <a-input v-model:value="editForm.fieldName" placeholder="输入字段名称" size="large" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="字段编号">
              <a-input v-model:value="editForm.fieldNumId" placeholder="字段编号" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="字段分组">
              <a-select v-model:value="editForm.fieldGroup" placeholder="选择字段分组" size="large" allow-clear style="width: 100%">
                <a-select-option v-for="g in fieldGroupOptions" :key="g.value" :value="g.value">{{ g.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="字段类型">
              <a-select v-model:value="editForm.type" placeholder="选择字段类型" size="large" allow-clear style="width: 100%">
                <a-select-option v-for="t in fieldTypeOptions" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 选项配置：单选下拉 / 多选下拉 / 级联选择器 -->
        <template v-if="isEnumType">
          <a-form-item :label="isCascaderType ? '级联选项配置 (fieldValue)' : '选项配置 (fieldValue)'">
            <div class="enum-options-editor">
              <div class="enum-options-header">
                <span class="opt-col">选项名称</span>
                <span class="opt-col">选项值</span>
                <span v-if="isColorableType" class="opt-col opt-color-col">颜色</span>
                <span class="opt-col opt-action-col">操作</span>
              </div>
              <div v-for="(opt, idx) in enumOptions" :key="idx" class="enum-option-row">
                <div class="enum-option-inputs">
                  <a-input
                    v-model:value="opt.label"
                    :placeholder="isCascaderType ? '一级选项名称' : '选项名称'"
                    @input="onEnumOptionChange"
                  />
                  <a-input
                    v-model:value="opt.value"
                    :placeholder="isCascaderType ? '一级选项值' : '选项值'"
                    @input="onEnumOptionChange"
                  />
                  <div
                    v-if="isColorableType"
                    class="enum-option-color-wrap"
                    title="选项颜色"
                  >
                    <input
                      type="color"
                      class="enum-option-color-input"
                      :value="opt.color || '#1677ff'"
                      @input="onColorInput(opt, $event)"
                    />
                    <span
                      v-if="opt.color"
                      class="enum-option-color-clear"
                      title="清除颜色"
                      @click="opt.color = ''; onEnumOptionChange()"
                    >×</span>
                  </div>
                  <a-button
                    type="text"
                    danger
                    size="small"
                    @click="removeEnumOption(idx)"
                  >
                    <MinusCircleOutlined />
                  </a-button>
                </div>
                <!-- 级联子选项 -->
                <div v-if="isCascaderType && opt.children && opt.children.length" class="enum-option-children">
                  <div v-for="(child, cIdx) in opt.children" :key="cIdx" class="enum-option-row child">
                    <div class="enum-option-inputs">
                      <a-input
                        v-model:value="child.label"
                        placeholder="二级选项名称"
                        @input="onEnumOptionChange"
                      />
                      <a-input
                        v-model:value="child.value"
                        placeholder="二级选项值"
                        @input="onEnumOptionChange"
                      />
                      <a-button
                        type="text"
                        danger
                        size="small"
                        @click="removeCascaderChild(idx, cIdx)"
                      >
                        <MinusCircleOutlined />
                      </a-button>
                    </div>
                  </div>
                </div>
                <a-button
                  v-if="isCascaderType"
                  type="dashed"
                  size="small"
                  block
                  style="margin-top: 4px"
                  @click="addCascaderChild(idx)"
                >+ 添加二级选项</a-button>
              </div>
              <a-button type="dashed" block style="margin-top: 8px" @click="addEnumOption">+ 添加选项</a-button>
            </div>
          </a-form-item>
        </template>

        <a-form-item label="支持的操作符 (supportOperator)">
          <a-select
            v-model:value="editForm.supportOperator"
            mode="tags"
            placeholder="输入操作符后回车，如 EQ / NE / LIKE"
            style="width: 100%"
          />
        </a-form-item>
        <a-row :gutter="24">
          <a-col :span="6">
            <a-form-item label="必填">
              <a-switch v-model:checked="editForm.isRequired" checked-children="是" un-check-children="否" />
            </a-form-item>
          </a-col>
          <a-col v-if="props.showSystemSwitch" :span="6">
            <a-form-item label="系统字段">
              <a-switch v-model:checked="editForm.isSystem" checked-children="是" un-check-children="否" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="已废弃">
              <a-switch v-model:checked="editForm.obsolete" checked-children="是" un-check-children="否" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <!-- 预览区 -->
      <div class="preview-section">
        <div class="preview-title">预览</div>
        <div class="preview-body">
          <div class="preview-row">
            <span class="preview-label">
              <span v-if="editForm.isRequired" class="preview-required-mark">*</span>
              <span v-if="editForm.fieldName" class="preview-label-text">{{ editForm.fieldName }}</span>
              <span v-else class="preview-label-placeholder">字段名称</span>
            </span>
            <div class="preview-control">
              <a-input
                v-if="isType(FIELD_TYPE.TEXT_BOX_SINGLE_LINE)"
                placeholder="请输入"
                :disabled="!editForm.fieldName"
              />
              <a-textarea
                v-else-if="isType(FIELD_TYPE.TEXT_BOX_MULTI_LINE)"
                placeholder="请输入"
                :rows="4"
                :disabled="!editForm.fieldName"
              />
              <a-input-number
                v-else-if="isType(FIELD_TYPE.TEXT_BOX_NUMBER)"
                placeholder="请输入数字"
                :disabled="!editForm.fieldName"
              />
              <a-date-picker
                v-else-if="isType(FIELD_TYPE.DATE_PICKER)"
                :disabled="!editForm.fieldName"
              />
              <a-date-picker
                v-else-if="isType(FIELD_TYPE.TIME_PICKER)"
                show-time
                :disabled="!editForm.fieldName"
              />
              <a-select
                v-else-if="isType(FIELD_TYPE.SELECT_LIST_SINGLE)"
                placeholder="请选择"
                :disabled="!editForm.fieldName"
                allow-clear
              >
                <a-select-option v-for="opt in enumOptions" :key="opt.value" :value="opt.value">
                  <span class="preview-option-item">
                    <span v-if="opt.color" class="preview-option-dot" :style="{ background: opt.color }" />
                    <span :style="opt.color ? { color: opt.color } : {}">{{ opt.label }}</span>
                  </span>
                </a-select-option>
              </a-select>
              <a-select
                v-else-if="isType(FIELD_TYPE.SELECT_LIST_MULTI)"
                placeholder="请选择"
                :disabled="!editForm.fieldName"
                allow-clear
                mode="multiple"
              >
                <a-select-option v-for="opt in enumOptions" :key="opt.value" :value="opt.value">
                  <span class="preview-option-item">
                    <span v-if="opt.color" class="preview-option-dot" :style="{ background: opt.color }" />
                    <span :style="opt.color ? { color: opt.color } : {}">{{ opt.label }}</span>
                  </span>
                </a-select-option>
              </a-select>
              <a-cascader
                v-else-if="isType(FIELD_TYPE.CASCADER_SINGLE)"
                placeholder="请选择"
                :disabled="!editForm.fieldName"
                allow-clear
                :options="enumOptions"
                :field-names="{ label: 'label', value: 'value', children: 'children' }"
              />
              <a-select
                v-else-if="isType(FIELD_TYPE.SELECT_USER_SINGLE)"
                placeholder="请选择成员"
                show-search
                :disabled="!editForm.fieldName"
                allow-clear
              />
              <a-select
                v-else-if="isType(FIELD_TYPE.SELECT_USER_MULTI)"
                placeholder="请选择成员"
                show-search
                :disabled="!editForm.fieldName"
                allow-clear
                mode="multiple"
              />
              <a-textarea
                v-else-if="isType(FIELD_TYPE.RICH_TEXT)"
                placeholder="请输入描述"
                :rows="4"
                :disabled="!editForm.fieldName"
              />
              <span
                v-else-if="isType(FIELD_TYPE.LABEL)"
                class="display-text-preview"
              >{{ editForm.fieldName ? '这是展示文本内容' : '展示文本' }}</span>
              <a-input
                v-else
                placeholder="请先选择字段类型"
                disabled
              />
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <a-space>
          <a-button @click="showEditModal = false">取消</a-button>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">保存</a-button>
        </a-space>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue'
import { Modal } from 'ant-design-vue'
import {
  SearchOutlined, CloseCircleFilled, PlusOutlined,
  EditOutlined, DeleteOutlined, MinusCircleOutlined,
} from '@ant-design/icons-vue'
import {
  queryAvailableFields, createAvailableField, updateAvailableField,
  batchDeleteAvailableFields, getAvailableFieldDetail,
} from '@/api/faiz'
import type { AvailableFieldItem, AvailableFieldSavePayload, EnumOptionItem } from '@/types/faiz'
import {
  FIELD_TYPE, fieldTypeOptions, formatTypeLabel, typeTagColor, isEnumFieldType, defaultFieldGroupByType,
} from '@/types/fieldType'

// ---- 组件 props：可选字段与系统字段共用，通过 fieldApi 注入不同的接口实现 ----
/** 通用字段行结构（兼容 AvailableFieldItem 与 SystemFieldItem） */
interface FieldRow {
  id?: string
  fieldId?: string
  fieldName?: string
  type?: string
  /** 后端返回的原始类型字段（系统字段 VO 为 filedType，可选字段两者都有） */
  filedType?: string
  fieldGroup?: string
  isRequired?: boolean
  obsolete?: boolean
  isSystem?: boolean
  supportOperator?: string[]
  configSchema?: string | null
  fieldValue?: string | null
  /** 系统字段特有：启用状态、创建人/更新人、创建/更新时间 */
  status?: boolean
  creator?: string | null
  updater?: string | null
  createTime?: string | null
  updateTime?: string | null
}

interface FieldApi {
  query: (params: { page: number; pageSize: number; searchKey?: string }) => Promise<{ success?: boolean; data?: { list?: FieldRow[]; total?: number } }>
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
  /** 是否展示「新增字段」按钮（系统字段内置，不可新增，默认展示） */
  showCreate?: boolean
  /** 是否展示操作列「编辑」按钮（系统字段内置，不可编辑，默认展示） */
  showEdit?: boolean
  /** 是否展示表单「系统字段」开关（自定义字段固定为自定义，默认不展示） */
  showSystemSwitch?: boolean
  /** 是否展示元信息列：创建人/更新人/创建时间/更新时间（默认展示，与系统字段页面一致） */
  showMetaColumns?: boolean
}>(), {
  showSystemColumn: false,
  showCreate: true,
  showEdit: true,
  showSystemSwitch: false,
  showMetaColumns: true,
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

// ---- 字段分组选项 ----
const fieldGroupOptions = [
  { value: 'PERSON', label: '人员信息' },
  { value: 'DESCRIPTION', label: '描述' },
  { value: 'TIME', label: '时间信息' },
  { value: 'CUSTOM_FIELD', label: '自定义字段' },
  { value: 'SUBJECT', label: '主内容' },
]

// 需要配置选项的类型 / 类型相关判定，均来自 @/types/fieldType 统一维护
const isEnumType = computed(() => isEnumFieldType(editForm.value.type))
const isCascaderType = computed(() => editForm.value.type === FIELD_TYPE.CASCADER_SINGLE)
/** 支持为枚举值配置颜色的类型（单选/多选下拉，级联不配置） */
const isColorableType = computed(
  () => editForm.value.type === FIELD_TYPE.SELECT_LIST_SINGLE || editForm.value.type === FIELD_TYPE.SELECT_LIST_MULTI,
)

function isType(...vals: string[]) {
  return vals.includes(editForm.value.type as string)
}

// ---- 表格列定义（系统字段页面隐藏「系统字段」列） ----
const baseColumns = [
  { title: '字段名称', dataIndex: 'fieldName', key: 'fieldName', width: 180, ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '必填', dataIndex: 'required', key: 'required', width: 70 },
  { title: '系统字段', dataIndex: 'isSystem', key: 'isSystem', width: 90 },
  { title: '状态', dataIndex: 'obsolete', key: 'obsolete', width: 80 },
  { title: '操作符', dataIndex: 'supportOperator', key: 'supportOperator', width: 200 },
]
const metaColumns = [
  { title: '创建人', dataIndex: 'creator', key: 'creator', width: 120 },
  { title: '更新人', dataIndex: 'updater', key: 'updater', width: 120 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 170 },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime', width: 170 },
]
const columns = computed(() => {
  let list = props.showSystemColumn ? baseColumns : baseColumns.filter(c => c.key !== 'isSystem')
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

const showEditModal = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const editingId = ref<string>('')

const selectedRowKeys = ref<string[]>([])
function onSelectChange(keys: string[]) {
  selectedRowKeys.value = keys
}

const editForm = ref<AvailableFieldSavePayload & { supportOperator: string[] }>({
  fieldNumId: '',
  fieldName: '',
  fieldGroup: '',
  type: '',
  supportOperator: [],
  isSystem: false,
  obsolete: false,
  isRequired: false,
  configSchema: '',
  fieldValue: '',
})

// ---- 选项配置（单选/多选/级联） ----
const enumOptions = ref<EnumOptionItem[]>([])

function parseFieldValue(schema: string | null | undefined): EnumOptionItem[] {
  if (!schema) return []
  try {
    const parsed = JSON.parse(schema)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch { return [] }
}

function syncFieldValue() {
  if (isEnumType.value) {
    const cleaned = enumOptions.value.filter(o => o.label?.trim() || o.value?.trim())
    editForm.value.fieldValue = JSON.stringify(cleaned)
  } else {
    editForm.value.fieldValue = ''
  }
}

function addEnumOption() {
  enumOptions.value.push({ label: '', value: '', color: '' })
  syncFieldValue()
}

/** 选项颜色输入：写入 hex 色值并同步到 fieldValue */
function onColorInput(opt: EnumOptionItem, e: Event) {
  opt.color = (e.target as HTMLInputElement).value
  syncFieldValue()
}

function removeEnumOption(index: number) {
  enumOptions.value.splice(index, 1)
  syncFieldValue()
}

function addCascaderChild(parentIndex: number) {
  const parent = enumOptions.value[parentIndex]
  if (!parent.children) parent.children = []
  parent.children.push({ label: '', value: '' })
  syncFieldValue()
}

function removeCascaderChild(parentIndex: number, childIndex: number) {
  const parent = enumOptions.value[parentIndex]
  parent.children?.splice(childIndex, 1)
  syncFieldValue()
}

function onEnumOptionChange() {
  syncFieldValue()
}

watch(isEnumType, (val) => {
  if (!val) {
    enumOptions.value = []
  }
  syncFieldValue()
})

// ---- 字段类型 → 默认分组映射（选择类型时自动带出分组） ----
watch(() => editForm.value.type, (val) => {
  const group = defaultFieldGroupByType(val)
  if (group) {
    editForm.value.fieldGroup = group
  }
})

// ---- 计算属性 ----
const systemCount = computed(() => tableData.value.filter(r => r.isSystem).length)
const activeCount = computed(() => tableData.value.filter(r => !r.obsolete).length)

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
  const name = String(obj.coAccount ?? obj.userCoAccount ?? obj.userEnName ?? obj.displayName ?? obj.name ?? obj.userNo ?? '')
  if (!name) return null
  const idPart = obj.id || obj.userId || obj.userNo ? String(obj.id ?? obj.userId ?? obj.userNo ?? '') : ''
  const firstLetter = name.trim().charAt(0).toUpperCase()
  const avatar = String(obj.avatarUrl ?? obj.userAvatar ?? '')
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

/** 用户单元格：头像（无头像显示渐变首字母）+ 名称（工号） */
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
    })
    if (res.success) {
      tableData.value = (res.data?.list as unknown as AvailableFieldItem[]) || []
      totalCount.value = res.data?.total || 0
    }
  } catch {
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  page.value = 1
  loadFields()
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

// ---- CRUD ----
function resetEditForm() {
  editForm.value = {
    fieldNumId: '',
    fieldName: '',
    fieldGroup: '',
    type: '',
    supportOperator: [],
    isSystem: false,
    obsolete: false,
    isRequired: false,
    configSchema: '',
    fieldValue: '',
  }
  enumOptions.value = []
}

function handleCreate() {
  isEdit.value = false
  editingId.value = ''
  resetEditForm()
  showEditModal.value = true
}

async function handleEdit(record: AvailableFieldItem) {
  isEdit.value = true
  editingId.value = record.id
  showEditModal.value = true
  try {
    const res = await fieldApi.value.getDetail(record.id)
    if (res.success && res.data) {
      const d = res.data as unknown as AvailableFieldItem
      editForm.value = {
        fieldNumId: d.fieldId || '',
        fieldName: d.fieldName || '',
        fieldGroup: d.fieldGroup || '',
        type: d.type || d.filedType || '',
        supportOperator: d.supportOperator ? [...d.supportOperator] : [],
        isSystem: d.isSystem ?? false,
        obsolete: d.obsolete ?? false,
        isRequired: d.isRequired ?? false,
        configSchema: d.configSchema || '',
        fieldValue: d.fieldValue || '',
      }
      enumOptions.value = parseFieldValue(d.fieldValue)
    }
  } catch (e) {
    // 失败则使用表格中的兜底数据
    editForm.value = {
      fieldNumId: record.fieldId || '',
      fieldName: record.fieldName || '',
      fieldGroup: record.fieldGroup || '',
      type: record.type || record.filedType || '',
      supportOperator: record.supportOperator ? [...record.supportOperator] : [],
      isSystem: record.isSystem ?? false,
      obsolete: record.obsolete ?? false,
      isRequired: record.isRequired ?? false,
      configSchema: record.configSchema || '',
      fieldValue: record.fieldValue || '',
    }
    enumOptions.value = parseFieldValue(record.fieldValue)
  }
}

async function handleSubmit() {
  if (!editForm.value.fieldName?.trim()) {
    return
  }
  submitting.value = true
  try {
    const payload: AvailableFieldSavePayload = { ...editForm.value }
    if (isEdit.value && editingId.value) {
      await fieldApi.value.update(editingId.value, payload)
    } else {
      await fieldApi.value.create(payload)
    }
    showEditModal.value = false
    loadFields()
  } catch {
  } finally {
    submitting.value = false
  }
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

onMounted(loadFields)
</script>

<style scoped>
.component-list-page {
  padding: 0 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
}

/* ---- toolbar ---- */
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.toolbar-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; flex-wrap: wrap; }
.search-box { flex: 1; min-width: 260px; position: relative; display: flex; align-items: center; background: #f5f5f7; border-radius: 14px; transition: background 0.2s, box-shadow 0.2s; }
.search-box:focus-within { background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
.search-icon { font-size: 16px; color: #86868b; margin-left: 14px; flex-shrink: 0; }
.search-input { flex: 1; border: none; background: transparent; padding: 11px 12px 11px 10px; font-size: 15px; color: #1d1d1f; outline: none; font-family: inherit; }
.search-input::placeholder { color: #aeaeb2; }
.search-clear { padding: 0 12px; cursor: pointer; color: #aeaeb2; font-size: 16px; display: flex; align-items: center; }
.search-clear:hover { color: #6e6e73; }
.search-btn { display: inline-flex; align-items: center; gap: 6px; border: none; background: #3b82f6; color: #fff; padding: 9px 18px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s; font-family: inherit; white-space: nowrap; }
.search-btn:hover { background: #2563eb; }
.toolbar-actions { display: flex; align-items: center; gap: 12px; }
.delete-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: 1px solid #e5e5ea; background: #fff; color: #ff3b30; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.delete-btn:hover:not(:disabled) { background: #fff1f0; border-color: #ff3b30; }
.delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.delete-btn .badge { color: #ff3b30; font-weight: 700; }
.create-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; background: #1d1d1f; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.create-btn:hover { background: #333; transform: scale(1.02); }

/* ---- stats ---- */
.stats-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.stat-item { display: flex; align-items: baseline; gap: 6px; }
.stat-value { font-size: 22px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.3px; }
.stat-label { font-size: 13px; color: #86868b; font-weight: 500; }
.stat-green { color: #34c759; }
.stat-blue { color: #007aff; }
.stat-divider { width: 1px; height: 20px; background: #e5e5ea; }

/* ---- table ---- */
.table-wrapper { background: #fff; border-radius: 14px; border: 1px solid #f0f0f0; overflow: hidden; }
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
.pagination-bar { display: flex; justify-content: flex-end; padding-top: 24px; }

/* ---- edit modal ---- */
.edit-modal :deep(.ant-modal-content) { border-radius: 20px; }
.edit-modal :deep(.ant-modal-header) { padding: 24px 28px 0; border-bottom: none; }
.edit-modal :deep(.ant-modal-title) { font-size: 18px; font-weight: 700; color: #1d1d1f; }
.edit-modal :deep(.ant-modal-body) { padding: 20px 28px 28px; }
.edit-modal :deep(.ant-form-item) { margin-bottom: 16px; }
.edit-modal :deep(.ant-input),
.edit-modal :deep(.ant-select-selector),
.edit-modal :deep(.ant-input-number) { border-radius: 10px; }
.modal-footer { display: flex; justify-content: flex-end; padding-top: 24px; margin-top: 8px; border-top: 1px solid #f5f5f7; }
.preview-section { margin-top: 20px; padding: 16px; background: #f9f9fb; border: 1px dashed #d9d9d9; border-radius: 12px; }
.preview-title { font-size: 13px; font-weight: 600; color: #86868b; margin-bottom: 12px; letter-spacing: 0.5px; }
.preview-body { background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #f0f0f0; }
.preview-row { display: flex; align-items: flex-start; width: 100%; }
.preview-label { flex: 0 0 100px; width: 100px; padding-right: 12px; display: flex; align-items: center; height: 34px; font-size: 13px; color: #1d1d1f; font-weight: 500; }
.preview-label-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-label-placeholder { color: #bfbfbf; }
.preview-required-mark { color: #ff4d4f; font-weight: 600; margin-right: 2px; }
.preview-control { flex: 1 1 auto; min-width: 0; width: 100%; }
.preview-control :deep(.ant-input),
.preview-control :deep(.ant-select),
.preview-control :deep(.ant-select-selector),
.preview-control :deep(.ant-input-number),
.preview-control :deep(.ant-picker),
.preview-control :deep(.ant-cascader),
.preview-control :deep(.ant-input-affix-wrapper) { width: 100% !important; }
.preview-control :deep(.ant-input-number-input) { width: 100%; }
.preview-control :deep(textarea.ant-input) { width: 100%; height: auto; min-height: 80px; }
.preview-control :deep(.ant-switch) { margin-top: 4px; }
.display-text-preview { display: inline-block; padding: 4px 0; color: #262626; font-size: 14px; line-height: 1.5; }

/* 选项编辑器样式 */
.enum-options-editor { width: 100%; }
.enum-options-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.enum-options-header .opt-col { flex: 1; font-size: 12px; color: #86868b; font-weight: 600; }
.enum-options-header .opt-color-col { flex: 0 0 92px; }
.enum-options-header .opt-action-col { flex: 0 0 40px; }
.enum-option-color-wrap { flex: 0 0 92px; display: flex; align-items: center; gap: 6px; }
.enum-option-color-input {
  width: 36px; height: 26px; padding: 2px; border: 1px solid #d9d9d9; border-radius: 4px;
  background: transparent; cursor: pointer; flex: none;
}
.enum-option-color-input::-webkit-color-swatch-wrapper { padding: 2px; }
.enum-option-color-input::-webkit-color-swatch { border: none; border-radius: 2px; }
.enum-option-color-clear {
  flex: none; width: 16px; height: 16px; line-height: 14px; text-align: center;
  border-radius: 50%; color: #86868b; cursor: pointer; font-size: 14px; user-select: none;
}
.enum-option-color-clear:hover { color: #ff4d4f; background: #fff1f0; }
.preview-option-item { display: inline-flex; align-items: center; gap: 6px; }
.preview-option-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex: none; }
.enum-option-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.enum-option-row.child { margin-bottom: 6px; padding-left: 24px; border-left: 2px solid #e8e8e8; }
.enum-option-inputs { display: flex; gap: 8px; align-items: center; }
.enum-option-inputs .ant-input { flex: 1; min-width: 0; }
.enum-option-inputs .ant-btn { flex: 0 0 auto; }
.enum-option-children { margin-top: 4px; }
</style>
