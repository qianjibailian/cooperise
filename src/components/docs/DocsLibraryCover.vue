<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * 知识库封面插画：按知识库名称生成固定风格的彩色山景插画（纯 SVG，无外部图片）。
 * 同一个知识库每次渲染的插画 / 配色保持一致。
 */
const props = defineProps<{ name: string }>()

const uid = useId()

interface Palette {
  skyTop: string
  skyBottom: string
  sun: string
  hillBack: string
  hillMid: string
  hillFront: string
  tree: string
}

const PALETTES: Palette[] = [
  // 日落
  { skyTop: '#FFE3B8', skyBottom: '#FFC1CB', sun: '#FFF6D8', hillBack: '#F4A0B0', hillMid: '#E2718D', hillFront: '#B94F6B', tree: '#7C3550' },
  // 海洋
  { skyTop: '#CDEBFF', skyBottom: '#A9D6F7', sun: '#FFF7DA', hillBack: '#8FD2EA', hillMid: '#5BA6D4', hillFront: '#3478AE', tree: '#245C86' },
  // 森林
  { skyTop: '#E2F5CF', skyBottom: '#B7E3AC', sun: '#FFFBDA', hillBack: '#9ED68D', hillMid: '#6FB769', hillFront: '#478A4C', tree: '#2F6438' },
  // 薰衣草
  { skyTop: '#EDE2FF', skyBottom: '#CFBEF9', sun: '#FFF1D2', hillBack: '#C0A8EF', hillMid: '#9B7EDB', hillFront: '#7359AE', tree: '#523E85' },
  // 蜜桃
  { skyTop: '#FFE7D2', skyBottom: '#FFC9B6', sun: '#FFF8D9', hillBack: '#FFB69E', hillMid: '#F28C76', hillFront: '#C86150', tree: '#93473B' },
]

const hash = computed(() => {
  let h = 0
  for (const ch of props.name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
})

const palette = computed(() => PALETTES[hash.value % PALETTES.length])
const variant = computed(() => Math.floor(hash.value / 7) % 2)
const sunX = computed(() => 46 + (hash.value % 80))
const sunY = computed(() => 56 + (hash.value % 22))
</script>

<template>
  <svg
    class="docs-library-cover-svg"
    viewBox="0 0 168 252"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="`docs-lib-sky-${uid}`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="palette.skyTop" />
        <stop offset="100%" :stop-color="palette.skyBottom" />
      </linearGradient>
    </defs>

    <rect width="168" height="252" :fill="`url(#docs-lib-sky-${uid})`" />

    <!-- 太阳 / 云 -->
    <circle :cx="sunX" :cy="sunY" r="24" :fill="palette.sun" opacity="0.95" />
    <ellipse cx="48" cy="52" rx="26" ry="7" fill="#ffffff" opacity="0.34" />
    <ellipse cx="120" cy="84" rx="20" ry="6" fill="#ffffff" opacity="0.26" />

    <!-- 远山 -->
    <path
      v-if="variant === 0"
      d="M0 154 L42 112 L78 150 L118 104 L168 152 V252 H0 Z"
      :fill="palette.hillBack"
      opacity="0.65"
    />
    <path
      v-else
      d="M0 150 L36 118 L72 146 L110 108 L168 156 V252 H0 Z"
      :fill="palette.hillBack"
      opacity="0.65"
    />

    <!-- 中景 -->
    <path d="M0 186 L52 146 L96 184 L136 150 L168 182 V252 H0 Z" :fill="palette.hillMid" opacity="0.86" />

    <!-- 近景 -->
    <path d="M0 216 L46 186 L92 218 L130 190 L168 214 V252 H0 Z" :fill="palette.hillFront" />

    <!-- 树 -->
    <g :fill="palette.tree" opacity="0.8">
      <path d="M32 216 l5 -14 l5 14 z" />
      <path d="M44 220 l4 -11 l4 11 z" />
      <path d="M132 212 l5 -13 l5 13 z" />
    </g>
  </svg>
</template>

<style scoped>
.docs-library-cover-svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
