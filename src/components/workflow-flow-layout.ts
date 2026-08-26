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
}

let idSeq = 0
export const nid = () => `lf_${++idSeq}`

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

export function mkLFEdge(id: string, source: string, target: string, branchName: string): LFEdge {
  return {
    id,
    type: 'polyline',
    sourceNodeId: source,
    targetNodeId: target,
    text: branchName ? { value: branchName } : undefined,
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

  // 家族树布局常量：叶子横向排开、父节点居中于子树，分支自然展开不重叠
  const NODE_W = 168
  const NODE_H = 54
  const H_GAP = 88 // 叶子节点水平间距
  const V_GAP = 118 // 层级垂直间距
  const X0 = 300
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

  // Reingold-Tilford 简化版：叶子占一个槽位，父节点水平居中于其子树
  let leafSeq = 0
  const layout = (tn: TNode, depth: number) => {
    const kids = tn.children
    if (!kids.length) {
      tn.x = X0 + leafSeq * (NODE_W + H_GAP)
      leafSeq++
    } else {
      for (const k of kids) layout(k, depth + 1)
      tn.x = (kids[0].x + kids[kids.length - 1].x) / 2
    }
    tn.y = Y0 + depth * (NODE_H + V_GAP)
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
  }

  // 回退引用补边（目标节点必须已在画布中存在，否则忽略）
  for (const r of backRefs) {
    const target = lfIdByNodeId.get(r.targetNodeId)
    if (target && target !== r.source) {
      edges.push(mkLFEdge(nid(), r.source, target, '回退'))
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
