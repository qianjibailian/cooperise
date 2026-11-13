<template>
  <div class="filter-panel" :class="{ 'is-embedded': embedded }">
    <div class="filter-panel-header">
      <span class="filter-title">{{ embedded ? '自定义条件' : '全局筛选' }}<span class="filter-count">{{ conditions.length }}</span></span>
      <div class="filter-actions">
        <span class="filter-logic-label">满足</span>
        <a-select v-model:value="logicLocal" size="small" class="filter-logic">
          <a-select-option value="AND">全部条件</a-select-option>
          <a-select-option value="OR">任一条件</a-select-option>
        </a-select>
        <template v-if="!embedded">
          <span class="filter-divider">|</span>
          <span class="filter-action-link" @click="resetDefault">恢复默认</span>
        </template>
        <span class="filter-divider">|</span>
        <span class="filter-action-link" @click="handleClear">清空</span>
      </div>
    </div>

    <div class="filter-conditions">
      <a-empty
        v-if="!conditions.length"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        :description="embedded ? '暂无自定义条件' : '暂无筛选条件，将展示全部事项'"
      />

      <div v-for="(cond, index) in conditions" :key="index" class="filter-row">
        <span class="condition-logic-text">{{ index === 0 ? '当' : logicLocal === 'AND' ? '且' : '或' }}</span>

        <!-- 字段 -->
        <a-select
          :value="cond.field || undefined"
          class="condition-field"
          size="small"
          placeholder="选择字段"
          :loading="fieldLoading"
          :options="fieldOptionsFor(cond)"
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
            :loading="optionLoading[cond.field]"
            show-search
            option-filter-prop="label"
            class="value-input"
            :dropdown-match-select-width="false"
            popup-class-name="person-select-popup"
            @focus="ensureOptions(cond)"
            @change="(v: unknown) => setSelectValues(cond, v)"
          >
            <!-- 选中标签：与人员同款胶囊，前缀为颜色点 / 问题类型图标 -->
            <template #tagRender="{ value, closable, onClose }">
              <span class="value-tag" :title="selectOptionOf(cond, String(value)).label">
                <span
                  v-if="cond.field === 'issuetype'"
                  class="value-tag-icon"
                  :style="{ background: selectOptionOf(cond, String(value)).color || DEFAULT_MARK_COLOR }"
                ><component :is="issueTypeIconOf(selectOptionOf(cond, String(value)).icon)" /></span>
                <i
                  v-else-if="selectOptionOf(cond, String(value)).color"
                  class="value-tag-dot"
                  :style="{ background: selectOptionOf(cond, String(value)).color }"
                />
                <span class="value-tag-text">{{ selectOptionOf(cond, String(value)).label }}</span>
                <CloseOutlined
                  v-if="closable"
                  class="value-tag-close"
                  @mousedown.prevent
                  @click.stop="onClose"
                />
              </span>
            </template>
            <a-select-option
              v-for="opt in selectOptionsOf(cond)"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <span class="select-option">
                <span
                  v-if="cond.field === 'issuetype'"
                  class="select-option-icon"
                  :style="{ background: opt.color || DEFAULT_MARK_COLOR }"
                ><component :is="issueTypeIconOf(opt.icon)" /></span>
                <i v-else-if="opt.color" class="select-option-dot" :style="{ background: opt.color }" />
                <span class="select-option-name">{{ opt.label }}</span>
              </span>
            </a-select-option>
          </a-select>

          <a-select
            v-else-if="kindOf(cond) === 'user'"
            :value="cond.values"
            mode="multiple"
            size="small"
            placeholder="搜索人员"
            :filter-option="false"
            :loading="userLoading"
            class="value-input"
            :dropdown-match-select-width="false"
            popup-class-name="person-select-popup"
            @search="searchUsers"
            @focus="searchUsers('')"
            @change="(v: unknown, opts: unknown) => setUserValues(cond, v, opts)"
          >
            <!-- 选中标签：头像 + realName（coAccount） -->
            <template #tagRender="{ value, closable, onClose }">
              <span class="value-tag" :title="userTagTitle(cond, String(value))">
                <a-avatar
                  v-if="String(value) !== CURRENT_USER"
                  :size="16"
                  :src="userTagAvatar(String(value)) || undefined"
                  class="value-tag-avatar"
                >{{ userTagName(cond, String(value)).charAt(0) }}</a-avatar>
                <span class="value-tag-text">{{ userTagName(cond, String(value)) }}</span>
                <CloseOutlined
                  v-if="closable"
                  class="value-tag-close"
                  @mousedown.prevent
                  @click.stop="onClose"
                />
              </span>
            </template>
            <a-select-option
              v-for="opt in userOptionsOf(cond)"
              :key="String(opt.value)"
              :value="opt.value"
              :label="opt.label"
            >
              <span class="user-option">
                <a-avatar :size="18" :src="opt.avatarUrl || undefined" class="user-option-avatar">
                  {{ initialOf(opt) }}
                </a-avatar>
                <span class="user-option-name">{{ opt.name || opt.label }}</span>
                <span v-if="opt.account" class="user-option-account">（{{ opt.account }}）</span>
              </span>
            </a-select-option>
          </a-select>

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

    <div v-if="!embedded" class="filter-footer">
      <a-button class="fp-btn" size="small" @click="emit('reset')">重置</a-button>
      <a-button class="fp-btn fp-btn-primary" size="small" type="primary" @click="handleSave">保存</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Empty } from 'ant-design-vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import {
  queryWorkbenchFieldList,
  queryIssueTypes,
  queryIssueTypeStatuses,
  queryUsers,
  getAvailableFieldOptions,
} from '@/api/faiz'
import type { AvailableFieldItem, UserItem } from '@/types/faiz'
import { toFieldOperator, type FieldOperator } from '@/types/fieldOperator'
import { personLabel, personName, personAccount, personAvatar } from '@/utils/person'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'
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
  /** 嵌入表单使用（如看板弹窗）：隐藏「恢复默认」与底部「重置 / 保存」，条件实时通过 v-model 回传 */
  embedded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  modelValue: () => [],
  logic: 'AND',
  embedded: false,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:modelValue', value: FilterCondition[]): void
  (e: 'update:logic', value: FilterLogic): void
  (e: 'save'): void
  (e: 'reset'): void
}>()

