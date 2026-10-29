<template>
  <div class="filter-panel">
    <div class="filter-panel-header">
      <span class="filter-title">全局筛选({{ conditions.length }})</span>
      <div class="filter-actions">
        <span class="filter-logic-label">满足</span>
        <a-select v-model:value="logicLocal" size="small" class="filter-logic">
          <a-select-option value="AND">全部条件</a-select-option>
          <a-select-option value="OR">任一条件</a-select-option>
        </a-select>
        <span class="filter-divider">|</span>
        <span class="filter-action-link" @click="resetDefault">恢复默认</span>
        <span class="filter-divider">|</span>
        <span class="filter-action-link" @click="handleClear">清空</span>
      </div>
    </div>

    <div class="filter-conditions">
      <a-empty v-if="!conditions.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无筛选条件，将展示全部事项" />

      <div v-for="(cond, index) in conditions" :key="index" class="filter-row">
        <span class="condition-logic-text">{{ index === 0 ? '当' : logicLocal === 'AND' ? '且' : '或' }}</span>

        <!-- 字段 -->
        <a-select
          :value="cond.field || undefined"
          class="condition-field"
          size="small"
          placeholder="选择字段"
          :loading="fieldLoading"
          :options="fieldOptions"
          show-search
          option-filter-prop="label"
          @change="(v: unknown) => onFieldChange(cond, String(v))"
        />

        <!-- 操作符 -->
        <a-select
          v-model:value="cond.operator"
          class="condition-operator"
          size="small"
          :options="operatorOptionsOf(cond)"
          @change="onOperatorChange(cond)"
        />

        <!-- 值：按字段类型渲染不同编辑器 -->
        <div class="condition-value">
          <span v-if="isNoValue(cond)" class="value-none">无需填写</span>

          <a-select
            v-else-if="kindOf(cond) === 'select'"
            :value="cond.values"
            mode="multiple"
            size="small"
            placeholder="请选择"
            :max-tag-count="2"
            :options="selectOptionsOf(cond)"
            :loading="optionLoading[cond.field]"
            show-search
            option-filter-prop="label"
            class="value-input"
            @change="(v: unknown) => setValues(cond, v)"
          />

          <a-select
            v-else-if="kindOf(cond) === 'user'"
            :value="cond.values"
            mode="multiple"
            size="small"
            placeholder="搜索人员"
            :max-tag-count="2"
            :options="userOptionsOf(cond)"
            :filter-option="false"
            :loading="userLoading"
            class="value-input"
            @search="searchUsers"
            @focus="searchUsers('')"
            @change="(v: unknown, opts: unknown) => setUserValues(cond, v, opts)"
          />

          <a-date-picker
            v-else-if="kindOf(cond) === 'date'"
            :value="cond.values[0] ? dayjs(cond.values[0]) : undefined"
            size="small"
            class="value-input"
            placeholder="选择日期"
            @change="(d: unknown) => (cond.values = d ? [dayjs(d as string).format('YYYY-MM-DD')] : [])"
          />

          <a-input-number
            v-else-if="kindOf(cond) === 'number'"
            :value="cond.values[0] !== undefined && cond.values[0] !== '' ? Number(cond.values[0]) : undefined"
            size="small"
            class="value-input"
            placeholder="请输入数字"
            @change="(v: unknown) => (cond.values = v === null || v === undefined || v === '' ? [] : [String(v)])"
          />

          <a-input
            v-else
            :value="cond.values[0] ?? ''"
            size="small"
            class="value-input"
            placeholder="请输入"
            allow-clear
            @update:value="(v: string) => (cond.values = v ? [v] : [])"
          />
        </div>

        <span class="condition-delete" title="删除条件" @click="removeCondition(index)">×</span>
      </div>

      <div class="filter-add-row">
        <span class="filter-add-btn" @click="addCondition">+ 新增条件</span>
      </div>
    </div>

    <div class="filter-footer">
      <span class="filter-footer-tip">「保存」会记住筛选，下次进入仍生效</span>
      <a-button size="small" @click="emit('save')">保存</a-button>
      <a-button size="small" type="primary" @click="emit('update:visible', false)">确定</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Empty } from 'ant-design-vue'
import {
  queryAvailableFields,
  queryIssueTypes,
  queryIssueTypeStatuses,
  queryUsers,
  getAvailableFieldOptions,
} from '@/api/faiz'
import type { AvailableFieldItem } from '@/types/faiz'
import {
  OPERATORS,
  OPERATORS_BY_KIND,
  CURRENT_USER,
  ALL_NOT_DONE,
  valueKindOf,
  defaultConditions,
  type FilterCondition,
  type FilterLogic,
  type ValueKind,
} from '@/utils/issueFilter'

interface Props {
  visible: boolean
  modelValue?: FilterCondition[]
  logic?: FilterLogic
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  modelValue: () => [],
  logic: 'AND',
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:modelValue', value: FilterCondition[]): void
  (e: 'update:logic', value: FilterLogic): void
  (e: 'save'): void
}>()

type Option = { value: string; label: string }

