import { ref, readonly } from 'vue'

const AUTH_TOKEN_KEY = '_qj_token'
const AUTH_USERNAME_KEY = '_qj_username'

const isLoggedInRef = ref(checkLoginState())

function checkLoginState(): boolean {
  if (typeof document === 'undefined') return false
  const token = getCookie(AUTH_TOKEN_KEY)
  const username = getCookie(AUTH_USERNAME_KEY)
  return !!(token && username)
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^| )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function setAuthState(loggedIn: boolean) {
  isLoggedInRef.value = loggedIn
  if (loggedIn) {
    setCookie(AUTH_TOKEN_KEY, 'mock_token_' + Date.now())
    setCookie(AUTH_USERNAME_KEY, 'mock_user')
  } else {
    clearAllCookies()
  }
}

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = name + '=' + value + '; expires=' + expires.toUTCString() + '; path=/'
}

/** 当前 hostname 及各级父域（含前导点），覆盖 .qianjisan.com 等场景 */
function getAllDomains(): string[] {
  const hosts = new Set<string>()
  const host = window.location.hostname
  if (!host || host === 'localhost' || /^(\d+\.){3}\d+$/.test(host)) {
    return hosts.size ? [...hosts] : ['']
  }
  const parts = host.split('.')
  // 无点前缀的 hostname
  hosts.add(host)
  // 逐级父域（带前导点）：.a.b.qianjisan.com → .b.qianjisan.com → .qianjisan.com
  for (let i = 1; i < parts.length; i++) {
    hosts.add('.' + parts.slice(i).join('.'))
  }
  return [...hosts]
}

function deleteCookie(name: string) {
  const expired = '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=-99999999'
  const paths = ['/', window.location.pathname || '/', '']
  for (const domain of getAllDomains()) {
    for (const path of paths) {
      document.cookie = name + expired + '; path=' + path + (domain ? '; domain=' + domain : '')
    }
  }
}

/** 退出登录：清除当前域及父域（如 .qianjisan.com）下的全部 cookie */
function clearAllCookies() {
  const names: string[] = []
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim()
    if (name) names.push(name)
  })
  names.forEach((name) => deleteCookie(name))
}

export function useAuth() {
  return {
    isLoggedIn: readonly(isLoggedInRef),
    refresh: () => { isLoggedInRef.value = checkLoginState() },
    login: () => setAuthState(true),
    logout: () => setAuthState(false),
  }
}
