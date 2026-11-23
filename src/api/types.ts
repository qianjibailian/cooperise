// 接口与类型定义（管理后台 / 企业后台 / 业务共用，由 faiz.ts 统一 re-export）

import type {
  WorkflowDefinition,
  WorkflowNode,
} from '@/types/faiz'

/** 父子工单中的一个事项（后端 IssueRelationVO.Item） */
export interface IssueRelationItem {
  issueKey: string
  summary?: string
  spaceCode?: string
  spaceName?: string
  issueTypeCode?: string
  issueTypeName?: string
  issueTypeColor?: string
  issueTypeIcon?: string | null
  statusCode?: string
  statusName?: string
  statusColor?: string
  /** 状态已结束 */
  done?: boolean
  assigneeMemberId?: string
  assigneeName?: string
  assigneeAvatar?: string | null
  planEndDate?: string | null
}

/** 关联工单：父事项 + 直接子事项 + 同级事项 */
export interface IssueRelations {
  parent: IssueRelationItem | null
  children: IssueRelationItem[]
  /** 子事项中已结束的数量 */
  doneCount: number
  /** 同级事项：同一父事项下的其它事项；没有父事项时为空 */
  siblings: IssueRelationItem[]
}

/** 模糊搜索事项结果项（POST /issue/fuzzy-query → list） */
export interface FuzzyIssueItem {
  id?: number
  issueKey: string
  summary?: string
  issueTypeCode?: string
  issueTypeName?: string
  issueTypeColor?: string
  projectId?: string
  statusId?: string
  /** 当前所在工作流节点 nodeId */
  statusNode?: string
  statusCode?: string
  statusName?: string
  statusColor?: string
  createTime?: string
  updateTime?: string
  deleteTime?: string | null
  /** 创建人：JSON 字符串，如 {"memberId":"000001","coAccount":"系统管理员","avatarUrl":"..."} */
  creator?: string
  updater?: string
}

/** 流程基本信息保存参数（新增不传 id；不含流程节点，与部署无关） */
export type WorkflowDefinitionSaveParams = Pick<WorkflowDefinition, 'id' | 'processName' | 'organizationCode' | 'spaceCode' | 'spaceName' | 'issueTypeCode' | 'issueTypeName' | 'remark'> & {
  /** 流程标识：新增时由后端自动生成，不传；编辑时原样回传 */
  processKey?: string
}

/** 下一节点精简信息（GET /workflow/next-nodes → nextNodes） */
export interface WorkflowNextNode {
  nodeId: string
  nodeName: string
  /** 流转到该节点时写入事项的状态编码 */
  statusCode?: string
  /** 入口线名称，回退目标固定为「回退」 */
  branchName?: string
  /** 是否回退目标（来自当前节点 backToNodeIds） */
  isBack?: boolean
  assigneeType?: string
  assigneeValue?: string | null
}

/** 下一节点查询结果：单号 → 事项问题类型 + 当前状态编码 → 启用流程 → 当前节点的后续 / 回退节点 */
export interface WorkflowNextNodesResult {
  issueKey?: string
  issueTypeCode?: string
  issueTypeName?: string
  currentStatusId?: string
  currentStatusName?: string
  processDefinitionId?: number
  processKey?: string
  processName?: string
  currentNodeId?: string
  currentNodeName?: string
  nextNodes?: WorkflowNextNode[]
  /** 未命中说明：无匹配流程 / 流程未配置节点 / 当前状态未匹配到节点 / 当前节点已是末节点 */
  reason?: string
}

/** 事项关联的工作流：所有节点（绑定时的流程快照）+ 当前节点 */
export interface IssueWorkflow {
  issueKey?: string
  processDefinitionId?: number
  processKey?: string
  processName?: string
  currentNodeId?: string
  currentNodeName?: string
  currentStatusCode?: string
  /** 当前节点是否已是末节点 */
  finished?: boolean
  nodes?: WorkflowNode[]
  createTime?: string
  updateTime?: string
}

// ==================== Auth API ====================

export interface LoginParams {
  email: string
  password: string
}

