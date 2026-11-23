<template>
  <!-- 管理后台独立布局：自己的顶栏 + 左侧管理菜单 -->
  <a-layout class="layout-container" :class="{ 'is-enterprise': isEnterprise }" :style="{ '--sider-w': `${SIDER_WIDTH}px` }">
    <AppHeader
      :sidebar-collapsed="sidebarCollapsed"
      :show-logo="true"
      :left-width="sidebarCollapsed ? 200 : SIDER_WIDTH"
      :module-title="isEnterprise ? '企业后台' : '管理后台'"
      @toggle-sidebar="onToggleSidebar"
    />

    <!-- 企业后台：左侧一级菜单（工作台 / 空间 / 企业后台） -->
    <WorkbenchRail v-if="isEnterprise" class="wb-rail-fixed" />

    <ModuleSider
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileOpen"
      :is-mobile="isMobile"
      :width="SIDER_WIDTH"
      @close-mobile="closeMobile"
    >
      <div class="side-panel" :class="{ 'side-panel-collapsed': sidebarCollapsed }">
        <!-- 企业后台：用户 / 角色 / 岗位 / 组织 / 设置 -->
        <a-menu
          v-if="isEnterprise"
          theme="light"
          mode="inline"
          :selected-keys="[route.path]"
          class="sidebar-menu"
          @click="onMenuClick"
        >
          <a-menu-item key="/enterprise/users">
            <component :is="UserOutlined" />
            <span>用户管理</span>
          </a-menu-item>
          <a-menu-item key="/enterprise/roles">
            <component :is="TeamOutlined" />
            <span>角色管理</span>
          </a-menu-item>
          <a-menu-item key="/enterprise/positions">
            <component :is="IdcardOutlined" />
            <span>岗位管理</span>
          </a-menu-item>
          <a-menu-item key="/enterprise/organization">
            <component :is="ApartmentOutlined" />
            <span>组织管理</span>
          </a-menu-item>
          <a-menu-item key="/enterprise/settings">
            <component :is="SettingOutlined" />
            <span>设置管理</span>
          </a-menu-item>
        </a-menu>
        <!-- 管理后台：完整菜单 -->
        <a-menu
          v-else
          theme="light"
          mode="inline"
          :selected-keys="[route.path]"
          class="sidebar-menu"
          @click="onMenuClick"
        >
          <!-- 菜单权限：v-permission 无权限时移除菜单项（超管全可见；旧会话无权限快照时全可见） -->
          <a-menu-item key="/admin/users" v-permission="'admin:user'">
            <component :is="UserOutlined" />
            <span>用户管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/roles" v-permission="'admin:role'">
            <component :is="TeamOutlined" />
            <span>角色管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/menus" v-permission="'admin:menu'">
            <component :is="UnorderedListOutlined" />
            <span>菜单管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/positions" v-permission="'admin:position'">
            <component :is="IdcardOutlined" />
            <span>岗位管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/organization" v-permission="'admin:organization'">
            <component :is="ApartmentOutlined" />
            <span>组织管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/space" v-permission="'admin:space'">
            <component :is="FolderOpenOutlined" />
            <span>空间管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/system-field" v-permission="'admin:system-field'">
            <component :is="AppstoreOutlined" />
            <span>系统字段</span>
          </a-menu-item>
          <a-menu-item key="/admin/init-config" v-permission="'admin:init-config'">
            <component :is="SettingOutlined" />
            <span>初始化配置</span>
          </a-menu-item>
          <a-menu-item key="/admin/i18n" v-permission="'admin:i18n'">
            <component :is="TranslationOutlined" />
            <span>国际化翻译</span>
          </a-menu-item>
        </a-menu>
      </div>
    </ModuleSider>

    <a-layout class="main-layout" :class="{ 'main-layout-collapsed': sidebarCollapsed }">
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  FolderOpenOutlined,
  IdcardOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  TranslationOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import AppHeader from '@/components/AppHeader.vue'
import WorkbenchRail from '@/components/WorkbenchRail.vue'
import ModuleSider from './ModuleSider.vue'
import { useModuleSider } from './useModuleSider'
import '@/layout/module-layout.css'

const SIDER_WIDTH = 240

const router = useRouter()
const route = useRoute()
/** /enterprise/* 为企业后台，使用独立的五项菜单 */
const isEnterprise = computed(() => route.path.startsWith('/enterprise'))
// 一次性复位：之前企业后台误把管理后台的侧栏记为收起，这里清掉旧记忆，之后正常记住用户的操作
try {
  if (!localStorage.getItem('cooperise_admin_sidebar_reset_v1')) {
    localStorage.removeItem('cooperise_admin_sidebar_collapsed')
    localStorage.setItem('cooperise_admin_sidebar_reset_v1', '1')
  }
} catch {
  // 本地存储不可用时忽略
}
const { collapsed, isMobile, mobileOpen, toggle, closeMobile } = useModuleSider('cooperise_admin_sidebar_collapsed')
/** 企业后台的二级菜单始终展开（不受管理后台的折叠记忆影响） */
const sidebarCollapsed = computed(() => collapsed.value && !isEnterprise.value)
/** 企业后台的侧边栏固定展开，顶部切换只作用于管理后台，避免两边的折叠记忆互相影响 */
function onToggleSidebar() {
  if (!isEnterprise.value) toggle()
}

function onMenuClick(info: { key: string }) {
  router.push(info.key)
}
</script>

<style scoped>
/* 管理后台：左侧菜单和主内容区都用白色 */
/* 企业后台：左侧一级菜单占 72px，二级菜单与内容区整体右移 */
.is-enterprise :deep(.sider) {
  left: 72px;
}

.is-enterprise.layout-container .main-layout {
  margin-left: calc(var(--sider-w, 240px) + 72px);
}

.is-enterprise.layout-container .main-layout-collapsed {
  margin-left: 72px;
}

.wb-rail-fixed {
  position: fixed;
  left: 0;
  top: var(--app-header-height, 56px);
  bottom: 0;
  width: 72px;
  z-index: 91;
}

.layout-container :deep(.sider) {
  background: #ffffff !important;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.content {
  background: #ffffff;
}
</style>
