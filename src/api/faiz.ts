import request from '@/utils/request'
import type {
  Result,
  Template,
  TemplateQueryRequest,
  TemplatePageData,
  IssueQuery,
  IssueQueryPayload,
  IssueQueryResult,
  IssueRow,
  IssueCreateMetaResult,
  UserQueryPayload,
  UserListData,
  UserItem,
  CustomFieldOptionReq,
  CustomFieldOptionResult,
  CreateIssuePayload,
  QueryDetailPayload,
  QueryDetailResult,
  AvailableFieldQuery,
  AvailableFieldResult,
  AvailableFieldItem,
  AvailableFieldSavePayload,
  SystemFieldQuery,
  SystemFieldPageData,
  SystemFieldItem,
  SystemFieldSavePayload,
  ViewListResult,
  FilterDraft,
  IssuePatchField,
  WorkflowDefinition,
  WorkflowNode,
} from '@/types/faiz'

// ==================== Template API ====================

/** 模板列表（分页查询 POST /template/query） */
export function queryTemplates(data?: TemplateQueryRequest): Promise<Result<TemplatePageData>> {
  return request.post(`/template/query`, data)
}

/** 模板详情 */
export function getTemplate(id: number): Promise<Result<Template>> {
  return request.get(`/template/${id}`)
}

/** 创建模板 */
export function createTemplate(data: Record<string, unknown>): Promise<Result<Template>> {
  return request.post(`/template`, data)
}

/** 更新模板 */
export function updateTemplate(id: number, data: Record<string, unknown>): Promise<Result<Template>> {
  return request.put(`/template/${id}`, data)
}

/** 删除模板 */
export function deleteTemplate(id: number): Promise<Result<void>> {
  return request.delete(`/template/${id}`)
}


/** 复制模板 */
export function copyTemplate(id: number): Promise<Result<Template>> {
  return request.post(`/template/${id}/copy`)
}

/** 模板预览（表单模式，GET /template/{id}/preview/form） */
export function previewTemplateForm(id: number | string): Promise<Result<Record<string, any>>> {
  return request.get(`/template/${id}/preview/form`)
}

/** 模板预览（表格模式，GET /template/{id}/preview/table） */
export function previewTemplateTable(id: number | string): Promise<Result<Record<string, any>>> {
  return request.get(`/template/${id}/preview/table`)
}

// ==================== Issue API ====================

/** Issue 分页搜索（POST /issue/query） */
export function getIssues(data?: IssueQuery | IssueQueryPayload): Promise<IssueQueryResult> {
  return request.post(`/issue/query`, data)
}

/** 新建事项（POST /issue/create），入参使用 inputFields 数组格式 */
export function createIssue(
  payload: CreateIssuePayload,
): Promise<Result<Record<string, unknown>>> {
  return request.post(`/issue/create`, payload)
}

/** 单元格编辑 - 部分字段更新 Issue（PATCH /issue/{id}，body 为 [{ fieldId, fieldValue }] 数组） */
export function patchIssue(id: string | number, fields: IssuePatchField[]): Promise<Result<IssueRow>> {
  return request.patch(`/issue/${id}`, fields)
}

/** 新建事项表单元数据（POST /issue/queryCreateMeta） */
export function getIssueCreateMeta(data: { organizationCode?: string; issueTypeCode: string }): Promise<IssueCreateMetaResult> {
  return request.post(`/issue/queryCreateMeta`, data)
}

/** 模糊搜索事项结果项（POST /issue/fuzzy-query → list） */
export interface FuzzyIssueItem {
  id?: number
  issueKey: string
  summary?: string
  issueTypeCode?: string
  issueTypeName?: string
  issueTypeColor?: string
  projectId?: string
  statusId?: string
  /** 当前所在工作流节点 nodeId */
  statusNode?: string
  statusCode?: string
  statusName?: string
  statusColor?: string
  createTime?: string
  updateTime?: string
  deleteTime?: string | null
  /** 创建人：JSON 字符串，如 {"memberId":"000001","coAccount":"系统管理员","avatarUrl":"..."} */
  creator?: string
  updater?: string
}

/** 模糊搜索事项（POST /issue/fuzzy-query）：issueKey / summary 均为模糊匹配，同时传时为「且」；pageSize 最大 10 */
export function fuzzyQueryIssues(data: { issueKey?: string; summary?: string; page?: number; pageSize?: number }): Promise<
  Result<{ list: FuzzyIssueItem[]; total: number; currentPage?: number; pageSize?: number; pageCount?: number }>
