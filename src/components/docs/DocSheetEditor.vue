<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  PlusOutlined,
  DeleteOutlined,
  UndoOutlined,
  RedoOutlined,
  TableOutlined,
} from '@ant-design/icons-vue'

/**
 * 简化版在线表格（参考飞书表格）
 * 数据直接修改传入的 rows，变更时 emit change 供父级触发保存。
 */
const props = defineProps<{
  rows: string[][]
}>()

const emit = defineEmits<{
  (e: 'change'): void
}>()

const colCount = computed(() => Math.max(1, ...props.rows.map((r) => r.length)))

/** 空白占位行：把网格铺满可见高度（只用于展示，不写入数据） */
const scrollRef = ref<HTMLElement | null>(null)
const fillerRows = ref(0)
const fillerRowHeight = ref(35)
/** 最后一行占位行额外补的高度，保证网格正好铺到底 */
const fillerLastExtra = ref(0)
let resizeObserver: ResizeObserver | null = null

function computeFillerRows() {
  const el = scrollRef.value
  if (!el) return
  const rowEl = el.querySelector('.sheet-table tbody tr') as HTMLElement | null
  const headerEl = el.querySelector('.sheet-table thead tr') as HTMLElement | null
  const rowHeight = rowEl?.getBoundingClientRect().height || 35
  const headerHeight = headerEl?.getBoundingClientRect().height || 30
  // 留 1px 余量，避免铺满后出现细滚动条
  const available = el.clientHeight - headerHeight - 1
  const used = props.rows.length * rowHeight
  const count = Math.max(0, Math.floor((available - used) / rowHeight))
  fillerRows.value = count
  fillerRowHeight.value = rowHeight
  fillerLastExtra.value = count > 0 ? Math.max(0, available - used - count * rowHeight) : 0
}

onMounted(() => {
  nextTick(computeFillerRows)
  if (typeof ResizeObserver !== 'undefined' && scrollRef.value) {
    resizeObserver = new ResizeObserver(() => computeFillerRows())
    resizeObserver.observe(scrollRef.value)
  }
})
watch(() => props.rows.length, () => nextTick(computeFillerRows))
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

/** 当前选中单元格 */
const activeCell = ref({ r: 0, c: 0 })
const cellAddress = computed(() => `${colName(activeCell.value.c)}${activeCell.value.r + 1}`)

function colName(i: number): string {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// ---- 撤销 / 重做 ----
const undoStack: string[][][] = []
const redoStack: string[][][] = []
const canUndo = ref(false)
const canRedo = ref(false)

function snapshot(): string[][] {
  return props.rows.map((r) => [...r])
}

function syncFlags() {
  canUndo.value = undoStack.length > 0
  canRedo.value = redoStack.length > 0
}

function pushHistory() {
  undoStack.push(snapshot())
  if (undoStack.length > 60) undoStack.shift()
  redoStack.length = 0
  syncFlags()
  emit('change')
}

function applyRows(rows: string[][]) {
  props.rows.splice(0, props.rows.length, ...rows.map((r) => [...r]))
  emit('change')
}

function undo() {
  const prev = undoStack.pop()
  if (!prev) return
  redoStack.push(snapshot())
  applyRows(prev)
  syncFlags()
}

function redo() {
  const next = redoStack.pop()
  if (!next) return
  undoStack.push(snapshot())
  applyRows(next)
  syncFlags()
}

// ---- 行 / 列操作 ----
function addRow() {
  pushHistory()
  props.rows.push(new Array(colCount.value).fill(''))
}

function addCol() {
  pushHistory()
  props.rows.forEach((r) => r.push(''))
}

function deleteRow() {
  if (props.rows.length <= 1) return
  pushHistory()
  props.rows.splice(activeCell.value.r, 1)
  activeCell.value.r = Math.min(activeCell.value.r, props.rows.length - 1)
}

function deleteCol() {
  if (colCount.value <= 1) return
  pushHistory()
  props.rows.forEach((r) => r.splice(activeCell.value.c, 1))
  activeCell.value.c = Math.min(activeCell.value.c, colCount.value - 1)
}

function setCell(row: string[], ci: number, e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (row[ci] === val) return
  pushHistory()
  row[ci] = val
}

function focusCell(ri: number, ci: number) {
  activeCell.value = { r: ri, c: ci }
}

</script>

<template>
  <div class="sheet-editor">
    <!-- 工作表标签 -->
    <div class="sheet-tabs">
      <span class="sheet-tab is-active"><TableOutlined /> Sheet1</span>
    </div>

    <!-- 工具栏 -->
    <div class="sheet-topbar">
      <span class="sheet-cell-address">{{ cellAddress }}</span>
      <div class="sheet-tools">
        <button type="button" class="sheet-tool" title="撤销" :disabled="!canUndo" @click="undo">
          <UndoOutlined />
        </button>
        <button type="button" class="sheet-tool" title="重做" :disabled="!canRedo" @click="redo">
          <RedoOutlined />
        </button>
        <span class="sheet-tool-sep" />
        <button type="button" class="sheet-tool" @click="addRow"><PlusOutlined /> 行</button>
        <button type="button" class="sheet-tool" @click="addCol"><PlusOutlined /> 列</button>
        <button type="button" class="sheet-tool danger" @click="deleteRow"><DeleteOutlined /> 行</button>
        <button type="button" class="sheet-tool danger" @click="deleteCol"><DeleteOutlined /> 列</button>
      </div>
      <span class="sheet-size">{{ rows.length }} 行 × {{ colCount }} 列</span>
    </div>

    <!-- 表格 -->
    <div ref="scrollRef" class="sheet-scroll">
      <table class="sheet-table">
        <thead>
          <tr>
            <th class="sheet-corner" />
            <th
              v-for="i in colCount"
              :key="i"
              class="sheet-col-head"
              :class="{ active: activeCell.c === i - 1 }"
            >{{ colName(i - 1) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in rows" :key="ri">
            <th class="sheet-row-no" :class="{ active: activeCell.r === ri }">{{ ri + 1 }}</th>
            <td
              v-for="ci in colCount"
              :key="ci"
              class="sheet-cell"
              :class="{ active: activeCell.r === ri && activeCell.c === ci - 1 }"
            >
              <input
                :value="row[ci - 1] || ''"
                class="sheet-input"
                @focus="focusCell(ri, ci - 1)"
                @input="setCell(row, ci - 1, $event)"
              />
            </td>
          </tr>
          <!-- 空白占位行：网格铺满高度 -->
          <tr
            v-for="n in fillerRows"
            :key="`filler-${n}`"
            class="sheet-filler-row"
            :style="n === fillerRows && fillerLastExtra ? { height: `${fillerRowHeight + fillerLastExtra}px` } : undefined"
          >
            <th class="sheet-row-no">{{ rows.length + n }}</th>
            <td v-for="ci in colCount" :key="ci" class="sheet-cell" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.sheet-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--docs-font);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
}

/* 工作表标签 */
.sheet-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 var(--docs-space-2);
  background: var(--docs-paper);
  border-bottom: 1px solid var(--docs-border);
}
.sheet-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--docs-space-2);
  height: 34px;
  padding: 0 var(--docs-space-4);
  font-size: var(--docs-fs-control);
  line-height: var(--docs-lh-ui);
  color: var(--docs-text-2);
  border-bottom: 2px solid transparent;
}
.sheet-tab.is-active {
  color: var(--c-primary);
  background: var(--docs-canvas);
  border-bottom-color: var(--c-primary);
}

