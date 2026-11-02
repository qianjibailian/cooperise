import type { FieldOperator, RawFieldOperator } from './fieldOperator'

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
  /** 是否自定义：0-否（空间模板，空间内所有人可见）,1-是（用户自建，仅创建人可见） */
  isCustom?: number
  /** 创建人 memberId（is_custom=1 时的归属人） */
  createdBy?: string
  /** 更新人 memberId */
  updatedBy?: string
}

/** 模板分页查询请求（对应后端 QueryTemplatesRequest） */
export interface TemplateQueryRequest {
  page?: number
  pageSize?: number
  keyword?: string
  /** 预留：分类 */
  category?: string
  /** 状态：0-停用, 1-启用 */
  status?: number
  /** 按问题类型筛选：问题类型编码（如 TYPE10001） */
  issueTypeCode?: string
  /** 按所属组织筛选：组织编码 */
  organizationCode?: string
  /** 按所属空间筛选：空间编码 */
  spaceCode?: string
  /** true-返回该空间下全部模板（含他人自定义，管理页用）；false/不传-只返回空间模板与自己的自定义 */
  includeCustom?: boolean
}

/** 模板分页查询结果（对应后端 TemplatePageVO） */
export interface TemplatePageData {
  total: number
  pageCount: number
  currentPage: number
  pageSize: number
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
  pageSize: number
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
  /** 是否在职：1 是 / 0 否，不传为不限 */
  isActive?: number
  page: number
  pageSize: number
}

export interface UserItem {
  id?: number
  userNo: string
  /** 用户编号（新接口 UserVO.memberId），空间负责人等按此关联 */
  memberId?: string
  /** 账号/姓名（新接口），旧接口字段为 userCoAccount */
  coAccount?: string
  userCoAccount?: string
  /** 头像地址（新接口），旧接口字段为 userAvatar */
  avatarUrl?: string
  userAvatar?: string
  isActive: boolean | number
  userEnName?: string
  deptId?: string
  deptInfo?: string
  userDeptInfo?: string
  actualDept?: string | null
  userActualBelongDep?: string | null
  from?: string
  jiraUserKey?: string | null
  /** 兼容部分接口返回的展示字段 */
  displayName?: string
  name?: string
  /** 邮箱 */
  email?: string
  /** 姓名 */
  realName?: string
  /** 岗位 */
  positionId?: number
  positionName?: string
  /** 已分配角色 */
  roleIds?: number[]
  roleNames?: string[]
}

export interface UserListData {
  list: UserItem[]
  total: number
}

// ========== View 列表（POST /view/list） ==========

/** 视图归属人 */
export interface ViewOwner {
  userNo: string
  /** 账号/姓名（新接口），旧接口字段为 userCoAccount */
  coAccount?: string
  userCoAccount?: string
  /** 头像地址（新接口），旧接口字段为 userAvatar */
  avatarUrl?: string
  userAvatar?: string
  isActive: boolean | number
  userEnName?: string
  deptId?: string
  deptInfo?: string
  userDeptInfo?: string
  actualDept?: string | null
  userActualBelongDep?: string | null
  from?: string
  jiraUserKey?: string | null
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

// ========== Issue Patch (PATCH /issue/{id}) ==========

/** PATCH /issue/{id} 单条字段更新项 */
export interface IssuePatchField {
  fieldId: string
  fieldValue: unknown
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
  /** 问题类型编码（如 TYPE10001） */
  issueTypeCode: string
  issueKey?: string
  pageSize?: number
  page?: number
}

/** 单个选项值（下拉/单选/多选/复选框通用） */
export interface CustomFieldOptionItem {
  id: string
  name: string
  value: string
  disabled?: boolean
  /** 选项颜色（如 #ff1420） */
  color?: string
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
  pageSize: number | null
  list: CustomFieldJOption[]
  searchAfter: unknown | null
}

/** POST /custom_field/option/customOptions 响应 data 的单条（按 customFieldId 分桶） */
export interface CustomFieldOptionResponseItem {
  fieldId?: string
  customFieldId: string
  common?: unknown | null
  isOptionAdmin: unknown | null
  afterKey: unknown | null
  joptions?: CustomFieldJOptions
  /** 新格式：options 直接为选项数组（label/value/children） */
  options?: EnumOptionItem[] | { options?: EnumOptionItem[] }
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
  pageSize?: number
  searchKey?: string
  /** 展示位置：CREATE（新建）/ EDIT（编辑）/ DETAIL（详情）/ LIST（列表）；传了则只返回该场景展示的字段 */
  displayScene?: string | string[]
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
  /** 字段分组：PERSON/DESCRIPTION/TIME/SUBJECT/TEAM_STANDARD（团队标准字段）/COMPANY_STANDARD（公司标准字段） */
  fieldGroup?: string
  orderAble: boolean
  /** 支持的操作符：系统字段为对象数组 {id,name,code,identifier}，自定义字段为名称字符串 */
  supportOperator: RawFieldOperator[] | null
  isSystem: boolean
  frontPage: boolean
  esFieldType: string | null
  referencedFieldId: string | null
  obsolete: boolean
  isRequired: boolean
  fieldTag: string | null
  fieldSource: string | null
  configSchema?: string
  fieldValue?: string | null
  /** 展示场景：CREATE（新建）/ EDIT（编辑）/ DETAIL（详情）/ LIST（列表） */
  displayScene?: string[]
  /** 必填场景：CREATE / EDIT / DETAIL / LIST，为 displayScene 的子集 */
  requiredScene?: string[]
  /** 可编辑场景：CREATE / EDIT / DETAIL / LIST，未配置时为全部展示场景 */
  editableScene?: string[]
  /** 关联的问题类型编码（自定义字段至少一个，系统字段为空） */
  issueTypeCodes?: string[]
}

/** 枚举选项（单选/下拉/级联通用） */
export interface EnumOptionItem {
  label: string
  value: string
  /** 选项颜色（单选/多选下拉配置用，如 #1677ff） */
  color?: string
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
    pageSize: number
    list: AvailableFieldItem[]
  }
}