> {
  return request.post(`/issue/fuzzy-query`, data)
}

/** 查询事项详情（POST /issue/queryDetail） */
export function queryDetail(payload: QueryDetailPayload): Promise<QueryDetailResult> {
  return request.post(`/issue/queryDetail`, payload)
}

// ==================== Filter Draft API ====================

/** 获取草稿筛选（GET /filter/draft?userNo=xxx&viewCode=xxx） */
export function getFilterDraft(userNo: string, viewCode?: string): Promise<Result<FilterDraft>> {
  return request.get(`/filter/draft`, { params: { userNo, viewCode } })
}

/** 更新草稿筛选（PUT /filter/draft） */
export function updateFilterDraft(data: Partial<FilterDraft> & { userNo: string }): Promise<Result<FilterDraft>> {
  return request.put(`/filter/draft`, data)
}

// ==================== View API ====================

/** 我的视图列表（POST /view/list） */
export function getViewList(): Promise<ViewListResult> {
  return request.post(`/view/list`)
}

/** 新建视图（POST /view/create） */
export function createView(data: { filterName: string; viewType: string; groupCode?: string }): Promise<Result<unknown>> {
  return request.post(`/view/create`, data)
}

/** 编辑视图（POST /view/update） */
export function updateView(data: { filterCode: string; filterName: string; viewType: string }): Promise<Result<unknown>> {
  return request.post(`/view/update`, data)
}

/** 删除视图（POST /view/delete） */
export function deleteView(data: { filterCode: string }): Promise<Result<unknown>> {
  return request.post(`/view/delete`, data)
}

/** 新建视图文件夹（POST /view/group/create） */
export function createViewGroup(data: { groupName: string }): Promise<Result<unknown>> {
  return request.post(`/view/group/create`, data)
}

/** 重命名视图文件夹（POST /view/group/update） */
export function updateViewGroup(data: { groupCode: string; groupName: string }): Promise<Result<unknown>> {
  return request.post(`/view/group/update`, data)
}

/** 删除视图文件夹（POST /view/group/delete） */
export function deleteViewGroup(data: { groupCode: string }): Promise<Result<unknown>> {
  return request.post(`/view/group/delete`, data)
}

// ==================== User API ====================

/** 用户分页搜索（POST /user/query） */
export function queryUsers(payload: UserQueryPayload): Promise<Result<UserListData>> {
  return request.post(`/user/query`, payload)
}

// ==================== Custom Field Option API ====================

/** 批量查询自定义字段选项（POST /availableField/customOptions） */
export function getAvailableFieldOptions(
  fieldReqs: CustomFieldOptionReq[],
): Promise<CustomFieldOptionResult> {
  return request.post(`/availableField/customOptions`, { fieldReqs })
}

/** 查询可用字段列表（POST /customField/query，不走缓存） */
export function queryAvailableFields(
  params?: AvailableFieldQuery,
): Promise<AvailableFieldResult> {
  return request.post(`/customField/query`, params)
}

/** 查询可用字段列表（POST /availableField/list，走缓存，custom_field + system_field，供模板构建表单） */
export function queryAvailableFieldList(
  params?: AvailableFieldQuery,
): Promise<AvailableFieldResult> {
  return request.post(`/availableField/list`, params)
}

/** 新增可选自定义字段（POST /customField） */
export function createAvailableField(
  data: AvailableFieldSavePayload,
): Promise<Result<AvailableFieldItem>> {
  return request.post(`/customField`, data)
}

/** 查询可用字段详情（GET /customField/{id}） */
export function getAvailableFieldDetail(
  id: string | number,
): Promise<Result<AvailableFieldItem>> {
  return request.get(`/customField/${id}`)
}

/** 更新可选自定义字段（PUT /customField/{id}） */
export function updateAvailableField(
  id: string,
  data: AvailableFieldSavePayload,
): Promise<Result<AvailableFieldItem>> {
  return request.put(`/customField/${id}`, data)
}

/** 批量删除可选自定义字段（DELETE /customField/customField/batch，逻辑删除） */
export function batchDeleteAvailableFields(ids: Array<number | string>): Promise<Result<void>> {
  return request.delete(`/customField/customField/batch`, { data: ids })
}

// ==================== System Field API ====================

