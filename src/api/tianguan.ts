import request from '@/utils/request.ts'

export function logout() {
  return request.post('/tianguan-api/auth/logout')
}
