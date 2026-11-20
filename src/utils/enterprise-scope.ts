import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/utils/auth'
import { currentWorkspace } from '@/utils/workspace'

/**
 * 企业后台数据范围：/enterprise/* 下，用户 / 岗位 / 组织管理只展示当前企业（及其下级）。
 * rootOrganizationCode 为当前工作空间对应的企业组织编码；非企业后台或个人模式下为 undefined。
 */
export function useEnterpriseScope() {
  const route = useRoute()
  const { user } = useAuth()
  const isEnterprise = computed(() => route.path.startsWith('/enterprise'))
  const rootOrganizationCode = computed<string | undefined>(() => {
    if (!isEnterprise.value) return undefined
    const ws = currentWorkspace.value
    const org = (user.value?.organizations || []).find((o) => String(o.id) === ws)
    return org?.organizationCode
  })
  return { isEnterprise, rootOrganizationCode }
}
