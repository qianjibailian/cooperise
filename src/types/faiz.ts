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

/** 模板分页查询请求（对应后端 QueryTemplatesRequest） */
export interface TemplateQueryRequest {
  page?: number
  perPage?: number
  keyword?: string
  /** 预留：分类 */
  category?: string
  /** 状态：0-停用, 1-启用 */
  status?: number
}

/** 模板分页查询结果（对应后端 TemplatePageVO） */
export interface TemplatePageData {
  total: number
  pageCount: number
  currentPage: number
  perPage: number
  enabledCount: number
  totalTabs: number
  list: Template[]
}

// ========== Issue ==========
/** 后端 issueField 单个字段项 */
export interface IssueFieldItem {
  id: string
  name: string | null
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

// ========== Issue Query 完整入参（视图查询） ==========

/** 筛选条件值 */
export interface ConditionValue {
  userSpecialIdentifier?: string
  timeOperationDirectionTypeCode?: string | null
  timeFormatTypeCode?: string | null
  value: string
  comparedField?: string | null
}

/** 筛选字段引用 */
export interface FilterFieldRef {
  id: string
  datasourceId?: number
}

/** 单个筛选条件 */
export interface FilterConditionItem {
  conditionGroup?: unknown
  conditionValueList: ConditionValue[]
  dateScopeType?: string | null
  field: FilterFieldRef
  operationType: string
  comparedTypeCode?: string | null
  disable?: boolean | null
  includeObsolete?: boolean | null
}

/** 子条件组 */
export interface ChildConditionGroup {
  isGroupModule: boolean
  isDevActivity?: boolean | null
  condition: FilterConditionItem
}

/** 筛选器主体 */
export interface FilterBody {
  logicType: string
  isGroupModule: boolean
  condition?: unknown
  disable?: boolean | null
  includeObsolete?: boolean | null
  isPass?: boolean | null
  associatedConditions?: unknown[]
  matchAllLinks?: boolean
  isDevActivity?: boolean | null
  isSprintBlock?: boolean | null
  isVersionBlock?: boolean | null
  isCustomColumnBlock?: boolean | null
  childConditionGroupList: ChildConditionGroup[]
}

/** 全局筛选 */
export interface GlobalFilter {
  filter: FilterBody | null
  filterId?: number | null
  isOnlyShowAssociation?: boolean
}

/** 引用筛选 */
export interface ReferencedFilter {
  filter: FilterBody | null
}

/** 显示字段 */
export interface ShowField {
  showFieldItemList: string[]
}

/** 排序项 */
export interface SortItem {
  field: FilterFieldRef
  sortTypeCode: string
}

/** 排序 */
export interface SortConfig {
  sortItemList: SortItem[]
}

/** 分组 */
export interface GroupConfig {
  groupItemList: unknown[]
  isFollowPreviousGroup: boolean
}

/** 分层 */
export interface LayeredConfig {
  layeredItemList: unknown[]
  layerType: string
}

/** POST /issue/query 完整入参 */
export interface IssueQueryPayload {
  globalFilter: GlobalFilter
  group: GroupConfig
  layered: LayeredConfig
  page: number
  pageSize: number
  showField: ShowField
  sort: SortConfig
  viewCode?: string
  needShowGroupValues?: unknown[]
  referencedFilter: ReferencedFilter
}

// ========== Filter Draft（GET /filter/draft） ==========

/** GET /filter/draft 返回的草稿筛选（JSON 字符串字段需 parse 后使用） */
export interface FilterDraft {
  id: number
  userNo: string
  draftName: string
  viewCode: string | null
  page: number
  pageSize: number
  globalFilter: string
  group: string
  layered: string
  showField: string
  sort: string | null
  needShowGroupValues: string
  referencedFilter: string
  createdTime: string
  updatedTime: string
}

// ========== User 分页搜索（POST /user/query） ==========

export interface UserQueryPayload {
  keyword: string
  isActive: number
  page: number
  pageSize: number
}

export interface UserItem {
  userNo: string
  userCoAccount: string
  userAvatar: string
  isActive: boolean
  userEnName: string
  deptId: string
  userDeptInfo: string
  from: string
  jiraUserKey: string | null
  userActualBelongDep: string | null
}

export interface UserListData {
  list: UserItem[]
  total: number
}

// ========== View 列表（POST /view/list） ==========

/** 视图归属人 */
export interface ViewOwner {
  userNo: string
  userCoAccount: string
  userAvatar: string
  isActive: boolean
  userEnName: string
  deptId: string
  userDeptInfo: string
  from: string
  jiraUserKey: string | null
  userActualBelongDep: string | null
}

/** 单条视图项 */
export interface ViewItem {
  filterName: string
  filterCode: string
  isDefault: boolean
  isMyCreate: boolean
  isCollect: boolean
  isShare: boolean
  sortId: number
  filterOwner: ViewOwner | null
  isCollectByShare: boolean
  isDeleted: boolean
  myTodoTotalCount: number | null
  viewType: string
  groupCode: string | null
}

/** 视图分组 */
export interface ViewGroup {
  groupCode: string | null
  groupName: string | null
  myCreate: boolean | null
  share: boolean | null
  count: number | null
  sorted: number | null
  cancelShare: boolean | null
  myViewList: ViewItem[]
  groupOwner: ViewOwner | null
}

/** POST /view/list 返回体（真实后端结构；兼容历史 info 字段） */
export interface ViewListResult {
  code?: string
  msg?: string
  message?: string
  success?: boolean
  /** 后端真实返回用 data，历史遗留兼容字段 info 同时保留 */
  data?: ViewGroup[]
  info?: ViewGroup[]
  bbl?: unknown
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
  tabItems: CreateMetaTabItem[] | null
  /** type=FORM 时无 tab 分组，字段扁平放在 fromItems */
  fromItems?: CreateMetaField[] | null
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

// ========== Custom Field Option ==========

export type CustomFieldType =
  | 'SELECT_LIST_SINGLE'
  | 'SELECT_LIST_MULTIPLE'
  | 'SELECT_LIST_CASCADING'
  | 'RADIO'
  | 'CHECKBOX'
  | 'MULTI_SELECT'

/** POST /availableField/customOptions 单条请求项 */
export interface CustomFieldOptionReq {
  fieldId: string
  /** 组件 key（与 queryCreateMeta 返回的 type 一致，如 cascader / select_single 等） */
  type: string
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

// ========== Available Fields (POST /custom_field/queryAvailableFields) ==========

/** 可用字段查询参数 */
export interface AvailableFieldQuery {
  page?: number
  perPage?: number
  searchKey?: string
}

/** 可用字段单项 */
export interface AvailableFieldItem {
  fieldId: string
  id: string
  dcpFieldId: string | null
  fieldName: string
  filedType: string
  type: string
  typeName: string | null
  orderAble: boolean
  supportOperator: string[]
  isSystem: boolean
  frontPage: boolean
  esFieldType: string | null
  referencedFieldId: string | null
  enumSettingType: string | null
  obsolete: boolean
  isRequired: boolean
  fieldTag: string | null
  fieldSource: string | null
  configSchema?: string
  fieldValue?: string | null
}

/** 枚举选项（单选/下拉/级联通用） */
export interface EnumOptionItem {
  label: string
  value: string
  children?: EnumOptionItem[]
}

/** 可用字段查询结果（分页） */
export interface AvailableFieldResult {
  message: string
  success: boolean
  data: {
    total: number
    pageCount: number
    currentPage: number
    perPage: number
    list: AvailableFieldItem[]
  }
}

/** 新增/更新可选自定义字段请求（对应后端 AvailableFieldSaveRequest） */
export interface AvailableFieldSavePayload {
  fieldNumId?: string
  fieldName?: string
  filedType?: string
  type?: string
  typeName?: string
  orderAble?: boolean
  supportOperator?: string[]
  isSystem?: boolean
  frontPage?: boolean
  esFieldType?: string
  referencedFieldId?: string
  enumSettingType?: string
  obsolete?: boolean
  isRequired?: boolean
  fieldTag?: string
  fieldSource?: string
  configSchema?: string
  fieldValue?: string
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