/** 新增/更新可选自定义字段请求（对应后端 AvailableFieldSaveRequest） */
export interface AvailableFieldSavePayload {
  fieldNumId?: string
  fieldName?: string
  /** 字段分组：PERSON/DESCRIPTION/TIME/SUBJECT/TEAM_STANDARD（团队标准字段）/COMPANY_STANDARD（公司标准字段） */
  fieldGroup?: string
  filedType?: string
  type?: string
  typeName?: string
  orderAble?: boolean
  supportOperator?: string[]
  isSystem?: boolean
  frontPage?: boolean
  esFieldType?: string
  referencedFieldId?: string
  obsolete?: boolean
  isRequired?: boolean
  fieldTag?: string
  fieldSource?: string
  configSchema?: string
  fieldValue?: string
  /** 展示场景：CREATE（新建）/ EDIT（编辑）/ DETAIL（详情）/ LIST（列表） */
  displayScene?: string[]
  /** 必填场景：CREATE / EDIT / DETAIL / LIST，为 displayScene 的子集 */
  requiredScene?: string[]
  /** 可编辑场景：CREATE / EDIT / DETAIL / LIST，未配置时为全部展示场景 */
  editableScene?: string[]
  /** 关联的问题类型编码（自定义字段至少一个，系统字段为空） */
  issueTypeCodes?: string[]
}

// ========== System Fields (POST /systemField/query) ==========

/** 系统字段查询参数 */
export interface SystemFieldQuery {
  page?: number
  pageSize?: number
  searchKey?: string
  /** 字段类型，如 SELECT_LIST_SINGLE */
  filedType?: string
  /** 是否必填 */
  isRequired?: boolean
  /** 是否系统字段 */
  isSystem?: boolean
  /** 是否废弃（列表「状态」列：已废弃 / 生效中） */
  obsolete?: boolean
  /** 展示场景包含：CREATE / EDIT / DETAIL / LIST */
  displayScene?: string
  /** 必填场景包含 */
  requiredScene?: string
  /** 可编辑场景包含 */
  editableScene?: string
  /** 关联问题类型（任一命中）；空数组表示无结果 */
  issueTypeCodes?: string[]
}

/** 系统字段单项（对应后端 SystemFieldVO） */
export interface SystemFieldItem {
  fieldId?: string
  id?: string
  fieldName?: string
  fieldValue?: string
  /** 字段分组：PERSON/DESCRIPTION/TIME/SUBJECT/TEAM_STANDARD（团队标准字段）/COMPANY_STANDARD（公司标准字段） */
  fieldGroup?: string
  isRequired?: boolean
  filedType?: string
  type?: string
  /** 支持的操作符 [{id, name, code, identifier}] */
  supportOperator?: FieldOperator[] | null
  obsolete?: boolean
  fieldSource?: string
  /** 启用状态（true=启用，false=停用） */
  status?: boolean
  createTime?: string
  updateTime?: string
  creator?: string
  updater?: string
  configSchema?: string
  /** 展示场景：CREATE（新建）/ EDIT（编辑）/ DETAIL（详情）/ LIST（列表） */
  displayScene?: string[]
  /** 必填场景：CREATE / EDIT / DETAIL / LIST，为 displayScene 的子集 */
  requiredScene?: string[]
  /** 可编辑场景：CREATE / EDIT / DETAIL / LIST，未配置时为全部展示场景 */
  editableScene?: string[]
  /** 关联的问题类型编码（自定义字段至少一个，系统字段为空） */
  issueTypeCodes?: string[]
}

