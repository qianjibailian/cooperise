import { ref, shallowRef } from 'vue'
import { getViewList } from '@/api/faiz'
import type { ViewGroup, ViewItem } from '@/types/faiz'

/** 从接口响应或 mock 中提取视图分组数组（兼容 info / data 两种字段及可能的嵌套包装） */
export function normalizeViewInfo(res: unknown): ViewGroup[] {
  const payload = res as { info?: ViewGroup[]; data?: ViewGroup[] | { info?: ViewGroup[]; data?: ViewGroup[] } } | null | undefined
  if (!payload || typeof payload !== 'object') return []
  if (Array.isArray(payload.info)) return payload.info
  if (Array.isArray(payload.data)) return payload.data as ViewGroup[]
  const inner = payload.data
  if (inner && typeof inner === 'object') {
    if (Array.isArray(inner.info)) return inner.info
    if (Array.isArray(inner.data)) return inner.data
  }
  return []
}

/** 去重：归属于某个文件夹的视图，不再在"未分组"顶层里重复展示
 *  双保险：
 *  1) 所有带 groupName 分组里出现过的 filterCode → 从顶层移除
 *  2) 即使 (1) 没命中，ViewItem 自己也带了 groupCode（非空）→ 从顶层移除
 *  3) 对有 groupName 的分组，内部也按 filterCode 去重（防后端同一分组重复塞同一条）
 */
export function dedupeGroups(raw: ViewGroup[]): ViewGroup[] {
  const groupedCodes = new Set<string>()
  const uniqueGroups: ViewGroup[] = []

  for (const g of raw) {
    if (g.groupName) {
      const seen = new Set<string>()
      const uniqList: ViewItem[] = []
      for (const v of g.myViewList) {
        if (seen.has(v.filterCode)) continue
        seen.add(v.filterCode)
        groupedCodes.add(v.filterCode)
        uniqList.push(v)
      }
      uniqueGroups.push({ ...g, myViewList: uniqList })
    } else {
      uniqueGroups.push(g)
    }
  }

  // 第二遍：对所有 groupName 为空（顶层未分组）的组，按两条规则过滤
  return uniqueGroups.map((g) => {
    if (g.groupName) return g
    const seen = new Set<string>()
    const uniqList: ViewItem[] = []
    for (const v of g.myViewList) {
      if (seen.has(v.filterCode)) continue
      seen.add(v.filterCode)
      if (groupedCodes.has(v.filterCode)) continue
      if (v.groupCode != null && v.groupCode !== '') continue
      uniqList.push(v)
    }
    return { ...g, myViewList: uniqList }
  })
}

/** 全局单例状态：layout 与 ViewEntry 共享同一份视图数据 */
const viewGroups = ref<ViewGroup[]>([])
const viewListLoading = ref(false)
const loadedOnce = ref(false)
const loadingPromise = shallowRef<Promise<ViewGroup[]> | null>(null)

export function useViewStore() {
  async function ensureLoaded(force = false): Promise<ViewGroup[]> {
    if (!force && loadedOnce.value && viewGroups.value.length > 0) {
      return viewGroups.value
    }
    if (loadingPromise.value) {
      if (!force) return loadingPromise.value
      // 强制刷新（如新建 / 删除视图后）时，等进行中的请求结束再重拉，避免拿到旧数据
      await loadingPromise.value.catch(() => undefined)
      if (loadingPromise.value) return loadingPromise.value
    }

    viewListLoading.value = true
    const work = (async () => {
      try {
        const res = await getViewList()
        viewGroups.value = dedupeGroups(normalizeViewInfo(res))
      } catch {
        viewGroups.value = []
      }
      return viewGroups.value
    })().finally(() => {
      loadingPromise.value = null
      loadedOnce.value = true
      viewListLoading.value = false
    })
    loadingPromise.value = work
    return work
  }

  function findViewItem(filterCode: string): ViewItem | null {
    if (!filterCode) return null
    for (const g of viewGroups.value) {
      const found = g.myViewList.find((v) => v.filterCode === filterCode)
      if (found) return found
    }
    return null
  }

  function viewGroupKey(g: ViewGroup): string {
    return `/workbench/view/group/${g.groupCode || '__ungrouped__'}`
  }

  function viewItemKey(v: ViewItem): string {
    if (v.viewType === 'list') {
      const q = `filterCode=${encodeURIComponent(v.filterCode)}${v.groupCode ? `&groupCode=${encodeURIComponent(v.groupCode)}` : ''}`
      return `/workbench/todo?${q}`
    }
    const withCode = `/workbench/view/${v.filterCode}`
    if (v.groupCode) return `${withCode}?groupCode=${encodeURIComponent(v.groupCode)}`
    return withCode
  }

  function buildViewRoute(v: ViewItem): string {
    // list 视图走独立的 todo 页，filterCode 通过 query 携带
    if (v.viewType === 'list') {
      const base = '/workbench/todo'
      const q = `filterCode=${encodeURIComponent(v.filterCode)}${v.groupCode ? `&groupCode=${encodeURIComponent(v.groupCode)}` : ''}`
      return `${base}?${q}`
    }
    const withCode = `/workbench/view/${encodeURIComponent(v.filterCode)}`
    if (v.groupCode) return `${withCode}?groupCode=${encodeURIComponent(v.groupCode)}`
    return withCode
  }

  return {
    viewGroups,
    viewListLoading,
    ensureLoaded,
    findViewItem,
    viewGroupKey,
    viewItemKey,
    buildViewRoute,
  }
}

export type ViewTypeKey = 'list' | 'KAN_BAN' | 'gantt' | 'CALENDAR_VIEW' | 'RELEASE_LIST' | string
