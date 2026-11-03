/**
 * 客户端：把当前登录 token 同步给主进程，供内置 MCP 服务以当前用户身份调后端。
 * 登录 / 退出 / 登录失效时 token 变化会自动同步；浏览器访问时不做任何事。
 */
import { watch } from 'vue'
import { desktop } from '@/utils/desktop'
import { getToken, useAuth } from '@/utils/auth'

export function syncDesktopSession() {
  if (!desktop) return
  const { loginData, isLoggedIn } = useAuth()
  watch(
    () => [loginData.value, isLoggedIn.value],
    () => {
      desktop?.syncSession(isLoggedIn.value ? getToken() : '').catch(() => {})
    },
    { immediate: true },
  )
}
