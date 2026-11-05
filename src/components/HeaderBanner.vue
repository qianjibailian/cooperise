<template>
  <!-- 顶栏公告横幅：多条消息上下滚动轮播，悬停暂停；可关闭（本次会话内不再显示） -->
  <div
    v-if="visible"
    class="header-banner"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
  >
    <span class="hb-icon"><SoundOutlined /></span>
    <div class="hb-viewport">
      <Transition name="hb-roll">
        <div :key="index" class="hb-item" :title="current">{{ current }}</div>
      </Transition>
    </div>
    <span class="hb-close" title="关闭" @click="dismiss"><CloseOutlined /></span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CloseOutlined, SoundOutlined } from '@ant-design/icons-vue'
import { BANNER_MESSAGES } from '@/config/banner'

const DISMISS_KEY = 'cooperise.banner.dismissed'
/** 每条停留时长（毫秒） */
const INTERVAL = 4000

function readDismissed() {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}

const dismissed = ref(readDismissed())
const visible = computed(() => !dismissed.value && BANNER_MESSAGES.length > 0)
const index = ref(0)
const paused = ref(false)
const current = computed(() => BANNER_MESSAGES[index.value] ?? '')

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (BANNER_MESSAGES.length < 2) return
  timer = setInterval(() => {
    if (!paused.value && !document.hidden) index.value = (index.value + 1) % BANNER_MESSAGES.length
  }, INTERVAL)
})
onBeforeUnmount(() => clearInterval(timer))

function dismiss() {
  dismissed.value = true
  try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* 存储不可用时只在本页关闭 */ }
}
</script>

<style scoped>
/* 极简样式：无底色无边框，灰色小图标 + 灰色文字，关闭按钮悬停才出现 */
.header-banner {
  flex: 0 1 440px;
  min-width: 0;
  height: 28px;
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8a919c;
  font-size: 12px;
  -webkit-app-region: no-drag;
}

.hb-icon {
  flex-shrink: 0;
  display: inline-flex;
  font-size: 12px;
  color: #a8adb5;
}

.hb-viewport {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.hb-item {
  position: absolute;
  inset: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 28px;
}

.hb-close {
  flex-shrink: 0;
  display: inline-flex;
  padding: 2px;
  font-size: 10px;
  color: #a8adb5;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.header-banner:hover .hb-close {
  opacity: 1;
}

.hb-close:hover {
  color: #5c6370;
}

/* 上下滚动：新消息从下方滚入，旧消息向上滚出 */
.hb-roll-enter-active,
.hb-roll-leave-active {
  transition: transform 0.4s ease, opacity 0.4s ease;
}

.hb-roll-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.hb-roll-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 767px) {
  .header-banner {
    display: none;
  }
}
</style>
