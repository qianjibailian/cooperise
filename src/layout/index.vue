<template>
  <a-layout class="layout-container">
    <a-layout-sider v-model:collapsed="collapsed" :width="200" class="sider">
      <div class="logo-wrapper">
        <div class="logo">
          <div class="logo-icon">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="28" fill="url(#logoGradient)" />
              <path d="M22 44V20" stroke="white" stroke-width="6" stroke-linecap="round" opacity="0.95" />
              <path d="M22 32H42" stroke="white" stroke-width="6" stroke-linecap="round" opacity="0.95" />
              <path d="M42 44V20" stroke="white" stroke-width="6" stroke-linecap="round" opacity="0.7" />
              <circle cx="42" cy="20" r="4" fill="white" opacity="0.9" />
              <circle cx="22" cy="44" r="4" fill="white" opacity="0.9" />
            </svg>
          </div>
          <span v-if="!collapsed" class="logo-text">Cooperise</span>
        </div>
      </div>
      <a-menu
        :theme="'light'"
        :mode="'inline'"
        :selectedKeys="[currentPath]"
        @click="handleMenuClick"
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
    </a-layout-sider>
    <a-layout class="main-layout">
      <a-layout-header class="header">
        <div class="header-left">
          <button class="collapse-btn" @click="collapsed = !collapsed">
            <component :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined" />
          </button>
          <a-breadcrumb class="breadcrumb">
            <a-breadcrumb-item>首页</a-breadcrumb-item>
            <a-breadcrumb-item>{{ currentTitle }}</a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <div class="header-right">
          <a-input-search
            v-model:value="searchValue"
            placeholder="搜索..."
            class="header-search"
            allow-clear
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input-search>
          <a-badge :count="3" :offset="[-4, 4]">
            <button class="icon-btn">
              <component :is="BellOutlined" />
            </button>
          </a-badge>
          <a-dropdown>
            <div class="user-profile">
              <a-avatar :size="32" class="user-avatar">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" alt="avatar" />
              </a-avatar>
              <span class="user-name">管理员</span>
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
        </div>
      </a-layout-header>
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
  SearchOutlined,
  BellOutlined,
  DownOutlined,
  SettingOutlined,
  LogoutOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const collapsed = ref(false)
const searchValue = ref('')

const currentPath = computed(() => {
  if (route.path.startsWith('/requirements')) return '/requirements'
  if (route.path.startsWith('/tasks')) return '/tasks'
  return route.path
})

const currentTitle = computed(() => {
  return (route.meta?.title as string) || '仪表盘'
})

function handleMenuClick(info: { key: string }) {
  if (info.key === 'requirements' || info.key === 'tasks') return
  router.push(info.key)
}
</script>

<style scoped>
.layout-container {
  height: 100%;
  background: #f9fafb;
}

.sider {
  background: #fff !important;
  border-right: 1px solid #f3f4f6;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
}

.logo-wrapper {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.logo-icon svg {
  width: 100%;
  height: 100%;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.sidebar-menu {
  border-right: none !important;
  padding: 8px;
}

.sidebar-menu :deep(.ant-menu-item) {
  margin: 2px 0;
  border-radius: 6px;
  height: 40px;
  line-height: 40px;
  color: #4b5563;
  font-size: 14px;
}

.sidebar-menu :deep(.ant-menu-item:hover) {
  background: #f3f4f6;
  color: #1f2937;
}

.sidebar-menu :deep(.ant-menu-item-selected) {
  background: #f3f4f6 !important;
  color: #1f2937 !important;
  font-weight: 500;
}

.sidebar-menu :deep(.ant-menu-item-selected::after) {
  display: none;
}

.sidebar-menu :deep(.ant-menu-submenu-title) {
  margin: 2px 0;
  border-radius: 6px;
  height: 40px;
  line-height: 40px;
  color: #4b5563;
  font-size: 14px;
}

.sidebar-menu :deep(.ant-menu-submenu-title:hover) {
  background: #f3f4f6;
  color: #1f2937;
}

.sidebar-menu :deep(.ant-menu-divider) {
  margin: 8px 4px;
}

.main-layout {
  margin-left: 200px;
  transition: margin-left 0.2s ease;
}

.layout-container :deep(.ant-layout-sider-collapsed) + .main-layout {
  margin-left: 80px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 99;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  font-size: 18px;
  transition: background 0.2s ease;
}

.collapse-btn:hover {
  background: #f3f4f6;
}

.breadcrumb {
  font-size: 14px;
}

.breadcrumb :deep(.ant-breadcrumb-link) {
  color: #9ca3af;
}

.breadcrumb :deep(.ant-breadcrumb-link:last-child) {
  color: #1f2937;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-search {
  width: 240px;
}

.header-search :deep(.ant-input-affix-wrapper) {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  height: 36px;
}

.header-search :deep(.ant-input-affix-wrapper:hover),
.header-search :deep(.ant-input-affix-wrapper-focused) {
  background: #fff;
  border-color: #9ca3af;
  box-shadow: none;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  font-size: 18px;
  transition: background 0.2s ease;
}

.icon-btn:hover {
  background: #f3f4f6;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.user-profile:hover {
  background: #f3f4f6;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.dropdown-icon {
  color: #9ca3af;
  font-size: 12px;
}

.content {
  padding: 24px;
  min-height: calc(100vh - 56px);
  background: #f9fafb;
}
</style>
