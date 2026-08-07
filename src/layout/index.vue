<template>
  <a-layout class="layout-container">
    <AppHeader
      :drawer-open="drawerOpen"
      :sidebar-collapsed="sidebarCollapsed"
      search-placeholder="搜索事项单号或者概要"
      @menu-click="handleMenuClick"
      @workspace-click="handleWorkspaceClick"
      @create-click="handleNewFormOpen"
      @search="handleHeaderSearch"
      @toggle-sidebar="toggleSidebar"
    />

    <AppSideDrawer
      :open="drawerOpen"
      @close="drawerOpen = false"
      @menu-click="handleRemoteMenuClick"
    />

    <a-layout-sider :width="sidebarCollapsed ? 112 : 280" class="sider" :trigger="null">
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
        <div v-if="!isIssueDetailRoute" class="side-panel" :class="{ 'side-panel-collapsed': sidebarCollapsed }">
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
                  <component :is="PlusOutlined" class="action-icon" />
                </div>
              </div>
              <a-menu
                theme="light"
                mode="inline"
                :selectedKeys="['/view/folder1/item3']"
                :openKeys="sidebarCollapsed ? [] : ['/view/folder1']"
                @click="handleLocalMenuClick"
                class="sidebar-menu"
              >
                <!-- 产品需求 (可展开) -->
                <a-sub-menu key="/view/folder1">
                  <template #title>
                    <span class="view-item-content">
                      <component :is="FolderOutlined" />
                      <span>产品需求 (12)</span>
                      <a-tag class="view-tag external">外</a-tag>
                    </span>
                  </template>
                  <a-menu-item key="/view/testing-calendar">
                    <span class="child-item">
                      <component :is="ExperimentOutlined" class="child-primary-icon" />
                      <span>测试平台需求</span>
                      <component :is="StarFilled" class="favorite-icon" />
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/member-gantt">
                    <span class="child-item">
                      <component :is="CrownOutlined" class="child-primary-icon" />
                      <span>会员体系优化</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item3">
                    <span class="child-item">
                      <component :is="ShopOutlined" class="child-primary-icon" />
                      <span>商城改版</span>
                      <component :is="MoreOutlined" class="child-more-icon" />
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item4">
                    <span class="child-item">
                      <component :is="RocketOutlined" class="child-primary-icon" />
                      <span>日常功能迭代</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item5">
                    <span class="child-item">
                      <component :is="GiftOutlined" class="child-primary-icon" />
                      <span class="child-text-truncate">88VIP会员工具需...</span>
                    </span>
                  </a-menu-item>
                </a-sub-menu>

                <!-- 独立视图项 -->
                <a-menu-item key="/view/sprint-board">
                  <component :is="AppstoreOutlined" />
                  <span>Sprint 看板</span>
                </a-menu-item>
                <a-menu-item key="/view/bug-list">
                  <component :is="UnorderedListOutlined" />
                  <span>待修复 Bug (3)</span>
                </a-menu-item>
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
            <div v-if="!sidebarCollapsed" class="panel-section-header">
              <component :is="SettingOutlined" class="section-icon" />
              <span class="section-title">设置</span>
            </div>
            <a-menu
              theme="light"
              mode="inline"
              :selectedKeys="[currentPath]"

              @click="handleLocalMenuClick"
              class="sidebar-menu"
            >
              <a-sub-menu key="template-config">
                <template #title>
                  <component :is="AppstoreOutlined" />
                  <span>模板配置</span>
                </template>
                <a-menu-item key="/settings/template-list">
                  <component :is="UnorderedListOutlined" />
                  <span>模板列表</span>
                </a-menu-item>
                <a-menu-item key="/settings/form-list">
                  <component :is="TableOutlined" />
                  <span>表单列表</span>
                </a-menu-item>
                <a-menu-item key="/settings/component-list">
                  <component :is="AppstoreOutlined" />
                  <span>组件列表</span>
                </a-menu-item>
              </a-sub-menu>
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
        </div>
      </div>
    </a-layout-sider>
    <a-layout class="main-layout" :class="{ 'main-layout-collapsed': sidebarCollapsed && !isIssueDetailRoute, 'main-layout-full': isIssueDetailRoute }">
      <a-layout-content class="content">
        <WorkbenchPanel />
      </a-layout-content>
    </a-layout>

    <!-- 登录态过期弹窗 -->
    <a-modal
      v-model:open="showLoginExpiredModal"
      :closable="true"
      :mask-closable="false"
      :keyboard="false"
      width="400px"
      :style="{ top: '15%' }"
      @cancel="handleRelogin"
    >
      <div class="login-expired-modal">
        <InfoCircleOutlined class="login-expired-icon" />
        <span class="login-expired-text">登录态已过期，请重新登录</span>
      </div>
      <template #footer>
        <a-button type="primary" @click="handleRelogin">重新登录</a-button>
      </template>
    </a-modal>

    <!-- 新建弹窗：抽离为独立组件 -->
    <NewIssueFormModal v-model:open="showNewFormModal" @submitted="() => {}" />
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
  UserOutlined,
  TableOutlined,
  InfoCircleOutlined,
  ExperimentOutlined,
  CrownOutlined,
  ShopOutlined,
  RocketOutlined,
  GiftOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSideDrawer from '@/components/AppSideDrawer.vue'
import NewIssueFormModal from '@/components/NewIssueFormModal.vue'
import WorkbenchPanel from './WorkbenchPanel.vue'
import { useAuth } from '@/utils/auth'

const iconBarItems = [
  { key: 'workspace', icon: HomeOutlined, label: '工作台' },
  { key: 'settings', icon: SettingOutlined, label: '设置' },
]

const router = useRouter()
const route = useRoute()
const { isLoggedIn, refresh: refreshAuth } = useAuth()

const drawerOpen = ref(false)
const sidebarCollapsed = ref(false)
const activeSection = ref('workspace')
const isIssueDetailRoute = computed(() => route.path.startsWith('/jira/browse/'))

// 登录态过期弹窗
const showLoginExpiredModal = ref(false)

// 新建表单弹窗
const showNewFormModal = ref(false)

function handleNewFormOpen() {
  showNewFormModal.value = true
}

watch(isLoggedIn, (loggedIn) => {
  showLoginExpiredModal.value = !loggedIn
}, { immediate: true })

onMounted(() => {
  refreshAuth()
  showLoginExpiredModal.value = !isLoggedIn.value
})

function handleRelogin() {
  const loginUrl = import.meta.env.VITE_ACCOUNT_URL + '?oauth_callback=' + encodeURIComponent(window.location.href)
  window.location.href = loginUrl
}

const currentPath = computed(() => {
  if (route.path.startsWith('/users') || route.path.startsWith('/roles') || route.path.startsWith('/permissions') || route.path.startsWith('/departments')) {
    activeSection.value = 'system'
    return route.path
  }
  if (route.path.startsWith('/settings')) {
    activeSection.value = 'settings'
    return route.path
  }
  return route.path
})

function handleSectionClick(key: string) {
  activeSection.value = key
  if (key === 'workspace') {
    router.push('/workbench/todo')
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

function handleLocalMenuClick(info: { key: string }) {
  router.push(info.key)
}
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
  gap: 8px;
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
  gap: 6px;
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
  gap: 6px;
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
  margin-left: -4px;
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

/* 登录态过期弹窗 */
.login-expired-modal {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}

.login-expired-icon {
  font-size: 28px;
  color: #faad14;
  flex-shrink: 0;
}

.login-expired-text {
  color: #0f172a;
  font-size: 14px;
  line-height: 1.6;
}
</style>