/** 查询系统字段列表（分页 POST /systemField/query） */
export function querySystemFields(
  params?: SystemFieldQuery,
): Promise<Result<SystemFieldPageData>> {
  return request.post(`/systemField/query`, params)
}

/** 查询系统字段详情（GET /systemField/{id}） */
export function getSystemFieldDetail(
  id: string | number,
): Promise<Result<SystemFieldItem>> {
  return request.get(`/systemField/${id}`)
}

/** 新增系统字段（POST /systemField） */
export function createSystemField(
  data: SystemFieldSavePayload,
): Promise<Result<void>> {
  return request.post(`/systemField`, data)
}

/** 更新系统字段（PUT /systemField/{id}） */
export function updateSystemField(
  id: string | number,
  data: SystemFieldSavePayload,
): Promise<Result<void>> {
  return request.put(`/systemField/${id}`, data)
}

/** 批量删除系统字段（DELETE /systemField/systemField/batch，逻辑删除） */
export function batchDeleteSystemFields(ids: Array<number | string>): Promise<Result<void>> {
  return request.delete(`/systemField/systemField/batch`, { data: ids })
}

// ==================== Workflow API（工作流）====================

/** 部署流程定义：新增/更新（POST /workflow/definition/deploy） */
export function deployWorkflowDefinition(data: Partial<WorkflowDefinition>): Promise<Result<WorkflowDefinition>> {
  return request.post(`/workflow/definition/deploy`, data)
}

/** 流程基本信息保存参数（新增不传 id；不含流程节点，与部署无关） */
export type WorkflowDefinitionSaveParams = Pick<WorkflowDefinition, 'id' | 'processName' | 'organizationCode' | 'issueTypeCode' | 'issueTypeName' | 'remark'> & {
  /** 流程标识：新增时由后端自动生成，不传；编辑时原样回传 */
  processKey?: string
}

/** 保存流程基本信息：新增/编辑（POST /workflow/definition/save），只保存流程信息，不部署、不修改节点 */
export function saveWorkflowDefinition(data: WorkflowDefinitionSaveParams): Promise<Result<WorkflowDefinition>> {
  return request.post(`/workflow/definition/save`, data)
}

/** 删除流程定义（POST /workflow/definition/{id}/delete），仅停用状态可删除 */
export function deleteWorkflowDefinition(id: number): Promise<Result<void>> {
  return request.post(`/workflow/definition/${id}/delete`)
}

/** 流程定义列表（GET /workflow/definition/list） */
export function listWorkflowDefinitions(): Promise<Result<WorkflowDefinition[]>> {
  return request.get(`/workflow/definition/list`)
}

/** 流程定义详情（GET /workflow/definition/{id}） */
export function getWorkflowDefinition(id: number): Promise<Result<WorkflowDefinition>> {
  return request.get(`/workflow/definition/${id}`)
}

/** 启用/停用流程定义（POST /workflow/definition/{id}/status?status=1） */
export function updateWorkflowDefinitionStatus(id: number, status: number): Promise<Result<void>> {
  return request.post(`/workflow/definition/${id}/status`, null, { params: { status } })
}

/** 下一节点精简信息（GET /workflow/next-nodes → nextNodes） */
export interface WorkflowNextNode {
  nodeId: string
  nodeName: string
  /** 流转到该节点时写入事项的状态编码 */
  statusCode?: string
  /** 入口线名称，回退目标固定为「回退」 */
  branchName?: string
  /** 是否回退目标（来自当前节点 backToNodeIds） */
  isBack?: boolean
  assigneeType?: string
  assigneeValue?: string | null
}

/** 下一节点查询结果：单号 → 事项问题类型 + 当前状态编码 → 启用流程 → 当前节点的后续 / 回退节点 */
export interface WorkflowNextNodesResult {
  issueKey?: string
  issueTypeCode?: string
  issueTypeName?: string
  currentStatusId?: string
  currentStatusName?: string
  processDefinitionId?: number
  processKey?: string
  processName?: string
  currentNodeId?: string
  currentNodeName?: string
  nextNodes?: WorkflowNextNode[]
  /** 未命中说明：无匹配流程 / 流程未配置节点 / 当前状态未匹配到节点 / 当前节点已是末节点 */
  reason?: string
}

/** 查询事项可选下一节点（GET /workflow/next-nodes?issueKey=xxx），后端按单号自行匹配问题类型与流程 */
export function getWorkflowNextNodes(issueKey: string): Promise<Result<WorkflowNextNodesResult>> {
  return request.get(`/workflow/next-nodes`, { params: { issueKey } })
}

