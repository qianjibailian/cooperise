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
    deleteCookie(AUTH_TOKEN_KEY)
    deleteCookie(AUTH_USERNAME_KEY)
  }
}

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = name + '=' + value + '; expires=' + expires.toUTCString() + '; path=/'
}

function deleteCookie(name: string) {
  const expired = '=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  // 尝试多种 path / domain 组合，确保覆盖后端 Set-Cookie 可能使用的域
  document.cookie = name + expired + '; path=/'
  document.cookie = name + expired + '; path=/; domain=' + window.location.hostname
  // 父域（如 .qianjisan.com）
  const parts = window.location.hostname.split('.')
  if (parts.length >= 2) {
    const domain = '.' + parts.slice(-2).join('.')
    document.cookie = name + expired + '; path=/; domain=' + domain
  }
}

export function useAuth() {
  return {
    isLoggedIn: readonly(isLoggedInRef),
    refresh: () => { isLoggedInRef.value = checkLoginState() },
    login: () => setAuthState(true),
    logout: () => setAuthState(false),
  }
}
