<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BgColorsOutlined,
  BoldOutlined,
  ClearOutlined,
  DeleteOutlined,
  DownOutlined,
  FontColorsOutlined,
  FormatPainterOutlined,
  ItalicOutlined,
  MenuOutlined,
  MessageOutlined,
  MoreOutlined,
  PlusOutlined,
  PushpinOutlined,
  RedoOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UnderlineOutlined,
  UndoOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignTopOutlined,
  BorderOutlined,
  FilterOutlined,
  ColumnWidthOutlined,
  UnorderedListOutlined,
  BlockOutlined,
} from '@ant-design/icons-vue'
import type { SheetCellStyle, SheetData, SheetPage } from '@/types/docs'
import { createSheetPage, nextSheetName } from '@/utils/doc-sheet'

/**
 * 在线表格（参考飞书表格）
 * 数据（行 / 单元格样式 / 冻结）直接修改传入的 data，变更时 emit change 供父级触发保存。
 */
const props = defineProps<{
  data: SheetData
}>()

const emit = defineEmits<{
  (e: 'change'): void
}>()

/** 当前激活的工作表下标（越界时回到第一个） */
const sheetIdx = computed(() => {
  const n = props.data.sheets.length
  return Math.min(Math.max(0, props.data.active ?? 0), n - 1)
})
/** 当前工作表：所有行 / 样式 / 冻结操作都作用于它 */
function curSheet(): SheetPage {
  return props.data.sheets[sheetIdx.value]
}

const rows = computed(() => curSheet().rows)
const colCount = computed(() => Math.max(1, ...rows.value.map((r) => r.length)))

/** 空白占位行：把网格铺满可见高度（只用于展示，不写入数据） */
const scrollRef = ref<HTMLElement | null>(null)
const fillerRows = ref(0)
const fillerRowHeight = ref(35)
/** 最后一行占位行额外补的高度，保证网格正好铺到底 */
const fillerLastExtra = ref(0)
let resizeObserver: ResizeObserver | null = null

/** 默认在视口内展示 14 列（A 到 N），其余列通过底部横向滚动条查看 */
const VISIBLE_COLS = 14
const ROW_NO_WIDTH = 44
const colWidth = ref(120)
const tableWidth = computed(() => ROW_NO_WIDTH + colCount.value * colWidth.value)

function computeFillerRows() {
  const el = scrollRef.value
  if (!el) return
  colWidth.value = Math.max(90, Math.floor((el.clientWidth - ROW_NO_WIDTH - 1) / VISIBLE_COLS))
  const rowEl = el.querySelector('.sheet-table tbody tr') as HTMLElement | null
  const headerEl = el.querySelector('.sheet-table thead tr') as HTMLElement | null
  const rowHeight = rowEl?.getBoundingClientRect().height || 35
  const headerHeight = headerEl?.getBoundingClientRect().height || 30
  // 留 1px 余量，避免铺满后出现细滚动条
  const available = el.clientHeight - headerHeight - 1
  const used = rows.value.length * rowHeight
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
watch(() => rows.value.length, () => nextTick(computeFillerRows))
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

/** 当前选中单元格 */
const activeCell = ref({ r: 0, c: 0 })
/** 选择范围：单元格 / 整行（点左侧行号）/ 整列（点顶部列标） */
const selMode = ref<'cell' | 'row' | 'col'>('cell')
const cellAddress = computed(() => {
  if (selMode.value === 'col') return `${colName(activeCell.value.c)}:${colName(activeCell.value.c)}`
  if (selMode.value === 'row') return `${activeCell.value.r + 1}:${activeCell.value.r + 1}`
  return `${colName(activeCell.value.c)}${activeCell.value.r + 1}`
})

/** 当前选择覆盖的单元格（样式、清除格式都作用于这些单元格） */
function selectedCells(): { r: number; c: number }[] {
  const { r, c } = activeCell.value
  if (selMode.value === 'row') return Array.from({ length: colCount.value }, (_, i) => ({ r, c: i }))
  if (selMode.value === 'col') return rows.value.map((_, i) => ({ r: i, c }))
  return [{ r, c }]
}

function isInSelection(ri: number, ci: number): boolean {
  if (selMode.value === 'row') return ri === activeCell.value.r
  if (selMode.value === 'col') return ci === activeCell.value.c
  return false
}

function selectCol(ci: number) {
  activeCell.value = { r: activeCell.value.r, c: ci }
  selMode.value = 'col'
}

function selectRow(ri: number) {
  activeCell.value = { r: ri, c: activeCell.value.c }
  selMode.value = 'row'
}

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

// ---- 样式 ----
function stylesOf(): Record<string, SheetCellStyle> {
  const sheet = curSheet()
  if (!sheet.styles) sheet.styles = {}
  return sheet.styles
}

function styleAt(r: number, c: number): SheetCellStyle {
  return curSheet().styles?.[`${r},${c}`] ?? {}
}

/** 写入单元格样式；样式为空时删除记录，保持数据干净 */
function setStyle(r: number, c: number, next: SheetCellStyle) {
  const map = stylesOf()
  const key = `${r},${c}`
  if (Object.keys(next).length) map[key] = next
  else delete map[key]
}

/** 对当前单元格做局部样式修改（会进入撤销历史） */
function patchActiveStyle(patch: Partial<SheetCellStyle>) {
  const cells = selectedCells()
  pushHistory()
  for (const { r, c } of cells) setStyle(r, c, { ...styleAt(r, c), ...patch })
}

/** 文字样式 → CSS（加到单元格上，输入框继承） */
function textCss(st: SheetCellStyle): Record<string, string> {
  const css: Record<string, string> = {}
  if (st.bold) css.fontWeight = '700'
  if (st.italic) css.fontStyle = 'italic'
  const deco = [st.underline ? 'underline' : '', st.strike ? 'line-through' : ''].filter(Boolean).join(' ')
  if (deco) css.textDecoration = deco
  if (st.color) css.color = st.color
  if (st.font) css.fontFamily = st.font
  if (st.size) css.fontSize = `${st.size}px`
  if (st.align) css.textAlign = st.align
  return css
}

function cellCss(st: SheetCellStyle): Record<string, string> {
  const css = textCss(st)
  if (st.bg) css.background = st.bg
  css.verticalAlign = st.valign ?? 'middle'
  return css
}

/** 数字格式：只影响展示，单元格保存的仍是原始输入 */
function formatCell(raw: string, st: SheetCellStyle): string {
  const fmt = st.format
  if (!fmt || fmt === 'general') return raw
  if (raw.trim() === '') return raw
  const n = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(n)) return raw
  const d = st.decimals ?? (fmt === 'percent' ? 0 : 2)
  const opts = { minimumFractionDigits: d, maximumFractionDigits: d }
  if (fmt === 'percent') return `${(n * 100).toLocaleString('zh-CN', opts)}%`
  if (fmt === 'currency') return `¥${n.toLocaleString('zh-CN', opts)}`
  return n.toLocaleString('zh-CN', opts)
}

