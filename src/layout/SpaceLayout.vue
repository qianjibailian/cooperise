<template>
  <!-- 空间模块独立布局：顶栏 + 内容区，不展示任何菜单 -->
  <a-layout class="layout-container space-layout" :style="{ '--sider-w': '0px' }">
    <AppHeader
      :module-title="isEnterpriseWorkspace ? '空间管理' : '个人空间'"
      :show-logo="true"
      :hide-sidebar-toggle="true"
    />

    <!-- 左侧一级菜单（工作台 / 空间），固定在顶栏下方最左侧 -->
    <WorkbenchRail class="wb-rail-fixed" />

    <a-layout class="main-layout">
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import WorkbenchRail from '@/components/WorkbenchRail.vue'
import { isEnterpriseWorkspace } from '@/utils/workspace'
import '@/layout/module-layout.css'
</script>

<style scoped>
/* 空间模块：低饱和度白的底色 */
.space-layout {
  background: #f8f9fb;
}

.content {
  background: #f8f9fb;
}

/* 一级菜单（72px）占位：内容区整体右移 */
.main-layout {
  margin-left: 72px;
}

/* 一级菜单：固定在顶栏下方最左侧，全高 */
.wb-rail-fixed {
  position: fixed;
  left: 0;
  top: var(--app-header-height, 56px);
  bottom: 0;
  width: 72px;
  z-index: 91;
}
</style>
