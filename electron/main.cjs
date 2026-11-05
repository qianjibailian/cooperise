/**
 * Cooperise 桌面客户端（Electron 主进程，Windows / macOS）
 *
 * 思路：客户端启动时在本机 127.0.0.1 起一个与 `vite preview` 等价的小服务——
 *   - 静态托管打包产物 dist（History 路由回退到 index.html）
 *   - /api/* 代理到后端（去掉 /api 前缀，等价 vite 的 proxy 配置）
 * 这样前端代码无需改动：请求仍走同源 /api，Cookie / localStorage 登录态、History 路由都照常工作，也没有跨域问题。
 *
 * 外观参考 Apifox：隐藏原生标题栏与菜单栏，系统窗口按钮（最小化 / 最大化 / 关闭）嵌入应用顶栏，顶栏空白处可拖动窗口；
 * 记住窗口大小与位置；右键菜单；客户端设置（后端地址）在头像菜单 →「客户端设置」。
 *
 * 后端地址等配置：Windows %APPDATA%/Cooperise/config.json；macOS ~/Library/Application Support/Cooperise/config.json。
 * 开发调试：`pnpm electron:dev`（自动启动 / 复用 vite dev server 并加载它）。
 */
const { app, BrowserWindow, Menu, shell, dialog, screen, ipcMain, safeStorage } = require('electron')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { startMcpServer } = require('./mcp.cjs')

const DEFAULT_CONFIG = require('./default-config.json')
const DIST_DIR = path.join(__dirname, '..', 'dist')
const ICON = path.join(__dirname, 'assets', 'icon.png')
const PRELOAD = path.join(__dirname, 'preload.cjs')
const devUrlArg = process.argv.find((a) => a.startsWith('--dev-url='))
const DEV_URL = devUrlArg ? devUrlArg.slice('--dev-url='.length) : ''
/** 开机自启动时带的参数：据此最小化启动，不打扰开机 */
const AUTOSTART_ARG = '--autostart'
const IS_MAC = process.platform === 'darwin'
/** Windows 靠启动参数判断；macOS 登录项不支持参数，用 wasOpenedAtLogin（需 app ready 后读取） */
let launchedAtLogin = process.argv.includes(AUTOSTART_ARG)

/** 标题栏高度：与前端客户端页签栏（DesktopTabBar，--desktop-tabbar-height 42px）一致 */
const TITLE_BAR_HEIGHT = 42

/** 窗口最小尺寸（与 Apifox 一致 960×640）：与客户端下前端布局的 --app-min-width(960px) 对齐，避免整页出现滚动条 */
const MIN_WINDOW_WIDTH = 960
const MIN_WINDOW_HEIGHT = 640
/** 首次启动的默认尺寸（与 Apifox 一致） */
const DEFAULT_WINDOW_WIDTH = 1280
const DEFAULT_WINDOW_HEIGHT = 800

if (process.platform === 'win32') app.setAppUserModelId('com.speedx.cooperise')

// ---------------- 配置 ----------------
/** 后端地址暂时写死（default-config.json 的 apiTarget），客户端不展示、不允许修改；放开时改为 false 并去掉 loadConfig 里的覆盖 */
const API_TARGET_LOCKED = true
const configPath = () => path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  const file = configPath()
  let user = {}
  try {
    user = JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    // 首次启动或文件损坏：写一份默认配置，方便用户修改
    writeConfig(DEFAULT_CONFIG)
  }
  // 后端地址暂时固定为 default-config.json 里的值：忽略本机配置文件中旧的 apiTarget，界面上也不展示
  return { ...DEFAULT_CONFIG, ...user, apiTarget: DEFAULT_CONFIG.apiTarget }
}

function writeConfig(next) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true })
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}

let config = loadConfig()

/** 记住的登录账号（密码已加密），见 desktop:login:* */
const credentialsPath = () => path.join(app.getPath('userData'), 'credentials.json')

// ---------------- MCP 服务（供 Claude Code / Cursor 等 AI 工具调用，见 mcp.cjs） ----------------
/** 页面当前登录 token：由渲染进程登录 / 退出时同步过来，只存内存 */
let sessionToken = ''
let mcpServer = null
let mcpError = ''
const mcpKeyPath = () => path.join(app.getPath('userData'), 'mcp-key')

