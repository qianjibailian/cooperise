// ========== 后端响应包装 ==========
export interface Result<T> {
  success: boolean
  message: string
  data: T
}

// ========== Template ==========
export interface TemplateTab {
  id: number
  templateId: number
  name: string
  tabOrder: number
  formConfig: string // JSON string
  widgetData: string // JSON string
  createdAt?: string
  updatedAt?: string
}

export interface Template {
  id: number
  templateName: string
  description: string
  category: string
  status: number // 0=禁用, 1=启用
  createdAt?: string
  updatedAt?: string
  tabs: TemplateTab[]
}

export interface TemplateListData {
  list: Template[]
  total: number
  enabledCount: number
  totalTabs: number
}

export interface TemplateQuery {
  keyword?: string
  category?: string
  status?: number
}

// ========== Form ==========
export interface FormItem {
  id: number
  name: string
  widgetCount: number
  formConfig: string
  widgetData: string
  templateId: number
  templateName: string
  templateStatus: boolean
  category: string
  updatedAt?: string
}

export interface FormListData {
  list: FormItem[]
  total: number
  totalWidgets: number
  templatesWithForms: number
}

// ========== Template Stats ==========
export interface TemplateStats {
  total: number
  enabledCount: number
  categoryCount: Record<string, number>
}
