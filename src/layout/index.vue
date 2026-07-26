<template>
  <a-layout class="layout-container">
    <HeaderReact
      mode="cooperise"
      :drawer-open="drawerOpen"
      :on-menu-click="handleMenuClick"
      :on-workspace-click="handleWorkspaceClick"
      :on-search="handleHeaderSearch"
    />

    <SideDrawerReact
      :open="drawerOpen"
      menu-path="/cooperise"
      menu-key="cooperise"
      :force-open="true"
      :get-container="false"
      @close="drawerOpen = false"
      @menu-click="handleRemoteMenuClick"
    />

    <a-layout-sider :width="280" class="sider" :collapsed="false">
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
        <div class="side-panel">
          <template v-if="activeSection === 'workspace'">
            <!-- 筛选器区域 -->
            <div class="panel-section">
              <div class="panel-section-header">
                <component :is="FilterOutlined" class="section-icon" />
                <span class="section-title">新筛选器</span>
              </div>
              <a-menu
                theme="light"
                mode="inline"
                :selectedKeys="[currentPath]"
                @click="handleLocalMenuClick"
                class="sidebar-menu"
              >
                <a-menu-item key="/my-items">
                  <component :is="CheckSquareOutlined" />
                  <span>我的事项 (2)</span>
                </a-menu-item>
                <a-menu-item key="/my-done">
                  <component :is="CheckCircleOutlined" />
                  <span>我的已办</span>
                </a-menu-item>
                <a-menu-item key="/my-created">
                  <component :is="UserOutlined" />
                  <span>我的创建</span>
                </a-menu-item>
                <a-menu-item key="/recently-viewed">
                  <component :is="EyeOutlined" />
                  <span>最近查看</span>
                </a-menu-item>
                <a-menu-item key="/my-watched">
                  <component :is="StarOutlined" />
                  <span>我关注的</span>
                </a-menu-item>
              </a-menu>
            </div>

            <a-divider class="panel-divider" />

            <!-- 视图区域 -->
            <div class="panel-section scrollable">
              <div class="panel-section-header">
                <span class="section-title">我的视图</span>
                <div class="section-header-actions">
                  <component :is="SearchOutlined" class="action-icon" />
                  <component :is="PlusOutlined" class="action-icon" />
                </div>
              </div>
              <a-menu
                theme="light"
                mode="inline"
                :selectedKeys="['/view/folder1/item6']"
                :openKeys="['/view/folder1']"
                @click="handleLocalMenuClick"
                class="sidebar-menu"
              >
                <!-- 高购需求看板 (可展开) -->
                <a-sub-menu key="/view/folder1">
                  <template #title>
                    <span class="view-item-content">
                      <component :is="FolderOutlined" />
                      <span>高购需求看板 (8)</span>
                      <a-tag class="view-tag external">外</a-tag>
                    </span>
                  </template>
                  <a-menu-item key="/view/folder1/item1">
                    <span class="child-item">
                      <span>高购需求看板</span>
                      <component :is="StarFilled" class="favorite-icon" />
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item2">
                    <span class="child-item">
                      <span>养狗需求看板</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item3">
                    <span class="child-item">
                      <span class="child-text-truncate">高购营销工具需...</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item4">
                    <span class="child-item">
                      <span>会员需求看板</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item5">
                    <span class="child-item">
                      <span>超省卡需求看板</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item6">
                    <span class="child-item">
                      <span>积分需求看板</span>
                      <component :is="MoreOutlined" class="child-more-icon" />
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item7">
                    <span class="child-item">
                      <span>签到需求看板</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item8">
                    <span class="child-item">
                      <span>UOES需求看板</span>
                    </span>
                  </a-menu-item>
                </a-sub-menu>

                <!-- 独立视图项 -->
                <a-menu-item key="/view/my-tasks-board">
                  <component :is="AppstoreOutlined" />
                  <span>我的任务看板</span>
                </a-menu-item>
                <a-menu-item key="/view/gantt">
                  <component :is="AlignLeftOutlined" />
                  <span>我的待办甘特图</span>
                </a-menu-item>
                <a-menu-item key="/view/bugs">
                  <component :is="UnorderedListOutlined" />
                  <span>本周的bug</span>
                </a-menu-item>
                <a-menu-item key="/view/release">
                  <component :is="CalendarOutlined" />
                  <span class="view-item-content">
                    <span>用户运营测试1...</span>
                    <a-tag class="view-tag shared">享</a-tag>
                  </span>
                </a-menu-item>
              </a-menu>
            </div>
          </template>

          <template v-else-if="activeSection === 'system'">
            <div class="panel-section">
              <div class="panel-section-header">
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
            </div>
          </template>

          <template v-else-if="activeSection === 'settings'">
            <div class="panel-section">
              <div class="panel-section-header">
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
                <a-menu-item key="/settings/profile">
                  <component :is="UserOutlined" />
                  <span>个人中心</span>
                </a-menu-item>
                <a-menu-item key="/settings/account">
                  <component :is="LockOutlined" />
                  <span>账户设置</span>
                </a-menu-item>
              </a-menu>
            </div>
          </template>
        </div>
      </div>
    </a-layout-sider>
    <a-layout class="main-layout">
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  HomeOutlined,
  CalendarOutlined,
  SettingOutlined,
  FilterOutlined,
  CheckSquareOutlined,
  CheckCircleOutlined,
  UserOutlined,
  EyeOutlined,
  StarOutlined,
  SearchOutlined,
  PlusOutlined,
  FolderOutlined,
  StarFilled,
  AppstoreOutlined,
  AlignLeftOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  TeamOutlined,
  LockOutlined,
  BuildOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import HeaderReact from '@/components/HeaderReact.vue'
import SideDrawerReact from '@/components/SideDrawerReact.vue'

const iconBarItems = [
  { key: 'workspace', icon: HomeOutlined, label: '工作台' },
  { key: 'settings', icon: SettingOutlined, label: '设置' },
]

const router = useRouter()
const route = useRoute()

const drawerOpen = ref(false)
const activeSection = ref('workspace')

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
}

function handleMenuClick() {
  drawerOpen.value = !drawerOpen.value
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
  height: calc(100vh - 65px);
  position: fixed;
  left: 0;
  top: 65px;
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
  padding-top: 65px;
  margin-left: 280px;
  min-height: 100vh;
  transition: margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.content {
  padding: 24px;
  background: #fafafa;
}

.content > :deep(*) {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
