<template>
  <div class="h5-page">
    <van-nav-bar :title="viewName" left-arrow fixed placeholder @click-left="goBack" />

    <!-- 看板视图：按状态分页签（手机上不做横向多列） -->
    <van-tabs
      v-if="isKanban && statusTabs.length"
      v-model:active="statusTab"
      sticky
      offset-top="calc(46px + env(safe-area-inset-top, 0px))"
      background="var(--h5-bg)"
      shrink
      line-width="20px"
    >
      <van-tab name="" :title="`全部 ${list.length}`" />
      <van-tab v-for="s in statusTabs" :key="s.name" :name="s.name" :title="`${s.name} ${s.count}`" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="reload">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        v-model:error="error"
        error-text="加载失败，点击重试"
        :finished-text="list.length ? '没有更多了' : ''"
        :immediate-check="false"
        @load="loadMore"
      >
        <IssueCard v-for="it in shown" :key="it.key" :issue="it" />
        <van-empty v-if="finished && !shown.length" image-size="72" description="该视图下暂无事项" />
      </van-list>
      <div class="h5-safe-bottom" />
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFilterDraft, getIssues } from '@/api/faiz'
import type { FilterDraft } from '@/types/faiz'
import { safeParse } from '@/utils/issue-view'
import { defaultConditions, buildGlobalFilter } from '@/utils/issueFilter'
import { useViewStore } from '@/utils/view-store'
import IssueCard from '../components/IssueCard.vue'
import { LIST_FIELDS, briefOf, myMemberId, type IssueBrief } from '../utils'

const route = useRoute()
const router = useRouter()
const filterCode = computed(() => String(route.params.filterCode || ''))

const { ensureLoaded, findViewItem } = useViewStore()
const view = computed(() => findViewItem(filterCode.value))
const viewName = computed(() => view.value?.filterName || '视图')
const isKanban = computed(() => view.value?.viewType === 'KAN_BAN')

/** 看板一次多拉一些，方便按状态分组；列表正常分页 */
const pageSize = computed(() => (isKanban.value ? 200 : 20))

const list = ref<IssueBrief[]>([])
const page = ref(0)
const loading = ref(false)
const finished = ref(false)
const error = ref(false)
const refreshing = ref(false)
let draft: FilterDraft | null = null
let seq = 0

// ---- 看板：状态页签 ----
const statusTab = ref('')
const statusTabs = computed(() => {
  const map = new Map<string, number>()
  list.value.forEach((it) => map.set(it.statusName || '无状态', (map.get(it.statusName || '无状态') || 0) + 1))
  return [...map].map(([name, count]) => ({ name, count }))
})
const shown = computed(() => (isKanban.value && statusTab.value
  ? list.value.filter((it) => (it.statusName || '无状态') === statusTab.value)
  : list.value))

/** 视图的筛选 / 排序沿用网页版保存的草稿（同一个 filterCode） */
function buildPayload(p: number) {
  const gf = safeParse(draft?.globalFilter, null) || buildGlobalFilter(defaultConditions(), 'AND')
  const sort = safeParse(draft?.sort, null) || { sortItemList: [{ field: { id: 'updated' }, sortTypeCode: 'DESC' }] }
  return {
    globalFilter: gf,
    group: { groupItemList: [], isFollowPreviousGroup: true },
    layered: { layeredItemList: [], layerType: 'FLAT' },
    page: p,
    pageSize: pageSize.value,
    showField: { showFieldItemList: LIST_FIELDS },
    sort,
    viewCode: draft?.viewCode || filterCode.value,
    needShowGroupValues: [],
    referencedFilter: safeParse(draft?.referencedFilter, { filter: null }),
  }
}

async function loadMore() {
  const mySeq = seq
  const next = page.value + 1
  try {
    if (next === 1) {
      const d = await getFilterDraft(myMemberId(), filterCode.value)
      draft = d?.success ? d.data || null : null
    }
    const res = await getIssues(buildPayload(next) as never)
    if (mySeq !== seq) return
    if (!res?.success) {
      error.value = true
      return
    }
    const rows = (res.data?.list || []).map(briefOf)
    list.value = next === 1 ? rows : [...list.value, ...rows]
    page.value = next
    finished.value = rows.length < pageSize.value || list.value.length >= Number(res.data?.total || 0)
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

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/boards')
}

onMounted(async () => {
  try {
    await ensureLoaded()
  } catch {
    // 视图名取不到时显示「视图」
  }
  reload()
})
</script>
