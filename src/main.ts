import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './tailwind.css'
import App from './App.vue'
import { setupRouter } from './router'
import type { Router } from 'vue-router'

let appInstance: ReturnType<typeof createApp> | null = null
let routerInstance: Router | null = null

function render(props?: { container?: HTMLElement }) {
  const container = props?.container || document.getElementById('app')

  routerInstance = setupRouter()

  appInstance = createApp(App)
  appInstance.use(routerInstance)
  appInstance.use(Antd)
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
