<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  BranchesOutlined,
  DeleteOutlined,
  ExpandOutlined,
  FullscreenOutlined,
  PlusOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons-vue'
import type { MindNode } from '@/types/docs'

/**
 * 思维导图（画布）：中心主题居左，子节点向右展开，贝塞尔连线（参考飞书云文档）。
 * 操作：
 *  - 单击选中，双击 / F2 编辑；
 *  - Tab 添加子节点，Enter 添加同级节点，Delete / Backspace 删除（中心主题不可删）；
 *  - 方向键移动选中：← 父节点，→ 第一个子节点，↑ ↓ 同层相邻节点；
 *  - 节点右侧的计数按钮可折叠 / 展开子节点；
 *  - 滚轮平移，Ctrl + 滚轮缩放，按住空白处拖动平移。
 * 数据仍是 MindNode 树，直接修改传入的 root，变更时 emit change。
 */
const props = defineProps<{
  root: MindNode
}>()

const emit = defineEmits<{
  (e: 'change'): void
}>()

const NODE_H = 36
const V_GAP = 14
const COL_GAP = 64
const MIN_W = 96
const MAX_W = 260
const PAD = 32

interface Item {
  node: MindNode
  depth: number
  /** 节点左边缘 x（舞台坐标） */
  x: number
  /** 节点竖向中心 y（舞台坐标） */
  y: number
  w: number
  hasChildren: boolean
}

interface Layout {
  items: Item[]
  edges: { id: string; d: string }[]
  itemOf: Map<string, Item>
  parentOf: Map<string, MindNode | null>
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}

function genId(): string {
  return `mind_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** 按文字长度估算节点宽度（中文按两个字符宽） */
function widthOf(text: string, depth: number): number {
  let units = 0
  for (const ch of text || '') units += ch.charCodeAt(0) > 255 ? 2 : 1
  const base = Math.min(MAX_W, Math.max(MIN_W, units * 7 + PAD))
  return depth === 0 ? Math.max(base, 120) : base
}

/** 自左向右的树形布局：每个父节点垂直居中于其子节点区间 */
function computeLayout(root: MindNode): Layout {
  const items: Item[] = []
  const itemOf = new Map<string, Item>()
  const parentOf = new Map<string, MindNode | null>()
  parentOf.set(root.id, null)

  const place = (node: MindNode, depth: number, left: number, top: number): number => {
    const w = widthOf(node.text, depth)
    const item: Item = { node, depth, x: left, y: top + NODE_H / 2, w, hasChildren: node.children.length > 0 }
    items.push(item)
    itemOf.set(node.id, item)
    const kids = node.collapsed ? [] : node.children
    if (!kids.length) return NODE_H
    let cursor = top
    let firstY = 0
    let lastY = 0
    kids.forEach((kid, i) => {
      parentOf.set(kid.id, node)
      const h = place(kid, depth + 1, left + w + COL_GAP, cursor)
      const ky = itemOf.get(kid.id)!.y
      if (i === 0) firstY = ky
      lastY = ky
      cursor += h + V_GAP
    })
    item.y = (firstY + lastY) / 2
    return cursor - V_GAP - top
  }
  place(root, 0, 0, 0)

  const edges: { id: string; d: string }[] = []
  for (const it of items) {
    const parent = parentOf.get(it.node.id)
    if (!parent) continue
    const p = itemOf.get(parent.id)!
    const x1 = p.x + p.w
    const y1 = p.y
    const x2 = it.x
    const y2 = it.y
    const mx = (x1 + x2) / 2
    edges.push({ id: `${parent.id}->${it.node.id}`, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` })
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const it of items) {
    minX = Math.min(minX, it.x)
    maxX = Math.max(maxX, it.x + it.w)
    minY = Math.min(minY, it.y - NODE_H / 2)
    maxY = Math.max(maxY, it.y + NODE_H / 2)
  }
  return { items, edges, itemOf, parentOf, bounds: { minX, maxX, minY, maxY } }
}

