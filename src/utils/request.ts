import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosRequestConfig
} from 'axios'
import { message } from 'ant-design-vue'
import { clearAuth, getToken, useAuth } from '@/utils/auth'

// 本地开发走同源 /api，由 vite 代理转发到后端（去掉 /api），避免跨域
const API_BASE_URL = import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_DOMAIN

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
    return config
  },
  (error) => Promise.reject(error)
)

/** 鉴权失效：清除登录态，由路由守卫跳转登录页；只提示一次 */
function handleUnauthorized() {
  if (useAuth().isLoggedIn.value) {
    message.warning('登录已失效，请重新登录')
  }
  clearAuth()
}

request.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data
    if (data && typeof data === 'object' && Number(data.code) === 401) {
      handleUnauthorized()
      return Promise.reject(data)
    }
    // 统一全局提示：HTTP 2xx 且业务 success=true → message.success(接口 message)；其余 → message.error
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success === true) {
        if (data.message) message.success(data.message)
      } else {
        message.error(data.message || '请求失败')
      }
    }
    return data
  },
  (error) => {
    if (error?.response?.status === 401) {
      handleUnauthorized()
      return Promise.reject(error)
    }
    console.error('request error:', error)
    message.error(
      error?.response?.data?.message || error?.message || '网络异常，请稍后重试',
    )
    return Promise.reject(error)
  }
)

export default request
