/**
 * 客户端 preload：向页面暴露最小化的桌面能力（window.cooperiseDesktop），不暴露 Node / ipcRenderer 本身。
 * 页面据此判断是否运行在客户端（加 html.is-desktop 样式），并提供「客户端设置」。
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cooperiseDesktop', {
  platform: process.platform,
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  setApiTarget: (value) => ipcRenderer.invoke('desktop:set-api-target', value),
  openConfigDir: () => ipcRenderer.invoke('desktop:open-config-dir'),
  toggleDevTools: () => ipcRenderer.invoke('desktop:toggle-devtools'),
  // 自绘窗口按钮：minimize / toggle-maximize / close，返回操作后是否最大化（传 'state' 只查询）
  windowAction: (action) => ipcRenderer.invoke('desktop:window', action),
  onMaximizedChange: (cb) => {
    const listener = (_e, maximized) => cb(!!maximized)
    ipcRenderer.on('desktop:window:maximized', listener)
    return () => ipcRenderer.removeListener('desktop:window:maximized', listener)
  },
  // 记住账号 / 密码（密码由主进程用系统加密保存）
  getSavedLogin: () => ipcRenderer.invoke('desktop:login:get'),
  saveLogin: (payload) => ipcRenderer.invoke('desktop:login:save', payload),
  canEncryptPassword: () => ipcRenderer.invoke('desktop:login:can-encrypt'),
  // 开机自启动
  getAutoStart: () => ipcRenderer.invoke('desktop:autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('desktop:autostart:set', enabled),
  // MCP 服务：同步登录态 + 开关 / 状态 / 重置访问密钥
  syncSession: (token) => ipcRenderer.invoke('desktop:session', token),
  getMcpStatus: () => ipcRenderer.invoke('desktop:mcp:get'),
  setMcpEnabled: (enabled) => ipcRenderer.invoke('desktop:mcp:set', enabled),
  resetMcpKey: () => ipcRenderer.invoke('desktop:mcp:reset-key'),
})
