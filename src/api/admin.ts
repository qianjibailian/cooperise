// 管理后台接口（/admin/** 路径）：用户、角色、菜单、岗位、国际化、问题类型、系统字段、工作流、空间、组织、初始化配置

import request from '@/utils/request'
import type {
  Result,
  Template,
  TemplateQueryRequest,
  TemplatePageData,
  UserQueryPayload,
  UserListData,
  UserItem,
  AvailableFieldQuery,
  AvailableFieldResult,
  SystemFieldQuery,
  SystemFieldPageData,
  WorkflowDefinition,
} from '@/types/faiz'
import type {
  WorkflowDefinitionSaveParams,
  InitConfigProgress,
  InitConfigSettings,
  InitConfigTask,
  UserSaveParams,
  RoleItem,
  RoleQueryParams,
  RoleSaveParams,
  PermissionItem,
  PositionItem,
  PositionQueryParams,
  PositionSaveParams,
  I18nItem,
  I18nQueryParams,
  I18nSaveParams,
  IssueTypeItem,
  IssueTypeStatus,
  IssueTypeQueryParams,
  IssueTypeSaveParams,
  SpaceItem,
  SpaceQueryParams,
  SpaceSaveParams,
  OrganizationNode,
  OrganizationSaveParams,
} from './types'

// ==================== Template API ====================

/** 模板列表（分页查询 POST /template/query） */
export function queryTemplates(data?: TemplateQueryRequest): Promise<Result<TemplatePageData>> {
  return request.post(`/admin/template/query`, data)
}

/** 模板详情 */
export function getTemplate(id: number): Promise<Result<Template>> {
  return request.get(`/admin/template/${id}`)
}

/** 创建模板 */
export function createTemplate(data: Record<string, unknown>): Promise<Result<Template>> {
  return request.post(`/admin/template`, data)
}

/** 更新模板 */
export function updateTemplate(id: number, data: Record<string, unknown>): Promise<Result<Template>> {
  return request.put(`/admin/template/${id}`, data)
}

/** 删除模板 */
export function deleteTemplate(id: number): Promise<Result<void>> {
  return request.delete(`/admin/template/${id}`)
}

/** 复制模板 */
export function copyTemplate(id: number): Promise<Result<Template>> {
  return request.post(`/admin/template/${id}/copy`)
}

// ==================== User API ====================

/** 用户分页搜索（POST /user/query） */
export function queryUsers(payload: UserQueryPayload): Promise<Result<UserListData>> {
  return request.post(`/admin/user/query`, payload)
}

/** 查询可用字段列表（POST /availableField/query，走缓存，custom_field + system_field，供模板构建表单） */
export function queryAvailableFieldList(
  params?: AvailableFieldQuery,
): Promise<AvailableFieldResult> {
  return request.post(`/admin/availableField/query`, params)
}

// ==================== System Field API ====================

/** 查询系统字段列表（分页 POST /systemField/query） */
export function querySystemFields(
  params?: SystemFieldQuery,
): Promise<Result<SystemFieldPageData>> {
  return request.post(`/admin/systemField/query`, params)
}

/** 批量删除系统字段（DELETE /systemField/systemField/batch，逻辑删除） */
export function batchDeleteSystemFields(ids: Array<number | string>): Promise<Result<void>> {
  return request.delete(`/admin/systemField/systemField/batch`, { data: ids })
}

// ==================== Workflow API（工作流）====================

/** 部署流程定义：新增/更新（POST /workflow/definition/deploy） */
export function deployWorkflowDefinition(data: Partial<WorkflowDefinition>): Promise<Result<WorkflowDefinition>> {
  return request.post(`/admin/workflow/definition/deploy`, data)
}

/** 保存流程基本信息：新增/编辑（POST /workflow/definition/save），只保存流程信息，不部署、不修改节点 */
export function saveWorkflowDefinition(data: WorkflowDefinitionSaveParams): Promise<Result<WorkflowDefinition>> {
  return request.post(`/admin/workflow/definition/save`, data)
}

/** 删除流程定义（POST /workflow/definition/{id}/delete），仅停用状态可删除 */
export function deleteWorkflowDefinition(id: number): Promise<Result<void>> {
  return request.post(`/admin/workflow/definition/${id}/delete`)
}

/** 流程定义列表（GET /workflow/definition/list） */
export function listWorkflowDefinitions(): Promise<Result<WorkflowDefinition[]>> {
  return request.get(`/admin/workflow/definition/list`)
}

/** 流程定义详情（GET /workflow/definition/{id}） */
export function getWorkflowDefinition(id: number): Promise<Result<WorkflowDefinition>> {
  return request.get(`/admin/workflow/definition/${id}`)
}

/** 启用/停用流程定义（POST /workflow/definition/{id}/status?status=1） */
export function updateWorkflowDefinitionStatus(id: number, status: number): Promise<Result<void>> {
  return request.post(`/admin/workflow/definition/${id}/status`, null, { params: { status } })
}

