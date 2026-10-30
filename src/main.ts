import { createApp } from 'vue'
// dayjs 中文：日期选择器的月份 / 星期、以及代码里 format('dddd') 等均为中文
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
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

dayjs.locale('zh-cn')
import type { Router } from 'vue-router'

let appInstance: ReturnType<typeof createApp> | null = null
let routerInstance: Router | null = null

function render(props?: { container?: HTMLElement }) {
  const container = props?.container || document.getElementById('app')

  initTheme()
  routerInstance = setupRouter()

  appInstance = createApp(App)
  appInstance.use(routerInstance)
  appInstance.use(Antd)
  appInstance.use(VxeUI)
  appInstance.use(VxeGantt)
  appInstance.mount(container as HTMLElement)
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