/** 访问密钥：首次开启时生成，保存在本机；重置后旧配置立即失效 */
function getMcpAccessKey(regenerate = false) {
  if (!regenerate) {
    try {
      const k = fs.readFileSync(mcpKeyPath(), 'utf-8').trim()
      if (k.length >= 32) return k
    } catch {
      // 首次生成
    }
  }
  const k = 'cpk_' + crypto.randomBytes(24).toString('base64url')
  fs.mkdirSync(path.dirname(mcpKeyPath()), { recursive: true })
  fs.writeFileSync(mcpKeyPath(), k, 'utf-8')
  return k
}

const mcpPort = () => Number(config.mcpPort) || DEFAULT_CONFIG.mcpPort

async function startMcp() {
  if (mcpServer) return
  mcpError = ''
  try {
    getMcpAccessKey() // 确保已生成
    mcpServer = await startMcpServer(
      {
        version: app.getVersion(),
        getToken: () => sessionToken,
        getApiTarget: () => config.apiTarget,
        getAccessKey: () => getMcpAccessKey(),
      },
      mcpPort(),
    )
  } catch (e) {
    mcpServer = null
    // 端口固定不回退：AI 工具里配置的地址依赖这个端口
    mcpError = e.code === 'EADDRINUSE' ? `端口 ${mcpPort()} 已被占用，可在配置文件中修改 mcpPort` : e.message
  }
}

function stopMcp() {
  return new Promise((resolve) => {
    if (!mcpServer) return resolve()
    const s = mcpServer
    mcpServer = null
    s.close(() => resolve())
    s.closeAllConnections?.()
  })
}

function mcpStatus() {
  const enabled = !!config.mcpEnabled
  return {
    enabled,
    running: !!mcpServer,
    error: mcpError,
    url: `http://127.0.0.1:${mcpPort()}/mcp`,
    accessKey: enabled ? getMcpAccessKey() : '',
    loggedIn: !!sessionToken,
  }
}

// ---------------- 窗口状态（大小 / 位置 / 是否最大化） ----------------
const statePath = () => path.join(app.getPath('userData'), 'window-state.json')

/** 把记录下来的窗口尺寸拉回最小值，避免旧版本留下的小窗口一启动就有滚动条 */
function clampToMinSize(size) {
  return {
    ...size,
    width: Math.max(MIN_WINDOW_WIDTH, Math.round(Number(size.width) || 0)),
    height: Math.max(MIN_WINDOW_HEIGHT, Math.round(Number(size.height) || 0)),
  }
}

function loadWindowState() {
  // 默认参考 Apifox：1280×800 居中；小屏按工作区 90% 收缩
  const { width: areaW, height: areaH } = screen.getPrimaryDisplay().workAreaSize
  const fallback = {
    width: Math.min(DEFAULT_WINDOW_WIDTH, Math.round(areaW * 0.9)),
    height: Math.min(DEFAULT_WINDOW_HEIGHT, Math.round(areaH * 0.9)),
  }
  try {
    const s = JSON.parse(fs.readFileSync(statePath(), 'utf-8'))
    if (!(s.width > 0 && s.height > 0)) return clampToMinSize(fallback)
    // 上次所在的显示器已拔掉：不恢复位置，回到居中
    if (typeof s.x === 'number' && typeof s.y === 'number') {
      const visible = screen.getAllDisplays().some(({ workArea: a }) =>
        s.x + 100 > a.x && s.x < a.x + a.width - 100 && s.y >= a.y - 10 && s.y < a.y + a.height - 100)
      if (!visible) return clampToMinSize({ width: s.width, height: s.height, maximized: s.maximized })
    }
    return clampToMinSize(s)
  } catch {
    return clampToMinSize(fallback)
  }
}

function trackWindowState(win) {
  let timer = null
  const save = () => {
    if (win.isDestroyed() || win.isMinimized()) return
    const maximized = win.isMaximized()
    // 最大化时记录还原尺寸，下次还原后仍是用户习惯的大小
    const b = maximized ? win.getNormalBounds() : win.getBounds()
    try {
      fs.writeFileSync(statePath(), JSON.stringify({ ...b, maximized }), 'utf-8')
    } catch {
      // ignore
    }
  }
  const debounced = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 400)
  }
  win.on('resize', debounced)
  win.on('move', debounced)
  win.on('close', save)
}

// ---------------- 本地服务：静态资源 + /api 代理 ----------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function serveFile(res, file, status = 200) {
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
      return
    }
    const ext = path.extname(file).toLowerCase()
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' }
    // index.html / 版本文件不缓存，带 hash 的资源长缓存
    headers['Cache-Control'] = ext === '.html' || ext === '.json' ? 'no-cache' : 'public, max-age=31536000, immutable'
    res.writeHead(status, headers)
    res.end(buf)
  })
}

