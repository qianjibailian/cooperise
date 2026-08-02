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

// ==================== Template API ====================

/** 模板列表 */
export function getTemplates(params?: TemplateQuery): Promise<Result<TemplateListData>> {
  return request.get('/template', { params })
}

/** 模板详情 */
export function getTemplate(id: number): Promise<Result<Template>> {
  return request.get(`/template/${id}`)
}

/** 创建模板 */
export function createTemplate(data: Record<string, unknown>): Promise<Result<Template>> {
  return request.post('/template', data)
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

/** 模板统计 */
export function getTemplateStats(): Promise<Result<TemplateStats>> {
  return request.get('/template/stats')
}

// ==================== Form API ====================

/** 表单列表 */
export function getForms(keyword?: string, category?: string): Promise<Result<FormListData>> {
  return request.get('/form', { params: { keyword, category } })
}

/** 表单详情 */
export function getForm(id: number): Promise<Result<FormItem>> {
  return request.get(`/form/${id}`)
}
