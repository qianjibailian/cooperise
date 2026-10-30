import type { WorkflowNode } from '@/types/faiz'

/** 流程节点运行状态：pending 未开始 / current 当前节点 / done 历史已完成 */
export type WfFlowNodeState = 'pending' | 'current' | 'done'

export interface WfProps {
  nodeId?: string
  nodeName?: string
  assigneeType?: string
  assigneeValue?: string | null
  statusCode?: string | null
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
      statusCode: n.statusCode ?? null,
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
 * WorkflowNode[]（树形多后续节点 + 回退引用）→ LogicFlow graphData。
 *
 * 后端返回的是「展开树」：同一个 nodeId 会挂在多个父节点的 nextNodes 里（如「暂停」同时挂在 10 个
 * 节点下，且自身 backToNodeIds 指向全部上游）。按树逐个展开会产生 11 个「暂停」节点、上百条回退线。
 * 因此这里先把图折叠成 DAG：节点按 nodeId 去重、正向边与回退边各自去重（每条 (源, 目标) 只留一条）。
 * 布局改为分层：层级 = 到起点的最长路径（x 按层级展开），y 先让叶子依次占行、父节点居中于子节点，
 * 再按层内顺序拉开间距，避免多个父共享同一子节点时坐标重叠。
 *
 * nodeStates：nodeId → 节点运行状态（current/done/pending），用于只读流程图按状态着色。
 */
export function workflowToFlow(
  list: WorkflowNode[],
  nodeStates?: Record<string, WfFlowNodeState>,
): { nodes: LFNode[]; edges: LFEdge[] } {
  idSeq = 0
  const nodes: LFNode[] = []
  const edges: LFEdge[] = []

  // 从左到右布局（与节点左入 / 右出锚点一致）：层级沿 x 展开，叶子沿 y 排列
  const NODE_W = 168
  const NODE_H = 56
  const COL_GAP = 96 // 层级间水平间距（留出连线名称的位置）
  const ROW_GAP = 28 // 同一层级相邻节点的垂直间距
  const X0 = 120
  const Y0 = 80

  // ---------- 1. 折叠成 DAG：同一 nodeId 只保留一个画布节点 ----------
  let anonSeq = 0
  const keyOf = new WeakMap<WorkflowNode, string>()
  const byKey = new Map<string, WorkflowNode>()

  /** 节点去重键：无 nodeId 的历史数据按出现顺序生成匿名键（各自独立） */
  const keyFor = (n: WorkflowNode): string => {
    const cached = keyOf.get(n)
    if (cached) return cached
    const key = n.nodeId?.trim() || `__anon_${++anonSeq}`
    keyOf.set(n, key)
    return key
  }

  const collect = (n: WorkflowNode) => {
    const key = keyFor(n)
    if (!byKey.has(key)) byKey.set(key, n)
    for (const c of n.nextNodes ?? []) collect(c)
  }
  for (const n of list) collect(n)

  const childrenKeys = new Map<string, string[]>()
  const branchNames = new Map<string, string>()
  const backTargets = new Map<string, string[]>()

  const walkEdges = (n: WorkflowNode, seen: Set<string>) => {
    const key = keyFor(n)
    if (seen.has(key)) return // 同一节点首次展开时已建过出边，避免重复遍历
    seen.add(key)

    for (const bid of n.backToNodeIds ?? []) {
      const target = String(bid ?? '').trim()
      if (!target || target === key || !byKey.has(target)) continue
      const arr = backTargets.get(key) ?? []
      if (!arr.includes(target)) arr.push(target)
      backTargets.set(key, arr)
    }

    for (const c of n.nextNodes ?? []) {
      const ck = keyFor(c)
      if (ck === key) continue
      const arr = childrenKeys.get(key) ?? []
      if (!arr.includes(ck)) {
        arr.push(ck)
        childrenKeys.set(key, arr)
        const name = (c.branchName ?? '').trim()
        if (name) branchNames.set(`${key}|${ck}`, name)
      }
      walkEdges(c, seen)
    }
  }
  const seen = new Set<string>()
  for (const n of list) walkEdges(n, seen)

  const allKeys = [...byKey.keys()]

  // ---------- 2. 分层：层级 = 到起点的最长路径 ----------
  const parentCount = new Map<string, number>(allKeys.map((k) => [k, 0]))
  for (const cs of childrenKeys.values()) {
    for (const c of cs) parentCount.set(c, (parentCount.get(c) ?? 0) + 1)
  }
  const levels = new Map<string, number>()
  const queue = allKeys.filter((k) => (parentCount.get(k) ?? 0) === 0)
  for (const k of queue) levels.set(k, 0)
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]
    const lv = levels.get(cur) ?? 0
    for (const c of childrenKeys.get(cur) ?? []) {
      levels.set(c, Math.max(levels.get(c) ?? 0, lv + 1))
      const left = (parentCount.get(c) ?? 1) - 1
      parentCount.set(c, left)
      if (left === 0) queue.push(c)
    }
  }
  // 兜底：正向边理论上无环，极端数据下未分层的放第 0 层
  for (const k of allKeys) if (!levels.has(k)) levels.set(k, 0)

  // ---------- 3. y 坐标：叶子依次占行，父节点居中于子节点，再按层内去重叠 ----------
  const yOf = new Map<string, number>()
  let cursor = 0
  const byLevelDesc = [...allKeys].sort((a, b) => (levels.get(b) ?? 0) - (levels.get(a) ?? 0))
  for (const k of byLevelDesc) {
    const ys = (childrenKeys.get(k) ?? [])
      .map((c) => yOf.get(c))
      .filter((v): v is number => typeof v === 'number')
    if (!ys.length) {
      yOf.set(k, Y0 + cursor * (NODE_H + ROW_GAP))
      cursor++
      continue
    }
    yOf.set(k, (Math.min(...ys) + Math.max(...ys)) / 2)
  }
  // 多个父共享同一子节点时会算出相同的 y，按层内顺序拉开间距
  const keysByLevel = new Map<number, string[]>()
  for (const k of allKeys) {
    const lv = levels.get(k) ?? 0
    const arr = keysByLevel.get(lv) ?? []
    arr.push(k)
    keysByLevel.set(lv, arr)
  }
  for (const lv of [...keysByLevel.keys()].sort((a, b) => a - b)) {
    const arr = keysByLevel.get(lv)!.sort((a, b) => (yOf.get(a) ?? 0) - (yOf.get(b) ?? 0))
    let prevY = -Infinity
    for (const k of arr) {
      const y = Math.max(yOf.get(k) ?? Y0, prevY + NODE_H + ROW_GAP)
      yOf.set(k, y)
      prevY = y
    }
  }

  // ---------- 4. 输出画布数据 ----------
  const lfIdByKey = new Map<string, string>()
  for (const k of allKeys) {
    const n = byKey.get(k)!
    const id = nid()
    lfIdByKey.set(k, id)
    nodes.push(
      mkLFNode(
        id,
        n,
        X0 + (levels.get(k) ?? 0) * (NODE_W + COL_GAP),
        yOf.get(k) ?? Y0,
        nodeStates?.[n.nodeId ?? ''] ?? 'pending',
      ),
    )
  }
  for (const [p, cs] of childrenKeys) {
    const sid = lfIdByKey.get(p)
    if (!sid) continue
    for (const c of cs) {
      const tid = lfIdByKey.get(c)
      if (!tid) continue
      edges.push(mkLFEdge(nid(), sid, tid, branchNames.get(`${p}|${c}`) ?? ''))
    }
  }
  for (const [k, backs] of backTargets) {
    const sid = lfIdByKey.get(k)
    if (!sid) continue
    for (const b of backs) {
      const tid = lfIdByKey.get(b)
      if (!tid || tid === sid) continue
      edges.push(mkLFEdge(nid(), sid, tid, '回退', true))
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
