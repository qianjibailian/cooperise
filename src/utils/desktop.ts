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
  getSavedLogin: () => Promise<{ email: string; password: string; rememberPassword: boolean } | null>
  saveLogin: (payload: { email: string; password: string; rememberPassword: boolean }) => Promise<boolean>
  canEncryptPassword: () => Promise<boolean>
}

export const desktop: DesktopBridge | undefined =
  typeof window === 'undefined' ? undefined : (window as unknown as { cooperiseDesktop?: DesktopBridge }).cooperiseDesktop

export const isDesktop = !!desktop

/** 客户端下给 <html> 加 is-desktop，样式据此把顶栏变成可拖动的标题栏并给系统窗口按钮留位 */
export function markDesktop() {
  if (isDesktop) document.documentElement.classList.add('is-desktop')
}
