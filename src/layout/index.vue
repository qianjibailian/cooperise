<template>
  <a-layout class="layout-container">
    <AppHeader
      :drawer-open="drawerOpen"
      :sidebar-collapsed="sidebarCollapsed"
      :hide-sidebar-toggle="isNonWorkbenchRoute"
      search-placeholder="搜索事项单号或者概要"
      @menu-click="handleMenuClick"
      @workspace-click="handleWorkspaceClick"
      @create-click="handleNewFormOpen"
      @search="handleHeaderSearch"
      @toggle-sidebar="toggleSidebar"
    />

    <AppSideDrawer
      v-if="drawerOpen"
      :open="drawerOpen"
      @close="drawerOpen = false"
      @menu-click="handleRemoteMenuClick"
    />

    <a-layout-sider :width="isNonWorkbenchRoute ? 64 : (sidebarCollapsed ? 112 : 280)" class="sider" :trigger="null">
      <div class="sider-inner">
        <!-- 左侧图标栏 -->
        <div class="icon-bar">
          <div
            v-for="item in iconBarItems"
            :key="item.key"
            class="icon-bar-item"
            :class="{ active: activeSection === item.key }"
            @click="handleSectionClick(item.key)"
          >
            <component :is="item.icon" class="icon-bar-icon" />
            <span class="icon-bar-label">{{ item.label }}</span>
          </div>
        </div>

        <!-- 右侧面板 -->
        <div v-if="!isNonWorkbenchRoute" class="side-panel" :class="{ 'side-panel-collapsed': sidebarCollapsed }">
          <template v-if="activeSection === 'workspace'">
            <a-menu
              theme="light"
              mode="inline"
              :selectedKeys="[currentPath]"

              @click="handleLocalMenuClick"
              class="sidebar-menu"
            >
              <a-menu-item key="/workbench/filters">
                <component :is="FilterOutlined" />
                <span>新筛选器</span>
              </a-menu-item>
              <a-menu-item key="/workbench/todo">
                <component :is="CheckSquareOutlined" />
                <span>我的事项 (2)</span>
              </a-menu-item>
            </a-menu>

            <a-divider v-if="!sidebarCollapsed" class="panel-divider" />

            <!-- 视图区域 -->
            <div class="panel-section scrollable" :class="{ 'panel-section-collapsed': sidebarCollapsed }">
              <div v-if="!sidebarCollapsed" class="panel-section-header">
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
                :openKeys="sidebarCollapsed ? [] : viewSubmenuOpenKeys"
                @click="handleLocalMenuClick"
                class="sidebar-menu"
              >
                <template v-for="(group, gIdx) in viewGroups" :key="`g-${gIdx}`">
                  <!-- 有 groupName → 可展开 sub-menu -->
                  <a-sub-menu v-if="group.groupName" :key="viewGroupKey(group)">
                    <template #title>
                      <span class="view-item-content">
                        <component :is="FolderOutlined" />
                        <span>
                          {{ group.groupName }}
                          <template v-if="typeof group.count === 'number'">({{ group.count }})</template>
                        </span>
                        <a-tag v-if="group.share" class="view-tag external">外</a-tag>
                        <!-- 悬停文件夹时显示：新建视图 / 编辑 / 删除 -->
                        <span class="folder-actions" @click.stop>
                          <component :is="PlusOutlined" class="folder-action-icon" title="新建视图" @click.stop="openCreateInGroup(group)" />
                          <component :is="EditOutlined" class="folder-action-icon" title="编辑" @click.stop="openRenameGroup(group)" />
                          <component :is="DeleteOutlined" class="folder-action-icon danger" title="删除" @click.stop="confirmDeleteGroup(group)" />
                        </span>
                      </span>
                    </template>
                    <a-menu-item
                      v-for="v in group.myViewList"
                      :key="viewItemKey(v)"
                      :data-menu-id="viewItemKey(v)"
                      class="view-menu-item"
                    >
                      <span class="child-item">
                        <component :is="viewItemIcon(v)" class="child-primary-icon" />
                        <span class="child-text-truncate">{{ truncateViewName(v.filterName, 18) }}</span>
                        <component v-if="v.isCollect" :is="StarFilled" class="favorite-icon" />
                        <component v-if="v.isShare && v.sortId <= 1" :is="MoreOutlined" class="child-more-icon" />
                        <!-- 悬停视图时显示：编辑 / 删除 -->
                        <span class="view-actions" @click.stop>
                          <component :is="EditOutlined" class="folder-action-icon" title="编辑" @click.stop="openEditView(v)" />
                          <component :is="DeleteOutlined" class="folder-action-icon danger" title="删除" @click.stop="confirmDeleteView(v)" />
                        </span>
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
                    <component :is="viewItemIcon(v)" />
                    <span class="view-name">
                      {{ truncateViewName(v.filterName, 14) }}
                      <template v-if="typeof v.myTodoTotalCount === 'number'">({{ v.myTodoTotalCount }})</template>
                    </span>
                    <span class="view-actions" @click.stop>
                      <component :is="EditOutlined" class="folder-action-icon" title="编辑" @click.stop="openEditView(v)" />
                      <component :is="DeleteOutlined" class="folder-action-icon danger" title="删除" @click.stop="confirmDeleteView(v)" />
                    </span>
                    </a-menu-item>
                  </template>
                </template>
              </a-menu>
            </div>
          </template>

          <template v-else-if="activeSection === 'system'">
            <div v-if="!sidebarCollapsed" class="panel-section-header">
              <component :is="SettingOutlined" class="section-icon" />
              <span class="section-title">系统管理</span>
            </div>
            <a-menu
              theme="light"
              mode="inline"
              :selectedKeys="[currentPath]"

              @click="handleLocalMenuClick"
              class="sidebar-menu"
            >
              <a-menu-item key="/users">
                <component :is="UserOutlined" />
                <span>用户管理</span>
              </a-menu-item>
              <a-menu-item key="/roles">
                <component :is="TeamOutlined" />
                <span>角色管理</span>
              </a-menu-item>
              <a-menu-item key="/permissions">
                <component :is="LockOutlined" />
                <span>权限管理</span>
              </a-menu-item>
              <a-menu-item key="/departments">
                <component :is="BuildOutlined" />
                <span>部门管理</span>
              </a-menu-item>
            </a-menu>
          </template>

          <template v-else-if="activeSection === 'settings'">
            <a-menu
              theme="light"
              mode="inline"
              :selectedKeys="[currentPath]"
              @click="handleLocalMenuClick"
              class="sidebar-menu"
            >
              <a-menu-item key="/settings/template-list">
                <component :is="UnorderedListOutlined" />
                <span>模板管理</span>
              </a-menu-item>
              <a-menu-item key="/settings/available-field">
                <component :is="AppstoreOutlined" />
                <span>自定义字段</span>
              </a-menu-item>
              <a-menu-item key="/settings/workflow">
                <component :is="DeploymentUnitOutlined" />
                <span>工作流</span>
              </a-menu-item>
              <a-menu-item key="/settings/profile">
                <component :is="UserOutlined" />
                <span>个人中心</span>
              </a-menu-item>
              <a-menu-item key="/settings/account">
                <component :is="LockOutlined" />
                <span>账户设置</span>
              </a-menu-item>
            </a-menu>
          </template>

          <template v-else-if="activeSection === 'admin'">
            <a-menu
              theme="light"
              mode="inline"
              :selectedKeys="[currentPath]"
              @click="handleLocalMenuClick"
              class="sidebar-menu"
            >
              <a-menu-item key="/admin/system-field">
                <component :is="AppstoreOutlined" />
                <span>系统字段</span>
              </a-menu-item>
            </a-menu>
          </template>
        </div>
      </div>
    </a-layout-sider>
    <a-layout class="main-layout" :class="{ 'main-layout-collapsed': sidebarCollapsed && !isNonWorkbenchRoute, 'main-layout-full': isNonWorkbenchRoute }">
      <a-layout-content class="content">
        <WorkbenchPanel />
      </a-layout-content>
    </a-layout>

    <!-- 新建弹窗：抽离为独立组件 -->
    <NewIssueFormModal v-model:open="showNewFormModal" @submitted="() => {}" />

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
import { ref, computed, watch } from 'vue'
import {
  HomeOutlined,
  SettingOutlined,
  FilterOutlined,
  CheckSquareOutlined,
  SearchOutlined,
  PlusOutlined,
  FolderOutlined,
  StarFilled,
  AppstoreOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  TeamOutlined,
  LockOutlined,
  BuildOutlined,
  DeploymentUnitOutlined,
  UserOutlined,
  ProjectOutlined,
  AlignLeftOutlined,
  CalendarOutlined,
  ToolOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSideDrawer from '@/components/AppSideDrawer.vue'
import NewIssueFormModal from '@/components/NewIssueFormModal.vue'
import CreateViewModal from '@/components/CreateViewModal.vue'
import WorkbenchPanel from './WorkbenchPanel.vue'
import { useViewStore } from '@/utils/view-store'
import type { ViewItem, ViewGroup } from '@/types/faiz'
import { Modal, message } from 'ant-design-vue'
import { deleteViewGroup, deleteView } from '@/api/faiz'

const iconBarItems = [
  { key: 'workspace', icon: HomeOutlined, label: '工作台' },
  { key: 'settings', icon: SettingOutlined, label: '设置' },
  { key: 'admin', icon: ToolOutlined, label: '管理后台' },
]

const router = useRouter()
const route = useRoute()

const drawerOpen = ref(false)
const sidebarCollapsed = ref(false)
const activeSection = ref('workspace')
// 设置路由与工作台路由同样展示侧边栏（含二级菜单），仅其余路由（如事项详情）隐藏侧边面板
const isNonWorkbenchRoute = computed(() => {
  const path = route.path
  if (path.startsWith('/settings') || path.startsWith('/admin')) return false
  return !path.startsWith('/workbench')
})

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

/** viewType → 默认图标组件（找不到更特殊映射时使用） */
const VIEW_TYPE_ICON_MAP: Record<string, unknown> = {
  list: UnorderedListOutlined,
  KAN_BAN: ProjectOutlined,
  gantt: AlignLeftOutlined,
  CALENDAR_VIEW: CalendarOutlined,
}

/** 取单个视图项的图标（按 viewType 统一映射） */
function viewItemIcon(v: ViewItem) {
  return VIEW_TYPE_ICON_MAP[v.viewType] ?? AppstoreOutlined
}

/** 视图项名称截断：折叠态场景下保留的处理 */
function truncateViewName(name: string, max = 16) {
  return name.length > max ? name.slice(0, max - 3) + '...' : name
}

// 加载完后计算 sub-menu 默认展开的分组
function syncSubmenuOpenKeys() {
  viewSubmenuOpenKeys.value = viewGroups.value
    .filter((g) => g.groupName)
    .map((g) => viewGroupKey(g))
}
watch(
  viewGroups,
  () => syncSubmenuOpenKeys(),
  { deep: true, immediate: true }
)

// 新建表单弹窗
const showNewFormModal = ref(false)

function handleNewFormOpen() {
  showNewFormModal.value = true
}

// 进入工作台路由时请求 /view/list（已加载过则走缓存）；其它路由不展示视图区，不请求
watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/workbench')) fetchViewList()
  },
  { immediate: true },
)

