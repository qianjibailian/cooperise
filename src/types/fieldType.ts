/**
 * 字段类型（filedType）枚举与相关映射
 * 单独维护，供字段管理（可选字段 / 系统字段）等模块统一引用
 */

/** 字段类型枚举 */
export const FIELD_TYPE = {
  SELECT_LIST_SINGLE: 'SELECT_LIST_SINGLE',
  SELECT_LIST_MULTI: 'SELECT_LIST_MULTI',
  TEXT_BOX_SINGLE_LINE: 'TEXT_BOX_SINGLE_LINE',
  TEXT_BOX_MULTI_LINE: 'TEXT_BOX_MULTI_LINE',
  TEXT_BOX_NUMBER: 'TEXT_BOX_NUMBER',
  SELECT_USER_SINGLE: 'SELECT_USER_SINGLE',
  SELECT_USER_MULTI: 'SELECT_USER_MULTI',
  DATE_PICKER: 'DATE_PICKER',
  TIME_PICKER: 'TIME_PICKER',
  RICH_TEXT: 'RICH_TEXT',
  LABEL: 'LABEL',
  CASCADER_SINGLE: 'CASCADER_SINGLE',
} as const

export type FieldType = (typeof FIELD_TYPE)[keyof typeof FIELD_TYPE]

/** 字段类型下拉选项 */
export const fieldTypeOptions: ReadonlyArray<{ value: FieldType; label: string }> = [
  { value: FIELD_TYPE.SELECT_LIST_SINGLE, label: '单选下拉框' },
  { value: FIELD_TYPE.SELECT_LIST_MULTI, label: '多选下拉框' },
  { value: FIELD_TYPE.TEXT_BOX_SINGLE_LINE, label: '单行文本输入框' },
  { value: FIELD_TYPE.TEXT_BOX_MULTI_LINE, label: '多行文本输入框（文本域）' },
  { value: FIELD_TYPE.TEXT_BOX_NUMBER, label: '数字输入框' },
  { value: FIELD_TYPE.SELECT_USER_SINGLE, label: '单选用户' },
  { value: FIELD_TYPE.SELECT_USER_MULTI, label: '多选用户' },
  { value: FIELD_TYPE.DATE_PICKER, label: '日期选择' },
  { value: FIELD_TYPE.TIME_PICKER, label: '时间选择' },
  { value: FIELD_TYPE.RICH_TEXT, label: '富文本展示' },
  { value: FIELD_TYPE.LABEL, label: '只读文本' },
  { value: FIELD_TYPE.CASCADER_SINGLE, label: '级联单选' },
]

/** 类型值 → 中文标签 */
export const TYPE_LABEL_MAP: Record<string, string> = fieldTypeOptions.reduce(
  (acc, t) => { acc[t.value] = t.label; return acc },
  {} as Record<string, string>,
)

/** 格式化类型中文名（未知类型回显原值） */
export function formatTypeLabel(type?: string | null): string {
  if (!type) return '-'
  return TYPE_LABEL_MAP[type] || type
}

/** 需要配置选项（fieldValue）的类型：单选下拉 / 多选下拉 / 级联单选 */
export const ENUM_TYPES: readonly FieldType[] = [
  FIELD_TYPE.SELECT_LIST_SINGLE,
  FIELD_TYPE.SELECT_LIST_MULTI,
  FIELD_TYPE.CASCADER_SINGLE,
]

/** 判断是否枚举类型（需要配置选项） */
export function isEnumFieldType(type?: string | null): boolean {
  return !!type && (ENUM_TYPES as readonly string[]).includes(type)
}

