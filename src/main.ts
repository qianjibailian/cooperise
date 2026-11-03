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
import { initLocale } from './i18n'
import { markDesktop } from './utils/desktop'
import type { Router } from 'vue-router'

let appInstance: ReturnType<typeof createApp> | null = null
let routerInstance: Router | null = null

function render(props?: { container?: HTMLElement }) {
  const container = props?.container || document.getElementById('app')

  initTheme()
  markDesktop()
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
  render()
}

export async function bootstrap() {}

export async function mount(props: { container?: HTMLElement }) {
  render(props)
}

export async function unmount() {
  if (appInstance) {
    appInstance.unmount()
    appInstance = null
  }
  routerInstance = null
}
