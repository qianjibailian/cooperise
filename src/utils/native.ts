/**
 * 原生壳（Capacitor 打包的 iOS / Android App）运行环境判定。
 * 浏览器与 Electron 客户端里 isNativeApp 为 false，所有原生专属逻辑都需要先判断它。
 */
import { Capacitor } from '@capacitor/core'

/** 是否运行在原生 App 内 */
export const isNativeApp = Capacitor.isNativePlatform()

/** 'ios' | 'android' | 'web' */
export const nativePlatform = Capacitor.getPlatform()

export const isIOSApp = nativePlatform === 'ios'

/**
 * 给 <html> 打标记：
 * - is-native：原生 App
 * - is-ios / is-android：具体平台
 * 样式据此处理刘海安全区、禁用整页横向滚动等（见 App.vue）
 */
export function markNative() {
  if (!isNativeApp) return
  const el = document.documentElement
  el.classList.add('is-native')
  el.classList.add(`is-${nativePlatform}`)
}
