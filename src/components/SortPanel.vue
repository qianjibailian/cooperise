<template>
  <div class="sort-panel">
    <div class="sort-panel-header">
      <span class="sort-title">排序({{ rows.length }})</span>
      <div class="sort-actions">
        <a-dropdown :trigger="['click']">
          <span class="sort-action-link">复制</span>
          <template #overlay>
            <a-menu @click="handleActionClick">
              <a-menu-item key="copy">复制当前排序</a-menu-item>
              <a-menu-item key="copyAll">复制所有排序</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <span class="sort-divider">|</span>
        <span class="sort-action-link" @click="handlePaste">粘贴</span>
        <span class="sort-divider">|</span>
        <span class="sort-action-link" @click="handleClear">清空</span>
      </div>
    </div>

    <div class="sort-conditions">
      <div
        v-for="(cond, index) in rows"
        :key="index"
        class="sort-row"
      >
        <!-- 排序字段 -->
        <a-select
          v-model:value="cond.fieldId"
          class="sort-field"
          size="small"
          placeholder="选择字段"
        >
          <a-select-option
            v-for="f in fieldOptions"
            :key="f.value"
            :value="f.value"
          >{{ f.label }}</a-select-option>
        </a-select>

        <!-- 排序方向 -->
        <a-select
          v-model:value="cond.sortTypeCode"
          class="sort-direction"
          size="small"
        >
          <a-select-option value="ASC">升序</a-select-option>
          <a-select-option value="DESC">降序</a-select-option>
        </a-select>

        <!-- 更多操作 -->
        <a-dropdown :trigger="['click']">
          <span class="sort-more">···</span>
          <template #overlay>
            <a-menu @click="handleRowAction($event, index)">
              <a-menu-item key="insert">在下方插入排序</a-menu-item>
              <a-menu-item key="delete" :disabled="rows.length === 1">删除排序</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <!-- 删除 -->
        <span
          v-if="rows.length > 1"
          class="sort-delete"
          @click="removeCondition(index)"
        >×</span>
        <span v-else class="sort-delete-placeholder"></span>
      </div>

      <!-- 新增排序 -->
      <div class="sort-add-row">
        <span class="sort-add-btn" @click="addCondition">+ 新增排序</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SortItem } from '@/types/faiz'

interface SortRow {
  fieldId: string
  sortTypeCode: string
}

const props = defineProps<{
  visible: boolean
  modelValue?: SortItem[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:modelValue', value: SortItem[]): void
}>()

const BASE_FIELD_OPTIONS = [
  { value: 'summary', label: '概要' },
  { value: 'issuekey', label: '编号' },
  { value: 'status', label: '状态' },
  { value: 'priority', label: '优先级' },
  { value: 'issuetype', label: '分类' },
  { value: 'assignee', label: '经办人' },
  { value: 'createtime', label: '创建时间' },
  { value: 'updated', label: '更新时间' },
]

// 当前已选字段不在基础列表时，追加展示，避免 select 显示原始 fieldId
const fieldOptions = computed(() => {
  const known = new Set(BASE_FIELD_OPTIONS.map(f => f.value))
  const extra: { value: string; label: string }[] = []
  for (const item of props.modelValue || []) {
    const id = item.field?.id
    if (id && !known.has(id)) {
      known.add(id)
      extra.push({ value: id, label: id })
    }
  }
  return [...BASE_FIELD_OPTIONS, ...extra]
})

const rows = ref<SortRow[]>([])

watch(
  () => props.modelValue,
  (val) => {
    rows.value = (val || []).map((item) => ({
      fieldId: item.field?.id || '',
      sortTypeCode: item.sortTypeCode,
    }))
  },
  { immediate: true },
)

function sync() {
  emit(
    'update:modelValue',
    rows.value.map((r) => ({
      field: { id: r.fieldId, datasourceId: 0 },
      sortTypeCode: r.sortTypeCode,
    })),
  )
}

function addCondition() {
  const used = new Set(rows.value.map(r => r.fieldId))
  const next = fieldOptions.value.find(f => !used.has(f.value))?.value ?? ''
  rows.value.push({ fieldId: next, sortTypeCode: 'ASC' })
  sync()
}

function removeCondition(index: number) {
  rows.value.splice(index, 1)
  sync()
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
  // placeholder for copy actions
}

function handlePaste() {
  // placeholder
}

function handleClear() {
  rows.value = []
  sync()
}
</script>

<style scoped>
.sort-panel {
  background: #fff;
  padding: 16px 20px;
  min-height: 120px;
}

.sort-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.sort-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
}

.sort-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.sort-action-link {
  font-size: 12px;
  color: #1677ff;
  cursor: pointer;
  padding: 1px 3px;
}

.sort-action-link:hover {
  color: #4096ff;
}

.sort-divider {
  color: #d9d9d9;
  margin: 0 2px;
  font-size: 12px;
}

.sort-conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sort-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-field {
  width: 150px !important;
  min-width: 150px;
}

.sort-direction {
  width: 90px !important;
  min-width: 90px;
}

.sort-more {
  color: #bfbfbf;
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.15s;
}

.sort-more:hover {
  color: #595959;
  background: #f5f5f5;
}

.sort-delete {
  color: #bfbfbf;
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.15s;
}

.sort-delete:hover {
  color: #ff4d4f;
  background: #fff1f0;
}

.sort-delete-placeholder {
  width: 16px;
  min-width: 16px;
  height: 16px;
}

.sort-add-row {
  padding-top: 4px;
}

.sort-add-btn {
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

.sort-add-btn:hover {
  color: #4096ff;
  border-color: #1677ff;
  background: #e6f4ff;
}
</style>
