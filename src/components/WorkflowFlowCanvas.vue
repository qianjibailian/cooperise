<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LogicFlow, { RectNode, RectNodeModel } from '@logicflow/core'
import '@logicflow/core/dist/style/index.css'
import { Control, MiniMap } from '@logicflow/extension'
import '@logicflow/extension/es/style/index.css'
import { message } from 'ant-design-vue'
import { PlusOutlined, NodeIndexOutlined, DeleteOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons-vue'
import type { WorkflowNode } from '@/types/faiz'
import { workflowToFlow, lfTextValue } from './workflow-flow-layout'
import type { WfProps, LFNode, LFEdge } from './workflow-flow-layout'

// ==================== LogicFlow 自定义节点 ====================
class WfNodeModel extends RectNodeModel {
  setAttributes() {
    const props = (this.properties || {}) as WfProps
    this.width = 168
    this.height = 54
    this.radius = 10
    this.fill = '#ffffff'
    this.stroke = props.statusId ? '#1890ff' : '#d9d9d9'
    this.strokeWidth = 2
    // 文本坐标是绝对坐标（x/y 即节点中心），缺 x/y 时文本渲染到 undefined 坐标导致节点看起来没内容
    this.text = {
      value: props.nodeName || '未命名',
      x: this.x,
      y: this.y,
      draggable: false,
      editable: false,
    } as any
  }
  // 只保留：左侧 target 锚点（入）、右侧 source 锚点（出），从右侧可拖出多条线到多个后续节点
  getDefaultAnchor() {
    const { x, y, width } = this
    return [
      { x: x - width / 2, y, id: 'target', type: 'target' },
      { x: x + width / 2, y, id: 'source', type: 'source' },
    ]
  }
}
class WfNodeView extends RectNode {}

// ==================== 双向转换 ====================
const STEP_X = 340 // 手动添加后续节点时的水平偏移

/** LogicFlow graphData → WorkflowNode[]（多出边 = 多个后续节点，树形） */
function flowToWorkflow(nodes: LFNode[], edges: LFEdge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n] as const))
  const outEdges = new Map<string, LFEdge[]>()
  const inCount = new Map<string, number>()
  for (const n of nodes) {
    outEdges.set(n.id, [])
    inCount.set(n.id, 0)
  }
  for (const e of edges) {
    if (outEdges.has(e.sourceNodeId)) outEdges.get(e.sourceNodeId)!.push(e)
    inCount.set(e.targetNodeId, (inCount.get(e.targetNodeId) ?? 0) + 1)
  }

  const built = new Map<string, WorkflowNode>()
  // 用递归栈检测回边（环）：目标节点已在当前递归路径上 → 属于"回退"而非"后续"，
  // 转入 backToNodeIds，避免 nextNodes 成环导致 JSON 序列化失败
  const build = (id: string, stack: Set<string>): WorkflowNode => {
    const cached = built.get(id)
    if (cached) return cached
    const n = nodeMap.get(id)
    if (!n) return { nodeId: '', nodeName: '', assigneeType: 'CREATOR', assigneeValue: null, statusId: null }
    const p = (n.properties ?? {}) as WfProps
    const wf: WorkflowNode = {
      nodeId: p.nodeId ?? lfTextValue(n.text) ?? '',
      nodeName: p.nodeName ?? lfTextValue(n.text) ?? '',
      assigneeType: p.assigneeType || 'CREATOR',
      assigneeValue: p.assigneeValue ?? null,
      statusId: p.statusId ?? null,
    }
    built.set(id, wf)
    stack.add(id)
    const outs = outEdges.get(id) ?? []
    const next: WorkflowNode[] = []
    for (const e of outs) {
      const tid = e.targetNodeId
      if (stack.has(tid)) {
        // 回边：指向当前递归路径上的祖先节点（如 暂停 → 处理中），记录为可回退引用
        const tNode = nodeMap.get(tid)
        const refId = tNode ? (tNode.properties?.nodeId ?? lfTextValue(tNode.text) ?? '') : ''
        if (refId && !(wf.backToNodeIds ?? []).includes(refId)) {
          wf.backToNodeIds = [...(wf.backToNodeIds ?? []), refId]
        }
        continue
      }
      const t = build(tid, stack)
      t.branchName = lfTextValue(e.text) || undefined
      next.push(t)
    }
    if (next.length) wf.nextNodes = next
    stack.delete(id)
    return wf
  }

  const starts = nodes
    .filter((n) => (inCount.get(n.id) ?? 0) === 0)
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0))
  return starts.map((s) => build(s.id, new Set([s.id])))
}