/** 管理后台：查看参考空间配置（GET /admin/init-config/config） */
export function getInitConfigSettings(): Promise<Result<InitConfigSettings>> {
  return request.get(`/admin/init-config/config`)
}

/** 管理后台：同步任务列表（GET /admin/init-config/tasks），status 为空则不过滤；target：PERSONAL / ENTERPRISE，为空则不过滤 */
export function getInitConfigTasks(params?: { status?: string; target?: string; limit?: number }): Promise<Result<InitConfigTask[]>> {
  return request.get(`/admin/init-config/tasks`, { params })
}

/** 管理后台：手动重试失败的同步任务（POST /admin/init-config/tasks/{id}/retry） */
export function retryInitConfigTask(id: number): Promise<Result<InitConfigProgress>> {
  return request.post(`/admin/init-config/tasks/${id}/retry`)
}

/** 管理后台：保存两个参考空间，传空串恢复默认（POST /admin/init-config/config） */
export function saveInitConfigSettings(data: {
  personalSpaceCode: string
  enterpriseSpaceCode: string
}): Promise<Result<InitConfigSettings>> {
  return request.post(`/admin/init-config/config`, data)
}

/** 用户详情（POST /user/detail），含角色、拥有的空间 */
export function getUserDetail(id: number): Promise<Result<UserItem>> {
  return request.post(`/admin/user/detail`, { id })
}

/** 新增用户（POST /user/create） */
export function createUser(data: UserSaveParams): Promise<Result<UserItem>> {
  return request.post(`/admin/user/create`, data)
}

/** 修改用户（POST /user/update） */
export function updateUser(data: UserSaveParams): Promise<Result<UserItem>> {
  return request.post(`/admin/user/update`, data)
}

/** 删除用户（POST /user/delete） */
export function deleteUser(id: number): Promise<Result<void>> {
  return request.post(`/admin/user/delete`, { id })
}

/** 重置用户密码为默认密码 123456（POST /user/reset-password） */
export function resetUserPassword(id: number): Promise<Result<void>> {
  return request.post(`/admin/user/reset-password`, { id })
}

// ---- 企业侧用户写操作（企业成员校验；管理后台走上方 /user/**，需管理后台按钮权限） ----

/** 企业内新增用户（POST /enterprise/user/create） */

/** 角色分页列表（POST /role/query） */
export function queryRoles(data: RoleQueryParams): Promise<Result<{ list: RoleItem[]; total: number }>> {
  return request.post(`/admin/role/query`, data)
}

/** 新增角色（POST /role/create） */
export function createRole(data: RoleSaveParams): Promise<Result<RoleItem>> {
  return request.post(`/admin/role/create`, data)
}

/** 修改角色（POST /role/update） */
export function updateRole(data: RoleSaveParams): Promise<Result<RoleItem>> {
  return request.post(`/admin/role/update`, data)
}

/** 删除角色（POST /role/delete） */
export function deleteRole(id: number): Promise<Result<void>> {
  return request.post(`/admin/role/delete`, { id })
}

/** 全部权限点（POST /role/permission/list，角色授权界面展示） */
export function listRolePermissions(): Promise<Result<PermissionItem[]>> {
  return request.post(`/admin/role/permission/list`)
}

/** 保存角色权限（POST /role/permission/save，全量替换） */
export function saveRolePermissions(roleId: number, permCodes: string[]): Promise<Result<void>> {
  return request.post(`/admin/role/permission/save`, { roleId, permCodes })
}

// ==================== 菜单管理（管理后台，维护全部菜单/按钮权限点） ====================

/** 全部权限点含停用（POST /menu/list，菜单→按钮树形展示） */
export function listMenuPermissions(): Promise<Result<PermissionItem[]>> {
  return request.post(`/admin/menu/list`)
}

/** 更新权限点（POST /menu/update：名称/排序/启停/备注；停用后菜单、按钮与接口立即失效） */
export function updateMenuPermission(
  id: number,
  data: { permName?: string; sort?: number; status?: number; remark?: string },
): Promise<Result<void>> {
  return request.post(`/admin/menu/update`, { id, ...data })
}

/** 岗位分页列表（POST /position/query） */
export function queryPositions(data: PositionQueryParams): Promise<Result<{ list: PositionItem[]; total: number }>> {
  return request.post(`/admin/position/query`, data)
}

/** 新增岗位（POST /position/create） */
export function createPosition(data: PositionSaveParams): Promise<Result<PositionItem>> {
  return request.post(`/admin/position/create`, data)
}

/** 修改岗位（POST /position/update） */
export function updatePosition(data: PositionSaveParams): Promise<Result<PositionItem>> {
  return request.post(`/admin/position/update`, data)
}

/** 删除岗位（POST /position/delete） */
export function deletePosition(id: number): Promise<Result<void>> {
  return request.post(`/admin/position/delete`, { id })
}

// ---- 企业侧岗位写操作（企业成员校验；管理后台走上方 /position/**，需管理后台按钮权限） ----

