/**
 * 手机 H5 共用的数据处理（只用接口层与纯函数，不引入网页版组件）
 */
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { getAvailableFieldOptions, getUserDetail, queryIssueTypeStatuses, queryIssueTypes, queryUsers, queryWorkbenchFieldList } from '@/api/faiz'
import { currentSpaceCode } from '@/utils/current-space'
import { ALL_NOT_DONE } from '@/utils/issueFilter'
import type { DetailField, DetailLayoutGroup, IssueFieldItem, IssueRecord } from '@/types/faiz'
import { normalizeFieldType } from '@/types/fieldType'
import { fieldOf, fieldText, hexOr, issueKeyOf, objOf } from '@/utils/issue-view'
import { personLabel, personAvatar, personInitial, personKey } from '@/utils/person'
import { useAuth } from '@/utils/auth'
import { useSpaces } from '@/utils/space-store'

export { fieldOf, fieldText, issueKeyOf, personLabel, personAvatar, personInitial, personKey }

// ---------------- 列表行 ----------------

/** 列表 / 看板卡片要显示的字段（/issue/query 只返回 showField 里列出的字段） */
export const LIST_FIELDS = ['issuekey', 'summary', 'status', 'issuetype', 'assignee', 'priority', 'updated', 'createtime']

export interface IssueBrief {
  key: string
  summary: string
  statusName: string
  statusColor: string
  typeName: string
  typeColor: string
  assignee: Record<string, unknown> | null
  priority: string
  updated: string
}

/** /issue/query 的一行 → 列表展示用 */
export function briefOf(rec: IssueRecord): IssueBrief {
  const status = objOf(fieldOf(rec, 'status')?.value)
  const type = objOf(fieldOf(rec, 'issuetype')?.value)
  const assignee = objOf(fieldOf(rec, 'assignee')?.value)
  const updated = fieldOf(rec, 'updated')?.value ?? fieldOf(rec, 'createtime')?.value
  return {
    key: issueKeyOf(rec),
    summary: fieldText(fieldOf(rec, 'summary')) || '（无概要）',
    statusName: String(status?.name ?? status?.statusName ?? ''),
    statusColor: hexOr(status?.statusColor ?? status?.color, '#8a919c'),
    typeName: String(type?.name ?? type?.issueTypeName ?? ''),
    typeColor: hexOr(type?.issueTypeColor ?? type?.color, '#8b6fc0'),
    assignee,
    priority: fieldText(fieldOf(rec, 'priority') as IssueFieldItem | undefined),
    updated: formatRelative(updated),
  }
}

// ---------------- 时间 ----------------

/** 今天显示时间、今年显示月日、更早显示年月日 */
export function formatRelative(v: unknown): string {
  if (v == null || v === '') return ''
  const d = dayjs(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : (v as string | number))
  if (!d.isValid()) return String(v)
  const now = dayjs()
  if (d.isSame(now, 'day')) return d.format('HH:mm')
  if (d.isSame(now, 'year')) return d.format('MM-DD HH:mm')
  return d.format('YYYY-MM-DD')
}

export function formatDate(v: unknown, withTime = false): string {
  if (v == null || v === '') return ''
  const d = dayjs(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : (v as string | number))
  return d.isValid() ? d.format(withTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD') : String(v)
}

// ---------------- 详情字段 ----------------

/** 详情布局分组（COMMON_LIST / TAB_CONTAINER）→ 平铺字段 */
export function flattenGroupFields(g?: DetailLayoutGroup): DetailField[] {
  const data = g?.fieldGroupStructure?.data
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.tabItems)) return data.tabItems.flatMap((t) => t.issueFields || [])
  return []
}

/** 选项值（单选）统一成提交格式 {optionId, optionName, color?} */
export function toOption(v: unknown): { optionId: string; optionName: string; color?: string } | null {
  const o = objOf(v)
  if (!o) return null
  const optionId = String(o.optionId ?? o.id ?? o.value ?? '')
  if (!optionId) return null
  const optionName = String(o.optionName ?? o.pname ?? o.name ?? o.label ?? optionId)
  const color = typeof o.color === 'string' ? o.color : typeof o.statusColor === 'string' ? o.statusColor : undefined
  return color ? { optionId, optionName, color } : { optionId, optionName }
}

/** 详情里的字段值 → 编辑器 / 提交（PATCH /issue/{key}）使用的格式 */
export function editValueOf(field: { type?: string; value?: unknown; exportValue?: unknown }): unknown {
  const type = normalizeFieldType(field.type)
  const v = field.value
  switch (type) {
    case 'DATE_PICKER':
      return v ? formatDate(v) : ''
    case 'TIME_PICKER':
      return v ? formatDate(v, true) : ''
    case 'SELECT_LIST_SINGLE':
      return toOption(v)
    case 'SELECT_LIST_MULTI':
      return Array.isArray(v) ? v.map(toOption).filter(Boolean) : []
    case 'SELECT_USER_SINGLE':
      return objOf(v)
    case 'SELECT_USER_MULTI':
      return Array.isArray(v) ? v.filter((x) => objOf(x)) : []
    case 'TEXT_BOX_NUMBER':
      return v === '' || v == null ? null : Number(v)
    case 'CASCADER_SINGLE':
      return objOf(v)
    default:
      return typeof v === 'string' ? v : v == null ? '' : String(field.exportValue ?? v)
  }
}