// ==================== 组件状态 ====================
const props = defineProps<{ modelValue: WorkflowNode[] }>()

const containerRef = ref<HTMLDivElement>()
const lfRef = ref<LogicFlow | null>(null)
let resizeObserver: ResizeObserver | null = null

// 节点属性编辑弹窗
const editOpen = ref(false)
const editTarget = ref('')
const editForm = ref<WfProps>({
  nodeId: '',
  nodeName: '',
  assigneeType: 'CREATOR',
  assigneeValue: null,
  statusId: null,
})

// 连线编辑
const selectedEdgeId = ref('')
const edgeName = ref('')

function renderGraph(list: WorkflowNode[]) {
  const lf = lfRef.value
  if (!lf) return
  const { nodes, edges } = workflowToFlow(list)
  lf.render({ nodes: nodes as any, edges: edges as any })
  selectedEdgeId.value = ''
}

function init() {
  const el = containerRef.value
  if (!el || lfRef.value) return
  const lf = new LogicFlow({
    container: el,
    grid: { size: 10, visible: false },
    background: { backgroundColor: '#fbfbfd' },
    plugins: [Control, MiniMap],
    edgeType: 'polyline',
  })
  lf.register({ type: 'wfNode', view: WfNodeView, model: WfNodeModel } as any)
  lf.on('node:dblclick', onNodeDblClick)
  lf.on('node:contextmenu', onNodeCtxMenu)
  lf.on('edge:contextmenu', onEdgeCtxMenu)
  lf.on('blank:contextmenu', onBlankCtxMenu)
  lf.on('edge:click', onEdgeClick)
  lf.on('edge:delete', () => {
    selectedEdgeId.value = ''
    hideCtxMenu()
  })
  lf.on('pane:click', () => {
    selectedEdgeId.value = ''
    hideCtxMenu()
  })
  lf.on('connection:drop', onConnectionDrop)
  lfRef.value = lf
  renderGraph(props.modelValue || [])
  lf.fitView()
}

onMounted(() => {
  init()
  // 容器尺寸变化（抽屉滑入动画、窗口缩放）时让画布自适应
  const el = containerRef.value
  if (el && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      // @logicflow/core@1.2.10 运行时支持 resize() 但 types 未声明，用 as any 规避
      ;(lfRef.value as any)?.resize()
    })
    resizeObserver.observe(el)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  const lf = lfRef.value
  lfRef.value = null
  if (!lf) return
  // @logicflow/core@1.2.10 无公开 destroy() 方法（只有 Extension 插件接口有 destroy），
  // 直接调用会抛 TypeError；这里做兜底清理，异常不影响组件卸载
  try {
    lf.clearData()
  } catch {
    /* noop */
  }
})

// 父组件更新 modelValue（如详情接口返回后赋值）时，自动按新数据重载画布
watch(() => props.modelValue, (v) => renderGraph(v || []), { deep: true })

function exportNodes(): WorkflowNode[] {
  const lf = lfRef.value
  if (!lf) return props.modelValue || []
  const data = lf.getGraphData() as { nodes: LFNode[]; edges: LFEdge[] }
  return flowToWorkflow(data.nodes ?? [], data.edges ?? [])
}

