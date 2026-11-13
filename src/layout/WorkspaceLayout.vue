<template>
  <a-layout class="layout-container" :style="{ '--sider-w': siderWidth + 'px' }">
    <AppHeader
      :sidebar-collapsed="panelCollapsed"
      :show-logo="true"
      :center-title="true"
      :left-width="panelCollapsed ? 200 : siderWidth"
      module-title="需求管控平台"
      search-placeholder="搜索问题单号或者概要"
      @toggle-sidebar="toggleSidebar"
    />

    <!-- 手机端：侧栏以抽屉形式从左侧滑出，点遮罩 / 换页自动收起 -->
    <div v-if="isMobile && mobileMenuOpen" class="mobile-mask" @click="closeMobileMenu" />

    <a-layout-sider
      v-if="!panelCollapsed || isIOSApp"
      :width="siderWidth"
      class="sider sider-workbench"
      :class="{ 'sider-mobile-open': mobileMenuOpen }"
      :trigger="null"
    >
      <div class="sider-inner">
        <!-- 右侧面板 -->
        <div class="side-panel" :class="{ 'side-panel-collapsed': panelCollapsed }">
            <a-menu
              theme="light"
              mode="inline"
              :selectedKeys="[currentPath]"

              @click="handleLocalMenuClick"
              class="sidebar-menu workspace-top-menu"
            >
              <a-menu-item key="/workbench/board">
                <component :is="DashboardOutlined" />
                <span>我的看板</span>
              </a-menu-item>
              <a-menu-item key="/workbench/todo">
                <component :is="CheckSquareOutlined" />
                <span>我的事项<template v-if="todoCount !== null"> ({{ todoCount }})</template></span>
              </a-menu-item>
            </a-menu>

            <a-divider v-if="!panelCollapsed" class="panel-divider" />

            <!-- 视图区域 -->
            <div class="panel-section scrollable" :class="{ 'panel-section-collapsed': panelCollapsed }">
              <div v-if="!panelCollapsed" class="panel-section-header">
                <span class="section-title">我的视图</span>
                <div class="section-header-actions">
                  <component :is="SearchOutlined" class="action-icon" />
                  <component :is="PlusOutlined" class="action-icon" title="新建视图 / 文件夹" @click="openCreateView" />
                </div>
              </div>
              <a-menu
                theme="light"
                mode="inline"
                :selectedKeys="selectedViewKeys"
                :openKeys="panelCollapsed ? [] : viewSubmenuOpenKeys"
                @open-change="onViewOpenChange"
                @click="handleLocalMenuClick"
                class="sidebar-menu view-menu"
              >
                <template v-for="(group, gIdx) in viewGroups" :key="`g-${gIdx}`">
                  <!-- 有 groupName → 可展开 sub-menu -->
                  <a-sub-menu v-if="group.groupName" :key="viewGroupKey(group)">
                    <template #title>
                      <span class="view-item-content">
                        <component :is="isGroupOpen(group) ? FolderOpenOutlined : FolderOutlined" class="folder-icon" />
                        <span class="folder-text">
                          <a-tooltip :title="group.groupName" placement="right" :mouse-enter-delay="0.4">
                            <span class="name-ellipsis">{{ group.groupName }}</span>
                          </a-tooltip>
                          <span v-if="typeof group.count === 'number'" class="name-count">({{ group.count }})</span>
                          <a-tag v-if="group.share" class="view-tag external">外</a-tag>
                        </span>
                        <!-- 悬停文件夹时显示：更多操作 -->
                        <a-dropdown trigger="click" placement="bottomRight" @click.stop>
                          <span class="item-more" @click.stop><MoreOutlined /></span>
                          <template #overlay>
                            <a-menu @click="onFolderAction($event, group)">
                              <a-menu-item key="create">新建视图</a-menu-item>
                              <a-menu-item key="edit">编辑</a-menu-item>
                              <a-menu-item key="delete" danger>删除</a-menu-item>
                            </a-menu>
                          </template>
                        </a-dropdown>
                      </span>
                    </template>
                    <a-menu-item
                      v-for="v in group.myViewList"
                      :key="viewItemKey(v)"
                      :data-menu-id="viewItemKey(v)"
                      class="view-menu-item"
                    >
                      <span class="child-item">
                        <ViewTypeIcon :type="v.viewType" class="child-primary-icon" />
                        <a-tooltip :title="v.filterName" placement="right" :mouse-enter-delay="0.4">
                          <span class="child-text-truncate name-ellipsis">{{ v.filterName }}</span>
                        </a-tooltip>
                        <component v-if="v.isCollect" :is="StarFilled" class="favorite-icon" />
                        <component v-if="v.isShare && v.sortId <= 1" :is="MoreOutlined" class="child-more-icon" />
                        <!-- 悬停视图时显示：更多操作 -->
                        <a-dropdown v-if="v.canManage" trigger="click" placement="bottomRight" @click.stop>
                          <span class="item-more" @click.stop><MoreOutlined /></span>
                          <template #overlay>
                            <a-menu @click="onViewAction($event, v)">
                              <a-menu-item key="edit">编辑</a-menu-item>
                              <a-menu-item key="delete" danger>删除</a-menu-item>
                            </a-menu>
                          </template>
                        </a-dropdown>
                      </span>
                    </a-menu-item>
                    <!-- 空文件夹占位 -->
                    <a-menu-item
                      v-if="group.myViewList.length === 0"
                      :key="`${viewGroupKey(group)}/__empty__`"
                      disabled
                      class="view-empty-item"
                    >
                      暂无视图
                    </a-menu-item>
                  </a-sub-menu>

                  <!-- 无 groupName → 顶层 menu-item 列表 -->
                  <template v-else>
                    <a-menu-item
                      v-for="v in group.myViewList"
                      :key="viewItemKey(v)"
                      :data-menu-id="viewItemKey(v)"
                      class="view-menu-item"
                    >
                    <ViewTypeIcon :type="v.viewType" />
                    <a-tooltip :title="v.filterName" placement="right" :mouse-enter-delay="0.4">
                      <span class="view-name name-ellipsis">{{ v.filterName }}</span>
                    </a-tooltip>
                    <span v-if="typeof v.myTodoTotalCount === 'number'" class="name-count">({{ v.myTodoTotalCount }})</span>
                    <a-dropdown v-if="v.canManage" trigger="click" placement="bottomRight" @click.stop>
                      <span class="item-more" @click.stop><MoreOutlined /></span>
                      <template #overlay>
                        <a-menu @click="onViewAction($event, v)">
                          <a-menu-item key="edit">编辑</a-menu-item>
                          <a-menu-item key="delete" danger>删除</a-menu-item>
                        </a-menu>
                      </template>
                    </a-dropdown>
                    </a-menu-item>
                  </template>
                </template>
              </a-menu>
            </div>
        </div>
      </div>
    </a-layout-sider>
    <a-layout class="main-layout" :class="{ 'main-layout-collapsed': panelCollapsed }">
      <a-layout-content class="content">
        <WorkbenchPanel />
      </a-layout-content>
    </a-layout>

    <!-- 我的视图「+」：新建视图 / 文件夹 -->
    <CreateViewModal
      v-model:open="showCreateViewModal"
      :action="createViewAction"
      :group="createViewTargetGroup"
      :view="createViewTargetView"
      @created="fetchViewList(true)"
    />
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  CheckSquareOutlined,
  DashboardOutlined,
  SearchOutlined,
  PlusOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  StarFilled,
  MoreOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { isMacDesktop } from '@/utils/desktop'
