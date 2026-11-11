<script setup lang="ts">
import { computed, ref } from 'vue'
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
const isEmpty = computed(() => props.rows.every((r) => r.every((c) => !c || !c.trim())))

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

// ---- 空表模板 ----
const TEMPLATES = [
  {
    key: 'gantt',
    name: '项目甘特图',
    rows: [
      ['任务', '负责人', '开始日期', '结束日期', '状态'],
      ['需求评审', '', '', '', '未开始'],
      ['方案设计', '', '', '', '未开始'],
      ['开发联调', '', '', '', '未开始'],
      ['测试验收', '', '', '', '未开始'],
    ],
  },
  {
    key: 'todo',
    name: '待办事项清单',
    rows: [
      ['事项', '负责人', '优先级', '状态'],
      ['补充需求文档', '', '高', '待开始'],
      ['接口联调', '', '中', '进行中'],
      ['编写测试用例', '', '中', '待开始'],
    ],
  },
  {
    key: 'release',
    name: '版本排期',
    rows: [
      ['版本', '内容', '负责人', '上线日期'],
      ['v1.0.0', '首个版本', '', ''],
      ['v1.1.0', '功能迭代', '', ''],
      ['v1.2.0', '体验优化', '', ''],
    ],
  },
]

function applyTemplate(tpl: (typeof TEMPLATES)[number]) {
  pushHistory()
  applyRows(tpl.rows.map((r) => [...r]))
  activeCell.value = { r: 0, c: 0 }
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
    <div class="sheet-scroll">
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
        </tbody>
      </table>

      <!-- 空表：模板推荐 -->
      <div v-if="isEmpty" class="sheet-templates">
        <div class="sheet-templates-title">从模板开始</div>
        <div class="sheet-templates-grid">
          <button
            v-for="tpl in TEMPLATES"
            :key="tpl.key"
            type="button"
            class="sheet-template-card"
            @click="applyTemplate(tpl)"
          >
            <span class="sheet-template-preview">
              <span v-for="(r, ri) in tpl.rows.slice(0, 4)" :key="ri" class="sheet-template-line">
                <span v-for="(_c, ci) in r.slice(0, 4)" :key="ci" class="sheet-template-cell" />
              </span>
            </span>
            <span class="sheet-template-name">{{ tpl.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet-editor {
  display: flex;
  flex-direction: column;
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

/* 空表模板推荐 */
.sheet-templates {
  padding: var(--docs-space-6) var(--docs-space-6) var(--docs-space-8);
}
.sheet-templates-title {
  margin-bottom: var(--docs-space-3);
  font-size: var(--docs-fs-meta);
  font-weight: 600;
  color: var(--docs-text-2);
}
.sheet-templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: var(--docs-space-3);
}
.sheet-template-card {
  display: flex;
  flex-direction: column;
  gap: var(--docs-space-2);
  padding: var(--docs-space-3);
  font-family: inherit;
  text-align: left;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  cursor: pointer;
  transition: border-color var(--docs-dur) var(--docs-ease), box-shadow var(--docs-dur) var(--docs-ease), transform var(--docs-dur) var(--docs-ease);
}
.sheet-template-card:hover {
  border-color: var(--docs-border-strong);
  box-shadow: var(--docs-shadow-card);
  transform: translateY(-1px);
}
.sheet-template-card:focus-visible {
  outline: none;
  box-shadow: var(--docs-focus);
}
.sheet-template-preview {
  display: flex;
  flex-direction: column;
  gap: var(--docs-space-1);
  padding: var(--docs-space-2);
  background: var(--docs-side-bg);
  border-radius: var(--docs-radius-sm);
}
.sheet-template-line {
  display: flex;
  gap: var(--docs-space-1);
}
.sheet-template-cell {
  flex: 1;
  height: 8px;
  background: var(--docs-border-strong);
  border-radius: var(--docs-radius-xs);
}
.sheet-template-line:first-child .sheet-template-cell {
  background: color-mix(in srgb, var(--c-primary) 22%, transparent);
}
.sheet-template-name {
  font-size: var(--docs-fs-control);
  font-weight: 500;
  line-height: var(--docs-lh-ui);
  color: var(--docs-text);
}
</style>
