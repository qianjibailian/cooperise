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

    <a-layout-sider v-model:collapsed="collapsed" :width="220" class="sider">
      <div class="logo-wrapper">
        <div class="logo">
          <span v-if="!collapsed" class="logo-text">需求管控平台</span>
        </div>
      </div>
      <a-menu
        :theme="'light'"
        :mode="'inline'"
        :selectedKeys="[currentPath]"
        @click="handleLocalMenuClick"
        class="sidebar-menu"
      >
        <a-menu-item key="/dashboard">
          <component :is="DashboardOutlined" />
          <span>仪表盘</span>
        </a-menu-item>
        <a-sub-menu key="requirements">
          <template #title>
            <span>
              <component :is="FileTextOutlined" />
              <span>需求管理</span>
            </span>
          </template>
          <a-menu-item key="/requirements">需求列表</a-menu-item>
          <a-menu-item key="/requirements/create">创建需求</a-menu-item>
        </a-sub-menu>
        <a-sub-menu key="tasks">
          <template #title>
            <span>
              <component :is="CheckSquareOutlined" />
              <span>任务管理</span>
            </span>
          </template>
          <a-menu-item key="/tasks">任务列表</a-menu-item>
          <a-menu-item key="/tasks/kanban">看板视图</a-menu-item>
        </a-sub-menu>
        <a-menu-divider />
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
      <div class="sidebar-footer">
        <a-dropdown>
          <div class="user-profile">
            <a-avatar :size="32" class="user-avatar">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" alt="avatar" />
            </a-avatar>
            <span v-if="!collapsed" class="user-name">管理员</span>
            <component :is="DownOutlined" class="dropdown-icon" />
          </div>
          <template #overlay>
            <a-menu>
              <a-menu-item key="profile">
                <component :is="UserOutlined" />
                个人中心
              </a-menu-item>
              <a-menu-item key="settings">
                <component :is="SettingOutlined" />
                账户设置
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="logout">
                <component :is="LogoutOutlined" />
                退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <button class="collapse-btn" @click="collapsed = !collapsed">
          <component :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined" />
        </button>
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
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  LockOutlined,
  BuildOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DownOutlined,
  SettingOutlined,
  LogoutOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import HeaderReact from '@/components/HeaderReact.vue'
import SideDrawerReact from '@/components/SideDrawerReact.vue'

const router = useRouter()
const route = useRoute()

const drawerOpen = ref(false)
const collapsed = ref(false)

const currentPath = computed(() => {
  if (route.path.startsWith('/requirements')) return '/requirements'
  if (route.path.startsWith('/tasks')) return '/tasks'
  return route.path
})

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
  if (info.key === 'requirements' || info.key === 'tasks') return
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
  height: 100vh;
  position: fixed;
  left: 0;
  top: 65px;
  bottom: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.04);
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.logo-wrapper {
  padding: 16px 16px 12px;
  display: flex;
  justify-content: center;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.3px;
}

.collapse-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #646464;
  font-size: 16px;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.collapse-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
}

.sidebar-menu {
  border-right: none !important;
  padding: 8px 6px;
  flex: 1;
  overflow-y: auto;
}

.sidebar-menu :deep(.ant-menu-item) {
  margin: 3px 4px;
  border-radius: 8px;
  height: 38px;
  line-height: 38px;
  color: #646464;
  font-size: 13.5px;
  font-weight: 400;
  position: relative;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-menu :deep(.ant-menu-item:hover) {
  background: rgba(0, 0, 0, 0.04) !important;
  color: #1d1d1f;
}

.sidebar-menu :deep(.ant-menu-item-selected) {
  background: rgba(59, 130, 246, 0.08) !important;
  color: #3b82f6 !important;
  font-weight: 500;
}

.sidebar-menu :deep(.ant-menu-item-selected)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: #3b82f6;
  border-radius: 0 3px 3px 0;
}

.sidebar-menu :deep(.ant-menu-item-selected::after) {
  display: none;
}

.sidebar-menu :deep(.ant-menu-submenu-title) {
  margin: 3px 4px;
  border-radius: 8px;
  height: 38px;
  line-height: 38px;
  color: #646464;
  font-size: 13.5px;
  font-weight: 400;
  position: relative;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-menu :deep(.ant-menu-submenu-title:hover) {
  background: rgba(0, 0, 0, 0.04) !important;
  color: #1d1d1f;
}

.sidebar-menu :deep(.ant-menu-submenu-title.ant-menu-submenu-selected) {
  background: rgba(59, 130, 246, 0.08) !important;
  color: #3b82f6 !important;
  font-weight: 500;
}

.sidebar-menu :deep(.ant-menu-submenu-title.ant-menu-submenu-selected)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: #3b82f6;
  border-radius: 0 3px 3px 0;
}

.sidebar-menu :deep(.ant-menu-divider) {
  margin: 8px 8px;
  border-color: rgba(0, 0, 0, 0.04);
}

.sidebar-footer {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.user-profile:hover {
  background: rgba(0, 0, 0, 0.04);
}

.user-name {
  font-size: 13.5px;
  font-weight: 500;
  color: #1d1d1f;
}

.dropdown-icon {
  color: #9ca3af;
  font-size: 12px;
}

.main-layout {
  padding-top: 65px;
  margin-left: 220px;
  min-height: 100vh;
  transition: margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.layout-container :deep(.ant-layout-sider-collapsed) + .main-layout {
  margin-left: 80px;
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
