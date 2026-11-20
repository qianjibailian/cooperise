/**
 * 主题色：固定使用 Jira 蓝，不提供切换。界面保持浅色，品牌主色用于按钮 / 选中 / 链接 / 高亮。
 * - ant-design-vue 组件通过 App.vue 的 a-config-provider（antdTheme）生效
 * - 自定义样式统一使用 CSS 变量：--c-primary / --c-primary-hover / --c-primary-active /
 *   --c-primary-bg（浅底）/ --c-primary-bg-hover / --c-primary-border
 */
import { computed } from 'vue'

export interface ThemeColors {
  primary: string
  hover: string
  active: string
  /** 浅底（选中 / 激活背景） */
  bg: string
  bgHover: string
  border: string
}

/** Atlassian Jira 品牌蓝（Jira Software 配色） */
export const THEME: ThemeColors = {
  primary: '#0052CC',
  hover: '#0065FF',
  active: '#0747A6',
  bg: '#DEEBFF',
  bgHover: '#B3D4FF',
  border: '#B3D4FF',
}

/** 把主题写成 CSS 变量（挂在 :root，弹层挂在 body 下也能取到） */
function applyCssVars(t: ThemeColors) {
  const root = document.documentElement
  root.style.setProperty('--c-primary', t.primary)
  root.style.setProperty('--c-primary-hover', t.hover)
  root.style.setProperty('--c-primary-active', t.active)
  root.style.setProperty('--c-primary-bg', t.bg)
  root.style.setProperty('--c-primary-bg-hover', t.bgHover)
  root.style.setProperty('--c-primary-border', t.border)
}

/** ant-design-vue 主题 token */
const antdTheme = computed(() => ({
  token: {
    colorPrimary: THEME.primary,
    colorLink: THEME.primary,
    colorInfo: THEME.primary,
    borderRadius: 8,
  },
}))

/** 启动时应用主题（在挂载前调用，避免闪烁）；同时清掉旧版本保存的主题选择 */
export function initTheme() {
  try {
    localStorage.removeItem('cooperise:theme')
  } catch {
    // 本地存储不可用时忽略
  }
  applyCssVars(THEME)
}

export function useTheme() {
  return { antdTheme }
}
