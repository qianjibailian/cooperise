/**
 * 视图（日历 / 看板等）共用的事项字段解析、分组与草稿解析工具。
 * 字段 ID 一律为 /availableField/query 的 fieldId；/issue/query 只返回 showField 里的字段。
 */
import dayjs from 'dayjs'
import {
  queryUsers,
  queryIssueTypes,
  queryIssueTypeStatuses,
  getAvailableFieldOptions,
} from '@/api/faiz'
import type { AvailableFieldItem, IssueFieldItem, IssueRecord } from '@/types/faiz'
import { formatPersonLabel, personLabel, personAvatar } from '@/utils/person'

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
export const DEFAULT_COLOR = '#8c8c8c'
export const DATE_TYPES = new Set(['DATE_PICKER', 'TIME_PICKER', 'DATE_TIME_PICKER'])
export const USER_TYPES = new Set(['SELECT_USER_SINGLE', 'SELECT_USER_MULTI'])
/** 分组字段为空的事项归到这一组 */
export const NONE_GROUP_KEY = '__none__'

/** 单个分组取值 */
export interface GroupValue {
  key: string
  label: string
  /** 人员字段：头像 */
  avatar: string
  isUser: boolean
  color: string
}

/** 事项卡片 / 日历条上的一行：按「展示字段」勾选顺序，每个字段一行 */
export interface FieldLine {
  id: string
  /** 字段名（展示在值前面） */
  label: string
  text: string
  isKey: boolean
  /** 以彩色标签展示的字段（单号 / 状态 / 问题类型）的颜色，其余为空 */
  tagColor: string
  /** 人员字段：展示头像（无头像时为空串，显示首字） */
  isUser: boolean
  avatar: string
}

// ---------- 字段取值 ----------
export function fieldOf(rec: IssueRecord, id: string): IssueFieldItem | undefined {
  return rec.issueField?.find((f) => f.id === id)
}

