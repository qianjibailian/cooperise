/**
 * Windows 客户端（Electron）桥接：electron/preload.cjs 注入 window.cooperiseDesktop。
 * 浏览器里访问时为 undefined，所有调用方需先判断 isDesktop。
 */
export interface DesktopInfo {
  version: string
  electron: string
  apiTarget: string
  defaultApiTarget: string
  configPath: string
}

export interface DesktopBridge {
  platform: string
  getInfo: () => Promise<DesktopInfo>
  setApiTarget: (value: string) => Promise<{ ok: boolean; message?: string; apiTarget?: string }>
  openConfigDir: () => Promise<void>
  toggleDevTools: () => Promise<void>
  /** 自绘窗口按钮：返回操作后窗口是否最大化；'state' 只查询不操作 */
  windowAction: (action: 'minimize' | 'toggle-maximize' | 'close' | 'state') => Promise<boolean>
  /** 订阅最大化状态变化，返回取消订阅函数 */
  onMaximizedChange: (cb: (maximized: boolean) => void) => () => void
  getSavedLogin: () => Promise<{ email: string; password: string; rememberPassword: boolean } | null>
  saveLogin: (payload: { email: string; password: string; rememberPassword: boolean }) => Promise<boolean>
  canEncryptPassword: () => Promise<boolean>
  /** supported=false：开发模式（未安装）不支持 */
  getAutoStart: () => Promise<{ supported: boolean; enabled: boolean }>
  setAutoStart: (enabled: boolean) => Promise<{ ok: boolean; enabled?: boolean; message?: string }>
  /** 把当前登录 token 同步给主进程（MCP 服务以该用户身份调后端）；退出登录传空串 */
  syncSession: (token: string) => Promise<boolean>
  getMcpStatus: () => Promise<McpStatus>
  setMcpEnabled: (enabled: boolean) => Promise<McpStatus>
  resetMcpKey: () => Promise<McpStatus>
}

export interface McpStatus {
  enabled: boolean
  running: boolean
  /** 启动失败原因（如端口被占用） */
  error: string
  /** 如 http://127.0.0.1:18084/mcp */
  url: string
  accessKey: string
  /** 客户端是否已登录（未登录时 AI 调用会提示先登录） */
  loggedIn: boolean
}

export const desktop: DesktopBridge | undefined =
  typeof window === 'undefined' ? undefined : (window as unknown as { cooperiseDesktop?: DesktopBridge }).cooperiseDesktop

export const isDesktop = !!desktop

export const isMacDesktop = desktop?.platform === 'darwin'

/** 客户端下给 <html> 加 is-desktop（macOS 另加 is-mac），样式据此把顶栏变成可拖动的标题栏并给系统窗口按钮留位 */
export function markDesktop() {
  if (isDesktop) document.documentElement.classList.add('is-desktop')
  if (isMacDesktop) document.documentElement.classList.add('is-mac')
}
