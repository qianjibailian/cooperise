import request from '@/utils/request'
import type {
  Result,
  Template,
  TemplateListData,
  TemplateQuery,
  FormListData,
  FormItem,
  TemplateStats,
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
export function getForms(keyword?: string, category?: string): Promise<Result<FormListData>> {
  return request.get(`${PREFIX}/form`, { params: { keyword, category } })
}

/** 表单详情 */
export function getForm(id: number): Promise<Result<FormItem>> {
  return request.get(`${PREFIX}/form/${id}`)
}
