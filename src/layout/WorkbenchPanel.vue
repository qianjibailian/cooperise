<template>
  <div class="workbench-panel" :class="{ 'workbench-panel-docs': isDocsRoute }">
    <!-- 工作台页面按当前空间重新挂载：切换空间后所有数据（列表 / 看板 / 甘特 / 日历 / 我的看板）随之重新加载 -->
    <router-view v-slot="{ Component }">
      <component :is="Component" :key="scopeKey" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { currentSpaceCode } from '@/utils/current-space'

const route = useRoute()
/** 仅工作台路由随空间切换重挂载；其它路由保持原有复用行为 */
const scopeKey = computed(() => (route.path.startsWith('/workbench') ? `space:${currentSpaceCode.value}` : 'static'))
/** 文档页：无内边距、占满全高，让左侧文档菜单直达顶部 */
const isDocsRoute = computed(() => route.path.startsWith('/docs'))
</script>

<style scoped>
.workbench-panel {
  width: 100%;
  /* 占满顶栏以下、视口底部以上的整个区域；页面无灰边、无圆角 */
  height: calc(100vh - var(--app-header-height, 56px));
  height: calc(100dvh - var(--app-header-height, 56px));
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 2vh 0.5vh;
  box-sizing: border-box;
  border-radius: 0;
}
/* 文档页：去掉四周留白，占满全高，左侧菜单才能延伸到顶部 */
.workbench-panel.workbench-panel-docs {
  height: 100vh;
  height: 100dvh;
  padding: 0;
  border-radius: 0;
}
</style>
