<template>
  <!-- 空间 / 管理后台模块的左侧菜单容器：桌面端固定，手机端为抽屉 -->
  <div v-if="isMobile && mobileOpen" class="mobile-mask" @click="$emit('close-mobile')" />
  <a-layout-sider
    v-if="!collapsed || isIOSApp"
    :width="width"
    class="sider"
    :class="{ 'sider-mobile-open': mobileOpen }"
    :trigger="null"
  >
    <div class="sider-inner">
      <slot :collapsed="collapsed" />
    </div>
  </a-layout-sider>
</template>

<script setup lang="ts">
import { isIOSApp } from '@/utils/native'

withDefaults(defineProps<{
  collapsed?: boolean
  mobileOpen?: boolean
  isMobile?: boolean
  width?: number
}>(), {
  collapsed: false,
  mobileOpen: false,
  isMobile: false,
  width: 240,
})

defineEmits<{ (e: 'close-mobile'): void }>()
</script>

<style scoped>
.sider {
  /* 侧栏灰底、内容区白底，靠色调分层 */
  background: var(--docs-side-bg) !important;
  height: calc(100vh - var(--app-header-height, 56px));
  height: calc(100dvh - var(--app-header-height, 56px));
  position: fixed;
  left: 0;
  top: var(--app-header-height, 56px);
  bottom: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  border-right: 1px solid var(--docs-border);
  transform: translateX(calc(-1 * var(--app-scroll-x, 0px)));
}

.sider-inner {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  height: 100vh;
  height: 100dvh;
}

.side-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
  padding-top: 18px;
}

@media (max-width: 767px) {
  .sider {
    width: min(280px, 86vw) !important;
    max-width: 86vw !important;
    min-width: 0 !important;
    flex: 0 0 auto !important;
    z-index: 210;
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: none;
  }
  .sider.sider-mobile-open {
    transform: translateX(0);
    box-shadow: 2px 0 16px rgba(0, 0, 0, 0.18);
  }
  .mobile-mask {
    position: fixed;
    inset: 0;
    z-index: 205;
    background: rgba(0, 0, 0, 0.35);
  }
  .sider-inner {
    height: 100%;
  }
}
</style>
