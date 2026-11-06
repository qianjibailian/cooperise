/**
 * `npm run electron:dev`：一条命令启动客户端开发调试。
 *   - 本机 8083 已有 vite dev server（单独开着 `npm run dev`）→ 直接复用
 *   - 否则在本进程里启动 vite dev server（读 vite.config.ts，端口 8083）
 * 然后启动 Electron 加载它（页面改动热更新；改 electron/*.cjs 需重启本命令）。关掉客户端窗口即全部退出。
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const electronBin = require('electron') // 在 Node 中 require('electron') 返回可执行文件路径
const DEV_PORT = 8083
const DEV_URL = `http://localhost:${DEV_PORT}`

async function isServing(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

let server = null
if (await isServing(DEV_URL)) {
  console.log(`[electron:dev] 复用已运行的 dev server：${DEV_URL}`)
} else {
  console.log('[electron:dev] 启动 vite dev server…')
  server = await createServer({ mode: 'development' })
  await server.listen()
  server.printUrls()
}

// 开发时关掉 Electron 的安全提示（Insecure Content-Security-Policy）：
// 它只在开发环境出现——vite 热更新需要 eval，开发服务也不带 CSP；打包后的客户端不会出现
const child = spawn(electronBin, ['.', `--dev-url=${DEV_URL}`], {
  stdio: 'inherit',
  windowsHide: false,
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
})

async function shutdown(code) {
  if (server) await server.close().catch(() => {})
  process.exit(code ?? 0)
}

child.on('exit', (code) => shutdown(code))
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    child.kill()
    shutdown(0)
  })
}
