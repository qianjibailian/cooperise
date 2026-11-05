<template>
  <div class="workbench-panel">
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
</script>

<style scoped>
.workbench-panel {
  width: 100%;
  height: calc(100vh - var(--app-header-height, 56px) - 19px);
  height: calc(100dvh - var(--app-header-height, 56px) - 19px);
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 2vh 0.5vh;
  box-sizing: border-box;
  border-radius: 4px;
}
</style>
