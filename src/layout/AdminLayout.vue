<template>
  <!-- 管理后台独立布局：自己的顶栏 + 左侧管理菜单 -->
  <a-layout class="layout-container" :class="{ 'is-enterprise': isEnterprise }" :style="{ '--sider-w': `${SIDER_WIDTH}px` }">
    <AppHeader
      :sidebar-collapsed="collapsed"
      :show-logo="true"
      :left-width="collapsed ? 200 : SIDER_WIDTH"
      module-title="管理后台"
      @toggle-sidebar="toggle"
    />

    <!-- 企业后台：左侧一级菜单（工作台 / 空间 / 企业后台） -->
    <WorkbenchRail v-if="isEnterprise" class="wb-rail-fixed" />

    <ModuleSider
      :collapsed="collapsed"
      :mobile-open="mobileOpen"
      :is-mobile="isMobile"
      :width="SIDER_WIDTH"
      @close-mobile="closeMobile"
    >
      <div class="side-panel" :class="{ 'side-panel-collapsed': collapsed }">
        <!-- 企业后台：用户 / 岗位 / 授权 / 组织 / 菜单 -->
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
          <a-menu-item key="/enterprise/positions">
            <component :is="IdcardOutlined" />
            <span>岗位管理</span>
          </a-menu-item>
          <a-menu-item key="/enterprise/permissions">
            <component :is="TeamOutlined" />
            <span>授权管理</span>
          </a-menu-item>
          <a-menu-item key="/enterprise/organization">
            <component :is="ApartmentOutlined" />
            <span>组织管理</span>
          </a-menu-item>
          <a-menu-item key="/enterprise/menus">
            <component :is="UnorderedListOutlined" />
            <span>菜单</span>
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
          <a-menu-item key="/admin/users">
            <component :is="UserOutlined" />
            <span>用户管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/roles">
            <component :is="TeamOutlined" />
            <span>角色管理</span>
          </a-menu-item>
          <a-menu-item key="/admin/menus">
            <component :is="UnorderedListOutlined" />
            <span>菜单管理</span>
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
          <a-menu-item key="/admin/init-config">
            <component :is="SettingOutlined" />
            <span>初始化配置</span>
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
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  AppstoreOutlined,
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
const { collapsed, isMobile, mobileOpen, toggle, closeMobile } = useModuleSider('cooperise_admin_sidebar_collapsed')

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