const layout = computed<Layout>(() => computeLayout(props.root))

// ---------- 视图：缩放与平移 ----------
const viewport = ref<HTMLElement | null>(null)
const zoom = ref(1)
const panX = ref(40)
const panY = ref(40)
const zoomPct = computed(() => `${Math.round(zoom.value * 100)}%`)

function clampZoom(z: number): number {
  return Math.min(2, Math.max(0.3, z))
}

function zoomBy(factor: number) {
  zoom.value = clampZoom(zoom.value * factor)
}

function resetZoom() {
  zoom.value = 1
}

/** 让整张导图居中并尽量撑满可视区域 */
function fitView() {
  const el = viewport.value
  if (!el) return
  const b = layout.value.bounds
  const W = el.clientWidth
  const H = el.clientHeight
  const bw = b.maxX - b.minX + 80
  const bh = b.maxY - b.minY + 80
  const z = clampZoom(Math.min(1.2, W / bw, H / bh))
  zoom.value = z
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  panX.value = W / 2 - cx * z
  panY.value = H / 2 - cy * z
}

// ---------- 选中与编辑 ----------
const selectedId = ref(props.root.id)
const editingId = ref<string | null>(null)
const draft = ref('')

function select(id: string) {
  selectedId.value = id
}

function startEdit(id: string) {
  const node = layout.value.itemOf.get(id)?.node
  if (!node) return
  selectedId.value = id
  editingId.value = id
  draft.value = node.text
  void nextTick(() => {
    const input = viewport.value?.querySelector<HTMLInputElement>('.mm-edit')
    input?.focus()
    input?.select()
  })
}

function commitEdit() {
  const id = editingId.value
  if (!id) return
  const node = layout.value.itemOf.get(id)?.node
  editingId.value = null
  if (node && node.text !== draft.value.trim()) {
    node.text = draft.value.trim()
    emit('change')
  }
  void nextTick(() => viewport.value?.focus())
}

function addChild(parentId: string | null = selectedId.value) {
  const parent = parentId ? layout.value.itemOf.get(parentId)?.node : null
  if (!parent) return
  const child: MindNode = { id: genId(), text: '', children: [] }
  parent.children.push(child)
  if (parent.collapsed) parent.collapsed = false
  emit('change')
  startEdit(child.id)
}

function addSibling() {
  const sel = selectedId.value
  const parent = layout.value.parentOf.get(sel)
  if (!parent) {
    // 中心主题没有同级，改为添加子节点
    addChild(sel)
    return
  }
  const idx = parent.children.findIndex((c) => c.id === sel)
  const sibling: MindNode = { id: genId(), text: '', children: [] }
  parent.children.splice(idx + 1, 0, sibling)
  emit('change')
  startEdit(sibling.id)
}

function removeSelected() {
  const sel = selectedId.value
  const parent = layout.value.parentOf.get(sel)
  if (!parent) return // 中心主题不可删除
  parent.children = parent.children.filter((c) => c.id !== sel)
  selectedId.value = parent.id
  emit('change')
}

function toggleCollapse(node: MindNode) {
  node.collapsed = !node.collapsed
  emit('change')
}

function expandAll() {
  const walk = (n: MindNode) => {
    if (n.collapsed) {
      n.collapsed = false
    }
    n.children.forEach(walk)
  }
  walk(props.root)
  emit('change')
}

// ---------- 键盘 ----------
/** 同层中最近的上 / 下邻居（用于方向键上下） */
function sameDepthNeighbor(sel: Item, dir: 1 | -1): Item | null {
  let best: Item | null = null
  for (const it of layout.value.items) {
    if (it.depth !== sel.depth || it === sel) continue
    const dy = (it.y - sel.y) * dir
    if (dy <= 0) continue
    if (!best || dy < (best.y - sel.y) * dir) best = it
  }
  return best
}