export function objOf(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** 对象型字段值的显示名（状态 / 选项 / 人员 / 级联等） */
export function objText(o: Record<string, unknown>): string {
  const v = o.name ?? o.pname ?? o.optionName ?? o.label ?? o.coAccount ?? o.userEnName ?? o.value ?? o.id
  return v == null ? '' : String(v)
}

/** 任意字段的展示文本：日期格式化，其余优先 exportValue，再从 value 解析 */
export function fieldText(f?: IssueFieldItem): string {
  if (!f) return ''
  const type = String(f.type ?? '').toUpperCase()
  const ev = f.exportValue
  if (DATE_TYPES.has(type)) {
    const raw = ev ?? f.value
    if (raw == null || raw === '') return ''
    const d = dayjs(String(raw))
    return d.isValid() ? d.format(type === 'DATE_PICKER' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm') : String(raw)
  }
  // 人员字段：realName（coAccount）
  if (USER_TYPES.has(type)) {
    const users = (Array.isArray(f.value) ? f.value : [f.value]).filter((u) => objOf(u))
    const text = users.map((u) => personLabel(u as Record<string, unknown>)).filter(Boolean).join('、')
    if (text) return text
  }
  if (ev != null && ev !== '' && typeof ev !== 'object') return String(ev)
  const v = f.value
  if (v == null) return ''
  if (Array.isArray(v)) {
    return v.map((it) => (objOf(it) ? objText(it as Record<string, unknown>) : String(it ?? ''))).filter(Boolean).join('、')
  }
  const o = objOf(v)
  return o ? objText(o) : String(v)
}

export function colorOf(v: unknown): string {
  return typeof v === 'string' && HEX_COLOR.test(v) ? v : DEFAULT_COLOR
}

export function hexOr(color: unknown, fallback = '#0a84ff'): string {
  return typeof color === 'string' && HEX_COLOR.test(color) ? color : fallback
}

/** 事项单号：优先 issuekey 字段，兜底记录顶层字段 */
export function issueKeyOf(rec: IssueRecord): string {
  return fieldText(fieldOf(rec, 'issuekey')) || String(rec.issuekey ?? rec.issueKey ?? '')
}

// ---------- 展示字段 ----------
/** 以标签展示的字段：单号为中性灰；状态 / 问题类型取后端配置色，缺省用各自的默认色 */
export const TAG_DEFAULT_COLORS: Record<string, string> = {
  issuekey: '#8E8E93',
  status: '#3E9C8F',
  issuetype: '#8B6FC0',
}

export function tagColorOf(rec: IssueRecord, id: string): string {
  if (!(id in TAG_DEFAULT_COLORS)) return ''
  if (id === 'issuekey') return TAG_DEFAULT_COLORS.issuekey
  const o = objOf(fieldOf(rec, id)?.value)
  const color = id === 'status' ? o?.statusColor : o?.issueTypeColor ?? o?.color
  return hexOr(color, TAG_DEFAULT_COLORS[id])
}

/**
 * 按勾选顺序生成每个字段一行（空值不占行）。
 * 字段名优先取 /issue/query 返回的 name，缺省时取 names（/availableField/query 的 fieldId → fieldName）
 */
export function buildFieldLines(
  rec: IssueRecord,
  shownIds: string[],
  names: Record<string, string> = {},
): FieldLine[] {
  return shownIds
    .map((id) => {
      const f = fieldOf(rec, id)
      const first = Array.isArray(f?.value) ? f?.value[0] : f?.value
      const isUser = USER_TYPES.has(String(f?.type ?? '').toUpperCase()) && !!objOf(first)
      return {
        id,
        label: String(f?.name || names[id] || id),
        text: id === 'issuekey' ? issueKeyOf(rec) : fieldText(f),
        isKey: id === 'issuekey',
        tagColor: tagColorOf(rec, id),
        isUser,
        avatar: isUser ? personAvatar(first as Record<string, unknown>) : '',
      }
    })
    .filter((l) => l.text)
}

// ---------- 人员 / 配色 ----------
/** 人员展示名：realName（coAccount），缺一项时只展示另一项（统一规则见 @/utils/person） */
export const userLabel = formatPersonLabel

/** 分组配色（低饱和度）：人员 / 选项等无自带颜色的取值，按分组键稳定取色 */
export const GROUP_PALETTE = ['#6B95C9', '#D4A05F', '#7AAE83', '#9F8BC4', '#CF8592', '#71AEBF', '#8A88C2', '#C2A774', '#6FA3A6', '#A3978A']
export function paletteColor(key: string): string {
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return GROUP_PALETTE[h % GROUP_PALETTE.length]
}

// ---------- 分组 ----------
function fieldTypeOf(meta?: AvailableFieldItem): string {
  return String(meta?.filedType || meta?.type || '').toUpperCase()
}

/** 人员类字段：字段类型为人员选择，或字段分组为 PERSON（创建人 / 更新人） */
export function isUserField(meta?: AvailableFieldItem): boolean {
  return USER_TYPES.has(fieldTypeOf(meta)) || meta?.fieldGroup === 'PERSON'
}

/** 事项在分组字段上的取值：对象取 id 作分组键，多值字段按展示文本归组，空值归「未设置 / 未分配」 */
export function groupValueOf(rec: IssueRecord, fieldId: string, meta?: AvailableFieldItem): GroupValue {
  const f = fieldOf(rec, fieldId)
  const isUser = USER_TYPES.has(String(f?.type ?? '').toUpperCase()) || isUserField(meta)
  const label = fieldText(f)
  const o = objOf(f?.value)
  if (!label) {
    return { key: NONE_GROUP_KEY, label: isUser ? '未分配' : '未设置', avatar: '', isUser: false, color: '#d2d2d7' }
  }
  // 键与 fetchGroupUniverse 的取值对齐：人员 memberId / 问题类型编码 / 状态编码 / 选项 ID
  const key = o
    ? String(o.memberId ?? o.issueTypeCode ?? o.statusCode ?? o.optionId ?? o.id ?? label)
    : label
  const color = o ? o.statusColor ?? o.color ?? o.issueTypeColor : undefined
  return {
    key,
    label: isUser && o ? userLabel(o.realName, o.coAccount) || label : label,
    avatar: o && typeof o.avatarUrl === 'string' ? o.avatarUrl : '',
    isUser,
    color: isUser ? paletteColor(key) : hexOr(color, paletteColor(key)),
  }
}

/**
 * 分组字段的全部取值（没有事项的取值也列出）：
 * 人员 → 全部在职用户；问题类型 → 全部启用类型；状态 → 各问题类型的状态去重（传 issueTypeCodes 时只取这些类型）；
 * 下拉字段 → 字段选项；其余返回空
 */
export async function fetchGroupUniverse(
  fieldId: string,
  meta?: AvailableFieldItem,
  opts?: { issueTypeCodes?: string[] },
): Promise<GroupValue[]> {
  if (isUserField(meta)) {
    const res = await queryUsers({ keyword: '', isActive: 1, page: 1, pageSize: 500 })
    return (res?.data?.list || []).map((u) => {
      const key = String(u.memberId || u.id || u.userNo)
      return {
        key,
        label: userLabel(u.realName, u.coAccount || u.userCoAccount) || String(u.userEnName || u.name || u.memberId || u.userNo || ''),
        avatar: String(u.avatarUrl || u.userAvatar || ''),
        isUser: true,
        color: paletteColor(key),
      }
    })
  }
  if (fieldId === 'issuetype' || fieldId === 'status') {
    const typeRes = await queryIssueTypes({ page: 1, pageSize: 999, status: 1 })
    const types = typeRes?.success ? typeRes.data?.list || [] : []
    if (fieldId === 'issuetype') {
      return types.map((t) => {
        const key = String(t.issueTypeCode || t.id)
        return { key, label: t.issueTypeName, avatar: '', isUser: false, color: hexOr(t.color, paletteColor(key)) }
      })
    }
    const only = opts?.issueTypeCodes?.length ? new Set(opts.issueTypeCodes) : null
    const lists = await Promise.all(
      types
        .filter((t) => t.issueTypeCode && (!only || only.has(t.issueTypeCode)))
        .map((t) => queryIssueTypeStatuses(t.issueTypeCode as string).then((r) => r?.data || []).catch(() => [])),
    )
    const seen = new Map<string, GroupValue>()
    for (const st of lists.flat()) {
      const key = String(st.statusCode || st.id || '')
      if (key && !seen.has(key)) {
        seen.set(key, { key, label: st.statusName, avatar: '', isUser: false, color: hexOr(st.color, paletteColor(key)) })
      }
    }
    return [...seen.values()]
  }
  // 下拉类自定义字段：取字段选项
  const type = fieldTypeOf(meta)
  if (!type.startsWith('SELECT_LIST') && type !== 'CASCADER_SINGLE') return []
  const res = await getAvailableFieldOptions([{ fieldId, type, projectId: '', issueTypeCode: '' }])
  const bucket = (res?.data || [])[0] as { options?: unknown } | undefined
  const nested = (bucket?.options as { options?: unknown[] } | undefined)?.options
  const raw = (Array.isArray(bucket?.options) ? bucket.options : Array.isArray(nested) ? nested : []) as Record<string, unknown>[]
  return raw
    .filter((x) => x != null)
    .map((x) => {
      const key = String(x.optionId ?? x.value ?? x.id ?? x.label ?? x.name ?? '')
      return {
        key,
        label: String(x.label ?? x.optionName ?? x.name ?? x.value ?? ''),
        avatar: '',
        isUser: false,
        color: hexOr(x.color, paletteColor(key)),
      }
    })
    .filter((g) => g.key && g.label)
}

// ---------- 草稿解析 ----------
export function safeParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try { return JSON.parse(str) as T } catch { return fallback }
}

/** 草稿 showField → 字段 ID 列表（兼容字符串与 { field: { id } } 两种格式）；未保存过时为空 */
export function parseShownFieldIds(raw?: string | null): string[] {
  const parsed = safeParse<{ showFieldItemList?: unknown[] } | null>(raw, null)
  if (!Array.isArray(parsed?.showFieldItemList)) return []
  return parsed.showFieldItemList
    .map((it) => (typeof it === 'string' ? it : (it as { field?: { id?: string } })?.field?.id ?? ''))
    .filter(Boolean)
}

/** 草稿 group → 分组字段 ID（取第一项，兼容字符串与 { field: { id } } 两种格式）；未保存过时为 null */
export function parseGroupFieldId(raw?: string | null): string | null {
  const parsed = safeParse<{ groupItemList?: unknown[] } | null>(raw, null)
  if (!Array.isArray(parsed?.groupItemList)) return null
  const first = parsed.groupItemList[0]
  if (typeof first === 'string') return first
  return (first as { field?: { id?: string } } | undefined)?.field?.id ?? ''
}

/**
 * 详情接口里问题类型字段（issuetype）的值 → 问题类型编码（如 TYPE10001）。
 * 值可能是对象（issueTypeCode / code / id）或直接是编码 / 数字 ID；纯数字 ID 按 TYPE{id} 换算。
 */
export function issueTypeCodeOf(v: unknown): string {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  const raw = typeof v === 'string' || typeof v === 'number' ? v : (o.issueTypeCode ?? o.code ?? o.id ?? '')
  const s = String(raw ?? '').trim()
  return /^\d+$/.test(s) ? `TYPE${s}` : s.toUpperCase()
}

/** 定制：这些问题类型的事项详情（抽屉 / 页面）在「补充信息」上方展示「研发活动」 */
export const RD_ACTIVITY_TYPE_CODES = new Set(['TYPE10001'])
