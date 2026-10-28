<template>
  <div class="wf-viewer-wrap" :style="{ height: props.height }">
    <div ref="containerRef" class="wf-viewer-canvas" />
    <span class="wf-viewer-tip">只读流程图 · 滚轮缩放 / 拖拽平移</span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LogicFlow, { RectNode, RectNodeModel } from '@logicflow/core'
import '@logicflow/core/dist/style/index.css'
import type { WorkflowNode } from '@/types/faiz'
import { workflowToFlow } from './workflow-flow-layout'
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
  }>(),
  { nodeStates: () => ({}), height: '320px' },
)

// 只读节点：按状态着色（当前橙色高亮 / 已完成绿色 / 未开始灰色）
class ViewerNodeModel extends RectNodeModel {
  setAttributes() {
    const p = (this.properties || {}) as WfProps
    this.width = 168
    this.height = 54
    this.radius = 10
    const state = p.state ?? 'pending'
    if (state === 'current') {
      this.fill = '#fff7e6'
      this.stroke = '#fa8c16'
      this.strokeWidth = 3
    } else if (state === 'done') {
      this.fill = '#f6ffed'
      this.stroke = '#52c41a'
      this.strokeWidth = 2
    } else {
      this.fill = '#ffffff'
      this.stroke = '#d9d9d9'
      this.strokeWidth = 1.5
    }
    // 文本坐标是绝对坐标（x/y 即节点中心），缺 x/y 时文本渲染到 undefined 坐标导致节点看起来没内容
    this.text = {
      value: p.nodeName || '未命名',
      x: this.x,
      y: this.y,
      draggable: false,
      editable: false,
    } as any
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
class ViewerNodeView extends RectNode {}

const containerRef = ref<HTMLDivElement>()
const lfRef = ref<LogicFlow | null>(null)
let resizeObserver: ResizeObserver | null = null

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
  // 弹窗滑入动画（约 300ms）结束后再自适应视口
  setTimeout(() => lf.fitView(), 320)
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  const lf = new LogicFlow({
    container: el,
    grid: true,
    edgeType: WF_EDGE_TYPE,
  } as any)
  lf.setSilentMode(true)
  lf.register({ type: 'wfNode', view: ViewerNodeView, model: ViewerNodeModel })
  lf.register(wfEdgeRegister as any)
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
