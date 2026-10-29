<template>
  <div class="sort-panel">
    <div class="sort-panel-header">
      <span class="sort-title">排序<span class="sort-count">{{ rows.length }}</span></span>
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
      <div v-if="!rows.length" class="sort-empty">暂无排序条件，将按默认顺序展示</div>

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
          :loading="fieldLoading"
          show-search
          option-filter-prop="label"
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
import { computed, onMounted, ref, watch } from 'vue'
import { queryAvailableFields } from '@/api/faiz'
import type { AvailableFieldItem, SortItem } from '@/types/faiz'

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

// ---------- 字段：与全局筛选一致，取「可用字段接口」，接口未返回的常用系统字段作兜底 ----------
const fieldLoading = ref(false)
const availableFields = ref<AvailableFieldItem[]>([])

const SYSTEM_FIELD_LABELS: Record<string, string> = {
  issuekey: '编号',
  summary: '概要',
  status: '状态',
  priority: '优先级',
  issuetype: '分类',
  assignee: '经办人',
  creator: '创建人',
  reporter: '报告人',
  createtime: '创建时间',
  created: '创建时间',
  updated: '更新时间',
}

const fieldOptions = computed(() => {
  const list: { value: string; label: string }[] = []
  const known = new Set<string>()

  // 1) 接口返回的可用字段（含自定义字段，展示中文名）
  for (const f of availableFields.value) {
    if (known.has(f.fieldId)) continue
    known.add(f.fieldId)
    list.push({ value: f.fieldId, label: f.fieldName })
  }

  // 2) 常用系统字段兜底（接口未返回时仍可选）
  for (const [id, label] of Object.entries(SYSTEM_FIELD_LABELS)) {
    if (!known.has(id)) {
      known.add(id)
      list.push({ value: id, label })
    }
  }

  // 3) 已选字段不在上述列表时，追加展示，避免 select 显示原始 fieldId
  for (const item of props.modelValue || []) {
    const id = item.field?.id
    if (id && !known.has(id)) {
      known.add(id)
      list.push({ value: id, label: id })
    }
  }

  return list
})

async function loadAvailableFields() {
  fieldLoading.value = true
  try {
    const res = await queryAvailableFields({ page: 1, pageSize: 200, searchKey: '' })
    if (res.success && res.data?.list) availableFields.value = res.data.list.filter((f) => !f.obsolete)
  } catch {
    availableFields.value = []
  } finally {
    fieldLoading.value = false
  }
}

onMounted(loadAvailableFields)

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
/* 与全局筛选面板保持同一套视觉规范：Apple 灰阶层次 + Google 细边控件/蓝色焦点环 */
.sort-panel {
  padding: 14px 16px 12px;
  min-height: 120px;
  background: #fff;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto,
    'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
}

.sort-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.sort-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #1d1d1f;
}

.sort-count {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: #f0f0f5;
  color: #6e6e73;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.sort-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.sort-action-link {
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #6e6e73;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.sort-action-link:hover {
  background: rgba(60, 60, 67, 0.06);
  color: #1d1d1f;
}

.sort-divider {
  margin: 0 2px;
  font-size: 11px;
  color: #e5e5ea;
}

.sort-conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sort-empty {
  padding: 24px 0;
  font-size: 12px;
  color: #8e8e93;
  text-align: center;
}

/* 排序行：与筛选条件行一致的浅灰圆角卡片 */
.sort-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(118, 118, 128, 0.06);
  transition: background 0.15s ease;
}

.sort-row:hover {
  background: rgba(118, 118, 128, 0.1);
}

.sort-field {
  width: 150px !important;
  min-width: 150px;
}

.sort-direction {
  width: 90px !important;
  min-width: 90px;
}

.sort-more,
.sort-delete {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 15px;
  line-height: 1;
  color: #aeaeb2;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.sort-more:hover {
  background: rgba(60, 60, 67, 0.08);
  color: #1d1d1f;
}

.sort-delete:hover {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

.sort-delete-placeholder {
  flex-shrink: 0;
  width: 22px;
  min-width: 22px;
  height: 22px;
}

.sort-add-row {
  padding-left: 10px;
}

.sort-add-btn {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border: 1px dashed #c7c7cc;
  border-radius: 8px;
  background: rgba(10, 132, 255, 0.04);
  color: #0a84ff;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.sort-add-btn:hover {
  background: rgba(10, 132, 255, 0.1);
  border-color: #0a84ff;
}

/* 控件：细边 + 圆角 + 蓝色焦点环 */
.sort-panel :deep(.ant-select-sm .ant-select-selector) {
  border: 1px solid #d2d2d7 !important;
  border-radius: 8px !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.sort-panel :deep(.ant-select-sm:hover .ant-select-selector) {
  border-color: #aeaeb2 !important;
}

.sort-panel :deep(.ant-select-focused .ant-select-selector) {
  border-color: #0a84ff !important;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15) !important;
}
</style>
