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
  // 记住账号 / 密码（密码由主进程用系统加密保存）
  getSavedLogin: () => ipcRenderer.invoke('desktop:login:get'),
  saveLogin: (payload) => ipcRenderer.invoke('desktop:login:save', payload),
  canEncryptPassword: () => ipcRenderer.invoke('desktop:login:can-encrypt'),
})