/** 字段值是否为空（必填校验） */
export function isEmptyValue(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return !v.replace(/<[^>]*>/g, '').trim()
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** 字段值 → 展示文字 */
export function displayOf(type: string | undefined, v: unknown): string {
  const t = normalizeFieldType(type)
  if (v == null || v === '') return ''
  if (t === 'SELECT_USER_SINGLE') return personLabel(v as Record<string, unknown>)
  if (t === 'SELECT_USER_MULTI') return (v as Record<string, unknown>[]).map((u) => personLabel(u)).join('、')
  if (t === 'SELECT_LIST_SINGLE') return toOption(v)?.optionName ?? ''
  if (t === 'SELECT_LIST_MULTI') return (v as unknown[]).map((o) => toOption(o)?.optionName).filter(Boolean).join('、')
  if (t === 'CASCADER_SINGLE') {
    const names: string[] = []
    let cur = objOf(v)
    while (cur) {
      names.push(String(cur.optionName ?? cur.name ?? cur.optionId ?? ''))
      const child = Array.isArray(cur.childJOptions) ? cur.childJOptions[0] : null
      cur = objOf(child)
    }
    return names.filter(Boolean).join(' / ')
  }
  if (t === 'RICH_TEXT') return String(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return String(v)
}

/** 纯文本 → 富文本字段 HTML（手机端用文本框编辑描述） */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text.split(/\n/).map((line) => `<p>${esc(line) || '<br>'}</p>`).join('')
}

/** 富文本 HTML → 纯文本（编辑描述时回填文本框） */
export function htmlToText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html.replace(/<\/p>\s*<p[^>]*>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
  return (div.textContent || '').trim()
}

// ---------------- 选项 / 人员 ----------------

export interface OptionNode {
  text: string
  value: string
  color?: string
  children?: OptionNode[]
}

function toNode(raw: unknown, i: number): OptionNode {
  const b = (raw ?? {}) as Record<string, unknown>
  const kids = Array.isArray(b.children) ? b.children : Array.isArray(b.childJOptions) ? b.childJOptions : null
  const ext = objOf(b.ext)
  const color = typeof b.color === 'string' ? b.color : typeof ext?.color === 'string' ? (ext.color as string) : undefined
  const node: OptionNode = {
    text: String(b.label ?? b.name ?? b.optionName ?? b.text ?? `选项${i + 1}`),
    value: String(b.value ?? b.id ?? b.optionId ?? b.key ?? ''),
    color,
  }
  if (kids && kids.length) node.children = kids.map(toNode)
  return node
}

/** 查询字段选项（单选 / 多选 / 级联）：详情页传 issueKey，新建页传空间 + 问题类型 */
export async function loadFieldOptions(
  field: { id: string; type?: string },
  ctx: { issueKey?: string; spaceCode?: string; issueTypeCode?: string },
): Promise<OptionNode[]> {
  const res = await getAvailableFieldOptions([{
    fieldId: field.id,
    type: normalizeFieldType(field.type),
    projectId: ctx.spaceCode || '',
    issueTypeCode: ctx.issueTypeCode || '',
    issueKey: ctx.issueKey,
    page: 1,
    pageSize: 999,
  }])
  if (!res?.success || !Array.isArray(res.data)) return []
  const bucket = res.data.find((b) => String(b.fieldId ?? b.customFieldId ?? '') === field.id) as Record<string, unknown> | undefined
  const jList = objOf(bucket?.joptions)?.list
  const raw = bucket?.options
  const inner = Array.isArray(raw) ? raw : Array.isArray(objOf(raw)?.options) ? (objOf(raw)!.options as unknown[]) : []
  const list = Array.isArray(jList) && jList.length ? jList : inner
  return list.filter((x: unknown) => x != null && !(x as Record<string, unknown>).obsolete).map(toNode)
}

/** 搜索人员（在职） */
export async function searchUsers(keyword: string, ctx: { issueKey?: string; spaceCode?: string } = {}) {
  const res = await queryUsers({ keyword, isActive: 1, issueKey: ctx.issueKey, spaceCode: ctx.spaceCode, page: 1, pageSize: 30 })
  return (res?.success ? res.data?.list || [] : []) as unknown as Record<string, unknown>[]
}

// ---------------- 空间 ----------------

/**
 * 我能切换的空间（与网页版顶栏空间切换一致）：我被分配的空间 ∩ 启用的空间，按 sort 排序；
 * 当前空间无效时自动选第一个
 */
export function useMySpaces() {
  const { spaces, ensureLoaded, currentSpaceCode, setCurrentSpace } = useSpaces()
  const { user } = useAuth()
  const myCodes = ref<Set<string> | null>(null)
  const loading = ref(false)

  const mySpaces = computed(() => {
    const list = spaces.value.filter((s) => s.status === 1 && (!myCodes.value || myCodes.value.has(s.spaceCode)))
    return [...list].sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
  })
  const current = computed(() => mySpaces.value.find((s) => s.spaceCode === currentSpaceCode.value))

  async function load() {
    loading.value = true
    try {
      await ensureLoaded()
      const id = Number((user.value as Record<string, unknown> | null)?.id)
      if (id) {
        const res = await getUserDetail(id)
        const list = res?.data?.spaces
        if (res?.success && Array.isArray(list)) myCodes.value = new Set(list.map((s) => s.spaceCode))
      }
      if (!current.value && mySpaces.value.length) setCurrentSpace(mySpaces.value[0].spaceCode)
    } catch {
      // 请求层已统一提示
    } finally {
      loading.value = false
    }
  }

  return { mySpaces, current, currentSpaceCode, setCurrentSpace, load, loading }
}

/** 当前登录用户的 memberId（筛选草稿、视图查询用） */
export function myMemberId(): string {
  const { user } = useAuth()
  return String((user.value as Record<string, unknown> | null)?.memberId ?? '')
}

// ---------------- 全局筛选 / 排序（与网页版 FilterPanel / SortPanel 同源） ----------------

export interface FilterFieldMeta {
  id: string
  name: string
  type: string
}

/** 常用系统字段（字段 id 与网页版筛选一致） */
const BUILTIN_FIELDS: FilterFieldMeta[] = [
  { id: 'summary', name: '概要', type: 'TEXT_BOX_SINGLE_LINE' },
  { id: 'status', name: '状态', type: 'SELECT_LIST_SINGLE' },
  { id: 'issuetype', name: '问题类型', type: 'SELECT_LIST_SINGLE' },
  { id: 'priority', name: '优先级', type: 'SELECT_LIST_SINGLE' },
  { id: 'assignee', name: '经办人', type: 'SELECT_USER_SINGLE' },
  { id: 'creator', name: '创建人', type: 'SELECT_USER_SINGLE' },
  { id: 'createtime', name: '创建时间', type: 'DATE_PICKER' },
  { id: 'updated', name: '更新时间', type: 'DATE_PICKER' },
]

/** 可筛选 / 排序的字段：/availableField/list（系统字段 + 自定义字段，按当前空间），同一空间只拉一次 */
let fieldsPromise: Promise<FilterFieldMeta[]> | null = null
let fieldsSpace = ''
export function loadFilterFields(): Promise<FilterFieldMeta[]> {
  const space = currentSpaceCode.value || ''
  if (!fieldsPromise || fieldsSpace !== space) {
    fieldsSpace = space
    fieldsPromise = queryWorkbenchFieldList({ page: 1, pageSize: 500, searchKey: '' })
      .then((res) => {
        const list = (res?.success ? res.data?.list || [] : [])
          .filter((f) => !f.obsolete && f.fieldId)
          .map((f) => ({ id: f.fieldId, name: f.fieldName || f.fieldId, type: f.filedType || f.type || '' }))
        // 接口不一定返回这些常用系统字段（如经办人），缺的补上：默认条件能显示名称，也能在字段列表里选到
        const have = new Set(list.map((f) => f.id))
        return [...BUILTIN_FIELDS.filter((f) => !have.has(f.id)), ...list]
      })
      .catch(() => {
        fieldsPromise = null
        return []
      })
  }
  return fieldsPromise
}

export interface FilterOption {
  value: string
  label: string
  color?: string
}

/** 筛选值选项：问题类型 → 编码；状态 → 当前空间所有问题类型下的状态（含「所有未结束状态」）；其他下拉 → 自定义选项 */
export async function loadFilterOptions(field: FilterFieldMeta): Promise<FilterOption[]> {
  const spaceCode = currentSpaceCode.value || undefined
  if (field.id === 'issuetype' || field.id === 'status') {
    const res = await queryIssueTypes({ page: 1, pageSize: 999, status: 1, spaceCode })
    const types = res?.success ? res.data?.list || [] : []
    if (field.id === 'issuetype') {
      return types.map((t) => ({ value: t.issueTypeCode || String(t.id), label: t.issueTypeName, color: (t as { color?: string }).color }))
    }
    const lists = await Promise.all(types.filter((t) => t.issueTypeCode).map((t) =>
      queryIssueTypeStatuses(t.issueTypeCode as string).then((r) => r?.data || []).catch(() => [])))
    const seen = new Map<string, FilterOption>()
    for (const list of lists) {
      for (const s of list) {
        const value = s.statusCode || String(s.id ?? '')
        if (value && !seen.has(value)) seen.set(value, { value, label: s.statusName, color: s.color })
      }
    }
    return [{ value: ALL_NOT_DONE, label: '所有未结束状态' }, ...seen.values()]
  }
  const nodes = await loadFieldOptions({ id: field.id, type: field.type || 'SELECT_LIST_SINGLE' }, { spaceCode })
  return nodes.map((n) => ({ value: n.value, label: n.text, color: n.color }))
}

/** 人员筛选值：memberId（与网页版一致） */
export function personValueOf(u: Record<string, unknown>): string {
  return String(u.memberId || u.userNo || u.coAccount || u.userCoAccount || '').trim()
}
