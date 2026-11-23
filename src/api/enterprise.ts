// 企业后台接口（/enterprise/** 路径）：企业内用户、岗位、组织、企业设置

import request from '@/utils/request'
import type {
  Result,
  UserQueryPayload,
  UserListData,
  UserItem,
} from '@/types/faiz'
import type {
  UserSaveParams,
  RoleItem,
  RoleQueryParams,
  RoleSaveParams,
  PositionItem,
  PositionQueryParams,
  PositionSaveParams,
  OrganizationNode,
  OrganizationSaveParams,
  EnterpriseSettings,
  PermissionItem,
} from './types'

export function enterpriseCreateUser(data: UserSaveParams): Promise<Result<UserItem>> {
  return request.post(`/enterprise/user/create`, data)
}

/** 企业内修改用户（POST /enterprise/user/update） */
export function enterpriseUpdateUser(data: UserSaveParams): Promise<Result<UserItem>> {
  return request.post(`/enterprise/user/update`, data)
}

/** 企业内删除用户（POST /enterprise/user/delete） */
export function enterpriseDeleteUser(id: number, rootOrganizationCode?: string): Promise<Result<void>> {
  return request.post(`/enterprise/user/delete`, { id, rootOrganizationCode })
}

/** 企业内重置用户密码（POST /enterprise/user/reset-password） */
export function enterpriseResetUserPassword(id: number, rootOrganizationCode?: string): Promise<Result<void>> {
  return request.post(`/enterprise/user/reset-password`, { id, rootOrganizationCode })
}

/** 企业内用户详情，仅该企业成员（POST /enterprise/user/detail） */
export function enterpriseGetUserDetail(id: number, rootOrganizationCode?: string): Promise<Result<UserItem>> {
  return request.post(`/enterprise/user/detail`, { id, rootOrganizationCode })
}

/** 企业角色分页（POST /enterprise/role/query，仅当前企业角色） */
export function enterpriseQueryRoles(data: RoleQueryParams): Promise<Result<{ list: RoleItem[]; total: number }>> {
  return request.post(`/enterprise/role/query`, data)
}

/** 企业内新建角色（POST /enterprise/role/create，归属当前企业） */
export function enterpriseCreateRole(data: RoleSaveParams): Promise<Result<RoleItem>> {
  return request.post(`/enterprise/role/create`, data)
}

/** 企业内修改角色（POST /enterprise/role/update，仅本企业角色） */
export function enterpriseUpdateRole(data: RoleSaveParams): Promise<Result<RoleItem>> {
  return request.post(`/enterprise/role/update`, data)
}

/** 企业内删除角色（POST /enterprise/role/delete，仅本企业角色） */
export function enterpriseDeleteRole(id: number): Promise<Result<void>> {
  return request.post(`/enterprise/role/delete`, { id })
}

/** 角色权限点目录（POST /enterprise/role/permission/list） */
export function enterpriseListRolePermissions(): Promise<Result<PermissionItem[]>> {
  return request.post(`/enterprise/role/permission/list`)
}

/** 保存企业角色权限（POST /enterprise/role/permission/save，全量替换） */
export function enterpriseSaveRolePermissions(roleId: number, permCodes: string[]): Promise<Result<void>> {
  return request.post(`/enterprise/role/permission/save`, { roleId, permCodes })
}

// ==================== 用户直接授权（用户管理「授权」） ====================

/** 用户直接授权编码列表（POST /enterprise/user/permission/list；最终权限 = 角色权限 ∪ 直接授权） */
export function listUserDirectPermissions(memberId: string): Promise<Result<string[]>> {
  return request.post(`/enterprise/user/permission/list`, { memberId })
}

/** 保存用户直接授权（POST /enterprise/user/permission/save，全量替换） */
export function saveUserDirectPermissions(memberId: string, permCodes: string[]): Promise<Result<void>> {
  return request.post(`/enterprise/user/permission/save`, { memberId, permCodes })
}

export function enterpriseCreatePosition(data: PositionSaveParams): Promise<Result<PositionItem>> {
  return request.post(`/enterprise/position/create`, data)
}

/** 企业内修改岗位（POST /enterprise/position/update） */
export function enterpriseUpdatePosition(data: PositionSaveParams): Promise<Result<PositionItem>> {
  return request.post(`/enterprise/position/update`, data)
}

/** 企业内删除岗位（POST /enterprise/position/delete） */
export function enterpriseDeletePosition(id: number): Promise<Result<void>> {
  return request.post(`/enterprise/position/delete`, { id })
}

// ==================== 企业后台（/enterprise，按企业维度过滤） ====================

/** 企业用户列表（POST /enterprise/user/query）：rootOrganizationCode 为当前企业编码 */
export function enterpriseQueryUsers(payload: UserQueryPayload): Promise<Result<UserListData>> {
  return request.post(`/enterprise/user/query`, payload)
}

/** 企业岗位列表（POST /enterprise/position/query） */
export function enterpriseQueryPositions(data: PositionQueryParams): Promise<Result<{ list: PositionItem[]; total: number }>> {
  return request.post(`/enterprise/position/query`, data)
}

/** 企业组织树（POST /enterprise/organization/tree）：以企业为唯一根节点 */
export function enterpriseOrganizationTree(rootOrganizationCode?: string): Promise<Result<OrganizationNode[]>> {
  return request.post(`/enterprise/organization/tree`, { rootOrganizationCode })
}

/** 企业内新增组织（POST /enterprise/organization/create）：不允许新增根组织 */
export function enterpriseCreateOrganization(data: OrganizationSaveParams): Promise<Result<OrganizationNode>> {
  return request.post(`/enterprise/organization/create`, data)
}

/** 企业内修改组织（POST /enterprise/organization/update） */
export function enterpriseUpdateOrganization(data: OrganizationSaveParams): Promise<Result<OrganizationNode>> {
  return request.post(`/enterprise/organization/update`, data)
}

/** 企业内删除组织（POST /enterprise/organization/delete） */
export function enterpriseDeleteOrganization(id: number): Promise<Result<void>> {
  return request.post(`/enterprise/organization/delete`, { id })
}

export function enterpriseSettingsDetail(rootOrganizationCode?: string): Promise<Result<EnterpriseSettings>> {
  return request.post(`/enterprise/settings/detail`, { rootOrganizationCode })
}

/** 企业改名，仅管理员（POST /enterprise/settings/rename） */
export function enterpriseRename(rootOrganizationCode: string, organizationName: string): Promise<Result<null>> {
  return request.post(`/enterprise/settings/rename`, { rootOrganizationCode, organizationName })
}

/** 转交企业管理员，仅管理员（POST /enterprise/settings/transfer） */
export function enterpriseTransferOwner(rootOrganizationCode: string, memberId: string): Promise<Result<null>> {
  return request.post(`/enterprise/settings/transfer`, { rootOrganizationCode, memberId })
}

/** 退出企业（POST /enterprise/settings/leave），管理员需先转交 */
export function enterpriseLeave(rootOrganizationCode: string): Promise<Result<null>> {
  return request.post(`/enterprise/settings/leave`, { rootOrganizationCode })
}

