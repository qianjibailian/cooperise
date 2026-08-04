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
/** 后端 issueField 单个字段项 */
export interface IssueFieldItem {
  id: string
  name: string
  type?: string
  value: unknown
  exportValue?: unknown
  editable?: boolean
  required?: boolean
  [k: string]: unknown
}

/** 后端单条事项（issueField 数组形态） */
export interface IssueRecord {
  issueField: IssueFieldItem[]
  searchAfter?: unknown
  type?: string | null
  [k: string]: unknown
}

/** POST /issue/query 的 info 层 */
export interface IssueQueryInfo {
  total: number
  pageCount: number
  currentPage: number
  perPage: number
  list: IssueRecord[]
}

/** POST /issue/query 的完整响应 */
export interface IssueQueryResult {
  code: string
  msg: string
  info: IssueQueryInfo
}

/** 拍平后供表格使用的事项行 */
export interface IssueRow {
  issueKey: string
  summary: string
  description: string
  statusId: string
  statusName: string
  priorityId: string
  priorityName: string
  issuetypeId: string
  issuetypeName: string
  assigneeName: string
  creatorName: string
  createdAt: string
  updatedAt: string
  projectName: string
  parentIssueKey: string | null
}

export interface IssueQuery {
  keyword?: string
  priorityId?: string
  statusId?: string
  assigneeId?: string
  issuetypeId?: string
  projectId?: string
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
