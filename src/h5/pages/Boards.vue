<template>
  <div class="h5-page">
    <header class="h5-large-title">
      <h1>看板</h1>
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
          <span v-if="it.statusName" class="h5-status bd-row-status" :style="{ '--tone': hexOr(it.statusColor, '#8e8e93') }">{{ it.statusName }}</span>
        </div>
      </section>

      <!-- 我的视图：文件夹可折叠；视图左滑编辑 / 删除；右上角「新建」视图或文件夹 -->
      <div class="h5-section-title bd-views-title">
        <span>我的视图</span>
        <span class="bd-add" @click="openForm('create')"><van-icon name="plus" />新建</span>
      </div>
      <van-empty v-if="viewsLoaded && !hasViews" image-size="64" description="还没有视图，点右上角新建" />

      <template v-for="(g, gi) in viewGroups" :key="g.groupCode || `top-${gi}`">
        <!-- 文件夹 -->
        <section v-if="g.groupName" class="h5-card bd-folder">
          <div class="bd-folder-head" @click="toggleFolder(g)">
            <van-icon :name="isFolded(g) ? 'arrow' : 'arrow-down'" class="bd-folder-arrow" />
            <FolderIcon class="bd-folder-icon" />
            <span class="bd-folder-name h5-ellipsis" data-no-i18n>{{ g.groupName }}</span>
            <span class="h5-muted bd-folder-count">{{ g.myViewList.length }}</span>
            <van-icon name="ellipsis" class="bd-more" @click.stop="openFolderActions(g)" />
          </div>
          <template v-if="!isFolded(g)">
            <div v-if="!g.myViewList.length" class="h5-muted bd-folder-empty">暂无视图</div>
            <van-swipe-cell v-for="v in g.myViewList" :key="v.filterCode">
              <van-cell :title="v.filterName || ''" :label="VIEW_TYPE_LABEL[v.viewType] || '列表'" is-link class="bd-view-cell" @click="openView(v)">
                <template #icon><van-icon :name="VIEW_TYPE_ICON[v.viewType] || 'bars'" class="bd-view-icon" /></template>
              </van-cell>
              <template #right>
                <van-button square type="primary" text="编辑" class="bd-swipe-btn" @click="openForm('editView', null, v)" />
                <van-button square type="danger" text="删除" class="bd-swipe-btn" @click="confirmDeleteView(v)" />
              </template>
            </van-swipe-cell>
          </template>
        </section>

        <!-- 不在文件夹里的视图 -->
        <section v-else-if="g.myViewList.length" class="h5-card bd-folder bd-top-views">
          <van-swipe-cell v-for="v in g.myViewList" :key="v.filterCode">
            <van-cell :title="v.filterName || ''" :label="VIEW_TYPE_LABEL[v.viewType] || '列表'" is-link class="bd-view-cell" @click="openView(v)">
              <template #icon><van-icon :name="VIEW_TYPE_ICON[v.viewType] || 'bars'" class="bd-view-icon" /></template>
            </van-cell>
            <template #right>
              <van-button square type="primary" text="编辑" class="bd-swipe-btn" @click="openForm('editView', null, v)" />
              <van-button square type="danger" text="删除" class="bd-swipe-btn" @click="confirmDeleteView(v)" />
            </template>
          </van-swipe-cell>
        </section>
      </template>
      <p v-if="hasViews" class="h5-muted bd-swipe-tip">视图左滑可编辑、删除</p>
      <div class="bd-bottom" />
    </van-pull-refresh>

    <ViewForm v-model:show="formOpen" :action="formAction" :group="formGroup" :view="formView" @saved="onViewsChanged" />
    <van-action-sheet
      v-model:show="folderActionsOpen"
      :title="actingFolder?.groupName || ''"
      :actions="FOLDER_ACTIONS"
      cancel-text="取消"
      close-on-click-action
      @select="onFolderAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { showConfirmDialog } from 'vant'
import { useRouter } from 'vue-router'
import { deleteView, deleteViewGroup, queryMyBoardPanelData, queryMyBoardPanels, type MyBoardIssue, type MyBoardPanel } from '@/api/faiz'
import type { ViewGroup, ViewItem } from '@/types/faiz'
import { currentSpaceCode } from '@/utils/current-space'
import { hexOr } from '@/utils/issue-view'
import { useViewStore } from '@/utils/view-store'
import SpaceSwitcher from '../components/SpaceSwitcher.vue'
import ViewForm, { type ViewFormAction } from '../components/ViewForm.vue'
import FolderIcon from '../components/FolderIcon.vue'

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

