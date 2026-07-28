<template>
  <div class="workbench-panel">
    <router-view />
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.workbench-panel {
  width: 100%;
  height: calc(100vh - 75px);
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 2vh 0.5vh;
  box-sizing: border-box;
  border-radius: 4px;
}
</style>
