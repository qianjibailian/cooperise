import type { CapacitorConfig } from '@capacitor/cli'

/**
 * iOS / 原生壳打包配置（Capacitor）
 *
 * 打包流程：
 *   pnpm ios:sync  → 构建 dist 并同步到 ios/App/App/public
 *   pnpm ios:open  → 用 Xcode 打开工程，选择真机 / 模拟器运行或 Archive 出包
 *
 * 说明：
 * - webDir 指向 vite 的构建产物，iOS 端不加载远程页面，静态资源随 App 一起分发
 * - 接口域名由 .env.ios 的 VITE_API_DOMAIN 指定（App 内没有同源后端可代理）
 * - 后端需要允许来自 capacitor://localhost 的跨域请求（见 README 的 iOS 打包说明）
 */
const config: CapacitorConfig = {
  appId: 'com.speedx.cooperise',
  appName: 'Cooperise',
  webDir: 'dist',
  ios: {
    // 内容延伸到安全区，由前端用 env(safe-area-inset-*) 自行留白（顶部 56px 导航 / 底部标签栏）
    contentInset: 'never',
    backgroundColor: '#ffffff',
  },
}

export default config
