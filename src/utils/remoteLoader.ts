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

const loadCssByUrl = (url: string) => {
  return new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`CSS 加载失败: ${url}`))
    document.head.appendChild(link)
  })
}

export const loadRemoteCss = async () => {
  if (cssLoaded) return
  try {
    await loadCssByUrl(`${QIANJISAN_URL}/assets/index.css`)
    cssLoaded = true
  } catch (e) {
    console.warn('[RemoteLoader] 远程 CSS 加载失败:', e)
  }
}

let remoteCache: any = null

const loadRemoteEntryByImport = async (): Promise<any> => {
  const remoteUrl = `${QIANJISAN_URL}/assets/remoteEntry.js`
  return await import(/* @vite-ignore */ remoteUrl)
}

const getRemote = async () => {
  if (remoteCache) return remoteCache
  initShared()
  remoteCache = await loadRemoteEntryByImport()
  if (typeof remoteCache.init === 'function') {
    try {
      remoteCache.init((globalThis as any).__federation_shared__.default)
    } catch (e) {
      console.warn('[RemoteLoader] remote.init 警告:', e)
    }
  }
  return remoteCache
}

export const loadRemoteModule = async (moduleName: string) => {
  const remote = await getRemote()
  const moduleFactory = await remote.get(moduleName)
  const mod = moduleFactory()
  return mod.default || mod
}

export { QIANJISAN_URL }
