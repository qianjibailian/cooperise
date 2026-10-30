/**
 * 「我的事项」数量：侧边栏菜单括号里的数字，与「我的事项」列表的总数保持一致。
 * - 我的事项页每次查询后用接口返回的 total 更新（最准确）
 * - 侧边栏挂载 / 新建事项后，按「我的事项」视图草稿的筛选条件（无草稿时为默认条件）查一次总数
 */
import { ref } from 'vue'
import { getIssues, getFilterDraft } from '@/api/faiz'
import type { GlobalFilter } from '@/types/faiz'
import { buildGlobalFilter, defaultConditions } from '@/utils/issueFilter'
import { safeParse } from '@/utils/issue-view'

/** 「我的事项」视图编码（与我的事项页一致） */
export const MY_TODO_VIEW_CODE = 'MY_TODO21941'

/** null：尚未获取 */
const todoCount = ref<number | null>(null)

export function setTodoCount(n: number) {
  todoCount.value = Math.max(0, Number(n) || 0)
}

let seq = 0
/** 按「我的事项」草稿的筛选条件查询总数（只取 1 条，用返回的 total） */
export async function refreshTodoCount(userNo: string) {
  const cur = ++seq
  try {
    const draftRes = await getFilterDraft(userNo, MY_TODO_VIEW_CODE)
    const draft = draftRes?.success ? draftRes.data : null
    const saved = safeParse<GlobalFilter | null>(draft?.globalFilter, null)
    // 与我的事项页一致：草稿里有 filter 就用草稿的条件，否则用默认条件（经办人=当前用户 + 未结束状态）
    const globalFilter = saved?.filter ? saved : buildGlobalFilter(defaultConditions(), 'AND')
    const res = await getIssues({
      globalFilter,
      group: { groupItemList: [], isFollowPreviousGroup: true },
      layered: { layeredItemList: [], layerType: 'FLAT' },
      page: 1,
      pageSize: 1,
      showField: { showFieldItemList: ['issuekey'] },
      sort: { sortItemList: [] },
      viewCode: draft?.viewCode ?? MY_TODO_VIEW_CODE,
      needShowGroupValues: [],
      referencedFilter: { filter: null },
    })
    if (cur === seq && res?.success) setTodoCount(res.data?.total ?? 0)
  } catch {
    // 请求层已统一提示；保留上次数量
  }
}

export function useTodoCount() {
  return { todoCount }
}
