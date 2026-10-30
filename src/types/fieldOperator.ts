/** 字段支持的操作符（系统字段 supportOperator 存其对象数组） */
export interface FieldOperator {
  id: string
  /** 展示名称，如「大于」 */
  name: string
  /** 操作符编码（全局筛选 operationType），如 GREATER_THAN */
  code: string
  /** 符号标识，如 > */
  identifier: string
}

/** 内置操作符目录（与后端 SystemFieldServiceImpl.OPERATOR_CATALOG 保持一致） */
export const FIELD_OPERATORS: FieldOperator[] = [
  { id: '1', name: '等于', code: 'EQUAL', identifier: '=' },
  { id: '2', name: '不等于', code: 'NOT_EQUAL', identifier: '!=' },
  { id: '3', name: '大于', code: 'GREATER_THAN', identifier: '>' },
  { id: '4', name: '小于', code: 'LESS_THAN', identifier: '<' },
  { id: '5', name: '包含', code: 'CONTAIN', identifier: '~' },
  { id: '6', name: '不包含', code: 'NOT_CONTAIN', identifier: '!~' },
  { id: '7', name: '属于', code: 'BELONG', identifier: 'IN' },
  { id: '8', name: '不属于', code: 'NOT_BELONG', identifier: 'NOT IN' },
  { id: '9', name: '为空', code: 'IS_EMPTY', identifier: 'IS EMPTY' },
  { id: '10', name: '不为空', code: 'IS_NOT_EMPTY', identifier: 'IS NOT EMPTY' },
]

/** 接口返回的操作符：对象（新）或中文名称字符串（历史 / 自定义字段） */
export type RawFieldOperator = string | Partial<FieldOperator> | null | undefined

/** 原始操作符 → 完整对象（按 code / name 从目录补全；目录外的名称保留名称） */
export function toFieldOperator(raw: RawFieldOperator): FieldOperator | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return undefined
    return FIELD_OPERATORS.find((o) => o.name === t || o.code === t.toUpperCase()) ?? { id: '', name: t, code: '', identifier: '' }
  }
  const base = FIELD_OPERATORS.find((o) => (raw.code && o.code === raw.code) || (raw.name && o.name === raw.name))
  const op: FieldOperator = {
    id: raw.id || base?.id || '',
    name: raw.name || base?.name || raw.code || '',
    code: raw.code || base?.code || '',
    identifier: raw.identifier || base?.identifier || '',
  }
  return op.name || op.code ? op : undefined
}

/** 操作符展示名 */
export function fieldOperatorName(raw: RawFieldOperator): string {
  return toFieldOperator(raw)?.name ?? ''
}