function serveStatic(req, res) {
  let pathname = '/'
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    // ignore
  }
  const file = path.normalize(path.join(DIST_DIR, pathname))
  if (!file.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end()
    return
  }
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) return serveFile(res, file)
    // 带扩展名却不存在 → 404；否则视为前端路由，回退 index.html
    if (path.extname(pathname)) {
      res.writeHead(404)
      res.end()
      return
    }
    serveFile(res, path.join(DIST_DIR, 'index.html'))
  })
}

function proxyApi(req, res) {
  let target
  try {
    target = new URL(config.apiTarget)
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ success: false, message: `后端地址配置错误：${config.apiTarget}` }))
    return
  }
  const client = target.protocol === 'https:' ? https : http
  const basePath = target.pathname.replace(/\/$/, '')
  const forwardPath = basePath + req.url.replace(/^\/api/, '')
  const headers = { ...req.headers, host: target.host } // changeOrigin
  delete headers.origin
  delete headers.referer

  const upstream = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: forwardPath,
      headers,
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, upRes.headers)
      upRes.pipe(res)
    },
  )
  upstream.on('error', (e) => {
    if (res.headersSent) return res.end()
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ success: false, message: `无法连接后端 ${config.apiTarget}：${e.message}` }))
  })
  req.pipe(upstream)
}

function startLocalServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/api' || req.url.startsWith('/api/')) return proxyApi(req, res)
    serveStatic(req, res)
  })
  return new Promise((resolve, reject) => {
    // 固定端口：localStorage / Cookie 按 origin 隔离，端口不变才能保持登录态与个人设置
    server.once('error', (e) => {
      if (e.code !== 'EADDRINUSE') return reject(e)
      // 端口被占用：退回随机端口（本次启动需要重新登录）
      server.listen(0, '127.0.0.1', () => resolve(server.address().port))
    })
    server.listen(Number(config.port) || DEFAULT_CONFIG.port, '127.0.0.1', () => resolve(server.address().port))
  })
}

// ---------------- 窗口 ----------------
let mainWindow = null
let appOrigin = ''

function isAppUrl(url) {
  try {
    return new URL(url).origin === appOrigin
  } catch {
    return false
  }
}

/** 所有窗口共用：隐藏原生标题栏，系统按钮嵌入顶栏
 *  - Windows：Window Controls Overlay，按钮在右侧
 *  - macOS：红绿灯在左侧，垂直居中到 56px 顶栏 */
function baseWindowOptions() {
  const chrome = IS_MAC
    ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 18, y: Math.round((TITLE_BAR_HEIGHT - 16) / 2) } }
    // Windows：不用原生 Window Controls Overlay（样式不可定制），最小化 / 最大化 / 关闭由前端 WindowControls 自绘
    : { titleBarStyle: 'hidden', icon: ICON }
  return {
    ...chrome,
    title: 'Cooperise',
    backgroundColor: '#ffffff',
    // 客户端下前端布局 min-width 为 960px（App.vue 的 html.is-desktop --app-min-width），
    // 窗口再小就会出滚动条，所以窗口最小尺寸与之对齐
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  }
}

function attachWindowBehaviors(win) {
  // window.open / target=_blank：应用内页面开新窗口，外部链接交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { ...baseWindowOptions(), width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT } }
    }
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAppUrl(url)) {
      e.preventDefault()
      if (/^(https?|mailto):/i.test(url)) shell.openExternal(url)
    }
  })
  win.webContents.on('did-create-window', (child) => attachWindowBehaviors(child))
  // 最大化状态变化通知前端，自绘的「最大化 / 还原」按钮据此切换图标
  const sendMaximized = () => {
    if (!win.isDestroyed()) win.webContents.send('desktop:window:maximized', win.isMaximized())
  }
  win.on('maximize', sendMaximized)
  win.on('unmaximize', sendMaximized)
  win.webContents.on('before-input-event', (e, input) => handleShortcut(win, e, input))
  win.webContents.on('context-menu', (_e, params) => showContextMenu(win, params))
}

/** 菜单栏已隐藏，常用快捷键在这里处理 */
function handleShortcut(win, e, input) {
  if (input.type !== 'keyDown') return
  const ctrl = input.control || input.meta
  const wc = win.webContents
  const key = input.key
  let handled = true
  // macOS 的刷新 / 缩放 / 全屏 / 开发者工具由应用菜单（buildMacMenu）提供，这里只处理 Windows
  if (IS_MAC) return
  if (key === 'F5' && ctrl) wc.reloadIgnoringCache()
  else if (key === 'F5' || (ctrl && key.toLowerCase() === 'r')) wc.reload()
  else if (key === 'F12' || (ctrl && input.shift && key.toLowerCase() === 'i')) wc.toggleDevTools()
  else if (key === 'F11') win.setFullScreen(!win.isFullScreen())
  else if (ctrl && (key === '=' || key === '+')) wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 4))
  else if (ctrl && key === '-') wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3))
  else if (ctrl && key === '0') wc.setZoomLevel(0)
  else handled = false
  if (handled) e.preventDefault()
}

