/**
 * 各模块布局共用的侧栏状态：桌面端展开 / 收起（记住偏好），手机端改为抽屉。
 * 模块之间互不影响（storageKey 不同），工作台沿用自己原来的实现。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isIOSApp } from '@/utils/native'

export function useModuleSider(storageKey: string) {
  function readCollapsed(): boolean {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved != null) return saved === '1'
    } catch {
      // ignore
    }
    return isIOSApp && window.innerWidth < 900
  }

  const collapsed = ref(readCollapsed())
  const isMobile = ref(window.innerWidth <= 767)
  const mobileOpen = ref(false)

  function syncViewport() {
    const next = window.innerWidth <= 767
    if (next !== isMobile.value) {
      isMobile.value = next
      if (!next) mobileOpen.value = false
    }
  }

  function toggle() {
    if (isMobile.value) {
      if (!mobileOpen.value) collapsed.value = false
      mobileOpen.value = !mobileOpen.value
      return
    }
    collapsed.value = !collapsed.value
    try {
      localStorage.setItem(storageKey, collapsed.value ? '1' : '0')
    } catch {
      // ignore
    }
  }

  function closeMobile() {
    mobileOpen.value = false
  }

  onMounted(() => {
    syncViewport()
    window.addEventListener('resize', syncViewport)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncViewport)
  })

  return { collapsed, isMobile, mobileOpen, toggle, closeMobile }
}
