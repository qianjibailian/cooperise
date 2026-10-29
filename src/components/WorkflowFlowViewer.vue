<template>
  <div ref="wrapRef" class="wf-viewer-wrap" :style="{ height: props.height }">
    <div ref="containerRef" class="wf-viewer-canvas" />

    <!-- 缩放控制 -->
    <div class="wf-zoom">
      <a-tooltip title="缩小"><button type="button" class="wf-zoom-btn" @click="zoom(false)"><ZoomOutOutlined /></button></a-tooltip>
      <span class="wf-zoom-val" title="重置为 100%" @click="resetZoom">{{ Math.round(scale * 100) }}%</span>
      <a-tooltip title="放大"><button type="button" class="wf-zoom-btn" @click="zoom(true)"><ZoomInOutlined /></button></a-tooltip>
      <i class="wf-zoom-sep" />
      <a-tooltip title="适应画布"><button type="button" class="wf-zoom-btn" @click="fitView"><ExpandOutlined /></button></a-tooltip>
    </div>
    <span class="wf-viewer-tip">滚轮缩放 · 拖拽平移 · 悬停节点查看详情</span>

    <!-- 节点悬停详情 -->
    <div v-if="hover" class="wf-node-tip" :style="{ left: hover.x + 'px', top: hover.y + 'px' }">
      <div class="wf-tip-head">
        <span class="wf-tip-name">{{ hover.name }}</span>
        <span v-if="hover.state === 'current'" class="wf-tip-badge is-current">当前</span>
        <span v-else-if="hover.state === 'done'" class="wf-tip-badge is-done">已完成</span>
      </div>
      <dl class="wf-tip-list">
        <template v-for="row in hover.rows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ZoomInOutlined, ZoomOutOutlined, ExpandOutlined } from '@ant-design/icons-vue'
import LogicFlow, { RectNode, RectNodeModel, h } from '@logicflow/core'
import '@logicflow/core/dist/style/index.css'
import type { WorkflowNode } from '@/types/faiz'
import { workflowToFlow, splitAssigneeIds } from './workflow-flow-layout'
import { wfEdgeRegister, WF_EDGE_TYPE } from './workflow-flow-edge'
import type { WfFlowNodeState, WfProps } from './workflow-flow-layout'

const props = withDefaults(
  defineProps<{
    /** 流程定义节点树（已 normalize 的 WorkflowNode[]） */
    nodes: WorkflowNode[]
    /** 节点状态：nodeId → current(当前) / done(历史已完成) / pending(未开始) */
    nodeStates?: Record<string, WfFlowNodeState>
    /** 画布高度 */
    height?: string
    /** 岗位 ID → 名称：悬停详情展示经办岗位 */
    positionNames?: Record<string, string>
  }>(),
  { nodeStates: () => ({}), height: '320px', positionNames: () => ({}) },
)

