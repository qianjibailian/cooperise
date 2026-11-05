import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import VxeUI from 'vxe-pc-ui'
import 'vxe-pc-ui/lib/style.css'
import VxeGantt from 'vxe-gantt'
import 'vxe-gantt/lib/style.css'
import './tailwind.css'
import App from './App.vue'
import { setupRouter } from './router'
import { initTheme } from './utils/theme'
// 中英文切换：dayjs 语言 + 运行时词典翻译（默认中文，记住上次选择）
import { initLocale, loadRemoteDictionary, hasCachedDictionary, locale } from './i18n'
import { markDesktop } from './utils/desktop'
import { markNative } from './utils/native'
import { syncDesktopSession } from './utils/desktop-session'
import type { Router } from 'vue-router'

let appInstance: ReturnType<typeof createApp> | null = null
let routerInstance: Router | null = null

/** 英文模式且本地没有缓存词典（首次打开 / 清过缓存）时，最多等后端译文这么久再挂载，避免先闪中文；超时先渲染，译文到了再自动重译 */
const DICTIONARY_WAIT_MS = 3000

async function render(props?: { container?: HTMLElement }) {
  const container = props?.container || document.getElementById('app')

  // 系统初始化：加载国际化译文（GET /i18n/all，后台「国际化翻译」维护）
  // 有本地缓存或中文模式：直接挂载，接口返回后再更新；否则等一下接口
  const loading = loadRemoteDictionary()
  if (locale.value === 'en' && !hasCachedDictionary) {
    await Promise.race([loading, new Promise((r) => setTimeout(r, DICTIONARY_WAIT_MS))])
  }

  initTheme()
  markDesktop()
  markNative()
  syncDesktopSession()
  routerInstance = setupRouter()

  appInstance = createApp(App)
  appInstance.use(routerInstance)
  appInstance.use(Antd)
  appInstance.use(VxeUI)
  appInstance.use(VxeGantt)
  appInstance.mount(container as HTMLElement)
  initLocale()
}

if (!(window as unknown as { __POWERED_BY_QIANKUN__?: boolean }).__POWERED_BY_QIANKUN__) {
  void render()
}

export async function bootstrap() {}

export async function mount(props: { container?: HTMLElement }) {
  await render(props)
}

export async function unmount() {
  if (appInstance) {
    appInstance.unmount()
    appInstance = null
  }
  routerInstance = null
}