import { onIssueCreated } from '@/utils/issue-events'
import { useTodoCount, refreshTodoCount } from '@/utils/todo-count'
import { isIOSApp } from '@/utils/native'
import { useAuth } from '@/utils/auth'
import CreateViewModal from '@/components/CreateViewModal.vue'
import ViewTypeIcon from '@/components/ViewTypeIcon.vue'
import WorkbenchPanel from './WorkbenchPanel.vue'
import { useViewStore } from '@/utils/view-store'
import type { ViewItem, ViewGroup } from '@/types/faiz'
import { Modal, message } from 'ant-design-vue'
import { deleteViewGroup, deleteView } from '@/api/faiz'

const router = useRouter()
const route = useRoute()

/** 侧栏宽度：macOS 红绿灯占左侧，把侧栏收窄让主内容区更靠左（整体比原宽度缩小 20%） */
const siderWidth = Math.round((isMacDesktop ? 280 : 334) * 0.8)

// 侧边栏「我的事项 (N)」：与我的事项列表总数一致；挂载时与新建事项后按我的事项的筛选条件刷新。
// 该数字只显示在工作台侧栏，非工作台路由不请求（列表页在其它路由整页刷新时也不该带出这两个接口）
const { todoCount } = useTodoCount()
const { user: authUser } = useAuth()
const todoUserNo = computed(() => authUser.value?.memberId || '10284941')
const isWorkbenchPath = (path: string) => path.startsWith('/workbench')
onMounted(() => {
  if (isWorkbenchPath(route.path)) refreshTodoCount(todoUserNo.value)
})
onIssueCreated(() => {
  if (isWorkbenchPath(route.path)) refreshTodoCount(todoUserNo.value)
})
const SIDEBAR_COLLAPSED_KEY = 'cooperise_sidebar_collapsed'
/** 侧栏收起偏好：默认展开；用户收起后记住（iOS 小屏默认收起） */
function readSidebarCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved != null) return saved === '1'
  } catch {
    // ignore
  }
  return isIOSApp && window.innerWidth < 900
}
const sidebarCollapsed = ref(readSidebarCollapsed())

