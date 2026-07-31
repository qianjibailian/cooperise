import { ref, onMounted, onUnmounted } from 'vue'

interface VersionInfo {
  version: string
  buildTime: string
}

const CHECK_INTERVAL = 5 * 60 * 1000 // 5分钟轮询一次
const VERSION_CACHE_KEY = '__APP_VERSION__'

export function useVersionCheck() {
  const hasNewVersion = ref(false)
  const newVersionInfo = ref<VersionInfo | null>(null)
  let checkTimer: ReturnType<typeof setInterval> | null = null
  let isFirstCheck = true

  // 获取当前版本号（从页面加载时缓存的版本信息）
  function getCurrentVersion(): string | null {
    return sessionStorage.getItem(VERSION_CACHE_KEY)
  }

  // 设置当前版本号
  function setCurrentVersion(version: string) {
    sessionStorage.setItem(VERSION_CACHE_KEY, version)
  }

  // 请求服务器上的 version.json，附带时间戳防止缓存
  async function fetchVersionInfo(): Promise<VersionInfo | null> {
    try {
      const timestamp = Date.now()
      const res = await fetch(`/version.json?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      })
      if (!res.ok) return null
      return (await res.json()) as VersionInfo
    } catch {
      return null
    }
  }

  // 执行版本检查
  async function checkVersion() {
    const remoteVersion = await fetchVersionInfo()
    if (!remoteVersion) return

    // 开发环境下 version.json 中的 version 为 "dev"，跳过提示
    if (remoteVersion.version === 'dev') {
      isFirstCheck = false
      return
    }

    const currentVersion = getCurrentVersion()

    // 首次检查：记录当前版本，不提示
    if (isFirstCheck) {
      if (!currentVersion) {
        setCurrentVersion(remoteVersion.version)
      }
      isFirstCheck = false
      return
    }

    // 后续检查：版本不一致则提示刷新
    if (currentVersion && currentVersion !== remoteVersion.version) {
      newVersionInfo.value = remoteVersion
      hasNewVersion.value = true
      // 检测到新版本后停止轮询，等待用户刷新
      if (checkTimer) {
        clearInterval(checkTimer)
        checkTimer = null
      }
    }
  }

  // 立即刷新页面
  function refreshPage() {
    window.location.reload()
  }

  // 关闭提示（稍后再说）
  function dismissUpdate() {
    hasNewVersion.value = false
    if (newVersionInfo.value) {
      setCurrentVersion(newVersionInfo.value.version)
    }
    // 关闭后恢复轮询
    if (!checkTimer) {
      checkTimer = setInterval(checkVersion, CHECK_INTERVAL)
    }
  }

  onMounted(() => {
    // 启动时立即检查一次
    checkVersion()
    // 之后每 5 分钟检查一次
    checkTimer = setInterval(checkVersion, CHECK_INTERVAL)
  })

  onUnmounted(() => {
    if (checkTimer) {
      clearInterval(checkTimer)
      checkTimer = null
    }
  })

  return {
    hasNewVersion,
    newVersionInfo,
    refreshPage,
    dismissUpdate,
    checkVersion,
  }
}