function onKeydown(e: KeyboardEvent) {
  if (editingId.value) return
  const sel = layout.value.itemOf.get(selectedId.value)
  if (!sel) return
  switch (e.key) {
    case 'Tab':
      e.preventDefault()
      addChild(sel.node.id)
      break
    case 'Enter':
      e.preventDefault()
      addSibling()
      break
    case 'Delete':
    case 'Backspace':
      e.preventDefault()
      removeSelected()
      break
    case 'F2':
      e.preventDefault()
      startEdit(sel.node.id)
      break
    case 'ArrowLeft': {
      e.preventDefault()
      const p = layout.value.parentOf.get(sel.node.id)
      if (p) select(p.id)
      break
    }
    case 'ArrowRight': {
      e.preventDefault()
      const first = sel.node.collapsed ? null : sel.node.children[0]
      if (first) select(first.id)
      break
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      e.preventDefault()
      const n = sameDepthNeighbor(sel, e.key === 'ArrowDown' ? 1 : -1)
      if (n) select(n.node.id)
      break
    }
  }
}

// ---------- 鼠标：平移 / 缩放 ----------
let panning: { sx: number; sy: number; px: number; py: number; id: number } | null = null

function onPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.mm-node, .mm-toolbar')) return
  selectedId.value = props.root.id
  editingId.value = null
  panning = { sx: e.clientX, sy: e.clientY, px: panX.value, py: panY.value, id: e.pointerId }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!panning) return
  panX.value = panning.px + (e.clientX - panning.sx)
  panY.value = panning.py + (e.clientY - panning.sy)
}

function onPointerUp() {
  panning = null
}

function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    zoomBy(e.deltaY < 0 ? 1.1 : 0.9)
  } else {
    panX.value -= e.deltaX
    panY.value -= e.deltaY
  }
}

// ---------- 连线与节点的样式 ----------
function nodeText(node: MindNode): string {
  return node.text || '未命名主题'
}

onMounted(() => {
  void nextTick(fitView)
})
</script>

