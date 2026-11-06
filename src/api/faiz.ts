import request from '@/utils/request'
import { currentSpaceCode, scopeGlobalFilter } from '@/utils/current-space'
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
  IssueChangeLog,
  IssueComment,
  IssueCommentSavePayload,
  IssueEditMetaRequest,
  IssueEditMetaVO,
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
  // 顶部选了空间时，所有事项查询只看该空间（不改调用方的入参对象，草稿保存不受影响）
  const payload = data && 'globalFilter' in data
    ? { ...data, globalFilter: scopeGlobalFilter(data.globalFilter) }
    : data
  return request.post(`/issue/query`, payload)
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

/** 复制事项（POST /issue/copy）：沿用空间、问题类型和字段值，状态从流程首节点开始；返回新单号 */
export function copyIssue(data: { issueKey: string; summary?: string }): Promise<Result<string>> {
  return request.post(`/issue/copy`, data)
}

/** 分配经办人（POST /issue/assign） */
export function assignIssue(data: { issueKey: string; assigneeMemberId: string }): Promise<Result<void>> {
  return request.post(`/issue/assign`, data)
}

/** 拆分任务（POST /issue/split）：批量创建子任务（沿用空间、问题类型，父级工单为当前事项）；返回子任务单号 */
export function splitIssue(data: { issueKey: string; items: { summary: string; assigneeMemberId?: string }[] }): Promise<Result<string[]>> {
  return request.post(`/issue/split`, data)
}

/** 父子工单中的一个事项（后端 IssueRelationVO.Item） */
export interface IssueRelationItem {
  issueKey: string
  summary?: string
  spaceCode?: string
  spaceName?: string
  issueTypeCode?: string
  issueTypeName?: string
  issueTypeColor?: string
  issueTypeIcon?: string | null
  statusCode?: string
  statusName?: string
  statusColor?: string
  /** 状态已结束 */
  done?: boolean
  assigneeMemberId?: string
  assigneeName?: string
  assigneeAvatar?: string | null
  planEndDate?: string | null
}

/** 关联工单：父事项 + 直接子事项 + 同级事项 */
export interface IssueRelations {
  parent: IssueRelationItem | null
  children: IssueRelationItem[]
  /** 子事项中已结束的数量 */
  doneCount: number
  /** 同级事项：同一父事项下的其它事项；没有父事项时为空 */
  siblings: IssueRelationItem[]
}

/** 关联工单（POST /issue/relations）：父事项 + 子事项 + 同级事项 */
export function queryIssueRelations(issueKey: string): Promise<Result<IssueRelations>> {
  return request.post(`/issue/relations`, { issueKey })
}

/** 设置父工单（POST /issue/parent）；parentIssueKey 传空串表示解除父子关系 */
export function setIssueParent(issueKey: string, parentIssueKey: string): Promise<Result<void>> {
  return request.post(`/issue/parent`, { issueKey, parentIssueKey })
}

