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
import { vPermission } from './directives/permission'
import { initTheme } from './utils/theme'
// 中英文切换：dayjs 语言 + 运行时词典翻译（默认中文，记住上次选择）
import { initLocale, loadRemoteDictionary, hasCachedDictionary, locale } from './i18n'
import { markDesktop, isDesktop } from './utils/desktop'
import { markNative, isNativeApp } from './utils/native'
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
  appInstance.directive('permission', vPermission)
  appInstance.use(Antd)
  appInstance.use(VxeUI)
  appInstance.use(VxeGantt)
  appInstance.mount(container as HTMLElement)
  initLocale()
}

/**
 * 手机浏览器访问网页版 → 跳到手机 H5（/h5/，独立入口，见 src/h5/），地址保持一致（如 /jira/browse/KEY）。
 * 只认手机（iPhone / Android 手机），iPad、客户端、iOS App 壳、qiankun 嵌入都不跳；
 * 网址带 ?pc=1 时本次会话坚持用网页版
 */
function redirectPhoneToH5(): boolean {
  if (isDesktop || isNativeApp) return false
  try {
    const params = new URLSearchParams(location.search)
    if (params.get('pc') === '1') sessionStorage.setItem('cooperise.forcePc', '1')
    if (sessionStorage.getItem('cooperise.forcePc') === '1') return false
  } catch {
    // 存储不可用：照常判断
  }
  const ua = navigator.userAgent
  const isPhone = /iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua))
  if (!isPhone) return false
  // 事项链接在 H5 有同样的路由；其他页面统一进 H5 首页（我的事项）
  const path = location.pathname.replace(/^\/+/, '')
  location.replace(path.startsWith('jira/browse/') ? `/h5/${path}` : '/h5/')
  return true
}

if (!(window as unknown as { __POWERED_BY_QIANKUN__?: boolean }).__POWERED_BY_QIANKUN__ && !redirectPhoneToH5()) {
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
