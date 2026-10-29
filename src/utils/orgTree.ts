import type { OrganizationNode } from '@/api/faiz'

/** 在组织树中按 ID 查找组织编码（未选择 / 查不到时返回 undefined） */
export function findOrgCode(nodes: OrganizationNode[], id?: number | string | null): string | undefined {
  if (id == null || id === '') return undefined
  for (const n of nodes) {
    if (String(n.id) === String(id)) return n.organizationCode || undefined
    const hit = n.children?.length ? findOrgCode(n.children, id) : undefined
    if (hit) return hit
  }
  return undefined
}

/** 在组织树中按组织编码反查组织 ID（接口只返回编码时用于表单回填） */
export function findOrgIdByCode(nodes: OrganizationNode[], code?: string | null): number | undefined {
  if (!code) return undefined
  for (const n of nodes) {
    if (n.organizationCode === code) return n.id
    const hit = n.children?.length ? findOrgIdByCode(n.children, code) : undefined
    if (hit != null) return hit
  }
  return undefined
}
