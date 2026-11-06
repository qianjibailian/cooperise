<template>
  <div class="h5-page">
    <van-sticky>
      <header class="h5-large-title is-head">
        <h1>事项</h1>
        <SpaceSwitcher />
      </header>
      <van-search v-model="keyword" placeholder="搜索概要" shape="round" background="transparent" @search="reload" @clear="reload" />
      <!-- 全局筛选 / 排序：默认条件与网页版「我的事项」一致（经办人 = 当前用户、状态 = 所有未结束状态） -->
      <div class="is-tools">
        <span class="is-tool" :class="{ active: filters.length }" @click="filterOpen = true">
          <van-icon name="filter-o" />筛选<template v-if="filters.length"> {{ filters.length }}</template>
        </span>
        <span class="is-tool" :class="{ active: sortRows.length }" @click="sortOpen = true">
          <van-icon name="sort" />排序<template v-if="sortRows.length"> {{ sortRows.length }}</template>
        </span>
        <span v-if="!isDefault" class="is-tool-reset" @click="resetTools">重置</span>
      </div>
    </van-sticky>

    <van-pull-refresh v-model="refreshing" @refresh="reload">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        v-model:error="error"
        error-text="加载失败，点击重试"
        finished-text="没有更多了"
        :immediate-check="false"
        @load="loadMore"
      >
        <IssueCard v-for="it in list" :key="it.key" :issue="it" />
        <van-empty v-if="finished && !list.length" image="search" :description="keyword ? '没有匹配的事项' : '暂无事项'" />
      </van-list>
    </van-pull-refresh>

    <FilterSheet v-model:show="filterOpen" :conditions="filters" @apply="applyFilters" />
    <SortSheet v-model:show="sortOpen" :rows="sortRows" @apply="applySort" />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { getIssues } from '@/api/faiz'
import { buildGlobalFilter, defaultConditions, type FilterCondition } from '@/utils/issueFilter'
import { currentSpaceCode } from '@/utils/current-space'
import { onIssueCreated } from '@/utils/issue-events'
import IssueCard from '../components/IssueCard.vue'
import FilterSheet from '../components/FilterSheet.vue'
import SortSheet, { type SortRow } from '../components/SortSheet.vue'
import SpaceSwitcher from '../components/SpaceSwitcher.vue'
import { LIST_FIELDS, briefOf, type IssueBrief } from '../utils'

defineOptions({ name: 'H5Issues' })

const PAGE_SIZE = 20

const keyword = ref('')
const list = ref<IssueBrief[]>([])
const page = ref(0)
const loading = ref(false)
const finished = ref(false)
const error = ref(false)
const refreshing = ref(false)
/** 丢弃过期请求的结果（改筛选 / 搜索时旧请求还没回来） */
let seq = 0

// ---------------- 全局筛选 / 排序（记在本机，下次打开沿用） ----------------
// 改了存储 key：旧版（带页签时）存的条件是叠加在页签上的，不沿用
const TOOLS_KEY = 'cooperise.h5.issues.tools.v2'
function readTools(): { filters: FilterCondition[]; sort: SortRow[] } {
  try {
    const raw = localStorage.getItem(TOOLS_KEY)
    if (!raw) return { filters: defaultConditions(), sort: [] }
    const v = JSON.parse(raw)
    return { filters: Array.isArray(v.filters) ? v.filters : defaultConditions(), sort: Array.isArray(v.sort) ? v.sort : [] }
  } catch {
    return { filters: defaultConditions(), sort: [] }
  }
}
const saved = readTools()
const filters = ref<FilterCondition[]>(saved.filters)
const sortRows = ref<SortRow[]>(saved.sort)
const filterOpen = ref(false)
const sortOpen = ref(false)

function saveTools() {
  try {
    localStorage.setItem(TOOLS_KEY, JSON.stringify({ filters: filters.value, sort: sortRows.value }))
  } catch {
    // 存储不可用：只在本次打开生效
  }
}
function applyFilters(v: FilterCondition[]) {
  filters.value = v
  saveTools()
  reload()
}
function applySort(v: SortRow[]) {
  sortRows.value = v
  saveTools()
  reload()
}
/** 是否为默认条件（经办人 = 当前用户、所有未结束状态，按更新时间倒序） */
const DEFAULT_SIG = JSON.stringify(defaultConditions().map((c) => [c.field, c.operator, c.values]))
const isDefault = computed(() => !sortRows.value.length
  && JSON.stringify(filters.value.map((c) => [c.field, c.operator, c.values])) === DEFAULT_SIG)

