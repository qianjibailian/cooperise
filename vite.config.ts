import { defineConfig } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'
import federation from '@originjs/vite-plugin-federation'
import { resolve } from 'path'

// qianjisan 主应用的 remoteEntry 地址
const QIANJISAN_REMOTE = process.env.NODE_ENV === 'production'
  ? 'https://www.qianjisan.com/assets/remoteEntry.js'
  : 'http://localhost:5173/assets/remoteEntry.js'

export default defineConfig({
  plugins: [
    vuePlugin(),
    qiankun('cooperise', {
      useDevMode: process.env.NODE_ENV === 'development',
    }),
    federation({
      name: 'cooperiseApp',
      remotes: {
        qianjisanWWW: QIANJISAN_REMOTE,
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^18.0.0',
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0',
        },
        antd: {
          singleton: true,
          requiredVersion: '^5.0.0',
        },
        '@ant-design/icons': {
          singleton: true,
        },
        axios: {
          singleton: true,
        },
        'react-router-dom': {
          singleton: true,
        },
      } as any,
    }),
  ],
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