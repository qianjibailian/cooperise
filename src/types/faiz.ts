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

// ========== Issue ==========
export interface Issue {
  id: number
  code: string
  title: string
  description: string
  priority: number      // 1=高, 2=中, 3=低
  status: number        // 1=待处理, 2=进行中, 3=已完成
  assignee: string
  progress: number
  deadline: string
  category: string      // requirement/task/bug/other
  formData: string      // JSON 字符串
  createdAt: string
  updatedAt: string
}

export interface IssueListData {
  list: Issue[]
  total: number
  page: number
  pageSize: number
}

export interface IssueQuery {
  keyword?: string
  priority?: number
  status?: number
  assignee?: string
  category?: string
  page?: number
  pageSize?: number
}

// ========== Component ==========
export interface ComponentItem {
  id: number
  type: string
  name: string
  description: string
  componentKey: string
  status: number // 0=禁用, 1=启用
  config: string
  updatedAt?: string
}

export interface ComponentListData {
  list: ComponentItem[]
  total: number
}
