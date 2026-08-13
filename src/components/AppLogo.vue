<template>
  <div class="app-logo" :class="{ clickable: clickable, 'enterprise-mode': isEnterprise }" @click="handleClick">
    <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-labelledby="logoTitle">
      <title id="logoTitle">需求管控平台</title>
      <!-- Redesigned rounded mark -->
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0052D9"/>
          <stop offset="50%" stop-color="#2F78E6"/>
          <stop offset="100%" stop-color="#60A8FF"/>
        </linearGradient>
        <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FF9CCF"/>
          <stop offset="100%" stop-color="#60A8FF"/>
        </linearGradient>
        <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0b254a" flood-opacity="0.12"/>
        </filter>
      </defs>

      <!-- Background rounded square -->
      <rect width="48" height="48" rx="10" fill="url(#logo-gradient)"/>

      <!-- Stylized "C" mark: a thick arc with rounded ends -->
      <g transform="translate(24,24)" filter="url(#softShadow)">
        <path d="M14 0 A14 14 0 1 1 -14 0" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="0.98"/>
        <!-- inner accent dot to give identity -->
        <circle cx="6" cy="-6" r="3.2" fill="url(#accent-grad)"/>
      </g>
    </svg>
    <!-- Artistic text logo -->
    <svg class="logo-text-svg" width="200" height="28" viewBox="0 0 200 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <text x="50%" y="20" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="18" fill="#1a1a1a">
        需求管控平台
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const props = defineProps({
  clickable: {
    type: Boolean,
    default: false
  },
  to: {
    type: String,
    default: '/workbench'
  }
})

const route = useRoute()
const isEnterprise = computed(() => {
  return route.path && route.path.startsWith('/self/enterprise')
})

const handleClick = () => {
  if (props.clickable) {
    window.open(import.meta.env.VITE_PORTAL_URL, '_blank')
  }
}
</script>

<style scoped>
.app-logo {
  display: flex;
  align-items: center;
}

.app-logo.clickable {
  cursor: pointer;
  transition: all 0.3s ease;
}

.app-logo.clickable:hover {
  transform: translateY(-1px);
}

.app-logo.clickable:hover svg {
  filter: drop-shadow(0 4px 8px rgba(0, 82, 217, 0.3));
}

.app-logo svg {
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.app-logo .logo-text-svg {
  display: inline-block;
  vertical-align: middle;
  margin-left: -15px;
}

.app-logo.enterprise-mode {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.app-logo.enterprise-mode > svg:first-child {
  width: 80px !important;
  height: 80px !important;
}

.app-logo.enterprise-mode .logo-text-svg {
  width: auto;
  height: 80px !important;
  display: inline-block;
  vertical-align: middle;
  margin-left: 4px;
}
</style>
