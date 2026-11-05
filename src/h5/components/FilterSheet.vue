<template>
  <!--
    手机端全局筛选：条件 = 字段 + 操作符 + 值，多个条件同时满足（AND），并与当前页签自带的条件叠加。
    字段 / 操作符 / 值的取值规则与网页版 FilterPanel 一致（@/utils/issueFilter）
  -->
  <van-popup :show="show" position="bottom" round closeable safe-area-inset-bottom class="fs-sheet" @update:show="onShowChange">
    <div class="fs-title">筛选<span v-if="draft.length" class="fs-sub">满足全部条件</span></div>

    <div class="fs-body">
      <van-empty v-if="!draft.length" image-size="64" description="还没有筛选条件" />

      <div v-for="(c, i) in draft" :key="i" class="fs-cond">
        <div class="fs-cond-head">
          <span class="fs-field" @click="openFieldPicker(i)">
            {{ fieldName(c.field) || '选择字段' }}<van-icon name="arrow-down" />
          </span>
          <van-icon name="delete-o" class="fs-del" @click="draft.splice(i, 1)" />
        </div>
        <div class="fs-cond-row">
          <span class="fs-op" @click="openOperator(i)">{{ OPERATORS[c.operator]?.label || '条件' }}<van-icon name="arrow-down" /></span>
          <template v-if="c.field && !OPERATORS[c.operator]?.noValue">
            <!-- 文本 / 数字：直接输入 -->
            <input
              v-if="kindOf(c) === 'text' || kindOf(c) === 'number'"
              class="fs-input"
              :type="kindOf(c) === 'number' ? 'number' : 'text'"
              :value="c.values[0] || ''"
              placeholder="请输入"
              @input="onTextInput(c, $event)"
            />
            <!-- 其他：点开选择 -->
            <span v-else class="fs-value" :class="{ empty: !c.values.length }" @click="openValue(i)">
              {{ valueText(c) || '请选择' }}
            </span>
          </template>
        </div>
      </div>

      <div class="fs-add" @click="addCondition"><van-icon name="plus" /> 添加条件</div>
    </div>

    <div class="fs-foot">
      <van-button plain block round @click="draft = []">清空</van-button>
      <van-button type="primary" block round @click="apply">确定</van-button>
    </div>
  </van-popup>

  <!-- 选字段 -->
  <van-popup v-model:show="fieldPickerOpen" position="bottom" round closeable safe-area-inset-bottom class="fs-sheet">
    <div class="fs-title">选择字段</div>
    <van-search v-model="fieldKeyword" placeholder="搜索字段" shape="round" />
    <div class="fs-body">
      <van-loading v-if="fieldsLoading" class="fs-loading" size="20" />
      <van-cell
        v-for="f in pickableFields"
        :key="f.id"
        :title="f.name"
        clickable
        @click="pickField(f)"
      />
    </div>
  </van-popup>

  <!-- 选操作符 -->
  <van-action-sheet
    v-model:show="operatorOpen"
    :actions="operatorActions"
    cancel-text="取消"
    close-on-click-action
    @select="pickOperator"
  />

  <!-- 选值：下拉选项 / 人员 -->
  <van-popup v-model:show="valueOpen" position="bottom" round closeable safe-area-inset-bottom class="fs-sheet">
    <div class="fs-title">{{ editing ? fieldName(editing.field) : '' }}</div>
    <van-search
      v-if="editingKind === 'user' || valueOptions.length > 8"
      v-model="valueKeyword"
      :placeholder="editingKind === 'user' ? '搜索姓名 / 工号' : '搜索选项'"
      shape="round"
      @update:model-value="onValueSearch"
    />
    <div class="fs-body">
      <van-loading v-if="valueLoading" class="fs-loading" size="20" />
      <van-empty v-else-if="!shownValueOptions.length" image-size="64" description="没有可选项" />
      <van-cell v-for="o in shownValueOptions" v-else :key="o.value" clickable @click="toggleValue(o)">
        <template #title>
          <span class="fs-option">
            <i v-if="o.color" class="fs-dot" :style="{ background: o.color }" />
            <span data-no-i18n>{{ o.label }}</span>
          </span>
        </template>
        <template #right-icon>
          <van-icon v-if="valueDraft.includes(o.value)" name="success" class="fs-check" />
        </template>
      </van-cell>
    </div>
    <div class="fs-foot">
      <van-button type="primary" block round @click="confirmValue">确定</van-button>
    </div>
  </van-popup>

  <!-- 选日期 -->
  <van-popup v-model:show="dateOpen" position="bottom" round safe-area-inset-bottom>
    <van-date-picker
      v-model="dateParts"
      title="选择日期"
      :min-date="new Date(2015, 0, 1)"
      :max-date="new Date(2040, 11, 31)"
      @confirm="confirmDate"
      @cancel="dateOpen = false"
    />
  </van-popup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { CURRENT_USER, OPERATORS, OPERATORS_BY_KIND, valueKindOf, type FilterCondition, type ValueKind } from '@/utils/issueFilter'