/** 保存：通知父级保存草稿后关闭面板 */
function handleSave() {
  emit('save')
  emit('update:visible', false)
}

/** 选项：人员项额外带头像 / 姓名 / 账号（账号在括号中展示）；枚举项带颜色，问题类型带图标 */
type Option = {
  value: string
  label: string
  disabled?: boolean
  avatarUrl?: string
  name?: string
  account?: string
  color?: string
  icon?: string | null
}

/** 问题类型图标底色兜底 */
const DEFAULT_MARK_COLOR = '#8c8c8c'

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
/** 字段列表未返回的条件（如默认条件 / 历史草稿）回显用的名称 */
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
  // 字段来自 /systemField/all：fieldId 为值，fieldName 为下拉与选中回显
  const list: Option[] = availableFields.value.map((f) => ({ value: f.fieldId, label: f.fieldName }))
  const known = new Set(list.map((o) => o.value))
  // 条件里已有但字段列表没有的（默认条件 / 历史草稿），补上避免显示裸 id
  for (const c of conditions.value) {
    if (c.field && !known.has(c.field)) {
      known.add(c.field)
      list.push({ value: c.field, label: SYSTEM_FIELD_LABELS[c.field] || c.field })
    }
  }
  return list
})

/** 字段下拉：其他条件已选的字段置灰，同一字段不能重复添加（当前条件自身的字段保持可选） */
function fieldOptionsFor(c: FilterCondition): Option[] {
  const used = new Set(conditions.value.filter((x) => x !== c && x.field).map((x) => x.field))
  return fieldOptions.value.map((o) => (used.has(o.value) ? { ...o, disabled: true } : o))
}

async function loadAvailableFields() {
  fieldLoading.value = true
  try {
    // 与日历「分组」「字段」同源：/availableField/list（自定义字段 + 系统字段），一次取全量
    const res = await queryWorkbenchFieldList({ page: 1, pageSize: 500, searchKey: '' })
    if (res?.success && res.data?.list) availableFields.value = res.data.list.filter((f) => !f.obsolete)
  } catch {
    // 请求层已统一提示；保留上次结果
  } finally {
    fieldLoading.value = false
  }
}

function kindOf(c: FilterCondition): ValueKind {
  const f = fieldById.value.get(c.field)
  return valueKindOf(c.field, f?.filedType || f?.type)
}

