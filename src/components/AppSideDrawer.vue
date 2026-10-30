<template>
  <a-drawer
    :open="open"
    placement="left"
    :width="360"
    :mask="false"
    :closable="false"
    :get-container="false"
    class="app-side-drawer"
    root-class-name="app-side-drawer-root"
    @close="$emit('close')"
  >
    <div class="drawer-content">
      <button class="drawer-close-btn" @click="$emit('close')">
        <CloseOutlined />
      </button>
      <div class="drawer-section">
        <div class="drawer-dashboard">
          <span @click="handleMenuClick('/dashboard')">控制台</span>
          <RightOutlined class="dashboard-arrow" />
        </div>
      </div>

      <div class="drawer-section">
        <div class="section-header">
          <ClockCircleOutlined />
          <span>最近访问</span>
        </div>
        <div class="recent-list">
          <button
            v-for="item in recentItems"
            :key="item.path"
            class="recent-item"
            @click="handleMenuClick(item.path)"
          >
            <component :is="item.icon" />
            <span>{{ item.name }}</span>
          </button>
        </div>
      </div>

      <div class="drawer-section">
        <div class="grid-list">
          <button
            v-for="item in menuItems"
            :key="item.path"
            class="grid-item"
            @click="handleMenuClick(item.path)"
          >
            <div class="grid-icon">
              <component :is="item.icon" />
            </div>
            <span>{{ item.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import {
  CloseOutlined,
  RightOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  ProjectOutlined,
  BugOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  GiftOutlined,
  CreditCardOutlined,
} from '@ant-design/icons-vue'
import type { Component } from 'vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'menuClick', key: string): void
}>()

interface MenuItem {
  name: string
  path: string
  icon: Component
}

const menuItems: MenuItem[] = [
  { name: '控制台', path: '/dashboard', icon: DashboardOutlined },
  { name: '产品需求', path: '/requirements', icon: ProjectOutlined },
  { name: '任务管理', path: '/tasks', icon: FileTextOutlined },
  { name: '缺陷管理', path: '/bugs', icon: BugOutlined },
  { name: '迭代管理', path: '/sprints', icon: AppstoreOutlined },
  { name: '会员权益', path: '/membership', icon: GiftOutlined },
  { name: '积分商城', path: '/shop', icon: CreditCardOutlined },
]

const recentItems = menuItems.slice(0, 6)

function handleMenuClick(path: string) {
  emit('menuClick', path)
  emit('close')
}
</script>

<style scoped>
.app-side-drawer :deep(.ant-drawer-content) {
  background: #fafafa;
  border-left: none;
  border-right: none;
}

.app-side-drawer :deep(.ant-drawer-body) {
  padding: 0;
}

.drawer-content {
  position: relative;
  padding: 12px;
}

.drawer-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  font-size: 14px;
  color: #8c8c8c;
  transition: all 0.15s;
}

.drawer-close-btn:hover {
  background: #f5f5f5;
  color: #595959;
}

.drawer-section {
  margin-bottom: 8px;
}

.drawer-dashboard {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #262626;
  cursor: pointer;
  transition: all 0.15s;
}

.drawer-dashboard:hover {
  background: var(--c-primary-bg);
  color: var(--c-primary);
}

.dashboard-arrow {
  font-size: 12px;
  color: #bfbfbf;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 8px;
  font-size: 13px;
  color: #8c8c8c;
  font-weight: 500;
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 8px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #595959;
  transition: all 0.15s;
}

.recent-item:hover {
  border-color: var(--c-primary-border);
  color: var(--c-primary);
  background: var(--c-primary-bg);
}

.grid-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 0 8px;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #595959;
  transition: all 0.15s;
}

.grid-item:hover {
  border-color: var(--c-primary-border);
  color: var(--c-primary);
  background: var(--c-primary-bg);
}

.grid-icon {
  font-size: 24px;
  color: var(--c-primary);
}
</style>
