<template>
  <!-- 一级菜单入口：宫格图标，点击弹出"切换模块"启动器面板 -->
  <a-popover
    v-model:open="navOpen"
    trigger="click"
    :placement="placement"
    :arrow="false"
    :overlay-inner-style="{ padding: 0 }"
    overlay-class-name="logo-nav-popover"
  >
    <span class="logo-nav-trigger" title="菜单">
      <AppstoreOutlined class="logo-nav-menu-icon" />
    </span>
    <template #content>
      <div class="nav-panel">
        <div class="nav-panel-title">切换模块</div>
        <div class="nav-panel-grid">
          <button
            v-for="item in NAV_ITEMS"
            :key="item.key"
            type="button"
            class="nav-card"
            :class="[`is-${item.key}`, { active: isActiveNav(item.key) }]"
            @click="goNav(item.key, item.path)"
          >
            <span class="nav-card-icon"><component :is="item.icon" /></span>
            <span class="nav-card-text">
              <b>{{ item.label }}</b>
            </span>
          </button>
        </div>
      </div>
    </template>
  </a-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AppstoreOutlined,
  HomeOutlined,
  FileTextOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'

/** 弹出方向：右上角使用时传 bottomRight */
withDefaults(defineProps<{ placement?: 'bottomLeft' | 'bottomRight' | 'bottom' }>(), {
  placement: 'bottomLeft',
})

/** 左上角一级菜单：应用启动器式面板 */
const NAV_ITEMS = [
  { key: 'workspace', label: '工作台', icon: HomeOutlined, path: '/workbench/board' },
  { key: 'docs', label: '先蜂云文档', icon: FileTextOutlined, path: '/docs' },
  { key: 'space', label: '空间', icon: AppstoreOutlined, path: '/space' },
  { key: 'admin', label: '管理后台', icon: ToolOutlined, path: '/admin/users' },
]
const navOpen = ref(false)

const router = useRouter()
const route = useRoute()

function goNav(key: string, path: string) {
  navOpen.value = false
  if (key === 'workspace') router.push('/workbench/board')
  else router.push(path)
}

function isActiveNav(key: string): boolean {
  if (key === 'workspace') return route.path.startsWith('/workbench')
  return route.path.startsWith(`/${key}`)
}
</script>

<style scoped>
.logo-nav-trigger {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  transition: opacity 0.15s;
}
.logo-nav-trigger:hover {
  opacity: 0.85;
}
.logo-nav-menu-icon {
  padding: 4px;
  font-size: 18px;
  color: #595959;
  border-radius: 6px;
}
.logo-nav-menu-icon:hover {
  background: #f2f2f7;
}

/* 一级菜单启动器面板 */
:global(.logo-nav-popover .ant-popover-inner) {
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.06);
}
.nav-panel {
  width: 328px;
  padding: 16px;
  background: #fff;
}
.nav-panel-title {
  padding: 0 4px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #9ca3af;
}
.nav-panel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.nav-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 12px;
  text-align: center;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s, background 0.15s;
}
.nav-card:hover {
  background: #fff;
  border-color: #e5e5e5;
  box-shadow: 0 8px 20px rgba(31, 35, 41, 0.08);
  transform: translateY(-2px);
}
.nav-card.active {
  background: #fff;
  border-color: #3370ff;
  box-shadow: 0 0 0 2px rgba(51, 112, 255, 0.12);
}
.nav-card-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 18px;
  color: #fff;
  border-radius: 10px;
}
.is-workspace .nav-card-icon {
  background: linear-gradient(135deg, #3370ff, #5b8cff);
}
.is-docs .nav-card-icon {
  background: linear-gradient(135deg, #00b96b, #34d399);
}
.is-space .nav-card-icon {
  background: linear-gradient(135deg, #8b5cf6, #c4b5fd);
}
.is-settings .nav-card-icon {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
}
.is-admin .nav-card-icon {
  background: linear-gradient(135deg, #64748b, #94a3b8);
}
.nav-card-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.nav-card-text b {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}
.nav-card-text small {
  font-size: 11px;
  color: #8f959e;
}
</style>
