<template>
  <!-- 客户端顶部页签栏（参考 Apifox / 浏览器）：每个打开过的页面一个页签，空白处可拖动窗口，右侧给系统窗口按钮留位 -->
  <div class="desktop-tabbar" :class="{ reordering: !!draggingKey }">
    <!-- 系统 logo：占一级菜单（图标栏，64px）的宽度，页签从二级菜单左边缘开始；macOS 左侧是红绿灯，不显示 -->
    <div v-if="!isMacDesktop" class="dt-logo"><AppLogo /></div>
    <div ref="listRef" class="dt-list" @wheel.passive="onWheel">
      <a-dropdown v-for="(tab, i) in tabs" :key="tab.key" :trigger="['contextmenu']">
        <div
          class="dt-tab"
          :class="{ active: tab.key === activeKey, dragging: tab.key === draggingKey }"
          @pointerdown="onPointerDown(tab, $event)"
          :title="`${KIND_META[kindOf(tab.key)].label}：${tab.title}`"
          :data-key="tab.key"
          @click="activate(tab)"
          @mousedown.middle.prevent="close(tab)"
        >
          <span class="dt-kind" :class="`dt-kind-${kindOf(tab.key)}`">
            <component :is="KIND_META[kindOf(tab.key)].icon" />
          </span>
          <span class="dt-title">{{ tab.title }}</span>
          <span v-if="tabs.length > 1" class="dt-close" @click.stop="onCloseClick(tab)"><CloseOutlined /></span>
        </div>
        <template #overlay>
          <a-menu @click="(e: any) => onMenu(String(e.key), i)">
            <a-menu-item key="close" :disabled="tabs.length <= 1">关闭</a-menu-item>
            <a-menu-item key="others" :disabled="tabs.length <= 1">关闭其他</a-menu-item>
            <a-menu-item key="right" :disabled="i >= tabs.length - 1">关闭右侧</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
    <!-- 页签操作：放在滚动列表外，页签再多也始终可见 -->
    <a-dropdown :trigger="['click']" placement="bottomRight">
      <span class="dt-more" title="页签操作"><EllipsisOutlined /></span>
      <template #overlay>
        <a-menu @click="(e: any) => onMoreMenu(String(e.key))">
          <a-menu-item key="current" :disabled="tabs.length <= 1">关闭当前页签</a-menu-item>
          <a-menu-item key="others" :disabled="tabs.length <= 1">关闭其他页签</a-menu-item>
          <a-menu-item key="all" :disabled="onlyHome">关闭全部页签</a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { CloseOutlined, EllipsisOutlined, LinkOutlined, MenuOutlined, FileTextOutlined, CloudOutlined, AppstoreOutlined } from '@ant-design/icons-vue'
import { useViewStore } from '@/utils/view-store'
import { isMacDesktop } from '@/utils/desktop'
import { getLoginUsername } from '@/utils/auth'
import AppLogo from '@/components/AppLogo.vue'

interface Tab {
  /** 页签唯一标识：路由 path（同一页面只开一个页签，query 变化在页签内更新） */
  key: string
  fullPath: string
  title: string
}

const HOME = '/workbench/board'

/**
 * 页签类型（按路由 path 判断，旧的本地页签数据也能直接识别）：
 * - link：通过链接打开的事项详情（/jira/browse/:issueKey）
 * - menu：工作台左侧菜单（我的看板 / 我的事项 / 我的视图）
 * - page：其他功能页面（空间、设置、管理后台、个人中心等）
 */
type TabKind = 'link' | 'menu' | 'page' | 'docs' | 'space'
const KIND_META: Record<TabKind, { label: string; icon: unknown }> = {
  link: { label: '链接', icon: LinkOutlined },
  menu: { label: '菜单', icon: MenuOutlined },
  page: { label: '页面', icon: FileTextOutlined },
  docs: { label: '云文档', icon: CloudOutlined },
  space: { label: '空间', icon: AppstoreOutlined },
}
function kindOf(path: string): TabKind {
  if (path.startsWith('/jira/browse/')) return 'link'
  if (path.startsWith('/docs')) return 'docs'
  if (path.startsWith('/space')) return 'space'
  if (path.startsWith('/workbench/')) return 'menu'
  return 'page'
}
const STORAGE_KEY = 'cooperise.desktop.tabs'