/** 字段操作符 → 筛选 operationType：选项、人员类字段多选，「包含 / 不包含」即「属于 / 不属于」 */
function operatorCodeOf(op: FieldOperator, kind: ValueKind): string | undefined {
  const code = op.code.toUpperCase()
  if (kind === 'select' || kind === 'user') {
    if (code === 'CONTAIN') return 'BELONG'
    if (code === 'NOT_CONTAIN') return 'NOT_BELONG'
  }
  return OPERATORS[code] ? code : undefined
}

/** 操作符选项：按字段 supportOperator 展示（文案取接口原文）；字段未配置时按值类型兜底 */
function operatorOptionsOf(c: FilterCondition): Option[] {
  const kind = kindOf(c)
  const supported = fieldById.value.get(c.field)?.supportOperator ?? []
  const list: Option[] = []
  // supportOperator 为 [{id, name, code, identifier}]：code 为值，name 为展示
  for (const raw of supported) {
    const op = toFieldOperator(raw)
    const code = op && operatorCodeOf(op, kind)
    if (op && code && !list.some((o) => o.value === code)) list.push({ value: code, label: op.name })
  }
  if (!list.length) {
    list.push(...OPERATORS_BY_KIND[kind].map((code) => ({ value: code, label: OPERATORS[code].label })))
  }
  // 当前已选但字段不支持的操作符（默认条件 / 历史草稿）保留，避免显示裸枚举
  if (c.operator && !list.some((o) => o.value === c.operator)) {
    list.push({ value: c.operator, label: OPERATORS[c.operator]?.label ?? c.operator })
  }
  return list
}

function isNoValue(c: FilterCondition): boolean {
  return !!OPERATORS[c.operator]?.noValue
}