// ---------- 条件与逻辑：本地编辑，实时同步回父级 ----------
const conditions = ref<FilterCondition[]>(JSON.parse(JSON.stringify(props.modelValue)))
const logicLocal = ref<FilterLogic>(props.logic)

watch(conditions, () => emit('update:modelValue', JSON.parse(JSON.stringify(conditions.value))), { deep: true })
watch(logicLocal, (v) => emit('update:logic', v))
// 父级回填（如草稿加载完成）时同步到面板
watch(
  () => props.modelValue,
  (v) => {
    if (JSON.stringify(v) !== JSON.stringify(conditions.value)) conditions.value = JSON.parse(JSON.stringify(v))
  },
  { deep: true },
)
watch(
  () => props.logic,
  (v) => (logicLocal.value = v),
)

// ---------- 字段 ----------
const fieldLoading = ref(false)
const availableFields = ref<AvailableFieldItem[]>([])
const SYSTEM_FIELD_LABELS: Record<string, string> = {
  assignee: '经办人',
  creator: '创建人',
  reporter: '报告人',
  status: '状态',
  issuetype: '问题类型',
  priority: '优先级',
  summary: '概要',
  created: '创建时间',
  updated: '更新时间',
}

const fieldById = computed(() => new Map(availableFields.value.map((f) => [f.fieldId, f] as const)))

