<template>
  <div class="workbench-panel">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>
</template>

<style scoped>
.workbench-panel {
  /* 左侧留出与菜单的间距，顶部留出与顶栏的间距；高度相应扣减，保证底部仍在视口内 */
  width: auto;
  height: calc(100vh - var(--app-header-height, 56px) - 8px);
  height: calc(100dvh - var(--app-header-height, 56px) - 8px);
  margin: 8px 0 0 8px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 2vh 0.5vh;
  box-sizing: border-box;
  border-radius: 0;
}
</style>