// ==================== 交互 ====================
function openNodeEdit(data: any) {
  const p = (data?.properties ?? {}) as WfProps
  editTarget.value = data?.id ?? ''
  editForm.value = {
    nodeId: p.nodeId ?? '',
    nodeName: p.nodeName ?? lfTextValue(data?.text) ?? '',
    assigneeType: p.assigneeType || 'CREATOR',
    assigneeValue: p.assigneeValue ?? null,
    statusId: p.statusId ?? null,
  }
  editOpen.value = true
}

function onNodeDblClick({ data }: { data: any }) {
  openNodeEdit(data)
}

function saveNodeEdit() {
  const lf = lfRef.value
  if (!lf || !editTarget.value) return
  // @logicflow/core@1.2.10 无 updateNodeData()，改用 updateText() + setProperties()
  lf.updateText(editTarget.value, editForm.value.nodeName || '未命名')
  lf.setProperties(editTarget.value, {
    nodeId: editForm.value.nodeId,
    nodeName: editForm.value.nodeName,
    assigneeType: editForm.value.assigneeType,
    assigneeValue: editForm.value.assigneeValue ?? null,
    statusId: editForm.value.statusId ?? null,
  } as any)
  editOpen.value = false
}

function onEdgeClick({ data }: { data: any }) {
  if (!data?.id) return
  selectedEdgeId.value = data.id
  edgeName.value = lfTextValue(data?.text)
}

function updateEdgeName() {
  const lf = lfRef.value
  if (!lf || !selectedEdgeId.value) return
  lf.setEdgeText(selectedEdgeId.value, edgeName.value.trim())
}

function deleteSelectedEdge() {
  const lf = lfRef.value
  if (!lf || !selectedEdgeId.value) return
  lf.deleteEdge(selectedEdgeId.value)
  selectedEdgeId.value = ''
}

function onConnectionDrop({ data }: { data: any }) {
  if (!data?.sourceNodeId || !data?.targetNodeId) return
  if (data.sourceNodeId === data.targetNodeId) return
  message.success('已创建后续流转，选中连线可修改名称')
}

function addNodeAt(x: number, y: number) {
  const lf = lfRef.value
  if (!lf) return
  // @logicflow/core@1.2.10 无 generateId()，id 由 addNode 内部自动生成（传入自定义唯一 id 亦可）
  lf.addNode({
    type: 'wfNode',
    x,
    y,
    text: { value: '未命名' },
    properties: { nodeId: '', nodeName: '', assigneeType: 'CREATOR', assigneeValue: null, statusId: null },
  } as any)
}