/** 事项关联的工作流：所有节点（绑定时的流程快照）+ 当前节点 */
export interface IssueWorkflow {
  issueKey?: string
  processDefinitionId?: number
  processKey?: string
  processName?: string
  currentNodeId?: string
  currentNodeName?: string
  currentStatusCode?: string
  /** 当前节点是否已是末节点 */
  finished?: boolean
  nodes?: WorkflowNode[]
  createTime?: string
  updateTime?: string
}

/** 查询事项关联的工作流（GET /workflow/issue?issueKey=xxx） */
export function getIssueWorkflow(issueKey: string): Promise<Result<IssueWorkflow | null>> {
  return request.get(`/workflow/issue`, { params: { issueKey } })
}

/** 状态变更-完成（POST /workflow/task/change-status，reason 写入 wf_task_history.reason） */
export function changeWorkflowTaskStatus(data: {
  /** 单号（与 targetStatus 配合定位当前流转任务） */
  issueKey?: string
  /** 任务 id（可选：后端可按 issueKey + targetStatus 定位时可不传） */
  taskId?: number
  /** 目标节点：传 nodeId 或节点名均可 */
  targetStatus: string
  /** 目标状态编码（可选）：不传时后端取目标节点的状态编码 */
  statusId?: string
  reason?: string
  comment?: string
  operator: string
}): Promise<Result<void>> {
  return request.post(`/workflow/task/change-status`, data)
}

// ==================== Auth API ====================

export interface LoginParams {
  email: string
  password: string
}

export interface LoginResult {
  token: string
  username?: string
  realName?: string
  tokenType?: string
  expiresIn?: number
  /** 登录用户资料 */
  user?: {
    id: number
    memberId?: string
    coAccount?: string
    realName?: string
    email?: string
    userEnName?: string
    avatarUrl?: string | null
    deptId?: string
    deptInfo?: string | null
    isActive?: number
    roleIds?: number[]
    roleNames?: string[]
    positionId?: number
    positionName?: string | null
  }
}

/** 登录（POST /auth/login） */
export function login(data: LoginParams) {
  return request.post(`/auth/login`, data)
}

/** 退出登录（POST /auth/logout） */
export function logout() {
  return request.post(`/auth/logout`)
}

// ==================== 用户管理 ====================

/** 新增 / 修改用户请求体（修改时 id 必填） */
export interface UserSaveParams {
  id?: number
  /** 姓名 */
  realName: string
  /** 工号：新增时由后端自动生成，前端不提交 */
  coAccount?: string
  email: string
  userEnName?: string
  /** 部门（组织）ID */
  deptId?: string
  /** 岗位 ID */
  positionId?: number
  /** 是否在职：1 在职 / 0 离职 */
  isActive: number
  /** 角色 ID 列表 */
  roleIds?: number[]
  /** 初始密码（仅新增） */
  password?: string
}

/** 新增用户（POST /user/create） */
export function createUser(data: UserSaveParams): Promise<Result<UserItem>> {
  return request.post(`/user/create`, data)
}

/** 修改用户（POST /user/update） */
export function updateUser(data: UserSaveParams): Promise<Result<UserItem>> {
  return request.post(`/user/update`, data)
}

/** 删除用户（POST /user/delete） */
export function deleteUser(id: number): Promise<Result<void>> {
  return request.post(`/user/delete`, { id })
}

// ==================== 角色管理 ====================

export interface RoleItem {
  id: number
  roleName: string
  /** 角色编码，后端生成，业务唯一 */
  roleCode?: string
  description?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status: number
  /** 关联用户数 */
  userCount?: number
  createdAt?: string
}

export interface RoleQueryParams {
  keyword?: string
  status?: number
  page: number
  pageSize: number
}

/** 新增 / 修改角色请求体（修改时 id 必填；角色编码由后端生成，不提交） */
export interface RoleSaveParams {
  id?: number
  roleName: string
  description?: string
  sort?: number
  status: number
}

/** 角色分页列表（POST /role/list） */
export function queryRoles(data: RoleQueryParams): Promise<Result<{ list: RoleItem[]; total: number }>> {
  return request.post(`/role/list`, data)
}

/** 新增角色（POST /role/create） */
export function createRole(data: RoleSaveParams): Promise<Result<RoleItem>> {
  return request.post(`/role/create`, data)
}

