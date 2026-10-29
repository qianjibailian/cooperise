import type { ChildConditionGroup, GlobalFilter } from '@/types/faiz'
import { FIELD_TYPE } from '@/types/fieldType'

/** 筛选逻辑：全部满足 / 任一满足 */
export type FilterLogic = 'AND' | 'OR'

/** 面板内的单个筛选条件（值为后端可识别的值，labels 仅用于回显） */
export interface FilterCondition {
  field: string
  operator: string
  values: string[]
  /** 值 → 显示名（人员等异步选项回显用，随条件一起保存在本地） */
  labels?: Record<string, string>
}

/** 值编辑器类型 */
export type ValueKind = 'select' | 'user' | 'date' | 'number' | 'text'

/** 当前用户占位值：后端按 userSpecialIdentifier=CURRENT_USER 解析为登录人 */
export const CURRENT_USER = 'CURRENT_USER'
/** 所有未结束状态占位值 */
export const ALL_NOT_DONE = 'ALL_NOT_DONE'

/** 操作符：code 为 operationType 枚举 */
export const OPERATORS: Record<string, { label: string; noValue?: boolean; multi?: boolean }> = {
  BELONG: { label: '属于', multi: true },
  NOT_BELONG: { label: '不属于', multi: true },
  EQUAL: { label: '等于' },
  NOT_EQUAL: { label: '不等于' },
  CONTAIN: { label: '包含' },
  NOT_CONTAIN: { label: '不包含' },
  GREATER_THAN: { label: '晚于 / 大于' },
  LESS_THAN: { label: '早于 / 小于' },
  IS_EMPTY: { label: '为空', noValue: true },
  IS_NOT_EMPTY: { label: '不为空', noValue: true },
}

/** 各值类型可用的操作符 */
export const OPERATORS_BY_KIND: Record<ValueKind, string[]> = {
  select: ['BELONG', 'NOT_BELONG', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  user: ['BELONG', 'NOT_BELONG', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  date: ['EQUAL', 'GREATER_THAN', 'LESS_THAN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  number: ['EQUAL', 'NOT_EQUAL', 'GREATER_THAN', 'LESS_THAN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  text: ['CONTAIN', 'NOT_CONTAIN', 'EQUAL', 'NOT_EQUAL', 'IS_EMPTY', 'IS_NOT_EMPTY'],
}

/** 人员类系统字段（字段类型未标注为人员时按 id 识别） */
const USER_FIELD_IDS = new Set(['assignee', 'creator', 'reporter'])
/** 选项类系统字段 */
const SELECT_FIELD_IDS = new Set(['status', 'issuetype', 'priority', 'project', 'organization'])
/** 日期类系统字段 */
const DATE_FIELD_IDS = new Set(['created', 'updated', 'duedate', 'resolutiondate'])

/** 按字段 id + 字段类型推断值编辑器 */
export function valueKindOf(fieldId: string, fieldType?: string | null): ValueKind {
  const t = String(fieldType ?? '').toUpperCase()
  if (USER_FIELD_IDS.has(fieldId) || t === FIELD_TYPE.SELECT_USER_SINGLE || t === FIELD_TYPE.SELECT_USER_MULTI) return 'user'
  if (DATE_FIELD_IDS.has(fieldId) || t === FIELD_TYPE.DATE_PICKER || t === FIELD_TYPE.TIME_PICKER) return 'date'
  if (t === FIELD_TYPE.TEXT_BOX_NUMBER) return 'number'
  if (
    SELECT_FIELD_IDS.has(fieldId) ||
    t === FIELD_TYPE.SELECT_LIST_SINGLE ||
    t === FIELD_TYPE.SELECT_LIST_MULTI ||
    t === FIELD_TYPE.CASCADER_SINGLE ||
    t.startsWith('SELECT_LIST')
  ) return 'select'
  return 'text'
}

/** 条件是否完整：有字段、有操作符，且需要值的操作符已填值 */
export function isConditionComplete(c: FilterCondition): boolean {
  if (!c.field || !c.operator) return false
  return !!OPERATORS[c.operator]?.noValue || c.values.some((v) => v !== '')
}

/** 面板条件 → /issue/query 的 globalFilter（只提交完整条件） */
export function buildGlobalFilter(conditions: FilterCondition[], logic: FilterLogic): GlobalFilter {
  const childConditionGroupList: ChildConditionGroup[] = conditions.filter(isConditionComplete).map((c) => ({
    isGroupModule: false,
    condition: {
      conditionValueList: (OPERATORS[c.operator]?.noValue ? [] : c.values).map((v) => ({
        value: v,
        userSpecialIdentifier: v === CURRENT_USER ? CURRENT_USER : '',
        timeOperationDirectionTypeCode: null,
        timeFormatTypeCode: null,
        comparedField: null,
      })),
      field: { id: c.field, datasourceId: 0 },
      operationType: c.operator,
      conditionGroup: null,
      dateScopeType: null,
      comparedTypeCode: null,
      disable: null,
      includeObsolete: null,
    },
  }))
  return {
    filter: {
      logicType: logic,
      isGroupModule: false,
      condition: null,
      disable: null,
      includeObsolete: null,
      isPass: null,
      associatedConditions: [],
      matchAllLinks: false,
      isDevActivity: null,
      isSprintBlock: null,
      isVersionBlock: null,
      isCustomColumnBlock: null,
      childConditionGroupList,
    },
    isOnlyShowAssociation: false,
  }
}

/** 旧版中文操作符 / 值 → 枚举（兼容历史草稿） */
const LEGACY_OPERATOR: Record<string, string> = {
  属于: 'BELONG', 等于: 'EQUAL', 不等于: 'NOT_EQUAL', 包含: 'CONTAIN', 不包含: 'NOT_CONTAIN', 大于: 'GREATER_THAN', 小于: 'LESS_THAN',
}

/** globalFilter → 面板条件与逻辑（草稿回显） */
export function parseGlobalFilter(gf?: GlobalFilter | null): { conditions: FilterCondition[]; logic: FilterLogic } {
  const filter = gf?.filter
  const logic: FilterLogic = String(filter?.logicType ?? 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND'
  const groups = (filter?.childConditionGroupList ?? []) as ChildConditionGroup[]
  const conditions: FilterCondition[] = []
  for (const g of groups) {
    const c = g?.condition
    const field = c?.field?.id
    if (!field) continue
    const operator = LEGACY_OPERATOR[c.operationType] ?? c.operationType ?? 'BELONG'
    const values = (c.conditionValueList ?? [])
      .map((v) => (v.userSpecialIdentifier === CURRENT_USER ? CURRENT_USER : String(v.value ?? '')))
      .filter((v) => v !== '')
    conditions.push({ field, operator, values })
  }
  return { conditions, logic }
}

/** 默认筛选：经办人属于当前用户 + 未结束状态 */
export function defaultConditions(): FilterCondition[] {
  return [
    { field: 'assignee', operator: 'BELONG', values: [CURRENT_USER], labels: { [CURRENT_USER]: '当前用户' } },
    { field: 'status', operator: 'BELONG', values: [ALL_NOT_DONE], labels: { [ALL_NOT_DONE]: '所有未结束状态' } },
  ]
}
