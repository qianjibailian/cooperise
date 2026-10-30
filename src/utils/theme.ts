/**
 * 主题色：界面保持浅色，只切换品牌主色（按钮 / 选中 / 链接 / 高亮）。
 * - ant-design-vue 组件通过 App.vue 的 a-config-provider（antdTheme）生效
 * - 自定义样式统一使用 CSS 变量：--c-primary / --c-primary-hover / --c-primary-active /
 *   --c-primary-bg（浅底）/ --c-primary-bg-hover / --c-primary-border
 */
import { computed, ref } from 'vue'

export interface ThemeOption {
  key: string
  name: string
  /** 参考来源 */
  source: string
  primary: string
  hover: string
  active: string
  /** 浅底（选中 / 激活背景） */
  bg: string
  bgHover: string
  border: string
}

export const THEMES: ThemeOption[] = [
  {
    key: 'apple',
    name: '苹果蓝',
    source: 'Apple 系统蓝',
    primary: '#0A84FF',
    hover: '#3399FF',
    active: '#0071E3',
    bg: '#E8F1FF',
    bgHover: '#DBE9FF',
    border: '#A8CCFF',
  },
  {
    key: 'tencent',
    name: '腾讯蓝',
    source: '腾讯 TDesign 品牌蓝',
    primary: '#0052D9',
    hover: '#366EF4',
    active: '#003CAB',
    bg: '#ECF2FE',
    bgHover: '#D9E1FF',
    border: '#B5C7FF',
  },
  {
    key: 'alibaba',
    name: '阿里橙',
    source: '阿里巴巴品牌橙',
    primary: '#FF6A00',
    hover: '#FF8833',
    active: '#E05A00',
    bg: '#FFF1E6',
    bgHover: '#FFE4CC',
    border: '#FFC499',
  },
]

const STORAGE_KEY = 'cooperise:theme'
const DEFAULT_THEME = THEMES[0]

function readSaved(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

const currentKey = ref<string>(THEMES.some((t) => t.key === readSaved()) ? readSaved() : DEFAULT_THEME.key)

/** 把主题写成 CSS 变量（挂在 :root，弹层挂在 body 下也能取到） */
function applyCssVars(t: ThemeOption) {
  const root = document.documentElement
  root.style.setProperty('--c-primary', t.primary)
  root.style.setProperty('--c-primary-hover', t.hover)
  root.style.setProperty('--c-primary-active', t.active)
  root.style.setProperty('--c-primary-bg', t.bg)
  root.style.setProperty('--c-primary-bg-hover', t.bgHover)
  root.style.setProperty('--c-primary-border', t.border)
  root.dataset.theme = t.key
}

const currentTheme = computed<ThemeOption>(() => THEMES.find((t) => t.key === currentKey.value) ?? DEFAULT_THEME)

/** ant-design-vue 主题 token */
const antdTheme = computed(() => ({
  token: {
    colorPrimary: currentTheme.value.primary,
    colorLink: currentTheme.value.primary,
    colorInfo: currentTheme.value.primary,
    borderRadius: 8,
  },
}))

function setTheme(key: string) {
  const t = THEMES.find((x) => x.key === key)
  if (!t) return
  currentKey.value = t.key
  applyCssVars(t)
  try {
    localStorage.setItem(STORAGE_KEY, t.key)
  } catch {
    // 本地存储不可用时仅本次生效
  }
}

/** 启动时应用已保存的主题（在挂载前调用，避免闪烁） */
export function initTheme() {
  applyCssVars(currentTheme.value)
}

export function useTheme() {
  return { themes: THEMES, currentTheme, antdTheme, setTheme }
}