/** 右键菜单：输入框（剪切 / 复制 / 粘贴 / 全选）、选中文字（复制）、链接（复制链接） */
function showContextMenu(win, params) {
  const items = []
  if (params.isEditable) {
    items.push(
      { label: '撤销', role: 'undo', enabled: params.editFlags.canUndo },
      { label: '重做', role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { label: '剪切', role: 'cut', enabled: params.editFlags.canCut },
      { label: '复制', role: 'copy', enabled: params.editFlags.canCopy },
      { label: '粘贴', role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { label: '全选', role: 'selectAll' },
    )
  } else if (params.selectionText.trim()) {
    items.push({ label: '复制', role: 'copy' })
  }
  if (params.linkURL && !params.linkURL.startsWith('javascript:')) {
    if (items.length) items.push({ type: 'separator' })
    items.push({ label: '复制链接', click: () => require('electron').clipboard.writeText(params.linkURL) })
    if (!isAppUrl(params.linkURL)) items.push({ label: '在浏览器中打开', click: () => shell.openExternal(params.linkURL) })
  }
  if (!items.length) return
  Menu.buildFromTemplate(items).popup({ window: win })
}

function createMainWindow(url) {
  const state = loadWindowState()
  mainWindow = new BrowserWindow({
    ...baseWindowOptions(),
    width: state.width,
    height: state.height,
    ...(typeof state.x === 'number' ? { x: state.x, y: state.y } : { center: true }),
    show: false,
  })
  mainWindow.once('ready-to-show', () => {
    if (state.maximized) mainWindow.maximize()
    if (launchedAtLogin) {
      launchedAtLogin = false // 仅首个窗口；macOS 关窗后从 Dock 重新打开时正常显示
      // 开机自启动：最小化到任务栏 / Dock，不抢焦点
      mainWindow.showInactive()
      mainWindow.minimize()
    } else {
      mainWindow.show()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  trackWindowState(mainWindow)
  attachWindowBehaviors(mainWindow)
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
    if (code === -3) return // 用户中止
    dialog.showErrorBox('页面加载失败', `${failedUrl}\n${desc} (${code})`)
  })
  mainWindow.loadURL(url)
}

// ---------------- 渲染进程接口（preload 暴露为 window.cooperiseDesktop） ----------------
function registerIpc() {
  ipcMain.handle('desktop:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    apiTarget: config.apiTarget,
    defaultApiTarget: DEFAULT_CONFIG.apiTarget,
    configPath: configPath(),
  }))
  ipcMain.handle('desktop:set-api-target', (_e, value) => {
    if (API_TARGET_LOCKED) return { ok: false, message: '后端地址已固定，暂不支持修改' }
    let url
    try {
      url = new URL(String(value || '').trim())
      if (!/^https?:$/.test(url.protocol)) throw new Error('protocol')
    } catch {
      return { ok: false, message: '请输入 http:// 或 https:// 开头的地址' }
    }
    const next = { ...loadConfig(), apiTarget: url.origin + url.pathname.replace(/\/$/, '') }
    if (!writeConfig(next)) return { ok: false, message: '配置文件写入失败' }
    config = next
    return { ok: true, apiTarget: config.apiTarget }
  })
  ipcMain.handle('desktop:open-config-dir', () => shell.showItemInFolder(configPath()))

  // 记住账号 / 密码：密码用 safeStorage（Windows DPAPI，绑定当前系统用户）加密后落盘，不保存明文
  ipcMain.handle('desktop:login:get', () => {
    try {
      const s = JSON.parse(fs.readFileSync(credentialsPath(), 'utf-8'))
      let password = ''
      if (s.password && safeStorage.isEncryptionAvailable()) {
        try {
          password = safeStorage.decryptString(Buffer.from(s.password, 'base64'))
        } catch {
          // 换了系统用户 / 机器：无法解密，当作没记住密码
        }
      }
      return { email: String(s.email || ''), password, rememberPassword: !!password }
    } catch {
      return null
    }
  })
  ipcMain.handle('desktop:login:save', (_e, payload) => {
    const email = String(payload?.email || '').trim()
    const rememberPassword = !!payload?.rememberPassword && safeStorage.isEncryptionAvailable()
    const password = rememberPassword && payload?.password
      ? safeStorage.encryptString(String(payload.password)).toString('base64')
      : ''
    try {
      if (!email) {
        fs.rmSync(credentialsPath(), { force: true })
      } else {
        fs.writeFileSync(credentialsPath(), JSON.stringify({ email, password }), 'utf-8')
      }
      return true
    } catch {
      return false
    }
  })
  ipcMain.handle('desktop:login:can-encrypt', () => safeStorage.isEncryptionAvailable())

  // 开机自启动：Windows 写入当前用户启动项（HKCU\...\Run，带 --autostart 参数）；macOS 写入「登录项」。启动后最小化
  const loginItemOpts = IS_MAC ? {} : { args: [AUTOSTART_ARG] }
  ipcMain.handle('desktop:autostart:get', () => ({
    supported: app.isPackaged,
    enabled: app.isPackaged && app.getLoginItemSettings(loginItemOpts).openAtLogin,
  }))
  ipcMain.handle('desktop:autostart:set', (_e, enabled) => {
    // 开发模式下可执行文件是 Electron 本体，注册进去开机会打开空白 Electron，故只在安装版生效
    if (!app.isPackaged) return { ok: false, message: '仅安装版客户端支持开机自启动' }
    app.setLoginItemSettings({ openAtLogin: !!enabled, ...loginItemOpts })
    return { ok: true, enabled: app.getLoginItemSettings(loginItemOpts).openAtLogin }
  })
  ipcMain.handle('desktop:toggle-devtools', (e) => e.sender.toggleDevTools())

  // 自绘窗口按钮（Windows）：作用于发送消息的那个窗口
  ipcMain.handle('desktop:window', (e, action) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return false
    if (action === 'minimize') win.minimize()
    else if (action === 'toggle-maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
    else if (action === 'close') win.close()
    return win.isMaximized()
  })

  // 登录态同步（MCP 以当前登录用户身份调后端）：只接受主窗口的消息
  ipcMain.handle('desktop:session', (e, token) => {
    if (!mainWindow || e.sender !== mainWindow.webContents) return false
    sessionToken = typeof token === 'string' ? token : ''
    return true
  })
  ipcMain.handle('desktop:mcp:get', () => mcpStatus())
  ipcMain.handle('desktop:mcp:set', async (_e, enabled) => {
    const next = { ...loadConfig(), mcpEnabled: !!enabled }
    if (!writeConfig(next)) return { ...mcpStatus(), error: '配置文件写入失败' }
    config = next
    if (enabled) await startMcp()
    else {
      await stopMcp()
      mcpError = ''
    }
    return mcpStatus()
  })
  ipcMain.handle('desktop:mcp:reset-key', () => {
    getMcpAccessKey(true)
    return mcpStatus()
  })
}

/** macOS 的菜单栏在屏幕顶部而非窗口内，必须保留：否则 ⌘C / ⌘V / ⌘Q 等系统快捷键全部失效 */
function buildMacMenu() {
  return Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 Cooperise' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '显示',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { role: 'close', label: '关闭窗口' },
        { type: 'separator' },
        { role: 'front', label: '全部置于顶层' },
      ],
    },
  ])
}