/**
 * 手机端（≤767px，基准 iPhone 17 / 17 Pro Max）：侧栏改为抽屉，用独立开关控制
 * 桌面 / 平板：维持原来的展开-收起
 * 注意：必须在下面 immediate 的 route watch 之前声明，否则初始化时访问会触发 TDZ 报错
 */
const isMobile = ref(window.innerWidth <= 767)
const mobileMenuOpen = ref(false)
/** 收起状态：整个侧栏隐藏，内容区全宽 */
const panelCollapsed = computed(() => sidebarCollapsed.value)

// ========== 我的视图（/view/list 异步，单例共享自 @/utils/view-store） ==========
const {
  viewGroups,
  ensureLoaded: fetchViewList,
  viewGroupKey,
  viewItemKey,
  buildViewRoute,
  findViewItem: __findViewItem,
} = useViewStore()
const viewSubmenuOpenKeys = ref<string[]>([])

// 我的视图「+」：新建视图 / 文件夹弹窗；文件夹悬停操作复用同一弹窗
const showCreateViewModal = ref(false)
const createViewAction = ref<'create' | 'createInGroup' | 'renameGroup' | 'editView'>('create')
const createViewTargetGroup = ref<ViewGroup | null>(null)
const createViewTargetView = ref<ViewItem | null>(null)

function openEditView(v: ViewItem) {
  createViewAction.value = 'editView'
  createViewTargetView.value = v
  showCreateViewModal.value = true
}

function confirmDeleteView(v: ViewItem) {
  Modal.confirm({
    title: `删除视图「${v.filterName}」？`,
    content: '删除后无法恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteView({ filterCode: v.filterCode })
        if (res?.success) {
          message.success('视图已删除')
          // 删除的是当前打开的视图：回到我的事项
          if (selectedViewKeys.value.includes(viewItemKey(v))) router.push('/workbench/todo')
          fetchViewList(true)
        } else {
          message.error(res?.message || '删除失败')
        }
      } catch {
        message.error('删除失败')
      }
    },
  })
}

function openCreateView() {
  createViewAction.value = 'create'
  createViewTargetGroup.value = null
  showCreateViewModal.value = true
}

function openCreateInGroup(group: ViewGroup) {
  createViewAction.value = 'createInGroup'
  createViewTargetGroup.value = group
  showCreateViewModal.value = true
}

function openRenameGroup(group: ViewGroup) {
  createViewAction.value = 'renameGroup'
  createViewTargetGroup.value = group
  showCreateViewModal.value = true
}

function confirmDeleteGroup(group: ViewGroup) {
  Modal.confirm({
    title: `删除文件夹「${group.groupName ?? ''}」？`,
    content: group.myViewList.length > 0 ? `文件夹内有 ${group.myViewList.length} 个视图，删除后无法恢复。` : '删除后无法恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteViewGroup({ groupCode: group.groupCode ?? '' })
        if (res?.success) {
          message.success('文件夹已删除')
          fetchViewList(true)
        } else {
          message.error(res?.message || '删除失败')
        }
      } catch {
        message.error('删除失败')
      }
    },
  })
}

