<template>
  <!-- Windows 客户端窗口按钮（Win11 风格）：与页签栏（DesktopTabBar）同高同色，替代原生 Window Controls Overlay -->
  <div class="window-controls" :class="{ blurred: !focused }">
    <button type="button" class="wc-btn" title="最小化" @click="act('minimize')">
      <svg viewBox="0 0 10 10"><path d="M0.5 5h9" /></svg>
    </button>
    <button
      type="button"
      class="wc-btn"
      :title="maximized ? '向下还原' : '最大化'"
      @click="act('toggle-maximize')"
    >
      <svg v-if="maximized" viewBox="0 0 10 10">
        <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
        <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
      </svg>
      <svg v-else viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" rx="1.2" /></svg>
    </button>
    <button type="button" class="wc-btn wc-close" title="关闭" @click="act('close')">
      <svg viewBox="0 0 10 10"><path d="M0.8 0.8l8.4 8.4M9.2 0.8L0.8 9.2" /></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { desktop } from '@/utils/desktop'

const maximized = ref(false)
const focused = ref(document.hasFocus())

async function act(action: 'minimize' | 'toggle-maximize' | 'close') {
  const res = await desktop?.windowAction(action)
  if (typeof res === 'boolean') maximized.value = res
}

const onFocus = () => { focused.value = true }
const onBlur = () => { focused.value = false }
let unsubscribe: (() => void) | undefined

onMounted(async () => {
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
  unsubscribe = desktop?.onMaximizedChange((v) => { maximized.value = v })
  maximized.value = !!(await desktop?.windowAction('state'))
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', onFocus)
  window.removeEventListener('blur', onBlur)
  unsubscribe?.()
})
</script>

<style scoped>
.window-controls {
  position: fixed;
  top: 0;
  right: 0;
  width: var(--desktop-controls-width, 138px);
  height: var(--desktop-tabbar-height, 42px);
  display: flex;
  /* 盖在页签栏 / 拖动条 / 弹窗遮罩之上，任何时候都能操作窗口 */
  z-index: 2100;
  -webkit-app-region: no-drag;
  user-select: none;
}

.wc-btn {
  flex: 1;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #5c6370;
  cursor: default;
  outline: none;
  transition: background 0.12s, color 0.12s;
}

.wc-btn svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  shape-rendering: geometricPrecision;
}

.wc-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1f2329;
}

.wc-btn:active {
  background: rgba(0, 0, 0, 0.1);
}

.wc-close:hover {
  background: #e81123;
  color: #fff;
}

.wc-close:active {
  background: #f1707a;
  color: #fff;
}

/* 窗口失焦时图标变淡（与系统行为一致） */
.window-controls.blurred .wc-btn:not(:hover) {
  color: #a8adb5;
}
</style>
