/** 注册第一步（邮箱 + 验证码）→ 第二步（设置密码 / 姓名）之间暂存的待注册信息 */
export const PENDING_REGISTER_KEY = 'cooperise:pendingRegister'

export interface PendingRegister {
  email: string
  code: string
}

export function savePendingRegister(data: PendingRegister) {
  try {
    sessionStorage.setItem(PENDING_REGISTER_KEY, JSON.stringify(data))
  } catch {
    // 存储不可用时第二步会回到第一步
  }
}