const fieldOptions = computed<Option[]>(() => {
  const list: Option[] = availableFields.value.map((f) => ({ value: f.fieldId, label: f.fieldName }))
  const known = new Set(list.map((o) => o.value))
  // 常用系统字段兜底（接口未返回时也可选）
  for (const [id, label] of Object.entries(SYSTEM_FIELD_LABELS)) {
    if (!known.has(id)) {
      known.add(id)
      list.push({ value: id, label })
    }
  }
  // 草稿里已有但字段列表没有的，补上避免显示裸 id
  for (const c of conditions.value) {
    if (c.field && !known.has(c.field)) {
      known.add(c.field)
      list.push({ value: c.field, label: c.field })
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

function kindOf(c: FilterCondition): ValueKind {
  const f = fieldById.value.get(c.field)
  return valueKindOf(c.field, f?.filedType || f?.type)
}

function operatorOptionsOf(c: FilterCondition): Option[] {
  return OPERATORS_BY_KIND[kindOf(c)].map((code) => ({ value: code, label: OPERATORS[code].label }))
}

function isNoValue(c: FilterCondition): boolean {
  return !!OPERATORS[c.operator]?.noValue
}

/** 切换字段：重置操作符与值，并预加载该字段的选项 */
function onFieldChange(c: FilterCondition, field: string) {
  c.field = field
  c.operator = OPERATORS_BY_KIND[kindOf(c)][0]
  c.values = []
  c.labels = {}
  ensureOptions(c)
}

function onOperatorChange(c: FilterCondition) {
  if (isNoValue(c)) c.values = []
  // 单值操作符只保留第一个值
  else if (!OPERATORS[c.operator]?.multi && c.values.length > 1) c.values = c.values.slice(0, 1)
}

function setValues(c: FilterCondition, v: unknown) {
  c.values = Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)]
}

// ---------- 选项：状态 / 问题类型 / 自定义下拉 ----------
const optionMap = reactive<Record<string, Option[]>>({})
const optionLoading = reactive<Record<string, boolean>>({})

function selectOptionsOf(c: FilterCondition): Option[] {
  const opts = optionMap[c.field] ?? []
  // 已选但不在选项中的值（如历史草稿）也要能回显
  const extra = c.values.filter((v) => !opts.some((o) => o.value === v)).map((v) => ({ value: v, label: c.labels?.[v] ?? v }))
  return [...opts, ...extra]
}

/** 问题类型列表只拉一次，状态与问题类型选项共用 */
let issueTypesPromise: Promise<{ id: number; issueTypeName: string; issueTypeCode?: string }[]> | null = null
function loadIssueTypes() {
  issueTypesPromise ??= queryIssueTypes({ page: 1, pageSize: 999, status: 1 })
    .then((res) => (res?.success ? res.data?.list || [] : []))
    .catch(() => [])
  return issueTypesPromise
}

/** 字段可选项：问题类型 → 编码；状态 → 所有问题类型下的状态（按编码去重）；其他下拉字段 → 自定义选项接口 */
async function fetchOptions(field: string): Promise<Option[]> {
  if (field === 'issuetype') {
    const types = await loadIssueTypes()
    return types.map((t) => ({ value: t.issueTypeCode || String(t.id), label: t.issueTypeName }))
  }
  if (field === 'status') {
    const types = await loadIssueTypes()
    const lists = await Promise.all(types.filter((t) => t.issueTypeCode).map((t) => queryIssueTypeStatuses(t.issueTypeCode as string).then((r) => r?.data || []).catch(() => [])))
    const seen = new Map<string, Option>()
    for (const list of lists) {
      for (const s of list) {
        const value = s.statusCode || String(s.id ?? '')
        if (value && !seen.has(value)) seen.set(value, { value, label: s.statusName })
      }
    }
    return [{ value: ALL_NOT_DONE, label: '所有未结束状态' }, ...seen.values()]
  }
  const f = fieldById.value.get(field)
  const res = await getAvailableFieldOptions([
    { fieldId: field, type: String(f?.filedType || f?.type || 'SELECT_LIST_SINGLE').toUpperCase(), projectId: '18701', issueTypeCode: '' },
  ])
  const bucket = (res?.data || [])[0] as any
  const raw: any[] = Array.isArray(bucket?.options) ? bucket.options : Array.isArray(bucket?.options?.options) ? bucket.options.options : []
  return raw
    .filter((x) => x != null)
    .map((x) => ({ value: String(x.value ?? x.id ?? x.label ?? x.name), label: String(x.label ?? x.name ?? x.value ?? '') }))
}

async function ensureOptions(c: FilterCondition) {
  if (kindOf(c) !== 'select' || !c.field || optionMap[c.field] || optionLoading[c.field]) return
  optionLoading[c.field] = true
  try {
    optionMap[c.field] = await fetchOptions(c.field)
  } catch {
    optionMap[c.field] = []
  } finally {
    optionLoading[c.field] = false
  }
}

// ---------- 人员 ----------
const userLoading = ref(false)
const userOptions = ref<Option[]>([])
let userSeq = 0
let userTimer: ReturnType<typeof setTimeout> | undefined

function userOptionsOf(c: FilterCondition): Option[] {
  const base: Option[] = [{ value: CURRENT_USER, label: '当前用户' }, ...userOptions.value]
  const extra = c.values.filter((v) => !base.some((o) => o.value === v)).map((v) => ({ value: v, label: c.labels?.[v] ?? v }))
  return [...base, ...extra]
}

function searchUsers(keyword: string) {
  clearTimeout(userTimer)
  userTimer = setTimeout(async () => {
    const seq = ++userSeq
    userLoading.value = true
    try {
      const res = await queryUsers({ keyword: keyword.trim(), page: 1, pageSize: 20 })
      if (seq !== userSeq) return
      userOptions.value = (res?.data?.list || []).map((u) => {
        const name = u.realName || u.coAccount || u.userCoAccount || u.userNo
        return { value: u.userNo, label: name && name !== u.userNo ? `${name}（${u.userNo}）` : u.userNo }
      })
    } catch {
      if (seq === userSeq) userOptions.value = []
    } finally {
      if (seq === userSeq) userLoading.value = false
    }
  }, 250)
}

/** 选人：同时记下显示名，保存后再次打开仍能正确回显 */
function setUserValues(c: FilterCondition, v: unknown, opts: unknown) {
  setValues(c, v)
  const labels: Record<string, string> = {}
  const list = Array.isArray(opts) ? (opts as Option[]) : []
  for (const val of c.values) {
    labels[val] = list.find((o) => o?.value === val)?.label ?? c.labels?.[val] ?? val
  }
  c.labels = labels
}

// ---------- 增删 ----------
function addCondition() {
  conditions.value.push({ field: '', operator: 'BELONG', values: [] })
}

function removeCondition(index: number) {
  conditions.value.splice(index, 1)
}

function handleClear() {
  conditions.value = []
}

function resetDefault() {
  conditions.value = defaultConditions()
  logicLocal.value = 'AND'
  conditions.value.forEach(ensureOptions)
}

onMounted(async () => {
  await loadAvailableFields()
  conditions.value.forEach(ensureOptions)
})

// 打开面板时补齐选项（草稿回填后新增的条件）
watch(
  () => props.visible,
  (open) => {
    if (open) conditions.value.forEach(ensureOptions)
  },
)
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
  margin-bottom: 12px;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-logic-label {
  font-size: 13px;
  color: #595959;
}

.filter-logic {
  width: 100px;
}

.filter-action-link {
  font-size: 13px;
  color: #1677ff;
  cursor: pointer;
  user-select: none;
}

.filter-action-link:hover {
  color: #4096ff;
}

.filter-divider {
  color: #d9d9d9;
  font-size: 12px;
  margin: 0 2px;
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

.condition-logic-text {
  flex-shrink: 0;
  width: 24px;
  font-size: 13px;
  color: #8c8c8c;
  text-align: center;
}

.condition-field {
  flex-shrink: 0;
  width: 150px;
}

.condition-operator {
  flex-shrink: 0;
  width: 116px;
}

.condition-value {
  flex: 1;
  min-width: 0;
}

.value-input {
  width: 100%;
}

.value-none {
  font-size: 12px;
  color: #bfbfbf;
}

.condition-delete {
  flex-shrink: 0;
  width: 20px;
  font-size: 16px;
  line-height: 1;
  color: #bfbfbf;
  text-align: center;
  cursor: pointer;
}

.condition-delete:hover {
  color: #ff4d4f;
}

.filter-add-row {
  padding-left: 32px;
}

.filter-add-btn {
  font-size: 13px;
  color: #1677ff;
  cursor: pointer;
  user-select: none;
}

.filter-add-btn:hover {
  color: #4096ff;
}

.filter-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.filter-footer-tip {
  margin-right: auto;
  font-size: 12px;
  color: #8c8c8c;
}
</style>
