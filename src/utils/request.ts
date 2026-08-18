import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosRequestConfig
} from 'axios'
import { message } from 'ant-design-vue'

const API_BASE_URL = import.meta.env.VITE_API_DOMAIN + import.meta.env.VITE_API_PREFIX

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
    const token = document.cookie.match(new RegExp('(?:^|; )_qj_token=([^;]*)'))
    if (token) {
      config.headers.Authorization = `Bearer ${decodeURIComponent(token[1])}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data
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
    console.error('request error:', error)
    message.error(
      error?.response?.data?.message || error?.message || '网络异常，请稍后重试',
    )
    return Promise.reject(error)
  }
)

export default request