/** 切换字段：重置操作符与值，并预加载该字段的选项 */
function onFieldChange(c: FilterCondition, field: string) {
  c.field = field
  c.operator = ''
  c.operator = String(operatorOptionsOf(c)[0]?.value ?? OPERATORS_BY_KIND[kindOf(c)][0])
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

/** 选中标签回显：选项未加载时用保存时记录的 labels */
function selectOptionOf(c: FilterCondition, value: string): Option {
  return optionMap[c.field]?.find((o) => o.value === value) ?? { value, label: c.labels?.[value] ?? value }
}

/** 选枚举值：与人员一致，同时记下显示名，保存后再次打开（选项未加载前）也能回显 */
function setSelectValues(c: FilterCondition, v: unknown) {
  setValues(c, v)
  const labels: Record<string, string> = {}
  for (const val of c.values) labels[val] = selectOptionOf(c, val).label
  c.labels = labels
}

/**
 * 选项按空间过滤：条件里空间只选了一个时取该空间；没有则不过滤。
 * 人员只列拥有该空间的用户，问题类型（及状态）只列该空间的类型
 */
const optionSpaceCode = computed<string | undefined>(() => {
  const spaces = conditions.value.find((c) => c.field === 'space' && c.operator === 'BELONG')?.values ?? []
  return spaces.length === 1 ? spaces[0] : undefined
})

/** 问题类型列表按空间只拉一次，状态与问题类型选项共用 */
let issueTypesPromise: Promise<{ id: number; issueTypeName: string; issueTypeCode?: string; color?: string; iconUri?: string | null }[]> | null = null
function loadIssueTypes() {
  // 选了空间时只列该空间的问题类型（状态选项也随之只取这些类型下的状态）
  issueTypesPromise ??= queryIssueTypes({ page: 1, pageSize: 999, status: 1, spaceCode: optionSpaceCode.value })
    .then((res) => (res?.success ? res.data?.list || [] : []))
    .catch(() => [])
  return issueTypesPromise
}

/** 字段可选项：问题类型 → 编码；状态 → 所有问题类型下的状态（按编码去重）；其他下拉字段 → 自定义选项接口 */
async function fetchOptions(field: string): Promise<Option[]> {
  if (field === 'issuetype') {
    const types = await loadIssueTypes()
    return types.map((t) => ({ value: t.issueTypeCode || String(t.id), label: t.issueTypeName, color: t.color, icon: t.iconUri }))
  }
  if (field === 'status') {
    const types = await loadIssueTypes()
    const lists = await Promise.all(types.filter((t) => t.issueTypeCode).map((t) => queryIssueTypeStatuses(t.issueTypeCode as string).then((r) => r?.data || []).catch(() => [])))
    const seen = new Map<string, Option>()
    for (const list of lists) {
      for (const s of list) {
        const value = s.statusCode || String(s.id ?? '')
        if (value && !seen.has(value)) seen.set(value, { value, label: s.statusName, color: s.color })
      }
    }
    return [{ value: ALL_NOT_DONE, label: '所有未结束状态' }, ...seen.values()]
  }
  const f = fieldById.value.get(field)
  const res = await getAvailableFieldOptions([
    { fieldId: field, type: String(f?.filedType || f?.type || 'SELECT_LIST_SINGLE').toUpperCase(), projectId: optionSpaceCode.value || '18701', issueTypeCode: '' },
  ])
  const bucket = (res?.data || [])[0] as any
  const raw: any[] = Array.isArray(bucket?.options) ? bucket.options : Array.isArray(bucket?.options?.options) ? bucket.options.options : []
  return raw
    .filter((x) => x != null)
    .map((x) => ({
      value: String(x.value ?? x.id ?? x.label ?? x.name),
      label: String(x.label ?? x.name ?? x.value ?? ''),
      ...(x.color ? { color: String(x.color) } : {}),
    }))
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
  const base: Option[] = [
    { value: CURRENT_USER, label: '当前用户', name: '当前用户' },
    ...userOptions.value,
  ]
  // 已选但不在当前搜索结果中的值：用记录的展示名回显（无头像时走默认头像）
  const extra = c.values
    .filter((v) => !base.some((o) => o.value === v))
    .map((v) => {
      const label = c.labels?.[v] ?? v
      // labels 里存的是「姓名（账号）」，拆出姓名与账号，标签只显示姓名
      const m = /^(.*?)（(.*)）$/.exec(label)
      return m
        ? { value: v, label, name: m[1], account: m[2] }
        : { value: v, label, name: label }
    })
  return [...base, ...extra]
}

/** 头像兜底文字：取姓名首字，无则账号首字 */
function initialOf(opt: Option): string {
  const s = (opt.name || opt.label || '').trim()
  return s ? s.charAt(0) : '?'
}

/**
 * 选中标签文字：realName（coAccount）
 * 依次回退：当前搜索结果 → 「当前用户」→ 保存时记录的 labels → 原始值
 * 只读 userOptions（稳定数组），不再每次新建选项列表
 */
function userTagName(c: FilterCondition, value: string): string {
  const hit = userOptions.value.find((o) => String(o.value) === value)
  if (hit?.label) return hit.label
  if (value === CURRENT_USER) return '当前用户'
  return c.labels?.[value] ?? value
}

/** 选中标签头像 */
function userTagAvatar(value: string): string {
  return userOptions.value.find((o) => String(o.value) === value)?.avatarUrl || ''
}

/** 选中标签 hover 提示：姓名（账号） */
function userTagTitle(c: FilterCondition, value: string): string {
  const hit = userOptions.value.find((o) => String(o.value) === value)
  if (hit) return hit.account ? `${hit.name || ''}（${hit.account}）` : hit.label
  if (value === CURRENT_USER) return '当前用户'
  return c.labels?.[value] ?? value
}

/** /user/query 结果 → 人员选项
 * 唯一值取 memberId（接口返回的 userNo 可能为 null，用空值当 value 会导致选中一个勾上全部） */
function mapUserOptions(list: UserItem[]): Option[] {
  const seen = new Set<string>()
  const opts: Option[] = []
  for (const u of list) {
    const value = String(u.memberId || u.userNo || u.coAccount || u.userCoAccount || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    const person = u as unknown as Record<string, unknown>
    const name = personName(person) || personAccount(person) || value
    // 括号中展示账号 coAccount（无则退回该人员唯一值）
    const account = personAccount(person) || value
    opts.push({
      value,
      label: personLabel(person) || value,
      avatarUrl: personAvatar(person),
      name,
      account: account !== name ? account : '',
    })
  }
  return opts
}

/** 预取人员列表：面板首次打开时执行一次，保证草稿里已选的人员也能回显姓名 */
async function prefetchUsers() {
  if (userOptions.value.length) return
  try {
    const res = await queryUsers({ keyword: '', isActive: 1, spaceCode: optionSpaceCode.value, page: 1, pageSize: 200 })
    userOptions.value = mapUserOptions(res?.data?.list || [])
  } catch {
    // 请求层已统一提示
  }
}

function searchUsers(keyword: string) {
  clearTimeout(userTimer)
  userTimer = setTimeout(async () => {
    const seq = ++userSeq
    userLoading.value = true
    try {
      const res = await queryUsers({ keyword: keyword.trim(), spaceCode: optionSpaceCode.value, page: 1, pageSize: 20 })
      if (seq !== userSeq) return
      userOptions.value = mapUserOptions(res?.data?.list || [])
    } catch {
      if (seq === userSeq) userOptions.value = []
    } finally {
      if (seq === userSeq) userLoading.value = false
    }
  }, 250)
}

// 空间变化：丢弃按旧空间拉的问题类型 / 状态 / 人员选项，按新空间重拉
watch(optionSpaceCode, () => {
  issueTypesPromise = null
  // 下拉类自定义字段的选项也按空间（projectId）拉取，一并作废
  for (const k of Object.keys(optionMap)) delete optionMap[k]
  userOptions.value = []
  if (props.visible) {
    prefetchUsers()
    conditions.value.forEach(ensureOptions)
  }
})

/** 选人：同时记下显示名，保存后再次打开仍能正确回显 */
function setUserValues(c: FilterCondition, v: unknown, opts: unknown) {
  setValues(c, v)
  const labels: Record<string, string> = {}
  const list = Array.isArray(opts) ? (opts as Option[]) : []
  // option 上带 label（= 姓名（账号）），取不到时回退当前选项列表 / 已有记录
  const known = new Map(userOptionsOf(c).map((o) => [String(o.value), o.label]))
  for (const val of c.values) {
    labels[val] = list.find((o) => String(o?.value) === String(val))?.label
      ?? known.get(String(val))
      ?? c.labels?.[val]
      ?? val
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
  // 人员列表与字段列表并行预取：前者用于已选人员回显姓名/头像
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  prefetchUsers()
  await loadAvailableFields()
  conditions.value.forEach(ensureOptions)
})

// 每次打开面板：重新拉取全部系统字段（与系统字段管理保持同步），并补齐选项（草稿回填后新增的条件）
watch(
  () => props.visible,
  async (open, wasOpen) => {
    if (!open) return
    conditions.value.forEach(ensureOptions)
    if (wasOpen === false) {
      await loadAvailableFields()
      conditions.value.forEach(ensureOptions)
    }
  },
)
</script>

<style scoped>
/* 视觉风格参考 Apple（SF 系统字体 / 灰阶层次 / 圆角卡片）与 Google（细边控件 / 蓝色焦点环） */
.filter-panel {
  padding: 14px 16px 12px;
  min-height: 220px;
  background: #fff;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto,
    'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
}

.filter-panel.is-embedded {
  padding: 10px 12px;
  min-height: 0;
  border: 1px solid rgba(60, 60, 67, 0.12);
  border-radius: 8px;
}

.filter-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #1d1d1f;
}

.filter-count {
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

.filter-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.filter-logic-label {
  font-size: 12px;
  color: #6e6e73;
}

.filter-logic {
  width: 104px;
}

.filter-action-link {
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #6e6e73;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.filter-action-link:hover {
  background: rgba(60, 60, 67, 0.06);
  color: #1d1d1f;
}

.filter-divider {
  margin: 0 2px;
  font-size: 11px;
  color: #e5e5ea;
}

.filter-conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 条件行：浅灰圆角卡片，hover 微加深；顶部对齐以支持值控件自适应增高 */
.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(118, 118, 128, 0.06);
  transition: background 0.15s ease;
}

.filter-row:hover {
  background: rgba(118, 118, 128, 0.1);
}

.condition-logic-text {
  flex-shrink: 0;
  width: 22px;
  font-size: 12px;
  line-height: 24px;
  color: #6e6e73;
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
  color: #aeaeb2;
}

/* 人员选项：头像 + 姓名（账号） */
.user-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.user-option-avatar {
  flex-shrink: 0;
  font-size: 11px;
  background: var(--c-primary);
}

.user-option-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.user-option-account {
  flex-shrink: 0;
  font-size: 12px;
  color: #8e8e93;
}

/* 枚举选项：颜色点 / 问题类型图标 + 名称（与人员选项同样的行高与间距） */
.select-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.select-option-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin: 0 5px;
  border-radius: 50%;
}

