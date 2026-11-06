<template>
  <!-- 主页面框架（看板 / 事项 / 空间 / 我的）：列表页保活；底部标签栏在 App 根部，所有页面共用 -->
  <div class="h5-tab-layout">
    <router-view v-slot="{ Component, route: r }">
      <keep-alive :include="['H5Issues', 'H5Boards']">
        <component :is="Component" :key="r.name" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'H5TabLayout' })
</script>

<style scoped>
.h5-tab-layout {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--h5-bg);
}
</style>