const hasViews = computed(() => viewGroups.value.some((g) => g.groupName || g.myViewList.length))

function openView(v: ViewItem) {
  router.push(`/view/${encodeURIComponent(v.filterCode)}`)
}

// ---- 文件夹折叠（记在本机） ----
const FOLD_KEY = 'cooperise.h5.viewFolders.folded'
function readFolded(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FOLD_KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
const folded = ref<Set<string>>(new Set(readFolded()))
const isFolded = (g: ViewGroup) => folded.value.has(g.groupCode || '')
function toggleFolder(g: ViewGroup) {
  const next = new Set(folded.value)
  const k = g.groupCode || ''
  if (next.has(k)) next.delete(k)
  else next.add(k)
  folded.value = next
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify([...next]))
  } catch {
    // 存储不可用：只在本次打开生效
  }
}

// ---- 新建 / 编辑（视图、文件夹） ----
const formOpen = ref(false)
const formAction = ref<ViewFormAction>('create')
const formGroup = ref<ViewGroup | null>(null)
const formView = ref<ViewItem | null>(null)
function openForm(action: ViewFormAction, group: ViewGroup | null = null, view: ViewItem | null = null) {
  formAction.value = action
  formGroup.value = group
  formView.value = view
  formOpen.value = true
}
function onViewsChanged() {
  void loadViews(true)
}

// ---- 文件夹操作 ----
const FOLDER_ACTIONS = [
  { name: '在此新建视图', key: 'create' },
  { name: '重命名', key: 'rename' },
  { name: '删除文件夹', key: 'delete', color: '#ee0a24' },
]
const folderActionsOpen = ref(false)
const actingFolder = ref<ViewGroup | null>(null)
function openFolderActions(g: ViewGroup) {
  actingFolder.value = g
  folderActionsOpen.value = true
}
async function onFolderAction(a: { key: string }) {
  const g = actingFolder.value
  if (!g) return
  if (a.key === 'create') return openForm('createInGroup', g)
  if (a.key === 'rename') return openForm('renameGroup', g)
  try {
    await showConfirmDialog({
      title: `删除文件夹「${g.groupName ?? ''}」？`,
      message: g.myViewList.length ? `文件夹内有 ${g.myViewList.length} 个视图，删除后无法恢复。` : '删除后无法恢复。',
      confirmButtonText: '删除',
      confirmButtonColor: '#ee0a24',
    })
  } catch {
    return
  }
  try {
    const res = await deleteViewGroup({ groupCode: g.groupCode ?? '' })
    if (res?.success) onViewsChanged()
  } catch {
    // 请求层已统一提示
  }
}

// ---- 删除视图 ----
async function confirmDeleteView(v: ViewItem) {
  try {
    await showConfirmDialog({
      title: `删除视图「${v.filterName}」？`,
      message: '删除后无法恢复。',
      confirmButtonText: '删除',
      confirmButtonColor: '#ee0a24',
    })
  } catch {
    return
  }
  try {
    const res = await deleteView({ filterCode: v.filterCode })
    if (res?.success) onViewsChanged()
  } catch {
    // 请求层已统一提示
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

.bd-views-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bd-add {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  font-size: 13px;
  color: var(--van-primary-color);
}

.bd-folder {
  padding: 0;
  overflow: hidden;
}

.bd-top-views {
  margin-top: 10px;
}

.bd-folder-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 10px 12px 12px;
}

.bd-folder-arrow {
  font-size: 12px;
  color: var(--h5-text-3);
}

.bd-folder-icon {
  font-size: 18px;
  color: #d4a05f;
}

.bd-folder-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
}

.bd-folder-count {
  font-size: 12px;
}

.bd-more {
  padding: 4px 6px;
  font-size: 18px;
  color: var(--h5-text-2);
}

.bd-folder-empty {
  padding: 4px 16px 14px 42px;
  font-size: 13px;
}

.bd-view-cell {
  padding-left: 16px;
}

.bd-swipe-btn {
  height: 100%;
}

.bd-swipe-tip {
  margin: 10px 0 0;
  text-align: center;
  font-size: 12px;
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