const currentPath = computed(() => {
  if (route.path.startsWith('/users') || route.path.startsWith('/roles') || route.path.startsWith('/permissions') || route.path.startsWith('/departments')) {
    activeSection.value = 'system'
    return route.path
  }
  if (route.path.startsWith('/settings')) {
    activeSection.value = 'settings'
    return route.path
  }
  if (route.path.startsWith('/admin')) {
    activeSection.value = 'admin'
    return route.path
  }
  return route.path
})

function handleSectionClick(key: string) {
  activeSection.value = key
  if (key === 'workspace') {
    router.push('/workbench/todo')
  } else if (key === 'settings') {
    router.push('/settings/template-list')
  } else if (key === 'admin') {
    router.push('/admin/system-field')
  }
}

function handleMenuClick() {
  drawerOpen.value = !drawerOpen.value
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function handleWorkspaceClick() {
  router.push('/dashboard')
}

function handleHeaderSearch(value: string) {
  if (value) router.push(value)
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

function handleRemoteMenuClick(key: string) {
  let path = key
  if (path.startsWith('/cooperise')) {
    path = path.replace(/^\/cooperise/, '') || '/dashboard'
  }
  router.push(path)
}
</script>

<style scoped>
.layout-container {
  height: 100%;
  background: #fafafa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.sider {
  background: #ffffff !important;
  height: calc(100vh - 56px);
  position: fixed;
  left: 0;
  top: 56px;
  bottom: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.04);
}

.sider-inner {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  height: 100vh;
}

/* 左侧图标栏 */
.icon-bar {
  width: 64px;
  min-width: 64px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  border-right: 1px solid #e8e8e8;
  height: 100%;
}

.icon-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 64px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.15s ease;
}