.select-option-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  font-size: 11px;
  color: #fff;
}

.select-option-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 选中标签（人员 / 枚举通用）：紧凑胶囊，前缀头像 / 颜色点 / 类型图标 */
.value-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 140px;
  height: 22px;
  margin: 2px 4px 2px 0;
  padding: 0 6px 0 8px;
  border-radius: 6px;
  background: rgba(118, 118, 128, 0.12);
  color: #1d1d1f;
  font-size: 12px;
  line-height: 22px;
  transition: background 0.15s ease;
}

.value-tag:hover {
  background: rgba(118, 118, 128, 0.18);
}

.value-tag-avatar {
  flex-shrink: 0;
  font-size: 9px;
  line-height: 16px;
  background: var(--c-primary);
}
.value-tag-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin: 0 1px;
  border-radius: 50%;
}

.value-tag-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 10px;
  color: #fff;
}

.value-tag-text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.value-tag-close {
  flex-shrink: 0;
  padding: 2px;
  font-size: 10px;
  color: #8e8e93;
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.15s ease, background 0.15s ease;
}

.value-tag-close:hover {
  background: rgba(60, 60, 67, 0.1);
  color: #ff3b30;
}

.condition-delete {
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

.condition-delete:hover {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

.filter-add-row {
  padding-left: 32px;
}

.filter-add-btn {
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

.filter-add-btn:hover {
  background: transparent;
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border-color: var(--c-primary);
}

.filter-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(60, 60, 67, 0.08);
}

.fp-btn {
  height: 30px;
  padding: 0 16px;
  border: 1px solid #d2d2d7;
  border-radius: 999px;
  background: #fff;
  color: #1d1d1f;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.fp-btn:hover {
  background: #f5f5f7;
}

.fp-btn-primary,
.fp-btn-primary:hover {
  border-color: var(--c-primary);
  background: var(--c-primary);
  color: #fff;
  box-shadow: 0 2px 8px transparent;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--c-primary) 28%, transparent);
}

