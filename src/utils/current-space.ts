/**
 * 当前空间（顶部菜单空间切换）：工作台所有数据只看这个空间。
 * 单独成模块、不依赖 @/api/faiz，便于在 api 层注入空间条件而不产生循环依赖。
 */
import { ref } from 'vue'
import type { GlobalFilter, ChildConditionGroup, FilterConditionItem } from '@/types/faiz'

const CURRENT_SPACE_KEY = 'cooperise.currentSpaceCode'

/** 与当前空间无交集时的占位值：保证查不到数据，而不是退化成看全部 */
const NO_MATCH_SPACE = '__NO_SPACE__'

function readStored(): string {
  try {
    return localStorage.getItem(CURRENT_SPACE_KEY) || ''
  } catch {
    return ''
  }
}

/** 当前空间编码；空串表示「全部空间」 */
export const currentSpaceCode = ref<string>(readStored())

export function setCurrentSpace(code?: string | null) {
  const next = code || ''
  if (currentSpaceCode.value === next) return
  currentSpaceCode.value = next
  try {
    if (next) localStorage.setItem(CURRENT_SPACE_KEY, next)
    else localStorage.removeItem(CURRENT_SPACE_KEY)
  } catch {
    // 隐私模式等场景下 localStorage 不可用，仅保留内存态
  }
}

const fieldIdOf = (c: FilterConditionItem | null | undefined) => String(c?.field?.id ?? '').trim()
const valuesOf = (c: FilterConditionItem | null | undefined) =>
  (c?.conditionValueList || []).map(v => String(v?.value ?? '')).filter(Boolean)

/**
 * 给事项查询的 globalFilter 追加「空间 = 当前空间」条件（返回新对象，不改原入参，避免污染草稿）。
 * - 未选空间：原样返回
 * - 原筛选没有任何有效条件：原样返回（后端约定无条件时返回空列表，不能因为补了空间条件变成查全量）
 * - 原筛选里已有空间条件：取交集；与当前空间无交集时用占位值，结果为空
 */
export function scopeGlobalFilter<T extends GlobalFilter | null | undefined>(gf: T): T {
  const code = currentSpaceCode.value
  const f = gf?.filter
  if (!code || !gf || !f) return gf
  const top = (f.condition ?? null) as FilterConditionItem | null
  const groups = f.childConditionGroupList || []
  const hasEffective = !!fieldIdOf(top) || groups.some(g => !!fieldIdOf(g?.condition))
  if (!hasEffective) return gf

  const isSpace = (c: FilterConditionItem | null | undefined) => fieldIdOf(c) === 'space'
  const userSpaceValues = [
    ...(isSpace(top) ? valuesOf(top) : []),
    ...groups.filter(g => isSpace(g?.condition)).flatMap(g => valuesOf(g.condition)),
  ]
  const value = !userSpaceValues.length || userSpaceValues.includes(code) ? code : NO_MATCH_SPACE

  const spaceGroup: ChildConditionGroup = {
    isGroupModule: false,
    condition: {
      conditionValueList: [{ value, userSpecialIdentifier: '', timeOperationDirectionTypeCode: null, timeFormatTypeCode: null, comparedField: null }],
      field: { id: 'space', datasourceId: 0 },
      operationType: 'BELONG',
      conditionGroup: null,
      dateScopeType: null,
      comparedTypeCode: null,
      disable: null,
      includeObsolete: null,
    },
  }

  return {
    ...gf,
    filter: {
      ...f,
      condition: isSpace(top) ? null : f.condition,
      childConditionGroupList: [...groups.filter(g => !isSpace(g?.condition)), spaceGroup],
    },
  }
}
