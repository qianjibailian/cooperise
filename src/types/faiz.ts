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
  message: string
  success: boolean
  data: IssueQueryInfo
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

// ========== Issue Create Meta ==========

/** 创建表单字段定义 */
export interface CreateMetaField {
  id: string
  name: string
  type: string
  jiraType?: string | null
  value: unknown
  editable?: boolean
  required?: boolean
  standard?: boolean
  sequence?: number | null
  frontPage?: boolean | null
  description?: string | null
  defaultvalue?: unknown
  exportValue?: unknown
  issueTemplateValue?: unknown
  linkageRole?: string | null
  valueLinkInfo?: unknown
  [k: string]: unknown
}

/** 创建表单 Tab 项 */
export interface CreateMetaTabItem {
  title: string
  sequence: number
  issueFields: CreateMetaField[]
}

/** 创建表单 info.data 层 */
export interface CreateMetaData {
  tabItems: CreateMetaTabItem[]
}

/** 创建表单 info 层 */
export interface CreateMetaInfo {
  type: string
  data: CreateMetaData
  issueFields: CreateMetaField[] | null
  isUpdateToDefault: boolean
}

/** POST /issue/queryCreateMeta 完整响应 */
export interface IssueCreateMetaResult {
  message: string
  success: boolean
  data: CreateMetaInfo
}

// ========== Issue Create (POST /issue/create) ==========

/**
 * POST /issue/create 中，级联/多层级选择字段 value 的子节点
 * 如：SELECT_LIST_CASCADING 的 value = {optionId, childJOptions: [{optionId}, ...]}
 */
export interface CreateIssueCascadingChild {
  optionId: string
  childJOptions?: CreateIssueCascadingChild[]
}

/** 级联字段 value */
export interface CreateIssueCascadingValue {
  optionId: string
  childJOptions?: CreateIssueCascadingChild[]
}

/** POST /issue/create inputFields 单条 */
export interface CreateIssueInputField {
  id: string
  type: string
  value: unknown
}

/** POST /issue/create 请求体 */
export interface CreateIssuePayload {
  inputFields: CreateIssueInputField[]
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

// ========== Custom Field Option ==========

export type CustomFieldType =
  | 'SELECT_LIST_SINGLE'
  | 'SELECT_LIST_MULTIPLE'
  | 'SELECT_LIST_CASCADING'
  | 'RADIO'
  | 'CHECKBOX'
  | 'MULTI_SELECT'

/** POST /custom_field/option/customOptions 单条请求项 */
export interface CustomFieldOptionReq {
  customId: string
  type: CustomFieldType
  projectId: string
  issueTypeId: string
  issueKey?: string
  perPage?: number
  page?: number
}

/** 单个选项值（下拉/单选/多选/复选框通用） */
export interface CustomFieldOptionItem {
  id: string
  name: string
  value: string
  disabled?: boolean
  children?: CustomFieldOptionItem[]
  [k: string]: unknown
}

/** 按 customId 映射后的选项集合（前端内部使用的 map 结构） */
export interface CustomFieldOptionMap {
  [customId: string]: CustomFieldOptionItem[]
}

/** 接口返回的 joptions.list 中每一项：optionId + optionName + 可选子级 childJOptions */
export interface CustomFieldJOption {
  optionId: string
  optionName: string
  parentOptionId: string | null
  childJOptions: CustomFieldJOption[] | null
  sequence: number | null
  ext: unknown | null
  obsolete: boolean
}

/** 接口 joptions 分页结构 */
export interface CustomFieldJOptions {
  total: number
  pageCount: number | null
  currentPage: number | null
  perPage: number | null
  list: CustomFieldJOption[]
  searchAfter: unknown | null
}

/** POST /custom_field/option/customOptions 响应 data 的单条（按 customFieldId 分桶） */
export interface CustomFieldOptionResponseItem {
  customFieldId: string
  common: unknown | null
  isOptionAdmin: unknown | null
  afterKey: unknown | null
  joptions: CustomFieldJOptions
}

/** POST /custom_field/option/customOptions 完整响应 */
export interface CustomFieldOptionResult {
  message: string
  success: boolean
  data: CustomFieldOptionResponseItem[]
}

// ========== Issue Detail (POST /issue/queryDetail) ==========

/** queryDetail 请求参数 */
export interface QueryDetailPayload {
  key: string
}

/** 详情字段结构（与 CreateMetaField 类似但 value 为实际值） */
export interface DetailField {
  id: string
  name: string
  type: string
  jiraType?: string | null
  value: unknown
  editable?: boolean
  required?: boolean
  standard?: boolean
  sequence?: number | null
  frontPage?: boolean | null
  description?: string | null
  defaultvalue?: unknown
  exportValue?: unknown
  issueTemplateValue?: unknown
  linkageRole?: string | null
  valueLinkInfo?: unknown
  forGantt?: unknown
  groupField?: unknown
  [k: string]: unknown
}

/** 详情 fieldGroupStructure 结构 */
export interface DetailFieldGroupStructure {
  type: 'COMMON_LIST' | 'TAB_CONTAINER' | string
  /** COMMON_LIST 时为字段数组；TAB_CONTAINER 时为 { tabItems: [...] } */
  data: DetailField[] | { tabItems: Array<{ title: string; sequence: number; issueFields: DetailField[] }> }
  issueFields?: DetailField[] | null
  isUpdateToDefault?: boolean | null
}

/** layoutGroup 分组 */
export interface DetailLayoutGroup {
  type: 'SUMMARY' | 'DESCRIPTION' | 'CUSTOM_FIELD' | string
  fieldGroupStructure: DetailFieldGroupStructure
}

/** queryDetail 响应 data */
export interface DetailData {
  layoutGroup: DetailLayoutGroup[]
  jiraIssueId?: string
  workflowName?: string
  hasDevActivityValue?: boolean
}

/** queryDetail 完整响应 */
export interface QueryDetailResult {
  message: string
  success: boolean
  data: DetailData
}