<template>
  <div class="mm-wrap">
    <div class="mm-toolbar" role="toolbar" aria-label="思维导图工具栏">
      <button type="button" class="mm-tool" title="添加子节点（Tab）" @click="addChild()"><PlusOutlined /><span>子节点</span></button>
      <button type="button" class="mm-tool" title="添加同级节点（Enter）" @click="addSibling()"><BranchesOutlined /><span>同级</span></button>
      <button
        type="button"
        class="mm-tool"
        title="删除节点（Delete）"
        :disabled="!layout.parentOf.get(selectedId)"
        @click="removeSelected()"
      ><DeleteOutlined /><span>删除</span></button>
      <span class="mm-sep" />
      <button type="button" class="mm-tool icon" title="缩小" @click="zoomBy(0.9)"><ZoomOutOutlined /></button>
      <button type="button" class="mm-tool zoom" title="重置为 100%" @click="resetZoom()">{{ zoomPct }}</button>
      <button type="button" class="mm-tool icon" title="放大" @click="zoomBy(1.1)"><ZoomInOutlined /></button>
      <button type="button" class="mm-tool" title="适应画布" @click="fitView()"><FullscreenOutlined /><span>适应</span></button>
      <button type="button" class="mm-tool" title="展开全部分支" @click="expandAll()"><ExpandOutlined /><span>展开</span></button>
    </div>

    <div
      ref="viewport"
      class="mm-viewport"
      tabindex="0"
      @keydown="onKeydown"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.prevent="onWheel"
    >
      <div class="mm-stage" :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }">
        <svg class="mm-lines" width="1" height="1" overflow="visible">
          <path v-for="e in layout.edges" :key="e.id" :d="e.d" class="mm-line" />
        </svg>

        <div
          v-for="it in layout.items"
          :key="it.node.id"
          class="mm-node"
          :class="{
            'is-root': it.depth === 0,
            'is-selected': selectedId === it.node.id,
            'is-editing': editingId === it.node.id,
          }"
          :style="{ left: `${it.x}px`, top: `${it.y - NODE_H / 2}px`, width: `${it.w}px`, height: `${NODE_H}px` }"
          @click.stop="select(it.node.id)"
          @dblclick.stop="startEdit(it.node.id)"
        >
          <input
            v-if="editingId === it.node.id"
            v-model="draft"
            class="mm-edit"
            placeholder="输入主题"
            @click.stop
            @keydown.enter.stop.prevent="commitEdit()"
            @keydown.tab.stop.prevent="commitEdit(); addChild(it.node.id)"
            @keydown.esc.stop.prevent="commitEdit()"
            @blur="commitEdit()"
          />
          <span v-else class="mm-text" :class="{ 'is-empty': !it.node.text }">{{ nodeText(it.node) }}</span>
          <button
            v-if="it.hasChildren"
            type="button"
            class="mm-fold"
            :class="{ 'is-collapsed': it.node.collapsed }"
            :title="it.node.collapsed ? '展开子节点' : '收起子节点'"
            @click.stop="toggleCollapse(it.node)"
          >{{ it.node.collapsed ? it.node.children.length : '−' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--docs-space-2);
  font-family: var(--docs-font);
}
.mm-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-card);
}
.mm-tool {
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
.mm-tool:hover:not(:disabled) {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.mm-tool:disabled {
  color: var(--docs-text-3);
  cursor: not-allowed;
  opacity: 0.6;
}
.mm-tool.zoom {
  min-width: 56px;
  font-variant-numeric: tabular-nums;
}
.mm-sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--docs-border-strong);
}
.mm-viewport {
  position: relative;
  height: min(70vh, 680px);
  min-height: 420px;
  overflow: hidden;
  cursor: grab;
  background-color: var(--docs-paper);
  background-image: radial-gradient(circle, var(--docs-border-strong) 1px, transparent 1.2px);
  background-size: 22px 22px;
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  outline: none;
  user-select: none;
  touch-action: none;
}
.mm-viewport:focus-visible {
  box-shadow: var(--docs-focus);
}
.mm-viewport:active {
  cursor: grabbing;
}
.mm-stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}
.mm-lines {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  pointer-events: none;
}
.mm-line {
  fill: none;
  stroke: #b8c4d6;
  stroke-width: 1.6;
}
/* 节点：白底圆角卡片，选中为主题色描边 */
.mm-node {
  position: absolute;
  display: flex;
  align-items: center;
  padding: 0 12px;
  box-sizing: border-box;
  background: var(--docs-canvas);
  border: 1px solid #c9d6f7;
  border-radius: 10px;
  box-shadow: var(--docs-shadow-card);
  cursor: pointer;
  transition: border-color var(--docs-dur) var(--docs-ease), box-shadow var(--docs-dur) var(--docs-ease);
}
.mm-node:hover {
  border-color: var(--c-primary-border);
}
.mm-node.is-root {
  background: var(--c-primary-bg);
  border: 1.5px solid var(--c-primary);
  border-radius: 14px;
  font-weight: 600;
}
.mm-node.is-selected {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-primary) 22%, transparent), var(--docs-shadow-card);
}
.mm-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--docs-fs-control);
  color: var(--docs-text);
}
.mm-node.is-root .mm-text {
  font-size: var(--docs-fs-body);
  color: var(--c-primary-active);
}
.mm-text.is-empty {
  color: var(--docs-text-3);
}
.mm-edit {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  font-family: inherit;
  font-size: var(--docs-fs-control);
  color: var(--docs-text);
  background: var(--docs-canvas);
  border: 1px solid var(--c-primary);
  border-radius: 6px;
  outline: none;
  box-shadow: var(--docs-focus);
}
/* 折叠按钮：挂在节点右边缘，显示 − 或收起后的子节点数 */
.mm-fold {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  color: var(--docs-text-2);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: 11px;
  cursor: pointer;
}
.mm-fold:hover {
  color: var(--c-primary);
  border-color: var(--c-primary);
}
.mm-fold.is-collapsed {
  color: #ffffff;
  background: var(--c-primary);
  border-color: var(--c-primary);
}
</style>