export interface LoginResult {
  token: string
  username?: string
  realName?: string
  tokenType?: string
  expiresIn?: number
  /** 登录用户资料 */
  user?: {
    id: number
    memberId?: string
    coAccount?: string
    realName?: string
    email?: string
    userEnName?: string
    avatarUrl?: string | null
    deptId?: string
    deptInfo?: string | null
    isActive?: number
    roleIds?: number[]
    roleNames?: string[]
    positionId?: number
    positionName?: string | null
  }
}

// ==================== 初始化配置 ====================

/** 初始化步骤进度（space / issue_type / template / field / workflow / button） */
export interface InitConfigStep {
  key: string
  name: string
  /** PENDING / RUNNING / SUCCESS / FAILED */
  status: string
  done?: number
  total?: number
  message?: string
}

/** 初始化配置进度 */
export interface InitConfigProgress {
  /** NONE / RUNNING / SUCCESS / FAILED */
  status: string
  currentStep?: string
  message?: string
  spaceCode?: string
  steps: InitConfigStep[]
}

/** 管理后台：单个参考空间模板（个人空间模板 / 企业默认空间模板） */
export interface InitConfigReference {
  spaceCode?: string
  spaceName?: string
  /** 是否来自配置文件默认值 */
  fromDefault?: boolean
  issueTypeCount?: number
  templateCount?: number
  workflowCount?: number
  buttonCount?: number
}

/** 管理后台：初始化配置（两个参考空间模板） */
export interface InitConfigSettings {
  personal?: InitConfigReference
  enterprise?: InitConfigReference
}

/** 管理后台：同步任务（初始化任务记录） */
export interface InitConfigTask {
  id: number
  memberId: string
  userName?: string
  /** PERSONAL（个人模式）或 ORG:组织编码（企业） */
  targetKey: string
  /** RUNNING / SUCCESS / FAILED */
  status: string
  currentStep?: string
  errorMsg?: string
  spaceCode?: string
  createTime?: string
  updateTime?: string
  steps: InitConfigStep[]
}

// ==================== 用户管理 ====================

/** 新增 / 修改用户请求体（修改时 id 必填） */
export interface UserSaveParams {
  id?: number
  /** 企业后台：当前企业编码（企业端点校验用户属于该企业） */
  rootOrganizationCode?: string
  /** 姓名 */
  realName: string
  /** 工号：新增时由后端自动生成，前端不提交 */
  coAccount?: string
  email: string
  userEnName?: string
  /** 企业微信成员 userid：事项通知接收人 */
  wecomUserid?: string
  /** 部门（组织）ID */
  deptId?: string
  /** 岗位 ID */
  positionId?: number
  /** 是否在职：1 在职 / 0 离职 */
  isActive: number
  /** 角色 ID 列表 */
  roleIds?: number[]
  /** 拥有的空间编码：不传表示按部门自动带出（含下级组织），空数组表示不分配 */
  spaceCodes?: string[]
}

// ==================== 角色管理 ====================

export interface RoleItem {
  id: number
  roleName: string
  /** 角色编码，后端生成，业务唯一 */
  roleCode?: string
  description?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status: number
  /** 关联用户数 */
  userCount?: number
  /** 已分配权限点编码集合（角色授权界面回填用） */
  permissions?: string[]
  createdAt?: string
}

export interface RoleQueryParams {
  keyword?: string
  status?: number
  page: number
  pageSize: number
}

/** 新增 / 修改角色请求体（修改时 id 必填；角色编码由后端生成，不提交） */
export interface RoleSaveParams {
  id?: number
  roleName: string
  description?: string
  sort?: number
  status: number
}

/** 权限点（POST /role/permission/list 返回） */
export interface PermissionItem {
  id: number
  /** 权限编码，如 admin:space:delete */
  permCode: string
  /** 权限名称，如 删除空间 */
  permName: string
  /** menu=菜单 / button=按钮 */
  permType: 'menu' | 'button'
  /** 所属菜单编码（按钮权限归属） */
  menuCode?: string | null
  sort?: number
  status: number
}

// ==================== 岗位管理 ====================

