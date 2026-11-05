<template>
  <!-- 手机端排序：可加多个字段，按顺序依次排序（与网页版 SortPanel 的 sortItemList 一致） -->
  <van-popup :show="show" position="bottom" round closeable safe-area-inset-bottom class="ss-sheet" @update:show="onShowChange">
    <div class="ss-title">排序<span class="ss-sub">按从上到下的顺序依次排序</span></div>

    <div class="ss-body">
      <van-empty v-if="!draft.length" image-size="64" description="未设置排序，默认按更新时间倒序" />
      <div v-for="(r, i) in draft" :key="i" class="ss-row">
        <span class="ss-index">{{ i + 1 }}</span>
        <span class="ss-field" @click="openFieldPicker(i)">{{ fieldName(r.fieldId) || '选择字段' }}<van-icon name="arrow-down" /></span>
        <!-- 升序 / 降序 -->
        <span class="ss-dir">
          <span :class="{ active: r.sortTypeCode === 'ASC' }" @click="r.sortTypeCode = 'ASC'">升序</span>
          <span :class="{ active: r.sortTypeCode === 'DESC' }" @click="r.sortTypeCode = 'DESC'">降序</span>
        </span>
        <van-icon name="delete-o" class="ss-del" @click="draft.splice(i, 1)" />
      </div>
      <div class="ss-add" @click="addRow"><van-icon name="plus" /> 添加排序字段</div>
    </div>

    <div class="ss-foot">
      <van-button plain block round @click="draft = []">恢复默认</van-button>
      <van-button type="primary" block round @click="apply">确定</van-button>
    </div>
  </van-popup>

  <van-popup v-model:show="pickerOpen" position="bottom" round closeable safe-area-inset-bottom class="ss-sheet">
    <div class="ss-title">选择排序字段</div>
    <van-search v-model="keyword" placeholder="搜索字段" shape="round" />
    <div class="ss-body">
      <van-loading v-if="fieldsLoading" class="ss-loading" size="20" />
      <van-cell v-for="f in pickable" :key="f.id" :title="f.name" clickable @click="pickField(f)" />
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { loadFilterFields, type FilterFieldMeta } from '../utils'

export interface SortRow {
  fieldId: string
  sortTypeCode: 'ASC' | 'DESC'
}

const props = defineProps<{ show: boolean; rows: SortRow[] }>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'apply', v: SortRow[]): void
}>()

const draft = ref<SortRow[]>([])
const fields = ref<FilterFieldMeta[]>([])
const fieldsLoading = ref(false)
const fieldName = (id: string) => fields.value.find((f) => f.id === id)?.name || ''

watch(() => props.show, async (v) => {
  if (!v) return
  draft.value = props.rows.map((r) => ({ ...r }))
  if (fields.value.length) return
  fieldsLoading.value = true
  try {
    fields.value = await loadFilterFields()
  } finally {
    fieldsLoading.value = false
  }
})

function onShowChange(v: boolean) {
  emit('update:show', v)
}

// ---- 选字段 ----
const pickerOpen = ref(false)
const pickingIndex = ref(-1)
const keyword = ref('')
const pickable = computed(() => {
  const used = new Set(draft.value.filter((_r, i) => i !== pickingIndex.value).map((r) => r.fieldId))
  const kw = keyword.value.trim().toLowerCase()
  return fields.value.filter((f) => !used.has(f.id) && (!kw || f.name.toLowerCase().includes(kw)))
})

function addRow() {
  draft.value.push({ fieldId: '', sortTypeCode: 'DESC' })
  openFieldPicker(draft.value.length - 1)
}
function openFieldPicker(i: number) {
  pickingIndex.value = i
  keyword.value = ''
  pickerOpen.value = true
}
function pickField(f: FilterFieldMeta) {
  const r = draft.value[pickingIndex.value]
  if (r) r.fieldId = f.id
  pickerOpen.value = false
}

function apply() {
  emit('apply', draft.value.filter((r) => r.fieldId).map((r) => ({ ...r })))
  emit('update:show', false)
}
</script>

<style scoped>
.ss-sheet {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.ss-title {
  flex-shrink: 0;
  padding: 16px 48px 8px 16px;
  font-size: 16px;
  font-weight: 600;
}

.ss-sub {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--h5-text-3);
}

.ss-body {
  flex: 1;
  min-height: 140px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.ss-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 16px 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f7f8fa;
}

.ss-index {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e3e6eb;
  font-size: 12px;
  color: var(--h5-text-2);
}

.ss-field {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
}

.ss-dir {
  flex-shrink: 0;
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: #fff;
}

.ss-dir span {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--h5-text-2);
}

.ss-dir span.active {
  background: var(--van-primary-color);
  color: #fff;
}

.ss-del {
  flex-shrink: 0;
  padding: 4px;
  font-size: 18px;
  color: var(--h5-text-3);
}

.ss-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 12px 16px 0;
  height: 40px;
  border: 1px dashed #c9cdd4;
  border-radius: 10px;
  font-size: 14px;
  color: var(--van-primary-color);
}

.ss-loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.ss-foot {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  padding: 10px 16px 12px;
}
</style>
