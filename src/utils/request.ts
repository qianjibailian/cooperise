import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosRequestConfig
} from 'axios'
import { message } from 'ant-design-vue'
import { clearAuth, getToken, useAuth } from '@/utils/auth'
import { locale } from '@/i18n'

// 配置了 VITE_API_DOMAIN 时，前端直接请求该真实后端地址（不经过任何代理）；未配置时回退为同源 /api（仅内网预览等场景使用 vite 代理）。
/** 接口前缀：真实后端地址（VITE_API_DOMAIN），未配置时为 /api */
export const API_BASE_URL = (import.meta.env.VITE_API_DOMAIN || '/api').replace(new RegExp('/+$'), '')

interface CustomAxiosInstance extends AxiosInstance {
  get<T = any, R = T>(url: string, config?: AxiosRequestConfig): Promise<R>
  post<T = any, R = T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>
  put<T = any, R = T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>
  delete<T = any, R = T>(url: string, config?: AxiosRequestConfig): Promise<R>
}

const request: CustomAxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
}) as CustomAxiosInstance

request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // 当前界面语言（zh / en），后端据此返回对应语言的提示文案
    config.headers['Accept-Language'] = locale.value
    // 后端按 language 头翻译返回内容（zh 原样返回中文，en 返回英文）
    config.headers.language = locale.value
    return config
  },
  (error) => Promise.reject(error)
)

/** 统一的失败信息：HTTP 非 2xx / 网络异常 / 业务 401 均包装成该结构后 reject，调用方 catch 到的都是它 */
export interface ApiError {
  success: false
  /** 业务码（后端 Result.code），缺失时取 HTTP 状态码；网络异常为 0 */
  code: number
  /** HTTP 状态码；未收到响应时为 0 */
  status: number
  /** 已展示给用户的提示文案 */
  message: string
  /** 后端返回的 data（如参数校验失败的字段明细） */
  data: unknown
}

/** HTTP 状态码 → 兜底文案（后端未返回 message 时使用） */
const STATUS_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '未登录或登录已失效，请重新登录',
  403: '没有权限执行该操作',
  404: '请求的资源不存在',
  405: '请求方法不被允许',
  408: '请求超时，请稍后重试',
  409: '数据已被修改，请刷新后重试',
  413: '请求内容过大',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误，请稍后重试',
  502: '网关错误，请稍后重试',
  503: '服务暂不可用，请稍后重试',
  504: '网关超时，请稍后重试',
}

/**
 * 全局提示的展示方式：默认用 ant-design-vue 的 message（网页版 / 客户端）；
 * 手机 H5 入口（src/h5/main.ts）调用 setRequestNotifier 换成 Vant 的 Toast
 */
export interface RequestNotifier {
  success: (text: string) => void
  error: (text: string) => void
  warning: (text: string) => void
}
let notifier: RequestNotifier = {
  success: (text) => message.success(text),
  // 同一文案在提示期间只展示一条（并发请求同时失败时不刷屏）
  error: (text) => message.error({ content: text, key: `req-err:${text}` }),
  warning: (text) => message.warning({ content: text, key: `req-warn:${text}` }),
}
export function setRequestNotifier(n: RequestNotifier) {
  notifier = n
}

function showError(text: string) {
  notifier.error(text)
}

/** axios 错误 / 业务 401 响应 → ApiError */
function toApiError(error: any): ApiError {
  const res = error?.response
  const body = res?.data && typeof res.data === 'object' ? res.data : undefined
  const status = Number(res?.status) || 0
  const backendMsg = typeof body?.message === 'string' ? body.message.trim() : ''
  let text = backendMsg
  if (!text) {
    if (status) text = STATUS_MESSAGES[status] || (status >= 500 ? STATUS_MESSAGES[500] : `请求失败（${status}）`)
    else if (error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message))) text = '请求超时，请稍后重试'
    else if (error?.code === 'ERR_CANCELED') text = '请求已取消'
    else text = '网络异常，请检查网络后重试'
  }
  return { success: false, code: Number(body?.code) || status, status, message: text, data: body?.data ?? null }
}

/**
 * 401：已登录时视为登录态失效 → 清除登录态（由路由守卫跳转登录页），提示一次；
 * 未登录时（如登录接口账号密码错误）→ 原样展示后端返回的失败原因
 */
function handleUnauthorized(err: ApiError) {
  if (useAuth().isLoggedIn.value) {
    clearAuth()
  } else {
    showError(err.message)
  }
}

request.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data
    if (data && typeof data === 'object' && Number(data.code) === 401) {
      const err = toApiError({ response })
      handleUnauthorized(err)
      return Promise.reject(err)
    }
    // 统一全局提示：HTTP 2xx 且业务 success=true → message.success(接口 message)；其余 → message.error
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success === true) {
        if (data.message) notifier.success(data.message)
      } else {
        showError(data.message || '请求失败')
      }
    }
    return data
  },
  (error) => {
    const err = toApiError(error)
    if (err.status === 401 || err.code === 401) {
      handleUnauthorized(err)
      return Promise.reject(err)
    }
    console.error('request error:', err.status, err.message, error)
    if (err.status !== 0 || error?.code !== 'ERR_CANCELED') showError(err.message)
    return Promise.reject(err)
  }
)

export default request
