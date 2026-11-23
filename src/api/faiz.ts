// 业务接口（工作台 / 事项 / 视图 / 空间 / 个人中心等，非管理后台、非企业后台专属路径）

import request from '@/utils/request'
import type {
  Result,
  IssueQuery,
  IssueQueryPayload,
  IssueQueryResult,
  IssueRow,
  IssueCreateMetaResult,
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
  SystemFieldItem,
  SystemFieldSavePayload,
  ViewListResult,
  ViewItem,
  FilterDraft,
  IssuePatchField,
} from '@/types/faiz'
import type {
  IssueRelations,
  FuzzyIssueItem,
  WorkflowNextNodesResult,
  IssueWorkflow,
  LoginParams,
  InitConfigProgress,
  IssueButtonItem,
  IssueButtonQueryParams,
  IssueButtonSaveParams,
  MyBoardPanel,
  MyBoardPanelSavePayload,
  MyBoardPanelData,
  SpaceItem,
  SpaceQueryParams,
  SpaceSaveParams,
  CurrentUserProfile,
  PersonalCenterUpdate,
} from './types'
import {
  queryAvailableFieldList,
} from './admin'

/** 模板预览（表单模式，GET /template/{id}/preview/form） */
export function previewTemplateForm(id: number | string): Promise<Result<Record<string, any>>> {
  return request.get(`/template/${id}/preview/form`)
}

/** 模板预览（表格模式，GET /template/{id}/preview/table） */
export function previewTemplateTable(id: number | string): Promise<Result<Record<string, any>>> {
  return request.get(`/template/${id}/preview/table`)
}

// ==================== Issue API ====================

/** Issue 分页搜索（POST /issue/query）：数据可见范围由后端按用户所属空间控制 */
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
  const res: Result<FilterDraft> = await request.get(`/filter/draft`, { params: { userNo, viewCode } })
  // 草稿按「用户 + 视图」隔离：返回的草稿属于其它视图时视为该视图暂无草稿，避免不同视图的查询条件互相影响
  if (viewCode && res?.data && res.data.viewCode && res.data.viewCode !== viewCode) {
    return { ...res, data: null as unknown as FilterDraft }
  }
  return res
}

/** 更新草稿筛选（PUT /filter/draft） */
export function updateFilterDraft(data: Partial<FilterDraft> & { userNo: string }): Promise<Result<FilterDraft>> {
  return request.put(`/filter/draft`, data)
}

// ==================== View API ====================

/** 我的视图列表（POST /view/list）：后端按用户可见范围返回 */
export function getViewList(): Promise<ViewListResult> {
  return request.post(`/view/list`, {})
}

/** 新建视图（POST /view/create） */
export function createView(data: { filterName: string; viewType: string; groupCode?: string }): Promise<Result<unknown>> {
  return request.post(`/view/create`, data)
}

/** 编辑视图（POST /view/update）：groupCode 传空字符串表示移到未分组 */
export function updateView(data: { filterCode: string; filterName: string; viewType: string; filterConfig?: string; groupCode?: string }): Promise<Result<unknown>> {
  return request.post(`/view/update`, data)
}

/** 视图详情（POST /view/detail）：含分享范围与分享对象（仅创建人可见） */
export function getViewDetail(filterCode: string): Promise<Result<ViewItem>> {
  return request.post(`/view/detail`, { filterCode })
}

