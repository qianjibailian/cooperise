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
  gap: 10px;
}
.flow-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.flow-tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  color: #646a73;
  background: #f7f8fa;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.flow-tool:hover {
  color: #1f2329;
  background: #eef0f2;
}
.flow-hint {
  margin-left: auto;
  font-size: 11px;
  color: #8f959e;
}
.flow-canvas {
  height: calc(100vh - 300px);
  min-height: 420px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #eff0f2;
  border-radius: 10px;
}
</style>