/** 文件夹「更多」菜单：新建视图 / 编辑 / 删除 */
function onFolderAction(e: { key?: string | number }, group: ViewGroup) {
  const key = String(e?.key ?? '')
  if (key === 'create') openCreateInGroup(group)
  else if (key === 'edit') openRenameGroup(group)
  else if (key === 'delete') confirmDeleteGroup(group)
}

/** 视图「更多」菜单：编辑 / 删除 */
function onViewAction(e: { key?: string | number }, v: ViewItem) {
  const key = String(e?.key ?? '')
  if (key === 'edit') openEditView(v)
  else if (key === 'delete') confirmDeleteView(v)
}


/** 文件夹是否展开：切换打开/关闭图标，并驱动展开态样式 */
function isGroupOpen(group: ViewGroup): boolean {
  return viewSubmenuOpenKeys.value.includes(viewGroupKey(group))
}

/** 点击文件夹展开 / 收起（受控菜单必须同步 openKeys） */
function onViewOpenChange(keys: string[]) {
  viewSubmenuOpenKeys.value = keys
}

// 加载完后计算 sub-menu 默认展开的分组
function syncSubmenuOpenKeys() {  viewSubmenuOpenKeys.value = viewGroups.value
    .filter((g) => g.groupName)
    .map((g) => viewGroupKey(g))
}
watch(
  viewGroups,
  () => syncSubmenuOpenKeys(),
  { deep: true, immediate: true }
)

// 进入工作台路由时请求 /view/list（已加载过则走缓存）；其它路由不展示视图区，不请求
watch(
  () => route.path,
  (path, prev) => {
    if (isWorkbenchPath(path)) {
      fetchViewList()
      // 从其它模块（文档 / 空间 / 设置 / 事项详情等）进入工作台：补一次「我的事项」数量；
      // 工作台内部切页不重复请求（我的事项页查询后会自行更新数量）
      if (prev && !isWorkbenchPath(prev)) refreshTodoCount(todoUserNo.value)
    }
    // 手机端：点菜单跳页后自动收起抽屉
    if (isMobile.value && mobileMenuOpen.value) mobileMenuOpen.value = false
  },
  { immediate: true },
)

/** 侧栏菜单选中项：工作台布局只处理 /workbench/* */
const currentPath = computed(() => route.path)

function syncViewport() {
  const next = window.innerWidth <= 767
  if (next !== isMobile.value) {
    isMobile.value = next
    if (!next) mobileMenuOpen.value = false
  }
}

function toggleSidebar() {
  if (isMobile.value) {
    // 抽屉里要显示完整二级菜单，先确保侧栏是展开态
    if (!mobileMenuOpen.value) sidebarCollapsed.value = false
    mobileMenuOpen.value = !mobileMenuOpen.value
    return
  }
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
  } catch {
    // ignore
  }
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