let appUrl = ''

// 单实例：再次双击图标时激活已有窗口
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    // Windows 不使用原生菜单栏（参考 Apifox），快捷键与右键菜单见 attachWindowBehaviors；macOS 保留屏幕顶部菜单栏
    Menu.setApplicationMenu(IS_MAC ? buildMacMenu() : null)
    if (IS_MAC && app.isPackaged) launchedAtLogin = !!app.getLoginItemSettings().wasOpenedAtLogin
    registerIpc()
    let url = DEV_URL
    if (!url) {
      try {
        const port = await startLocalServer()
        url = `http://127.0.0.1:${port}/`
      } catch (e) {
        dialog.showErrorBox('启动失败', `本地服务启动失败：${e.message}`)
        app.quit()
        return
      }
    }
    appOrigin = new URL(url).origin
    appUrl = url
    createMainWindow(url)
    if (config.mcpEnabled) startMcp()
  })

  // macOS 习惯：关掉窗口应用仍在 Dock，点 Dock 图标重新打开窗口；⌘Q 才真正退出
  app.on('window-all-closed', () => {
    if (!IS_MAC) app.quit()
  })
  app.on('activate', () => {
    if (!appUrl) return
    if (mainWindow) mainWindow.show()
    else createMainWindow(appUrl)
  })
}