const route = useRoute()
const router = useRouter()
const { findViewItem, viewGroups } = useViewStore()

function loadTabs(): Tab[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(list) ? list.filter((t) => t && t.key && t.fullPath) : []
  } catch {
    return []
  }
}
const tabs = ref<Tab[]>(loadTabs())
watch(tabs, (v) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) } catch { /* 存储不可用时只在本次会话保留 */ }
}, { deep: true })

const activeKey = computed(() => keyOf(route))

/** 页签标识：云文档按完整路径区分（每个文档一个页签），其余页面按 path 区分 */
function keyOf(r: RouteLocationNormalizedLoaded): string {
  return r.path === '/docs' ? r.fullPath : r.path
}

/** 云文档页签标题：从本地文档数据里取文档标题 */
function docTitleOf(id: string): string {
  try {
    const raw = localStorage.getItem(`cooperise_docs:${getLoginUsername() || 'anonymous'}`)
    const parsed = raw ? JSON.parse(raw) : null
    const list = Array.isArray(parsed) ? parsed : parsed?.docs
    const title = list?.find((d: any) => d && String(d.id) === id)?.title
    return title || '先蜂云文档'
  } catch {
    return '先蜂云文档'
  }
}

function titleOf(r: RouteLocationNormalizedLoaded): string {
  if (r.name === 'IssueDetail' && r.params.issueKey) return String(r.params.issueKey)
  if (r.path === '/docs' && r.query.doc) return docTitleOf(String(r.query.doc))
  if (r.name === 'ViewEntry' && r.params.filterCode) {
    return findViewItem(String(r.params.filterCode))?.filterName || '视图'
  }
  return (r.meta?.title as string) || '新页签'
}

// 每次进入新页面：已开过就更新，没开过就在当前页签右侧新开一个
let lastKey = ''
watch(
  () => route.fullPath,
  () => {
    if (route.meta?.public || route.matched.length === 0) return
    const key = keyOf(route)
    const tab = { key, fullPath: route.fullPath, title: titleOf(route) }
    const idx = tabs.value.findIndex((t) => t.key === key)
    if (idx >= 0) tabs.value[idx] = tab
    else {
      const from = tabs.value.findIndex((t) => t.key === lastKey)
      tabs.value.splice(from >= 0 ? from + 1 : tabs.value.length, 0, tab)
    }
    lastKey = key
    scrollIntoView(key)
  },
  { immediate: true },
)

// 视图列表加载 / 改名后刷新视图页签的标题
watch(viewGroups, () => {
  tabs.value.forEach((t) => {
    const m = /^\/workbench\/view\/([^/]+)$/.exec(t.key)
    const name = m && findViewItem(decodeURIComponent(m[1]))?.filterName
    if (name && name !== t.title) t.title = name
  })
}, { deep: true })

function activate(tab: Tab) {
  if (suppressClick) return
  if (tab.key !== activeKey.value) router.push(tab.fullPath)
}

function closeKeys(keys: Set<string>) {
  if (!keys.size) return
  const list = tabs.value
  const activeIdx = list.findIndex((t) => t.key === activeKey.value)
  const rest = list.filter((t) => !keys.has(t.key))
  tabs.value = rest
  if (!keys.has(activeKey.value)) return
  if (!rest.length) return void router.push(HOME)
  // 关掉当前页签：优先切到右侧，没有则左侧（与浏览器一致）
  const next = list.slice(activeIdx + 1).find((t) => !keys.has(t.key))
    ?? list.slice(0, activeIdx).reverse().find((t) => !keys.has(t.key))
  if (next) router.push(next.fullPath)
}

function close(tab: Tab) {
  if (tabs.value.length <= 1) return
  closeKeys(new Set([tab.key]))
}

