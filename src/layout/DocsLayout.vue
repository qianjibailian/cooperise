<template>
  <!-- 云文档独立布局：自己的顶栏 + 文档页自带的左侧菜单（在 pages/docs 内部） -->
  <div class="layout-container docs-layout">
    <AppHeader
      class="app-header-flush"
      :class="{ 'app-header-docs-collapsed': docsSideCollapsed }"
      :sidebar-collapsed="false"
      :hide-sidebar-toggle="true"
    />
    <div class="docs-main">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import { docsSideCollapsed } from '@/utils/docs-layout'
</script>

<style scoped>
.layout-container {
  height: 100%;
  min-width: var(--app-min-width);
  background: var(--docs-canvas);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 文档页占满顶栏以下整个视口；文档左侧菜单仍然直达视口顶部 */
.docs-main {
  height: 100vh;
  height: 100dvh;
}

.docs-main > :deep(*) {
  width: 100%;
  height: 100%;
}

/* 顶栏去掉阴影，改为明确底部分割线；左侧留给文档菜单，折叠时铺满 */
.app-header-flush {
  box-shadow: none !important;
  border-bottom: 1px solid #e5e6eb;
}

.docs-layout .app-header-flush {
  left: 304px;
  min-width: 0;
}

.docs-layout .app-header-docs-collapsed {
  left: 0;
}

@media (max-width: 860px) {
  .docs-layout .app-header-flush {
    left: 200px;
    min-width: 0;
  }
  .docs-layout .app-header-docs-collapsed {
    left: 0;
  }
}
</style>
