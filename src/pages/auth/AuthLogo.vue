<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="gradId" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0052D9" />
        <stop offset="100%" stop-color="#60A8FF" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="12" :fill="`url(#${gradId})`" />
    <g transform="translate(24,24)">
      <path d="M14 0 A14 14 0 1 1 -14 0" stroke="#fff" stroke-width="4.5" stroke-linecap="round" fill="none" />
      <circle cx="6" cy="-6" r="3.2" fill="#FF9CCF" />
    </g>
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 图标尺寸（px） */
    size?: number
  }>(),
  { size: 28 },
)

/** 每个实例独立的渐变 id，避免同页多个 logo 的 defs 冲突 */
const gradId = `auth-logo-grad-${Math.random().toString(36).slice(2, 8)}`
</script>
