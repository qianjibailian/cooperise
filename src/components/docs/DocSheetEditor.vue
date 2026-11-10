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
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

/* 工作表标签 */
.sheet-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 10px;
  background: #fafbfc;
  border-bottom: 1px solid #eff0f2;
}
.sheet-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  font-size: 12px;
  color: #646a73;
  border-bottom: 2px solid transparent;
}
.sheet-tab.is-active {
  color: #3370ff;
  background: #fff;
  border-bottom-color: #3370ff;
}

/* 工具栏 */
.sheet-topbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid #eff0f2;
}
.sheet-cell-address {
  min-width: 40px;
  font-size: 12px;
  font-weight: 600;
  color: #3370ff;
}
.sheet-tools {
  display: flex;
  align-items: center;
  gap: 1px;
}
.sheet-tool {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  color: #646a73;
  background: transparent;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.sheet-tool:hover:not(:disabled) {
  color: #1f2329;
  background: #f2f3f5;
}
.sheet-tool:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.sheet-tool.danger:hover:not(:disabled) {
  color: #d54941;
  background: #fff1f0;
}
.sheet-tool-sep {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: #e5e6eb;
}
.sheet-size {
  margin-left: auto;
  font-size: 11px;
  color: #8f959e;
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
  font-size: 13px;
}
.sheet-table th,
.sheet-table td {
  border-right: 1px solid #eff0f2;
  border-bottom: 1px solid #eff0f2;
}
.sheet-corner,
.sheet-row-no,
.sheet-col-head {
  height: 30px;
  font-size: 12px;
  font-weight: 500;
  color: #8f959e;
  text-align: center;
  background: #f7f8fa;
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
  color: #3370ff;
  background: #e8f0fe;
}
.sheet-cell {
  padding: 0;
  background: #fff;
}
.sheet-cell.active {
  box-shadow: inset 0 0 0 2px #3370ff;
}
.sheet-input {
  width: 100%;
  height: 34px;
  padding: 0 8px;
  font-size: 13px;
  color: #1f2329;
  background: transparent;
  border: none;
  outline: none;
}

/* 空表模板推荐 */
.sheet-templates {
  padding: 24px 28px 32px;
}
.sheet-templates-title {
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #8f959e;
}
.sheet-templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.sheet-template-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  text-align: left;
  background: #fff;
  border: 1px solid #eff0f2;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.sheet-template-card:hover {
  border-color: #dcdde1;
  box-shadow: 0 4px 16px rgba(31, 35, 41, 0.06);
  transform: translateY(-1px);
}
.sheet-template-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  background: #f7f8fa;
  border-radius: 6px;
}
.sheet-template-line {
  display: flex;
  gap: 3px;
}
.sheet-template-cell {
  flex: 1;
  height: 8px;
  background: #e5e6eb;
  border-radius: 2px;
}
.sheet-template-line:first-child .sheet-template-cell {
  background: #c9d7f5;
}
.sheet-template-name {
  font-size: 13px;
  font-weight: 500;
  color: #1f2329;
}
</style>
