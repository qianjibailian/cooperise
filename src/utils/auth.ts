import { ref, readonly } from 'vue'

const AUTH_TOKEN_KEY = '_qj_token'
const AUTH_USERNAME_KEY = '_qj_username'
const AUTH_REALNAME_KEY = '_qj_realname'
/** 登录接口返回的完整数据（localStorage 持久化，刷新不丢失，仅退出登录时清除） */
const AUTH_LOGIN_KEY = '_qj_login'
/** 旧版本仅保存用户资料的 key，读取时兼容迁移 */
const LEGACY_USER_KEY = '_qj_user'

/** 登录用户资料（登录接口 data.user，个人中心查询 / 保存后合并更新） */
export interface AuthUser {
  id?: number
  memberId?: string
  coAccount?: string
  realName?: string
  email?: string
  userEnName?: string
  avatarUrl?: string | null
  deptId?: string
  deptInfo?: string | null
  actualDept?: string | null
  jiraUserKey?: string | null
  isActive?: number
  roleIds?: number[]
  roleNames?: string[]
  positionId?: number
  positionName?: string | null
  /** 所属组织（登录接口 / 个人中心返回） */
  organizations?: { id: number; organizationName?: string; pathName?: string; status?: number }[]
  organizationId?: number | string | null
  [key: string]: unknown
}

/** 本地保存的登录数据：登录接口 data 原样保存，并补充登录账号与登录时间 */
export interface StoredLogin {
  token: string
  tokenType?: string
  expiresIn?: number
  user?: AuthUser | null
  /** 登录账号（登录邮箱） */
  username?: string
  /** 登录时间戳（ms） */
  loginAt?: number
  [key: string]: unknown
}

export interface LoginInfo {
  token: string
  username: string
  realName?: string
  user?: AuthUser
  /** 登录接口返回的完整 data，整体保存 */
  raw?: Record<string, unknown>
}

const loginRef = ref<StoredLogin | null>(readStoredLogin())
const isLoggedInRef = ref(checkLoginState())
/** 当前用户真实姓名（顶栏等处响应式展示） */
const realNameRef = ref(
  loginRef.value?.user?.realName || (typeof document === 'undefined' ? '' : getCookie(AUTH_REALNAME_KEY) || ''),
)
/** 当前登录用户资料（顶栏头像 / 姓名 / 岗位等响应式展示） */
const userRef = ref<AuthUser | null>(loginRef.value?.user || null)

function readStoredLogin(): StoredLogin | null {
  try {
    const raw = localStorage.getItem(AUTH_LOGIN_KEY)
    if (raw) return JSON.parse(raw) as StoredLogin
    // 兼容旧版本：只有 cookie token + _qj_user
    const legacyUser = localStorage.getItem(LEGACY_USER_KEY)
    const token = typeof document === 'undefined' ? null : getCookie(AUTH_TOKEN_KEY)
    if (token) {
      return {
        token,
        username: getCookie(AUTH_USERNAME_KEY) || undefined,
        user: legacyUser ? (JSON.parse(legacyUser) as AuthUser) : null,
      }
    }
  } catch {
    // 数据损坏时视为无本地登录数据
  }
  return null
}

function persistLogin() {
  try {
    if (loginRef.value) localStorage.setItem(AUTH_LOGIN_KEY, JSON.stringify(loginRef.value))
    localStorage.removeItem(LEGACY_USER_KEY)
  } catch {
    // 存储不可用时仅保留内存态
  }
}

/** 当前 token：优先本地持久化数据，其次 cookie */
export function getToken(): string {
  return loginRef.value?.token || (typeof document === 'undefined' ? '' : getCookie(AUTH_TOKEN_KEY) || '')
}

/** 本地保存的完整登录数据（只读快照） */
export function getStoredLogin(): StoredLogin | null {
  return loginRef.value
}

/** 合并更新登录用户资料（登录成功、个人中心查询 / 保存后调用） */
export function setAuthUser(user: AuthUser) {
  const next: AuthUser = { ...(userRef.value || {}), ...user }
  userRef.value = next
  if (loginRef.value) {
    loginRef.value = { ...loginRef.value, user: next }
    persistLogin()
  }
  if (user.realName) setRealName(user.realName)
}

function checkLoginState(): boolean {
  if (typeof document === 'undefined') return false
  return !!getToken()
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^| )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

/** 登录成功：整体保存登录接口返回数据，并写入 token / 用户名 / 真实姓名 cookie */
export function setLoginInfo(info: LoginInfo) {
  setCookie(AUTH_TOKEN_KEY, info.token)
  setCookie(AUTH_USERNAME_KEY, info.username)
  loginRef.value = {
    ...(info.raw || {}),
    token: info.token,
    user: info.user || null,
    username: info.username,
    loginAt: Date.now(),
  }
  persistLogin()
  userRef.value = info.user || null
  const name = info.user?.realName || info.realName
  if (name) setRealName(name)
  isLoggedInRef.value = checkLoginState()
}

/** 更新真实姓名（个人资料保存后同步顶栏） */
export function setRealName(name: string) {
  setCookie(AUTH_REALNAME_KEY, name)
  realNameRef.value = name
  if (userRef.value && userRef.value.realName !== name) setAuthUser({ realName: name })
}

/** 更新登录账号（修改登录邮箱后同步） */
export function setLoginUsername(username: string) {
  setCookie(AUTH_USERNAME_KEY, username)
  if (loginRef.value) {
    loginRef.value = { ...loginRef.value, username }
    persistLogin()
  }
}

/** 当前登录账号（登录邮箱 / 用户名） */
export function getLoginUsername(): string {
  return loginRef.value?.username || getCookie(AUTH_USERNAME_KEY) || ''
}

/** 清除登录态（主动退出或鉴权失效）：cookie 与本地登录数据一并清除 */
export function clearAuth() {
  clearAllCookies()
  loginRef.value = null
  isLoggedInRef.value = false
  realNameRef.value = ''
  userRef.value = null
  try {
    localStorage.removeItem(AUTH_LOGIN_KEY)
    localStorage.removeItem(LEGACY_USER_KEY)
  } catch {
    // ignore
  }
}

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires.toUTCString() + '; path=/'
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

/** 当前用户所属组织 ID：优先登录用户 organizations 中第一个启用的组织，兼容 organizationId 单值字段 */
export function getUserOrganizationId(): number | string | undefined {
  const user = userRef.value
  const raw = loginRef.value as (StoredLogin & { organizations?: AuthUser['organizations']; organizationId?: number | string | null }) | null
  const orgs = user?.organizations?.length ? user.organizations : raw?.organizations || []
  const org = orgs.find((o) => o.status !== 0) ?? orgs[0]
  const id = org?.id ?? user?.organizationId ?? raw?.organizationId
  return id == null || String(id) === '' ? undefined : id
}

export function useAuth() {
  return {
    isLoggedIn: readonly(isLoggedInRef),
    realName: readonly(realNameRef),
    user: readonly(userRef),
    /** 登录接口返回的完整数据（刷新不丢失，退出登录清除） */
    loginData: readonly(loginRef),
    refresh: () => { isLoggedInRef.value = checkLoginState() },
    login: setLoginInfo,
    logout: clearAuth,
  }
}