/** 修改角色（POST /role/update） */
export function updateRole(data: RoleSaveParams): Promise<Result<RoleItem>> {
  return request.post(`/role/update`, data)
}

/** 删除角色（POST /role/delete） */
export function deleteRole(id: number): Promise<Result<void>> {
  return request.post(`/role/delete`, { id })
}

// ==================== 岗位管理 ====================

export interface PositionItem {
  id: number
  positionName: string
  /** 岗位编码，后端生成，业务唯一 */
  positionCode?: string
  /** 所属组织 ID */
  organizationId?: number
  /** 所属组织编码 */
  organizationCode?: string
  /** 所属组织名称（列表展示用） */
  organizationName?: string
  /** 所属组织路径名称，如 全球运营中心/C端产品部 */
  organizationPathName?: string
  description?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status: number
  /** 关联用户数 */
  userCount?: number
  createdAt?: string
}

export interface PositionQueryParams {
  keyword?: string
  status?: number
  /** 按组织编码筛选 */
  organizationCode?: string
  page: number
  pageSize: number
}

/** 新增 / 修改岗位请求体（修改时 id 必填；岗位编码由后端生成，不提交） */
export interface PositionSaveParams {
  id?: number
  positionName: string
  /** 所属组织编码 */
  organizationCode?: string
  description?: string
  sort?: number
  status: number
}

/** 岗位分页列表（POST /position/list） */
export function queryPositions(data: PositionQueryParams): Promise<Result<{ list: PositionItem[]; total: number }>> {
  return request.post(`/position/list`, data)
}

/** 新增岗位（POST /position/create） */
export function createPosition(data: PositionSaveParams): Promise<Result<PositionItem>> {
  return request.post(`/position/create`, data)
}

/** 修改岗位（POST /position/update） */
export function updatePosition(data: PositionSaveParams): Promise<Result<PositionItem>> {
  return request.post(`/position/update`, data)
}

/** 删除岗位（POST /position/delete） */
export function deletePosition(id: number): Promise<Result<void>> {
  return request.post(`/position/delete`, { id })
}

// ==================== 问题类型 ====================

export interface IssueTypeItem {
  id: number
  issueTypeName: string
  /** 问题类型编码，后端生成，业务唯一 */
  issueTypeCode?: string
  /** 所属组织 ID */
  organizationId?: number
  /** 所属组织编码 */
  organizationCode?: string
  /** 所属组织名称（列表展示用） */
  organizationName?: string
  /** 所属组织路径名称，如 全球运营中心/C端产品部 */
  organizationPathName?: string
  /** 图标颜色，如 #0A84FF */
  color?: string
  /** 类型图标 key（见 utils/issueTypeIcons），如 bug */
  iconUri?: string | null
  description?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status: number
  /** 关联事项数 */
  issueCount?: number
  createdAt?: string
}

/** 问题类型下的状态（在问题状态抽屉中维护） */
export interface IssueTypeStatus {
  /** 状态 ID，新增时不传 */
  id?: number
  statusName: string
  /** 状态编码，后端生成 */
  statusCode?: string
  color?: string
  /** 排序值，按列表顺序 */
  sort?: number
}

export interface IssueTypeQueryParams {
  keyword?: string
  status?: number
  /** 按组织编码筛选 */
  organizationCode?: string
  page: number
  pageSize: number
}

/** 新增 / 修改问题类型请求体（修改时 id 必填；编码由后端生成，不提交） */
export interface IssueTypeSaveParams {
  id?: number
  issueTypeName: string
  /** 所属组织编码 */
  organizationCode?: string
  color?: string
  /** 类型图标 key */
  iconUri?: string | null
  description?: string
  sort?: number
  status: number
}

/** 问题类型分页列表（POST /issue-type/list） */
export function queryIssueTypes(data: IssueTypeQueryParams): Promise<Result<{ list: IssueTypeItem[]; total: number }>> {
  return request.post(`/issue-type/list`, data)
}

/** 新增问题类型（POST /issue-type/create） */
export function createIssueType(data: IssueTypeSaveParams): Promise<Result<IssueTypeItem>> {
  return request.post(`/issue-type/create`, data)
}

/** 修改问题类型（POST /issue-type/update） */
export function updateIssueType(data: IssueTypeSaveParams): Promise<Result<IssueTypeItem>> {
  return request.post(`/issue-type/update`, data)
}

