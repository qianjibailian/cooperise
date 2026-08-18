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
  ViewListResult,
  FilterDraft,
  IssuePatchField,
} from '@/types/faiz'

const PREFIX = '/faiz-api'

// ==================== Template API ====================

/** 模板列表（分页查询 POST /template/query） */
export function queryTemplates(data?: TemplateQueryRequest): Promise<Result<TemplatePageData>> {
  return request.post(`${PREFIX}/template/query`, data)
}

/** 模板详情 */
export function getTemplate(id: number): Promise<Result<Template>> {
  return request.get(`${PREFIX}/template/${id}`)
}

/** 创建模板 */
export function createTemplate(data: Record<string, unknown>): Promise<Result<Template>> {
  return request.post(`${PREFIX}/template`, data)
}

/** 更新模板 */
export function updateTemplate(id: number, data: Record<string, unknown>): Promise<Result<Template>> {
  return request.put(`${PREFIX}/template/${id}`, data)
}

/** 删除模板 */
export function deleteTemplate(id: number): Promise<Result<void>> {
  return request.delete(`${PREFIX}/template/${id}`)
}


/** 复制模板 */
export function copyTemplate(id: number): Promise<Result<Template>> {
  return request.post(`${PREFIX}/template/${id}/copy`)
}

/** 模板预览（表单模式，GET /template/{id}/preview/form） */
export function previewTemplateForm(id: number | string): Promise<Result<Record<string, any>>> {
  return request.get(`${PREFIX}/template/${id}/preview/form`)
}

/** 模板预览（表格模式，GET /template/{id}/preview/table） */
export function previewTemplateTable(id: number | string): Promise<Result<Record<string, any>>> {
  return request.get(`${PREFIX}/template/${id}/preview/table`)
}

// ==================== Issue API ====================

/** Issue 分页搜索（POST /issue/query） */
export function getIssues(data?: IssueQuery | IssueQueryPayload): Promise<IssueQueryResult> {
  return request.post(`${PREFIX}/issue/query`, data)
}

/** 新建事项（POST /issue/create），入参使用 inputFields 数组格式 */
export function createIssue(
  payload: CreateIssuePayload,
): Promise<Result<Record<string, unknown>>> {
  return request.post(`${PREFIX}/issue/create`, payload)
}

/** 单元格编辑 - 部分字段更新 Issue（PATCH /issue/{id}，body 为 [{ fieldId, fieldValue }] 数组） */
export function patchIssue(id: string | number, fields: IssuePatchField[]): Promise<Result<IssueRow>> {
  return request.patch(`${PREFIX}/issue/${id}`, fields)
}

/** 新建事项表单元数据（POST /issue/queryCreateMeta） */
export function getIssueCreateMeta(data: { projectId: string; issueTypeId: string }): Promise<IssueCreateMetaResult> {
  return request.post(`${PREFIX}/issue/queryCreateMeta`, data)
}

/** 查询事项详情（POST /issue/queryDetail） */
export function queryDetail(payload: QueryDetailPayload): Promise<QueryDetailResult> {
  return request.post(`${PREFIX}/issue/queryDetail`, payload)
}

// ==================== Filter Draft API ====================

/** 获取草稿筛选（GET /filter/draft?userNo=xxx） */
export function getFilterDraft(userNo: string): Promise<Result<FilterDraft>> {
  return request.get(`${PREFIX}/filter/draft`, { params: { userNo } })
}

/** 更新草稿筛选（PUT /filter/draft） */
export function updateFilterDraft(data: Partial<FilterDraft> & { userNo: string }): Promise<Result<FilterDraft>> {
  return request.put(`${PREFIX}/filter/draft`, data)
}

// ==================== View API ====================

/** 我的视图列表（POST /view/list，走全局 queqiao 前缀下发） */
export function getViewList(): Promise<ViewListResult> {
  return request.post(`${PREFIX}/view/list`)
}

// ==================== User API ====================

/** 用户分页搜索（POST /user/query） */
export function queryUsers(payload: UserQueryPayload): Promise<Result<UserListData>> {
  return request.post(`${PREFIX}/user/query`, payload)
}

// ==================== Custom Field Option API ====================

/** 批量查询自定义字段选项（POST /availableField/customOptions） */
export function getAvailableFieldOptions(
  fieldReqs: CustomFieldOptionReq[],
): Promise<CustomFieldOptionResult> {
  return request.post(`${PREFIX}/availableField/customOptions`, { fieldReqs })
}

/** 查询可用字段列表（POST /custom_field/queryAvailableFields） */
export function queryAvailableFields(
  params?: AvailableFieldQuery,
): Promise<AvailableFieldResult> {
  return request.post(`${PREFIX}/availableField/list`, params)
}

/** 新增可选自定义字段（POST /custom_field/availableField） */
export function createAvailableField(
  data: AvailableFieldSavePayload,
): Promise<Result<AvailableFieldItem>> {
  return request.post(`${PREFIX}/availableField`, data)
}

/** 查询可用字段详情（GET /availableField/{id}） */
export function getAvailableFieldDetail(
  id: string | number,
): Promise<Result<AvailableFieldItem>> {
  return request.get(`${PREFIX}/availableField/${id}`)
}

/** 更新可选自定义字段（PUT /custom_field/availableField/{id}） */
export function updateAvailableField(
  id: string,
  data: AvailableFieldSavePayload,
): Promise<Result<AvailableFieldItem>> {
  return request.put(`${PREFIX}/availableField/${id}`, data)
}

/** 删除可选自定义字段（DELETE /custom_field/availableField/{id}） */
export function deleteAvailableField(id: string): Promise<Result<void>> {
  return request.delete(`${PREFIX}/availableField/${id}`)
}

/** 批量删除可选自定义字段（DELETE /custom_field/availableField/batch） */
export function batchDeleteAvailableFields(ids: Array<number | string>): Promise<Result<void>> {
  return request.delete(`${PREFIX}/availableField/batch`, { data: ids })
}
