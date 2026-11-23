/**
 * 全局菜单开关（menu:workspace / menu:docs / menu:space / menu:enterprise / menu:admin 等）：
 * 「菜单管理」页启停后，前端一级模块入口 / 导航据此过滤。
 *
 * 数据来自 POST /menu/enabled（登录即可），带会话级缓存；
 * 接口失败或尚未加载时默认放行（菜单全显示），避免网络问题导致导航空白。
 */
import request from '@/utils/request'
import { useAuth } from '@/utils/auth'

let cache: string[] | null = null
let loaded = false

/** 拉取启用中的菜单编码（会话内只请求一次；可在菜单管理页启停后手动失效重拉） */
export async function loadEnabledMenus(): Promise<string[]> {
  // 未登录不请求（登录页等场景）
  const { isLoggedIn, refresh } = useAuth()
  refresh()
  if (!isLoggedIn.value) return cache || []
  if (loaded) return cache || []
  try {
    const res = await request.post(`/menu/enabled`)
    if (res?.success) {
      cache = res.data || []
      loaded = true
    }
  } catch {
    // 请求层已统一提示；失败时保持未加载状态（放行）
  }
  return cache || []
}

/** 同步读取已缓存的启用菜单（未加载时返回空数组） */
export function enabledMenus(): string[] {
  return cache || []
}

/** 菜单是否启用：未加载 / 加载失败时放行 */
export function isMenuEnabled(code: string): boolean {
  if (!loaded) return true
  return (cache || []).includes(code)
}

/** 失效缓存（菜单管理页启停后调用，下一次 loadEnabledMenus 会重新拉取） */
export function invalidateEnabledMenus() {
  cache = null
  loaded = false
}
