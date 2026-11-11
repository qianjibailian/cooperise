<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LogicFlow from '@logicflow/core'
import '@logicflow/core/dist/style/index.css'
import { PlusOutlined, ExpandOutlined } from '@ant-design/icons-vue'

/**
 * 流程图编辑器（LogicFlow）
 * 支持拖拽节点、从节点锚点拖出连线、选中后 Delete 删除；数据以 graphData 形式回传。
 */
const props = defineProps<{
  graph: any | null
}>()

const emit = defineEmits<{
  (e: 'change', graph: any): void
}>()

const container = ref<HTMLElement | null>(null)
let lf: LogicFlow | null = null
let ready = false

const NODE_PRESETS = [
  { type: 'rect', label: '矩形', x: 260, y: 140 },
  { type: 'circle', label: '圆形', x: 430, y: 140 },
  { type: 'diamond', label: '判断', x: 345, y: 260 },
]

onMounted(() => {
  if (!container.value) return
  lf = new LogicFlow({
    container: container.value,
    grid: true,
    background: { backgroundColor: '#ffffff' },
    keyboard: { enabled: true },
  })
  lf.setDefaultEdgeType('polyline')
  if (props.graph && Array.isArray(props.graph.nodes) && props.graph.nodes.length) {
    lf.render(props.graph)
  }
  lf.on('history:change', () => {
    if (!lf || !ready) return
    emit('change', lf.getGraphData())
  })
  ready = true
  // 容器尺寸就绪后重算画布
  requestAnimationFrame(() => lf?.resize())
})

onBeforeUnmount(() => {
  try {
    lf?.destroy()
  } catch {
    // ignore
  }
  lf = null
})

function addNode(preset: { type: string; x: number; y: number; label: string }) {
  if (!lf) return
  const offset = Math.round(Math.random() * 40)
  lf.addNode({
    type: preset.type,
    x: preset.x + offset,
    y: preset.y + offset,
    text: preset.label,
  })
}

function fitView() {
  lf?.fitView()
}
</script>

<template>
  <div class="flow-editor">
    <div class="flow-toolbar">
      <button
        v-for="p in NODE_PRESETS"
        :key="p.type"
        type="button"
        class="flow-tool"
        @click="addNode(p)"
      >
        <PlusOutlined /> {{ p.label }}
      </button>
      <button type="button" class="flow-tool" @click="fitView"><ExpandOutlined /> 自适应</button>
      <span class="flow-hint">拖动节点调整位置 · 从节点锚点拖出连线 · 选中后按 Delete 删除</span>
    </div>
    <div ref="container" class="flow-canvas" />
  </div>
</template>

<style scoped>
.flow-editor {
  display: flex;
  flex-direction: column;
  gap: var(--docs-space-3);
  font-family: var(--docs-font);
}
.flow-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--docs-space-2);
}
/* 幽灵按钮：默认透明，悬停 --docs-hover */
.flow-tool {
  display: inline-flex;
  align-items: center;
  gap: var(--docs-space-1);
  height: 28px;
  padding: 0 var(--docs-space-2);
  font-family: inherit;
  font-size: var(--docs-fs-control);
  line-height: var(--docs-lh-ui);
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background-color var(--docs-dur) var(--docs-ease), color var(--docs-dur) var(--docs-ease), box-shadow var(--docs-dur) var(--docs-ease);
}
.flow-tool:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.flow-tool:active {
  box-shadow: var(--docs-shadow-control);
}
.flow-tool:focus-visible {
  outline: none;
  box-shadow: var(--docs-focus);
}
/* 分组分隔：「自适应」与节点工具之间的 1px 竖线（位于 gap 中线） */
.flow-toolbar > .flow-tool:last-of-type {
  position: relative;
}
.flow-toolbar > .flow-tool:last-of-type::before {
  content: '';
  position: absolute;
  left: calc(var(--docs-space-2) / -2);
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: var(--docs-border);
}
.flow-hint {
  margin-left: auto;
  font-size: var(--docs-fs-caption);
  color: var(--docs-text-3);
}
/* 画布：纸色底 + 1px 细线 + 大圆角 */
.flow-canvas {
  height: calc(100vh - 300px);
  min-height: 420px;
  overflow: hidden;
  background: var(--docs-paper);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
}

/* LogicFlow 的内置样式是硬编码色，这里用 :deep 覆盖为 token；
   画布背景与节点文字是库的内联 style，只能用 !important 覆盖。 */
.flow-canvas :deep(.lf-graph) {
  background: var(--docs-paper);
}
.flow-canvas :deep(.lf-background-area) {
  background-color: var(--docs-paper) !important;
}
/* 点阵背景：点的颜色 --docs-border */
.flow-canvas :deep(.lf-grid pattern > rect) {
  fill: var(--docs-border);
}
/* 节点：画布底 + 1px 强描边 + 圆角 */
.flow-canvas :deep(.lf-node > rect),
.flow-canvas :deep(.lf-node > ellipse),
.flow-canvas :deep(.lf-node polygon) {
  fill: var(--docs-canvas);
  stroke: var(--docs-border-strong);
  stroke-width: 1px;
}
.flow-canvas :deep(.lf-node > rect) {
  rx: var(--docs-radius);
  ry: var(--docs-radius);
}
/* 选中节点：2px 主题色描边 */
.flow-canvas :deep(.lf-node.lf-node-selected > rect),
.flow-canvas :deep(.lf-node.lf-node-selected > ellipse),
.flow-canvas :deep(.lf-node.lf-node-selected polygon) {
  stroke: var(--c-primary);
  stroke-width: 2px;
}
/* 节点文字：--docs-text 13px */
.flow-canvas :deep(.lf-node text) {
  fill: var(--docs-text);
  font-size: var(--docs-fs-control);
}
.flow-canvas :deep(.lf-node-text-auto-wrap-content),
.flow-canvas :deep(.lf-node-text-ellipsis-content) {
  color: var(--docs-text) !important;
  font-size: var(--docs-fs-control) !important;
}
/* 连线：--docs-text-3 */
.flow-canvas :deep(.lf-edge polyline),
.flow-canvas :deep(.lf-edge polygon),
.flow-canvas :deep(.lf-edge path) {
  stroke: var(--docs-text-3);
}
/* 锚点与选中轮廓 */
.flow-canvas :deep(.lf-node-anchor) {
  fill: var(--docs-canvas);
  stroke: var(--c-primary);
}
.flow-canvas :deep(.lf-node-anchor-hover) {
  fill: var(--c-primary-bg);
  stroke: var(--c-primary-border);
}
.flow-canvas :deep(.lf-outline-node),
.flow-canvas :deep(.lf-outline-edge) {
  stroke: var(--docs-text-3);
}
/* 框选 */
.flow-canvas :deep(.lf-multiple-select) {
  border-color: var(--c-primary);
  box-shadow: var(--docs-focus);
}
/* 节点文字就地编辑框 */
.flow-canvas :deep(.lf-text-input) {
  color: var(--docs-text);
  background: var(--docs-canvas);
  border-color: var(--c-primary);
  border-radius: var(--docs-radius-sm);
  font-family: var(--docs-font);
}
</style>