/** 类型值 → 标签颜色 */
const FIELD_TYPE_TAG_COLOR: Record<string, string> = {
  [FIELD_TYPE.SELECT_LIST_SINGLE]: 'purple',
  [FIELD_TYPE.SELECT_LIST_MULTI]: 'magenta',
  [FIELD_TYPE.TEXT_BOX_SINGLE_LINE]: 'default',
  [FIELD_TYPE.TEXT_BOX_MULTI_LINE]: 'cyan',
  [FIELD_TYPE.TEXT_BOX_NUMBER]: 'green',
  [FIELD_TYPE.SELECT_USER_SINGLE]: 'lime',
  [FIELD_TYPE.SELECT_USER_MULTI]: 'lime',
  [FIELD_TYPE.DATE_PICKER]: 'blue',
  [FIELD_TYPE.TIME_PICKER]: 'cyan',
  [FIELD_TYPE.RICH_TEXT]: 'red',
  [FIELD_TYPE.LABEL]: 'geekblue',
  [FIELD_TYPE.CASCADER_SINGLE]: 'gold',
}

export function typeTagColor(type?: string | null): string {
  return FIELD_TYPE_TAG_COLOR[type || ''] || 'default'
}

/** 字段类型 → 默认字段分组（选择类型时自动带出分组） */
export const TYPE_GROUP_MAP: Record<string, string> = {
  [FIELD_TYPE.SELECT_USER_SINGLE]: 'PERSON',
  [FIELD_TYPE.SELECT_USER_MULTI]: 'PERSON',
  [FIELD_TYPE.DATE_PICKER]: 'TIME',
  [FIELD_TYPE.TIME_PICKER]: 'TIME',
  [FIELD_TYPE.RICH_TEXT]: 'DESCRIPTION',
}

/** 根据字段类型返回默认字段分组，无映射时返回 null */
export function defaultFieldGroupByType(type?: string | null): string | null {
  if (!type) return null
  return TYPE_GROUP_MAP[type] ?? null
}

/** 旧版类型值 → 新版 FIELD_TYPE 映射（兼容历史模板/事项数据） */
const LEGACY_TYPE_MAP: Record<string, string> = {
  INPUT_TEXT: FIELD_TYPE.TEXT_BOX_SINGLE_LINE,
  TEXTAREA: FIELD_TYPE.TEXT_BOX_MULTI_LINE,
  TEXT_AREA: FIELD_TYPE.TEXT_BOX_MULTI_LINE,
  INPUT_NUMBER: FIELD_TYPE.TEXT_BOX_NUMBER,
  DATE: FIELD_TYPE.DATE_PICKER,
  DATE_TIME: FIELD_TYPE.TIME_PICKER,
  DATETIME: FIELD_TYPE.TIME_PICKER,
  SELECT: FIELD_TYPE.SELECT_LIST_SINGLE,
  SELECT_SINGLE: FIELD_TYPE.SELECT_LIST_SINGLE,
  SELECT_LIST: FIELD_TYPE.SELECT_LIST_SINGLE,
  SELECT_MULTIPLE: FIELD_TYPE.SELECT_LIST_MULTI,
  MULTI_SELECT: FIELD_TYPE.SELECT_LIST_MULTI,
  CASCADER: FIELD_TYPE.CASCADER_SINGLE,
  USER_SINGLE_SELECT: FIELD_TYPE.SELECT_USER_SINGLE,
  USER_SELECT: FIELD_TYPE.SELECT_USER_SINGLE,
  USER_MULTI_SELECT: FIELD_TYPE.SELECT_USER_MULTI,
  MULTI_USER_SELECT: FIELD_TYPE.SELECT_USER_MULTI,
  DISPLAY_TEXT: FIELD_TYPE.LABEL,
  RICH_TEXT: FIELD_TYPE.RICH_TEXT,
  LABEL: FIELD_TYPE.LABEL,
}

/** 将任意类型值归一化为新版 FIELD_TYPE（旧版值映射，未知值原样返回） */
export function normalizeFieldType(type?: string | null): string {
  if (!type) return ''
  const upper = String(type).toUpperCase()
  if ((Object.values(FIELD_TYPE) as string[]).includes(upper)) return upper
  return LEGACY_TYPE_MAP[upper] || String(type)
}
