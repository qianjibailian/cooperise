/**
 * 登录页「记住账号 / 记住密码」
 *  - 记住账号：账号存 localStorage（浏览器、客户端通用）
 *  - 记住密码：仅 Windows 客户端，由主进程用系统加密（DPAPI，绑定当前 Windows 用户）保存，页面不落明文；
 *    浏览器里不保存密码，交给浏览器自带的密码管理（输入框已带 autocomplete）
 */
import { desktop } from '@/utils/desktop'

const ACCOUNT_KEY = 'cooperise.rememberAccount'

export interface RememberedLogin {
  email: string
  password: string
  rememberAccount: boolean
  rememberPassword: boolean
}

/** 当前环境能否记住密码（客户端且系统加密可用） */
export async function canRememberPassword(): Promise<boolean> {
  if (!desktop) return false
  try {
    return await desktop.canEncryptPassword()
  } catch {
    return false
  }
}

export async function loadRememberedLogin(): Promise<RememberedLogin> {
  const empty: RememberedLogin = { email: '', password: '', rememberAccount: false, rememberPassword: false }
  if (desktop) {
    try {
      const saved = await desktop.getSavedLogin()
      if (saved?.email) {
        return { email: saved.email, password: saved.password, rememberAccount: true, rememberPassword: saved.rememberPassword }
      }
    } catch {
      // ignore
    }
  }
  try {
    const email = localStorage.getItem(ACCOUNT_KEY) || ''
    return email ? { ...empty, email, rememberAccount: true } : empty
  } catch {
    return empty
  }
}

/** 登录成功后调用：按勾选项保存或清除 */
export async function saveRememberedLogin(v: RememberedLogin) {
  const email = v.rememberAccount || v.rememberPassword ? v.email.trim() : ''
  try {
    if (email) localStorage.setItem(ACCOUNT_KEY, email)
    else localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // ignore
  }
  if (desktop) {
    try {
      await desktop.saveLogin({ email, password: v.password, rememberPassword: !!email && v.rememberPassword })
    } catch {
      // ignore
    }
  }
}
