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
  DownOutlined,
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
  StrikethroughOutlined,
  TableOutlined,
  UnderlineOutlined,
  UndoOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignTopOutlined,
  FilterOutlined,
  ColumnWidthOutlined,
  UnorderedListOutlined,
  BlockOutlined,
} from '@ant-design/icons-vue'
import type { SheetCellStyle, SheetData, SheetPage } from '@/types/docs'
import { createSheetPage, nextSheetName } from '@/utils/doc-sheet'
import { numberLocale } from '@/utils/us-format'
import { tr } from '@/i18n'

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
const selMode = ref<'cell' | 'row' | 'col' | 'range'>('cell')
const cellAddress = computed(() => {
  const rect = rangeRect()
  if (rect) return `${colName(rect.c1)}${rect.r1 + 1}:${colName(rect.c2)}${rect.r2 + 1}`
  if (selMode.value === 'col') return `${colName(activeCell.value.c)}:${colName(activeCell.value.c)}`
  if (selMode.value === 'row') return `${activeCell.value.r + 1}:${activeCell.value.r + 1}`
  return `${colName(activeCell.value.c)}${activeCell.value.r + 1}`
})

/** 当前选择覆盖的单元格（样式、清除格式都作用于这些单元格） */
/** 多选区域：拖拽或 Shift 点击时，anchor 为起点，rangeEnd 为终点 */
const rangeAnchor = ref<{ r: number; c: number } | null>(null)
const rangeEnd = ref<{ r: number; c: number } | null>(null)
const dragging = ref(false)

/** 当前矩形选区（仅多选时有值） */
function rangeRect(): { r1: number; r2: number; c1: number; c2: number } | null {
  if (selMode.value !== 'range' || !rangeAnchor.value || !rangeEnd.value) return null
  const a = rangeAnchor.value
  const b = rangeEnd.value
  return {
    r1: Math.min(a.r, b.r),
    r2: Math.max(a.r, b.r),
    c1: Math.min(a.c, b.c),
    c2: Math.max(a.c, b.c),
  }
}

function selectedCells(): { r: number; c: number }[] {
  const { r, c } = activeCell.value
  const rect = rangeRect()
  if (rect) {
    const out: { r: number; c: number }[] = []
    for (let ri = rect.r1; ri <= rect.r2; ri++) for (let ci = rect.c1; ci <= rect.c2; ci++) out.push({ r: ri, c: ci })
    return out
  }
  if (selMode.value === 'row') return Array.from({ length: colCount.value }, (_, i) => ({ r, c: i }))
  if (selMode.value === 'col') return rows.value.map((_, i) => ({ r: i, c }))
  return [{ r, c }]
}

function isInSelection(ri: number, ci: number): boolean {
  const rect = rangeRect()
  if (rect) return ri >= rect.r1 && ri <= rect.r2 && ci >= rect.c1 && ci <= rect.c2
  if (selMode.value === 'row') return ri === activeCell.value.r
  if (selMode.value === 'col') return ci === activeCell.value.c
  return false
}

/** 扩展选区到某个单元格（拖拽经过 / Shift 点击） */
function extendRangeTo(ri: number, ci: number) {
  if (!rangeAnchor.value) return
  rangeEnd.value = { r: ri, c: ci }
  selMode.value = 'range'
}

function onCellMouseDown(e: MouseEvent, ri: number, ci: number) {
  // 在输入框里选文字时不开始拖拽选区
  if (!e.shiftKey && (e.target as HTMLElement).tagName === 'INPUT') return
  if (e.shiftKey && rangeAnchor.value) {
    extendRangeTo(ri, ci)
    return
  }
  focusCell(ri, ci)
  rangeAnchor.value = { r: ri, c: ci }
  rangeEnd.value = { r: ri, c: ci }
  dragging.value = true
}

function onCellMouseEnter(ri: number, ci: number) {
  if (dragging.value) extendRangeTo(ri, ci)
}

function onDocMouseUp() {
  dragging.value = false
}

onMounted(() => document.addEventListener('mouseup', onDocMouseUp))
onBeforeUnmount(() => document.removeEventListener('mouseup', onDocMouseUp))

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

