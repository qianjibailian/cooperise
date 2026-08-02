import request from '@/utils/request.ts'

const PREFIX = '/tianguan-api'

export function logout() {
  return request.post(`${PREFIX}/auth/logout`)
}