// 只读节点：按状态着色（当前橙色高亮 / 已完成绿色 / 未开始灰色）
class ViewerNodeModel extends RectNodeModel {
  setAttributes() {
    const p = (this.properties || {}) as WfProps
    this.width = 168
    this.height = 54
    this.radius = 10
    // 文本坐标是绝对坐标（x/y 即节点中心），缺 x/y 时文本渲染到 undefined 坐标导致节点看起来没内容
    this.text = {
      value: p.nodeName || '未命名',
      x: this.x,
      y: this.y,
      draggable: false,
      editable: false,
    } as any
  }
  // 节点配色必须在 getNodeStyle 中设置：@logicflow/core@1.2.10 渲染时只读取 getNodeStyle()，setAttributes 里赋值 fill/stroke 不生效
  getNodeStyle() {
    const style = super.getNodeStyle()
    const state = (this.properties as WfProps)?.state ?? 'pending'
    if (state === 'current') {
      // 当前节点：实心橙底 + 白字，配合外圈呼吸光晕突出显示
      style.fill = '#fa8c16'
      style.stroke = '#d46b08'
      style.strokeWidth = 2
    } else if (state === 'done') {
      style.fill = '#f6ffed'
      style.stroke = '#52c41a'
      style.strokeWidth = 2
    } else {
      style.fill = '#ffffff'
      style.stroke = '#d9d9e3'
      style.strokeWidth = 1.2
    }
    return style
  }
  getTextStyle() {
    const style = super.getTextStyle()
    const current = (this.properties as WfProps)?.state === 'current'
    style.color = current ? '#ffffff' : '#262626'
    style.fontSize = current ? 14 : 13
    ;(style as any).fontWeight = current ? 600 : 400
    return style
  }
  // 与编辑画板一致：左入右出，连线水平进出节点（只读模式下锚点不显示）
  getDefaultAnchor() {
    const { x, y, width } = this
    return [
      { x: x - width / 2, y, id: 'target', type: 'target' },
      { x: x + width / 2, y, id: 'source', type: 'source' },
    ]
  }
}
/** 当前节点额外绘制：外圈光晕（呼吸动画）+ 顶部「当前」角标 */
class ViewerNodeView extends RectNode {
  getShape() {
    const { model } = this.props as any
    const base = super.getShape()
    if ((model.properties as WfProps)?.state !== 'current') return base
    const { x, y, width, height } = model
    const left = x - width / 2
    const top = y - height / 2
    return h('g', {}, [
      h('rect', {
        className: 'wf-current-halo',
        x: left - 6,
        y: top - 6,
        width: width + 12,
        height: height + 12,
        rx: 14,
        ry: 14,
        fill: 'none',
        stroke: '#fa8c16',
        strokeWidth: 6,
      }),
      base,
      h('rect', { x: x - 22, y: top - 11, width: 44, height: 18, rx: 9, ry: 9, fill: '#d4380d' }),
      h('text', { x, y: top - 2, fill: '#fff', 'font-size': 11, 'font-weight': 600, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '当前'),
    ])
  }
}

const wrapRef = ref<HTMLDivElement>()
const containerRef = ref<HTMLDivElement>()
const lfRef = ref<LogicFlow | null>(null)
let resizeObserver: ResizeObserver | null = null

// ==================== 缩放 ====================
const scale = ref(1)

function syncScale() {
  const t = (lfRef.value as any)?.getTransform?.()
  if (t?.SCALE_X) scale.value = t.SCALE_X
}
function zoom(zoomIn: boolean) {
  lfRef.value?.zoom(zoomIn)
  syncScale()
}
function resetZoom() {
  lfRef.value?.resetZoom()
  syncScale()
}
function fitView() {
  lfRef.value?.fitView()
  syncScale()
}

// ==================== 悬停详情 ====================
interface HoverInfo {
  x: number
  y: number
  name: string
  state?: WfFlowNodeState
  rows: { label: string; value: string }[]
}
const hover = ref<HoverInfo | null>(null)

/** nodeId → 原始节点（取出口名称 / 回退目标等画布属性里没有的信息） */
const nodeById = computed(() => {
  const map = new Map<string, WorkflowNode>()
  const walk = (list: WorkflowNode[]) =>
    list.forEach((n) => {
      if (n.nodeId) map.set(n.nodeId, n)
      if (n.nextNodes?.length) walk(n.nextNodes)
    })
  walk(props.nodes || [])
  return map
})

function assigneeText(n: WorkflowNode): string {
  if (n.assigneeType !== 'POSITION') return '发起人'
  const ids = splitAssigneeIds(n.assigneeValue)
  if (!ids.length) return '指定岗位（未选择）'
  return ids.map((id) => props.positionNames[id] || `岗位 ${id}`).join('、')
}

function onNodeEnter({ data, e }: { data: any; e: MouseEvent }) {
  const p = (data?.properties ?? {}) as WfProps
  const n = nodeById.value.get(p.nodeId ?? '')
  if (!n) return
  const rows: { label: string; value: string }[] = [{ label: '经办人', value: assigneeText(n) }]
  if (n.statusCode) rows.push({ label: '状态编码', value: n.statusCode })
  if (n.branchName) rows.push({ label: '进入方式', value: n.branchName })
  const next = (n.nextNodes ?? []).map((c) => c.nodeName).filter(Boolean)
  if (next.length) rows.push({ label: '下一步', value: next.join('、') })
  const backs = (n.backToNodeIds ?? []).map((id) => nodeById.value.get(id)?.nodeName || id)
  if (backs.length) rows.push({ label: '可回退到', value: backs.join('、') })
  hover.value = { ...tipPosition(e), name: n.nodeName || '未命名', state: p.state, rows }
}

/** 浮层跟随鼠标，靠近右 / 下边缘时翻转，避免溢出画布 */
function tipPosition(e: MouseEvent) {
  const rect = wrapRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  const TIP_W = 260
  const TIP_H = 160
  let x = e.clientX - rect.left + 14
  let y = e.clientY - rect.top + 14
  if (x + TIP_W > rect.width) x = Math.max(8, e.clientX - rect.left - TIP_W - 14)
  if (y + TIP_H > rect.height) y = Math.max(8, e.clientY - rect.top - TIP_H - 14)
  return { x, y }
}

function render() {
  const lf = lfRef.value
  if (!lf || !props.nodes.length) return
  const { nodes, edges } = workflowToFlow(props.nodes, props.nodeStates)
  try {
    lf.clearData()
  } catch {
    /* 忽略 */
  }
  lf.render({ nodes, edges } as any)
  hover.value = null
  // 弹窗滑入动画（约 300ms）结束后再自适应视口
  setTimeout(() => {
    lf.fitView()
    syncScale()
  }, 320)
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  const lf = new LogicFlow({
    container: el,
    grid: true,
    edgeType: WF_EDGE_TYPE,
    // 只读：静默模式（禁止拖拽、连线、编辑）。@logicflow/core@1.2.10 无 setSilentMode()，通过构造参数开启
    isSilentMode: true,
    // 静默模式下仍允许滚轮缩放与拖拽平移
    stopZoomGraph: false,
    stopMoveGraph: false,
  } as any)
  lf.register({ type: 'wfNode', view: ViewerNodeView, model: ViewerNodeModel })
  lf.register(wfEdgeRegister as any)
  lf.on('node:mouseenter', onNodeEnter)
  lf.on('node:mouseleave', () => (hover.value = null))
  lf.on('graph:transform', syncScale)
  lf.on('blank:mousedown', () => (hover.value = null))
  lfRef.value = lf
  render()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      // 尺寸变化（窗口缩放/弹窗动画）时让画布自适应
      ;(lf as any).resize?.()
    })
    resizeObserver.observe(el)
  }
})

