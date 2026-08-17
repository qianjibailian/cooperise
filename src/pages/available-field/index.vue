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
        <button class="create-btn" @click="handleCreate">
          <PlusOutlined /><span>新增字段</span>
        </button>
      </div>
    </div>

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ totalCount }}</span><span class="stat-label">字段总数</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-green">{{ systemCount }}</span><span class="stat-label">系统字段</span></div>
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
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'fieldName'">
            <span class="cell-field-name">{{ record.fieldName }}</span>
          </template>
          <template v-else-if="column.key === 'type'">
            <a-tag :color="typeTagColor(record.type)">{{ formatTypeLabel(record.type) }}</a-tag>
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
          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="handleEdit(record)"><EditOutlined /> 编辑</a-button>
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
        v-model:page-size="perPage"
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
            <a-form-item label="字段类型 (type)">
              <a-select v-model:value="editForm.type" placeholder="选择字段类型" size="large" allow-clear style="width: 100%">
                <a-select-option v-for="t in fieldTypeOptions" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="枚举设置类型 (enumSettingType)">
              <a-input v-model:value="editForm.enumSettingType" placeholder="enumSettingType" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="字段数字ID (fieldNumId)">
              <a-input v-model:value="editForm.fieldNumId" placeholder="fieldNumId" style="width: 100%" />
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
          <a-col :span="6">
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
                v-if="isType('INPUT_TEXT')"
                placeholder="请输入"
                :disabled="!editForm.fieldName"
              />
              <a-input-number
                v-else-if="isType('INPUT_NUMBER')"
                placeholder="请输入数字"
                :disabled="!editForm.fieldName"
              />
              <a-date-picker
                v-else-if="isType('DATE')"
                :disabled="!editForm.fieldName"
              />
              <a-date-picker
                v-else-if="isType('DATETIME')"
                show-time
                :disabled="!editForm.fieldName"
              />
              <a-select
                v-else-if="isType('SINGLE_SELECT')"
                placeholder="请选择"
                :disabled="!editForm.fieldName"
                allow-clear
              >
                <a-select-option v-for="opt in enumOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
              </a-select>
              <a-select
                v-else-if="isType('MULTI_SELECT')"
                placeholder="请选择"
                :disabled="!editForm.fieldName"
                allow-clear
                mode="multiple"
              >
                <a-select-option v-for="opt in enumOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
              </a-select>
              <a-cascader
                v-else-if="isType('CASCADER')"
                placeholder="请选择"
                :disabled="!editForm.fieldName"
                allow-clear
                :options="enumOptions"
                :field-names="{ label: 'label', value: 'value', children: 'children' }"
              />
              <a-select
                v-else-if="isType('USER_SINGLE_SELECT')"
                placeholder="请选择成员"
                show-search
                :disabled="!editForm.fieldName"
                allow-clear
              />
              <a-select
                v-else-if="isType('USER_MULTI_SELECT')"
                placeholder="请选择成员"
                show-search
                :disabled="!editForm.fieldName"
                allow-clear
                mode="multiple"
              />
              <a-textarea
                v-else-if="isType('RICH_TEXT')"
                placeholder="请输入描述"
                :rows="4"
                :disabled="!editForm.fieldName"
              />
              <span
                v-else-if="isType('DISPLAY_TEXT')"
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
import { ref, computed, onMounted, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  SearchOutlined, CloseCircleFilled, PlusOutlined,
  EditOutlined, DeleteOutlined, MinusCircleOutlined,
} from '@ant-design/icons-vue'
import {
  queryAvailableFields, createAvailableField, updateAvailableField, deleteAvailableField,
  batchDeleteAvailableFields, getAvailableFieldDetail,
} from '@/api/faiz'
import type { AvailableFieldItem, AvailableFieldSavePayload, EnumOptionItem } from '@/types/faiz'

// ---- 字段类型选项 ----
const fieldTypeOptions = [
  { value: 'INPUT_TEXT', label: '文本输入框' },
  { value: 'INPUT_NUMBER', label: '数字输入框' },
  { value: 'DATE', label: '日期' },
  { value: 'DATETIME', label: '日期时间' },
  { value: 'SINGLE_SELECT', label: '单选下拉' },
  { value: 'MULTI_SELECT', label: '多选下拉' },
  { value: 'CASCADER', label: '级联选择器' },
  { value: 'USER_SINGLE_SELECT', label: '人员单选' },
  { value: 'USER_MULTI_SELECT', label: '人员多选' },
  { value: 'RICH_TEXT', label: '富文本' },
  { value: 'DISPLAY_TEXT', label: '展示文本' },
]

// 需要配置选项的类型
const ENUM_TYPES = ['SINGLE_SELECT', 'MULTI_SELECT', 'CASCADER']
const isEnumType = computed(() => ENUM_TYPES.includes(editForm.value.type as string))
const isCascaderType = computed(() => editForm.value.type === 'CASCADER')
// type 值 → 中文标签
const TYPE_LABEL_MAP: Record<string, string> = fieldTypeOptions.reduce(
  (acc, t) => { acc[t.value] = t.label; return acc },
  {} as Record<string, string>,
)
function formatTypeLabel(type?: string | null): string {
  if (!type) return '-'
  return TYPE_LABEL_MAP[type] || type
}

