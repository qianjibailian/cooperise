<template>
  <div class="h5-page">
    <header class="bd-head">
      <SpaceSwitcher />
    </header>

    <van-pull-refresh v-model="refreshing" @refresh="reload">
      <!-- 我的看板：每个面板展示前 5 条，点标题看全部 -->
      <div class="h5-section-title">我的看板</div>
      <van-skeleton v-if="panelsLoading && !panels.length" :row="4" class="bd-skeleton" />
      <van-empty v-else-if="!panels.length" image-size="64" description="还没有看板面板，可在网页版「我的看板」中添加" />
      <section v-for="p in panels" :key="p.id" class="h5-card bd-panel">
        <div class="bd-panel-head" @click="openPanel(p)">
          <span class="bd-panel-title" data-no-i18n>{{ p.title }}</span>
          <span class="h5-muted bd-panel-count">{{ panelData[p.id]?.total ?? '' }}</span>
          <van-icon name="arrow" class="h5-muted" />
        </div>
        <van-loading v-if="!panelData[p.id]" size="18" class="bd-panel-loading" />
        <div v-else-if="!panelData[p.id].list.length" class="h5-muted bd-panel-empty">暂无事项</div>
        <div
          v-for="it in panelData[p.id]?.list.slice(0, 5) || []"
          :key="it.issueKey"
          class="bd-row"
          @click="router.push(`/jira/browse/${encodeURIComponent(it.issueKey)}`)"
        >
          <i class="bd-row-type" :style="{ background: hexOr(it.issueTypeColor, '#8b6fc0') }" />
          <span class="bd-row-summary h5-ellipsis" data-no-i18n>{{ it.summary || it.issueKey }}</span>
          <span v-if="it.statusName" class="h5-status bd-row-status" :style="{ background: hexOr(it.statusColor, '#8a919c') }">{{ it.statusName }}</span>
        </div>
      </section>

      <!-- 我的视图 -->
      <div class="h5-section-title">我的视图</div>
      <van-empty v-if="viewsLoaded && !viewGroups.length" image-size="64" description="暂无视图" />
      <template v-for="g in viewGroups" :key="g.groupCode">
        <van-cell-group inset :title="g.groupName || ''" class="bd-view-group">
          <van-cell
            v-for="v in g.myViewList"
            :key="v.filterCode"
            :title="v.filterName || ''"
            :label="VIEW_TYPE_LABEL[v.viewType] || '列表'"
            is-link
            @click="router.push(`/view/${encodeURIComponent(v.filterCode)}`)"
          >
            <template #icon>
              <van-icon :name="VIEW_TYPE_ICON[v.viewType] || 'bars'" class="bd-view-icon" />
            </template>
          </van-cell>
        </van-cell-group>
      </template>
      <div class="bd-bottom" />
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { queryMyBoardPanelData, queryMyBoardPanels, type MyBoardIssue, type MyBoardPanel } from '@/api/faiz'
import { currentSpaceCode } from '@/utils/current-space'
import { hexOr } from '@/utils/issue-view'
import { useViewStore } from '@/utils/view-store'
import SpaceSwitcher from '../components/SpaceSwitcher.vue'

defineOptions({ name: 'H5Boards' })

const router = useRouter()

const VIEW_TYPE_LABEL: Record<string, string> = {
  list: '列表', KAN_BAN: '看板', gantt: '甘特图', CALENDAR_VIEW: '日历', RELEASE_LIST: '上线清单',
}
const VIEW_TYPE_ICON: Record<string, string> = {
  list: 'bars', KAN_BAN: 'apps-o', gantt: 'chart-trending-o', CALENDAR_VIEW: 'calendar-o', RELEASE_LIST: 'todo-list-o',
}

// ---------------- 我的看板 ----------------
const panels = ref<MyBoardPanel[]>([])
const panelData = reactive<Record<number, { total: number; list: MyBoardIssue[] }>>({})
const panelsLoading = ref(false)

async function loadPanels() {
  panelsLoading.value = true
  try {
    const res = await queryMyBoardPanels()
    panels.value = res?.success ? res.data || [] : []
    Object.keys(panelData).forEach((k) => delete panelData[Number(k)])
    await Promise.all(panels.value.map(async (p) => {
      try {
        const r = await queryMyBoardPanelData(p.id)
        panelData[p.id] = { total: Number(r?.data?.total || 0), list: r?.success ? r.data?.list || [] : [] }
      } catch {
        panelData[p.id] = { total: 0, list: [] }
      }
    }))
  } catch {
    panels.value = []
  } finally {
    panelsLoading.value = false
  }
}

function openPanel(p: MyBoardPanel) {
  router.push({ path: `/board/${p.id}`, query: { title: p.title } })
}

// ---------------- 我的视图 ----------------
const { viewGroups, ensureLoaded } = useViewStore()
const viewsLoaded = ref(false)
async function loadViews(force = false) {
  try {
    await ensureLoaded(force)
  } finally {
    viewsLoaded.value = true
  }
}

// ---------------- 刷新 ----------------
const refreshing = ref(false)
async function reload() {
  await Promise.all([loadPanels(), loadViews(true)])
  refreshing.value = false
}

onMounted(() => {
  void loadPanels()
  void loadViews()
})
watch(currentSpaceCode, () => void reload())
</script>

<style scoped>
.bd-head {
  padding: calc(env(safe-area-inset-top, 0px) + 10px) var(--h5-gutter) 0;
}

.bd-skeleton {
  padding: 8px 0;
}

.bd-panel {
  padding: 4px 0 6px;
}

.bd-panel-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px 8px;
}

.bd-panel-title {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
}

.bd-panel-count {
  font-size: 13px;
}

.bd-panel-loading {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.bd-panel-empty {
  padding: 8px 14px 12px;
  font-size: 13px;
}

.bd-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
}

.bd-row:active {
  background: #f7f8fa;
}

.bd-row-type {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.bd-row-summary {
  flex: 1;
  min-width: 0;
  font-size: 14px;
}

.bd-row-status {
  flex-shrink: 0;
  height: 20px;
  font-size: 11px;
}

.bd-view-group {
  margin-bottom: 8px;
}

.bd-view-icon {
  margin-right: 10px;
  font-size: 18px;
  color: var(--van-primary-color);
  align-self: center;
}

.bd-bottom {
  height: 16px;
}
</style>
