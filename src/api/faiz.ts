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
  WorkflowInstance,
  WorkflowHistory,
  WorkflowNode,
  WorkflowTask,
  WorkflowCc,
  WorkflowPageData,
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
export function getIssueCreateMeta(data: { projectId: string; issueTypeId: string }): Promise<IssueCreateMetaResult> {
  return request.post(`/issue/queryCreateMeta`, data)
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

/** 发起流程（POST /workflow/start）
 * 1) 传 issueTypeId：按问题类型自动匹配绑定该类型的启用流程，匹配不到回退通用流程
 * 2) 传 processKey：指定流程标识（优先级高于 issueTypeId）
 */
export function startWorkflow(data: {
  issueKey: string
  initiator: string
  /** 问题类型ID（推荐，自动匹配流程） */
  issueTypeId?: string | number
  /** 指定流程标识（可选，优先于 issueTypeId） */
  processKey?: string
  ccUsers?: string[]
}): Promise<Result<WorkflowInstance>> {
  return request.post(`/workflow/start`, data)
}

/** 流程实例分页（POST /workflow/instance/list） */
export function listWorkflowInstances(data: {
  status?: string
  initiator?: string
  issueKey?: string
  pageNum: number
  pageSize: number
}): Promise<Result<WorkflowPageData<WorkflowInstance>>> {
  return request.post(`/workflow/instance/list`, data)
}

/** 任务历史列表（POST /workflow/history/list），以事项单号为维度、按创建时间倒序 */
export function listWorkflowHistory(data: {
  issueKey: string
  pageNum: number
  pageSize: number
}): Promise<Result<WorkflowPageData<WorkflowHistory>>> {
  return request.post(`/workflow/history/list`, data)
}

/** 流程实例详情（GET /workflow/instance/{id}） */
export function getWorkflowInstance(id: number): Promise<Result<Record<string, any>>> {
  return request.get(`/workflow/instance/${id}`)
}

/** 查询下一节点（GET /workflow/next-nodes?issueKey=xxx），返回当前节点与下一步节点列表 */
export function getWorkflowNextNodes(issueKey: string): Promise<
  Result<{
    currentNodeId?: string
    currentNodeName?: string
    /** 当前流转任务 id（若后端返回，用于状态变更） */
    taskId?: number | string
    nextNodes?: WorkflowNode[]
  }>
> {
  return request.get(`/workflow/next-nodes`, { params: { issueKey } })
}

/** 撤销流程（POST /workflow/instance/{id}/cancel?operator=xxx） */
export function cancelWorkflowInstance(id: number, operator: string): Promise<Result<void>> {
  return request.post(`/workflow/instance/${id}/cancel`, null, { params: { operator } })
}

/** 待办列表（POST /workflow/todo/list） */
export function listWorkflowTodo(data: {
  userNo: string
  pageNum: number
  pageSize: number
}): Promise<Result<WorkflowPageData<WorkflowTask>>> {
  return request.post(`/workflow/todo/list`, data)
}

/** 已办列表（POST /workflow/done/list） */
export function listWorkflowDone(data: {
  userNo: string
  pageNum: number
  pageSize: number
}): Promise<Result<WorkflowPageData<WorkflowTask>>> {
  return request.post(`/workflow/done/list`, data)
}

/** 审批通过（POST /workflow/task/approve） */
export function approveWorkflowTask(data: {
  taskId: number
  operator: string
  comment?: string
}): Promise<Result<void>> {
  return request.post(`/workflow/task/approve`, data)
}

/** 审批驳回（POST /workflow/task/reject） */
export function rejectWorkflowTask(data: {
  taskId: number
  operator: string
  comment?: string
}): Promise<Result<void>> {
  return request.post(`/workflow/task/reject`, data)
}

/** 转办（POST /workflow/task/transfer） */
export function transferWorkflowTask(data: {
  taskId: number
  operator: string
  assignee: string
}): Promise<Result<void>> {
  return request.post(`/workflow/task/transfer`, data)
}

/** 状态变更-完成（POST /workflow/task/change-status，reason 写入 wf_task_history.reason） */
export function changeWorkflowTaskStatus(data: {
  /** 单号（与 targetStatus 配合定位当前流转任务） */
  issueKey?: string
  /** 任务 id（可选：后端可按 issueKey + targetStatus 定位时可不传） */
  taskId?: number
  /** 目标节点：传 nodeId 或节点名均可 */
  targetStatus: string
  /** 目标状态 id（issue 表 status 字段，供后端在同一个事务内同步更新） */
  statusId?: string
  reason?: string
  comment?: string
  operator: string
}): Promise<Result<void>> {
  return request.post(`/workflow/task/change-status`, data)
}

/** 抄送列表（POST /workflow/cc/list） */
export function listWorkflowCc(data: {
  userNo: string
  status?: string
  pageNum: number
  pageSize: number
}): Promise<Result<WorkflowPageData<WorkflowCc>>> {
  return request.post(`/workflow/cc/list`, data)
}

/** 标记抄送已读（POST /workflow/cc/{id}/read） */
export function markWorkflowCcRead(id: number): Promise<Result<void>> {
  return request.post(`/workflow/cc/${id}/read`)
}

// ==================== Auth API ====================

export interface LoginParams {
  email: string
  password: string
}

export interface RegisterParams {
  email: string
  password: string
}

export interface LoginResult {
  token: string
  username: string
  realName?: string
}

/** 登录（POST /auth/login） */
export function login(data: LoginParams) {
  return request.post(`/auth/login`, data)
}

/** 注册（POST /auth/register） */
export function register(data: RegisterParams) {
  return request.post(`/auth/register`, data)
}

/** 退出登录（POST /auth/logout） */
export function logout() {
  return request.post(`/auth/logout`)
}
