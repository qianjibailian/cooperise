import { defineConfig, loadEnv, type Plugin } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'
import { webUpdateNotice } from '@plugin-web-update-notification/vite'
import { resolve } from 'path'

/** 是否手机 H5 的前端路由（/h5、/h5/xxx，不含带扩展名的静态资源） */
function isH5Route(url: string) {
  return /^\/h5(\/|$|\?)/.test(url) && !/\.[a-z0-9]+$/i.test(url.split('?')[0])
}

/**
 * 访问手机 H5 时把前端路由回退到 H5 页面：
 * - 开发（npm run dev）：返回源码里的 h5.html
 * - 内网预览（npm run preview:lan）：返回构建产物 dist/h5/h5.html（否则会落到网页版的 index.html）
 * 生产环境由 nginx 的 location /h5/ 完成同样的回退（见 nginx.conf）
 */
function h5Fallback(): Plugin {
  return {
    name: 'cooperise-h5-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (isH5Route(req.url || '')) req.url = '/h5.html'
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (isH5Route(req.url || '')) req.url = '/h5/h5.html'
        next()
      })
    },
  }
}

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

  // ---- 手机 H5：独立入口（h5.html → src/h5/main.ts），产物 dist/h5，部署在 /h5/ 下；不参与 qiankun、不打 UMD ----
  // h5：生产（直连 VITE_API_DOMAIN）；h5-lan：内网（走同源 /api，由 preview:lan 代理）
  if (mode === 'h5' || mode === 'h5-lan') {
    return {
      base: '/h5/',
      plugins: [vuePlugin()],
      resolve: {
        alias: [
          { find: '@', replacement: resolve(__dirname, './src') },
          // 共用的 @/i18n 会引入 vxe 表格的语言包 / VxeUI，H5 用不到，换成空实现（否则整个表格库会打进手机包）
          { find: /^vxe-pc-ui(\/.*)?$/, replacement: resolve(__dirname, './src/h5/stubs/vxe.ts') },
          { find: /^vxe-table\/.*$/, replacement: resolve(__dirname, './src/h5/stubs/vxe.ts') },
          // 共用的 @/utils/request 默认用 antd message，H5 已换成 Vant 提示，antd 换成空实现
          { find: /^ant-design-vue$/, replacement: resolve(__dirname, './src/h5/stubs/antd.ts') },
        ],
      },
      build: {
        // iOS 17+ 的 Safari / 微信内置浏览器
        target: ['es2020', 'safari15', 'chrome87'],
        cssTarget: ['safari15', 'chrome87'],
        outDir: 'dist/h5',
        emptyOutDir: true,
        assetsDir: 'assets',
        rollupOptions: { input: resolve(__dirname, 'h5.html') },
      },
    }
  }

  return {
  plugins: [
    h5Fallback(),
    vuePlugin(),
    qiankun('cooperise', {
      useDevMode: process.env.NODE_ENV === 'development',
    }),
    // 轮询新构建；自带弹窗隐藏，由 src/components/ReleaseNotice.vue 监听 plugin_web_update_notice 展示（含更新说明）
    webUpdateNotice({
      logVersion: true,
      locale: 'zh_CN',
      hiddenDefaultNotification: true,
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
