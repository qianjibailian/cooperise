<template>
  <header class="app-header">
    <div class="header-left">
      <div class="menu-btn" @click="$emit('menu-click')">
        <component :is="drawerOpen ? CloseOutlined : MenuOutlined" />
      </div>
      <div class="header-divider" />
      <AppLogo clickable to="/dashboard" />
    </div>

    <div class="header-center">
      <div class="workspace-btn" @click="$emit('workspace-click')">
        <AppstoreOutlined />
        <span>控制台</span>
      </div>
    </div>

    <div class="header-right">
      <a-input
        v-model:value="searchValue"
        :placeholder="searchPlaceholder"
        class="header-search"
        allow-clear
        @press-enter="handleSearch"
      >
        <template #prefix>
          <SearchOutlined style="color: #bbb" />
        </template>
      </a-input>

      <button class="header-create-btn" @click="$emit('create-click')">
        <PlusOutlined />
        <span>新建</span>
      </button>

      <a-popover
        trigger="click"
        placement="bottomRight"
        overlay-class-name="user-dropdown-popover"
      >
        <div class="user-trigger">
          <a-avatar :size="32" class="user-avatar">
            <template #icon><UserOutlined /></template>
          </a-avatar>
          <span class="user-name">{{ username }}</span>
          <DownOutlined class="user-arrow" />
        </div>
        <template #content>
          <div class="user-panel">
            <div class="user-panel-header">
              <div class="user-initials-avatar">{{ userInitials }}</div>
            </div>

            <div class="user-menu-list">
              <div class="user-menu-text" @click="handleMenuSelect('settings')">个人设置</div>
              <div class="user-menu-text" @click="handleMenuSelect('logout')">退出登录</div>
            </div>

            <div class="user-divider" />

            <div class="user-section-title">组织</div>
            <div class="user-org-card" @click="handleMenuSelect('switch')">
              <div class="user-org-logo">{{ orgLogo }}</div>
              <div class="user-org-name">{{ orgName }}</div>
              <div class="user-org-switch">切换 <RightOutlined /></div>
            </div>

            <div class="user-menu-list">
              <div class="user-menu-text" @click="handleMenuSelect('admin')">管理后台</div>
            </div>
          </div>
        </template>
      </a-popover>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  MenuOutlined,
  CloseOutlined,
  AppstoreOutlined,
  SearchOutlined,
  UserOutlined,
  DownOutlined,
  RightOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import AppLogo from './AppLogo.vue'
import { useAuth } from '@/utils/auth'
import request from '@/utils/request'

defineProps<{
  drawerOpen?: boolean
  searchPlaceholder?: string
}>()

const emit = defineEmits<{
  (e: 'menu-click'): void
  (e: 'workspace-click'): void
  (e: 'create-click'): void
  (e: 'search', value: string): void
}>()

const searchValue = ref('')
const username = '用户'
const userInitials = 'S1'
const orgLogo = '喝'
const orgName = '喝科技'

function handleSearch() {
  if (searchValue.value) {
    emit('search', searchValue.value)
  }
}

const auth = useAuth()

function handleMenuSelect(key: string) {
  switch (key) {
    case 'logout':
      handleLogout()
      break
    case 'settings':
      console.log('个人设置')
      break
    case 'switch':
      console.log('切换组织')
      break
    case 'admin':
      console.log('管理后台')
      break
  }
}

async function handleLogout() {
  try {
    await request.post('/tianguan-api/auth/logout')
  } catch (e) {
    console.warn('[Logout] 接口调用失败，继续执行登出流程:', e)
  }

  auth.logout()
  message.success('已退出登录')

  const loginUrl = import.meta.env.VITE_ACCOUNT_URL + '?oauth_callback=' + encodeURIComponent(window.location.href)
  window.location.href = loginUrl
}
</script>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 16px;
  z-index: 1000;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  font-size: 20px;
  color: #595959;
  transition: background 0.15s;
}

.menu-btn:hover {
  background: #f5f5f5;
}

.header-divider {
  width: 1px;
  height: 24px;
  background: #e8e8e8;
  margin: 0 4px;
}

.header-center {
  margin-left: 24px;
}

.workspace-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  font-size: 14px;
  color: #595959;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.workspace-btn:hover {
  background: #eef1f6;
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-search {
  width: 280px;
}

.header-create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border: none;
  background: linear-gradient(135deg, #0052D9 0%, #2F78E6 50%, #60A8FF 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: box-shadow 0.15s, opacity 0.15s;
}

.header-create-btn:hover {
  box-shadow: 0 2px 8px rgba(0, 82, 217, 0.3);
  opacity: 0.92;
}

.header-create-btn:active {
  opacity: 0.85;
}

.user-trigger {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.user-trigger:hover {
  background: #f5f5f5;
}

.user-avatar {
  background: #1677ff;
}

.user-name {
  margin-left: 8px;
  font-size: 14px;
  color: #262626;
}

.user-arrow {
  margin-left: 4px;
  font-size: 10px;
  color: #8c8c8c;
  transition: transform 0.2s;
}

.user-trigger:hover .user-arrow {
  color: #595959;
}
</style>

<style>
.user-dropdown-popover .ant-popover-inner {
  padding: 0 !important;
  border-radius: 12px !important;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  border: 1px solid #f0f0f0;
}

.user-dropdown-popover .ant-popover-inner-content {
  padding: 0 !important;
}

.user-panel {
  width: 240px;
  padding: 12px 0;
}

.user-panel-header {
  display: flex;
  justify-content: center;
  padding: 16px 0 12px;
}

.user-initials-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFD666 0%, #F5A623 100%);
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(245, 166, 35, 0.35);
}

.user-menu-list {
  padding: 4px 16px;
}

.user-menu-text {
  padding: 8px 0;
  font-size: 14px;
  color: #262626;
  cursor: pointer;
  transition: color 0.15s;
  line-height: 1.5;
}

.user-menu-text:hover {
  color: #1677ff;
}

.user-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 12px 16px;
}

.user-section-title {
  padding: 0 16px 8px;
  font-size: 13px;
  color: #8c8c8c;
  font-weight: 500;
}

.user-org-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 16px 8px;
  padding: 10px 12px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.user-org-card:hover {
  background: #e8e8e8;
}

.user-org-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(135deg, #0052D9 0%, #2F78E6 50%, #60A8FF 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-org-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.user-org-switch {
  font-size: 13px;
  color: #8c8c8c;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.user-org-card:hover .user-org-switch {
  color: #1677ff;
}
</style>
