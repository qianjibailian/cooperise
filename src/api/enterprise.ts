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
  PositionItem,
  PositionQueryParams,
  PositionSaveParams,
  OrganizationNode,
  OrganizationSaveParams,
  EnterpriseSettings,
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

/** 企业用户编辑时的角色列表（只读，POST /enterprise/role/query） */
export function enterpriseQueryRoles(data: RoleQueryParams): Promise<Result<{ list: RoleItem[]; total: number }>> {
  return request.post(`/enterprise/role/query`, data)
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