.icon-bar-item:hover {
  background: rgba(0, 0, 0, 0.06);
}

.icon-bar-item.active {
  background: #e6f7ff;
}

.icon-bar-item.active .icon-bar-icon {
  color: #1890ff;
}

.icon-bar-item.active .icon-bar-label {
  color: #1890ff;
}

.icon-bar-icon {
  font-size: 20px;
  color: #595959;
  margin-bottom: 2px;
}

.icon-bar-label {
  font-size: 11px;
  color: #595959;
  line-height: 1.2;
}

/* 右侧面板 */
.side-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
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
  color: #1890ff;
}

/* 文件夹悬停操作：默认隐藏，悬停文件夹标题时显示 */
.folder-actions {
  display: none;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding-left: 8px;
  flex-shrink: 0;
}

/* 文件夹标题内容撑满，操作图标才能靠右（折叠态有 !important 规则覆盖） */
.sidebar-menu :deep(.ant-menu-submenu-title > .ant-menu-title-content) {
  display: flex;
  flex: 1;
  min-width: 0;
}

.sidebar-menu :deep(.ant-menu-submenu-title:hover .folder-actions) {
  display: inline-flex;
}

/* 视图悬停操作：与文件夹一致，默认隐藏，悬停视图项时显示 */
.view-actions {
  display: none;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding-left: 8px;
  flex-shrink: 0;
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

.sidebar-menu :deep(.view-menu-item:hover .view-actions) {
  display: inline-flex;
}

/* 悬停操作按钮：Apple / Material 风格的圆角小按钮，悬停浅底高亮 */
.folder-actions,
.view-actions {
  gap: 2px;
  padding-left: 6px;
  animation: hover-actions-fade-in 0.15s ease-out;
}

@keyframes hover-actions-fade-in {
  from { opacity: 0; transform: translateX(2px); }
  to { opacity: 1; transform: translateX(0); }
}

.sidebar-menu :deep(.folder-action-icon.anticon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  min-width: 22px;
  /* 覆盖 antd 菜单 `.anticon + span` 的 10px 左间距，保证三个按钮间距一致 */
  margin: 0 !important;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.sidebar-menu :deep(.folder-action-icon.anticon:hover) {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.sidebar-menu :deep(.folder-action-icon.anticon:active) {
  background: rgba(15, 23, 42, 0.1);
}

.sidebar-menu :deep(.folder-action-icon.anticon.danger) {
  color: #ef4444;
}

.sidebar-menu :deep(.folder-action-icon.anticon.danger:hover) {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
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
}

.sidebar-menu :deep(.ant-menu-item) {
  margin: 2px 8px;
  border-radius: 6px;
  height: 36px;
  line-height: 36px;
  color: #595959;
  font-size: 13px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 0px;
  position: relative;
  transition: all 0.15s ease;
}

.sidebar-menu :deep(.ant-menu-item:hover) {
  background: #f5f5f5 !important;
  color: #262626;
}

.sidebar-menu :deep(.ant-menu-item-selected) {
  background: #e6f7ff !important;
  color: #1890ff !important;
  font-weight: 500;
}

.sidebar-menu :deep(.ant-menu-item-selected::after) {
  display: none;
}

.sidebar-menu :deep(.ant-menu-item .anticon) {
  font-size: 16px;
  color: inherit;
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
  color: #1890ff;
  border-color: #91d5ff;
  background: #e6f7ff;
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

.main-layout {
  padding-top: 56px;
  margin-left: 280px;
  min-height: 100vh;
  transition: margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-layout-collapsed {
  margin-left: 112px;
}

.main-layout-full {
  margin-left: 64px;
}

.content {
  padding: 8px;
  background: #f4f5f8;
  width: 100%;
  box-sizing: border-box;
}

.content > :deep(*) {
  width: 100%;
}

</style>
