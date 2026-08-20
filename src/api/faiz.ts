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

/** 查询可用字段列表（POST /customField/query，不走缓存） */
export function queryAvailableFields(
  params?: AvailableFieldQuery,
): Promise<AvailableFieldResult> {
  return request.post(`${PREFIX}/customField/query`, params)
}

/** 查询可用字段列表（POST /availableField/list，走缓存，custom_field + system_field，供模板构建表单） */
export function queryAvailableFieldList(
  params?: AvailableFieldQuery,
): Promise<AvailableFieldResult> {
  return request.post(`${PREFIX}/availableField/list`, params)
}

/** 新增可选自定义字段（POST /customField） */
export function createAvailableField(
  data: AvailableFieldSavePayload,
): Promise<Result<AvailableFieldItem>> {
  return request.post(`${PREFIX}/customField`, data)
}

/** 查询可用字段详情（GET /customField/{id}） */
export function getAvailableFieldDetail(
  id: string | number,
): Promise<Result<AvailableFieldItem>> {
  return request.get(`${PREFIX}/customField/${id}`)
}

/** 更新可选自定义字段（PUT /customField/{id}） */
export function updateAvailableField(
  id: string,
  data: AvailableFieldSavePayload,
): Promise<Result<AvailableFieldItem>> {
  return request.put(`${PREFIX}/customField/${id}`, data)
}

/** 批量删除可选自定义字段（DELETE /customField/customField/batch，逻辑删除） */
export function batchDeleteAvailableFields(ids: Array<number | string>): Promise<Result<void>> {
  return request.delete(`${PREFIX}/customField/customField/batch`, { data: ids })
}

// ==================== System Field API ====================

/** 查询系统字段列表（分页 POST /systemField/query） */
export function querySystemFields(
  params?: SystemFieldQuery,
): Promise<Result<SystemFieldPageData>> {
  return request.post(`${PREFIX}/systemField/query`, params)
}

/** 查询系统字段详情（GET /systemField/{id}） */
export function getSystemFieldDetail(
  id: string | number,
): Promise<Result<SystemFieldItem>> {
  return request.get(`${PREFIX}/systemField/${id}`)
}

/** 新增系统字段（POST /systemField） */
export function createSystemField(
  data: SystemFieldSavePayload,
): Promise<Result<void>> {
  return request.post(`${PREFIX}/systemField`, data)
}

/** 更新系统字段（PUT /systemField/{id}） */
export function updateSystemField(
  id: string | number,
  data: SystemFieldSavePayload,
): Promise<Result<void>> {
  return request.put(`${PREFIX}/systemField/${id}`, data)
}

/** 批量删除系统字段（DELETE /systemField/systemField/batch，逻辑删除） */
export function batchDeleteSystemFields(ids: Array<number | string>): Promise<Result<void>> {
  return request.delete(`${PREFIX}/systemField/systemField/batch`, { data: ids })
}