function addMainNode() {
  const lf = lfRef.value
  const el = containerRef.value
  if (!lf || !el) return
  // 放到容器可视区中央（画布底部可能超出视口，点了"没反应"）
  const rect = el.getBoundingClientRect()
  // 类型声明为 (x,y) 但运行时支持对象形式，用 as any
  const pt = (lf as any).getPointByClient({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  addNodeAt(pt.canvasOverlayPosition.x, pt.canvasOverlayPosition.y)
}

// ==================== 右键菜单 ====================
const ctxMenu = ref<{ visible: boolean; x: number; y: number; kind: 'node' | 'edge' | 'blank'; data?: any }>({
  visible: false,
  x: 0,
  y: 0,
  kind: 'blank',
})

function hideCtxMenu() {
  ctxMenu.value.visible = false
}

/** 菜单用 fixed 视口定位，domOverlayPosition 是相对画布容器的坐标，需加上容器视口偏移 */
function overlayToViewport(p?: { x?: number; y?: number }) {
  const rect = containerRef.value?.getBoundingClientRect()
  return {
    x: (p?.x ?? 0) + (rect?.left ?? 0),
    y: (p?.y ?? 0) + (rect?.top ?? 0),
  }
}

function onNodeCtxMenu({ data, position }: any) {
  const vp = overlayToViewport(position?.domOverlayPosition)
  ctxMenu.value = { visible: true, x: vp.x, y: vp.y, kind: 'node', data }
}

function onEdgeCtxMenu({ data, position }: any) {
  const vp = overlayToViewport(position?.domOverlayPosition)
  ctxMenu.value = { visible: true, x: vp.x, y: vp.y, kind: 'edge', data }
}

function onBlankCtxMenu({ e }: any) {
  ctxMenu.value = {
    visible: true,
    x: e?.clientX ?? 0,
    y: e?.clientY ?? 0,
    kind: 'blank',
  }
}

/** 右键节点 → 添加后续节点（可多次右键形成多分支，如 处理中 → 已完成 / 取消） */
function ctxAddNextNode() {
  const lf = lfRef.value
  const node = ctxMenu.value.data
  hideCtxMenu()
  if (!lf || !node?.id) return
  const model = lf.getNodeModelById(node.id)
  const baseX = (model?.x ?? node.x ?? 0) + STEP_X
  const baseY = model?.y ?? node.y ?? 0
  // 已有出边数量决定纵向偏移，避免多分支节点重叠
  const outs = (lf.getGraphData() as { edges: LFEdge[] }).edges.filter((ed) => ed.sourceNodeId === node.id).length
  const newNode = lf.addNode({
    type: 'wfNode',
    x: baseX,
    y: baseY + outs * 90,
    text: { value: '未命名' },
    properties: { nodeId: '', nodeName: '', assigneeType: 'CREATOR', assigneeValue: null, statusId: null },
  } as any)
  lf.addEdge({
    type: 'polyline',
    sourceNodeId: node.id,
    targetNodeId: newNode.id,
    text: { value: '' },
  } as any)
  message.success('已添加后续节点，右键可继续添加多个分支')
}

/** 节点 → 链接指定节点：弹窗选择画布上任意已有节点创建连线（含回退箭头） */
const linkModal = ref(false)
const linkSourceId = ref('')
const linkTargetId = ref('')
const linkName = ref('')
const linkCandidates = ref<{ id: string; label: string }[]>([])

function ctxLinkNode() {
  const lf = lfRef.value
  const data = ctxMenu.value.data
  const sid = data?.id
  hideCtxMenu()
  if (!lf || !sid) return
  const graph = lf.getGraphData() as { nodes: LFNode[] }
  linkSourceId.value = sid
  linkTargetId.value = ''
  linkName.value = ''
  // 候选 = 画布上除自身外的所有节点
  linkCandidates.value = graph.nodes
    .filter((n) => n.id !== sid)
    .map((n) => {
      const nm = (n.properties?.nodeName as string) || lfTextValue(n.text) || '未命名'
      const pid = (n.properties?.nodeId as string) || ''
      return { id: n.id, label: pid ? `${nm}（${pid}）` : nm }
    })
  linkModal.value = true
}

function confirmLinkNode() {
  const lf = lfRef.value
  const sid = linkSourceId.value
  const tid = linkTargetId.value
  if (!lf || !sid || !tid) return
  const graph = lf.getGraphData() as { edges: LFEdge[] }
  const exists = graph.edges.some((e) => e.sourceNodeId === sid && e.targetNodeId === tid)
  lf.addEdge({
    type: 'polyline',
    sourceNodeId: sid,
    targetNodeId: tid,
    text: { value: linkName.value.trim() },
  } as any)
  linkModal.value = false
  message.success(exists ? '已添加连线（与已有连线并行）' : '已创建连线')
}

function ctxEditNode() {
  const data = ctxMenu.value.data
  hideCtxMenu()
  if (data) openNodeEdit(data)
}

function ctxDeleteNode() {
  const lf = lfRef.value
  const id = ctxMenu.value.data?.id
  hideCtxMenu()
  if (!lf || !id) return
  lf.deleteNode(id)
  message.success('节点已删除')
}

// 连线：编辑名称 / 删除
const edgeNameModal = ref(false)
const edgeNameTarget = ref('')
const edgeNameInput = ref('')

function ctxEditEdgeName() {
  const data = ctxMenu.value.data
  edgeNameTarget.value = data?.id ?? ''
  edgeNameInput.value = lfTextValue(data?.text)
  hideCtxMenu()
  edgeNameModal.value = true
}

function saveEdgeName() {
  const lf = lfRef.value
  if (lf && edgeNameTarget.value) {
    lf.setEdgeText(edgeNameTarget.value, edgeNameInput.value.trim())
  }
  edgeNameModal.value = false
}

function ctxDeleteEdge() {
  const lf = lfRef.value
  const id = ctxMenu.value.data?.id
  hideCtxMenu()
  if (!lf || !id) return
  lf.deleteEdge(id)
}

/** 右键空白 → 在点击位置添加主节点（ctxMenu.x/y 已是视口坐标，getPointByClient 直接消费） */
function ctxAddMain() {
  const lf = lfRef.value
  const x = ctxMenu.value.x
  const y = ctxMenu.value.y
  hideCtxMenu()
  if (!lf) return
  const pt = (lf as any).getPointByClient({ x, y })
  addNodeAt(pt.canvasOverlayPosition.x, pt.canvasOverlayPosition.y)
}

function ctxAutoLayout() {
  hideCtxMenu()
  autoLayout()
}

function autoLayout() {
  renderGraph(exportNodes())
  lfRef.value?.fitView()
}

defineExpose({
  reload: () => renderGraph(props.modelValue || []),
  exportNodes,
  addMainNode,
  autoLayout,
})
</script>

<template>
  <div class="wf-canvas-wrap">
    <div class="wf-canvas-toolbar">
      <a-button size="small" @click="addMainNode"><PlusOutlined /> 添加节点</a-button>
      <a-button size="small" @click="autoLayout"><NodeIndexOutlined /> 自动布局</a-button>
      <template v-if="selectedEdgeId">
        <span class="wf-edge-label">连线名称：</span>
        <a-input v-model:value="edgeName" size="small" placeholder="如：已完成 / 取消，可留空" class="wf-edge-input" @change="updateEdgeName" />
        <a-button size="small" danger @click="deleteSelectedEdge"><DeleteOutlined /> 删除连线</a-button>
      </template>
      <span v-else class="wf-canvas-tip">
        右键节点/连线/空白弹出操作菜单 · 双击节点编辑属性 · 节点菜单可「链接指定节点」拖线分支或回退
      </span>
    </div>

    <div ref="containerRef" class="wf-canvas"></div>

    <!-- 右键菜单：必须放在 .wf-canvas（LogicFlow 接管 DOM）之外，避免 Vue 与 LogicFlow 同时操作同一容器 -->
    <div
      v-if="ctxMenu.visible"
      class="wf-ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @mousedown.stop
      @click.stop
    >
      <template v-if="ctxMenu.kind === 'node'">
        <div class="wf-ctx-item" @click="ctxAddNextNode"><PlusOutlined /> 添加后续节点（分支）</div>
        <div class="wf-ctx-item" @click="ctxLinkNode"><LinkOutlined /> 链接指定节点</div>
        <div class="wf-ctx-item" @click="ctxEditNode"><EditOutlined /> 编辑属性</div>
        <div class="wf-ctx-item wf-ctx-danger" @click="ctxDeleteNode"><DeleteOutlined /> 删除节点</div>
      </template>
      <template v-else-if="ctxMenu.kind === 'edge'">
        <div class="wf-ctx-item" @click="ctxEditEdgeName"><EditOutlined /> 编辑连线名称</div>
        <div class="wf-ctx-item wf-ctx-danger" @click="ctxDeleteEdge"><DeleteOutlined /> 删除连线</div>
      </template>
      <template v-else>
        <div class="wf-ctx-item" @click="ctxAddMain"><PlusOutlined /> 添加主节点</div>
        <div class="wf-ctx-item" @click="ctxAutoLayout"><NodeIndexOutlined /> 自动布局</div>
      </template>
    </div>

    <!-- 链接指定节点（支持回退箭头） -->
    <a-modal v-model:open="linkModal" title="链接指定节点" width="440px" :footer="null" destroy-on-close>
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="目标节点" required>
          <a-select
            v-model:value="linkTargetId"
            show-search
            :filter-option="(input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())"
            placeholder="选择要链接的节点（可为流程中已有节点，形成回退）"
          >
            <a-select-option v-for="c in linkCandidates" :key="c.id" :value="c.id">{{ c.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="连线名称">
          <a-input v-model:value="linkName" placeholder="如：回退 / 重新处理，可留空" @pressEnter="confirmLinkNode" />
        </a-form-item>
      </a-form>
      <a-alert type="info" show-icon message="链接到流程中已存在的节点将形成回退箭头（如 暂停 → 处理中）" style="margin-bottom: 12px" />
      <div class="wf-edit-footer">
        <a-button @click="linkModal = false">取消</a-button>
        <a-button type="primary" @click="confirmLinkNode">创建连线</a-button>
      </div>
    </a-modal>

    <!-- 连线名称编辑 -->
    <a-modal v-model:open="edgeNameModal" title="编辑连线名称" width="360px" :footer="null" destroy-on-close>
      <a-input v-model:value="edgeNameInput" placeholder="分支名称，如：已完成 / 取消，可留空" @pressEnter="saveEdgeName" />
      <div class="wf-edit-footer" style="margin-top: 12px">
        <a-button @click="edgeNameModal = false">取消</a-button>
        <a-button type="primary" @click="saveEdgeName">保存</a-button>
      </div>
    </a-modal>

    <!-- 节点属性编辑 -->
    <a-modal v-model:open="editOpen" title="编辑节点" width="420px" :footer="null" destroy-on-close>
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="节点标识" required>
          <a-input v-model:value="editForm.nodeId" placeholder="唯一标识，如 task_pending" />
        </a-form-item>
        <a-form-item label="节点名称" required>
          <a-input v-model:value="editForm.nodeName" placeholder="如：待处理" />
        </a-form-item>
        <a-form-item label="办理人">
          <a-select v-model:value="editForm.assigneeType">
            <a-select-option value="CREATOR">发起人</a-select-option>
            <a-select-option value="USER">指定用户</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="editForm.assigneeType === 'USER'" label="用户账号">
          <a-input v-model:value="editForm.assigneeValue" placeholder="用户账号" />
        </a-form-item>
        <a-form-item label="状态ID">
          <a-input v-model:value="editForm.statusId" placeholder="对应事项状态ID，可留空" />
        </a-form-item>
      </a-form>
      <div class="wf-edit-footer">
        <a-button @click="editOpen = false">取消</a-button>
        <a-button type="primary" @click="saveNodeEdit">保存</a-button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.wf-canvas-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 420px;
}
.wf-canvas-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
}
.wf-canvas-tip {
  font-size: 12px;
  color: #8c8c8c;
}
.wf-edge-label {
  font-size: 13px;
  color: #595959;
}
.wf-edge-input {
  width: 200px;
}
.wf-canvas {
  flex: 1;
  min-height: 360px;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}
.wf-ctx-menu {
  position: fixed;
  z-index: 2000;
  min-width: 168px;
  padding: 4px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}
.wf-ctx-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  font-size: 13px;
  color: #333;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}
.wf-ctx-item:hover {
  background: #f0f2f5;
}
.wf-ctx-danger {
  color: #ff4d4f;
}
.wf-ctx-danger:hover {
  background: #fff1f0;
}
.wf-edit-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
