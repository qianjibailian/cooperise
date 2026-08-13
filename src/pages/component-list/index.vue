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
            <a-tag color="blue">{{ record.type || '-' }}</a-tag>
            <span v-if="record.typeName" class="cell-type-name">{{ record.typeName }}</span>
          </template>
          <template v-else-if="column.key === 'isSystem'">
            <a-tag :color="record.isSystem ? 'purple' : 'default'">{{ record.isSystem ? '系统' : '自定义' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'frontPage'">
            <a-tag :color="record.frontPage ? 'green' : 'default'">{{ record.frontPage ? '是' : '否' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'orderAble'">
            <a-tag :color="record.orderAble ? 'cyan' : 'default'">{{ record.orderAble ? '可排序' : '不可排序' }}</a-tag>
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
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="字段名称" required>
              <a-input v-model:value="editForm.fieldName" placeholder="输入字段名称" size="large" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="字段类型 (type)">
              <a-select v-model:value="editForm.type" placeholder="选择字段类型" size="large" allow-clear>
                <a-select-option v-for="t in fieldTypeOptions" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="类型名称 (typeName)">
              <a-input v-model:value="editForm.typeName" placeholder="类型显示名称" size="large" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="字段类型标识 (filedType)">
              <a-input v-model:value="editForm.filedType" placeholder="filedType" size="large" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="字段标签 (fieldTag)">
              <a-input v-model:value="editForm.fieldTag" placeholder="字段标签" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="字段来源 (fieldSource)">
              <a-input v-model:value="editForm.fieldSource" placeholder="字段来源" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="ES字段类型 (esFieldType)">
              <a-input v-model:value="editForm.esFieldType" placeholder="esFieldType" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="引用字段ID (referencedFieldId)">
              <a-input v-model:value="editForm.referencedFieldId" placeholder="referencedFieldId" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="枚举设置类型 (enumSettingType)">
              <a-input v-model:value="editForm.enumSettingType" placeholder="enumSettingType" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="字段数字ID (fieldNumId)">
              <a-input v-model:value="editForm.fieldNumId" placeholder="fieldNumId" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="支持的操作符 (supportOperator)">
          <a-select
            v-model:value="editForm.supportOperator"
            mode="tags"
            placeholder="输入操作符后回车，如 EQ / NE / LIKE"
            style="width: 100%"
          />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="6">
            <a-form-item label="系统字段">
              <a-switch v-model:checked="editForm.isSystem" checked-children="是" un-checked-children="否" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="首页字段">
              <a-switch v-model:checked="editForm.frontPage" checked-children="是" un-checked-children="否" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="可排序">
              <a-switch v-model:checked="editForm.orderAble" checked-children="是" un-checked-children="否" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="已废弃">
              <a-switch v-model:checked="editForm.obsolete" checked-children="是" un-checked-children="否" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
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
import { ref, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  SearchOutlined, CloseCircleFilled, PlusOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons-vue'
import {
  queryAvailableFields, createAvailableField, updateAvailableField, deleteAvailableField,
} from '@/api/faiz'
import type { AvailableFieldItem, AvailableFieldSavePayload } from '@/types/faiz'

// ---- 字段类型选项 ----
const fieldTypeOptions = [
  { value: 'STRING', label: '文本 (STRING)' },
  { value: 'NUMBER', label: '数字 (NUMBER)' },
  { value: 'DATE', label: '日期 (DATE)' },
  { value: 'DATETIME', label: '日期时间 (DATETIME)' },
  { value: 'BOOLEAN', label: '布尔 (BOOLEAN)' },
  { value: 'ENUM', label: '枚举 (ENUM)' },
  { value: 'OBJECT', label: '对象 (OBJECT)' },
  { value: 'ARRAY', label: '数组 (ARRAY)' },
  { value: 'USER', label: '成员 (USER)' },
  { value: 'RICH_TEXT', label: '富文本 (RICH_TEXT)' },
]

// ---- 表格列定义 ----
const columns = [
  { title: '字段名称', dataIndex: 'fieldName', key: 'fieldName', width: 180, ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 140 },
  { title: '系统字段', dataIndex: 'isSystem', key: 'isSystem', width: 100 },
  { title: '首页', dataIndex: 'frontPage', key: 'frontPage', width: 80 },
  { title: '可排序', dataIndex: 'orderAble', key: 'orderAble', width: 100 },
  { title: '状态', dataIndex: 'obsolete', key: 'obsolete', width: 100 },
  { title: '操作符', dataIndex: 'supportOperator', key: 'supportOperator', width: 200 },
  { title: '标签', dataIndex: 'fieldTag', key: 'fieldTag', width: 120, ellipsis: true },
  { title: '来源', dataIndex: 'fieldSource', key: 'fieldSource', width: 120, ellipsis: true },
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
  filedType: '',
  type: '',
  typeName: '',
  orderAble: false,
  supportOperator: [],
  isSystem: false,
  frontPage: false,
  esFieldType: '',
  referencedFieldId: '',
  enumSettingType: '',
  obsolete: false,
  fieldTag: '',
  fieldSource: '',
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
    filedType: '',
    type: '',
    typeName: '',
    orderAble: false,
    supportOperator: [],
    isSystem: false,
    frontPage: false,
    esFieldType: '',
    referencedFieldId: '',
    enumSettingType: '',
    obsolete: false,
    fieldTag: '',
    fieldSource: '',
  }
}

function handleCreate() {
  isEdit.value = false
  editingId.value = ''
  resetEditForm()
  showEditModal.value = true
}

function handleEdit(record: AvailableFieldItem) {
  isEdit.value = true
  editingId.value = record.id
  editForm.value = {
    fieldNumId: record.fieldId || '',
    fieldName: record.fieldName || '',
    filedType: record.filedType || '',
    type: record.type || '',
    typeName: record.typeName || '',
    orderAble: record.orderAble ?? false,
    supportOperator: record.supportOperator ? [...record.supportOperator] : [],
    isSystem: record.isSystem ?? false,
    frontPage: record.frontPage ?? false,
    esFieldType: record.esFieldType || '',
    referencedFieldId: record.referencedFieldId || '',
    enumSettingType: record.enumSettingType || '',
    obsolete: record.obsolete ?? false,
    fieldTag: record.fieldTag || '',
    fieldSource: record.fieldSource || '',
  }
  showEditModal.value = true
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
.cell-type-name { margin-left: 6px; font-size: 12px; color: #86868b; }
.cell-operators { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.cell-muted { color: #aeaeb2; }

/* ---- pagination ---- */
.pagination-bar { display: flex; justify-content: flex-end; padding-top: 24px; }

/* ---- edit modal ---- */
.edit-modal :deep(.ant-modal-content) { border-radius: 20px; }
.edit-modal :deep(.ant-modal-header) { padding: 28px 28px 0; border-bottom: none; }
.edit-modal :deep(.ant-modal-title) { font-size: 20px; font-weight: 700; color: #1d1d1f; }
.edit-modal :deep(.ant-modal-body) { padding: 20px 28px 28px; }
.modal-footer { display: flex; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #f5f5f7; }
</style>
