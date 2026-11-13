<template>
  <div class="sort-panel">
    <div class="sort-panel-header">
      <span class="sort-title">排序<span class="sort-count">{{ rows.length }}</span></span>
      <div class="sort-actions">
        <a-dropdown :trigger="['click']">
          <span class="sort-action-link">复制</span>
          <template #overlay>
            <a-menu @click="handleActionClick">
              <a-menu-item key="copy" :disabled="!rows.length">复制排序</a-menu-item>
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
          @change="sync"
        >
          <a-select-option
            v-for="f in fieldOptions"
            :key="f.value"
            :value="f.value"
            :label="f.label"
            :disabled="isUsedByOther(f.value, index)"
          >{{ f.label }}</a-select-option>
        </a-select>

        <!-- 排序方向 -->
        <a-select
          v-model:value="cond.sortTypeCode"
          class="sort-direction"
          size="small"
          @change="sync"
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
        <span class="sort-add-btn" @click="addCondition()">+ 新增排序</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { queryWorkbenchFieldList } from '@/api/faiz'
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

// ---------- 字段：与全局筛选一致，取 /availableField/list（自定义字段 + 系统字段） ----------
const fieldLoading = ref(false)
const availableFields = ref<AvailableFieldItem[]>([])

/** 下拉选项：只取后端返回的字段 */
const fieldOptions = computed(() => availableFields.value.map((f) => ({ value: f.fieldId, label: f.fieldName })))

/** 字段列表加载后，移除不在列表中的排序（已删除 / 历史遗留的无效字段）并同步给父级 */
function dropUnknownRows() {
  if (!availableFields.value.length) return
  const known = new Set(availableFields.value.map((f) => f.fieldId))
  const unknown = rows.value.filter((r) => r.fieldId && !known.has(r.fieldId))
  if (!unknown.length) return
  rows.value = rows.value.filter((r) => !r.fieldId || known.has(r.fieldId))
  sync()
}

async function loadAvailableFields() {
  fieldLoading.value = true
  try {
    const res = await queryWorkbenchFieldList({ page: 1, pageSize: 500, searchKey: '' })
    if (res?.success && res.data?.list) {
      availableFields.value = res.data.list.filter((f) => !f.obsolete)
      dropUnknownRows()
    }
  } catch {
    // 请求层已统一提示；保留上次结果
  } finally {
    fieldLoading.value = false
  }
}

onMounted(loadAvailableFields)
// 每次打开面板重新拉取，保证与字段配置同步
watch(
  () => props.visible,
  (open, wasOpen) => {
    if (open && wasOpen === false) loadAvailableFields()
  },
)

// ---------- 排序条件 ----------
const rows = ref<SortRow[]>([])

watch(
  () => props.modelValue,
  (val) => {
    const next = (val || []).map((item) => ({ fieldId: item.field?.id || '', sortTypeCode: item.sortTypeCode || 'ASC' }))
    // 与本地一致（含未选字段的空行）时不覆盖，避免新增的空行被父级回写冲掉
    const local = rows.value.filter((r) => r.fieldId)
    const sameAsLocal = JSON.stringify(next) === JSON.stringify(local)
    if (!sameAsLocal) {
      rows.value = next
      dropUnknownRows()
    }
  },
  { immediate: true },
)

/** 其它行已使用的字段不能重复选择 */
function isUsedByOther(fieldId: string, index: number): boolean {
  return rows.value.some((r, i) => i !== index && r.fieldId === fieldId)
}

/** 同步给父级：只提交已选字段的行（未选字段的空行仅留在面板里） */
function sync() {
  emit(
    'update:modelValue',
    rows.value
      .filter((r) => r.fieldId)
      .map((r) => ({ field: { id: r.fieldId, datasourceId: 0 }, sortTypeCode: r.sortTypeCode })),
  )
}

/** 新增排序：默认选第一个未使用的字段；index 传入时插在该行下方 */
function addCondition(index?: number) {
  const used = new Set(rows.value.map((r) => r.fieldId))
  const next = fieldOptions.value.find((f) => !used.has(f.value))?.value ?? ''
  const row = { fieldId: next, sortTypeCode: 'ASC' }
  if (index === undefined) rows.value.push(row)
  else rows.value.splice(index + 1, 0, row)
  sync()
}

function removeCondition(index: number) {
  rows.value.splice(index, 1)
  sync()
}

function handleRowAction(e: { key: string }, index: number) {
  switch (e.key) {
    case 'insert':
      addCondition(index)
      break
    case 'delete':
      removeCondition(index)
      break
  }
}

// ---------- 复制 / 粘贴：以 JSON 形式经剪贴板在视图间复用排序 ----------
const CLIPBOARD_TAG = 'cooperise-sort'

async function handleActionClick(e: { key: string }) {
  if (e.key !== 'copy') return
  const payload = JSON.stringify({ type: CLIPBOARD_TAG, rows: rows.value.filter((r) => r.fieldId) })
  try {
    await navigator.clipboard.writeText(payload)
    message.success('已复制排序')
  } catch {
    message.error('复制失败：浏览器不允许访问剪贴板')
  }
}

async function handlePaste() {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    message.error('粘贴失败：浏览器不允许访问剪贴板')
    return
  }
  try {
    const data = JSON.parse(text) as { type?: string; rows?: SortRow[] }
    if (data?.type !== CLIPBOARD_TAG || !Array.isArray(data.rows)) throw new Error('invalid')
    const seen = new Set<string>()
    rows.value = data.rows
      .filter((r) => r && typeof r.fieldId === 'string' && r.fieldId && !seen.has(r.fieldId) && seen.add(r.fieldId))
      .map((r) => ({ fieldId: r.fieldId, sortTypeCode: r.sortTypeCode === 'DESC' ? 'DESC' : 'ASC' }))
    sync()
    message.success('已粘贴排序')
  } catch {
    message.warning('剪贴板中没有可用的排序')
  }
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
  background: transparent;
  background: color-mix(in srgb, var(--c-primary) 4%, transparent);
  color: var(--c-primary);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.sort-add-btn:hover {
  background: transparent;
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border-color: var(--c-primary);
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
  border-color: var(--c-primary) !important;
  box-shadow: 0 0 0 3px transparent !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 15%, transparent) !important;
}
</style>
