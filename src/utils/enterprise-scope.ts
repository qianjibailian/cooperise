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
    const orgs = user.value?.organizations || []
    // 优先：当前工作空间对应的组织（从顶栏切换进入企业后台的正常路径）
    const matched = orgs.find((o) => String(o.id) === ws)
    if (matched) return matched.organizationCode
    // 回退：直接进入 /enterprise/* 而工作空间未切到企业时，取所属企业根（orgLevel=1 或无上级）
    const root = orgs.find((o) => o.orgLevel === 1 || o.parentId == null)
    return root?.organizationCode
  })
  return { isEnterprise, rootOrganizationCode }
}
