<template>
  <div class="filter-panel">
    <div class="filter-panel-header">
      <span class="filter-title">全局筛选({{ conditions.length }})</span>
      <div class="filter-actions">
        <a-dropdown :trigger="['click']">
          <span class="filter-action-link">复制</span>
          <template #overlay>
            <a-menu @click="handleActionClick">
              <a-menu-item key="copy">复制当前筛选</a-menu-item>
              <a-menu-item key="copyAll">复制所有筛选</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <span class="filter-divider">|</span>
        <span class="filter-action-link" @click="handlePaste">粘贴</span>
        <span class="filter-divider">|</span>
        <a-dropdown :trigger="['click']">
          <span class="filter-action-link">引用 ▾</span>
          <template #overlay>
            <a-menu @click="handleActionClick">
              <a-menu-item key="refRecent">引用最近的筛选</a-menu-item>
              <a-menu-item key="refSaved">引用已保存的筛选</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <span class="filter-divider">|</span>
        <span class="filter-action-link" @click="handleClear">清空</span>
      </div>
    </div>

    <div class="filter-conditions">
      <div
        v-for="(cond, index) in conditions"
        :key="index"
        class="filter-row"
      >
        <!-- 逻辑运算符 -->
        <a-select
          v-if="index === 0"
          v-model:value="cond.logic"
          class="condition-logic"
          size="small"
        >
          <a-select-option value="且">且</a-select-option>
          <a-select-option value="或">或</a-select-option>
        </a-select>
        <span v-else class="condition-logic-placeholder"></span>

        <!-- 字段 -->
        <a-select
          v-model:value="cond.field"
          class="condition-field"
          size="small"
          :loading="loading"
          show-search
          option-filter-prop="label"
        >
          <a-select-option
            v-for="f in fieldOptions"
            :key="f.value"
            :value="f.value"
          >{{ f.label }}</a-select-option>
        </a-select>

        <!-- 操作符 -->
        <a-select
          v-model:value="cond.operator"
          class="condition-operator"
          size="small"
        >
          <a-select-option
            v-for="op in operatorOptions"
            :key="op.value"
            :value="op.value"
          >{{ op.label }}</a-select-option>
        </a-select>

        <!-- 值 -->
        <div class="condition-value" :class="{ 'has-value': !!cond.value }">
          <template v-if="cond.value">
            <span class="value-tag">
              {{ cond.value }}
              <span class="value-close" @click="clearValue(cond)">×</span>
            </span>
          </template>
          <template v-else>
            <span class="value-placeholder">{{ getValuePlaceholder(cond) }}</span>
          </template>
        </div>

        <!-- 更多操作 -->
        <a-dropdown :trigger="['click']">
          <span class="condition-more">···</span>
          <template #overlay>
            <a-menu @click="handleRowAction($event, index)">
              <a-menu-item key="insert">在下方插入条件</a-menu-item>
              <a-menu-item key="group">分组条件</a-menu-item>
              <a-menu-item key="delete" :disabled="conditions.length === 1">删除条件</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <!-- 删除 -->
        <span
          v-if="conditions.length > 1"
          class="condition-delete"
          @click="removeCondition(index)"
        >×</span>
        <span v-else class="condition-delete-placeholder"></span>
      </div>

      <!-- 新增条件 -->
      <div class="filter-add-row">
        <a-dropdown :trigger="['click']">
          <span class="filter-add-btn">+ 新增条件 ▾</span>
          <template #overlay>
            <a-menu @click="handleAddAction">
              <a-menu-item key="add">新增条件</a-menu-item>
              <a-menu-item key="group">新增条件组</a-menu-item>
              <a-menu-item key="subGroup">新增嵌套组</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="filter-footer">
      <a-button size="small" @click="emit('save')">保存</a-button>
      <a-button size="small" type="primary" @click="emit('update:visible', false)">赋值</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { queryAvailableFields } from '@/api/faiz'
import type { AvailableFieldItem } from '@/types/faiz'

interface FilterCondition {
  logic: string
  field: string
  operator: string
  value: string
}

interface Props {
  visible: boolean
  modelValue?: FilterCondition[]
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  modelValue: () => [],
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:modelValue', value: FilterCondition[]): void
  (e: 'save'): void
}>()

const DEFAULT_CONDITIONS: FilterCondition[] = [
  { logic: '且', field: 'assignee', operator: '属于', value: '当前用户' },
  { logic: '且', field: 'status', operator: '属于', value: '所有未结束状态' },
  { logic: '或', field: 'issueType', operator: '属于', value: '' },
]

// 本地筛选条件：初始化自父级 modelValue，编辑后实时同步回父级
const conditions = ref<FilterCondition[]>(
  props.modelValue?.length
    ? JSON.parse(JSON.stringify(props.modelValue))
    : JSON.parse(JSON.stringify(DEFAULT_CONDITIONS)),
)

watch(
  conditions,
  () => {
    emit('update:modelValue', JSON.parse(JSON.stringify(conditions.value)))
  },
  { deep: true },
)

const loading = ref(false)
const availableFields = ref<AvailableFieldItem[]>([])