/** 文本溢出方式 → CSS（只作用于单元格里的文字） */
function wrapCss(st: SheetCellStyle): Record<string, string> {
  if (st.wrap === 'overflow') return { whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip', lineHeight: '34px' }
  if (st.wrap === 'wrap') return { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'visible', textOverflow: 'clip', lineHeight: '1.4', padding: '6px 12px' }
  return {}
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
  // 跟随语言：英文为千分位逗号 + 美元符号，中文为 zh-CN 格式 + 人民币符号
  const loc = numberLocale()
  if (fmt === 'percent') return `${(n * 100).toLocaleString(loc, opts)}%`
  if (fmt === 'currency') return `${tr('¥', '$')}${n.toLocaleString(loc, opts)}`
  return n.toLocaleString(loc, opts)
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
  merges: { r1: number; c1: number; r2: number; c2: number }[]
  filter?: { c: number; keyword: string }
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
    merges: JSON.parse(JSON.stringify(curSheet().merges ?? [])),
    filter: curSheet().filter ? { ...curSheet().filter! } : undefined,
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
  curSheet().merges = JSON.parse(JSON.stringify(s.merges))
  if (s.filter) curSheet().filter = { ...s.filter }
  else delete curSheet().filter
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
/** 底部「添加行」：一次添加的行数（默认 200） */
const addRowCount = ref(200)
function addRows() {
  const n = Math.min(5000, Math.max(1, Math.floor(Number(addRowCount.value) || 0)))
  if (!n) return
  pushHistory()
  for (let i = 0; i < n; i++) rows.value.push(new Array(colCount.value).fill(''))
}

/** 按当前列排序（整行移动，样式一起移动） */
function sortByActiveColumn(dir: 'asc' | 'desc') {
  if ((curSheet().merges ?? []).length) {
    message.info(tr('请先取消合并单元格再排序', 'Unmerge cells before sorting'))
    return
  }
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
    title: tr('删除工作表', 'Delete sheet'),
    content: tr(
      `确定删除「${target.name}」吗？表内数据将无法恢复。`,
      `Delete "${target.name}"? Its data cannot be recovered.`,
    ),
    okText: tr('删除', 'Delete'),
    okType: 'danger',
    cancelText: tr('取消', 'Cancel'),
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

// ---- 合并单元格 ----
type MergeRect = { r1: number; c1: number; r2: number; c2: number }

function mergesOf(): MergeRect[] {
  return curSheet().merges ?? []
}

function overlapsRect(a: MergeRect, b: MergeRect): boolean {
  return a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2
}

/** 覆盖 (r,c) 的合并区域 */
function coveringMerge(r: number, c: number): MergeRect | null {
  return mergesOf().find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) ?? null
}

/** 被合并掉的单元格（不显示） */
function cellHidden(r: number, c: number): boolean {
  const m = coveringMerge(r, c)
  return !!m && (r !== m.r1 || c !== m.c1)
}

/** 合并区域左上角单元格的跨行 / 跨列数 */
function cellSpan(r: number, c: number): { rowspan: number; colspan: number } {
  const m = coveringMerge(r, c)
  if (!m || r !== m.r1 || c !== m.c1) return { rowspan: 1, colspan: 1 }
  return { rowspan: m.r2 - m.r1 + 1, colspan: m.c2 - m.c1 + 1 }
}

/** 合并 / 取消合并：多选区域时合并；选区与已有合并重叠时取消这些合并 */
function toggleMerge() {
  const rect = rangeRect()
  if (!rect) {
    message.info(tr('请先拖拽选择要合并的单元格', 'Drag to select the cells to merge first'))
    return
  }
  const existing = mergesOf()
  if (existing.some((m) => overlapsRect(m, rect))) {
    pushHistory()
    curSheet().merges = existing.filter((m) => !overlapsRect(m, rect))
    emit('change')
    return
  }
  if (rect.r1 === rect.r2 && rect.c1 === rect.c2) {
    message.info(tr('至少选择两个单元格才能合并', 'Select at least two cells to merge'))
    return
  }
  pushHistory()
  // 合并后只保留左上角的内容，其余单元格的内容和样式清空
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) {
      if (r === rect.r1 && c === rect.c1) continue
      rows.value[r][c] = ''
      setStyle(r, c, {})
    }
  }
  curSheet().merges = [...existing, { ...rect }]
  activeCell.value = { r: rect.r1, c: rect.c1 }
  selMode.value = 'cell'
  emit('change')
}

// ---- 筛选 ----
const filterOpen = ref(false)
/** 打开筛选面板时记下的列（筛选按该列的内容过滤） */
const filterCol = ref(0)

/** 行是否通过当前筛选 */
function isRowVisible(ri: number): boolean {
  const f = curSheet().filter
  const kw = f?.keyword.trim().toLowerCase()
  if (!f || !kw) return true
  return String(rows.value[ri]?.[f.c] ?? '').toLowerCase().includes(kw)
}

/** 通过筛选的行（表格只渲染这些行，行号仍显示原始序号） */
const visibleRows = computed(() =>
  rows.value.map((row, ri) => ({ row, ri })).filter(({ ri }) => isRowVisible(ri)),
)