/* 控件：细边 + 圆角 + 蓝色焦点环 */
.filter-panel :deep(.ant-select-sm .ant-select-selector),
.filter-panel :deep(.ant-input-sm),
.filter-panel :deep(.ant-input-number-sm),
.filter-panel :deep(.ant-picker-small) {
  border: 1px solid #d2d2d7 !important;
  border-radius: 8px !important;
  background: #fff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.filter-panel :deep(.ant-select-sm:hover .ant-select-selector),
.filter-panel :deep(.ant-input-sm:hover),
.filter-panel :deep(.ant-picker-small:hover) {
  border-color: #aeaeb2 !important;
}

.filter-panel :deep(.ant-select-focused .ant-select-selector),
.filter-panel :deep(.ant-input-sm:focus),
.filter-panel :deep(.ant-picker-focused) {
  border-color: var(--c-primary) !important;
  box-shadow: 0 0 0 3px transparent !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 15%, transparent) !important;
}

/* 多选选中框：按选中项数量自适应高度（换行展示全部标签，不折叠成 +N） */
.filter-panel :deep(.ant-select-multiple .ant-select-selector) {
  height: auto;
  min-height: 24px;
  padding-top: 2px;
  padding-bottom: 2px;
  align-content: flex-start;
  flex-wrap: wrap;
}

.filter-panel :deep(.ant-select-selection-overflow) {
  flex-wrap: wrap;
}

.filter-panel :deep(.ant-select-selection-overflow-item) {
  flex: none;
  max-width: 100%;
}

/* tagRender 自带样式，清掉 antd 默认标签底色/内边距 */
.filter-panel :deep(.ant-select-multiple .ant-select-selection-item) {
  max-width: 100%;
  height: auto;
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  line-height: normal;
}

.filter-panel :deep(.ant-select-multiple .ant-select-selection-search) {
  margin-inline-start: 2px;
}

.filter-panel :deep(.ant-empty) {
  margin: 24px 0;
}

.filter-panel :deep(.ant-empty-description) {
  font-size: 12px;
  color: #8e8e93;
}
</style>