import { personLabel } from '@/utils/person'
import {
  loadFilterFields, loadFilterOptions, personValueOf, searchUsers,
  type FilterFieldMeta, type FilterOption,
} from '../utils'

const props = defineProps<{ show: boolean; conditions: FilterCondition[] }>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'apply', v: FilterCondition[]): void
}>()

/** 弹层内编辑草稿，点「确定」才生效 */
const draft = ref<FilterCondition[]>([])
const clone = (list: FilterCondition[]) => list.map((c) => ({ ...c, values: [...c.values], labels: { ...(c.labels || {}) } }))

// ---------------- 字段 ----------------
const fields = ref<FilterFieldMeta[]>([])
const fieldsLoading = ref(false)
async function ensureFields() {
  if (fields.value.length) return
  fieldsLoading.value = true
  try {
    fields.value = await loadFilterFields()
  } finally {
    fieldsLoading.value = false
  }
}
const fieldOf = (id: string) => fields.value.find((f) => f.id === id)
const fieldName = (id: string) => fieldOf(id)?.name || ''
const kindOf = (c: FilterCondition): ValueKind => valueKindOf(c.field, fieldOf(c.field)?.type)

watch(() => props.show, (v) => {
  if (!v) return
  draft.value = clone(props.conditions)
  void ensureFields()
})

const fieldPickerOpen = ref(false)
const fieldKeyword = ref('')
const pickingIndex = ref(-1)
const pickableFields = computed(() => {
  const used = new Set(draft.value.filter((_c, i) => i !== pickingIndex.value).map((c) => c.field))
  const kw = fieldKeyword.value.trim().toLowerCase()
  return fields.value.filter((f) => !used.has(f.id) && (!kw || f.name.toLowerCase().includes(kw)))
})

function addCondition() {
  draft.value.push({ field: '', operator: '', values: [], labels: {} })
  openFieldPicker(draft.value.length - 1)
}

function openFieldPicker(i: number) {
  pickingIndex.value = i
  fieldKeyword.value = ''
  fieldPickerOpen.value = true
  void ensureFields()
}

function pickField(f: FilterFieldMeta) {
  const c = draft.value[pickingIndex.value]
  if (c) {
    c.field = f.id
    c.operator = OPERATORS_BY_KIND[kindOf(c)][0]
    c.values = []
    c.labels = {}
  }
  fieldPickerOpen.value = false
}

// ---------------- 操作符 ----------------
const operatorOpen = ref(false)
const operatorIndex = ref(-1)
const operatorActions = computed(() => {
  const c = draft.value[operatorIndex.value]
  if (!c) return []
  return OPERATORS_BY_KIND[kindOf(c)].map((code) => ({ name: OPERATORS[code].label, code }))
})
function openOperator(i: number) {
  if (!draft.value[i]?.field) return openFieldPicker(i)
  operatorIndex.value = i
  operatorOpen.value = true
}
function pickOperator(a: { code: string }) {
  const c = draft.value[operatorIndex.value]
  if (!c) return
  c.operator = a.code
  if (OPERATORS[a.code]?.noValue) c.values = []
  else if (!OPERATORS[a.code]?.multi && c.values.length > 1) c.values = c.values.slice(0, 1)
}

// ---------------- 值 ----------------
function onTextInput(c: FilterCondition, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  c.values = v ? [v] : []
}

function onShowChange(v: boolean) {
  emit('update:show', v)
}

function valueText(c: FilterCondition) {
  return c.values.map((v) => c.labels?.[v] || v).join('、')
}

const valueOpen = ref(false)
const dateOpen = ref(false)
const editingIndex = ref(-1)
const editing = computed(() => draft.value[editingIndex.value] || null)
const editingKind = computed<ValueKind | null>(() => (editing.value ? kindOf(editing.value) : null))
const valueOptions = ref<FilterOption[]>([])
const valueLoading = ref(false)
const valueKeyword = ref('')
const valueDraft = ref<string[]>([])
/** 选过的选项显示名（人员搜索结果会变，确定时用它回填 labels） */
const labelCache = new Map<string, string>()
const optionCache = new Map<string, FilterOption[]>()