/** 从 menu key 找到 ViewItem（key 形如 /workbench/view/CUSTOMxx?groupCode=...） */
function findViewItemByKey(key: string): ViewItem | null {
  const match = key.match(/\/workbench\/view\/([^/?#]+)/)
  if (!match) return null
  const code = decodeURIComponent(match[1])
  // 跳过内部占位路径（如 /workbench/view/group/__ungrouped__）
  if (code === 'group') return null
  return __findViewItem(code)
}

function handleLocalMenuClick(info: { key: string }) {
  const v = findViewItemByKey(info.key)
  if (v) {
    router.push(buildViewRoute(v))
  } else {
    router.push(info.key)
  }
}

/** 匹配当前选中视图项：路由 params.filterCode 或 query.filterCode 对应生成的菜单 key */
const selectedViewKeys = computed<string[]>(() => {
  const fromParams = route.params.filterCode as string | undefined
  const fromQuery = route.query.filterCode as string | undefined
  const code = fromParams || fromQuery
  const keys: string[] = [route.fullPath, route.path]
  if (code) {
    for (const g of viewGroups.value) {
      const v = g.myViewList.find((x) => x.filterCode === code)
      if (v) keys.push(viewItemKey(v))
    }
  }
  return keys
})

// ---------- 窄屏兼容：页面横向滚动时，fixed 的顶栏 / 侧栏跟随平移 ----------
function syncScrollX() {
  document.documentElement.style.setProperty('--app-scroll-x', `${window.scrollX}px`)
}
onMounted(() => {
  syncScrollX()
  window.addEventListener('scroll', syncScrollX, { passive: true })
  window.addEventListener('resize', syncScrollX)
  syncViewport()
  window.addEventListener('resize', syncViewport)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', syncScrollX)
  window.removeEventListener('resize', syncScrollX)
  window.removeEventListener('resize', syncViewport)
  document.documentElement.style.removeProperty('--app-scroll-x')
})
</script>

<style scoped>
.layout-container {
  height: 100%;
  min-width: var(--app-min-width);
  background: #fafafa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.sider {
  /* 侧栏灰底、内容区白底，靠色调分层（与云文档侧栏一致），交界处一条细线；
     工作台侧栏例外，见下方 .sider-workbench 的白底覆盖 */
  background: var(--docs-side-bg) !important;
  height: calc(100vh - var(--app-header-height, 56px));
  height: calc(100dvh - var(--app-header-height, 56px));
  position: fixed;
  left: 0;
  top: var(--app-header-height, 56px);
  bottom: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  border-right: 1px solid var(--docs-border);
  transform: translateX(calc(-1 * var(--app-scroll-x, 0px)));
}

/* 工作台侧栏：白底，与右侧内容区一致（设置 / 管理后台仍用灰底分层） */
.sider.sider-workbench {
  background: #ffffff !important;
}

.sider-inner {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  height: 100vh;
  height: 100dvh;
}


/* 右侧面板 */
.side-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
  padding-top: 18px;
}

/* 工作台顶部菜单：与设置 / 管理后台菜单保持同一上间距（间距统一由 side-panel 控制） */
.workspace-top-menu {
  padding-top: 0 !important;
}

.side-panel-collapsed {
  min-width: 48px;
  max-width: 48px;
  overflow: hidden;
}

.side-panel-collapsed :deep(.sidebar-menu) {
  padding: 4px 0 !important;
  width: 48px !important;
  min-width: 48px !important;
  border-right: none !important;
}

.side-panel-collapsed :deep(.ant-menu-item),
.side-panel-collapsed :deep(.ant-menu-submenu-title) {
  width: 48px !important;
  min-width: 48px !important;
  height: 40px !important;
  line-height: 40px !important;
  padding: 0 !important;
  margin: 2px 0 !important;
  border-radius: 6px;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
  white-space: nowrap !important;
}

/* 实际 DOM：ant-design-vue 4.2.6 把 icon 与文字都放在 .ant-menu-title-content 内（无 .ant-menu-item-icon 包装层） */
/* 1. .ant-menu-title-content 容器：保留并居中 */
.side-panel-collapsed :deep(.ant-menu-title-content) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 1 !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  gap: 0 !important;
}

/* 2. 普通 menu-item：保留直接 .anticon，隐藏其他直接子元素（文字 span 等） */
.side-panel-collapsed :deep(.ant-menu-title-content > .anticon) {
  font-size: 16px !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  color: inherit !important;
}

.side-panel-collapsed :deep(.ant-menu-title-content > .anticon svg) {
  display: inline-block !important;
  width: 1em !important;
  height: 1em !important;
  font-size: 16px !important;
}

.side-panel-collapsed :deep(.ant-menu-title-content > *:not(.anticon):not(.view-item-content):not(.child-item)) {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
}

/* 3. 嵌套容器 view-item-content / child-item：居中，只保留第一个 .anticon */
.side-panel-collapsed :deep(.ant-menu-title-content .view-item-content),
.side-panel-collapsed :deep(.ant-menu-title-content .child-item) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  margin: 0 !important;
  gap: 0 !important;
  flex-shrink: 0 !important;
  width: auto !important;
  height: auto !important;
}

.side-panel-collapsed :deep(.view-item-content > .anticon:first-child),
.side-panel-collapsed :deep(.child-item > .anticon:first-child) {
  font-size: 16px !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  color: inherit !important;
}

.side-panel-collapsed :deep(.view-item-content > .anticon:first-child svg),
.side-panel-collapsed :deep(.child-item > .anticon:first-child svg) {
  display: inline-block !important;
  width: 1em !important;
  height: 1em !important;
  font-size: 16px !important;
}