/** 设置视图分享（POST /view/share，仅创建人）：NONE / MEMBERS / ORG / SPACE / ALL */
export function shareView(data: {
  filterCode: string
  shareScope: string
  /** MEMBERS=memberId，ORG=organizationCode，SPACE=spaceCode */
  values?: string[]
}): Promise<Result<ViewItem>> {
  return request.post(`/view/share`, data)
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

/** 工作台用的可用字段列表：可见范围由后端按用户所属空间控制 */
export function queryWorkbenchFieldList(params?: AvailableFieldQuery): Promise<AvailableFieldResult> {
  return queryAvailableFieldList(params)
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

/** 查询事项可选下一节点（GET /workflow/next-nodes?issueKey=xxx），后端按单号自行匹配问题类型与流程 */
export function getWorkflowNextNodes(issueKey: string): Promise<Result<WorkflowNextNodesResult>> {
  return request.get(`/workflow/next-nodes`, { params: { issueKey } })
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

/** 登录（POST /auth/login） */
export function login(data: LoginParams) {
  return request.post(`/auth/login`, data)
}

/** 用户自助创建组织（POST /organization/self-create）：创建者自动加入该组织 */
export function createSelfOrganization(data: { organizationName: string }) {
  return request.post(`/organization/self-create`, data)
}

/** 发送注册邮箱验证码（POST /auth/register/send-code） */
export function sendRegisterCode(data: { email: string }) {
  return request.post(`/auth/register/send-code`, data)
}

/** 校验注册验证码，不作废（POST /auth/register/verify-code）：注册页「下一步」时调用 */
export function verifyRegisterCode(data: { email: string; code: string }) {
  return request.post(`/auth/register/verify-code`, data)
}

/** 开始初始化（POST /init-config/start）：个人模式不传组织编码，企业传组织编码；已完成或执行中则返回当前进度 */
export function startInitConfig(data?: { organizationCode?: string }): Promise<Result<InitConfigProgress>> {
  return request.post(`/init-config/start`, data ?? {})
}

/** 切换工作空间前校验（POST /init-config/check）：企业存在且用户为成员，返回 needsInit */
export function checkInitWorkspace(organizationCode?: string): Promise<Result<{ organizationCode?: string; organizationName?: string; needsInit: boolean }>> {
  return request.post(`/init-config/check`, { organizationCode: organizationCode ?? '' })
}

/** 查询初始化进度（GET /init-config/progress）：个人模式不传组织编码，企业传组织编码 */
export function getInitConfigProgress(organizationCode?: string): Promise<Result<InitConfigProgress>> {
  return request.get(`/init-config/progress`, { params: organizationCode ? { organizationCode } : undefined })
}

/** 注册（POST /auth/register，需邮箱验证码） */
export function registerAccount(data: { email: string; code: string; password: string; realName?: string }) {
  return request.post(`/auth/register`, data)
}

/** 退出登录（POST /auth/logout） */
export function logout() {
  return request.post(`/auth/logout`)
}

/** 启用中的菜单编码列表（POST /menu/enabled，登录即可；前端全局导航过滤用） */
export function listEnabledMenus(): Promise<Result<string[]>> {
  return request.post(`/menu/enabled`)
}

/** 按钮配置分页列表（POST /issue-button/query） */
export function queryIssueButtons(data: IssueButtonQueryParams): Promise<Result<{ list: IssueButtonItem[]; total: number }>> {
  return request.post(`/issue-button/query`, data)
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

/** 当前用户的面板（POST /my-board/panels） */
export function queryMyBoardPanels(): Promise<Result<MyBoardPanel[]>> {
  return request.post(`/my-board/panels`, {})
}

/** 新增 / 修改面板（POST /my-board/panel/save） */
export function saveMyBoardPanel(data: MyBoardPanelSavePayload): Promise<Result<MyBoardPanel>> {
  return request.post(`/my-board/panel/save`, data)
}

/** 删除面板（POST /my-board/panel/delete） */
export function deleteMyBoardPanel(id: number): Promise<Result<void>> {
  return request.post(`/my-board/panel/delete`, { id })
}

/** 面板排序：按传入 id 顺序（POST /my-board/panel/sort） */
export function sortMyBoardPanels(ids: number[]): Promise<Result<void>> {
  return request.post(`/my-board/panel/sort`, { ids })
}

/** 面板数据（POST /my-board/panel/data）：可见范围由后端按用户所属空间控制 */
export function queryMyBoardPanelData(id: number): Promise<Result<MyBoardPanelData>> {
  return request.post(`/my-board/panel/data`, { id })
}

/** 空间分页列表（POST /space/query，按组织筛选时含下级组织的空间） */
export function querySpaces(data: SpaceQueryParams): Promise<Result<{ list: SpaceItem[]; total: number }>> {
  return request.post(`/space/query`, data)
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

/** 获取当前用户资料（GET /personal-center/info） */
export function getCurrentUser(): Promise<Result<CurrentUserProfile>> {
  return request.get(`/personal-center/info`)
}

/** 更新个人资料（POST /personal-center/update） */
export function updatePersonalCenter(data: PersonalCenterUpdate): Promise<Result<CurrentUserProfile>> {
  return request.post(`/personal-center/update`, data)
}

/** 修改当前登录用户密码（POST /account-settings/change-password，新密码 6-32 位） */
export function changePassword(data: { oldPassword: string; newPassword: string }): Promise<Result<void>> {
  return request.post(`/account-settings/change-password`, data)
}

export * from './types'
export * from './admin'
export * from './enterprise'

