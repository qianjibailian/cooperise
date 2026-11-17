<template>
  <!-- 云文档独立布局：自己的顶栏 + 文档页自带的左侧菜单（在 pages/docs 内部） -->
  <div class="layout-container docs-layout">
    <AppHeader
      class="app-header-flush"
      :class="{ 'app-header-docs-collapsed': docsSideCollapsed, 'is-doc-page': isDocDetail }"
      :sidebar-collapsed="false"
      :hide-sidebar-toggle="true"
      :module-title="moduleTitle"
      :module-title-large="true"
    />
    <div class="docs-main">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { docsSideCollapsed } from '@/utils/docs-layout'

const route = useRoute()
/** 是否文档详情页（/docs/wiki/:docId） */
const isDocDetail = computed(() => route.path.startsWith('/docs/wiki/'))
/** 顶部菜单标题：主页 / 知识库；打开文档时顶部显示文档标题，不重复显示模块名 */
const moduleTitle = computed(() => {
  if (isDocDetail.value) return ''
  if (route.path.startsWith('/docs/wiki')) return '知识库'
  return '主页'
})
</script>

<style scoped>
.layout-container {
  /* 云文档顶栏比全局（56px）高一档；--app-header-height 是整个顶部区域（含客户端页签栏），顶栏和文档页都按它避让 */
  --docs-header-h: 72px;
  --app-header-height: calc(var(--docs-header-h) + var(--desktop-tabbar-height, 0px));
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

/* 顶栏去掉阴影和底部分割线；左侧留给文档菜单，折叠时铺满 */
.app-header-flush {
  box-shadow: none !important;
  border-bottom: none;
}

.docs-layout .app-header-flush {
  left: 327px;
  min-width: 0;
  /* 与文档内容区（主页的「新建」卡片）左边缘对齐 */
  padding-left: 48px;
}

/* 文档详情：标题和「已经保存到云端」贴近左侧（不跟随内容区缩进），并展示顶栏底部分割线 */
.docs-layout .app-header-flush.is-doc-page {
  padding-left: 16px;
  border-bottom: 1px solid #e5e6eb;
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
