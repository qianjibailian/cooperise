import type { WorkflowNode } from '@/types/faiz'

/** 流程节点运行状态：pending 未开始 / current 当前节点 / done 历史已完成 */
export type WfFlowNodeState = 'pending' | 'current' | 'done'

export interface WfProps {
  nodeId?: string
  nodeName?: string
  assigneeType?: string
  assigneeValue?: string | null
  statusId?: string | null
  /** 节点运行状态（仅只读展示视图使用） */
  state?: WfFlowNodeState
}

export interface LFNode {
  id: string
  type?: string
  x?: number
  y?: number
  text?: { value?: string } | string
  properties?: WfProps
}

export interface LFEdge {
  id: string
  type?: string
  sourceNodeId: string
  targetNodeId: string
  text?: { value?: string } | string
  properties?: { isBack?: boolean }
}

let idSeq = 0
export const nid = () => `lf_${++idSeq}`

/** 自动生成流程节点标识（前端不再手填），如 node_k3f9x2ab */
export function genNodeId(): string {
  return `node_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`
}

/** 递归补齐缺失的节点标识（含后续节点），已有标识保持不变 */
export function ensureNodeIds(list: WorkflowNode[]): WorkflowNode[] {
  list.forEach((n) => {
    if (!n.nodeId?.trim()) n.nodeId = genNodeId()
    if (n.nextNodes?.length) ensureNodeIds(n.nextNodes)
  })
  return list
}

export function lfTextValue(text?: { value?: string } | string): string {
  if (!text) return ''
  return typeof text === 'string' ? text : (text.value ?? '')
}

export function mkLFNode(
  id: string,
  n: WorkflowNode,
  x: number,
  y: number,
  state?: WfFlowNodeState,
): LFNode {
  return {
    id,
    type: 'wfNode',
    x,
    y,
    text: { value: n.nodeName || '未命名' },
    properties: {
      nodeId: n.nodeId || '',
      nodeName: n.nodeName || '',
      assigneeType: n.assigneeType || 'CREATOR',
      assigneeValue: n.assigneeValue ?? null,
      statusId: n.statusId ?? null,
      state: state ?? 'pending',
    },
  }
}

export function mkLFEdge(id: string, source: string, target: string, branchName: string, isBack = false): LFEdge {
  return {
    id,
    type: 'wfEdge',
    sourceNodeId: source,
    targetNodeId: target,
    text: branchName ? { value: branchName } : undefined,
    properties: isBack ? { isBack: true } : undefined,
  }
}

/**
 * WorkflowNode[]（树形多后续节点 + 回退引用）→ LogicFlow graphData，家族树分层布局。
 * nodeStates：nodeId → 节点运行状态（current/done/pending），用于只读流程图按状态着色。
 */
export function workflowToFlow(
  list: WorkflowNode[],
  nodeStates?: Record<string, WfFlowNodeState>,
): { nodes: LFNode[]; edges: LFEdge[] } {
  idSeq = 0
  const nodes: LFNode[] = []
  const edges: LFEdge[] = []

  // 记录 nodeId → 画布节点 id（用于回退箭头定位已放置节点）
  const lfIdByNodeId = new Map<string, string>()
  // 回退引用收集：{ 源节点画布id, 目标节点 nodeId }，布局完成后统一建回退边（不参与分层，避免环）
  const backRefs: { source: string; targetNodeId: string }[] = []

  // 从左到右的树形布局（与节点左入 / 右出锚点一致）：层级沿 x 展开，叶子沿 y 排列，父节点垂直居中于子树
  const NODE_W = 168
  const NODE_H = 56
  const COL_GAP = 96 // 层级间水平间距（留出连线名称的位置）
  const ROW_GAP = 28 // 叶子节点垂直间距
  const TREE_GAP = 0.6 // 多棵独立流程树之间额外空出的行数
  const X0 = 120
  const Y0 = 80

  interface TNode {
    wf: WorkflowNode
    children: TNode[]
    x: number
    y: number
  }

  const buildTree = (n: WorkflowNode): TNode => ({
    wf: n,
    children: (n.nextNodes ?? []).map(buildTree),
    x: 0,
    y: 0,
  })

  let leafSeq = 0
  const layout = (tn: TNode, depth: number) => {
    const kids = tn.children
    if (!kids.length) {
      tn.y = Y0 + leafSeq * (NODE_H + ROW_GAP)
      leafSeq++
    } else {
      for (const k of kids) layout(k, depth + 1)
      tn.y = (kids[0].y + kids[kids.length - 1].y) / 2
    }
    tn.x = X0 + depth * (NODE_W + COL_GAP)
  }

  // 放置节点 + 建正向边（回退边最后统一补）
  const place = (n: WorkflowNode, tn: TNode): string => {
    const id = nid()
    nodes.push(mkLFNode(id, n, tn.x, tn.y, nodeStates?.[n.nodeId ?? ''] ?? 'pending'))
    if (n.nodeId) lfIdByNodeId.set(n.nodeId, id)
    for (const bid of n.backToNodeIds ?? []) {
      if (bid) backRefs.push({ source: id, targetNodeId: bid })
    }
    tn.children.forEach((c) => {
      const cid = place(c.wf, c)
      edges.push(mkLFEdge(nid(), id, cid, c.wf.branchName ?? ''))
    })
    return id
  }

  const trees = list.map(buildTree)
  for (const t of trees) {
    layout(t, 0)
    place(t.wf, t)
    leafSeq += TREE_GAP
  }

  // 回退引用补边（目标节点必须已在画布中存在，否则忽略）
  for (const r of backRefs) {
    const target = lfIdByNodeId.get(r.targetNodeId)
    if (target && target !== r.source) {
      edges.push(mkLFEdge(nid(), r.source, target, '回退', true))
    }
  }
  return { nodes, edges }
}

/** 兼容旧流程定义的 branches 结构 → 新的 nextNodes 树形结构 */
export function normalizeLegacyNodes(list: WorkflowNode[]): WorkflowNode[] {
  const walk = (n: WorkflowNode): WorkflowNode => {
    const next: WorkflowNode[] = []
    for (const b of n.branches ?? []) {
      const chain = b.nodes.map((bn) => walk(bn))
      if (!chain.length) continue
      chain[0].branchName = b.branchName || chain[0].branchName
      chain[0].nextNodes = [...(chain.slice(1) as WorkflowNode[]), ...(chain[0].nextNodes ?? [])]
      next.push(chain[0])
    }
    const cleaned: WorkflowNode = { ...n }
    delete cleaned.branches
    if (next.length) cleaned.nextNodes = [...(cleaned.nextNodes ?? []), ...next]
    cleaned.nextNodes = cleaned.nextNodes?.map((nn) => walk(nn))
    return cleaned
  }
  return list.map((n) => walk(n))
}

/** 经办岗位多选：assigneeValue 以逗号分隔存储多个岗位 ID */
export function splitAssigneeIds(v?: string | null): string[] {
  return (v || '').split(',').map((s) => s.trim()).filter(Boolean)
}
export function joinAssigneeIds(ids?: unknown): string | null {
  const list = Array.isArray(ids) ? ids.map((s) => String(s).trim()).filter(Boolean) : []
  return list.length ? list.join(',') : null
}