function toggleFilterPanel() {
  filterOpen.value = !filterOpen.value
  filterCol.value = activeCell.value.c
}

function setFilterKeyword(e: Event) {
  const kw = (e.target as HTMLInputElement).value
  pushHistory()
  if (!kw.trim()) delete curSheet().filter
  else curSheet().filter = { c: filterCol.value, keyword: kw }
  emit('change')
}

function clearFilter() {
  pushHistory()
  delete curSheet().filter
  emit('change')
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
  message.info(tr('点击目标单元格应用格式', 'Click a target cell to apply the format'))
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
  { value: '', zh: '默认字体', en: 'Default font' },
  // 中文字体
  { value: "'Microsoft YaHei', sans-serif", zh: '微软雅黑', en: 'Microsoft YaHei' },
  { value: 'SimSun, serif', zh: '宋体', en: 'SimSun' },
  { value: 'SimHei, sans-serif', zh: '黑体', en: 'SimHei' },
  { value: 'KaiTi, serif', zh: '楷体', en: 'KaiTi' },
  { value: 'FangSong, serif', zh: '仿宋', en: 'FangSong' },
  { value: "'PingFang SC', 'Microsoft YaHei', sans-serif", zh: '苹方', en: 'PingFang SC' },
  // 西文字体
  { value: 'Arial, sans-serif', zh: 'Arial', en: 'Arial' },
  { value: "'Arial Black', sans-serif", zh: 'Arial Black', en: 'Arial Black' },
  { value: "Calibri, 'Segoe UI', sans-serif", zh: 'Calibri', en: 'Calibri' },
  { value: "'Segoe UI', sans-serif", zh: 'Segoe UI', en: 'Segoe UI' },
  { value: "Inter, 'Segoe UI', sans-serif", zh: 'Inter', en: 'Inter' },
  { value: "Helvetica, Arial, sans-serif", zh: 'Helvetica', en: 'Helvetica' },
  { value: "Verdana, sans-serif", zh: 'Verdana', en: 'Verdana' },
  { value: "Tahoma, sans-serif", zh: 'Tahoma', en: 'Tahoma' },
  { value: "'Trebuchet MS', sans-serif", zh: 'Trebuchet MS', en: 'Trebuchet MS' },
  { value: "'Times New Roman', serif", zh: 'Times New Roman', en: 'Times New Roman' },
  { value: 'Georgia, serif', zh: 'Georgia', en: 'Georgia' },
  { value: "Garamond, 'Times New Roman', serif", zh: 'Garamond', en: 'Garamond' },
  { value: "'Courier New', monospace", zh: 'Courier New', en: 'Courier New' },
  { value: "Consolas, 'Courier New', monospace", zh: 'Consolas', en: 'Consolas' },
  { value: "Impact, sans-serif", zh: 'Impact', en: 'Impact' },
  { value: "'Comic Sans MS', cursive", zh: 'Comic Sans MS', en: 'Comic Sans MS' },
]
const SIZE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
/** 边框下拉：鼠标悬停时展开 */
const BORDER_OPTIONS = [
  { zh: '所有边框', en: 'All borders' },
  { zh: '外边框', en: 'Outside borders' },
  { zh: '内边框', en: 'Inside borders' },
  { zh: '无边框', en: 'No borders' },
]
const borderHover = ref(false)
const sortHover = ref(false)

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
  { value: 'general', zh: '常规', en: 'General' },
  { value: 'number', zh: '数字', en: 'Number' },
  { value: 'percent', zh: '百分比', en: 'Percent' },
  { value: 'currency', zh: '货币', en: 'Currency' },
]

/** 暂未开放的功能：统一提示 */
function notImplemented(zh: string, en: string) {
  message.info(tr(`${zh}功能开发中`, `${en} is coming soon`))
}

const rowsHeight = computed(() => rows.value.length)

// ---- 粘贴（参考飞书表格）：Excel / 飞书表格 / 网页表格复制的内容解析后从选区左上角填充 ----

/** 解析剪贴板为二维数组：优先 text/html 里的 <table>（Excel / 网页复制），否则按 TSV（\t 分列、\n 分行） */
function parseClipboardGrid(html: string, text: string): string[][] {
  if (html) {
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    const table = tpl.content.querySelector('table')
    if (table) {
      const out: string[][] = []
      table.querySelectorAll('tr').forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('td, th')).map((td) =>
          (td.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(),
        )
        if (cells.length) out.push(cells)
      })
      if (out.length) return out
    }
  }
  if (!text) return []
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => line.split('\t').map((v) => v.replace(/\n/g, ' ')))
}