function typeTagColor(type?: string | null): string {
  const colorMap: Record<string, string> = {
    INPUT_TEXT: 'default',
    INPUT_NUMBER: 'green',
    DATE: 'blue',
    DATETIME: 'cyan',
    SINGLE_SELECT: 'purple',
    MULTI_SELECT: 'magenta',
    CASCADER: 'gold',
    USER_SINGLE_SELECT: 'lime',
    USER_MULTI_SELECT: 'lime',
    RICH_TEXT: 'red',
    DISPLAY_TEXT: 'geekblue',
  }
  return colorMap[type || ''] || 'default'
}

function isType(...vals: string[]) {
  return vals.includes(editForm.value.type as string)
}

// ---- 表格列定义 ----
const columns = [
  { title: '字段名称', dataIndex: 'fieldName', key: 'fieldName', width: 180, ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '必填', dataIndex: 'required', key: 'required', width: 70 },
  { title: '系统字段', dataIndex: 'isSystem', key: 'isSystem', width: 90 },
  { title: '状态', dataIndex: 'obsolete', key: 'obsolete', width: 80 },
  { title: '操作符', dataIndex: 'supportOperator', key: 'supportOperator', width: 200 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 160 },
]

// ---- 状态 ----
const searchValue = ref('')
const tableData = ref<AvailableFieldItem[]>([])
const totalCount = ref(0)
const page = ref(1)
const perPage = ref(10)
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
  type: '',
  supportOperator: [],
  isSystem: false,
  enumSettingType: '',
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
  enumOptions.value.push({ label: '', value: '' })
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

// ---- 计算属性 ----
const systemCount = computed(() => tableData.value.filter(r => r.isSystem).length)
const activeCount = computed(() => tableData.value.filter(r => !r.obsolete).length)

// ---- 数据加载 ----
async function loadFields() {
  loading.value = true
  try {
    const res = await queryAvailableFields({
      page: page.value,
      perPage: perPage.value,
      searchKey: searchValue.value.trim() || undefined,
    })
    if (res.success) {
      tableData.value = res.data?.list || []
      totalCount.value = res.data?.total || 0
    }
  } catch {
    message.error('加载字段列表失败')
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
  perPage.value = size
  loadFields()
}

function handleSizeChange(_cur: number, size: number) {
  page.value = 1
  perPage.value = size
  loadFields()
}

// ---- CRUD ----
function resetEditForm() {
  editForm.value = {
    fieldNumId: '',
    fieldName: '',
    type: '',
    supportOperator: [],
    isSystem: false,
    enumSettingType: '',
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
    const res = await getAvailableFieldDetail(record.id)
    if (res.success && res.data) {
      const d: AvailableFieldItem = res.data
      editForm.value = {
        fieldNumId: d.fieldId || '',
        fieldName: d.fieldName || '',
        type: d.type || '',
        supportOperator: d.supportOperator ? [...d.supportOperator] : [],
        isSystem: d.isSystem ?? false,
        enumSettingType: d.enumSettingType || '',
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
      type: record.type || '',
      supportOperator: record.supportOperator ? [...record.supportOperator] : [],
      isSystem: record.isSystem ?? false,
      enumSettingType: record.enumSettingType || '',
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
    message.warning('请输入字段名称')
    return
  }
  submitting.value = true
  try {
    const payload: AvailableFieldSavePayload = { ...editForm.value }
    if (isEdit.value && editingId.value) {
      const res = await updateAvailableField(editingId.value, payload)
      if (res.success) message.success('更新成功')
      else message.error(res.message || '更新失败')
    } else {
      const res = await createAvailableField(payload)
      if (res.success) message.success('创建成功')
      else message.error(res.message || '创建失败')
    }
    showEditModal.value = false
    loadFields()
  } catch {
    message.error(isEdit.value ? '更新失败' : '创建失败')
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
        const res = await deleteAvailableField(record.id)
        if (res.success) { message.success('已删除'); loadFields() }
        else message.error(res.message || '删除失败')
      } catch { message.error('删除失败') }
    },
  })
}

function handleBatchDelete() {
  if (!selectedRowKeys.value.length) {
    message.warning('请先勾选要删除的字段')
    return
  }
  Modal.confirm({
    title: '批量删除字段',
    content: `确定要删除选中的 ${selectedRowKeys.value.length} 个字段吗？删除后不可恢复。`,
    okText: '删除', cancelText: '取消', okType: 'danger',
    onOk: async () => {
      try {
        const ids = selectedRowKeys.value.map(k => Number(k)).filter(n => !Number.isNaN(n))
        const res = await batchDeleteAvailableFields(ids)
        if (res.success) {
          message.success(`已删除 ${ids.length} 个字段`)
          selectedRowKeys.value = []
          loadFields()
        } else {
          message.error(res.message || '批量删除失败')
        }
      } catch { message.error('批量删除失败') }
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
.enum-options-header .opt-action-col { flex: 0 0 40px; }
.enum-option-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.enum-option-row.child { margin-bottom: 6px; padding-left: 24px; border-left: 2px solid #e8e8e8; }
.enum-option-inputs { display: flex; gap: 8px; align-items: center; }
.enum-option-inputs .ant-input { flex: 1; min-width: 0; }
.enum-option-inputs .ant-btn { flex: 0 0 auto; }
.enum-option-children { margin-top: 4px; }
</style>