/** 系统字段分页结果（对应后端 SystemFieldPageVO） */
export interface SystemFieldPageData {
  total?: number
  pageCount?: number
  currentPage?: number
  pageSize?: number
  list?: SystemFieldItem[]
}

/** 新增/更新系统字段请求（对应后端 SystemFieldSaveRequest） */
export interface SystemFieldSavePayload {
  fieldNumId?: string
  fieldId?: string
  fieldName?: string
  fieldValue?: string
  /** 字段分组：PERSON/DESCRIPTION/TIME/SUBJECT/TEAM_STANDARD（团队标准字段）/COMPANY_STANDARD（公司标准字段） */
  fieldGroup?: string
  isRequired?: boolean
  required?: boolean
  filedType?: string
  type?: string
  /** 支持的操作符 [{id, name, code, identifier}] */
  supportOperator?: FieldOperator[]
  obsolete?: boolean
  fieldSource?: string
  configSchema?: string
  /** 是否系统字段：新增时不传按自定义字段处理 */
  isSystem?: boolean
  /** 展示场景：CREATE（新建）/ EDIT（编辑）/ DETAIL（详情）/ LIST（列表） */
  displayScene?: string[]
  /** 必填场景：CREATE / EDIT / DETAIL / LIST，为 displayScene 的子集 */
  requiredScene?: string[]
  /** 可编辑场景：CREATE / EDIT / DETAIL / LIST，未配置时为全部展示场景 */
  editableScene?: string[]
  /** 关联的问题类型编码（自定义字段至少一个，系统字段为空） */
  issueTypeCodes?: string[]
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

/** layoutGroup 分组：SUBJECT 基础信息 / PERSON 人员 / DESCRIPTION 描述 / TIME 时间 / CUSTOM_FIELD 自定义 */
export interface DetailLayoutGroup {
  type: 'SUBJECT' | 'PERSON' | 'DESCRIPTION' | 'TIME' | 'CUSTOM_FIELD' | string
  fieldGroupStructure: DetailFieldGroupStructure
  sequence?: number
}

/** queryDetail 响应 data */
/** 详情顶部基础信息（空间 / 单号），queryDetail 返回 */
export interface DetailBaseInfo {
  issueKey?: string
  spaceCode?: string
  spaceName?: string
}

export interface DetailData {
  layoutGroup: DetailLayoutGroup[]
  /** 顶部数据来源：空间名 + 问题单号 */
  baseInfo?: DetailBaseInfo
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

// ========== Issue Change Log (POST /issue/changeLogs) ==========

/** 事项变更记录 */
export interface IssueChangeLog {
  id: number
  issueKey: string
  /** CREATE-创建事项 / UPDATE-修改字段 */
  changeType: 'CREATE' | 'UPDATE' | string
  /** 变更的字段ID；创建事项时为 CREATE */
  fieldId: string
  /** 字段名称；创建事项时为「创建事项」 */
  fieldName: string
  /** 旧值（展示文本） */
  oldValue?: string | null
  /** 新值（展示文本）；创建事项时为来源说明，如 复制自 POS-000001 */
  newValue?: string | null
  /** 操作人 memberId；系统操作为 system */
  operatorId: string
  /** 操作人完整信息（同登录用户结构）；系统操作或用户已不存在时为 null */
  operator?: Record<string, unknown> | null
  /** 变更时间 */
  changeTime: string
}

// ========== Issue Comment (POST /issue-comment/*) ==========

/** 事项评论 */
export interface IssueComment {
  id: number
  issueKey: string
  content: string
  /** 评论人 memberId */
  authorId: string
  /** 评论人完整信息（同登录用户结构）；用户已不存在时为 null */
  author?: Record<string, unknown> | null
  /** 是否当前登录用户的评论（可编辑 / 删除） */
  mine: boolean
  /** 是否编辑过 */
  edited: boolean
  createTime: string
  updateTime: string
  /** 引用的评论 ID；为空表示不引用 */
  quoteId?: number | null
  /** 引用的评论快照；原评论已删除时 deleted=true、不带内容 */
  quote?: IssueCommentQuote | null
}

/** 被引用的评论快照 */
export interface IssueCommentQuote {
  id: number
  authorId?: string
  author?: Record<string, unknown> | null
  content?: string
  /** 原评论是否已删除 */
  deleted?: boolean
}

/** 发表 / 修改评论：发表传 issueKey，修改传 id */
export interface IssueCommentSavePayload {
  id?: number
  issueKey?: string
  content: string
  /** 引用的评论 ID（仅发表时生效） */
  quoteId?: number
}

// ========== Edit Meta API（编辑事项弹窗数据）==========

/** POST /issue/queryEditMeta 请求参数 */
export interface IssueEditMetaRequest {
  issueKey: string
  /** 展示位置 / 场景：EDIT（编辑弹窗），不传则由后端按默认场景返回 */
  scene?: string
}

/** 编辑表单的一个 Tab（title 与新建/详情一致，如「必填」「选填」） */
export interface IssueEditMetaTabItem {
  title: string
  sequence?: number
  issueFields?: DetailField[]
}

/** POST /issue/queryEditMeta 响应 data：表单结构 + 字段当前值 + 事项基础信息 */
export interface IssueEditMetaVO {
  id?: number | string
  issueKey?: string
  issueTypeCode?: string
  issueTypeName?: string
  spaceCode?: string
  spaceName?: string
  statusId?: string
  statusName?: string
  statusColor?: string
  statusNode?: string
  /** 表单分组类型：TAB_CONTAINER（data 为 { tabItems }）/ COMMON_LIST（data 为字段数组） */
  type?: 'TAB_CONTAINER' | 'COMMON_LIST' | string
  /** TAB_CONTAINER 时为 { tabItems: [...]，fromItems }；COMMON_LIST 时为字段数组 */
  data?: { tabItems?: IssueEditMetaTabItem[]; fromItems?: unknown | null } | DetailField[] | null
  isUpdateToDefault?: boolean
  /** 该事项未配置专属表单时为 true，返回的是默认表单 */
  fallback?: boolean
}

// ========== Workflow API（工作流）==========

/** 流程分支（旧模型，兼容历史数据；新模型统一使用 nextNodes） */
export interface WorkflowBranch {
  /** 分支ID */
  branchId: string
  /** 分支名称，如：已完成 / 取消 / 暂停 */
  branchName: string
  /** 分支内的节点（顺序执行，支持一层分支内节点） */
  nodes: WorkflowNode[]
}

/** 流程节点 */
export interface WorkflowNode {
  nodeId: string
  nodeName: string
  /** 经办人类型：CREATOR（发起人）/ POSITION（指定岗位） */
  assigneeType?: string
  /** 经办人值：assigneeType=POSITION 时的岗位 ID，多个以英文逗号分隔 */
  assigneeValue?: string | null
  /** 对应事项状态编码 statusCode（如 STATUS00003），取自 /issue-type/status/list */
  statusCode?: string | null
  /** @deprecated 旧字段：状态 ID，仅兼容历史数据与流转接口返回 */
  statusId?: string | null
  /** 入口线名称：该节点作为某个节点的后续节点时，标识来源线（如：已完成 / 取消 / 暂停），可空 */
  branchName?: string
  /** 后续节点：一个节点可延伸出多个后续节点（多出边），树形结构，支持任意层级 */
  nextNodes?: WorkflowNode[]
  /** 是否回退节点（状态变更弹窗中由后端标记，用于展示「回退」标签） */
  isBack?: boolean
  /** 可回退到的节点 nodeId 列表：引用流程中已存在的节点（如 暂停 → 处理中），用于表达回退箭头 */
  backToNodeIds?: string[]
  /** 分支（旧模型）：仅兼容历史数据，加载时会归一化为 nextNodes */
  branches?: WorkflowBranch[]
}

/** 流程定义 */
export interface WorkflowDefinition {
  id?: number
  /** 流程标识（唯一） */
  processKey: string
  /** 流程名称 */
  processName: string
  /** 绑定的问题类型ID（历史字段，仅兼容读取） */
  issueTypeId?: string | number
  /** 绑定的问题类型编码（如 TYPE10001），保存/部署入参 */
  issueTypeCode?: string
  /** 问题类型名称 */
  issueTypeName?: string
  /** 所属组织 ID（仅兼容读取） */
  organizationId?: number
  /** 所属组织编码（问题类型归属的组织），保存/部署入参 */
  organizationCode?: string
  organizationName?: string
  /** 组织路径名称，如 SPEEDX/研发中心 */
  organizationPathName?: string
  /** 所属空间编码 / 名称 */
  spaceCode?: string
  spaceName?: string
  /** 节点列表 */
  nodes?: WorkflowNode[]
  remark?: string
  /** 状态：1-启用 0-停用 */
  status?: number
  createTime?: string
  updateTime?: string
}
