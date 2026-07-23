import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as antd from 'antd'
import * as AntdIcons from '@ant-design/icons'
import * as axios from 'axios'
import * as ReactRouterDOM from 'react-router-dom'

const QIANJISAN_URL = import.meta.env.VITE_QIANJISAN_URL

let cssLoaded = false
let sharedInitialized = false

if (!(String.prototype as any).forEach) {
  (String.prototype as any).forEach = function(callback: (value: string, index: number, array: string[]) => void, thisArg?: any) {
    return [this as string].forEach(callback, thisArg)
  }
}

const initShared = () => {
  if (sharedInitialized) return
  const sharedScope = {
    default: {
      react: {
        '18.3.1': {
          get: () => Promise.resolve(() => React),
          from: 'host',
        },
      },
      'react-dom': {
        '18.3.1': {
          get: () => Promise.resolve(() => ({
            ...ReactDOM,
            createRoot: ReactDOM.createRoot,
          })),
          from: 'host',
        },
      },
      'react-dom/client': {
        '18.3.1': {
          get: () => Promise.resolve(() => ReactDOM),
          from: 'host',
        },
      },
      antd: {
        '5.0.0': {
          get: () => Promise.resolve(() => antd),
          from: 'host',
        },
      },
      '@ant-design/icons': {
        '5.0.0': {
          get: () => Promise.resolve(() => AntdIcons),
          from: 'host',
        },
      },
      axios: {
        '1.0.0': {
          get: () => Promise.resolve(() => axios),
          from: 'host',
        },
      },
      'react-router-dom': {
        '6.0.0': {
          get: () => Promise.resolve(() => ReactRouterDOM),
          from: 'host',
        },
      },
    },
  }
  ;(globalThis as any).__federation_shared__ = sharedScope
  sharedInitialized = true
}

export const loadRemoteCss = async () => {
  if (cssLoaded) return
  try {
    const response = await fetch(QIANJISAN_URL)
    const html = await response.text()
    const cssRegex = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g
    let match
    while ((match = cssRegex.exec(html)) !== null) {
      const cssHref = match[1]
      const cssUrl = cssHref.startsWith('http') 
        ? cssHref 
        : QIANJISAN_URL + (cssHref.startsWith('/') ? '' : '/') + cssHref
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = cssUrl
      document.head.appendChild(link)
    }
    cssLoaded = true
  } catch (e) {
    console.error('[RemoteLoader] 加载远程 CSS 失败:', e)
  }
}

export const loadRemoteModule = async (moduleName: string) => {
  initShared()
  const remoteUrl = `${QIANJISAN_URL}/assets/remoteEntry.js`
  const remote = await import(/* @vite-ignore */ remoteUrl)
  if (typeof remote.init === 'function') {
    try {
      remote.init((globalThis as any).__federation_shared__.default)
    } catch (e) {
      console.warn('[RemoteLoader] remote.init 警告:', e)
    }
  }
  const moduleFactory = await remote.get(moduleName)
  const mod = moduleFactory()
  return mod.default || mod
}

export { QIANJISAN_URL }
