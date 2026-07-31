import { defineConfig } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'
import { resolve } from 'path'
import { webUpdateNotice } from '@plugin-web-update-notification/vite'

export default defineConfig({
  plugins: [
    vuePlugin(),
    qiankun('cooperise', {
      useDevMode: process.env.NODE_ENV === 'development',
    }),
    webUpdateNotice({
      logVersion: true,
      locale: 'zh_CN',
      notificationProps: {
        title: '发现新版本',
        description: '系统已发布新代码，建议立即刷新页面以获取最新功能和修复',
        buttonText: '立即刷新',
        dismissButtonText: '稍后再说',
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
    port: 8083,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    },
    proxy: {
      '/qianjisan-assets': {
        target: 'http://localhost:5173',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/qianjisan-assets/, '/assets'),
      },
    },
  },
  build: {
    target: 'esnext',
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
})