/** 把已有事项关联为子工单（POST /issue/children/add），返回实际关联的单号 */
export function addIssueChildren(issueKey: string, childIssueKeys: string[]): Promise<Result<string[]>> {
  return request.post(`/issue/children/add`, { issueKey, childIssueKeys })
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
export function fuzzyQueryIssues(data: { issueKey?: string; summary?: string; spaceCode?: string; page?: number; pageSize?: number }): Promise<
  Result<{ list: FuzzyIssueItem[]; total: number; currentPage?: number; pageSize?: number; pageCount?: number }>
> {
  // 顶部选了空间时只搜该空间；调用方显式传 spaceCode 时以调用方为准
  return request.post(`/issue/fuzzy-query`, { spaceCode: currentSpaceCode.value || undefined, ...data })
}

/** 查询事项详情（POST /issue/queryDetail） */
export function queryDetail(payload: QueryDetailPayload): Promise<QueryDetailResult> {
  return request.post(`/issue/queryDetail`, payload)
}

/** 事项变更记录：创建、字段修改、状态流转等，按时间倒序（POST /issue/changeLogs） */
export function queryChangeLogs(payload: QueryDetailPayload): Promise<Result<IssueChangeLog[]>> {
  return request.post(`/issue/changeLogs`, payload)
}

/** 事项评论列表，按时间倒序（POST /issue-comment/list） */
export function queryIssueComments(payload: QueryDetailPayload): Promise<Result<IssueComment[]>> {
  return request.post(`/issue-comment/list`, payload)
}

/** 发表评论（POST /issue-comment/create） */
export function createIssueComment(payload: IssueCommentSavePayload): Promise<Result<IssueComment>> {
  return request.post(`/issue-comment/create`, payload)
}

/** 修改评论，只能改自己的（POST /issue-comment/update） */
export function updateIssueComment(payload: IssueCommentSavePayload): Promise<Result<IssueComment>> {
  return request.post(`/issue-comment/update`, payload)
}

/** 删除评论，只能删自己的（POST /issue-comment/delete） */
export function deleteIssueComment(id: number): Promise<Result<void>> {
  return request.post(`/issue-comment/delete`, { id })
}

/** 获取编辑事项弹窗数据：表单结构 + 字段当前值（POST /issue/queryEditMeta，scene=EDIT） */
export function queryEditMeta(payload: IssueEditMetaRequest): Promise<Result<IssueEditMetaVO>> {
  return request.post(`/issue/queryEditMeta`, payload)
}

// ==================== Filter Draft API ====================

/** 获取草稿筛选（GET /filter/draft?userNo=xxx&viewCode=xxx） */
export async function getFilterDraft(userNo: string, viewCode?: string): Promise<Result<FilterDraft>> {
  // 草稿按「用户 + 视图 + 空间」隔离：带上顶部当前空间，各空间的筛选 / 排序 / 展示字段互不影响
  const spaceCode = currentSpaceCode.value || undefined
  const res: Result<FilterDraft> = await request.get(`/filter/draft`, { params: { userNo, viewCode, spaceCode } })
  // 草稿按「用户 + 视图」隔离：返回的草稿属于其它视图时视为该视图暂无草稿，避免不同视图的查询条件互相影响
  if (viewCode && res?.data && res.data.viewCode && res.data.viewCode !== viewCode) {
    return { ...res, data: null as unknown as FilterDraft }
  }
  return res
}

/** 更新草稿筛选（PUT /filter/draft） */
export function updateFilterDraft(data: Partial<FilterDraft> & { userNo: string }): Promise<Result<FilterDraft>> {
  // 写入当前空间的草稿（与 getFilterDraft 一致）
  return request.put(`/filter/draft`, { ...data, spaceCode: currentSpaceCode.value || '' })
}

// ==================== View API ====================

/** 我的视图列表（POST /view/list） */
export function getViewList(): Promise<ViewListResult> {
  // 选了空间只列该空间下创建的视图
  return request.post(`/view/list`, { spaceCode: currentSpaceCode.value || undefined })
}

/** 新建视图（POST /view/create） */
export function createView(data: { filterName: string; viewType: string; groupCode?: string }): Promise<Result<unknown>> {
  // 新视图归属顶部当前空间
  return request.post(`/view/create`, { spaceCode: currentSpaceCode.value || undefined, ...data })
}

/** 编辑视图（POST /view/update） */
export function updateView(data: { filterCode: string; filterName: string; viewType: string; filterConfig?: string }): Promise<Result<unknown>> {
  return request.post(`/view/update`, data)
}

/** 删除视图（POST /view/delete） */
export function deleteView(data: { filterCode: string }): Promise<Result<unknown>> {
  return request.post(`/view/delete`, data)
}

/** 新建视图文件夹（POST /view/group/create） */
export function createViewGroup(data: { groupName: string }): Promise<Result<unknown>> {
  // 新文件夹归属顶部当前空间
  return request.post(`/view/group/create`, { spaceCode: currentSpaceCode.value || undefined, ...data })
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

/** 查询全部可用系统字段（GET /systemField/all，不分页；全局筛选打开时拉取） */
export function queryAllSystemFields(): Promise<{ success: boolean; message?: string; data: AvailableFieldItem[] }> {
  return request.get(`/systemField/all`)
}

/** 查询可用字段列表（POST /availableField/list，走缓存，custom_field + system_field，供模板构建表单） */
export function queryAvailableFieldList(
  params?: AvailableFieldQuery,
): Promise<AvailableFieldResult> {
  return request.post(`/availableField/list`, params)
}

/**
 * 工作台用的可用字段列表：顶部选了空间时只返回该空间的字段（系统字段 + 关联本空间问题类型的自定义字段）。
 * 新建事项 / 模板等按自身所选空间取字段的场景仍用 queryAvailableFieldList。
 */
export function queryWorkbenchFieldList(params?: AvailableFieldQuery): Promise<AvailableFieldResult> {
  return queryAvailableFieldList({ ...params, spaceCode: currentSpaceCode.value || undefined })
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
): Promise<Result<SystemFieldItem>> {
  // 返回新建字段（含生成的 fieldId）
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
export type WorkflowDefinitionSaveParams = Pick<WorkflowDefinition, 'id' | 'processName' | 'organizationCode' | 'spaceCode' | 'spaceName' | 'issueTypeCode' | 'issueTypeName' | 'remark'> & {
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
  /** 企业微信成员 userid：事项通知接收人 */
  wecomUserid?: string
  /** 部门（组织）ID */
  deptId?: string
  /** 岗位 ID */
  positionId?: number
  /** 是否在职：1 在职 / 0 离职 */
  isActive: number
  /** 角色 ID 列表 */
  roleIds?: number[]
  /** 拥有的空间编码：不传表示按部门自动带出（含下级组织），空数组表示不分配 */
  spaceCodes?: string[]
}

/** 用户详情（POST /user/detail），含角色、拥有的空间 */
export function getUserDetail(id: number): Promise<Result<UserItem>> {
  return request.post(`/user/detail`, { id })
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

/** 重置用户密码为默认密码 123456（POST /user/reset-password） */
export function resetUserPassword(id: number): Promise<Result<void>> {
  return request.post(`/user/reset-password`, { id })
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
  /** 按组织筛选（含下级组织）：organizationId 优先 */
  organizationId?: number
  organizationCode?: string
  page: number
  pageSize: number
}

/** 新增 / 修改岗位请求体（修改时 id 必填；岗位编码由后端生成，不提交） */
export interface PositionSaveParams {
  id?: number
  positionName: string
  /** 所属组织：organizationId 与 organizationCode 二选一，ID 优先；都不传表示不挂组织 */
  organizationId?: number
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

// ==================== 国际化翻译（原词为中文，目标语言目前只有 en） ====================

export interface I18nItem {
  id: number
  /** 原词（中文），支持 {0} {1} 占位 */
  sourceText: string
  lang: string
  /** 译文 */
  targetText: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface I18nQueryParams {
  keyword?: string
  lang?: string
  page?: number
  pageSize?: number
}

export interface I18nSaveParams {
  id?: number
  sourceText: string
  lang?: string
  targetText: string
  remark?: string
}

/** 翻译分页列表（POST /i18n/query） */
export function queryI18n(data: I18nQueryParams): Promise<Result<{ list: I18nItem[]; total: number }>> {
  return request.post(`/i18n/query`, data)
}

/** 新增翻译（POST /i18n/create） */
export function createI18n(data: I18nSaveParams): Promise<Result<I18nItem>> {
  return request.post(`/i18n/create`, data)
}

/** 修改翻译（POST /i18n/update） */
export function updateI18n(data: I18nSaveParams): Promise<Result<I18nItem>> {
  return request.post(`/i18n/update`, data)
}

/** 删除翻译（POST /i18n/delete） */
export function deleteI18n(id: number): Promise<Result<void>> {
  return request.post(`/i18n/delete`, { id })
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
  /** 所属空间编码 / 名称 */
  spaceCode?: string
  spaceName?: string
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
  /** 按空间编码筛选 */
  spaceCode?: string
  page: number
  pageSize: number
}

/** 新增 / 修改问题类型请求体（修改时 id 必填；编码由后端生成，不提交） */
export interface IssueTypeSaveParams {
  id?: number
  issueTypeName: string
  /** 所属组织编码 */
  organizationCode?: string
  /** 所属空间编码 / 名称 */
  spaceCode?: string
  spaceName?: string
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

// ==================== 事项按钮 ====================

/** 按钮动作类型 */
export type IssueButtonActionType = 'TRANSITION' | 'ROLLBACK' | 'EDIT' | 'COPY' | 'ASSIGN' | 'SPLIT' | 'DELETE' | 'CUSTOM'
/** 按钮样式 */
export type IssueButtonStyle = 'primary' | 'default' | 'danger'

/** 事项按钮（后端 IssueButtonVO，配置列表与事项详情按钮共用） */
export interface IssueButtonItem {
  id: number
  /** 按钮标识（后端生成，BTN + 5 位数字） */
  buttonKey: string
  buttonName: string
  actionType: IssueButtonActionType
  /** 问题类型编码 / 名称：编码为空表示所有类型 */
  issueTypeCode?: string | null
  issueTypeName?: string | null
  /** 适用的问题状态编码 / 名称（一一对应）：为空表示所有状态 */
  statusCodes?: string[] | null
  statusNames?: string[] | null
  /** TRANSITION / ROLLBACK 的目标状态编码 / 名称：空表示流程中的第一个后续（回退）节点 */
  targetStatusCode?: string | null
  targetStatusName?: string | null
  /** 事项详情按钮：解析出的目标流程节点 ID，点击时作为 /workflow/task/change-status 的 targetStatus */
  targetNodeId?: string | null
  buttonStyle?: IssueButtonStyle
  /** 状态：0 停用 / 1 启用 */
  status: number
  description?: string | null
  createdAt?: string
}

export interface IssueButtonQueryParams {
  /** 按钮名称 / 标识 */
  keyword?: string
  /** 问题类型编码：结果含通用（类型为空）按钮 */
  issueTypeCode?: string
  /** 问题状态编码：结果含适用状态包含它的按钮及通用（状态为空）按钮 */
  statusCode?: string
  actionType?: IssueButtonActionType
  status?: number
  page: number
  pageSize: number
}

/** 新增 / 修改按钮请求体（修改时 id 必填；按钮标识由后端生成） */
export interface IssueButtonSaveParams {
  id?: number
  buttonName: string
  actionType: IssueButtonActionType
  issueTypeCode?: string | null
  /** 适用的问题状态编码（可多选）：空数组表示所有状态 */
  statusCodes?: string[]
  targetStatusCode?: string | null
  buttonStyle?: IssueButtonStyle
  status: number
  description?: string | null
}

/** 按钮配置分页列表（POST /issue-button/list） */
export function queryIssueButtons(data: IssueButtonQueryParams): Promise<Result<{ list: IssueButtonItem[]; total: number }>> {
  return request.post(`/issue-button/list`, data)
}

/** 新增按钮（POST /issue-button/create） */
export function createIssueButton(data: IssueButtonSaveParams): Promise<Result<IssueButtonItem>> {
  return request.post(`/issue-button/create`, data)
}

/** 修改按钮（POST /issue-button/update） */
export function updateIssueButton(data: IssueButtonSaveParams): Promise<Result<IssueButtonItem>> {
  return request.post(`/issue-button/update`, data)
}

/** 删除按钮（POST /issue-button/delete） */
export function deleteIssueButton(id: number): Promise<Result<void>> {
  return request.post(`/issue-button/delete`, { id })
}

/** 事项当前可用按钮（POST /issue-button/issue）：按事项的问题类型 + 当前状态匹配，走不到目标状态的流转按钮已过滤 */
export function queryIssueButtonsForIssue(issueKey: string): Promise<Result<IssueButtonItem[]>> {
  return request.post(`/issue-button/issue`, { issueKey })
}

// ==================== 我的看板 ====================

/** 与我的关系：我经办 / 我创建 / 不限 */
export type MyBoardRelation = 'ASSIGNEE' | 'CREATOR' | 'ANY'
/** 状态范围：未结束 / 全部 / 指定状态 */
export type MyBoardStatusScope = 'UNRESOLVED' | 'ALL' | 'SPECIFIC'

/** 我的看板面板配置（后端 MyBoardPanelVO） */
export interface MyBoardPanel {
  id: number
  title: string
  /** 问题类型编码；空数组表示全部类型 */
  issueTypeCodes: string[]
  relation: MyBoardRelation
  statusScope: MyBoardStatusScope
  /** statusScope 为 SPECIFIC 时的状态编码 */
  statusCodes: string[]
  /** 面板展示条数 */
  pageSize: number
  sort?: number
  /** 自定义筛选条件：globalFilter JSON 字符串（与 /issue/query 同结构），null 表示无 */
  filterConfig?: string | null
}

export type MyBoardPanelSavePayload = Omit<MyBoardPanel, 'id' | 'sort'> & { id?: number }

/** 面板里的一条事项 */
export interface MyBoardIssue {
  issueKey: string
  summary?: string
  issueTypeCode?: string
  issueTypeName?: string
  issueTypeColor?: string
  issueTypeIcon?: string | null
  statusCode?: string
  statusName?: string
  statusColor?: string
  updateTime?: string
}

/** 面板数据：命中总数 + 最近更新的前 N 条 */
export interface MyBoardPanelData {
  panelId: number
  total: number
  list: MyBoardIssue[]
}

/** 当前用户的面板（POST /my-board/panels） */
export function queryMyBoardPanels(): Promise<Result<MyBoardPanel[]>> {
  // 选了空间只列该空间下创建的面板
  return request.post(`/my-board/panels`, { spaceCode: currentSpaceCode.value || undefined })
}

/** 新增 / 修改面板（POST /my-board/panel/save） */
export function saveMyBoardPanel(data: MyBoardPanelSavePayload): Promise<Result<MyBoardPanel>> {
  // 新面板归属顶部当前空间（修改时后端忽略）
  return request.post(`/my-board/panel/save`, { spaceCode: currentSpaceCode.value || undefined, ...data })
}

/** 删除面板（POST /my-board/panel/delete） */
export function deleteMyBoardPanel(id: number): Promise<Result<void>> {
  return request.post(`/my-board/panel/delete`, { id })
}

/** 面板排序：按传入 id 顺序（POST /my-board/panel/sort） */
export function sortMyBoardPanels(ids: number[]): Promise<Result<void>> {
  return request.post(`/my-board/panel/sort`, { ids })
}

/** 面板数据（POST /my-board/panel/data） */
export function queryMyBoardPanelData(id: number): Promise<Result<MyBoardPanelData>> {
  // 顶部选了空间时只看该空间的事项；不传 spaceCode 为全部空间
  return request.post(`/my-board/panel/data`, { id, spaceCode: currentSpaceCode.value || undefined })
}

// ==================== 空间管理 ====================

/** 空间（后端 SpaceVO） */
export interface SpaceItem {
  id: number
  /** 空间编码（后端生成，十位数字），业务关联（问题类型 / 模板 / 工作流）用 */
  spaceCode: string
  spaceName: string
  /** 空间标识：1~5 位大写字母，用作问题单号前缀（如 RD → RD-000042） */
  spaceKey?: string
  /** 所属组织 */
  organizationId?: number
  organizationCode?: string
  organizationName?: string
  /** 组织路径名称，如 全球运营中心/C端产品部 */
  organizationPathName?: string
  /** 负责人用户编号（memberId） */
  ownerMemberId?: string
  /** 负责人姓名（无姓名时取英文名） */
  ownerName?: string
  /** 图标颜色，如 #0A84FF */
  color?: string
  description?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status: number
  createTime?: string
  updateTime?: string
}

export interface SpaceQueryParams {
  /** 空间名称 / 编码 */
  keyword?: string
  status?: number
  /** 按组织筛选（含下级组织）：organizationId 优先 */
  organizationId?: number
  organizationCode?: string
  /** 只查当前用户加入的空间 */
  onlyJoined?: boolean
  page: number
  pageSize: number
}

/** 新增 / 修改空间请求体（修改时 id 必填；编码由后端生成，不提交） */
export interface SpaceSaveParams {
  id?: number
  spaceName: string
  /** 空间标识：后端按空间名自动生成，传了也会被忽略，无需提交 */
  spaceKey?: string
  /** 所属组织：organizationId 与 organizationCode 二选一，ID 优先 */
  organizationId?: number
  organizationCode?: string
  /** 负责人用户编号（memberId），空表示不设负责人 */
  ownerMemberId?: string
  color?: string
  description?: string
  sort?: number
  status: number
}

/** 空间分页列表（POST /space/list，按组织筛选时含下级组织的空间） */
export function querySpaces(data: SpaceQueryParams): Promise<Result<{ list: SpaceItem[]; total: number }>> {
  return request.post(`/space/list`, data)
}

/** 组织下可选空间（POST /space/options，仅启用；不传组织时返回全部启用空间） */
export function querySpaceOptions(data?: { organizationId?: number; organizationCode?: string }): Promise<Result<SpaceItem[]>> {
  return request.post(`/space/options`, data ?? {})
}

/** 空间详情（POST /space/detail） */
export function getSpaceDetail(id: number): Promise<Result<SpaceItem>> {
  return request.post(`/space/detail`, { id })
}

/** 新增空间（POST /space/create，编码后端自动生成） */
export function createSpace(data: SpaceSaveParams): Promise<Result<SpaceItem>> {
  return request.post(`/space/create`, data)
}

/** 修改空间（POST /space/update） */
export function updateSpace(data: SpaceSaveParams): Promise<Result<SpaceItem>> {
  return request.post(`/space/update`, data)
}

/** 删除空间（POST /space/delete，软删除） */
export function deleteSpace(id: number): Promise<Result<void>> {
  return request.post(`/space/delete`, { id })
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