/** 粘贴上限：与「添加行」一致，防止异常剪贴板撑爆表格 */
const PASTE_MAX_ROWS = 5000
const PASTE_MAX_COLS = 200

function onSheetPaste(e: ClipboardEvent) {
  const dt = e.clipboardData
  if (!dt) return
  const grid = parseClipboardGrid(dt.getData('text/html'), dt.getData('text/plain'))
  if (!grid.length) return
  // 单值粘贴进正在编辑的单元格：走 input 默认行为（追加到已有内容，@input 自动记录历史）
  if (grid.length === 1 && grid[0].length === 1 && (e.target as HTMLElement).tagName === 'INPUT') return
  e.preventDefault()
  // 起点：多选区域左上角，否则当前单元格
  const rect = rangeRect()
  const start = rect ? { r: rect.r1, c: rect.c1 } : activeCell.value
  const needRows = start.r + grid.length
  const needCols = Math.max(...grid.map((line) => start.c + line.length))
  pushHistory()
  // 超出现有网格的部分自动扩展行 / 列
  while (rows.value.length < Math.min(needRows, PASTE_MAX_ROWS)) rows.value.push([])
  for (const row of rows.value) {
    while (row.length < Math.min(needCols, PASTE_MAX_COLS)) row.push('')
  }
  grid.forEach((line, ri) => {
    const row = rows.value[start.r + ri]
    if (!row) return
    line.forEach((val, ci) => {
      row[start.c + ci] = val
    })
  })
  nextTick(computeFillerRows)
}
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
          :title="tr('删除工作表', 'Delete sheet')"
          @click.stop="removeSheet(i)"
        >×</span>
      </div>
      <button type="button" class="sheet-tab-add" :title="tr('新增工作表', 'Add sheet')" @click="addSheet">
        <PlusOutlined />
      </button>
    </div>

    <!-- 工具条：按飞书表格分组（第一行：通用 / 字体 / 对齐 / 数字 / 数据；第二行：文字样式与颜色） -->
    <!-- 工具条（参考飞书表格）：左侧单行按钮 | 中间两行分组 | 右侧单行按钮 -->
    <div class="sheet-ribbon">
      <button type="button" class="sheet-tool is-stack" @click="notImplemented('菜单', 'Menu')">
        <MenuOutlined /><span>{{ tr('菜单', 'Menu') }}</span>
      </button>
      <button type="button" class="sheet-tool is-stack" title="Undo" :disabled="!canUndo" @click="undo">
        <UndoOutlined /><span>{{ tr('撤销', 'Undo') }}</span>
      </button>
      <button type="button" class="sheet-tool is-stack" title="Redo" :disabled="!canRedo" @click="redo">
        <RedoOutlined /><span>{{ tr('重做', 'Redo') }}</span>
      </button>
      <button
        type="button"
        class="sheet-tool is-stack"
        :class="{ 'is-on': !!painter }"
        :title="tr('格式刷：先选中源单元格，再点击目标单元格', 'Format painter: pick a source cell, then click a target cell')"
        @click="togglePainter"
      >
        <FormatPainterOutlined /><span>{{ tr('格式刷', 'Painter') }}</span>
      </button>
      <button type="button" class="sheet-tool is-stack" :title="tr('清除当前单元格格式', 'Clear format of the selected cells')" @click="clearFormat">
        <ClearOutlined /><span>{{ tr('清除格式', 'Clear format') }}</span>
      </button>
      <span class="sheet-sep" />

      <!-- 字体 + 文字样式 -->
      <div class="sheet-block">
        <div class="sheet-line">
          <select class="sheet-select is-font" :title="tr('字体', 'Font')" :value="curStyle.font || ''" @change="onFontChange">
            <option v-for="f in FONT_OPTIONS" :key="f.en" :value="f.value">{{ tr(f.zh, f.en) }}</option>
          </select>
          <select class="sheet-select is-size" :title="tr('字号', 'Font size')" :value="curStyle.size || 14" @change="onSizeChange">
            <option v-for="s in SIZE_OPTIONS" :key="s" :value="s">{{ s }}</option>
          </select>
          <!-- 边框：鼠标悬停时展开选项 -->
          <div class="sheet-pop-wrap" @mouseenter="borderHover = true" @mouseleave="borderHover = false">
            <button type="button" class="sheet-tool is-icon is-caret" :title="tr('边框', 'Borders')">
              <svg class="sheet-tian" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="1.5" y="1.5" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" />
                <line x1="8" y1="1.5" x2="8" y2="14.5" stroke="currentColor" stroke-width="1.4" />
                <line x1="1.5" y1="8" x2="14.5" y2="8" stroke="currentColor" stroke-width="1.4" />
              </svg><DownOutlined class="sheet-caret" />
            </button>
            <div v-if="borderHover" class="sheet-pop sheet-pop-list">
              <button
                v-for="b in BORDER_OPTIONS"
                :key="b.en"
                type="button"
                class="sheet-pop-item"
                @click="notImplemented(b.zh, b.en)"
              >{{ tr(b.zh, b.en) }}</button>
            </div>
          </div>
        </div>
        <div class="sheet-line">
          <button type="button" class="sheet-tool is-icon" :title="tr('加粗', 'Bold')" :class="{ 'is-on': curStyle.bold }" @click="patchActiveStyle({ bold: !curStyle.bold })"><BoldOutlined /></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('删除线', 'Strikethrough')" :class="{ 'is-on': curStyle.strike }" @click="patchActiveStyle({ strike: !curStyle.strike })"><StrikethroughOutlined /></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('斜体', 'Italic')" :class="{ 'is-on': curStyle.italic }" @click="patchActiveStyle({ italic: !curStyle.italic })"><ItalicOutlined /></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('下划线', 'Underline')" :class="{ 'is-on': curStyle.underline }" @click="patchActiveStyle({ underline: !curStyle.underline })"><UnderlineOutlined /></button>
          <div class="sheet-pop-wrap">
            <button type="button" class="sheet-tool is-icon is-caret" :title="tr('文字颜色', 'Text color')" @click="colorMenu = colorMenu === 'text' ? null : 'text'">
              <span class="sheet-letter-a">A</span>
              <span class="sheet-color-bar" :style="{ background: curStyle.color || '#1f2329' }" />
              <DownOutlined class="sheet-caret" />
            </button>
            <div v-if="colorMenu === 'text'" class="sheet-pop">
              <div class="sheet-swatches">
                <button v-for="c in TEXT_COLORS" :key="c" type="button" class="sheet-swatch" :style="{ background: c }" @click="pickColor('text', c)" />
              </div>
              <button type="button" class="sheet-pop-clear" @click="pickColor('text', null)">{{ tr('默认颜色', 'Default color') }}</button>
            </div>
          </div>
          <div class="sheet-pop-wrap">
            <button type="button" class="sheet-tool is-icon is-caret" :title="tr('背景颜色', 'Background color')" @click="colorMenu = colorMenu === 'bg' ? null : 'bg'">
              <BgColorsOutlined />
              <span class="sheet-color-bar" :style="{ background: curStyle.bg || '#fff3bf' }" />
              <DownOutlined class="sheet-caret" />
            </button>
            <div v-if="colorMenu === 'bg'" class="sheet-pop">
              <div class="sheet-swatches">
                <button v-for="c in BG_COLORS" :key="c" type="button" class="sheet-swatch" :style="{ background: c }" @click="pickColor('bg', c)" />
              </div>
              <button type="button" class="sheet-pop-clear" @click="pickColor('bg', null)">{{ tr('无背景色', 'No background') }}</button>
            </div>
          </div>
        </div>
      </div>
      <span class="sheet-sep" />

      <!-- 对齐 + 合并 -->
      <div class="sheet-block">
        <div class="sheet-line">
          <button type="button" class="sheet-tool is-icon" :title="tr('垂直顶端对齐', 'Align top')" :class="{ 'is-on': curStyle.valign === 'top' }" @click="patchActiveStyle({ valign: 'top' })"><VerticalAlignTopOutlined /></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('垂直居中', 'Align middle')" :class="{ 'is-on': !curStyle.valign || curStyle.valign === 'middle' }" @click="patchActiveStyle({ valign: 'middle' })"><VerticalAlignMiddleOutlined /></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('垂直底端对齐', 'Align bottom')" :class="{ 'is-on': curStyle.valign === 'bottom' }" @click="patchActiveStyle({ valign: 'bottom' })"><VerticalAlignBottomOutlined /></button>
          <span class="sheet-sep" />
          <button type="button" class="sheet-tool is-icon" :title="tr('溢出', 'Overflow')" :class="{ 'is-on': curStyle.wrap === 'overflow' }" @click="patchActiveStyle({ wrap: 'overflow' })"><svg class="sheet-glyph" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.4" /><path d="M9.5 8h5M12.5 5.8 14.7 8l-2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('截断', 'Clip')" :class="{ 'is-on': !curStyle.wrap || curStyle.wrap === 'clip' }" @click="patchActiveStyle({ wrap: 'clip' })"><svg class="sheet-glyph" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4.5" width="13" height="7" fill="none" stroke="currentColor" stroke-width="1.4" /><line x1="9.5" y1="4.5" x2="9.5" y2="11.5" stroke="currentColor" stroke-width="1.4" stroke-dasharray="1.6 1.6" /></svg></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('自动换行', 'Wrap text')" :class="{ 'is-on': curStyle.wrap === 'wrap' }" @click="patchActiveStyle({ wrap: 'wrap' })"><svg class="sheet-glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4h13M1.5 8h10.5a2.5 2.5 0 0 1 0 5H8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /><path d="M10 11.2 8.3 13l1.7 1.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
        </div>
        <div class="sheet-line">
          <button type="button" class="sheet-tool is-icon" :title="tr('左对齐', 'Align left')" :class="{ 'is-on': curStyle.align === 'left' }" @click="patchActiveStyle({ align: 'left' })"><AlignLeftOutlined /></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('水平居中', 'Align center')" :class="{ 'is-on': curStyle.align === 'center' }" @click="patchActiveStyle({ align: 'center' })"><AlignCenterOutlined /></button>
          <button type="button" class="sheet-tool is-icon" :title="tr('右对齐', 'Align right')" :class="{ 'is-on': curStyle.align === 'right' }" @click="patchActiveStyle({ align: 'right' })"><AlignRightOutlined /></button>
          <button type="button" class="sheet-tool is-text" :title="tr('合并单元格', 'Merge cells')" @click="toggleMerge"><ColumnWidthOutlined /><span>{{ tr('合并单元格', 'Merge cells') }}</span></button>
        </div>
      </div>
      <span class="sheet-sep" />

      <!-- 数字格式 -->
      <div class="sheet-block">
        <div class="sheet-line">
          <select class="sheet-select is-format" :title="tr('数字格式', 'Number format')" :value="curStyle.format || 'general'" @change="onFormatChange">
            <option v-for="f in FORMAT_OPTIONS" :key="f.value" :value="f.value">{{ tr(f.zh, f.en) }}</option>
          </select>
        </div>
        <div class="sheet-line">
          <button type="button" class="sheet-tool is-icon" :title="tr('人民币格式', 'Currency format')" @click="setFormat('currency')">{{ tr('¥', '$') }}</button>
          <button type="button" class="sheet-tool is-icon" :title="tr('百分比格式', 'Percent format')" @click="setFormat('percent')">%</button>
          <button type="button" class="sheet-tool is-icon" :title="tr('增加小数位', 'Increase decimals')" @click="adjustDecimals(1)">.00</button>
          <button type="button" class="sheet-tool is-icon" :title="tr('减少小数位', 'Decrease decimals')" @click="adjustDecimals(-1)">.0</button>
        </div>
      </div>
      <span class="sheet-sep" />

      <!-- 右侧：数据工具（单行，图标在上文字在下） -->
      <button type="button" class="sheet-tool is-stack" :class="{ 'is-on': !!curSheet().frozenHeader }" :title="tr('冻结首行', 'Freeze first row')" @click="toggleFreeze">
        <PushpinOutlined /><span>{{ tr('冻结', 'Freeze') }}</span>
      </button>
      <!-- 筛选：点击展开，输入关键词筛选当前列 -->
      <div class="sheet-pop-wrap">
        <button
          type="button"
          class="sheet-tool is-stack"
          :class="{ 'is-on': !!curSheet().filter }"
          :title="tr('筛选', 'Filter')"
          @click="toggleFilterPanel"
        >
          <FilterOutlined /><span>{{ tr('筛选', 'Filter') }}</span>
        </button>
        <div v-if="filterOpen" class="sheet-pop sheet-filter-pop">
          <div class="sheet-filter-title">{{ tr('筛选列', 'Filter column') }} {{ colName(filterCol) }}</div>
          <input
            class="sheet-filter-input"
            :value="curSheet().filter && curSheet().filter!.c === filterCol ? curSheet().filter!.keyword : ''"
            :placeholder="tr('输入关键词', 'Enter a keyword')"
            @input="setFilterKeyword"
          />
          <button type="button" class="sheet-pop-clear" @click="clearFilter">{{ tr('清除筛选', 'Clear filter') }}</button>
        </div>
      </div>
      <!-- 排序：鼠标悬停展开升序 / 降序 -->
      <div class="sheet-pop-wrap" @mouseenter="sortHover = true" @mouseleave="sortHover = false">
        <button type="button" class="sheet-tool is-stack" :title="tr('按当前列排序', 'Sort the column')">
          <SortAscendingOutlined /><span>{{ tr('排序', 'Sort') }}</span>
        </button>
        <div v-if="sortHover" class="sheet-pop sheet-pop-list">
          <button type="button" class="sheet-pop-item" @click="sortHover = false; sortByActiveColumn('asc')">{{ tr('升序 A–Z', 'Ascending A–Z') }}</button>
          <button type="button" class="sheet-pop-item" @click="sortHover = false; sortByActiveColumn('desc')">{{ tr('降序 Z–A', 'Descending Z–A') }}</button>
        </div>
      </div>
      <button type="button" class="sheet-tool is-stack" :title="tr('条件格式', 'Conditional format')" @click="notImplemented('条件格式', 'Conditional format')">
        <BlockOutlined /><span>{{ tr('条件格式', 'Conditional') }}</span>
      </button>
      <button type="button" class="sheet-tool is-stack" :title="tr('下拉列表', 'Dropdown list')" @click="notImplemented('下拉列表', 'Dropdown list')">
        <UnorderedListOutlined /><span>{{ tr('下拉列表', 'Dropdown') }}</span>
      </button>
      <button type="button" class="sheet-tool is-stack" :title="tr('更多', 'More')" @click="notImplemented('更多', 'More')">
        <MoreOutlined /><span>{{ tr('更多', 'More') }}</span>
      </button>
      <button type="button" class="sheet-tool is-stack" :title="tr('查找和替换', 'Find and replace')" @click="notImplemented('查找和替换', 'Find and replace')">
        <SearchOutlined /><span>{{ tr('查找替换', 'Find') }}</span>
      </button>
      <button type="button" class="sheet-tool is-stack" :title="tr('评论', 'Comment')" @click="notImplemented('评论', 'Comment')">
        <MessageOutlined /><span>{{ tr('评论', 'Comment') }}</span>
      </button>
    </div>

    <!-- 公式栏：左侧单元格地址，右侧当前单元格内容（可直接编辑） -->
    <div class="sheet-formula">
      <span class="sheet-address">{{ cellAddress }}</span>
      <span class="sheet-fx">fx</span>
      <input class="sheet-formula-input" :value="activeValue" :placeholder="tr('在此输入内容', 'Enter a value')" @input="setActiveValue" />
    </div>

    <!-- 表格：监听粘贴（单元格 input 聚焦或选中区域内粘贴均可） -->
    <div ref="scrollRef" class="sheet-scroll" @paste="onSheetPaste">
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
              :title="tr('点击选中整列', 'Click to select the column')"
              @mousedown.prevent="selectCol(i - 1)"
            >{{ colName(i - 1) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="{ row, ri } in visibleRows" :key="ri">
            <th
              class="sheet-row-no"
              :class="{ active: activeCell.r === ri && selMode !== 'col', 'is-sel': selMode === 'row' && activeCell.r === ri }"
              :title="tr('点击选中整行', 'Click to select the row')"
              @mousedown.prevent="selectRow(ri)"
            >{{ ri + 1 }}</th>
            <template v-for="ci in colCount" :key="ci">
            <td
              v-if="!cellHidden(ri, ci - 1)"
              :rowspan="cellSpan(ri, ci - 1).rowspan"
              :colspan="cellSpan(ri, ci - 1).colspan"
              class="sheet-cell"
              :class="{
                active: activeCell.r === ri && activeCell.c === ci - 1 && selMode === 'cell',
                'in-range': isInSelection(ri, ci - 1),
                'is-painting': !!painter,
              }"
              :style="cellCss(styleAt(ri, ci - 1))"
              @mousedown="onCellMouseDown($event, ri, ci - 1)"
              @mouseenter="onCellMouseEnter(ri, ci - 1)"
            >
              <input
                v-if="activeCell.r === ri && activeCell.c === ci - 1"
                ref="activeInput"
                :value="row[ci - 1] || ''"
                class="sheet-input"
                :style="textCss(styleAt(ri, ci - 1))"
                @input="setCellValue(row, ci - 1, $event)"
              />
              <div v-else class="sheet-text" :style="{ ...textCss(styleAt(ri, ci - 1)), ...wrapCss(styleAt(ri, ci - 1)) }">{{ formatCell(row[ci - 1] || '', styleAt(ri, ci - 1)) }}</div>
            </td>
            </template>
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
                <button type="button" class="sheet-add-btn" @click="addRows"><PlusOutlined />{{ tr('添加', 'Add') }}</button>
                <input v-model.number="addRowCount" type="number" min="1" max="5000" class="sheet-add-input" @keydown.enter="addRows" />
                <span>{{ tr('行', 'rows') }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 底部状态条：表格规模 -->
    <div class="sheet-statusbar">
      <span>{{ rows.length }} {{ tr('行', 'rows') }} × {{ colCount }} {{ tr('列', 'columns') }}</span>
      <span v-if="curSheet().filter" class="sheet-status-filter">· {{ tr('已筛选', 'Filtered') }} {{ visibleRows.length }}/{{ rows.length }}</span>
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
/* 工具条：单排横向，中间分组为上下两行（参考飞书表格） */
.sheet-ribbon {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  flex: none;
  height: 84px;
  padding: 0 10px;
  background: #f5f6f8;
  border-bottom: 1px solid var(--docs-border);
}
.sheet-ribbon > * {
  flex: none;
}
/* 两行分组：每行 36px */
.sheet-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  height: 76px;
}
.sheet-line {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 34px;
}
.sheet-tool.is-text {
  height: 28px;
  padding: 0 6px;
  font-size: 12px;
  color: #4b5563;
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
  margin: 0 3px;
  background: var(--docs-border);
}
.sheet-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 30px;
  min-width: 26px;
  padding: 0 4px;
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
/* 工具栏选中（已开启）的按钮：深蓝底 + 白色图标 */
.sheet-tool.is-on {
  color: var(--docs-selected-fg);
  background: var(--docs-selected);
}
.sheet-tool.is-on:hover:not(:disabled) {
  color: var(--docs-selected-fg);
  background: #d6e4ff;
}
.sheet-tool.danger:hover:not(:disabled) {
  color: var(--docs-danger);
}
/* 上方图标 + 下方文字 */
.sheet-tool.is-stack {
  flex-direction: column;
  gap: 2px;
  min-width: 40px;
  height: 42px;
  font-size: 12px;
  color: #4b5563;
}
.sheet-tool.is-stack .anticon {
  font-size: 17px;
}
/* 纯图标按钮：28px 高，与下拉框同高，同一行内上下居中对齐 */
.sheet-tool.is-icon {
  font-size: 15px;
  height: 28px;
}
.sheet-tool.is-icon.is-caret {
  min-width: 40px;
}
.sheet-tool .anticon {
  font-size: 15px;
}
/* 自绘图标（田字 / 溢出 / 截断 / 自动换行）：16px，线色跟随按钮文字色 */
.sheet-tool .sheet-tian,
.sheet-tool .sheet-glyph {
  width: 16px;
  height: 16px;
  display: block;
}
/* 下拉箭头：与字号下拉框的箭头大小接近（需高于 .sheet-tool .anticon 的 15px） */
.sheet-tool .anticon.sheet-caret {
  font-size: 9px;
  margin-left: 1px;
  opacity: 0.6;
}
/* 颜色横线：位于图标下方，显示当前字体颜色 / 背景颜色 */
.sheet-color-bar {
  position: absolute;
  left: 7px;
  right: 14px;
  bottom: 2px;
  height: 3px;
  border-radius: 1px;
}
/* 字体颜色按钮的「A」字母 */
.sheet-letter-a {
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  font-family: Georgia, 'Times New Roman', serif;
}
/* 带颜色条的按钮：不额外加内边距，图标与同行按钮保持同一高度 */
.sheet-tool.is-caret {
  position: relative;
}
.sheet-select {
  height: 28px;
  padding: 0 6px;
  font-family: inherit;
  font-size: 13px;
  color: #374151;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius-sm);
  outline: none;
  cursor: pointer;
}
/* 展开后的选项列表：白底 */
.sheet-select option {
  background: #ffffff;
  color: #374151;
}
.sheet-select:hover,
.sheet-select:focus {
  background: var(--docs-hover);
}
.sheet-select.is-size {
  width: 50px;
}
/* 字体 / 字号纵向两行，高度与 is-stack 按钮（42px）一致 */
.sheet-font-stack {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  height: 42px;
  flex: none;
}
.sheet-font-stack .sheet-select {
  height: 19px;
  padding: 0 4px;
  font-size: 12px;
}
.sheet-select.is-font {
  width: 100px;
}
.sheet-font-stack .sheet-select.is-size {
  width: 124px;
}
/* 数字格式：宽度与下一行（¥ % .00 .0）等宽，右边对齐到「减少小数位」 */
.sheet-line .sheet-select.is-format {
  width: 100%;
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
.sheet-pop-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 140px;
  padding: 6px;
}
.sheet-pop-item {
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  text-align: left;
  color: var(--docs-text);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
}
.sheet-pop-item:hover {
  background: var(--docs-hover);
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
  background: color-mix(in srgb, var(--c-primary) 18%, var(--docs-canvas));
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

.sheet-status-filter {
  margin-left: 6px;
  color: var(--c-primary);
}

/* ---- 筛选面板 ---- */
.sheet-filter-pop {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 220px;
  padding: 10px;
}
.sheet-filter-title {
  font-size: 12px;
  color: var(--docs-text-3);
}
.sheet-filter-input {
  height: 30px;
  padding: 0 8px;
  font-family: inherit;
  font-size: 13px;
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