function onMenu(key: string, i: number) {
  const tab = tabs.value[i]
  if (!tab) return
  if (key === 'close') close(tab)
  else if (key === 'others') {
    if (tab.key !== activeKey.value) router.push(tab.fullPath)
    closeKeys(new Set(tabs.value.filter((t) => t.key !== tab.key).map((t) => t.key)))
  } else if (key === 'right') {
    const right = tabs.value.slice(i + 1).map((t) => t.key)
    if (right.includes(activeKey.value)) router.push(tab.fullPath)
    closeKeys(new Set(right))
  }
}

// ---- 拖动调整页签顺序 ----
// 不用 HTML5 原生拖拽（draggable / dragover）：页签栏是窗口拖动区（-webkit-app-region: drag），
// Windows 上原生拖拽会被系统的窗口拖动抢走，时灵时不灵。改用 pointer 事件自己实现：
// - 按下后移动超过 5px 才算拖动（普通点击照常切换页签）
// - 拖动中整栏关闭窗口拖动区（.reordering），指针经过页签间隙也不会被系统接管
// - 指针在哪个页签的左半边就放到它前面，右半边放到它后面；实时移动，松手即生效
const DRAG_THRESHOLD = 5
const draggingKey = ref<string | null>(null)
let pressKey = ''
let pressX = 0
let pointerId = -1
let captureEl: HTMLElement | null = null
/** 刚拖完：吞掉松手后触发的那次 click，避免拖完又切换页签 */
let suppressClick = false

function onPointerDown(tab: Tab, e: PointerEvent) {
  if (e.button !== 0) return
  pressKey = tab.key
  pressX = e.clientX
  pointerId = e.pointerId
  captureEl = e.currentTarget as HTMLElement
  // 立即捕获指针：避免按下后指针移出页签 / 进入窗口拖动区时丢失 pointermove
  try { captureEl.setPointerCapture(e.pointerId) } catch { /* 元素已移除 */ }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  if (!draggingKey.value) {
    if (Math.abs(e.clientX - pressX) < DRAG_THRESHOLD) return
    draggingKey.value = pressKey
    // 指针移出页签栏也继续收到事件
    try { captureEl?.setPointerCapture(e.pointerId) } catch { /* 元素已移除 */ }
  }
  moveDraggingTo(e.clientX)
}

/** 按指针横坐标找到目标页签，把拖动中的页签移到它前面 / 后面 */
function moveDraggingTo(x: number) {
  const key = draggingKey.value
  const el = listRef.value
  if (!key || !el) return
  const nodes = Array.from(el.querySelectorAll<HTMLElement>('.dt-tab[data-key]'))
  const target = nodes.find((n) => {
    const r = n.getBoundingClientRect()
    return x >= r.left && x <= r.right
  })
  const targetKey = target?.dataset.key
  if (!target || !targetKey || targetKey === key) return
  const list = tabs.value
  const from = list.findIndex((t) => t.key === key)
  const to = list.findIndex((t) => t.key === targetKey)
  if (from < 0 || to < 0) return
  const r = target.getBoundingClientRect()
  const after = x > r.left + r.width / 2
  // 目标插入位置（按移除拖动项之前的下标算）
  let insert = after ? to + 1 : to
  if (from < insert) insert--
  if (insert === from) return
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(insert, 0, moved)
  tabs.value = next
}

/** 页签上的 ×：拖动结束时松手落在 × 上不算点击 */
function onCloseClick(tab: Tab) {
  if (!suppressClick) close(tab)
}

function removePointerListeners() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}
onBeforeUnmount(removePointerListeners)

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  removePointerListeners()
  try { captureEl?.releasePointerCapture(e.pointerId) } catch { /* 已释放 */ }
  if (draggingKey.value) {
    suppressClick = true
    setTimeout(() => { suppressClick = false }, 0)
  }
  draggingKey.value = null
  pressKey = ''
  pointerId = -1
  captureEl = null
}

/** 只剩首页一个页签时，「关闭全部」没有意义 */
const onlyHome = computed(() => tabs.value.length === 1 && tabs.value[0].key === HOME)