watch(
  () => [props.nodes, props.nodeStates],
  () => render(),
  { deep: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  const lf = lfRef.value
  lfRef.value = null
  if (!lf) return
  try {
    lf.clearData()
  } catch {
    /* 忽略 */
  }
})
</script>

<style scoped>
.wf-viewer-wrap {
  position: relative;
  min-height: 200px;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
  overflow: hidden;
}
.wf-viewer-canvas {
  width: 100%;
  height: 100%;
}
/* 当前节点外圈呼吸光晕（LogicFlow 渲染的 SVG 不带 scoped 属性，需 :deep） */
.wf-viewer-wrap :deep(.wf-current-halo) {
  animation: wf-halo 1.6s ease-in-out infinite;
}
@keyframes wf-halo {
  0%,
  100% {
    stroke-opacity: 0.15;
  }
  50% {
    stroke-opacity: 0.45;
  }
}
.wf-zoom {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: #fff;
  border: 1px solid #ececf2;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.wf-zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 14px;
  color: #595959;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.wf-zoom-btn:hover {
  color: #722ed1;
  background: #f4f0fb;
}
.wf-zoom-val {
  min-width: 44px;
  font-size: 12px;
  color: #595959;
  text-align: center;
  cursor: pointer;
  user-select: none;
}
.wf-zoom-val:hover {
  color: #722ed1;
}
.wf-zoom-sep {
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: #ececf2;
}
.wf-node-tip {
  position: absolute;
  z-index: 20;
  width: 260px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #ececf2;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  pointer-events: none;
}
.wf-tip-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.wf-tip-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
}
.wf-tip-badge {
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  border-radius: 4px;
}
.wf-tip-badge.is-current {
  color: #d46b08;
  background: #fff7e6;
  border: 1px solid #ffd591;
}
.wf-tip-badge.is-done {
  color: #389e0d;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}
.wf-tip-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  margin: 0;
  font-size: 12px;
}
.wf-tip-list dt {
  color: #8c8c8c;
}
.wf-tip-list dd {
  margin: 0;
  color: #262626;
  word-break: break-all;
}
.wf-viewer-tip {
  position: absolute;
  right: 10px;
  bottom: 8px;
  z-index: 10;
  font-size: 11px;
  color: #a0a0a8;
  background: rgba(255, 255, 255, 0.85);
  padding: 2px 8px;
  border-radius: 8px;
  pointer-events: none;
}
</style>