export interface PositionItem {
  id: number
  positionName: string
  /** 岗位编码，后端生成，业务唯一 */
  positionCode?: string
  /** 所属组织 ID */
  organizationId?: number
  /** 所属组织编码 */
  organizationCode?: string
  /** 所属组织名称（列表展示用） */
  organizationName?: string
  /** 所属组织路径名称，如 全球运营中心/C端产品部 */
  organizationPathName?: string
  description?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status: number
  /** 关联用户数 */
  userCount?: number
  createdAt?: string
}

export interface PositionQueryParams {
  keyword?: string
  status?: number
  /** 按组织筛选（含下级组织）：organizationId 优先 */
  organizationId?: number
  organizationCode?: string
  /** 企业后台：只查当前企业及下级组织的岗位 */
  rootOrganizationCode?: string
  page: number
  pageSize: number
}

/** 新增 / 修改岗位请求体（修改时 id 必填；岗位编码由后端生成，不提交） */
export interface PositionSaveParams {
  id?: number
  positionName: string
  /** 所属组织：organizationId 与 organizationCode 二选一，ID 优先；都不传表示不挂组织 */
  organizationId?: number
  organizationCode?: string
  description?: string
  sort?: number
  status: number
}

// ==================== 国际化翻译（原词为中文，目标语言目前只有 en） ====================