/** 关闭全部：回到首页（我的看板），只留首页一个页签 */
function closeAll() {
  if (route.path === HOME) {
    tabs.value = tabs.value.filter((t) => t.key === HOME)
  } else {
    tabs.value = []
    router.push(HOME) // 路由监听会把首页页签加回来
  }
}

function onMoreMenu(key: string) {
  const current = tabs.value.find((t) => t.key === activeKey.value)
  if (key === 'current') {
    if (current) close(current)
  } else if (key === 'others') {
    if (current) closeKeys(new Set(tabs.value.filter((t) => t.key !== current.key).map((t) => t.key)))
  } else if (key === 'all') {
    closeAll()
  }
}

// ---- 页签过多时横向滚动 ----
const listRef = ref<HTMLElement>()
function onWheel(e: WheelEvent) {
  const el = listRef.value
  if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY
}
function scrollIntoView(key: string) {
  nextTick(() => {
    const el = listRef.value?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}
</script>

<style scoped>
.desktop-tabbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  min-width: var(--app-min-width);
  height: var(--desktop-tabbar-height, 42px);
  /* 右侧留出系统窗口按钮（最小化 / 最大化 / 关闭）的位置 */
  padding: 0 calc(var(--desktop-controls-width, 0px) + 8px) 0 0;
  display: flex;
  align-items: flex-end;
  background: #eef0f3;
  z-index: 1001;
  -webkit-app-region: drag;
  user-select: none;
}

/* macOS：红绿灯在左侧 */
:global(html.is-mac) .desktop-tabbar {
  padding-left: 80px;
}

/* 与左侧一级菜单（.icon-bar 64px）同宽，logo 居中 */
.dt-logo {
  flex-shrink: 0;
  align-self: stretch;
  width: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dt-logo :deep(svg) {
  width: 24px;
  height: 24px;
}

.dt-list {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  /* 页签列表整体不参与窗口拖动，避免 Windows 的 app-region 抢占页签 pointer 事件 */
  -webkit-app-region: no-drag;
}

.dt-list::-webkit-scrollbar {
  display: none;
}

.dt-tab {
  -webkit-app-region: no-drag;
  position: relative;
  flex: 0 1 168px;
  min-width: 88px;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px 0 8px;
  border-radius: 6px 6px 0 0;
  font-size: 12px;
  color: #5c6370;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.dt-tab:hover {
  background: rgba(255, 255, 255, 0.55);
  color: #1f2329;
}

/* 拖动中的页签：半透明，表示它的新位置 */
/* 拖动中：整栏关闭窗口拖动区，鼠标变成抓手 */
.desktop-tabbar.reordering,
.desktop-tabbar.reordering .dt-list {
  -webkit-app-region: no-drag;
  cursor: grabbing;
}

.dt-tab.dragging {
  opacity: 0.45;
}

.dt-tab.active {
  background: #fff;
  color: #1f2329;
  font-weight: 500;
}

/* 相邻未选中页签之间的分隔线 */
.dt-tab:not(.active):not(:hover) + .dt-tab:not(.active):not(:hover)::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 7px;
  bottom: 7px;
  width: 1px;
  background: #d5d9df;
}

.dt-kind {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 10px;
}

/* 三种类型用颜色 + 图标区分 */
.dt-kind-link {
  color: #1677ff;
  background: rgba(22, 119, 255, 0.1);
}

.dt-kind-menu {
  color: #722ed1;
  background: rgba(114, 46, 209, 0.1);
}

.dt-kind-page {
  color: #5c6370;
  background: rgba(92, 99, 112, 0.1);
}

.dt-kind-docs {
  color: #3370ff;
  background: rgba(51, 112, 255, 0.1);
}

.dt-kind-space {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
}

.dt-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dt-close {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 9px;
  color: #8a919c;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.dt-tab:hover .dt-close,
.dt-tab.active .dt-close {
  opacity: 1;
}

.dt-close:hover {
  background: #e5e7eb;
  color: #1f2329;
}

.dt-more {
  -webkit-app-region: no-drag;
  flex-shrink: 0;
  align-self: center;
  width: 24px;
  height: 24px;
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 16px;
  color: #5c6370;
  cursor: pointer;
}

.dt-more:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1f2329;
}
</style>
