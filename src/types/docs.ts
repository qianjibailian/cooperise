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

export interface DocItem {
  id: string
  title: string
  type: DocType
  /** 富文本文档的 HTML 内容 */
  content: string
  /** 表格 / 思维导图 / 流程图的数据 */
  data?: SheetData | MindmapData | FlowData
  updatedAt: number
  /** 创建时间 */
  createdAt?: number
  /** 所属文件夹；空表示未分组 */
  folderId?: string
  /** 是否收藏 */
  starred?: boolean
}
