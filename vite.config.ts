import { defineConfig } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'
import { webUpdateNotice } from '@plugin-web-update-notification/vite'
import { resolve } from 'path'

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
    port: 8083,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    },
    proxy: {
      '/queqiao': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
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
