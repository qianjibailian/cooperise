/**
 * 手机 H5 独立入口（h5.html，部署在 /h5/）
 *
 * - 只复用接口层（@/api）、登录态（@/utils/auth）、国际化（@/i18n）等逻辑；页面、布局、样式全部在 src/h5/ 下，
 *   网页版 / 客户端（src/main.ts、src/layout、src/pages）不受影响
 * - UI 用 Vant 4（移动端组件库），适配 iPhone 17（402×874）/ 17 Pro Max（440×956）：刘海 / 灵动岛 / 底部横条用安全区留白
 */
import { createApp } from 'vue'
import Vant, { showFailToast, showSuccessToast, showToast } from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import { createH5Router } from './router'
import { initLocale, loadRemoteDictionary } from '@/i18n'
import { initTheme } from '@/utils/theme'
import { setRequestNotifier } from '@/utils/request'
import './styles.css'

/*
 * 国际化：英文全部取接口（GET /i18n/all，管理后台「国际化翻译」维护），前端不带任何翻译。
 * Vant 组件始终输出中文（默认 zh-CN），与页面文案一样由 @/i18n 按接口词典翻译，不使用 Vant 自带的英文语言包
 */

// 接口提示（成功 / 失败 / 登录失效）用 Vant 的轻提示，替代网页版的 ant-design-vue message
setRequestNotifier({
  success: (text) => showSuccessToast(text),
  error: (text) => showFailToast(text),
  warning: (text) => showToast(text),
})

async function bootstrap() {
  initTheme()
  // 国际化译文：和网页版同一接口；本地有缓存时不等接口
  void loadRemoteDictionary()
  const app = createApp(App)
  app.use(createH5Router())
  app.use(Vant)
  app.mount('#app')
  initLocale()
}

void bootstrap()