/* 4. 嵌套容器内：隐藏第一个 .anticon 之外的所有元素（文字 span、tag、装饰 icon） */
.side-panel-collapsed :deep(.view-item-content > *:not(.anticon)),
.side-panel-collapsed :deep(.child-item > *:not(:first-child)) {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
}

.side-panel-collapsed :deep(.ant-menu-item::after) {
  display: none !important;
}

.side-panel-collapsed :deep(.ant-menu-submenu-arrow) {
  display: none !important;
}

/* 我的视图：文件夹不显示右侧展开箭头，并收回为箭头预留的右侧空白 */
.sidebar-menu :deep(.ant-menu-submenu-arrow) {
  display: none;
}

.sidebar-menu :deep(.ant-menu-submenu > .ant-menu-submenu-title) {
  padding-inline-end: 12px;
}

.side-panel-collapsed :deep(.ant-menu-submenu-title::after) {
  display: none !important;
}

.side-panel-collapsed .panel-divider {
  display: none !important;
}

.side-panel-collapsed .panel-section-header {
  display: none !important;
}

/* 折叠状态下隐藏子菜单展开内容，只显示标题 icon */
.side-panel-collapsed :deep(.ant-menu-sub) {
  display: none !important;
}

.panel-section {
  padding: 8px 0;
}

.panel-section.scrollable {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.panel-section-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 8px;
}