/* 工具栏 */
.sheet-topbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--docs-space-2);
  padding: var(--docs-space-2) var(--docs-space-3);
  border-bottom: 1px solid var(--docs-border);
}
.sheet-cell-address {
  min-width: 40px;
  font-size: var(--docs-fs-meta);
  font-weight: 600;
  color: var(--c-primary);
}
.sheet-tools {
  display: flex;
  align-items: center;
  gap: 1px;
}
/* 幽灵按钮：默认透明，悬停 --docs-hover，按下 --docs-shadow-control */
.sheet-tool {
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
.sheet-tool:hover:not(:disabled) {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.sheet-tool:active:not(:disabled) {
  box-shadow: var(--docs-shadow-control);
}
.sheet-tool:focus-visible {
  outline: none;
  box-shadow: var(--docs-focus);
}
.sheet-tool:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.sheet-tool.danger:hover:not(:disabled) {
  color: var(--docs-danger);
  background: color-mix(in srgb, var(--docs-danger) 8%, transparent);
}
.sheet-tool-sep {
  width: 1px;
  height: 16px;
  margin: 0 var(--docs-space-1);
  background: var(--docs-border);
}
.sheet-size {
  margin-left: auto;
  font-size: var(--docs-fs-caption);
  color: var(--docs-text-3);
}

/* 表格：撑满编辑器剩余高度，滚动收在表格区内 */
.sheet-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.sheet-table {
  width: 100%;
  min-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: var(--docs-fs-control);
}
/* 网格线 1px */
.sheet-table th,
.sheet-table td {
  border-right: 1px solid var(--docs-border);
  border-bottom: 1px solid var(--docs-border);
}
/* 表头：纸色底 + 次级文字 12px / 500 */
.sheet-corner,
.sheet-row-no,
.sheet-col-head {
  height: 30px;
  font-size: var(--docs-fs-meta);
  font-weight: 500;
  color: var(--docs-text-2);
  text-align: center;
  background: var(--docs-paper);
}
.sheet-corner {
  width: 44px;
  min-width: 44px;
}
.sheet-row-no {
  width: 44px;
  min-width: 44px;
}
.sheet-col-head {
  min-width: 120px;
}
.sheet-col-head.active,
.sheet-row-no.active {
  color: var(--c-primary);
  background: var(--c-primary-bg);
}
.sheet-cell {
  padding: 0;
  background: var(--docs-canvas);
}
/* 数据行与占位行统一行高，网格才能整齐铺满 */
.sheet-table tbody tr,
.sheet-table tbody th,
.sheet-table tbody td {
  height: 35px;
}
/* 选区：选中区域底 + 2px 主题色边框 */
.sheet-cell.active {
  background: var(--c-primary-bg);
  box-shadow: inset 0 0 0 2px var(--c-primary);
}
.sheet-input {
  width: 100%;
  height: 34px;
  padding: var(--docs-space-2) var(--docs-space-3);
  font-family: inherit;
  font-size: var(--docs-fs-control);
  line-height: var(--docs-lh-ui);
  color: var(--docs-text);
  background: transparent;
  border: none;
  outline: none;
}

</style>
