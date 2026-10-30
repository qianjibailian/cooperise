import { defineConfig, loadEnv } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'
import { webUpdateNotice } from '@plugin-web-update-notification/vite'
import { resolve } from 'path'

// 内网访问：dev / preview 均监听 0.0.0.0，同事通过「本机 IP:8083」访问；
// 前端请求统一走同源 /api，由本服务代理到后端（VITE_PROXY_TARGET，默认本机 8080），对方浏览器无需直连后端
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080'
  const proxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
    },
    '/qianjisan-assets': {
      target: 'http://localhost:5173',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/qianjisan-assets/, '/assets'),
    },
  }

  return {
  plugins: [
    vuePlugin(),
    qiankun('cooperise', {
      useDevMode: process.env.NODE_ENV === 'development',
    }),
    webUpdateNotice({
      logVersion: true,
      locale: 'zh_CN',
      notificationProps: {
        title: '系统更新通知',
        description: '发现新版本，建议刷新页面获取最新体验',
        buttonText: '立即刷新',
        dismissButtonText: '稍后',
      },
    }),
  ],
  optimizeDeps: {
    include: [
      '@wangeditor/editor',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8083,
    strictPort: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    },
    proxy,
  },
  // 打包后的内网预览（npm run preview:lan）：同样监听 0.0.0.0 并代理 /api
  preview: {
    host: '0.0.0.0',
    port: 8083,
    strictPort: true,
    proxy,
  },
  build: {
    // 兼容基线（参考 Apple 官网）：Chrome / Edge 87+、Firefox 78+、Safari 14+；
    // ??= 等新语法会被降级，360 / QQ 等国产浏览器的旧 Chromium 内核也能运行
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
    cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        format: 'umd',
        name: 'cooperise',
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter',
          'ant-design-vue': 'antd',
        },
      },
    },
  },
}
})
