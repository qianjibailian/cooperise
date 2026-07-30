import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosRequestConfig
} from 'axios'

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
    return response.data
  },
  (error) => {
    console.error('request error:', error)
    return Promise.reject(error)
  }
)

export default request
