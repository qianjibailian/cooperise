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

const loadRemoteEntryCss = async () => {
  const cssFiles = [
    `${QIANJISAN_URL}/assets/index.css`,
    `${QIANJISAN_URL}/assets/main.css`,
  ]
  const results = await Promise.allSettled(cssFiles.map(url => loadCssByUrl(url)))
  const successCount = results.filter(r => r.status === 'fulfilled').length
  if (successCount === 0) {
    console.warn('[RemoteLoader] 未找到预定义的远程 CSS 文件，将通过 script 标签方式尝试获取')
    return false
  }
  return true
}

const loadRemoteCssByScript = async () => {
  return new Promise<void>((resolve, reject) => {
    const callbackName = '__qianjisan_css_loader__'
    const script = document.createElement('script')
    script.src = `${QIANJISAN_URL}/assets/css-manifest.js?callback=${callbackName}`
    
    ;(window as any)[callbackName] = (cssUrls: string[]) => {
      if (Array.isArray(cssUrls)) {
        cssUrls.forEach(href => {
          const cssUrl = href.startsWith('http')
            ? href
            : QIANJISAN_URL + (href.startsWith('/') ? '' : '/') + href
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = cssUrl
          document.head.appendChild(link)
        })
      }
      delete (window as any)[callbackName]
      document.head.removeChild(script)
      resolve()
    }
    
    script.onerror = () => {
      delete (window as any)[callbackName]
      document.head.removeChild(script)
      reject(new Error('CSS manifest 加载失败'))
    }
    
    document.head.appendChild(script)
  })
}

export const loadRemoteCss = async () => {
  if (cssLoaded) return
  try {
    const loaded = await loadRemoteEntryCss()
    if (!loaded) {
      try {
        await loadRemoteCssByScript()
      } catch {
        console.warn('[RemoteLoader] 远程 CSS 加载跳过，请确保主应用样式已正确引入')
      }
    }
    cssLoaded = true
  } catch (e) {
    console.error('[RemoteLoader] 加载远程 CSS 失败:', e)
  }
}

let remoteCache: any = null

const loadRemoteEntryByScript = async (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const remoteUrl = `${QIANJISAN_URL}/assets/remoteEntry.js`
    const script = document.createElement('script')
    script.src = remoteUrl
    script.onload = () => {
      const possibleNames = ['qianjisan', 'main', 'app', 'host', 'remote']
      let remote: any = null
      for (const name of possibleNames) {
        if ((window as any)[name] && typeof (window as any)[name].get === 'function') {
          remote = (window as any)[name]
          break
        }
      }
      if (remote) {
        resolve(remote)
      } else {
        reject(new Error('未找到远程模块全局变量，请确认 remoteEntry.js 已正确加载'))
      }
    }
    script.onerror = () => {
      reject(new Error(`remoteEntry.js 加载失败: ${remoteUrl}`))
    }
    document.head.appendChild(script)
  })
}

const loadRemoteEntryByImport = async (): Promise<any> => {
  const remoteUrl = `${QIANJISAN_URL}/assets/remoteEntry.js`
  return await import(/* @vite-ignore */ remoteUrl)
}

const getRemote = async () => {
  if (remoteCache) return remoteCache
  initShared()
  try {
    remoteCache = await loadRemoteEntryByScript()
  } catch (e) {
    console.warn('[RemoteLoader] script 方式加载失败，尝试动态 import:', e)
    remoteCache = await loadRemoteEntryByImport()
  }
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
