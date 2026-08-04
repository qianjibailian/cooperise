import request from '@/utils/request'
import type {
  Result,
  Template,
  TemplateListData,
  TemplateQuery,
  FormListData,
  FormItem,
  TemplateStats,
  IssueQuery,
  IssueQueryResult,
  IssueRow,
  IssueCreateMetaResult,
  ComponentItem,
  ComponentListData,
} from '@/types/faiz'

const PREFIX = '/faiz-api'

// ==================== Template API ====================

/** 模板列表 */
export function getTemplates(params?: TemplateQuery): Promise<Result<TemplateListData>> {
  return request.get(`${PREFIX}/template`, { params })
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

/** 新建表单用：按分类获取启用的模板（含 tabs） */
export function getNewFormTemplate(category: string): Promise<Result<Template>> {
  return request.get(`${PREFIX}/template/new-form`, { params: { category } })
}

/** 复制模板 */
export function copyTemplate(id: number): Promise<Result<Template>> {
  return request.post(`${PREFIX}/template/${id}/copy`)
}

/** 模板统计 */
export function getTemplateStats(): Promise<Result<TemplateStats>> {
  return request.get(`${PREFIX}/template/stats`)
}

// ==================== Form API ====================

/** 表单列表 */
export function getForms(keyword?: string, category?: string, templateId?: number): Promise<Result<FormListData>> {
  return request.get(`${PREFIX}/form`, { params: { keyword, category, templateId } })
}

/** 表单详情 */
export function getForm(id: number): Promise<Result<FormItem>> {
  return request.get(`${PREFIX}/form/${id}`)
}

// ==================== Issue API ====================

/** Issue 分页搜索（POST /issue/query） */
export function getIssues(data?: IssueQuery): Promise<IssueQueryResult> {
  return request.post(`${PREFIX}/issue/query`, data)
}

/** 新建 Modal 表单提交 - 存储动态表单数据 */
export function submitIssueForm(formData: Record<string, unknown>): Promise<Result<Record<string, unknown>>> {
  return request.post(`${PREFIX}/issue/form-submit`, formData)
}

/** 单元格编辑 - 部分字段更新 Issue */
export function patchIssue(id: string | number, fields: Record<string, unknown>): Promise<Result<IssueRow>> {
  return request.patch(`${PREFIX}/issue/${id}`, fields)
}

/** 新建事项表单元数据（POST /issue/queryCreateMeta） */
export function getIssueCreateMeta(data: { projectId: string; issueTypeId: string }): Promise<IssueCreateMetaResult> {
  return request.post(`${PREFIX}/issue/queryCreateMeta`, data)
}

// ==================== Component API ====================

/** 组件列表 */
export function getComponents(keyword?: string, category?: string): Promise<Result<ComponentListData>> {
  return request.get(`${PREFIX}/component`, { params: { keyword, category } })
}

/** 组件详情 */
export function getComponent(id: number): Promise<Result<ComponentItem>> {
  return request.get(`${PREFIX}/component/${id}`)
}

/** 新增组件 */
export function createComponent(data: Record<string, unknown>): Promise<Result<ComponentItem>> {
  return request.post(`${PREFIX}/component`, data)
}

/** 更新组件 */
export function updateComponent(id: number, data: Record<string, unknown>): Promise<Result<ComponentItem>> {
  return request.put(`${PREFIX}/component/${id}`, data)
}

/** 删除组件 */
export function deleteComponent(id: number): Promise<Result<void>> {
  return request.delete(`${PREFIX}/component/${id}`)
}