.section-icon {
  font-size: 16px;
  color: #595959;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}

.section-header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.action-icon {
  font-size: 16px;
  color: #8c8c8c;
  cursor: pointer;
}

.action-icon:hover {
  color: var(--c-primary);
}

/* 文件夹 / 视图名称：按内容宽度、超长时收缩显示省略号，数量紧跟名称；标签、操作图标不被挤压 */
.name-ellipsis {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件夹文字区：名称 + 数量 + 标签紧跟在一起，整体占满中间空间，三点按钮靠右 */
.sidebar-menu :deep(.view-item-content > .folder-text) {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  margin-inline-start: 10px;
}

.name-count {
  flex-shrink: 0;
  margin-left: 2px;
  color: inherit;
}

.sidebar-menu :deep(.view-item-content),
.sidebar-menu :deep(.child-item) {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.sidebar-menu :deep(.view-item-content .anticon + .name-ellipsis),
.sidebar-menu :deep(.view-menu-item .anticon + .name-ellipsis) {
  margin-inline-start: 10px;
}

.sidebar-menu :deep(.child-item > .anticon),
.sidebar-menu :deep(.view-item-content > .anticon) {
  flex-shrink: 0;
}

/* 文件夹 / 视图悬停「更多」：默认透明，悬停时显示 */
.item-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-left: auto;
  flex-shrink: 0;
  font-size: 14px;
  color: #64748b;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.sidebar-menu :deep(.ant-menu-submenu-title:hover .item-more),
.sidebar-menu :deep(.view-menu-item:hover .item-more) {
  opacity: 1;
  pointer-events: auto;
}

.item-more:hover {
  color: #0f172a;
  background: rgba(15, 23, 42, 0.06);
}

/* 文件夹标题内容撑满，操作图标才能靠右（折叠态有 !important 规则覆盖） */
.sidebar-menu :deep(.ant-menu-submenu-title > .ant-menu-title-content) {
  display: flex;
  flex: 1;
  min-width: 0;
}

.sidebar-menu :deep(.view-menu-item > .ant-menu-title-content) {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.sidebar-menu :deep(.view-menu-item .view-name) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-menu :deep(.view-empty-item) {
  color: #bfbfbf !important;
  font-size: 12px;
  cursor: default;
}

.panel-divider {
  margin: 4px 16px !important;
}

.secondary-nav .sidebar-menu {
  padding: 8px 6px;
}

.sidebar-menu {
  border-right: none !important;
  background: transparent;
}

.sidebar-menu :deep(.ant-menu-item) {
  margin: 2px 8px;
  border-radius: 6px;
  height: 36px;
  line-height: 36px;
  color: #595959;
  font-size: 14px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 0px;
  position: relative;
  transition: all 0.15s ease;
}

.sidebar-menu :deep(.ant-menu-submenu-title) {
  height: 40px !important;
  line-height: 40px !important;
  font-size: 14px;
}

.sidebar-menu :deep(.ant-menu-item:hover),
.sidebar-menu :deep(.ant-menu-submenu-title:hover) {
  background: rgba(0, 0, 0, 0.05) !important;
  color: #262626;
}

.sidebar-menu :deep(.ant-menu-item-selected) {
  background: var(--c-primary-bg) !important;
  color: var(--c-primary) !important;
  font-weight: 500;
}

.sidebar-menu :deep(.ant-menu-item-selected::after) {
  display: none;
}

.sidebar-menu :deep(.ant-menu-item .anticon) {
  font-size: 16px;
  color: inherit;
}
.sidebar-menu :deep(.view-item-content > .anticon) {
  font-size: 16px;
}

.view-item-content {
  display: flex;
  align-items: center;
  gap: 0px;
  flex: 1;
  min-width: 0;
}

.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.view-tag {
  font-size: 11px;
  height: 18px;
  line-height: 16px;
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.view-tag.external {
  color: #52c41a;
  border-color: #b7eb8f;
  background: #f6ffed;
}

.view-tag.shared {
  color: var(--c-primary);
  border-color: #91d5ff;
  background: var(--c-primary-bg);
}

/* 子菜单项样式 */
.child-item {
  display: flex;
  align-items: center;
  gap: 0px;
  width: 100%;
}

.child-primary-icon {
  font-size: 14px;
  color: #8c8c8c;
  flex-shrink: 0;
}

.favorite-icon {
  color: #faad14 !important;
  font-size: 13px !important;
  margin-left: 2px;
}

.child-text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.child-more-icon {
  margin-left: auto;
  color: #bfbfbf !important;
  cursor: pointer;
  font-size: 14px !important;
}

.child-more-icon:hover {
  color: #595959 !important;
}

/* 子菜单缩进 */
.sidebar-menu :deep(.ant-menu-sub) {
  background: transparent !important;
}

.sidebar-menu :deep(.ant-menu-sub .ant-menu-item) {
  padding-left: 48px !important;
  height: 32px;
  line-height: 32px;
  margin: 1px 8px;
}

/* 文件夹展开态：不加深色背景，只让图标变主色 */
.view-menu :deep(.ant-menu-submenu-open > .ant-menu-submenu-title .folder-icon) {
  color: var(--c-primary);
}

/* 我的视图：文件夹 / 视图整体左移（覆盖 antd inline 缩进 24px / 48px），折叠态不受影响 */
.side-panel:not(.side-panel-collapsed) .view-menu :deep(.ant-menu-item),
.side-panel:not(.side-panel-collapsed) .view-menu :deep(.ant-menu-submenu-title) {
  padding-left: 12px !important;
}

.side-panel:not(.side-panel-collapsed) .view-menu :deep(.ant-menu-sub .ant-menu-item) {
  padding-left: 32px !important;
}

.main-layout {
  padding-top: var(--app-header-height, 56px);
  margin-left: var(--sider-w, 334px);
  min-height: 100vh;
  min-height: 100dvh;
  transition: margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-layout-collapsed {
  margin-left: 0;
}

.main-layout-full {
  margin-left: 0;
}

.content {
  /* 内容区不留白：工作台面板贴满顶栏以下的整个区域（无灰边、无圆角） */
  padding: 0;
  background: #f4f5f8;
  width: 100%;
  box-sizing: border-box;
}

/* ==========================================================================
   手机端（iPhone 17 / 17 Pro Max 基准，断点 767px）
   侧栏改为抽屉，内容区占满整宽
   ========================================================================== */
@media (max-width: 767px) {
  .layout-container {
    min-width: 0;
  }

  /* 抽屉：默认移出屏幕，打开时滑入 */
  .sider {
    width: min(334px, 86vw) !important;
    max-width: 86vw !important;
    min-width: 0 !important;
    flex: 0 0 auto !important;
    z-index: 210;
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: none;
  }

  .sider.sider-mobile-open {
    transform: translateX(0);
    box-shadow: 2px 0 16px rgba(0, 0, 0, 0.18);
  }

  .mobile-mask {
    position: fixed;
    inset: 0;
    z-index: 205;
    background: rgba(0, 0, 0, 0.35);
  }

  /* 内容区不再给侧栏让位 */
  .main-layout,
  .main-layout-collapsed,
  .main-layout-full {
    margin-left: 0 !important;
  }

  .sider-inner {
    height: 100%;
  }
}

</style>
