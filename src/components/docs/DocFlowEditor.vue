<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LogicFlow from '@logicflow/core'
import '@logicflow/core/dist/style/index.css'
import { ExpandOutlined, RedoOutlined, UndoOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons-vue'

/**
 * 流程图（LogicFlow，样式参考飞书云文档）
 * - 节点：矩形 / 椭圆 / 判断 / 文本，拖拽移动，双击编辑文字，从锚点拖出连线；
 * - 撤销 / 重做（Ctrl+Z / Ctrl+Y 同样生效）、缩放、自适应画布；
 * - 选中节点或连线后按 Delete 删除；数据以 graphData 形式回传。
 */
const props = defineProps<{
  graph: any | null
}>()

const emit = defineEmits<{
  (e: 'change', graph: any): void
}>()

const container = ref<HTMLElement | null>(null)
const canUndo = ref(false)
const canRedo = ref(false)
let lf: LogicFlow | null = null
let ready = false

/** 节点预设：工具栏图标为小型 SVG，和飞书的线性图标风格一致 */
const NODE_PRESETS: { type: string; label: string; x: number; y: number }[] = [
  { type: 'rect', label: '矩形', x: 260, y: 140 },
  { type: 'ellipse', label: '椭圆', x: 430, y: 140 },
  { type: 'diamond', label: '判断', x: 345, y: 260 },
  { type: 'text', label: '文本', x: 260, y: 300 },
]

const BLUE = '#3370ff'

onMounted(() => {
  if (!container.value) return
  lf = new LogicFlow({
    container: container.value,
    grid: { size: 20, visible: true, type: 'dot', config: { color: '#d4d9e1', thickness: 1 } },
    background: { backgroundColor: '#fbfbfd' },
    keyboard: { enabled: true },
    isSilentMode: false,
  })
  lf.setTheme({
    nodeText: { color: '#1f2329', fontSize: 14 },
    rect: { fill: '#f5f8ff', stroke: BLUE, strokeWidth: 1.4, radius: 8 },
    ellipse: { fill: '#f5f8ff', stroke: BLUE, strokeWidth: 1.4 },
    diamond: { fill: '#fff8ec', stroke: '#ff8800', strokeWidth: 1.4 },
    polyline: { stroke: '#8f959e', strokeWidth: 1.5, hoverStroke: BLUE, selectedStroke: BLUE },
    edgeText: { color: '#646a73', fontSize: 12 },
  })
  lf.setDefaultEdgeType('polyline')
  if (props.graph && Array.isArray(props.graph.nodes) && props.graph.nodes.length) {
    lf.render(props.graph)
  }
  lf.on('history:change', () => {
    canUndo.value = !!lf?.history.undoAble()
    canRedo.value = !!lf?.history.redoAble()
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

function undo() {
  lf?.undo()
}

function redo() {
  lf?.redo()
}

function zoomIn() {
  lf?.zoom(true)
}

function zoomOut() {
  lf?.zoom(false)
}

function resetZoom() {
  lf?.resetZoom()
}

function fitView() {
  lf?.fitView(40, 40)
}
</script>

<template>
  <div class="flow-editor">
    <div class="flow-toolbar" role="toolbar" aria-label="流程图工具栏">
      <div class="flow-group">
        <button
          v-for="p in NODE_PRESETS"
          :key="p.type"
          type="button"
          class="flow-tool"
          :title="`插入${p.label}`"
          @click="addNode(p)"
        >
          <svg v-if="p.type === 'rect'" class="flow-ico" viewBox="0 0 20 20"><rect x="3" y="5" width="14" height="10" rx="2" /></svg>
          <svg v-else-if="p.type === 'ellipse'" class="flow-ico" viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="7.5" ry="5" /></svg>
          <svg v-else-if="p.type === 'diamond'" class="flow-ico" viewBox="0 0 20 20"><polygon points="10,3 17,10 10,17 3,10" /></svg>
          <span v-else class="flow-ico flow-ico-text">T</span>
          <span>{{ p.label }}</span>
        </button>
      </div>

      <span class="flow-sep" />

      <div class="flow-group">
        <button type="button" class="flow-tool icon" title="撤销（Ctrl+Z）" :disabled="!canUndo" @click="undo"><UndoOutlined /></button>
        <button type="button" class="flow-tool icon" title="重做（Ctrl+Y）" :disabled="!canRedo" @click="redo"><RedoOutlined /></button>
      </div>

      <span class="flow-sep" />

      <div class="flow-group">
        <button type="button" class="flow-tool icon" title="缩小" @click="zoomOut"><ZoomOutOutlined /></button>
        <button type="button" class="flow-tool zoom" title="重置为 100%" @click="resetZoom">100%</button>
        <button type="button" class="flow-tool icon" title="放大" @click="zoomIn"><ZoomInOutlined /></button>
        <button type="button" class="flow-tool" title="适应画布" @click="fitView"><ExpandOutlined /><span>适应</span></button>
      </div>

      <span class="flow-hint">拖动节点调整位置 · 从锚点拖出连线 · 双击编辑文字 · 选中后按 Delete 删除</span>
    </div>
    <div ref="container" class="flow-canvas" />
  </div>
</template>

<style scoped>
.flow-editor {
  display: flex;
  flex-direction: column;
  gap: var(--docs-space-2);
  font-family: var(--docs-font);
}
.flow-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-card);
}
.flow-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.flow-sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--docs-border-strong);
}
.flow-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  min-width: 30px;
  padding: 0 8px;
  font-family: inherit;
  font-size: var(--docs-fs-control);
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background-color var(--docs-dur) var(--docs-ease), color var(--docs-dur) var(--docs-ease);
}
.flow-tool:hover:not(:disabled) {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.flow-tool:disabled {
  color: var(--docs-text-3);
  cursor: not-allowed;
  opacity: 0.6;
}
.flow-tool.zoom {
  min-width: 52px;
  font-variant-numeric: tabular-nums;
}
.flow-tool:focus-visible {
  outline: none;
  box-shadow: var(--docs-focus);
}
.flow-ico {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.flow-ico-text {
  font-size: 14px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}
.flow-hint {
  margin-left: auto;
  padding-right: 6px;
  font-size: var(--docs-fs-meta);
  color: var(--docs-text-3);
  white-space: nowrap;
}
.flow-canvas {
  height: min(70vh, 680px);
  min-height: 420px;
  background: #fbfbfd;
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  overflow: hidden;
}
</style>