/** 企业内新增岗位（POST /enterprise/position/create） */

/** 翻译分页列表（POST /i18n/query） */
export function queryI18n(data: I18nQueryParams): Promise<Result<{ list: I18nItem[]; total: number }>> {
  return request.post(`/admin/i18n/query`, data)
}

/** 新增翻译（POST /i18n/create） */
export function createI18n(data: I18nSaveParams): Promise<Result<I18nItem>> {
  return request.post(`/admin/i18n/create`, data)
}

/** 修改翻译（POST /i18n/update） */
export function updateI18n(data: I18nSaveParams): Promise<Result<I18nItem>> {
  return request.post(`/admin/i18n/update`, data)
}

/** 删除翻译（POST /i18n/delete） */
export function deleteI18n(id: number): Promise<Result<void>> {
  return request.post(`/admin/i18n/delete`, { id })
}

/** 问题类型分页列表（POST /issue-type/query） */
export function queryIssueTypes(data: IssueTypeQueryParams): Promise<Result<{ list: IssueTypeItem[]; total: number }>> {
  return request.post(`/admin/issue-type/query`, data)
}

/** 新增问题类型（POST /issue-type/create） */
export function createIssueType(data: IssueTypeSaveParams): Promise<Result<IssueTypeItem>> {
  return request.post(`/admin/issue-type/create`, data)
}

/** 修改问题类型（POST /issue-type/update） */
export function updateIssueType(data: IssueTypeSaveParams): Promise<Result<IssueTypeItem>> {
  return request.post(`/admin/issue-type/update`, data)
}

/** 问题类型下的状态列表（GET /issue-type/status/list?issueTypeCode=xxx），按 sort 升序 */
export function queryIssueTypeStatuses(issueTypeCode: string): Promise<Result<IssueTypeStatus[]>> {
  return request.get(`/admin/issue-type/status/list`, { params: { issueTypeCode } })
}

/** 保存问题类型下的状态（POST /issue-type/status/save）：整体提交，后端按 id 增改、缺失即删除 */
export function saveIssueTypeStatuses(data: { issueTypeCode: string; statuses: IssueTypeStatus[] }): Promise<Result<IssueTypeStatus[]>> {
  return request.post(`/admin/issue-type/status/save`, data)
}

/** 删除问题类型（POST /issue-type/delete） */
export function deleteIssueType(id: number): Promise<Result<void>> {
  return request.post(`/admin/issue-type/delete`, { id })
}

// ==================== 管理后台-空间管理（/admin/space，管理员全量视角） ====================

/** 空间分页列表（POST /admin/space/query）：全量空间，不按「只看加入的」/ 企业 / 个人模式隔离 */
export function adminQuerySpaces(data: Omit<SpaceQueryParams, 'onlyJoined' | 'excludePersonal' | 'personalOnly'>): Promise<Result<{ list: SpaceItem[]; total: number }>> {
  return request.post(`/admin/space/query`, data)
}

/** 空间详情（POST /admin/space/detail） */
export function adminGetSpaceDetail(id: number): Promise<Result<SpaceItem>> {
  return request.post(`/admin/space/detail`, { id })
}

/** 新增空间（POST /admin/space/create，编码自动生成） */
export function adminCreateSpace(data: SpaceSaveParams): Promise<Result<SpaceItem>> {
  return request.post(`/admin/space/create`, data)
}

/** 修改空间（POST /admin/space/update） */
export function adminUpdateSpace(data: SpaceSaveParams): Promise<Result<SpaceItem>> {
  return request.post(`/admin/space/update`, data)
}

/** 删除空间（POST /admin/space/delete，软删除） */
export function adminDeleteSpace(id: number): Promise<Result<void>> {
  return request.post(`/admin/space/delete`, { id })
}

/** 复制空间（POST /admin/space/copy）：复制空间信息与全部配置内容（问题类型 / 模板 / 流程定义 / 按钮），不复制事项与成员 */
export function adminCopySpace(id: number, spaceName?: string): Promise<Result<SpaceItem>> {
  return request.post(`/admin/space/copy`, { id, spaceName })
}

/** 组织树（POST /organization/list） */
export function getOrganizationTree(rootOrganizationCode?: string): Promise<Result<OrganizationNode[]>> {
  return request.post(`/admin/organization/list`, rootOrganizationCode ? { rootOrganizationCode } : undefined)
}

/** 新增组织（POST /organization/create） */
export function createOrganization(data: OrganizationSaveParams): Promise<Result<OrganizationNode>> {
  return request.post(`/admin/organization/create`, data)
}

/** 修改组织（POST /organization/update） */
export function updateOrganization(data: OrganizationSaveParams): Promise<Result<OrganizationNode>> {
  return request.post(`/admin/organization/update`, data)
}

/** 删除组织（POST /organization/delete，存在子组织时后端拒绝） */
export function deleteOrganization(id: number): Promise<Result<void>> {
  return request.post(`/admin/organization/delete`, { id })
}

