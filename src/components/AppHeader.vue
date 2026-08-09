<template>
  <header class="app-header">
    <div class="header-left" :class="{ collapsed: sidebarCollapsed }">
      <AppLogo clickable to="/dashboard" />
      <div class="header-left-right">
        <a-divider v-if="!hideSidebarToggle" type="vertical" class="header-divider" />
        <component :is="sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined" v-if="!hideSidebarToggle" class="header-fold-icon" @click="$emit('toggle-sidebar')" />
      </div>
    </div>

    <div class="header-center" v-if="false">
      <div class="workspace-btn" @click="$emit('workspace-click')">
        <HomeOutlined />
        <span>控制台</span>
      </div>
    </div>

    <div class="header-right">
      <a-dropdown
        v-model:open="dropdownOpen"
        :trigger="[]"
        placement="bottomLeft"
        overlay-class-name="search-dropdown-popup"
      >
        <a-input
          v-model:value="searchValue"
          :placeholder="searchPlaceholder"
          class="header-search"
          allow-clear
          @focus="openSearchDropdown"
          @blur="closeSearchDropdown"
          @press-enter="handleEnter"
          @keydown.esc="closeSearchDropdown"
        >
          <template #prefix>
            <SearchOutlined style="color: #bbb" />
          </template>
        </a-input>
        <template #overlay>
          <div class="search-dropdown">
            <div class="search-dropdown-section">
              <div class="search-dropdown-title">最近搜索</div>
              <div class="search-dropdown-tags">
                <span
                  v-for="item in recentSearches"
                  :key="item"
                  class="search-tag"
                  @mousedown.prevent
                  @click="handleSelect(item)"
                >{{ item }}</span>
              </div>
            </div>
            <div class="search-dropdown-divider" />
            <div class="search-dropdown-section">
              <div class="search-dropdown-title">最近访问</div>
              <div class="search-dropdown-list">
                <div
                  v-for="item in recentVisits"
                  :key="item"
                  class="search-dropdown-item"
                  @mousedown.prevent
                  @click="handleSelect(item)"
                >
                  <DragOutlined style="color: #bbb; margin-right: 8px;" />
                  <span>{{ item }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </a-dropdown>

      <button class="header-create-btn" @click="$emit('create-click')">
        <PlusOutlined />
        <span>新建</span>
      </button>

      <a-popover
        v-model:open="userPopoverOpen"
        :trigger="[]"
        placement="bottomRight"
        overlay-class-name="user-dropdown-popover"
      >
        <div class="user-trigger" @click="toggleUserPopover">
          <a-avatar :size="32" class="user-avatar">
            <template #icon><UserOutlined /></template>
          </a-avatar>
          <span class="user-name">{{ username }}</span>
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
import { ref, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  HomeOutlined,
  SearchOutlined,
  UserOutlined,
  RightOutlined,
  PlusOutlined,
  DragOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons-vue'
import AppLogo from './AppLogo.vue'
import { useAuth } from '@/utils/auth'
import request from '@/utils/request'

defineProps<{
  drawerOpen?: boolean
  searchPlaceholder?: string
  sidebarCollapsed?: boolean
  hideSidebarToggle?: boolean
}>()

const emit = defineEmits<{
  (e: 'menu-click'): void
  (e: 'workspace-click'): void
  (e: 'create-click'): void
  (e: 'search', value: string): void
  (e: 'toggle-sidebar'): void
}>()

const searchValue = ref('')
const dropdownOpen = ref(false)
const userPopoverOpen = ref(false)
// 更新门闩：防止同一 flush 中重复对同一个 open ref 赋值触发 checkRecursiveUpdates
let _dropdownUpdating = false
let _popoverUpdating = false

function setDropdownOpen(next: boolean) {
  if (_dropdownUpdating) return
  if (dropdownOpen.value === next) return
  _dropdownUpdating = true
  nextTick(() => {
    dropdownOpen.value = next
    _dropdownUpdating = false
  })
}
function openSearchDropdown() { setDropdownOpen(true) }
function closeSearchDropdown() { setDropdownOpen(false) }

function setUserPopoverOpen(next: boolean) {
  if (_popoverUpdating) return
  if (userPopoverOpen.value === next) return
  _popoverUpdating = true
  nextTick(() => {
    userPopoverOpen.value = next
    _popoverUpdating = false
  })
}
function toggleUserPopover() { setUserPopoverOpen(!userPopoverOpen.value) }

const recentSearches = ref(['待办事项', '项目', '文档', '工作台', '设置'])
const recentVisits = ref(['轻量应用服务器', '控制台首页', '云解析DNS', '费用与成本', '大模型服务平台百炼'])

function handleEnter() {
  closeSearchDropdown()
  handleSearch()
}

function handleSelect(item: string) {
  searchValue.value = item
  closeSearchDropdown()
  handleSearch(item)
}
const username = '用户'
const userInitials = 'S1'
const orgLogo = '喝'
const orgName = '喝科技'

function handleSearch(value?: string) {
  if (value || searchValue.value) {
    emit('search', value || searchValue.value)
  }
}

const auth = useAuth()

function handleMenuSelect(key: string) {
  setUserPopoverOpen(false)
  switch (key) {
    case 'logout':
      nextTick(handleLogout)
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
    return
  }

  // 接口成功后清除 cookie
  auth.logout()
  message.success('已退出登录')

  // 跳转到登录页
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
  justify-content: space-between;
  min-width: calc(280px + 40px);
  padding-right: 8px;
}

.header-left.collapsed {
  min-width: calc(112px + 40px);
}

.header-left-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-fold-icon {
  font-size: 18px;
  color: #595959;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}

.header-fold-icon:hover {
  color: #1677ff;
  background: #f5f5f5;
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
  height: 24px;
  margin: 0 8px;
}

.header-center {
  margin-left: -8px;
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
  width: 220px;
  transition: width 0.3s ease;
}

.header-search:focus-within {
  width: 380px;
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
</style>

<style>
.user-dropdown-popover .ant-popover-inner {
  padding: 0 !important;
  border-radius: 12px !important;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  border: 1px solid #f0f0f0;
}

.search-dropdown {
  width: 100%;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
}

.search-dropdown-section {
  margin-bottom: 8px;
}

.search-dropdown-title {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
  padding-left: 2px;
}

.search-dropdown-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.search-tag {
  display: inline-block;
  padding: 3px 10px;
  font-size: 12px;
  color: #595959;
  background: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.search-tag:hover {
  background: #e6f4ff;
  color: #1677ff;
}

.search-dropdown-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 10px 0;
}

.search-dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-dropdown-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
  color: #262626;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.search-dropdown-item:hover {
  background: #f5f5f5;
  color: #1677ff;
}

.search-dropdown-item .anticon {
  font-size: 14px;
}

.search-dropdown-popup {
  width: 380px !important;
}

.search-dropdown-popup.ant-dropdown-placement-bottomLeft {
  transform-origin: top left;
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