// 字段下拉：取自接口 /availableField/list
const apiFieldOptions = computed(() =>
  availableFields.value.map(f => ({ value: f.fieldId, label: f.fieldName })),
)

// 当前条件里已选但接口未返回的字段，追加展示，避免 select 显示裸 fieldId
const fieldOptions = computed(() => {
  const known = new Set(apiFieldOptions.value.map(f => f.value))
  const extra: { value: string; label: string }[] = []
  for (const cond of conditions.value) {
    if (cond.field && !known.has(cond.field)) {
      known.add(cond.field)
      extra.push({ value: cond.field, label: cond.field })
    }
  }
  return [...apiFieldOptions.value, ...extra]
})

async function loadAvailableFields() {
  try {
    loading.value = true
    const res = await queryAvailableFields({ page: 1, perPage: 20, searchKey: '' })
    if (res.success && res.data?.list) {
      availableFields.value = res.data.list.filter(f => !f.obsolete)
    }
  } catch {
    availableFields.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadAvailableFields)

const operatorOptions = [
  { value: '属于', label: '属于' },
  { value: '等于', label: '等于' },
  { value: '不等于', label: '不等于' },
  { value: '包含', label: '包含' },
  { value: '不包含', label: '不包含' },
  { value: '大于', label: '大于' },
  { value: '小于', label: '小于' },
]

const defaultValueMap: Record<string, Record<string, string>> = {
  assignee: { current: '当前用户' },
  status: { all: '所有未结束状态', done: '已完成' },
  issueType: { bug: '缺陷', task: '任务', story: '需求' },
  priority: { high: '高', medium: '中', low: '低' },
  project: { default: '默认项目' },
}

function getValuePlaceholder(cond: FilterCondition): string {
  const options = defaultValueMap[cond.field]
  if (options) {
    return '请选择'
  }
  return '请输入'
}

function clearValue(cond: FilterCondition) {
  cond.value = ''
}

function removeCondition(index: number) {
  const list = [...conditions.value]
  list.splice(index, 1)
  conditions.value = list
}

function addCondition() {
  const lastLogic = conditions.value[conditions.value.length - 1]?.logic ?? '且'
  conditions.value.push({
    logic: lastLogic === '且' ? '或' : '且',
    field: 'assignee',
    operator: '属于',
    value: '',
  })
}

function handleAddAction(e: { key: string }) {
  switch (e.key) {
    case 'add':
      addCondition()
      break
    case 'group':
      addCondition()
      break
    case 'subGroup':
      addCondition()
      break
  }
}

function handleRowAction(e: { key: string }, index: number) {
  switch (e.key) {
    case 'insert':
      addCondition()
      break
    case 'delete':
      removeCondition(index)
      break
  }
}

function handleActionClick(_e: { key: string }) {
  // placeholder for copy/paste/reference actions
}

function handlePaste() {
  // placeholder
}

function handleClear() {
  emit('update:modelValue', [])
}
</script>

<style scoped>
.filter-panel {
  background: #fff;
  padding: 16px 20px;
  min-height: 220px;
}

.filter-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.filter-action-link {
  font-size: 12px;
  color: #1677ff;
  cursor: pointer;
  padding: 1px 3px;
}

.filter-action-link:hover {
  color: #4096ff;
}

.filter-divider {
  color: #d9d9d9;
  margin: 0 2px;
  font-size: 12px;
}

.filter-conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.condition-logic {
  width: 52px !important;
  min-width: 52px;
}

.condition-logic-placeholder {
  width: 52px;
  min-width: 52px;
  height: 28px;
}

.condition-field {
  width: 110px !important;
  min-width: 110px;
}

.condition-operator {
  width: 80px !important;
  min-width: 80px;
}

.condition-value {
  flex: 1;
  min-width: 0;
  height: 28px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.condition-value:hover {
  border-color: #4096ff;
}

.condition-value.has-value {
  border-color: #d9d9d9;
}

.value-tag {
  display: inline-flex;
  align-items: center;
  background: #e6f4ff;
  color: #1677ff;
  border: 1px solid #91caff;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  gap: 4px;
}

.value-close {
  color: #999;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  margin-left: 2px;
  padding: 1px;
  border-radius: 50%;
  transition: all 0.15s;
}

.value-close:hover {
  color: #fff;
  background: #1677ff;
}

.value-placeholder {
  font-size: 12px;
  color: #bfbfbf;
}

.condition-more {
  color: #bfbfbf;
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.15s;
}

.condition-more:hover {
  color: #595959;
  background: #f5f5f5;
}

.condition-delete {
  color: #bfbfbf;
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.15s;
}

.condition-delete:hover {
  color: #ff4d4f;
  background: #fff1f0;
}

.condition-delete-placeholder {
  width: 16px;
  min-width: 16px;
  height: 16px;
}

.filter-add-row {
  padding-top: 4px;
}

.filter-add-btn {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  color: #1677ff;
  cursor: pointer;
  padding: 4px 12px;
  border: 1px dashed #91caff;
  border-radius: 6px;
  background: #f0f7ff;
  transition: all 0.15s;
}

.filter-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.filter-add-btn:hover {
  color: #4096ff;
  border-color: #1677ff;
  background: #e6f4ff;
}
</style>
