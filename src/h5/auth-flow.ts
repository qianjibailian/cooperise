/**
 * 手机 H5 登录态写入（注册 / 登录共用）
 * 与网页版 pages/auth 的逻辑保持一致：优先用接口返回的 token；没有 token 时用同一账号密码登录一次；
 * 仍无 token 则依赖后端 Set-Cookie 写入的登录态，通过 refresh() 读取。
 */
import { login } from '@/api/faiz'
import type { LoginResult } from '@/api/types'
import { setLoginInfo, useAuth } from '@/utils/auth'

export async function applyLogin(email: string, data?: LoginResult, password?: string): Promise<boolean> {
  const { isLoggedIn, refresh } = useAuth()
  let info = data
  if (!info?.token && password) {
    const res = await login({ email, password })
    info = res?.data as LoginResult | undefined
  }
  if (info?.token) {
    setLoginInfo({
      token: info.token,
      username: info.user?.email || info.username || email,
      realName: info.user?.realName || info.realName,
      user: info.user,
      raw: info as unknown as Record<string, unknown>,
    })
  } else {
    refresh()
  }
  return isLoggedIn.value
}