/** 当前单元格的小数位（用于 .00 / .0 按钮） */
function currentDecimals(): number {
  const st = styleAt(activeCell.value.r, activeCell.value.c)
  return st.decimals ?? (st.format === 'percent' ? 0 : 2)
}

function setFormat(format: NonNullable<SheetCellStyle['format']>) {
  patchActiveStyle({ format, decimals: format === 'percent' ? 0 : format === 'general' ? undefined : currentDecimals() })
}

function adjustDecimals(delta: number) {
  const st = styleAt(activeCell.value.r, activeCell.value.c)
  const base = st.format && st.format !== 'general' ? st.format : 'number'
  const d = Math.min(6, Math.max(0, currentDecimals() + delta))
  patchActiveStyle({ format: base, decimals: d })
}

// ---- 撤销 / 重做 ----
interface SheetSnapshot {
  rows: string[][]
  styles: Record<string, SheetCellStyle>
  frozenHeader: boolean
}
const undoStack: SheetSnapshot[] = []
const redoStack: SheetSnapshot[] = []
const canUndo = ref(false)
const canRedo = ref(false)

function snapshot(): SheetSnapshot {
  return {
    rows: rows.value.map((r) => [...r]),
    styles: JSON.parse(JSON.stringify(curSheet().styles ?? {})),
    frozenHeader: !!curSheet().frozenHeader,
  }
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

function applyState(s: SheetSnapshot) {
  curSheet().rows.splice(0, curSheet().rows.length, ...s.rows.map((r) => [...r]))
  curSheet().styles = JSON.parse(JSON.stringify(s.styles))
  curSheet().frozenHeader = s.frozenHeader
  emit('change')
}

function undo() {
  const prev = undoStack.pop()
  if (!prev) return
  redoStack.push(snapshot())
  applyState(prev)
  syncFlags()
}

function redo() {
  const next = redoStack.pop()
  if (!next) return
  undoStack.push(snapshot())
  applyState(next)
  syncFlags()
}

// ---- 行 / 列操作 ----
function addRow() {
  pushHistory()
  rows.value.push(new Array(colCount.value).fill(''))
}

function addCol() {
  pushHistory()
  rows.value.forEach((r) => r.push(''))
}

/** 底部「添加行」：一次添加的行数（默认 200） */
const addRowCount = ref(200)
function addRows() {
  const n = Math.min(5000, Math.max(1, Math.floor(Number(addRowCount.value) || 0)))
  if (!n) return
  pushHistory()
  for (let i = 0; i < n; i++) rows.value.push(new Array(colCount.value).fill(''))
}

/** 删除行 / 列后，样式记录跟着单元格移动 */
function remapStyles(map: (r: number, c: number) => [number, number] | null) {
  const src = curSheet().styles
  if (!src) return
  const next: Record<string, SheetCellStyle> = {}
  for (const k of Object.keys(src)) {
    const [r, c] = k.split(',').map(Number)
    const m = map(r, c)
    if (m) next[`${m[0]},${m[1]}`] = src[k]
  }
  curSheet().styles = next
}

function deleteRow() {
  if (rows.value.length <= 1) return
  pushHistory()
  const r = activeCell.value.r
  rows.value.splice(r, 1)
  remapStyles((rr, cc) => (rr === r ? null : [rr > r ? rr - 1 : rr, cc]))
  activeCell.value.r = Math.min(activeCell.value.r, rows.value.length - 1)
}

function deleteCol() {
  if (colCount.value <= 1) return
  pushHistory()
  const c = activeCell.value.c
  rows.value.forEach((r) => r.splice(c, 1))
  remapStyles((rr, cc) => (cc === c ? null : [rr, cc > c ? cc - 1 : cc]))
  activeCell.value.c = Math.min(activeCell.value.c, colCount.value - 1)
}

/** 按当前列排序（整行移动，样式一起移动） */
function sortByActiveColumn(dir: 'asc' | 'desc') {
  const c = activeCell.value.c
  const src = rows.value
  const order = src.map((_, i) => i)
  const valueOf = (i: number) => src[i][c] ?? ''
  order.sort((a, b) => {
    const va = valueOf(a)
    const vb = valueOf(b)
    const na = Number(va)
    const nb = Number(vb)
    const numeric = va.trim() !== '' && vb.trim() !== '' && Number.isFinite(na) && Number.isFinite(nb)
    const cmp = numeric ? na - nb : va.localeCompare(vb, 'zh-CN')
    return dir === 'asc' ? cmp : -cmp
  })
  pushHistory()
  const oldStyles = curSheet().styles ?? {}
  const newIndexOf = new Map<number, number>()
  order.forEach((oldIdx, newIdx) => newIndexOf.set(oldIdx, newIdx))
  const nextStyles: Record<string, SheetCellStyle> = {}
  for (const k of Object.keys(oldStyles)) {
    const [r, cc] = k.split(',').map(Number)
    const nr = newIndexOf.get(r)
    if (nr !== undefined) nextStyles[`${nr},${cc}`] = oldStyles[k]
  }
  const reordered = order.map((i) => src[i])
  curSheet().rows.splice(0, curSheet().rows.length, ...reordered)
  curSheet().styles = nextStyles
  emit('change')
}

// ---- 工作表（页签） ----
/** 切换 / 新增 / 删除工作表后，撤销历史、选区、格式刷都回到初始状态 */
function resetSheetState() {
  undoStack.length = 0
  redoStack.length = 0
  syncFlags()
  activeCell.value = { r: 0, c: 0 }
  painter.value = null
  colorMenu.value = null
}

function switchSheet(i: number) {
  if (i === sheetIdx.value) return
  props.data.active = i
  resetSheetState()
  emit('change')
}

function addSheet() {
  const name = nextSheetName(props.data.sheets)
  props.data.sheets.push(createSheetPage(name))
  props.data.active = props.data.sheets.length - 1
  resetSheetState()
  emit('change')
}

function removeSheet(i: number) {
  if (props.data.sheets.length <= 1) return
  const target = props.data.sheets[i]
  Modal.confirm({
    title: '删除工作表',
    content: `确定删除「${target.name}」吗？表内数据将无法恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      // 删除的是当前页签时回到前一个；否则保持当前页签（下标需要跟着调整）
      const cur = sheetIdx.value
      props.data.sheets.splice(i, 1)
      props.data.active = i < cur ? cur - 1 : i === cur ? Math.max(0, i - 1) : cur
      resetSheetState()
      emit('change')
    },
  })
}

function toggleFreeze() {
  pushHistory()
  curSheet().frozenHeader = !curSheet().frozenHeader
}

// ---- 编辑 ----
const activeInput = ref<HTMLInputElement | null>(null)

function focusCell(ri: number, ci: number) {
  // 格式刷：把记下的样式应用到点击的单元格
  if (painter.value) {
    pushHistory()
    setStyle(ri, ci, { ...painter.value })
    painter.value = null
  }
  activeCell.value = { r: ri, c: ci }
  selMode.value = 'cell'
}

const activeValue = computed(() => rows.value[activeCell.value.r]?.[activeCell.value.c] || '')

watch(activeCell, () => {
  nextTick(() => activeInput.value?.focus())
})

function setActiveValue(e: Event) {
  const row = rows.value[activeCell.value.r]
  if (!row) return
  const val = (e.target as HTMLInputElement).value
  if (row[activeCell.value.c] === val) return
  pushHistory()
  row[activeCell.value.c] = val
}

function setCellValue(row: string[], ci: number, e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (row[ci] === val) return
  pushHistory()
  row[ci] = val
}

/** 清除格式：去掉当前单元格的样式，内容保留 */
function clearFormat() {
  const cells = selectedCells().filter(({ r, c }) => curSheet().styles?.[`${r},${c}`])
  if (!cells.length) return
  pushHistory()
  for (const { r, c } of cells) setStyle(r, c, {})
}

// ---- 格式刷 ----
const painter = ref<SheetCellStyle | null>(null)
function togglePainter() {
  if (painter.value) {
    painter.value = null
    return
  }
  const st = styleAt(activeCell.value.r, activeCell.value.c)
  painter.value = { ...st }
  message.info('点击目标单元格应用格式')
}

// ---- 颜色面板 ----
const colorMenu = ref<'text' | 'bg' | null>(null)
const TEXT_COLORS = ['#1f2329', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#8c8c8c']
const BG_COLORS = ['#fff3bf', '#ffe3e3', '#d3f9d8', '#d0ebff', '#e5dbff', '#fff0f6', '#f1f3f5', '#e6fcf5']

function pickColor(kind: 'text' | 'bg', value: string | null) {
  colorMenu.value = null
  patchActiveStyle(kind === 'text' ? { color: value ?? undefined } : { bg: value ?? undefined })
}

// ---- 字体 / 字号 ----
const FONT_OPTIONS = [
  { value: '', label: '默认字体' },
  { value: "'Microsoft YaHei', sans-serif", label: '微软雅黑' },
  { value: 'SimSun, serif', label: '宋体' },
  { value: 'SimHei, sans-serif', label: '黑体' },
  { value: 'KaiTi, serif', label: '楷体' },
  { value: "Consolas, 'Courier New', monospace", label: '等宽字体' },
]
const SIZE_OPTIONS = [12, 13, 14, 16, 18, 20, 24]

const curStyle = computed(() => styleAt(activeCell.value.r, activeCell.value.c))

function onFontChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  patchActiveStyle({ font: v || undefined })
}
function onSizeChange(e: Event) {
  const v = Number((e.target as HTMLSelectElement).value)
  patchActiveStyle({ size: v || undefined })
}
function onFormatChange(e: Event) {
  setFormat((e.target as HTMLSelectElement).value as NonNullable<SheetCellStyle['format']>)
}

const FORMAT_OPTIONS = [
  { value: 'general', label: '常规' },
  { value: 'number', label: '数字' },
  { value: 'percent', label: '百分比' },
  { value: 'currency', label: '货币' },
]

/** 暂未开放的功能：统一提示 */
function notImplemented(name: string) {
  message.info(`${name}功能开发中`)
}

const rowsHeight = computed(() => rows.value.length)
</script>

<template>
  <div class="sheet-editor">
    <!-- 工作表标签 -->
    <div class="sheet-tabs">
      <div
        v-for="(s, i) in data.sheets"
        :key="`${i}-${s.name}`"
        class="sheet-tab"
        :class="{ 'is-active': i === sheetIdx }"
        :title="s.name"
        @click="switchSheet(i)"
      >
        <TableOutlined /><span class="sheet-tab-name">{{ s.name }}</span>
        <span
          v-if="i === sheetIdx && data.sheets.length > 1"
          class="sheet-tab-close"
          title="删除工作表"
          @click.stop="removeSheet(i)"
        >×</span>
      </div>
      <button type="button" class="sheet-tab-add" title="新增工作表" @click="addSheet">
        <PlusOutlined />
      </button>
    </div>

    <!-- 工具条：按飞书表格分组（第一行：通用 / 字体 / 对齐 / 数字 / 数据；第二行：文字样式与颜色） -->
    <div class="sheet-ribbon">
      <!-- 第一行：文件 / 编辑 / 行列 / 数据 -->
      <div class="sheet-row">
        <button type="button" class="sheet-tool is-stack" @click="notImplemented('菜单')">
          <MenuOutlined /><span>菜单</span>
        </button>
        <span class="sheet-sep" />
        <button type="button" class="sheet-tool is-stack" title="撤销" :disabled="!canUndo" @click="undo">
          <UndoOutlined /><span>撤销</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="重做" :disabled="!canRedo" @click="redo">
          <RedoOutlined /><span>重做</span>
        </button>
        <button
          type="button"
          class="sheet-tool is-stack"
          :class="{ 'is-on': !!painter }"
          title="格式刷：先选中源单元格，再点击目标单元格"
          @click="togglePainter"
        >
          <FormatPainterOutlined /><span>格式刷</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="清除当前单元格格式" @click="clearFormat">
          <ClearOutlined /><span>清除格式</span>
        </button>
        <span class="sheet-sep" />
        <button type="button" class="sheet-tool is-stack" title="在下方插入一行" @click="addRow">
          <PlusOutlined /><span>插入行</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="在右侧插入一列" @click="addCol">
          <PlusOutlined /><span>插入列</span>
        </button>
        <button type="button" class="sheet-tool is-stack danger" title="删除当前行" @click="deleteRow">
          <DeleteOutlined /><span>删除行</span>
        </button>
        <button type="button" class="sheet-tool is-stack danger" title="删除当前列" @click="deleteCol">
          <DeleteOutlined /><span>删除列</span>
        </button>
        <span class="sheet-sep" />
        <button type="button" class="sheet-tool is-stack" title="合并单元格" @click="notImplemented('合并单元格')">
          <ColumnWidthOutlined /><span>合并单元格</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="边框" @click="notImplemented('边框')">
          <BorderOutlined /><span>边框</span>
        </button>
        <span class="sheet-sep" />
        <button type="button" class="sheet-tool is-stack" :class="{ 'is-on': !!curSheet().frozenHeader }" title="冻结首行" @click="toggleFreeze">
          <PushpinOutlined /><span>冻结</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="筛选" @click="notImplemented('筛选')">
          <FilterOutlined /><span>筛选</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="按当前列升序" @click="sortByActiveColumn('asc')">
          <SortAscendingOutlined /><span>升序</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="按当前列降序" @click="sortByActiveColumn('desc')">
          <SortDescendingOutlined /><span>降序</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="条件格式" @click="notImplemented('条件格式')">
          <BlockOutlined /><span>条件格式</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="下拉列表" @click="notImplemented('下拉列表')">
          <UnorderedListOutlined /><span>下拉列表</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="更多" @click="notImplemented('更多')">
          <MoreOutlined /><span>更多</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="查找和替换" @click="notImplemented('查找和替换')">
          <SearchOutlined /><span>查找替换</span>
        </button>
        <button type="button" class="sheet-tool is-stack" title="评论" @click="notImplemented('评论')">
          <MessageOutlined /><span>评论</span>
        </button>
      </div>

      <!-- 第二行：字体 / 文字样式 / 颜色 / 对齐 / 数字格式 -->
      <div class="sheet-row is-format">
        <select class="sheet-select" title="字体" :value="curStyle.font || ''" @change="onFontChange">
          <option v-for="f in FONT_OPTIONS" :key="f.label" :value="f.value">{{ f.label }}</option>
        </select>
        <select class="sheet-select is-size" title="字号" :value="curStyle.size || 14" @change="onSizeChange">
          <option v-for="s in SIZE_OPTIONS" :key="s" :value="s">{{ s }}</option>
        </select>
        <span class="sheet-sep" />
        <button type="button" class="sheet-tool is-icon" title="加粗" :class="{ 'is-on': curStyle.bold }" @click="patchActiveStyle({ bold: !curStyle.bold })"><BoldOutlined /></button>
        <button type="button" class="sheet-tool is-icon" title="删除线" :class="{ 'is-on': curStyle.strike }" @click="patchActiveStyle({ strike: !curStyle.strike })"><StrikethroughOutlined /></button>
        <button type="button" class="sheet-tool is-icon" title="斜体" :class="{ 'is-on': curStyle.italic }" @click="patchActiveStyle({ italic: !curStyle.italic })"><ItalicOutlined /></button>
        <button type="button" class="sheet-tool is-icon" title="下划线" :class="{ 'is-on': curStyle.underline }" @click="patchActiveStyle({ underline: !curStyle.underline })"><UnderlineOutlined /></button>
        <div class="sheet-pop-wrap">
          <button type="button" class="sheet-tool is-icon is-caret" title="文字颜色" @click="colorMenu = colorMenu === 'text' ? null : 'text'">
            <FontColorsOutlined />
            <span class="sheet-color-bar" :style="{ background: curStyle.color || '#1f2329' }" />
            <DownOutlined class="sheet-caret" />
          </button>
          <div v-if="colorMenu === 'text'" class="sheet-pop">
            <div class="sheet-swatches">
              <button v-for="c in TEXT_COLORS" :key="c" type="button" class="sheet-swatch" :style="{ background: c }" @click="pickColor('text', c)" />
            </div>
            <button type="button" class="sheet-pop-clear" @click="pickColor('text', null)">默认颜色</button>
          </div>
        </div>
        <div class="sheet-pop-wrap">
          <button type="button" class="sheet-tool is-icon is-caret" title="单元格填充色" @click="colorMenu = colorMenu === 'bg' ? null : 'bg'">
            <BgColorsOutlined />
            <span class="sheet-color-bar" :style="{ background: curStyle.bg || '#fff3bf' }" />
            <DownOutlined class="sheet-caret" />
          </button>
          <div v-if="colorMenu === 'bg'" class="sheet-pop">
            <div class="sheet-swatches">
              <button v-for="c in BG_COLORS" :key="c" type="button" class="sheet-swatch" :style="{ background: c }" @click="pickColor('bg', c)" />
            </div>
            <button type="button" class="sheet-pop-clear" @click="pickColor('bg', null)">无填充</button>
          </div>
        </div>
        <span class="sheet-sep" />
        <button type="button" class="sheet-tool is-icon" title="垂直顶端对齐" :class="{ 'is-on': curStyle.valign === 'top' }" @click="patchActiveStyle({ valign: 'top' })"><VerticalAlignTopOutlined /></button>
        <button type="button" class="sheet-tool is-icon" title="垂直居中" :class="{ 'is-on': !curStyle.valign || curStyle.valign === 'middle' }" @click="patchActiveStyle({ valign: 'middle' })"><VerticalAlignMiddleOutlined /></button>
        <button type="button" class="sheet-tool is-icon" title="垂直底端对齐" :class="{ 'is-on': curStyle.valign === 'bottom' }" @click="patchActiveStyle({ valign: 'bottom' })"><VerticalAlignBottomOutlined /></button>
        <span class="sheet-sep" />
        <button type="button" class="sheet-tool is-icon" title="左对齐" :class="{ 'is-on': curStyle.align === 'left' }" @click="patchActiveStyle({ align: 'left' })"><AlignLeftOutlined /></button>
        <button type="button" class="sheet-tool is-icon" title="水平居中" :class="{ 'is-on': curStyle.align === 'center' }" @click="patchActiveStyle({ align: 'center' })"><AlignCenterOutlined /></button>
        <button type="button" class="sheet-tool is-icon" title="右对齐" :class="{ 'is-on': curStyle.align === 'right' }" @click="patchActiveStyle({ align: 'right' })"><AlignRightOutlined /></button>
        <span class="sheet-sep" />
        <select class="sheet-select is-format" title="数字格式" :value="curStyle.format || 'general'" @change="onFormatChange">
          <option v-for="f in FORMAT_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
        <button type="button" class="sheet-tool is-icon" title="人民币格式" @click="setFormat('currency')">¥</button>
        <button type="button" class="sheet-tool is-icon" title="百分比格式" @click="setFormat('percent')">%</button>
        <button type="button" class="sheet-tool is-icon" title="增加小数位" @click="adjustDecimals(1)">.00</button>
        <button type="button" class="sheet-tool is-icon" title="减少小数位" @click="adjustDecimals(-1)">.0</button>
      </div>
    </div>

    <!-- 公式栏：左侧单元格地址，右侧当前单元格内容（可直接编辑） -->
    <div class="sheet-formula">
      <span class="sheet-address">{{ cellAddress }}</span>
      <span class="sheet-fx">fx</span>
      <input class="sheet-formula-input" :value="activeValue" placeholder="在此输入内容" @input="setActiveValue" />
    </div>

    <!-- 表格 -->
    <div ref="scrollRef" class="sheet-scroll">
      <table class="sheet-table" :class="{ 'is-frozen': curSheet().frozenHeader }" :style="{ width: tableWidth + 'px' }">
        <colgroup>
          <col :style="{ width: ROW_NO_WIDTH + 'px' }" />
          <col v-for="i in colCount" :key="i" :style="{ width: colWidth + 'px' }" />
        </colgroup>
        <thead>
          <tr>
            <th class="sheet-corner" />
            <th
              v-for="i in colCount"
              :key="i"
              class="sheet-col-head"
              :class="{ active: activeCell.c === i - 1 && selMode !== 'row', 'is-sel': selMode === 'col' && activeCell.c === i - 1 }"
              title="点击选中整列"
              @mousedown.prevent="selectCol(i - 1)"
            >{{ colName(i - 1) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in rows" :key="ri">
            <th
              class="sheet-row-no"
              :class="{ active: activeCell.r === ri && selMode !== 'col', 'is-sel': selMode === 'row' && activeCell.r === ri }"
              title="点击选中整行"
              @mousedown.prevent="selectRow(ri)"
            >{{ ri + 1 }}</th>
            <td
              v-for="ci in colCount"
              :key="ci"
              class="sheet-cell"
              :class="{
                active: activeCell.r === ri && activeCell.c === ci - 1 && selMode === 'cell',
                'in-range': isInSelection(ri, ci - 1),
                'is-painting': !!painter,
              }"
              :style="cellCss(styleAt(ri, ci - 1))"
              @mousedown="focusCell(ri, ci - 1)"
            >
              <input
                v-if="activeCell.r === ri && activeCell.c === ci - 1"
                ref="activeInput"
                :value="row[ci - 1] || ''"
                class="sheet-input"
                :style="textCss(styleAt(ri, ci - 1))"
                @input="setCellValue(row, ci - 1, $event)"
              />
              <div v-else class="sheet-text" :style="textCss(styleAt(ri, ci - 1))">{{ formatCell(row[ci - 1] || '', styleAt(ri, ci - 1)) }}</div>
            </td>
          </tr>
          <!-- 空白占位行：网格铺满高度 -->
          <tr
            v-for="n in fillerRows"
            :key="`filler-${n}`"
            class="sheet-filler-row"
            :style="n === fillerRows && fillerLastExtra ? { height: `${fillerRowHeight + fillerLastExtra}px` } : undefined"
          >
            <th class="sheet-row-no">{{ rowsHeight + n }}</th>
            <td v-for="ci in colCount" :key="ci" class="sheet-cell" />
          </tr>
          <!-- 表格最下面：添加行 -->
          <tr class="sheet-add-row">
            <td :colspan="colCount + 1">
              <div class="sheet-add-bar">
                <button type="button" class="sheet-add-btn" @click="addRows"><PlusOutlined /> 添加</button>
                <input v-model.number="addRowCount" type="number" min="1" max="5000" class="sheet-add-input" @keydown.enter="addRows" />
                <span>行</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 底部状态条：表格规模 -->
    <div class="sheet-statusbar">
      <span>{{ rows.length }} 行 × {{ colCount }} 列</span>
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
.sheet-tab {
  cursor: pointer;
  user-select: none;
  max-width: 180px;
}
.sheet-tab:hover {
  color: var(--docs-text);
}
.sheet-tab.is-active {
  color: var(--c-primary);
  background: var(--docs-canvas);
  border-bottom-color: var(--c-primary);
}
.sheet-tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sheet-tab-close {
  margin-left: 2px;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
  color: var(--docs-text-3);
  border-radius: var(--docs-radius-xs);
}
.sheet-tab-close:hover {
  color: var(--docs-danger);
  background: color-mix(in srgb, var(--docs-danger) 8%, transparent);
}
.sheet-tab-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: 4px;
  font-size: 13px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.sheet-tab-add:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}

/* ---- 工具条 ---- */
.sheet-ribbon {
  display: flex;
  flex-direction: column;
  flex: none;
  background: var(--docs-canvas);
  border-bottom: 1px solid var(--docs-border);
}
/* 工具条固定两行：每行不换行，超出宽度时整体收窄（由容器宽度决定），不会增加行数 */
.sheet-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  height: 52px;
  padding: 0 10px;
  border-bottom: 1px solid var(--docs-border);
}
.sheet-row.is-format {
  height: 40px;
  border-bottom: none;
}
.sheet-row > * {
  flex: none;
}
.sheet-sep {
  width: 1px;
  height: 26px;
  margin: 0 6px;
  background: var(--docs-border);
}
.sheet-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 30px;
  min-width: 30px;
  padding: 0 6px;
  font-family: inherit;
  font-size: 13px;
  color: #374151;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background-color var(--docs-dur) var(--docs-ease), color var(--docs-dur) var(--docs-ease);
}
.sheet-tool:hover:not(:disabled) {
  background: var(--docs-hover);
}
.sheet-tool:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.sheet-tool.is-on {
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
}
.sheet-tool.danger:hover:not(:disabled) {
  color: var(--docs-danger);
}
/* 上方图标 + 下方文字 */
.sheet-tool.is-stack {
  flex-direction: column;
  gap: 2px;
  min-width: 46px;
  height: 42px;
  font-size: 12px;
  color: #4b5563;
}
.sheet-tool.is-stack .anticon {
  font-size: 17px;
}
.sheet-tool.is-icon {
  font-size: 15px;
}
.sheet-tool.is-icon.is-caret {
  min-width: 40px;
}
.sheet-tool .anticon {
  font-size: 15px;
}
.sheet-caret {
  font-size: 10px;
  margin-left: 2px;
  opacity: 0.6;
}
.sheet-color-bar {
  position: absolute;
  left: 8px;
  right: 16px;
  bottom: 4px;
  height: 3px;
  border-radius: 1px;
}
.sheet-tool.is-caret {
  position: relative;
  padding-bottom: 6px;
}
.sheet-select {
  height: 28px;
  padding: 0 6px;
  font-family: inherit;
  font-size: 13px;
  color: #374151;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius-sm);
  outline: none;
  cursor: pointer;
}
.sheet-select.is-size {
  width: 62px;
}
.sheet-select.is-format {
  width: 92px;
}
.sheet-hint {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-right: 4px;
  font-size: 12px;
  color: var(--docs-text-3);
}

/* 颜色面板 */
.sheet-pop-wrap {
  position: relative;
}
.sheet-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  width: 176px;
  padding: 10px;
  background: var(--docs-canvas);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.sheet-swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.sheet-swatch {
  width: 32px;
  height: 32px;
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
}
.sheet-pop-clear {
  width: 100%;
  margin-top: 8px;
  height: 28px;
  font-size: 12px;
  color: var(--docs-text-2);
  background: var(--docs-hover);
  border: none;
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
}

/* ---- 公式栏：地址 | fx | 内容 ---- */
.sheet-formula {
  display: flex;
  align-items: stretch;
  height: 34px;
  flex: none;
  background: var(--docs-canvas);
  border-bottom: 1px solid var(--docs-border);
}
.sheet-address {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  flex: none;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  border-right: 1px solid var(--docs-border);
}
.sheet-fx {
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  flex: none;
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-size: 14px;
  color: var(--docs-text-3);
  border-right: 1px solid var(--docs-border);
}
.sheet-formula-input {
  flex: 1;
  min-width: 0;
  padding: 0 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--docs-text);
  background: transparent;
  border: none;
  outline: none;
}

/* ---- 表格 ---- */
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
.sheet-table th,
.sheet-table td {
  border-right: 1px solid var(--docs-border);
  border-bottom: 1px solid var(--docs-border);
}
/* 表头固定在顶部 */
.sheet-table thead th {
  position: sticky;
  top: 0;
  z-index: 3;
}
/* 冻结首行：第一条数据行固定在表头下方 */
.sheet-table.is-frozen tbody tr:first-child > * {
  position: sticky;
  top: 30px;
  z-index: 2;
  background: var(--docs-canvas);
  box-shadow: 0 1px 0 var(--docs-border-strong);
}
.sheet-corner,
.sheet-row-no,
.sheet-col-head {
  height: 30px;
  font-size: var(--docs-fs-meta);
  font-weight: 500;
  color: var(--docs-text-2);
  text-align: center;
  background: #f5f6f8;
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
  cursor: cell;
}
.sheet-cell.is-painting {
  cursor: copy;
}
.sheet-table tbody tr,
.sheet-table tbody th,
.sheet-table tbody td {
  height: 35px;
}
.sheet-cell.active {
  background: var(--c-primary-bg);
  box-shadow: inset 0 0 0 2px var(--c-primary);
}
/* 整行 / 整列选中：范围内的单元格浅色底，表头高亮 */
.sheet-cell.in-range {
  background: color-mix(in srgb, var(--c-primary) 8%, var(--docs-canvas));
}
.sheet-col-head,
.sheet-row-no {
  cursor: pointer;
  user-select: none;
}
.sheet-col-head:hover,
.sheet-row-no:hover {
  color: var(--docs-text);
}
.sheet-col-head.is-sel,
.sheet-row-no.is-sel {
  color: #fff;
  background: var(--c-primary);
}
.sheet-text {
  padding: 0 var(--docs-space-3);
  min-height: 34px;
  line-height: 34px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
}
.sheet-input {
  width: 100%;
  height: 34px;
  padding: 0 var(--docs-space-3);
  font: inherit;
  color: inherit;
  background: transparent;
  border: none;
  outline: none;
}

/* ---- 表格最下面：添加行 ---- */
.sheet-add-row td {
  height: 40px;
  padding: 0;
  background: var(--docs-canvas);
  border-right: none;
}
.sheet-add-bar {
  position: sticky;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--docs-text-2);
}
.sheet-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 13px;
  color: var(--c-primary);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.sheet-add-btn:hover {
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
}
.sheet-add-input {
  width: 72px;
  height: 28px;
  padding: 0 8px;
  font-family: inherit;
  font-size: 13px;
  text-align: center;
  color: var(--docs-text);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius-sm);
  outline: none;
}

/* ---- 底部状态条 ---- */
.sheet-statusbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 28px;
  flex: none;
  padding: 0 12px;
  font-size: 12px;
  color: var(--docs-text-3);
  background: var(--docs-paper);
  border-top: 1px solid var(--docs-border);
}
</style>
