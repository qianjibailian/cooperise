<template>
  <!-- 管理后台独立布局：自己的顶栏 + 左侧管理菜单 -->
  <a-layout class="layout-container" :style="{ '--sider-w': `${SIDER_WIDTH}px` }">
    <AppHeader
      :sidebar-collapsed="collapsed"
      :show-logo="true"
      :left-width="collapsed ? 200 : SIDER_WIDTH"
      module-title="管理后台"
      @toggle-sidebar="toggle"
    />

    <ModuleSider
      :collapsed="collapsed"
      :mobile-open="mobileOpen"
      :is-mobile="isMobile"
      :width="SIDER_WIDTH"
      @close-mobile="closeMobile"
    >
      <div class="side-panel" :class="{ 'side-panel-collapsed': collapsed }">
        <a-menu
          theme="light"
          mode="inline"
          :selected-keys="[route.path]"
          class="sidebar-menu"
          @click="onMenuClick"
        >
          <a-menu-item key="/admin/users">
            <component :is="UserOutlined" />
            <span>用户管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/roles">
            <component :is="TeamOutlined" />
            <span>角色管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/positions">
            <component :is="IdcardOutlined" />
            <span>岗位管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/organization">
            <component :is="ApartmentOutlined" />
            <span>组织管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/system-field">
            <component :is="AppstoreOutlined" />
            <span>系统字段</span>
          </a-menu-item>
          <a-menu-item key="/admin/i18n">
            <component :is="TranslationOutlined" />
            <span>国际化翻译</span>
          </a-menu-item>
        </a-menu>
      </div>
    </ModuleSider>

    <a-layout class="main-layout" :class="{ 'main-layout-collapsed': collapsed }">
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  IdcardOutlined,
  TeamOutlined,
  TranslationOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import AppHeader from '@/components/AppHeader.vue'
import ModuleSider from './ModuleSider.vue'
import { useModuleSider } from './useModuleSider'
import '@/layout/module-layout.css'

const SIDER_WIDTH = 240

const router = useRouter()
const route = useRoute()
const { collapsed, isMobile, mobileOpen, toggle, closeMobile } = useModuleSider('cooperise_admin_sidebar_collapsed')

function onMenuClick(info: { key: string }) {
  router.push(info.key)
}
</script>

<style scoped>
/* 管理后台：左侧菜单和主内容区都用白色 */
.layout-container :deep(.sider) {
  background: #ffffff !important;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.content {
  background: #ffffff;
}
</style>