export interface I18nItem {
  id: number
  /** 原词（中文），支持 {0} {1} 占位 */
  sourceText: string
  lang: string
  /** 译文 */
  targetText: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface I18nQueryParams {
  keyword?: string
  lang?: string
  page?: number
  pageSize?: number
}

export interface I18nSaveParams {
  id?: number
  sourceText: string
  lang?: string
  targetText: string
  remark?: string
}

// ==================== 问题类型 ====================

export interface IssueTypeItem {
  id: number
  issueTypeName: string
  /** 问题类型编码，后端生成，业务唯一 */
  issueTypeCode?: string
  /** 所属组织 ID */
  organizationId?: number
  /** 所属组织编码 */
  organizationCode?: string
  /** 所属组织名称（列表展示用） */
  organizationName?: string
  /** 所属组织路径名称，如 全球运营中心/C端产品部 */
  organizationPathName?: string
  /** 所属空间编码 / 名称 */
  spaceCode?: string
  spaceName?: string
  /** 图标颜色，如 #0A84FF */
  color?: string
  /** 类型图标 key（见 utils/issueTypeIcons），如 bug */
  iconUri?: string | null
  description?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status: number
  /** 关联事项数 */
  issueCount?: number
  createdAt?: string
}

/** 问题类型下的状态（在问题状态抽屉中维护） */
export interface IssueTypeStatus {
  /** 状态 ID，新增时不传 */
  id?: number
  statusName: string
  /** 状态编码，后端生成 */
  statusCode?: string
  color?: string
  /** 排序值，按列表顺序 */
  sort?: number
}

export interface IssueTypeQueryParams {
  keyword?: string
  status?: number
  /** 按组织编码筛选 */
  organizationCode?: string
  /** 按空间编码筛选 */
  spaceCode?: string
  page: number
  pageSize: number
}

/** 新增 / 修改问题类型请求体（修改时 id 必填；编码由后端生成，不提交） */
export interface IssueTypeSaveParams {
  id?: number
  issueTypeName: string
  /** 所属组织编码 */
  organizationCode?: string
  /** 所属空间编码 / 名称 */
  spaceCode?: string
  spaceName?: string
  color?: string
  /** 类型图标 key */
  iconUri?: string | null
  description?: string
  sort?: number
  status: number
}

// ==================== 事项按钮 ====================

/** 按钮动作类型 */
export type IssueButtonActionType = 'TRANSITION' | 'ROLLBACK' | 'EDIT' | 'COPY' | 'ASSIGN' | 'SPLIT' | 'DELETE' | 'CUSTOM'

/** 按钮样式 */
export type IssueButtonStyle = 'primary' | 'default' | 'danger'

/** 事项按钮（后端 IssueButtonVO，配置列表与事项详情按钮共用） */
export interface IssueButtonItem {
  id: number
  /** 按钮标识（后端生成，BTN + 5 位数字） */
  buttonKey: string
  buttonName: string
  actionType: IssueButtonActionType
  /** 问题类型编码 / 名称：编码为空表示所有类型 */
  issueTypeCode?: string | null
  issueTypeName?: string | null
  /** 适用的问题状态编码 / 名称（一一对应）：为空表示所有状态 */
  statusCodes?: string[] | null
  statusNames?: string[] | null
  /** TRANSITION / ROLLBACK 的目标状态编码 / 名称：空表示流程中的第一个后续（回退）节点 */
  targetStatusCode?: string | null
  targetStatusName?: string | null
  /** 事项详情按钮：解析出的目标流程节点 ID，点击时作为 /workflow/task/change-status 的 targetStatus */
  targetNodeId?: string | null
  buttonStyle?: IssueButtonStyle
  /** 状态：0 停用 / 1 启用 */
  status: number
  description?: string | null
  createdAt?: string
}

export interface IssueButtonQueryParams {
  /** 按钮名称 / 标识 */
  keyword?: string
  /** 问题类型编码：结果含通用（类型为空）按钮 */
  issueTypeCode?: string
  /** 问题状态编码：结果含适用状态包含它的按钮及通用（状态为空）按钮 */
  statusCode?: string
  actionType?: IssueButtonActionType
  status?: number
  page: number
  pageSize: number
}

/** 新增 / 修改按钮请求体（修改时 id 必填；按钮标识由后端生成） */
export interface IssueButtonSaveParams {
  id?: number
  buttonName: string
  actionType: IssueButtonActionType
  issueTypeCode?: string | null
  /** 适用的问题状态编码（可多选）：空数组表示所有状态 */
  statusCodes?: string[]
  targetStatusCode?: string | null
  buttonStyle?: IssueButtonStyle
  status: number
  description?: string | null
}

// ==================== 我的看板 ====================

/** 与我的关系：我经办 / 我创建 / 不限 */
export type MyBoardRelation = 'ASSIGNEE' | 'CREATOR' | 'ANY'

/** 状态范围：未结束 / 全部 / 指定状态 */
export type MyBoardStatusScope = 'UNRESOLVED' | 'ALL' | 'SPECIFIC'

/** 我的看板面板配置（后端 MyBoardPanelVO） */
export interface MyBoardPanel {
  id: number
  title: string
  /** 问题类型编码；空数组表示全部类型 */
  issueTypeCodes: string[]
  relation: MyBoardRelation
  statusScope: MyBoardStatusScope
  /** statusScope 为 SPECIFIC 时的状态编码 */
  statusCodes: string[]
  /** 面板展示条数 */
  pageSize: number
  sort?: number
  /** 自定义筛选条件：globalFilter JSON 字符串（与 /issue/query 同结构），null 表示无 */
  filterConfig?: string | null
}

export type MyBoardPanelSavePayload = Omit<MyBoardPanel, 'id' | 'sort'> & { id?: number }

/** 面板里的一条事项 */
export interface MyBoardIssue {
  issueKey: string
  summary?: string
  issueTypeCode?: string
  issueTypeName?: string
  issueTypeColor?: string
  issueTypeIcon?: string | null
  statusCode?: string
  statusName?: string
  statusColor?: string
  updateTime?: string
}

/** 面板数据：命中总数 + 最近更新的前 N 条 */
export interface MyBoardPanelData {
  panelId: number
  total: number
  list: MyBoardIssue[]
}

// ==================== 空间管理 ====================

/** 空间（后端 SpaceVO） */
export interface SpaceItem {
  id: number
  /** 空间编码（后端生成，十位数字），业务关联（问题类型 / 模板 / 工作流）用 */
  spaceCode: string
  spaceName: string
  /** 空间标识：1~5 位大写字母，用作问题单号前缀（如 RD → RD-000042） */
  spaceKey?: string
  /** 所属组织 */
  organizationId?: number
  organizationCode?: string
  organizationName?: string
  /** 组织路径名称，如 全球运营中心/C端产品部 */
  organizationPathName?: string
  /** 负责人用户编号（memberId） */
  ownerMemberId?: string
  /** 负责人姓名（无姓名时取英文名） */
  ownerName?: string
  /** 图标颜色，如 #0A84FF */
  color?: string
  description?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status: number
  createTime?: string
  updateTime?: string
}

export interface SpaceQueryParams {
  /** 空间名称 / 编码 */
  keyword?: string
  status?: number
  /** 按组织筛选（含下级组织）：organizationId 优先 */
  organizationId?: number
  organizationCode?: string
  /** 只查当前用户加入的空间 */
  onlyJoined?: boolean
  /** 企业模式：只展示企业空间（与个人空间隔离） */
  excludePersonal?: boolean
  /** 个人模式：只展示个人空间（与企业空间隔离） */
  personalOnly?: boolean
  page: number
  pageSize: number
}

/** 新增 / 修改空间请求体（修改时 id 必填；编码由后端生成，不提交） */
export interface SpaceSaveParams {
  id?: number
  spaceName: string
  /** 空间标识：后端按空间名自动生成，传了也会被忽略，无需提交 */
  spaceKey?: string
  /** 所属组织：organizationId 与 organizationCode 二选一，ID 优先 */
  organizationId?: number
  organizationCode?: string
  /** 负责人用户编号（memberId），空表示不设负责人 */
  ownerMemberId?: string
  color?: string
  description?: string
  sort?: number
  status: number
}

// ==================== 组织管理 ====================

/** 组织节点（后端 OrganizationVO） */
export interface OrganizationNode {
  id: number
  /** 组织编码（后端自动生成），业务唯一 */
  organizationCode?: string
  /** 事项标识：1~4 位大写字母，用作事项单号前缀（如 UG → UG-000042） */
  issueKeyPrefix?: string
  /** 父组织 ID，0 表示顶级 */
  parentId: number
  organizationName: string
  /** 组织层级，顶级 = 1 */
  orgLevel?: number
  /** 物化路径，如 /1/5/12 */
  path?: string
  /** 路径名称，如 全球运营中心/C端产品部 */
  pathName?: string
  /** 排序值，越小越靠前 */
  sort?: number
  /** 状态：0 停用 / 1 启用 */
  status?: number
  remark?: string
  children?: OrganizationNode[]
}

/** 新增 / 修改组织请求体（修改时 id 必填） */
export interface OrganizationSaveParams {
  id?: number
  /** 企业后台：当前企业编码，新增组织只能在该企业范围内 */
  rootOrganizationCode?: string
  /** 组织编码由后端生成，前端不再提交 */
  organizationCode?: string
  /** 事项标识：1~4 位大写字母 */
  issueKeyPrefix?: string
  parentId: number
  organizationName: string
  sort?: number
  status?: number
  remark?: string
}

/** 企业设置详情（POST /enterprise/settings/detail） */
export interface EnterpriseSettings {
  organizationCode: string
  organizationName: string
  ownerMemberId?: string
  ownerName?: string
  isOwner: boolean
  memberCount: number
}

// ==================== 个人中心 / 账户设置 ====================

/** 用户所属组织（GET /personal-center/info → organizations） */
export interface ProfileOrganization {
  id: number
  organizationCode?: string
  organizationName?: string
  /** 组织路径名称，如 全球运营中心/C端产品部 */
  pathName?: string
  status?: number
}

/** 当前登录用户资料（GET /personal-center/info，对应后端 UserProfileVO） */
export interface CurrentUserProfile {
  id?: number
  memberId?: string
  /** 工号（后端自动生成） */
  coAccount?: string
  /** 姓名 */
  realName?: string
  /** 登录邮箱 */
  email?: string
  userEnName?: string
  avatarUrl?: string
  deptId?: string
  /** 部门路径 */
  deptInfo?: string
  /** 实际归属部门 */
  actualDept?: string
  jiraUserKey?: string
  /** 是否在职：1 在职 / 0 离职 */
  isActive?: number
  organizations?: ProfileOrganization[]
}

/** 个人中心可编辑字段 */
export type PersonalCenterUpdate = Pick<CurrentUserProfile, 'realName' | 'userEnName' | 'email'>

