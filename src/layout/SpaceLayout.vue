<template>
  <!-- 空间模块独立布局：顶栏 + 内容区，不展示任何菜单 -->
  <a-layout class="layout-container space-layout" :style="{ '--sider-w': '0px' }">
    <AppHeader
      module-title="空间"
      :show-logo="true"
      :hide-sidebar-toggle="true"
    />

    <a-layout class="main-layout">
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
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
</style>