const shownValueOptions = computed(() => {
  if (editingKind.value === 'user') return valueOptions.value
  const kw = valueKeyword.value.trim().toLowerCase()
  return kw ? valueOptions.value.filter((o) => o.label.toLowerCase().includes(kw)) : valueOptions.value
})

async function openValue(i: number) {
  editingIndex.value = i
  const c = draft.value[i]
  if (!c) return
  const kind = kindOf(c)
  if (kind === 'date') {
    const d = c.values[0] ? dayjs(c.values[0]) : dayjs()
    dateParts.value = [d.format('YYYY'), d.format('MM'), d.format('DD')]
    dateOpen.value = true
    return
  }
  valueDraft.value = [...c.values]
  valueKeyword.value = ''
  valueOpen.value = true
  if (kind === 'user') return runUserSearch('')
  const field = fieldOf(c.field)
  if (!field) return
  if (optionCache.has(field.id)) {
    valueOptions.value = optionCache.get(field.id)!
    return
  }
  valueLoading.value = true
  valueOptions.value = []
  try {
    const opts = await loadFilterOptions(field)
    optionCache.set(field.id, opts)
    if (editingIndex.value === i) valueOptions.value = opts
  } catch {
    valueOptions.value = []
  } finally {
    valueLoading.value = false
  }
}

let userSeq = 0
let userTimer: ReturnType<typeof setTimeout> | undefined
async function runUserSearch(kw: string) {
  const seq = ++userSeq
  valueLoading.value = true
  try {
    const list = await searchUsers(kw.trim(), {})
    if (seq !== userSeq) return
    const opts = list.map((u) => ({ value: personValueOf(u), label: personLabel(u) })).filter((o) => o.value)
    valueOptions.value = kw.trim() ? opts : [{ value: CURRENT_USER, label: '当前用户' }, ...opts]
  } catch {
    if (seq === userSeq) valueOptions.value = []
  } finally {
    if (seq === userSeq) valueLoading.value = false
  }
}
function onValueSearch(kw: string) {
  if (editingKind.value !== 'user') return
  clearTimeout(userTimer)
  userTimer = setTimeout(() => runUserSearch(kw), 300)
}

function toggleValue(o: FilterOption) {
  labelCache.set(o.value, o.label)
  const c = editing.value
  const multi = c ? !!OPERATORS[c.operator]?.multi : true
  const i = valueDraft.value.indexOf(o.value)
  if (i >= 0) valueDraft.value.splice(i, 1)
  else if (multi) valueDraft.value.push(o.value)
  else valueDraft.value = [o.value]
}

function confirmValue() {
  const c = editing.value
  if (c) {
    c.values = [...valueDraft.value]
    const labels: Record<string, string> = {}
    for (const v of c.values) labels[v] = labelCache.get(v) || c.labels?.[v] || (v === CURRENT_USER ? '当前用户' : v)
    c.labels = labels
  }
  valueOpen.value = false
}

const dateParts = ref<string[]>([])
function confirmDate() {
  const c = editing.value
  if (c) {
    const v = dateParts.value.join('-')
    c.values = [v]
    c.labels = { [v]: v }
  }
  dateOpen.value = false
}

// ---------------- 确定 ----------------
function apply() {
  // 没填完的条件（没选字段 / 需要值却没值）不提交
  const done = draft.value.filter((c) => c.field && c.operator && (OPERATORS[c.operator]?.noValue || c.values.length))
  emit('apply', clone(done))
  emit('update:show', false)
}
</script>

<style scoped>
.fs-sheet {
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.fs-title {
  flex-shrink: 0;
  padding: 16px 48px 8px 16px;
  font-size: 16px;
  font-weight: 600;
}

.fs-sub {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--h5-text-3);
}

.fs-body {
  flex: 1;
  min-height: 160px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.fs-cond {
  margin: 8px 16px 0;
  padding: 10px 12px 12px;
  border-radius: 10px;
  background: #f7f8fa;
}

.fs-cond-head,
.fs-cond-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fs-cond-row {
  margin-top: 8px;
}

.fs-field {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 600;
}

.fs-del {
  padding: 4px;
  font-size: 18px;
  color: var(--h5-text-3);
}

.fs-op {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: var(--van-primary-color);
}

.fs-value,
.fs-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #e3e6eb;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 14px;
  line-height: 32px;
  color: var(--h5-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fs-input {
  outline: none;
}

.fs-input:focus {
  border-color: var(--van-primary-color);
}

.fs-value.empty {
  color: #9aa1ab;
}

.fs-add {
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

.fs-loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.fs-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.fs-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.fs-check {
  color: var(--van-primary-color);
  font-size: 18px;
}

.fs-foot {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  padding: 10px 16px 12px;
}
</style>
