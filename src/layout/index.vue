<template>
  <a-layout class="layout-container">
    <HeaderReact
      :drawer-open="drawerOpen"
      :on-menu-click="handleMenuClick"
    />

    <SideDrawerReact
      :open="drawerOpen"
      menu-path="/cooperise"
      menu-key="cooperise"
      :force-open="true"
      :get-container="false"
      @close="drawerOpen = false"
      @menu-click="handleRemoteMenuClick"
    />

    <a-layout class="main-layout">
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import HeaderReact from '@/components/HeaderReact.vue'
import SideDrawerReact from '@/components/SideDrawerReact.vue'

const router = useRouter()
const drawerOpen = ref(false)

function handleMenuClick() {
  drawerOpen.value = !drawerOpen.value
}

function handleRemoteMenuClick(key: string) {
  let path = key
  if (path.startsWith('/cooperise')) {
    path = path.replace(/^\/cooperise/, '') || '/dashboard'
  }
  router.push(path)
}
</script>

<style scoped>
.layout-container {
  height: 100%;
  background: #fafafa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.main-layout {
  padding-top: 65px;
  min-height: 100vh;
}

.content {
  padding: 24px;
  background: #fafafa;
}

.content > :deep(*) {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
