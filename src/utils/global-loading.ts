import { ref } from 'vue'

/**
 * 全局加载状态（文档路由切换、文档详情加载等）。
 * 采用计数：每个 start 对应一个 stop，多个并发加载结束前遮罩保持显示。
 * 延迟 150ms 才显示，避免本地很快完成的加载闪一下遮罩。
 */
const SHOW_DELAY = 150

const visible = ref(false)
let count = 0
let timer: ReturnType<typeof setTimeout> | undefined

export const globalLoading = visible

export function startGlobalLoading(): void {
  count++
  if (count === 1 && !visible.value && timer === undefined) {
    timer = setTimeout(() => {
      timer = undefined
      if (count > 0) visible.value = true
    }, SHOW_DELAY)
  }
}

export function stopGlobalLoading(): void {
  count = Math.max(0, count - 1)
  if (count === 0) {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    visible.value = false
  }
}
