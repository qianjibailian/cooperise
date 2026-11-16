/** 文档类型：富文本文档 / 表格 / 思维导图 / 流程图 */
export type DocType = 'doc' | 'sheet' | 'mindmap' | 'flow'

export interface DocFolder {
  id: string
  name: string
  createdAt: number
  /** 是否置顶（置顶知识库） */
  starred?: boolean
}

/** 表格数据：二维字符串数组 */
export interface SheetData {
  rows: string[][]
}

/** 思维导图节点 */
export interface MindNode {
  id: string
  text: string
  children: MindNode[]
}

export interface MindmapData {
  root: MindNode
}

/** 流程图数据：LogicFlow 的 graphData */
export interface FlowData {
  graph: any | null
}

/** 文档评论回复 */
export interface DocCommentReply {
  id: string
  author: string
  /** 头像地址（取文档标题作者的本地头像） */
  avatar?: string
  content: string
  createdAt: number
}

/**
 * 文档评论：存在富文本文档的 DocMeta.comments 里，随文档内容一起保存。
 * 选中文字评论时记录被引用的正文（quote），重新打开文档后按文字重新定位高亮。
 */
export interface DocComment {
  id: string
  author: string
  /** 头像地址（取文档标题作者的本地头像） */
  avatar?: string
  content: string
  createdAt: number
  /** 评论范围：行级评论 / 全文评论；旧数据没有该字段时按是否带 quote 判断 */
  scope?: 'line' | 'doc'
  /** 被评论的正文片段；为空表示整篇文档评论 */
  quote?: string
  /** 是否已解决 */
  resolved?: boolean
  replies?: DocCommentReply[]
}

/** 富文本文档的附加信息（存在 DocItem.data 里）：图标 emoji、封面、评论、点赞、创建者信息 */
export interface DocMeta {
  icon?: string
  cover?: string
  comments?: DocComment[]
  /** 点赞用户列表（存登录名，当前用户在其中即为已点赞） */
  likedBy?: string[]
  /** 创建者昵称 / 头像（创建文档时取本地登录信息，随 data 一起保存） */
  authorName?: string
  authorAvatar?: string
}

export interface DocItem {
  id: string
  title: string
  type: DocType
  /** 富文本文档的 HTML 内容 */
  content: string
  /** 表格 / 思维导图 / 流程图的数据；富文本文档存图标 / 封面（DocMeta） */
  data?: SheetData | MindmapData | FlowData | DocMeta
  updatedAt: number
  /** 创建时间 */
  createdAt?: number
  /** 所属文件夹；空表示未分组 */
  folderId?: string
  /** 是否收藏 */
  starred?: boolean
  /** 创建人（作者），旧数据可能为空 */
  author?: string
  /** 创建人头像地址（创建文档时取本地登录信息，旧数据可能为空） */
  authorAvatar?: string
}