/** 问题类型下的状态列表（GET /issue-type/status/list?issueTypeCode=xxx），按 sort 升序 */
export function queryIssueTypeStatuses(issueTypeCode: string): Promise<Result<IssueTypeStatus[]>> {
  return request.get(`/issue-type/status/list`, { params: { issueTypeCode } })
}

/** 保存问题类型下的状态（POST /issue-type/status/save）：整体提交，后端按 id 增改、缺失即删除 */
export function saveIssueTypeStatuses(data: { issueTypeCode: string; statuses: IssueTypeStatus[] }): Promise<Result<IssueTypeStatus[]>> {
  return request.post(`/issue-type/status/save`, data)
}

/** 删除问题类型（POST /issue-type/delete） */
export function deleteIssueType(id: number): Promise<Result<void>> {
  return request.post(`/issue-type/delete`, { id })
}

// ==================== 组织管理 ====================

/** 组织节点（后端 OrganizationVO） */
export interface OrganizationNode {
  id: number
  /** 组织编码（后端自动生成），业务唯一 */
  organizationCode?: string
  /** 事项标识：1~4 位大写字母，用作事项单号前缀（如 UG → UG-000042） */
  issueKeyPrefix?: string
  /** 父组织 ID，0 表示顶级 */
  parentId: number
  organizationName: string
  /** 组织层级，顶级 = 1 */
  orgLevel?: number
  /** 物化路径，如 /1/5/12 */
  path?: string
  /** 路径名称，如 全球运营中心/C端产品部 */
  pathName?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status?: number
  remark?: string
  children?: OrganizationNode[]
}

/** 新增 / 修改组织请求体（修改时 id 必填） */
export interface OrganizationSaveParams {
  id?: number
  /** 组织编码由后端生成，前端不再提交 */
  organizationCode?: string
  /** 事项标识：1~4 位大写字母 */
  issueKeyPrefix?: string
  parentId: number
  organizationName: string
  sort?: number
  status?: number
  remark?: string
}

/** 组织树（POST /organization/list） */
export function getOrganizationTree(): Promise<Result<OrganizationNode[]>> {
  return request.post(`/organization/list`)
}

/** 新增组织（POST /organization/create） */
export function createOrganization(data: OrganizationSaveParams): Promise<Result<OrganizationNode>> {
  return request.post(`/organization/create`, data)
}

/** 修改组织（POST /organization/update） */
export function updateOrganization(data: OrganizationSaveParams): Promise<Result<OrganizationNode>> {
  return request.post(`/organization/update`, data)
}

/** 删除组织（POST /organization/delete，存在子组织时后端拒绝） */
export function deleteOrganization(id: number): Promise<Result<void>> {
  return request.post(`/organization/delete`, { id })
}

// ==================== 个人中心 / 账户设置 ====================

/** 用户所属组织（GET /personal-center/info → organizations） */
export interface ProfileOrganization {
  id: number
  organizationCode?: string
  organizationName?: string
  /** 组织路径名称，如 全球运营中心/C端产品部 */
  pathName?: string
  status?: number
}

/** 当前登录用户资料（GET /personal-center/info，对应后端 UserProfileVO） */
export interface CurrentUserProfile {
  id?: number
  memberId?: string
  /** 工号（后端自动生成） */
  coAccount?: string
  /** 姓名 */
  realName?: string
  /** 登录邮箱 */
  email?: string
  userEnName?: string
  avatarUrl?: string
  deptId?: string
  /** 部门路径 */
  deptInfo?: string
  /** 实际归属部门 */
  actualDept?: string
  jiraUserKey?: string
  /** 是否在职：1 在职 / 0 离职 */
  isActive?: number
  organizations?: ProfileOrganization[]
}

/** 获取当前用户资料（GET /personal-center/info） */
export function getCurrentUser(): Promise<Result<CurrentUserProfile>> {
  return request.get(`/personal-center/info`)
}

/** 个人中心可编辑字段 */
export type PersonalCenterUpdate = Pick<CurrentUserProfile, 'realName' | 'userEnName' | 'email'>

/** 更新个人资料（POST /personal-center/update） */
export function updatePersonalCenter(data: PersonalCenterUpdate): Promise<Result<CurrentUserProfile>> {
  return request.post(`/personal-center/update`, data)
}

/** 修改当前登录用户密码（POST /account-settings/change-password，新密码 6-32 位） */
export function changePassword(data: { oldPassword: string; newPassword: string }): Promise<Result<void>> {
  return request.post(`/account-settings/change-password`, data)
}