/** 重置：恢复默认条件 */
function resetTools() {
  filters.value = defaultConditions()
  sortRows.value = []
  saveTools()
  reload()
}

function buildPayload(p: number) {
  const conds = [...filters.value]
  const kw = keyword.value.trim()
  if (kw) conds.push({ field: 'summary', operator: 'CONTAIN', values: [kw] })
  return {
    globalFilter: buildGlobalFilter(conds, 'AND'),
    group: { groupItemList: [], isFollowPreviousGroup: true },
    layered: { layeredItemList: [], layerType: 'FLAT' },
    page: p,
    pageSize: PAGE_SIZE,
    showField: { showFieldItemList: LIST_FIELDS },
    sort: {
      sortItemList: sortRows.value.length
        ? sortRows.value.map((r) => ({ field: { id: r.fieldId, datasourceId: 0 }, sortTypeCode: r.sortTypeCode }))
        : [{ field: { id: 'updated' }, sortTypeCode: 'DESC' }],
    },
    needShowGroupValues: [],
    referencedFilter: { filter: null },
  }
}

async function loadMore() {
  const mySeq = seq
  const next = page.value + 1
  try {
    const res = await getIssues(buildPayload(next) as never)
    if (mySeq !== seq) return
    if (!res?.success) {
      error.value = true
      return
    }
    const rows = (res.data?.list || []).map(briefOf)
    list.value = next === 1 ? rows : [...list.value, ...rows]
    page.value = next
    const total = Number(res.data?.total || 0)
    finished.value = rows.length < PAGE_SIZE || list.value.length >= total
  } catch {
    if (mySeq === seq) error.value = true
  } finally {
    if (mySeq === seq) {
      loading.value = false
      refreshing.value = false
    }
  }
}

function reload() {
  seq++
  page.value = 0
  finished.value = false
  error.value = false
  loading.value = true
  void loadMore()
}

onMounted(reload)
// 切换空间 / 新建了事项：重新加载
watch(currentSpaceCode, reload)
onIssueCreated(reload)

// 从详情返回：静默刷新第一页，保留滚动位置（详情里可能改了状态）
let activatedOnce = false
onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true
    return
  }
  if (!loading.value) reload()
})
</script>

<style scoped>
.is-head {
  background: var(--h5-bg);
}

.h5-page :deep(.van-sticky) {
  background: var(--h5-bg);
}

.h5-page :deep(.van-search) {
  padding: 8px var(--h5-gutter) 4px;
}

/* 搜索框：白底 + 细边框 + 轻阴影，从浅灰页面背景里凸显出来；聚焦时边框变主题色 */
.h5-page :deep(.van-search__content) {
  height: 40px;
  background: #fff;
  border: 1px solid #e3e6eb;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.h5-page :deep(.van-search__content:focus-within) {
  border-color: var(--van-primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--van-primary-color) 15%, transparent);
}

.h5-page :deep(.van-search .van-field__left-icon) {
  color: var(--h5-text-2);
}

.h5-page :deep(.van-search .van-field__control::placeholder) {
  color: #9aa1ab;
}

.is-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px var(--h5-gutter) 4px;
}

.is-tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 12px;
  border-radius: 15px;
  background: #fff;
  border: 1px solid #e3e6eb;
  font-size: 13px;
  color: var(--h5-text-2);
}

.is-tool.active {
  border-color: color-mix(in srgb, var(--van-primary-color) 40%, transparent);
  background: color-mix(in srgb, var(--van-primary-color) 8%, #fff);
  color: var(--van-primary-color);
  font-weight: 500;
}

.is-tool-reset {
  margin-left: auto;
  font-size: 13px;
  color: var(--h5-text-3);
}


.h5-page :deep(.van-list) {
  min-height: 60vh;
  padding-bottom: 12px;
}
</style>
