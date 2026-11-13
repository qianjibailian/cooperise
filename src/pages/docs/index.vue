<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  DeleteOutlined,
  FolderFilled,
  FolderOpenFilled,
  RightOutlined,
  DownOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  ClearOutlined,
  CheckSquareOutlined,
  PictureOutlined,
  PaperClipOutlined,
  TableOutlined,
  LayoutOutlined,
  BgColorsOutlined,
  LinkOutlined,
  CodeOutlined,
  MinusOutlined,
  DownloadOutlined,
  StarOutlined,
  StarFilled,
  HomeOutlined,
  BookOutlined,
  AppstoreOutlined,
  SortAscendingOutlined,
  UploadOutlined,
  ColumnWidthOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HolderOutlined,
  AlignLeftOutlined,
  FontColorsOutlined,
  ScissorOutlined,
  CopyOutlined,
  CommentOutlined,
  TranslationOutlined,
  ShareAltOutlined,
  FileAddOutlined,
  SnippetsOutlined,
  PlusSquareOutlined,
} from '@ant-design/icons-vue'
import { getLoginUsername, useAuth } from '@/utils/auth'
import type { DocType, DocFolder, DocItem, MindNode, SheetData, MindmapData, FlowData } from '@/types/docs'
import DocSheetEditor from '@/components/docs/DocSheetEditor.vue'
import DocMindmapEditor from '@/components/docs/DocMindmapEditor.vue'
import DocFlowEditor from '@/components/docs/DocFlowEditor.vue'
import DocTypeIcon from '@/components/docs/DocTypeIcon.vue'
import AppLogo from '@/components/AppLogo.vue'
import { isDesktop } from '@/utils/desktop'
import { docsSideCollapsed, docsEditMode, docsActiveDoc, docsSaveState, docsTitleRev } from '@/utils/docs-layout'
import { openDocSharePanel } from '@/utils/doc-share'
import {
  createDoc as createDocApi,
  createDocFolder,
  deleteDocFolder,
  emptyTrash as emptyTrashApi,
  listDocFolders,
  listDocs as listDocsApi,
  listTrashDocs,
  moveDoc as moveDocApi,
  purgeDoc as purgeDocApi,
  renameDocFolder,
  restoreDoc as restoreDocApi,
  saveDocContent,
  starDoc as starDocApi,
  starDocFolder,
  trashDoc as trashDocApi,
} from '@/api/docs'

/**
 * 文档（后端接口版）
 * 数据全部来自 src/api/docs.ts 定义的文档系统接口：
 * 列表 / 回收站走查询接口，编辑内容 400ms 防抖走 PUT /docs/{id}/content，
 * 新建 / 重命名 / 移动 / 收藏 / 删除等写操作均等接口成功后再更新本地状态。
 */

const folders = ref<DocFolder[]>([])
const docs = ref<DocItem[]>([])
/** 回收站 */
const trash = ref<DocItem[]>([])
const activeId = ref('')
const keyword = ref('')
const saved = ref(true)
const editorRef = ref<HTMLElement | null>(null)
const searchRef = ref<any>(null)
const route = useRoute()
const router = useRouter()
/** 列表页排序 */
const sortBy = ref<'updated' | 'created' | 'title'>('updated')
const SORT_OPTIONS = [
  { value: 'updated', label: '最近更新' },
  { value: 'created', label: '创建时间' },
  { value: 'title', label: '标题' },
]
/** 列表 / 网格视图 */
const listView = ref<'list' | 'grid'>('list')

const { user: authUser } = useAuth()
const ownerName = computed(() => {
  const raw = authUser.value?.realName || authUser.value?.coAccount || getLoginUsername() || ''
  return toDisplayName(raw) || '-'
})
/** 当前新建文档默认归属的文件夹（点击文件夹标题时更新） */
const activeFolderId = ref('')
/** 文件夹展开状态 */
const expanded = reactive<Record<string, boolean>>({})

const activeDoc = computed(() => docs.value.find((d) => d.id === activeId.value) || null)
// 同步当前文档给顶栏（分享 / 编辑按钮使用）
watch(activeDoc, (d) => { docsActiveDoc.value = d }, { immediate: true })
// 顶栏文件名改名：v-model 已同步到同一对象，这里只需触发刷新时间 + 防抖保存
watch(docsTitleRev, () => { if (activeDoc.value) onDocChanged(activeDoc.value) })

/** 语雀式大纲：解析正文 h2 / h3 */
interface OutlineItem {
  id: string
  text: string
  level: number
}
const outline = ref<OutlineItem[]>([])

/** 宽屏 / 专注模式 */
const wideMode = ref(false)
const focusMode = ref(false)



function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 左侧导航：主页 / 知识库 / 收藏 */
const navMode = ref<'recent' | 'owned' | 'shared' | 'starred' | 'library' | 'trash'>('recent')

/** 分组数据：搜索时平铺；收藏模式只列星标；否则未分组 + 各文件夹（空文件夹也展示） */
const groups = computed<{ folder: DocFolder | null; docs: DocItem[]; flat?: boolean }[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  const match = (d: DocItem) =>
    !kw || d.title.toLowerCase().includes(kw) || stripHtml(d.content).toLowerCase().includes(kw)
  const visible = docs.value.filter(match)
  if (navMode.value === 'starred') {
    return [{ folder: null, docs: visible.filter((d) => d.starred), flat: true }]
  }
  if (kw) return [{ folder: null, docs: visible, flat: true }]

  const folderIds = new Set(folders.value.map((f) => f.id))
  const result: { folder: DocFolder | null; docs: DocItem[] }[] = []
  const ungrouped = visible.filter((d) => !d.folderId || !folderIds.has(d.folderId))
  if (ungrouped.length) result.push({ folder: null, docs: ungrouped })
  for (const f of folders.value) {
    result.push({ folder: f, docs: visible.filter((d) => d.folderId === f.id) })
  }
  return result
})

// ---- 文档类型 / 数据兜底 ----
const DOC_TYPE_TITLE: Record<DocType, string> = {
  doc: '无标题文档',
  sheet: '无标题表格',
  mindmap: '无标题思维导图',
  flow: '无标题流程图',
}

function genDocId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function defaultSheet(): SheetData {
  return { rows: Array.from({ length: 8 }, () => Array(5).fill('')) }
}

function defaultMindmap(): MindmapData {
  return { root: { id: genDocId('root'), text: '中心主题', children: [] } }
}

/** 补齐各类型需要的数据，兼容历史 / 异常数据 */
function ensureDocData(doc: DocItem) {
  if (doc.type === 'sheet' && !(doc.data as SheetData | undefined)?.rows) {
    doc.data = defaultSheet()
  } else if (doc.type === 'mindmap' && !(doc.data as MindmapData | undefined)?.root) {
    doc.data = defaultMindmap()
  } else if (doc.type === 'flow' && !doc.data) {
    doc.data = { graph: null }
  }
}

function normalizeDoc(d: any): DocItem {
  const type: DocType = ['doc', 'sheet', 'mindmap', 'flow'].includes(d.type) ? d.type : 'doc'
  // 后端可能把表格 / 脑图 / 流程图 data 存成 JSON 字符串，这里统一反序列化
  let data: unknown = d.data
  if (typeof data === 'string' && data) {
    try {
      data = JSON.parse(data)
    } catch {
      data = undefined
    }
  }
  const doc: DocItem = {
    id: String(d.id),
    title: String(d.title || DOC_TYPE_TITLE[type]),
    type,
    content: String(d.content || ''),
    updatedAt: Number(d.updatedAt) || Date.now(),
    createdAt: Number(d.createdAt) || Number(d.updatedAt) || Date.now(),
    folderId: d.folderId ? String(d.folderId) : undefined,
    author: d.author ? String(d.author) : undefined,
    data: (data && typeof data === 'object' ? data : undefined) as SheetData | MindmapData | FlowData | undefined,
    starred: !!d.starred,
  }
  ensureDocData(doc)
  return doc
}

function normalizeFolder(f: any): DocFolder {
  return {
    id: String(f.id),
    name: String(f.name || '未命名文件夹'),
    createdAt: Number(f.createdAt) || Date.now(),
    starred: !!f.starred,
  }
}


// ---- 数据加载（后端接口） ----
const loading = ref(false)
/** 按登录用户区分数据归属（后端从 token 解析身份，这里只用于切换账号时重新拉取） */
const ownerKey = computed(() => getLoginUsername() || 'anonymous')

/** 拉取文件夹 / 文档 / 回收站列表 */
async function loadDocs() {
  loading.value = true
  try {
    const [fRes, dRes, tRes] = await Promise.all([listDocFolders(), listDocsApi(), listTrashDocs()])
    if (fRes.success) folders.value = (fRes.data || []).map(normalizeFolder)
    if (dRes.success) docs.value = (dRes.data || []).map(normalizeDoc)
    if (tRes.success) trash.value = (tRes.data || []).map(normalizeDoc)
    // 默认展开全部文件夹
    for (const f of folders.value) expanded[f.id] = expanded[f.id] ?? true
    // 从 URL 恢复当前文档；没有则停留在列表页
    const target = String(route.query.doc || '')
    activeId.value = target && docs.value.some((d) => d.id === target) ? target : ''
  } catch {
    // 失败提示由 request 拦截器统一展示；保留现有数据
  } finally {
    loading.value = false
  }
}

/** 切换登录用户时重新拉取 */
watch(ownerKey, loadDocs, { immediate: true })

// ---- 内容自动保存（400ms 防抖 PUT /docs/{id}/content） ----
let saveTimer: ReturnType<typeof setTimeout> | undefined
/** 防抖期间记录待保存的文档：避免落库前切换文档导致存错对象 */
let pendingDoc: DocItem | null = null

function scheduleSave() {
  pendingDoc = activeDoc.value
  saved.value = false
  docsSaveState.value = 'saving'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSave, 400)
}

async function flushSave() {
  const doc = pendingDoc
  pendingDoc = null
  if (!doc) return
  try {
    const res = await saveDocContent(doc.id, { title: doc.title, content: doc.content, data: doc.data })
    if (res.success && res.data?.updatedAt) doc.updatedAt = res.data.updatedAt
    saved.value = true
    docsSaveState.value = 'saved'
  } catch {
    // 保存失败保持「未保存」状态，下次修改会再次尝试
    docsSaveState.value = 'unsaved'
  }
}

/** 文档内容 / 标题 / 表格脑图数据变化：刷新时间 + 防抖落库 */
function onDocChanged(doc: DocItem) {
  touch(doc)
  scheduleSave()
}

/** 语雀式快捷键：⌘K / Ctrl+K 聚焦搜索 */
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchRef.value?.focus?.()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  if (!saved.value) flushSave()
})

// ---- 文档操作 ----
function createDoc(type: DocType = 'doc', folderId?: string) {
  const data: SheetData | MindmapData | FlowData | undefined =
    type === 'sheet' ? defaultSheet()
      : type === 'mindmap' ? defaultMindmap()
        : type === 'flow' ? { graph: null }
          : undefined
  createDocApi({ title: DOC_TYPE_TITLE[type], type, folderId: folderId || undefined, data })
    .then((res) => {
      if (!res.success || !res.data) return
      const doc = normalizeDoc(res.data)
      docs.value.unshift(doc)
      selectDoc(doc)
      if (folderId) expanded[folderId] = true
      if (type === 'doc') nextTick(() => editorRef.value?.focus())
    })
    .catch(() => {})
}

// ---- 各类型数据 / 展示 ----
function sheetRows(doc: DocItem): string[][] {
  ensureDocData(doc)
  return (doc.data as SheetData).rows
}

function mindRoot(doc: DocItem): MindNode {
  ensureDocData(doc)
  return (doc.data as MindmapData).root
}

function flowGraph(doc: DocItem): any | null {
  return (doc.data as FlowData | undefined)?.graph ?? null
}

function onFlowChange(doc: DocItem, graph: any) {
  doc.data = { graph }
  touch(doc)
  scheduleSave()
}

// ---- 导出（兼容格式） ----
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportWord(doc: DocItem) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title></head><body>${doc.content}</body></html>`
  download(`${doc.title || '文档'}.doc`, html, 'application/msword')
}

function exportExcel(doc: DocItem) {
  const rows = sheetRows(doc)
  const table = `<table border="1" cellspacing="0">${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</table>`
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${table}</body></html>`
  download(`${doc.title || '表格'}.xls`, html, 'application/vnd.ms-excel')
}

function exportMindmap(doc: DocItem) {
  const nodeXml = (n: MindNode): string => `<node TEXT="${escapeAttr(n.text)}">${n.children.map(nodeXml).join('')}</node>`
  const xml = `<?xml version="1.0" encoding="UTF-8"?><map version="1.0.1">${nodeXml(mindRoot(doc))}</map>`
  download(`${doc.title || '思维导图'}.mm`, xml, 'application/xml')
}

function exportFlow(doc: DocItem) {
  const graph = flowGraph(doc) ?? { nodes: [], edges: [] }
  download(`${doc.title || '流程图'}.json`, JSON.stringify(graph, null, 2), 'application/json')
}

function onExport(e: { key?: string | number }) {
  const doc = activeDoc.value
  if (!doc) return
  const key = String(e?.key ?? '')
  if (key === 'word') exportWord(doc)
  else if (key === 'excel') exportExcel(doc)
  else if (key === 'xmind') exportMindmap(doc)
  else if (key === 'flow-json') exportFlow(doc)
}

/** 新建并写入标题 / 内容（上传文件、模板库共用） */
function createDocWithContent(type: DocType, title: string, content: string) {
  createDocApi({ type, title, content })
    .then((res) => {
      if (!res.success || !res.data) return
      const doc = normalizeDoc(res.data)
      docs.value.unshift(doc)
      selectDoc(doc)
      if (type === 'doc') {
        nextTick(() => {
          if (editorRef.value) {
            editorRef.value.innerHTML = content
            normalizeTodoOrder(editorRef.value)
          }
          refreshOutline()
        })
      }
    })
    .catch(() => {})
}

/** 上传本地文件：读取为文档 */
const uploadInput = ref<HTMLInputElement | null>(null)
const uploadAccept = ref('.md,.markdown')

function pickUploadFile(kind = 'md') {
  uploadAccept.value = kind === 'html' ? '.html,.htm' : kind === 'txt' ? '.txt' : '.md,.markdown'
  nextTick(() => uploadInput.value?.click())
}

function onUploadMenu(e: { key?: string | number }) {
  pickUploadFile(String(e?.key ?? 'md'))
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result || '')
    const isHtml = /\.html?$/i.test(file.name) || file.type.includes('html')
    const content = isHtml
      ? text
      : `<p>${escapeHtml(text).replace(/\r?\n/g, '</p><p>')}</p>`
    createDocWithContent('doc', file.name.replace(/\.[^.]+$/, '') || '上传的文档', content)
    message.success('文件已导入为文档')
  }
  reader.readAsText(file)
  input.value = ''
}

/** 模板库 */
const DOC_TEMPLATES: Record<string, { title: string; content: string }> = {
  meeting: {
    title: '会议纪要',
    content: '<h2>会议主题</h2><p></p><h2>参会人</h2><ul><li></li></ul><h2>结论</h2><ul><li></li></ul><h2>待办</h2><ul><li></li></ul>',
  },
  weekly: {
    title: '周报',
    content: '<h2>本周完成</h2><ul><li></li></ul><h2>下周计划</h2><ul><li></li></ul><h2>风险与需要的支持</h2><p></p>',
  },
  prd: {
    title: '产品需求文档',
    content: '<h2>背景</h2><p></p><h2>目标</h2><ul><li></li></ul><h2>方案</h2><p></p><h2>验收标准</h2><ul><li></li></ul>',
  },
}

function onTemplateMenu(e: { key?: string | number }) {
  const tpl = DOC_TEMPLATES[String(e?.key ?? '')]
  if (!tpl) return
  createDocWithContent('doc', tpl.title, tpl.content)
}

function selectDoc(doc: DocItem) {
  activeId.value = doc.id
  router.replace({ query: { ...route.query, doc: doc.id } })
}

/** 主内容区的文档：在新页面 / 页签中打开 */
function openDocInNewPage(doc: DocItem) {
  const href = router.resolve({ path: '/docs', query: { doc: doc.id } }).href
  if (isDesktop) {
    // 客户端：由 DesktopTabBar 按完整路径新开页签
    router.push(href)
  } else {
    window.open(href, '_blank')
  }
}

/** 返回文档列表 */
function backToList() {
  activeId.value = ''
  const query = { ...route.query }
  delete query.doc
  router.replace({ query })
}

/** 切换左侧导航：全部 / 收藏 */
function switchNav(mode: 'recent' | 'owned' | 'shared' | 'starred' | 'library' | 'trash') {
  navMode.value = mode
  if (mode === 'recent' || mode === 'owned' || mode === 'shared') activeFolderId.value = ''
  backToList()
}

// 浏览器前进 / 后退时同步当前文档
watch(
  () => route.query.doc,
  (id) => {
    const code = String(id || '')
    activeId.value = code && docs.value.some((d) => d.id === code) ? code : ''
  },
)

/** 置顶文档 / 置顶知识库 */
const pinnedDocs = computed(() =>
  docs.value.filter((d) => d.starred).sort((a, b) => b.updatedAt - a.updatedAt),
)
const pinnedFolders = computed(() => folders.value.filter((f) => f.starred))

function docsOfFolder(folder: DocFolder): number {
  return docs.value.filter((d) => d.folderId === folder.id).length
}

/** 从知识库视图打开某个知识库（文件夹） */
function openLibrary(folder: DocFolder) {
  activeFolderId.value = folder.id
  navMode.value = 'recent'
  backToList()
}

/** 列表首页数据：搜索 + 收藏筛选 + 当前文件夹过滤 + 排序 */
const listDocs = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let list = docs.value
  if (navMode.value === 'starred') list = list.filter((d) => d.starred)
  else if (navMode.value === 'shared' || navMode.value === 'library') list = []
  if (activeFolderId.value) list = list.filter((d) => d.folderId === activeFolderId.value)
  const matched = list.filter((d) => {
    if (!kw) return true
    return d.title.toLowerCase().includes(kw) || stripHtml(d.content).toLowerCase().includes(kw)
  })
  const sorted = [...matched]
  if (sortBy.value === 'updated') sorted.sort((a, b) => b.updatedAt - a.updatedAt)
  else if (sortBy.value === 'created') sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  else sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  return sorted
})

function formatDate(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 详情页顶栏 / 作者行使用的中文长日期，如 2025年11月26日 */
function formatLongDate(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 邮箱转显示名：取 @ 前的部分并首字母大写，非邮箱原样返回 */
function toDisplayName(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''
  if (s.includes('@')) {
    const local = s.split('@')[0]
    return local.charAt(0).toUpperCase() + local.slice(1)
  }
  return s
}

/** 文档作者展示名：优先创建人姓名，邮箱降级为本地名，不展示完整邮箱 */
const docAuthor = computed(() => {
  const raw = activeDoc.value?.author || authUser.value?.realName || getLoginUsername() || ''
  return toDisplayName(raw) || '匿名'
})
const AVATAR_COLORS = ['#3370ff', '#00b96b', '#d4a72c', '#f5222d', '#722ed1', '#13c2c2']
const docAvatarStyle = computed(() => {
  const name = docAuthor.value || ''
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return { background: AVATAR_COLORS[h % AVATAR_COLORS.length] }
})

/** 最近访问：今天 / 昨天显示时间，更早显示日期 */
function formatSmartTime(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return `今天 ${time}`
  const yesterday = new Date(now.getTime() - 86_400_000)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${time}`
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function touch(doc: DocItem) {
  doc.updatedAt = Date.now()
}

function selectFolder(folder: DocFolder) {
  activeFolderId.value = folder.id
  expanded[folder.id] = !expanded[folder.id]
}

function confirmDelete(doc: DocItem) {
  Modal.confirm({
    title: '移到回收站',
    content: `确定将「${doc.title || '无标题文档'}」移到回收站？`,
    okText: '移到回收站',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await trashDocApi(doc.id)
        if (!res.success) return
        docs.value = docs.value.filter((d) => d.id !== doc.id)
        trash.value.unshift({ ...doc, deletedAt: Date.now() } as DocItem)
        if (activeId.value === doc.id) backToList()
      } catch {}
    },
  })
}

/** 从回收站恢复 */
async function restoreDoc(doc: DocItem) {
  try {
    const res = await restoreDocApi(doc.id)
    if (!res.success) return
    trash.value = trash.value.filter((d) => d.id !== doc.id)
    docs.value.unshift(doc)
  } catch {}
}

/** 彻底删除 */
function purgeDoc(doc: DocItem) {
  Modal.confirm({
    title: '彻底删除',
    content: `确定彻底删除「${doc.title || '无标题文档'}」？删除后不可恢复。`,
    okText: '彻底删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await purgeDocApi(doc.id)
        if (!res.success) return
        trash.value = trash.value.filter((d) => d.id !== doc.id)
      } catch {}
    },
  })
}

/** 清空回收站 */
function emptyTrash() {
  if (!trash.value.length) return
  Modal.confirm({
    title: '清空回收站',
    content: `确定清空回收站中的 ${trash.value.length} 篇文档？清空后不可恢复。`,
    okText: '清空',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await emptyTrashApi()
        if (!res.success) return
        trash.value = []
      } catch {}
    },
  })
}

async function moveDoc(doc: DocItem, folderId: string) {
  const target = folderId === 'none' ? undefined : folderId
  try {
    const res = await moveDocApi({ id: doc.id, folderId: target || null })
    if (!res.success) return
    doc.folderId = target
    doc.updatedAt = res.data?.updatedAt || doc.updatedAt
    if (doc.folderId) expanded[doc.folderId] = true
  } catch {}
}

function onDocMenu(e: { key?: string | number }, doc: DocItem) {
  const key = String(e?.key ?? '')
  if (key === 'delete') confirmDelete(doc)
  else if (key === 'star') toggleStar(doc)
  else if (key.startsWith('move:')) moveDoc(doc, key.slice(5))
}

// ---- 文件夹操作 ----
const folderModalOpen = ref(false)
const folderForm = reactive({ id: '', name: '' })

function openCreateFolder() {
  folderForm.id = ''
  folderForm.name = ''
  folderModalOpen.value = true
}

function openRenameFolder(folder: DocFolder) {
  folderForm.id = folder.id
  folderForm.name = folder.name
  folderModalOpen.value = true
}

function submitFolder() {
  const name = folderForm.name.trim()
  if (!name) {
    message.warning('请输入文件夹名称')
    return
  }
  if (folderForm.id) {
    renameDocFolder({ id: folderForm.id, name })
      .then((res) => {
        if (!res.success) return
        const f = folders.value.find((x) => x.id === folderForm.id)
        if (f) f.name = name
        folderModalOpen.value = false
      })
      .catch(() => {})
  } else {
    createDocFolder({ name })
      .then((res) => {
        if (!res.success || !res.data) return
        const folder = normalizeFolder(res.data)
        folders.value.push(folder)
        expanded[folder.id] = true
        activeFolderId.value = folder.id
        folderModalOpen.value = false
      })
      .catch(() => {})
  }
}

function deleteFolder(folder: DocFolder) {
  Modal.confirm({
    title: `删除文件夹「${folder.name}」`,
    content: '文件夹内的文档会移到未分组，不会删除文档。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await deleteDocFolder(folder.id)
        if (!res.success) return
        // 文件夹内文档移到未分组（后端同步把 folderId 置空）
        docs.value.forEach((d) => {
          if (d.folderId === folder.id) d.folderId = undefined
        })
        folders.value = folders.value.filter((f) => f.id !== folder.id)
        if (activeFolderId.value === folder.id) activeFolderId.value = ''
      } catch {}
    },
  })
}

function onFolderMenu(e: { key?: string | number }, folder: DocFolder) {
  const key = String(e?.key ?? '')
  if (key === 'star') {
    const next = !folder.starred
    starDocFolder({ id: folder.id, starred: next })
      .then((res) => {
        if (res.success) folder.starred = next
      })
      .catch(() => {})
  } else if (key === 'rename') openRenameFolder(folder)
  else if (key === 'delete') deleteFolder(folder)
}

function onAddMenu(e: { key?: string | number }) {
  const key = String(e?.key ?? '')
  if (key === 'folder') openCreateFolder()
  else if (['doc', 'sheet', 'mindmap', 'flow'].includes(key)) {
    createDoc(key as DocType, activeFolderId.value || undefined)
  }
}

// ---- 编辑器 ----
/** 解析正文 h1 / h2 / h3 生成右侧大纲 */
function refreshOutline() {
  if (!editorRef.value || activeDoc.value?.type !== 'doc') {
    outline.value = []
    return
  }
  const nodes = Array.from(editorRef.value.querySelectorAll<HTMLElement>('h1, h2, h3'))
  outline.value = nodes.map((el, i) => {
    const id = `doc-h-${i}`
    el.id = id
    return {
      id,
      text: (el.textContent || '').trim() || `标题 ${i + 1}`,
      level: Number(el.tagName.slice(1)) || 2,
    }
  })
}

function scrollToHeading(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(activeDoc, (doc) => {
  nextTick(() => {
    if (doc?.type === 'doc' && editorRef.value) {
      editorRef.value.innerHTML = doc.content || ''
      normalizeTodoOrder(editorRef.value)
      refreshOutline()
      refreshEmptyState()
    } else {
      outline.value = []
      editorEmpty.value = false
    }
  })
}, { immediate: true })

/** 编辑器是否为空（无文字，最多残留一个 br） */
function isEditorEmpty(ed: HTMLElement): boolean {
  return !ed.textContent?.trim() && ed.children.length <= 1
}

/** 正文数据为空时显示占位提示（类名驱动，兼容 <p><br></p> 等残留空结构） */
const editorEmpty = ref(false)
/** 有实际内容的元素：图片 / 表格 / 分割线 / 代码块 / 列表 / 待办 / 高亮块 / 分栏 */
const RICH_CONTENT_SELECTOR = 'img, table, hr, pre, ul, ol, .docs-todo, .docs-callout, .docs-cols'

/** 正文是否没有数据（无文字，也没有图片、表格等富文本元素） */
function isDocContentEmpty(ed: HTMLElement): boolean {
  return !(ed.textContent || '').trim() && !ed.querySelector(RICH_CONTENT_SELECTOR)
}

/**
 * 空文档收拢成一个真正的空编辑器：
 * 残留的 <p><br></p> / <div><br></div> 会让占位提示独占第一行、光标掉到第二行，清掉后光标与提示同一行
 */
function normalizeEmptyEditor(ed: HTMLElement) {
  if (ed.innerHTML === '') return
  const hadFocus = document.activeElement === ed
  ed.innerHTML = ''
  if (!hadFocus) return
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(ed)
  range.collapse(true)
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function refreshEmptyState() {
  const ed = editorRef.value
  if (!ed) {
    editorEmpty.value = false
    return
  }
  const empty = isDocContentEmpty(ed)
  if (empty) normalizeEmptyEditor(ed)
  editorEmpty.value = empty
}

/** 编辑器输入入口：先跑飞书式输入增强（Markdown 快捷转换 / 斜杠菜单），再落盘 */
function onEditorInput(e?: Event) {
  const doc = activeDoc.value
  const editor = editorRef.value
  if (!doc || !editor) return
  const inputEvent = e as InputEvent | undefined
  // 行首 Markdown 快捷输入（“# ”→标题 等），转换成功直接落盘
  if (inputEvent?.data === ' ' && tryMarkdownShortcut(editor)) {
    onEditorChange(editor, doc)
    return
  }
  handleSlashInput(inputEvent)
  onEditorChange(editor, doc)
}

/** 落盘 / 刷新界面状态（原 onEditorInput 主体） */
function onEditorChange(editor: HTMLElement, doc: DocItem) {
  // 先收拢空结构，落盘的 HTML 也保持干净
  refreshEmptyState()
  doc.content = editor.innerHTML
  doc.updatedAt = Date.now()
  refreshOutline()
  // 首行"+"：空文档保持显示（配合输入提示），有内容后收起、由悬停接管
  if (isEditorEmpty(editor)) {
    hoverBlock.value = editor
    hoverBlockType.value = 'p'
    plusTop.value = 16 // 与编辑器首行（输入提示）对齐
    plusVisible.value = true
  } else if (hoverBlock.value === editor) {
    plusVisible.value = false
  }
  // 内容有变化：400ms 防抖实时保存（输入 / 工具栏 / 插入块 / 粘贴 / 勾选待办等所有编辑入口都汇聚到这里）
  scheduleSave()
}

/** 打开文档时：空文档默认在首行显示"+"（参考飞书，与输入提示并排） */
watch(activeDoc, async (d) => {
  await nextTick()
  const ed = editorRef.value
  if (!d || !ed) return
  refreshEmptyState()
  if (isEditorEmpty(ed)) {
    hoverBlock.value = ed
    hoverBlockType.value = 'p'
    plusTop.value = 16 // 与编辑器首行（输入提示）对齐
    plusVisible.value = true
  } else {
    plusVisible.value = false
  }
})

/** 块级"+"插入菜单：悬停行定位 */
const plusVisible = ref(false)
const plusMenuOpen = ref(false)
const plusTop = ref(0)
const hoverBlock = ref<HTMLElement | null>(null)
const plusBtnRef = ref<HTMLElement | null>(null)
/** 悬停块的富文本类型：普通段落前面显示"+"，其余富文本块显示块类型手柄 */
const hoverBlockType = ref('p')
/** 手柄上的类型文字（H1 / • / “ / {} ...） */
const BLOCK_HANDLE_LABEL: Record<string, string> = {
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  ul: '•',
  ol: '1.',
  todo: '☑',
  quote: '“',
  pre: '{}',
  table: '▦',
  columns: '栏',
  callout: '高亮',
  img: '图',
  hr: '—',
}
const hoverBlockLabel = computed(() => BLOCK_HANDLE_LABEL[hoverBlockType.value] || '')
/** 富文本块（非普通段落）不展示"+"，改展示块类型手柄 */
const plusMode = computed<'plus' | 'block'>(() => (hoverBlockType.value === 'p' ? 'plus' : 'block'))

/** 判断块级元素属于哪种富文本类型 */
function blockTypeOf(el: HTMLElement | null): string {
  const editor = editorRef.value
  if (!el || el === editor) return 'p'
  const tag = el.tagName
  if (tag === 'H1' || tag === 'H2' || tag === 'H3') return tag.toLowerCase()
  if (tag === 'LI') return el.parentElement?.tagName === 'OL' ? 'ol' : 'ul'
  if (tag === 'BLOCKQUOTE') return 'quote'
  if (tag === 'PRE') return 'pre'
  if (tag === 'TABLE') return 'table'
  if (tag === 'HR') return 'hr'
  if (tag === 'IMG') return 'img'
  if (tag === 'DIV') {
    if (el.classList.contains('docs-todo')) return 'todo'
    if (el.classList.contains('docs-cols')) return 'columns'
    if (el.classList.contains('docs-callout')) return 'callout'
  }
  return 'p'
}

/** 块类型手柄面板：块转换 */
const blockConvertBtns = [
  { key: 'p', title: '正文', glyph: 'T' },
  { key: 'h1', title: '一级标题', glyph: 'H1' },
  { key: 'h2', title: '二级标题', glyph: 'H2' },
  { key: 'h3', title: '三级标题', glyph: 'H3' },
  { key: 'ol', title: '有序列表', icon: OrderedListOutlined },
  { key: 'ul', title: '无序列表', icon: UnorderedListOutlined },
]
const blockExtraBtns = [
  { key: 'todo', title: '任务列表', icon: CheckSquareOutlined },
  { key: 'inline-code', title: '行内代码', glyph: '{}' },
  { key: 'quote', title: '引用', glyph: '“' },
  { key: 'pre', title: '代码块', icon: CodeOutlined },
]
const blockSubItems = [
  {
    key: 'indent',
    label: '缩进和对齐',
    icon: AlignLeftOutlined,
    sub: [
      { key: 'indent', label: '增加缩进' },
      { key: 'outdent', label: '减少缩进' },
      { key: 'left', label: '左对齐' },
      { key: 'center', label: '居中对齐' },
      { key: 'right', label: '右对齐' },
    ],
  },
  { key: 'color', label: '颜色', icon: FontColorsOutlined, sub: [] as { key: string; label: string }[] },
]
interface BlockRowItem {
  key: string
  label: string
  icon: Component
  danger?: boolean
}
const blockClipItems: BlockRowItem[] = [
  { key: 'comment', label: '评论', icon: CommentOutlined },
  { key: 'cut', label: '剪切', icon: ScissorOutlined },
  { key: 'copy', label: '复制', icon: CopyOutlined },
  { key: 'translate', label: '翻译', icon: TranslationOutlined },
  { key: 'delete', label: '删除', icon: DeleteOutlined, danger: true },
]
/** 文档级操作（分享 / 子文档 / 模板 / 链接） */
const blockDocItems: BlockRowItem[] = [
  { key: 'share', label: '分享', icon: ShareAltOutlined },
  { key: 'subdoc', label: '转换为子文档', icon: FileAddOutlined },
  { key: 'template', label: '保存为模板', icon: SnippetsOutlined },
  { key: 'copyLink', label: '复制链接', icon: LinkOutlined },
]
/** 在下方添加：可插入的块类型 */
const blockAddItems = [
  { key: 'p', label: '正文' },
  { key: 'h1', label: '一级标题' },
  { key: 'h2', label: '二级标题' },
  { key: 'h3', label: '三级标题' },
  { key: 'ul', label: '无序列表' },
  { key: 'ol', label: '有序列表' },
  { key: 'todo', label: '任务列表' },
  { key: 'quote', label: '引用' },
  { key: 'pre', label: '代码块' },
]
/** 块类型面板当前展开的二级菜单 */
const activeBlockSub = ref('')

/** "+"面板：基础排版（图标网格，枚举富文本块类型） */
interface InsertBasic {
  key: string
  title: string
  glyph?: string
  icon?: Component
}
const insertBasics: InsertBasic[] = [
  { key: 'h1', title: '一级标题', glyph: 'H1' },
  { key: 'h2', title: '二级标题', glyph: 'H2' },
  { key: 'h3', title: '三级标题', glyph: 'H3' },
  { key: 'ol', title: '有序列表', icon: OrderedListOutlined },
  { key: 'ul', title: '无序列表', icon: UnorderedListOutlined },
  { key: 'todo', title: '任务列表', icon: CheckSquareOutlined },
  { key: 'code', title: '行内代码', glyph: '{}' },
  { key: 'quote', title: '引用', glyph: '“' },
  { key: 'pre', title: '代码块', icon: CodeOutlined },
  { key: 'attach', title: '视频或文件', icon: PaperClipOutlined },
  { key: 'hr', title: '分割线', icon: MinusOutlined },
  { key: 'link', title: '链接', icon: LinkOutlined },
]

/** "+"面板：常用富文本元素（含二级菜单） */
interface InsertCommon {
  key: string
  label: string
  icon: Component
  color: string
  sub?: { key: string; label: string }[]
}
const insertCommons: InsertCommon[] = [
  { key: 'todo', label: '任务', icon: CheckSquareOutlined, color: 'var(--c-primary)' },
  { key: 'image', label: '图片', icon: PictureOutlined, color: 'var(--docs-type-flow)' },
  { key: 'attach', label: '视频或文件', icon: PaperClipOutlined, color: 'var(--c-primary)' },
  {
    key: 'table',
    label: '表格',
    icon: TableOutlined,
    color: 'var(--docs-type-sheet)',
    sub: [
      { key: 'table:3', label: '3 × 3 表格' },
      { key: 'table:4', label: '4 × 4 表格' },
      { key: 'table:5x6', label: '5 × 6 表格' },
    ],
  },
  {
    key: 'columns',
    label: '分栏',
    icon: LayoutOutlined,
    color: 'var(--docs-type-mindmap)',
    sub: [
      { key: 'columns:2', label: '两栏' },
      { key: 'columns:3', label: '三栏' },
    ],
  },
  { key: 'callout', label: '高亮块', icon: BgColorsOutlined, color: 'var(--docs-type-flow)' },
]
/** 当前展开的二级菜单 */
const activeInsertSub = ref('')
/** 图片 / 文件选择框 */
const imageInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function onEditorHover(e: MouseEvent) {
  if (!docsEditMode.value) return
  const editor = editorRef.value
  if (!editor) return
  const target = e.target as HTMLElement
  if (!editor.contains(target)) return
  // 向上找到编辑器直属的块级元素（段落 / 标题 / 列表 / 引用 / 代码块）
  let block: HTMLElement = target
  while (block !== editor && block.parentElement !== editor && !/^(P|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(block.tagName)) {
    block = block.parentElement
  }
  if (block === editor) {
    // 编辑器空白区：仅空文档（只有占位符）时在首行位置显示加号
    if (isEditorEmpty(editor)) {
      hoverBlock.value = editor
      hoverBlockType.value = 'p'
      plusTop.value = 16 // 与编辑器首行（输入提示）对齐
      plusVisible.value = true
    } else {
      plusVisible.value = false
    }
    return
  }
  hoverBlock.value = block
  hoverBlockType.value = blockTypeOf(block)
  plusTop.value = block.offsetTop
  plusVisible.value = true
}

function onEditorLeave(e: MouseEvent) {
  const rt = e.relatedTarget as HTMLElement | null
  // 移向加号按钮或插入菜单时不隐藏，否则加号永远点不到
  if (rt && plusBtnRef.value?.contains(rt)) return
  if (rt && rt.closest?.('.ant-dropdown')) return
  if (!plusMenuOpen.value) plusVisible.value = false
}
watch(plusMenuOpen, (open) => {
  if (!open) {
    plusVisible.value = false
    activeInsertSub.value = ''
  }
})

/** 在光标处插入 HTML 片段，光标无落点时追加到末尾 */
function insertHtmlAtCaret(editor: HTMLElement, html: string) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !editor.contains(sel.anchorNode)) {
    editor.insertAdjacentHTML('beforeend', html)
    return
  }
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const frag = range.createContextualFragment(html)
  const last = frag.lastChild
  range.insertNode(frag)
  if (last) {
    const after = document.createRange()
    after.setStartAfter(last)
    after.collapse(true)
    sel.removeAllRanges()
    sel.addRange(after)
  }
}

/** 插入表格 */
function insertTable(editor: HTMLElement, rowCount: number, colCount: number) {
  const cell = '<td><br></td>'
  const row = `<tr>${cell.repeat(colCount)}</tr>`
  insertHtmlAtCaret(editor, `<table class="docs-insert-table"><tbody>${row.repeat(rowCount)}</tbody></table><p><br></p>`)
}

/** 插入分栏 */
function insertColumns(editor: HTMLElement, count: number) {
  const cols = Array.from({ length: count }, (_, i) => `<div class="docs-col">栏 ${i + 1}</div>`).join('')
  insertHtmlAtCaret(
    editor,
    `<div class="docs-cols" style="grid-template-columns:repeat(${count},1fr)">${cols}</div><p><br></p>`,
  )
}

/** "+"菜单：把枚举的富文本元素应用到悬停的块 */
function applyInsert(key: string) {
  const editor = editorRef.value
  if (!editor) return
  plusMenuOpen.value = false
  activeInsertSub.value = ''
  const [cmd, arg] = key.split(':')
  // 图片 / 文件走系统选择框，插入在文件选中后完成
  if (cmd === 'image' || cmd === 'attach') {
    const input = cmd === 'image' ? imageInputRef.value : fileInputRef.value
    input?.click()
    return
  }
  editor.focus()
  // 光标落回悬停块（点击菜单会夺走焦点），保证命令作用于该块
  if (hoverBlock.value && editor.contains(hoverBlock.value)) {
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(hoverBlock.value)
    range.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
  // 与斜杠菜单共用同一套插入命令；表格保留 5x6 特例
  if (cmd === 'table' && key === 'table:5x6') insertTable(editor, 5, 6)
  else runInsertCommand(editor, cmd, arg)
  onEditorInput()
}

/**
 * 块类型手柄：对悬停的富文本块执行转换 / 缩进 / 对齐 / 颜色 / 剪切复制删除
 * 普通段落仍然走"+"插入面板，这里只处理 H1/H2/H3、列表、引用、代码块等已有内容的块
 */
function applyBlockCmd(cmd: string, arg?: string) {
  const editor = editorRef.value
  const block = hoverBlock.value
  plusMenuOpen.value = false
  activeBlockSub.value = ''
  if (!editor || !block) return
  const isEditorRoot = block === editor
  editor.focus()
  const range = document.createRange()
  if (!isEditorRoot) range.selectNodeContents(block)
  /** 把光标放到块首（块转换命令的作用位置） */
  const caretToBlock = () => {
    if (isEditorRoot) return
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range.cloneRange())
  }
  /** 选中整个块（缩进 / 对齐 / 颜色 / 复制） */
  const selectBlock = () => {
    if (isEditorRoot) return
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
  /** 非标准块（待办 / 高亮块 / 表格等）转换成文本块：直接替换节点 */
  const replaceWith = (tag: string) => {
    if (isEditorRoot) return
    block.outerHTML = `<${tag}>${escapeHtml((block.textContent || '').trim())}</${tag}>`
  }
  const textBlock = /^(P|H1|H2|H3|H4|LI|BLOCKQUOTE|PRE)$/.test(block.tagName)

  switch (cmd) {
    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
      if (textBlock) {
        caretToBlock()
        document.execCommand('formatBlock', false, cmd)
      } else {
        replaceWith(cmd)
      }
      break
    case 'quote':
      if (textBlock) {
        caretToBlock()
        document.execCommand('formatBlock', false, 'blockquote')
      } else {
        replaceWith('blockquote')
      }
      break
    case 'pre':
      if (textBlock) {
        caretToBlock()
        document.execCommand('formatBlock', false, 'pre')
      } else {
        replaceWith('pre')
      }
      break
    case 'ul':
      caretToBlock()
      document.execCommand('insertUnorderedList')
      break
    case 'ol':
      caretToBlock()
      document.execCommand('insertOrderedList')
      break
    case 'todo': {
      const text = escapeHtml((block.textContent || '').trim() || '待办事项')
      const tpl = document.createElement('template')
      tpl.innerHTML = `<div class="docs-todo"><span class="docs-todo-text">${text}</span><span class="docs-todo-box" contenteditable="false"></span></div>`
      const el = tpl.content.firstElementChild as HTMLElement
      if (isEditorRoot) editor.appendChild(el)
      else block.replaceWith(el)
      // 转换后光标落进任务文字里，与勾选框同一行
      focusTodoText(el)
      break
    }
    case 'inline-code': {
      const text = escapeHtml((block.textContent || '').trim())
      const html = `<code>${text}</code>`
      if (isEditorRoot) editor.insertAdjacentHTML('beforeend', `<p>${html}</p>`)
      else if (textBlock && block.tagName === 'P') block.outerHTML = `<p>${html}</p>`
      else block.outerHTML = `<p>${html}</p>`
      break
    }
    case 'indent':
    case 'outdent': {
      // 用左外边距实现缩进，避免 execCommand('indent') 在列表里另起嵌套结构
      if (isEditorRoot) return
      const cur = parseInt(block.style.marginLeft || '0', 10) || 0
      const next = cmd === 'indent' ? cur + 32 : Math.max(0, cur - 32)
      block.style.marginLeft = next ? `${next}px` : ''
      break
    }
    case 'left':
    case 'center':
    case 'right':
      selectBlock()
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand(`justify${cmd === 'left' ? 'Left' : cmd === 'center' ? 'Center' : 'Right'}`)
      break
    case 'highlight':
      selectBlock()
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('hiliteColor', false, arg || bubbleColors[0])
      break
    case 'unhighlight':
      selectBlock()
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('hiliteColor', false, 'transparent')
      break
    case 'cut':
      selectBlock()
      document.execCommand('cut')
      break
    case 'copy':
      selectBlock()
      document.execCommand('copy')
      message.success('已复制')
      break
    case 'comment':
      message.info('评论功能开发中')
      break
    case 'translate':
      message.info('翻译功能开发中')
      break
    case 'delete':
      if (isEditorRoot) return
      block.remove()
      if (!editor.innerHTML.trim()) editor.innerHTML = '<p><br></p>'
      plusVisible.value = false
      break
    case 'share':
      openDocSharePanel()
      break
    case 'subdoc':
      message.info('转换为子文档功能开发中')
      break
    case 'template':
      message.info('保存为模板功能开发中')
      break
    case 'copyLink':
      navigator.clipboard
        ?.writeText(`${window.location.origin}/docs`)
        .then(() => message.success('文档链接已复制'))
        .catch(() => message.warning('复制失败，请手动复制'))
      break
    case 'below':
      insertBlockBelow(editor, block, arg || 'p')
      break
  }
  onEditorInput()
}

/** 在当前块下方插入一个空块，并把光标放进去 */
function insertBlockBelow(editor: HTMLElement, block: HTMLElement, kind: string) {
  const html =
    kind === 'ul'
      ? '<ul><li><br></li></ul>'
      : kind === 'ol'
        ? '<ol><li><br></li></ol>'
        : kind === 'todo'
          ? '<div class="docs-todo"><span class="docs-todo-text">待办事项</span><span class="docs-todo-box" contenteditable="false"></span></div>'
          : `<${kind}><br></${kind}>`
  if (block === editor) editor.insertAdjacentHTML('beforeend', html)
  else block.insertAdjacentHTML('afterend', html)
  // 光标落到新块内，方便直接输入
  const next = (block === editor ? editor.lastElementChild : block.nextElementSibling) as HTMLElement | null
  if (!next) return
  editor.focus()
  if (next.matches('.docs-todo')) {
    // 任务块：光标放进文字里，与勾选框同一行
    focusTodoText(next)
    plusVisible.value = false
    return
  }
  const target = next.matches('ul, ol') ? next.querySelector('li') : next
  if (!target) return
  const range = document.createRange()
  range.selectNodeContents(target)
  range.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  plusVisible.value = false
}

/** 图片选择完成：读成 dataURL 插入正文 */
function onImagePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const editor = editorRef.value
  input.value = ''
  if (!file || !editor) return
  const reader = new FileReader()
  reader.onload = () => {
    editor.focus()
    insertHtmlAtCaret(editor, `<img class="docs-img" src="${String(reader.result)}" alt="${escapeAttr(file.name)}" /><p><br></p>`)
    onEditorInput()
  }
  reader.readAsDataURL(file)
}

/** 视频 / 文件选择完成：插入附件信息 */
function onAttachPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const editor = editorRef.value
  input.value = ''
  if (!file || !editor) return
  const size = file.size >= 1024 * 1024
    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(file.size / 1024))} KB`
  const kind = file.type.startsWith('video/') ? '视频' : '文件'
  editor.focus()
  insertHtmlAtCaret(
    editor,
    `<span class="docs-attach" contenteditable="false">${kind} · ${escapeHtml(file.name)} · ${size}</span><p><br></p>`,
  )
  onEditorInput()
}

/** 任务列表勾选 */
function onEditorClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.classList?.contains('docs-todo-box')) return
  target.parentElement?.classList.toggle('is-done')
  onEditorInput()
}

/**
 * 归一化待办结构：勾选框必须在文字之后。
 * Chrome 把“元素偏移 0”的光标画在第一个子元素上，勾选框在前会导致
 * 点击勾选框 / 按 Home / 回车新建待办时光标落在勾选框上而不是文字行首。
 */
function normalizeTodoOrder(ed: HTMLElement) {
  ed.querySelectorAll<HTMLElement>('.docs-todo').forEach((todo) => {
    const box = todo.querySelector<HTMLElement>('.docs-todo-box')
    if (box && todo.lastElementChild !== box) todo.appendChild(box)
  })
}

/** 把光标放进任务块的文字里（末尾），保证光标与勾选框同一行 */
function focusTodoText(todo: HTMLElement) {
  const text = todo.querySelector<HTMLElement>('.docs-todo-text') || todo
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(text)
  range.collapse(false)
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/**
 * 在光标处插入任务块：直接操作 DOM（execCommand/range.insertNode 会把 div 塞进 p，
 * 或把任务文字拆到下一行），插完把光标放进任务文字里
 */
function insertTodoAtCaret(editor: HTMLElement, text: string) {
  const sel = window.getSelection()
  let block: HTMLElement | null = null
  if (sel && sel.rangeCount > 0 && sel.anchorNode && editor.contains(sel.anchorNode)) {
    const n = sel.getRangeAt(0).startContainer
    block = (n.nodeType === 1 ? n : n.parentElement) as HTMLElement | null
    while (block && block !== editor && block.parentElement !== editor) block = block.parentElement
  }
  const tpl = document.createElement('template')
  tpl.innerHTML = `<div class="docs-todo"><span class="docs-todo-text">${escapeHtml(text)}</span><span class="docs-todo-box" contenteditable="false"></span></div>`
  const el = tpl.content.firstElementChild as HTMLElement
  if (!block || block === editor) editor.appendChild(el)
  // 空块直接替换，避免留下空行；非空块插到它下方
  else if (!(block.textContent || '').trim()) block.replaceWith(el)
  else block.after(el)
  focusTodoText(el)
}

// ==================== 飞书式编辑增强：Markdown 快捷输入 / 斜杠菜单 / 按键 / 粘贴 ====================

/** 行首 Markdown 快捷规则：输入前缀 + 空格触发块转换 */
const MD_RULES: { re: RegExp; type: string }[] = [
  { re: /^# $/, type: 'h1' },
  { re: /^## $/, type: 'h2' },
  { re: /^### $/, type: 'h3' },
  { re: /^[-*+] $/, type: 'ul' },
  { re: /^\d+[.)] $/, type: 'ol' },
  { re: /^\[\]\s$|^\[ \]\s$|^\[[xX]\]\s$/, type: 'todo' },
  { re: /^> $/, type: 'quote' },
  { re: /^``` $/, type: 'pre' },
  { re: /^(---|\*\*\*) $/, type: 'hr' },
]

/**
 * Markdown 快捷输入（参考飞书 / Notion）：在正文 / 标题行行首输入
 * “# ”“## ”“### ”“- ”“1. ”“[] ”“> ”“``` ”“--- ”并空格，自动转换成对应块。
 * 返回是否发生了转换。
 */
function tryMarkdownShortcut(editor: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
  const node = sel.anchorNode
  if (!node || !editor.contains(node)) return false
  // 找到光标所在的顶层块
  let block: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
  while (block && block.parentElement !== editor) block = block.parentElement
  if (!block || block === editor) return false
  // 仅正文 / 标题行触发；列表、代码块、待办各有自己的默认行为
  if (!['P', 'H1', 'H2', 'H3'].includes(block.tagName)) return false
  // 取「块首 → 光标」的文本（刚输入的空格已包含在内）
  const range = document.createRange()
  range.setStart(block, 0)
  range.setEnd(sel.anchorNode, sel.anchorOffset)
  const prefix = range.toString()
  const rule = MD_RULES.find((r) => r.re.test(prefix))
  if (!rule) return false
  // 删除快捷前缀字符
  range.deleteContents()
  switch (rule.type) {
    case 'h1':
    case 'h2':
    case 'h3':
      document.execCommand('formatBlock', false, rule.type)
      break
    case 'ul':
      document.execCommand('insertUnorderedList')
      break
    case 'ol':
      document.execCommand('insertOrderedList')
      break
    case 'quote':
      document.execCommand('formatBlock', false, 'blockquote')
      break
    case 'pre':
      document.execCommand('formatBlock', false, 'pre')
      break
    case 'todo': {
      // [x] 开头直接勾选；剩余文字保留为任务内容
      const rest = (block.textContent || '').trim()
      const tpl = document.createElement('template')
      tpl.innerHTML = `<div class="docs-todo"><span class="docs-todo-text">${escapeHtml(rest)}</span><span class="docs-todo-box" contenteditable="false"></span></div>`
      const el = tpl.content.firstElementChild as HTMLElement
      if (/^\[[xX]\]/.test(prefix)) el.classList.add('is-done')
      block.replaceWith(el)
      focusTodoText(el)
      break
    }
    case 'hr':
      document.execCommand('insertHorizontalRule')
      // 分割线后补空段落承接光标，继续输入
      document.execCommand('insertHTML', false, '<p><br></p>')
      break
  }
  return true
}

/** 斜杠菜单插入项（label 支持关键词 / 拼音过滤） */
interface SlashItem {
  key: string
  label: string
  keywords?: string
  icon?: Component
  glyph?: string
}
const slashItems: SlashItem[] = [
  { key: 'p', label: '正文', keywords: 'text zhengwen', glyph: 'T' },
  { key: 'h1', label: '一级标题', keywords: '标题 biaoti', glyph: 'H1' },
  { key: 'h2', label: '二级标题', keywords: '标题 biaoti', glyph: 'H2' },
  { key: 'h3', label: '三级标题', keywords: '标题 biaoti', glyph: 'H3' },
  { key: 'ul', label: '无序列表', keywords: '列表 liebiao', icon: UnorderedListOutlined },
  { key: 'ol', label: '有序列表', keywords: '列表 liebiao', icon: OrderedListOutlined },
  { key: 'todo', label: '任务列表', keywords: '待办 daiban renwu', icon: CheckSquareOutlined },
  { key: 'code', label: '行内代码', keywords: '代码 daima', glyph: '{}' },
  { key: 'quote', label: '引用', keywords: 'yinyong', glyph: '“' },
  { key: 'pre', label: '代码块', keywords: '代码 daima', icon: CodeOutlined },
  { key: 'callout', label: '高亮块', keywords: '提示 gaoliangkuai', glyph: '▎' },
  { key: 'table:3', label: '表格', keywords: 'biaoge', icon: TableOutlined },
  { key: 'columns:2', label: '分栏', keywords: 'fenlan', glyph: '▤' },
  { key: 'hr', label: '分割线', keywords: '分隔 fengexian', icon: MinusOutlined },
  { key: 'link', label: '链接', keywords: 'lianjie', icon: LinkOutlined },
  { key: 'image', label: '图片', keywords: 'tupian', icon: PictureOutlined },
]

/** 斜杠菜单状态：anchor 记录 “/” 之后的光标位置，用于组装关键词与回删 */
const slash = reactive({
  visible: false,
  top: 0,
  left: 0,
  keyword: '',
  active: 0,
  anchor: null as Range | null,
})
const slashFiltered = computed(() => {
  const kw = slash.keyword.trim().toLowerCase()
  if (!kw) return slashItems
  return slashItems.filter(
    (it) => it.label.toLowerCase().includes(kw) || (it.keywords || '').toLowerCase().includes(kw),
  )
})

function closeSlash() {
  slash.visible = false
  slash.keyword = ''
  slash.anchor = null
}

/** 斜杠面板定位在光标下方，越界时翻到上方并做视口避让 */
function positionSlash(editor: HTMLElement, range: Range) {
  let rect = range.getBoundingClientRect()
  if (!rect || (!rect.width && !rect.height)) rect = editor.getBoundingClientRect()
  const width = 272
  slash.left = Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12)
  let top = rect.bottom + 6
  if (rect.bottom + 360 > window.innerHeight) top = rect.top - 330
  slash.top = Math.max(top, 12)
}

/** 输入事件驱动斜杠菜单：输入 “/” 唤起，继续输入实时过滤 */
function handleSlashInput(e: InputEvent | undefined) {
  const editor = editorRef.value
  const sel = window.getSelection()
  if (!editor || !sel || sel.rangeCount === 0 || !docsEditMode.value) return
  if (!slash.visible) {
    if (e?.data === '/') {
      const range = sel.getRangeAt(0)
      slash.anchor = range.cloneRange()
      slash.keyword = ''
      slash.active = 0
      positionSlash(editor, range)
      slash.visible = true
    }
    return
  }
  // 菜单已打开：把 “/” 之后到光标的文本作为过滤关键词
  const anchor = slash.anchor
  if (!anchor || !editor.contains(anchor.startContainer)) {
    closeSlash()
    return
  }
  let kw = ''
  try {
    if (!sel.anchorNode) {
      closeSlash()
      return
    }
    const kwRange = document.createRange()
    kwRange.setStart(anchor.startContainer, anchor.startOffset)
    kwRange.setEnd(sel.anchorNode, sel.anchorOffset)
    kw = kwRange.toString()
  } catch {
    closeSlash()
    return
  }
  // 出现空白 / 超长 / 把 “/” 删掉了：关闭菜单
  if (/\s/.test(kw) || kw.length > 20 || (!kw && e?.inputType === 'deleteContentBackward')) {
    closeSlash()
    return
  }
  slash.keyword = kw
  slash.active = 0
  positionSlash(editor, sel.getRangeAt(0))
}

function moveSlashActive(delta: number) {
  const len = slashFiltered.value.length
  if (!len) return
  slash.active = (slash.active + delta + len) % len
}

/** 应用斜杠菜单选中项：先删掉 “/关键词”，再执行插入命令 */
function applySlashInsert(it: SlashItem) {
  const editor = editorRef.value
  if (!editor) return
  const anchor = slash.anchor
  closeSlash()
  const sel = window.getSelection()
  if (anchor && sel && sel.rangeCount > 0 && editor.contains(anchor.startContainer)) {
    try {
      const cur = sel.getRangeAt(0)
      const del = document.createRange()
      del.setStart(anchor.startContainer, anchor.startOffset)
      del.setEnd(cur.endContainer, cur.endOffset)
      del.deleteContents()
    } catch {
      // 光标已不在锚点之后，忽略
    }
  }
  editor.focus()
  if (it.key === 'image') {
    imageInputRef.value?.click()
    onEditorInput()
    return
  }
  const [cmd, arg] = it.key.split(':')
  runInsertCommand(editor, cmd, arg)
  onEditorInput()
}

/** 插入命令执行体（"+"菜单与斜杠菜单共用） */
function runInsertCommand(editor: HTMLElement, cmd: string, arg?: string) {
  switch (cmd) {
    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
      document.execCommand('formatBlock', false, cmd)
      break
    case 'quote':
      document.execCommand('formatBlock', false, 'blockquote')
      break
    case 'pre':
      document.execCommand('formatBlock', false, 'pre')
      break
    case 'ul':
      document.execCommand('insertUnorderedList')
      break
    case 'ol':
      document.execCommand('insertOrderedList')
      break
    case 'hr':
      document.execCommand('insertHorizontalRule')
      // 分割线后补空段落承接光标
      document.execCommand('insertHTML', false, '<p><br></p>')
      break
    case 'code': {
      // 行内代码：包裹当前选中文本，无选中时插入占位文本
      const text = window.getSelection()?.toString() || '行内代码'
      document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`)
      break
    }
    case 'link':
      document.execCommand('insertHTML', false, '<a href="#" target="_blank" rel="noopener">链接地址</a>')
      break
    case 'todo':
      // 直接操作 DOM 插入，光标落在任务文字里（与勾选框同一行）
      insertTodoAtCaret(editor, '待办事项')
      break
    case 'callout':
      insertHtmlAtCaret(editor, '<div class="docs-callout">高亮块内容</div><p><br></p>')
      break
    case 'table':
      insertTable(editor, Number(arg) || 3, Number(arg) || 3)
      break
    case 'columns':
      insertColumns(editor, Number(arg) || 2)
      break
  }
}

/** 编辑器按键（参考飞书）：斜杠菜单导航 / Tab 缩进列表 / 空待办退格转正文 */
function onEditorKeyDown(e: KeyboardEvent) {
  // 斜杠菜单打开时接管导航键
  if (slash.visible) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveSlashActive(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveSlashActive(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const it = slashFiltered.value[slash.active]
      if (it) applySlashInsert(it)
      else closeSlash()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSlash()
      return
    }
  }
  const editor = editorRef.value
  if (!editor || !docsEditMode.value) return
  const sel = window.getSelection()
  const node = sel?.anchorNode
  const el = node ? (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)) : null
  if (!el || !editor.contains(el)) return

  // Tab / Shift+Tab：列表项缩进 / 反缩进；其他位置插入空格（避免 Tab 把焦点移出编辑器）
  if (e.key === 'Tab') {
    e.preventDefault()
    if (el.closest('li')) document.execCommand(e.shiftKey ? 'outdent' : 'indent')
    else document.execCommand('insertText', false, '  ')
    onEditorInput()
    return
  }

  // Backspace：空待办块转回正文（空列表项浏览器已有默认行为）
  if (e.key === 'Backspace' && sel && sel.isCollapsed) {
    const todo = el.closest<HTMLElement>('.docs-todo')
    const text = todo?.querySelector<HTMLElement>('.docs-todo-text')
    if (todo && text && !(text.textContent || '').trim()) {
      e.preventDefault()
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      todo.replaceWith(p)
      const range = document.createRange()
      range.selectNodeContents(p)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      onEditorInput()
    }
  }
}

/** 粘贴 HTML 结构白名单：保留常用结构标签，其余拆壳保留文字 */
const PASTE_ALLOWED_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE',
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'BR', 'HR', 'A', 'TABLE', 'THEAD',
  'TBODY', 'TR', 'TD', 'TH', 'IMG', 'SPAN', 'DIV',
])

/** 粘贴清洗：去脚本 / 事件属性，a/img 只留安全属性（并校验协议），自家 docs-* 类名保留 */
function sanitizePasteHtml(html: string): string {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  tpl.content
    .querySelectorAll('script, style, link, meta, iframe, object, embed, audio, video')
    .forEach((n) => n.remove())
  const clean = (root: Node) => {
    Array.from(root.childNodes).forEach((n) => {
      if (n.nodeType === Node.COMMENT_NODE) {
        n.remove()
        return
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return
      const el = n as HTMLElement
      clean(el)
      if (!PASTE_ALLOWED_TAGS.has(el.tagName)) {
        // 白名单外的标签：拆壳保留（已清洗过的）内容
        const parent = el.parentNode
        while (el.firstChild) parent?.insertBefore(el.firstChild, el)
        el.remove()
        return
      }
      const keep =
        el.tagName === 'A'
          ? ['href']
          : el.tagName === 'IMG'
            ? ['src', 'alt']
            : el.tagName === 'TD' || el.tagName === 'TH'
              ? ['colspan', 'rowspan']
              : []
      Array.from(el.attributes).forEach((attr) => {
        const val = attr.value || ''
        if (!keep.includes(attr.name)) el.removeAttribute(attr.name)
        else if (attr.name === 'href' && !/^(https?:|mailto:)/i.test(val)) el.removeAttribute('href')
        else if (attr.name === 'src' && !/^(https?:|data:image\/)/i.test(val)) el.removeAttribute('src')
      })
      // docs-* 类名是自家富文本块的样式钩子，外部类名一律去掉
      const cls = el.getAttribute('class') || ''
      if (!cls.startsWith('docs-')) el.removeAttribute('class')
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener')
      }
    })
  }
  clean(tpl.content)
  return tpl.innerHTML
}

/** 粘贴（参考飞书）：HTML 清洗后插入；纯文本多行转段落；URL 智能成链 */
function onEditorPaste(e: ClipboardEvent) {
  const editor = editorRef.value
  if (!editor || !docsEditMode.value) return
  const dt = e.clipboardData
  if (!dt) return
  const html = dt.getData('text/html')
  const text = dt.getData('text/plain')
  const url = (text || '').trim()
  const isUrl = /^https?:\/\/\S+$/.test(url)
  if (html) {
    e.preventDefault()
    insertHtmlAtCaret(editor, sanitizePasteHtml(html))
  } else if (text) {
    e.preventDefault()
    if (isUrl) {
      // 粘贴链接：有选中文本时把选区变成超链接，否则插入链接文字
      const label = window.getSelection()?.toString().trim() || url
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`,
      )
    } else {
      const lines = text.replace(/\r\n?/g, '\n').split('\n')
      if (lines.length > 1) {
        // 多行纯文本：每行一个段落
        insertHtmlAtCaret(editor, lines.map((l) => `<p>${escapeHtml(l) || '<br>'}</p>`).join(''))
      } else {
        insertHtmlAtCaret(editor, escapeHtml(text))
      }
    }
  }
}

// ---- 选中文字的浮动格式工具栏 ----
type BubbleMenu = '' | 'heading' | 'list' | 'color'
const bubble = reactive({
  visible: false,
  top: 0,
  left: 0,
  menu: '' as BubbleMenu,
  /** 当前光标所在块的标签：正文 / H1 / H2 / H3 */
  block: '正文',
})
const bubbleRef = ref<HTMLElement | null>(null)
const bubbleColors = ['#ffe58f', '#ffd6e7', '#d3e5ff', '#d9f7be', '#ffccc7']
const bubbleColorNames = ['柠檬黄', '樱花粉', '天空蓝', '青草绿', '珊瑚红']
const bubbleHeadings = [
  { key: 'p', label: '正文' },
  { key: 'h1', label: '一级标题' },
  { key: 'h2', label: '二级标题' },
  { key: 'h3', label: '三级标题' },
]
const bubbleLists = [
  { key: 'ul', label: '无序列表' },
  { key: 'ol', label: '有序列表' },
  { key: 'todo', label: '任务列表' },
]
/** 记录选区，点击工具栏时不丢选区 */
let bubbleRange: Range | null = null

function hideBubble() {
  bubble.visible = false
  bubble.menu = ''
}

/** 选区变化时刷新工具栏位置 / 显隐 */
function updateBubble() {
  const editor = editorRef.value
  const sel = window.getSelection()
  // 斜杠菜单：光标离开 “/” 锚点之后（点击了别处 / 选区扩大）即关闭
  if (slash.visible) {
    const anchor = slash.anchor
    if (
      !sel || sel.rangeCount === 0 || !anchor ||
      !editor?.contains(anchor.startContainer) ||
      anchor.startContainer !== sel.anchorNode ||
      sel.anchorOffset < anchor.startOffset
    ) {
      closeSlash()
    }
  }
  if (!editor || !docsEditMode.value || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
    hideBubble()
    return
  }
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) {
    hideBubble()
    return
  }
  const rect = range.getBoundingClientRect()
  if (!rect || (!rect.width && !rect.height)) {
    hideBubble()
    return
  }
  bubbleRange = range.cloneRange()
  // 工具栏最大宽度按 470px 估算，居中于选区并做视口内避让
  const half = 235
  const center = rect.left + rect.width / 2
  const maxLeft = Math.max(window.innerWidth - half - 12, half + 12)
  bubble.left = Math.min(Math.max(center, half + 12), maxLeft)
  // 选区上方空间不足时翻到下方
  bubble.top = rect.top > 64 ? rect.top - 52 : rect.bottom + 10
  const startEl = (range.startContainer.nodeType === 1
    ? range.startContainer
    : range.startContainer.parentElement) as HTMLElement | null
  const heading = startEl?.closest('h1, h2, h3')?.tagName || ''
  bubble.block = heading || '正文'
  bubble.visible = true
}

/** 恢复工具栏记录下来的选区（点击按钮会夺走焦点） */
function restoreBubbleRange() {
  if (!bubbleRange) return
  try {
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(bubbleRange)
  } catch {
    // 选区所在的 DOM 已被替换，忽略
  }
}

function toggleBubbleMenu(menu: Exclude<BubbleMenu, ''>) {
  bubble.menu = bubble.menu === menu ? '' : menu
}

/** 工具栏命令：作用于当前选中的文字 */
function applyBubble(cmd: string, value?: string) {
  const editor = editorRef.value
  if (!editor) return
  editor.focus()
  restoreBubbleRange()
  switch (cmd) {
    case 'bold':
      document.execCommand('bold')
      break
    case 'italic':
      document.execCommand('italic')
      break
    case 'underline':
      document.execCommand('underline')
      break
    case 'strike':
      document.execCommand('strikeThrough')
      break
    case 'link': {
      const text = window.getSelection()?.toString() || '链接地址'
      document.execCommand('insertHTML', false, `<a href="#" target="_blank" rel="noopener">${escapeHtml(text)}</a>`)
      break
    }
    case 'inline-code': {
      const text = window.getSelection()?.toString() || '行内代码'
      document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`)
      break
    }
    case 'highlight':
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('hiliteColor', false, value || bubbleColors[0])
      break
    case 'unhighlight':
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('hiliteColor', false, 'transparent')
      break
    case 'clear':
      document.execCommand('removeFormat')
      break
    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
      document.execCommand('formatBlock', false, cmd)
      break
    case 'ul':
      document.execCommand('insertUnorderedList')
      break
    case 'ol':
      document.execCommand('insertOrderedList')
      break
    case 'todo': {
      // 选中的文字转成任务块（替换所在块），光标落在任务文字里
      const text = window.getSelection()?.toString().trim() || '待办事项'
      const ed = editorRef.value
      if (!ed) break
      const sel = window.getSelection()
      let block: HTMLElement | null = null
      if (sel && sel.rangeCount > 0 && sel.anchorNode && ed.contains(sel.anchorNode)) {
        const n = sel.getRangeAt(0).startContainer
        block = (n.nodeType === 1 ? n : n.parentElement) as HTMLElement | null
        while (block && block !== ed && block.parentElement !== ed) block = block.parentElement
      }
      const tpl = document.createElement('template')
      tpl.innerHTML = `<div class="docs-todo"><span class="docs-todo-text">${escapeHtml(text)}</span><span class="docs-todo-box" contenteditable="false"></span></div>`
      const el = tpl.content.firstElementChild as HTMLElement
      if (!block || block === ed) ed.appendChild(el)
      else block.replaceWith(el)
      focusTodoText(el)
      break
    }
  }
  bubble.menu = ''
  onEditorInput()
  nextTick(updateBubble)
}

/** 点击工具栏 / 编辑器以外的地方收起工具栏 */
function onDocMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (bubbleRef.value?.contains(target)) return
  if (editorRef.value?.contains(target)) return
  hideBubble()
}

onMounted(() => {
  document.addEventListener('selectionchange', updateBubble)
  document.addEventListener('mousedown', onDocMouseDown, true)
  document.addEventListener('scroll', hideFloatPanels, true)
  window.addEventListener('resize', hideFloatPanels)
})
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', updateBubble)
  document.removeEventListener('mousedown', onDocMouseDown, true)
  document.removeEventListener('scroll', hideFloatPanels, true)
  window.removeEventListener('resize', hideFloatPanels)
})

/** 滚动 / 缩放 / 切换文档时收起所有浮动面板（工具栏 + 斜杠菜单） */
function hideFloatPanels() {
  hideBubble()
  closeSlash()
}

/** 切换文档 / 退出编辑时收起工具栏 */
watch([activeDoc, docsEditMode], hideFloatPanels)

/** 收藏 / 取消收藏 */
function toggleStar(doc: DocItem) {
  const next = !doc.starred
  starDocApi({ id: doc.id, starred: next })
    .then((res) => {
      if (!res.success) return
      doc.starred = next
      doc.updatedAt = res.data?.updatedAt || doc.updatedAt
    })
    .catch(() => {})
}

/** 当前文档所属文件夹名称 */
function folderNameOf(doc: DocItem | null): string {
  if (!doc?.folderId) return ''
  return folders.value.find((f) => f.id === doc.folderId)?.name || ''
}
</script>

<template>
  <div class="docs-page" :class="{ 'is-focus': focusMode, 'is-side-collapsed': docsSideCollapsed }">
    <!-- 左侧：文件夹 + 文档 -->
    <aside class="docs-side">
      <header class="docs-side-head">
        <button
          type="button"
          class="docs-side-fold"
          :title="docsSideCollapsed ? '展开菜单' : '折叠菜单'"
          @click="docsSideCollapsed = !docsSideCollapsed"
        >
          <MenuUnfoldOutlined v-if="docsSideCollapsed" />
          <MenuFoldOutlined v-else />
        </button>
        <div v-if="!docsSideCollapsed" class="docs-side-brand">
          <AppLogo class="docs-side-logo" />
          <div class="docs-side-brand-text">
            <span class="docs-side-title">云文档</span>
          </div>
        </div>
      </header>

      <div class="docs-search-wrap">
        <a-input ref="searchRef" v-model:value="keyword" size="small" allow-clear placeholder="搜索" class="docs-search">
          <template #prefix><SearchOutlined class="docs-search-icon" /></template>
        </a-input>
        <span class="docs-search-kbd">⌘K</span>
      </div>

      <nav class="docs-nav">
        <button type="button" class="docs-nav-item" :class="{ active: ['recent', 'owned', 'shared'].includes(navMode) }" @click="switchNav('recent')">
          <HomeOutlined />
          <span>主页</span>
        </button>
        <button type="button" class="docs-nav-item" :class="{ active: navMode === 'library' }" @click="switchNav('library')">
          <BookOutlined />
          <span>知识库</span>
        </button>
      </nav>

      <div class="docs-list">
        <!-- 置顶：文档 + 知识库，左右两列分布 -->
        <div v-if="pinnedDocs.length || pinnedFolders.length" class="docs-group">
          <div class="docs-group-title">置顶</div>
          <div class="docs-pinned-grid">
            <button
              v-for="d in pinnedDocs"
              :key="`pin-${d.id}`"
              type="button"
              class="docs-pinned-item"
              :class="{ active: d.id === activeId }"
              :title="d.title || '无标题文档'"
              @click="selectDoc(d)"
            >
              <DocTypeIcon :type="d.type" mono />
              <span class="docs-pinned-name">{{ d.title || '无标题文档' }}</span>
            </button>
            <div
              v-for="f in pinnedFolders"
              :key="`pinf-${f.id}`"
              class="docs-pinned-item"
              :title="f.name"
              @click="openLibrary(f)"
            >
              <FolderFilled class="docs-folder-icon" />
              <span class="docs-pinned-name">{{ f.name }}</span>
            </div>
          </div>
        </div>

        <!-- 我的文档库 -->
        <div class="docs-group-title docs-group-title-main">我的文档库</div>

        <template v-for="g in groups" :key="g.folder?.id || '__ungrouped__'">
          <!-- 文件夹标题 -->
          <div
            v-if="g.folder"
            class="docs-folder"
            :class="{ active: activeFolderId === g.folder.id }"
            @click="selectFolder(g.folder)"
          >
            <span class="docs-folder-caret" :class="{ open: expanded[g.folder.id] }"><RightOutlined /></span>
            <component :is="expanded[g.folder.id] ? FolderOpenFilled : FolderFilled" class="docs-folder-icon" />
            <span class="docs-folder-name">{{ g.folder.name }}</span>
            <span class="docs-folder-count">{{ g.docs.length }}</span>
            <a-dropdown trigger="click" placement="bottomRight" @click.stop>
              <span class="docs-folder-more" @click.stop><MoreOutlined /></span>
              <template #overlay>
                <a-menu @click="onFolderMenu($event, g.folder)">
                  <a-menu-item key="star">{{ g.folder.starred ? '取消置顶' : '置顶' }}</a-menu-item>
                  <a-menu-item key="rename">重命名</a-menu-item>
                  <a-menu-item key="delete" danger>删除文件夹</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
          <!-- 未分组文档直接展示，不再显示「未分组」标题 -->

          <!-- 文档列表 -->
          <template v-if="!g.folder || g.flat || expanded[g.folder.id]">
            <button
              v-for="d in g.docs"
              :key="d.id"
              type="button"
              class="docs-item"
              :class="{ active: d.id === activeId, grouped: !!g.folder || g.flat }"
              @click="selectDoc(d)"
            >
              <span class="docs-item-main">
                <span class="docs-item-title">
                  <DocTypeIcon :type="d.type" mono />
                  <span class="docs-item-title-text">{{ d.title || '无标题文档' }}</span>
                  <StarFilled v-if="d.starred" class="docs-item-star" />
                </span>
              </span>
              <a-dropdown trigger="click" placement="bottomRight" @click.stop>
                <span class="docs-item-more" @click.stop><MoreOutlined /></span>
                <template #overlay>
                  <a-menu @click="onDocMenu($event, d)">
                    <a-menu-item key="star">{{ d.starred ? '取消收藏' : '收藏' }}</a-menu-item>
                    <a-sub-menu key="move" title="移动到">
                      <a-menu-item key="move:none">未分组</a-menu-item>
                      <a-menu-item v-for="f in folders" :key="`move:${f.id}`">{{ f.name }}</a-menu-item>
                    </a-sub-menu>
                    <a-menu-item key="delete" danger>删除</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </button>
            <div v-if="g.folder && !g.docs.length" class="docs-folder-empty">空文件夹</div>
          </template>
        </template>

        <div v-if="!groups.length" class="docs-list-empty">
          {{ keyword ? '没有匹配的文档' : '还没有文档，点击右上角 + 新建' }}
        </div>
      </div>

      <!-- 回收站入口 -->
      <button
        type="button"
        class="docs-trash-entry"
        :class="{ active: navMode === 'trash' }"
        @click="switchNav('trash')"
      >
        <DeleteOutlined />
        <span>回收站</span>
        <span v-if="trash.length" class="docs-trash-count">{{ trash.length }}</span>
      </button>
    </aside>

    <!-- 右侧编辑区 -->
    <main class="docs-main">
      <template v-if="activeDoc">
        <!-- 正文 + 左侧大纲 -->
        <div class="docs-body">
          <!-- 文档大纲 -->
          <aside v-if="!focusMode && activeDoc.type === 'doc' && outline.length" class="docs-outline">
            <div class="docs-outline-title">目录</div>
            <button
              v-for="o in outline"
              :key="o.id"
              type="button"
              class="docs-outline-item"
              :class="{ 'is-h3': o.level === 3 }"
              @click="scrollToHeading(o.id)"
            >{{ o.text }}</button>
          </aside>

          <div class="docs-canvas">
            <div
              class="docs-canvas-inner"
              :class="{ 'is-wide': activeDoc.type !== 'doc', 'is-sheet': activeDoc.type === 'sheet', 'is-full': wideMode }"
            >
              <!-- 内容区大标题仅文档显示；表格/思维导图/流程图的文件名在顶栏左上角（可编辑） -->
              <input
                v-if="activeDoc.type === 'doc'"
                v-model="activeDoc.title"
                class="docs-title-input"
                placeholder="无标题文档"
                maxlength="120"
                :readonly="!docsEditMode"
                @input="onDocChanged(activeDoc)"
              />

              <div v-if="activeDoc.type === 'doc'" class="docs-doc-meta">
                <span class="docs-doc-avatar" :style="docAvatarStyle">{{ docAuthor.slice(0, 1).toUpperCase() }}</span>
                <span class="docs-doc-author">{{ docAuthor }}</span>
                <span class="docs-doc-sep" />
                <span class="docs-doc-date">{{ formatLongDate(activeDoc.updatedAt) }}修改</span>
              </div>

              <div
                v-if="activeDoc.type === 'doc'"
                class="docs-editor-wrap"
                :class="{ 'is-edit': docsEditMode }"
                @mouseover="onEditorHover"
                @mouseleave="onEditorLeave"
              >
                <div
                  ref="editorRef"
                  class="docs-editor"
                  :class="{ 'is-empty': editorEmpty }"
                  :contenteditable="docsEditMode ? 'true' : 'false'"
                  data-placeholder="输入“/”快速插入内容"
                  @input="onEditorInput"
                  @click="onEditorClick"
                  @keydown="onEditorKeyDown"
                  @paste="onEditorPaste"
                ></div>
                <!-- 飞书式块级插入：悬停行的左外侧出现"+"，悬停变暗，点击弹出富文本元素菜单 -->
                <a-dropdown
                  v-model:open="plusMenuOpen"
                  trigger="click"
                  placement="rightTop"
                  :overlay-style="{ padding: 0, background: 'transparent', boxShadow: 'none' }"
                >
                  <button
                    ref="plusBtnRef"
                    v-show="plusVisible && docsEditMode"
                    type="button"
                    class="docs-block-plus"
                    :class="{ 'is-open': plusMenuOpen, 'is-block': plusMode === 'block' }"
                    :style="{ top: plusTop + 'px' }"
                    :title="plusMode === 'block' ? '块操作' : '插入'"
                  >
                    <template v-if="plusMode === 'block'">
                      <span class="docs-block-plus-label">{{ hoverBlockLabel }}</span>
                      <HolderOutlined class="docs-block-plus-drag" />
                    </template>
                    <PlusOutlined v-else />
                  </button>
                  <template #overlay>
                    <div v-if="plusMode === 'plus'" class="docs-insert-panel" @mousedown.stop @click.stop>
                      <div class="docs-insert-label">基础</div>
                      <div class="docs-insert-grid">
                        <button
                          v-for="it in insertBasics"
                          :key="it.key"
                          type="button"
                          class="docs-insert-cell"
                          :title="it.title"
                          @mouseenter="activeInsertSub = ''"
                          @click="applyInsert(it.key)"
                        >
                          <component :is="it.icon" v-if="it.icon" />
                          <span v-else class="docs-insert-glyph">{{ it.glyph }}</span>
                        </button>
                      </div>

                      <div class="docs-insert-label">常用</div>
                      <div class="docs-insert-list">
                        <div
                          v-for="it in insertCommons"
                          :key="it.key"
                          class="docs-insert-item"
                          :class="{ 'has-sub': !!it.sub, 'is-sub-open': activeInsertSub === it.key }"
                          @mouseenter="activeInsertSub = it.sub ? it.key : ''"
                          @click="it.sub ? (activeInsertSub = it.key) : applyInsert(it.key)"
                        >
                          <component :is="it.icon" class="docs-insert-item-icon" :style="{ color: it.color, background: `color-mix(in srgb, ${it.color} 10%, transparent)` }" />
                          <span class="docs-insert-item-label">{{ it.label }}</span>
                          <RightOutlined v-if="it.sub" class="docs-insert-item-caret" />
                          <div v-if="it.sub && activeInsertSub === it.key" class="docs-insert-sub">
                            <button
                              v-for="s in it.sub"
                              :key="s.key"
                              type="button"
                              class="docs-insert-sub-item"
                              @click.stop="applyInsert(s.key)"
                            >{{ s.label }}</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 富文本块的类型手柄菜单：块转换 / 缩进对齐 / 颜色 / 剪贴板 -->
                    <div v-else class="docs-block-panel" @mousedown.stop @click.stop>
                      <div class="docs-block-grid">
                        <a-tooltip v-for="it in blockConvertBtns" :key="it.key" :title="it.title" placement="bottom">
                          <button
                            type="button"
                            class="docs-insert-cell"
                            :class="{ 'is-active': hoverBlockType === it.key }"
                            @mouseenter="activeBlockSub = ''"
                            @click="applyBlockCmd(it.key)"
                          >
                            <component :is="it.icon" v-if="it.icon" />
                            <span v-else class="docs-insert-glyph">{{ it.glyph }}</span>
                          </button>
                        </a-tooltip>
                      </div>
                      <div class="docs-block-grid">
                        <a-tooltip v-for="it in blockExtraBtns" :key="it.key" :title="it.title" placement="bottom">
                          <button
                            type="button"
                            class="docs-insert-cell"
                            :class="{ 'is-active': hoverBlockType === it.key }"
                            @mouseenter="activeBlockSub = ''"
                            @click="applyBlockCmd(it.key)"
                          >
                            <component :is="it.icon" v-if="it.icon" />
                            <span v-else class="docs-insert-glyph">{{ it.glyph }}</span>
                          </button>
                        </a-tooltip>
                      </div>

                      <div class="docs-block-divider" />

                      <div
                        v-for="it in blockSubItems"
                        :key="it.key"
                        class="docs-insert-item"
                        :class="{ 'is-sub-open': activeBlockSub === it.key }"
                        @mouseenter="activeBlockSub = it.key"
                        @click="activeBlockSub = activeBlockSub === it.key ? '' : it.key"
                      >
                        <component :is="it.icon" class="docs-block-row-icon" />
                        <span class="docs-insert-item-label">{{ it.label }}</span>
                        <RightOutlined class="docs-insert-item-caret" />
                        <div v-if="activeBlockSub === it.key" class="docs-insert-sub">
                          <template v-if="it.sub.length">
                            <button
                              v-for="s in it.sub"
                              :key="s.key"
                              type="button"
                              class="docs-insert-sub-item"
                              @click.stop="applyBlockCmd(s.key)"
                            >{{ s.label }}</button>
                          </template>
                          <template v-else>
                            <div class="docs-block-colors">
                              <button
                                v-for="c in bubbleColors"
                                :key="c"
                                type="button"
                                class="docs-bubble-color"
                                :style="{ background: c }"
                                :title="`高亮 ${c}`"
                                @click.stop="applyBlockCmd('highlight', c)"
                              ></button>
                            </div>
                            <button type="button" class="docs-insert-sub-item" @click.stop="applyBlockCmd('unhighlight')">
                              清除颜色
                            </button>
                          </template>
                        </div>
                      </div>

                      <div class="docs-block-divider" />

                      <div
                        v-for="it in blockClipItems"
                        :key="it.key"
                        class="docs-insert-item"
                        :class="{ 'is-danger': it.danger }"
                        @mouseenter="activeBlockSub = ''"
                        @click="applyBlockCmd(it.key)"
                      >
                        <component :is="it.icon" class="docs-block-row-icon" />
                        <span class="docs-insert-item-label">{{ it.label }}</span>
                      </div>

                      <div class="docs-block-divider" />

                      <div
                        v-for="it in blockDocItems"
                        :key="it.key"
                        class="docs-insert-item"
                        @mouseenter="activeBlockSub = ''"
                        @click="applyBlockCmd(it.key)"
                      >
                        <component :is="it.icon" class="docs-block-row-icon" />
                        <span class="docs-insert-item-label">{{ it.label }}</span>
                      </div>

                      <div class="docs-block-divider" />

                      <div
                        class="docs-insert-item"
                        :class="{ 'is-sub-open': activeBlockSub === 'below' }"
                        @mouseenter="activeBlockSub = 'below'"
                        @click="activeBlockSub = activeBlockSub === 'below' ? '' : 'below'"
                      >
                        <PlusSquareOutlined class="docs-block-row-icon" />
                        <span class="docs-insert-item-label">在下方添加</span>
                        <RightOutlined class="docs-insert-item-caret" />
                        <div v-if="activeBlockSub === 'below'" class="docs-insert-sub">
                          <button
                            v-for="s in blockAddItems"
                            :key="s.key"
                            type="button"
                            class="docs-insert-sub-item"
                            @click.stop="applyBlockCmd('below', s.key)"
                          >{{ s.label }}</button>
                        </div>
                      </div>
                    </div>
                  </template>
                </a-dropdown>
                <input ref="imageInputRef" type="file" accept="image/*" class="docs-hidden-file" @change="onImagePicked" />
                <input ref="fileInputRef" type="file" class="docs-hidden-file" @change="onAttachPicked" />
              </div>
              <DocSheetEditor
                v-else-if="activeDoc.type === 'sheet'"
                :key="`sheet-${activeDoc.id}`"
                :rows="sheetRows(activeDoc)"
                @change="onDocChanged(activeDoc)"
              />
              <DocMindmapEditor
                v-else-if="activeDoc.type === 'mindmap'"
                :key="`mind-${activeDoc.id}`"
                :root="mindRoot(activeDoc)"
                @change="onDocChanged(activeDoc)"
              />
              <DocFlowEditor
                v-else-if="activeDoc.type === 'flow'"
                :key="`flow-${activeDoc.id}`"
                :graph="flowGraph(activeDoc)"
                @change="onFlowChange(activeDoc, $event)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 回收站 -->
      <div v-else-if="navMode === 'trash'" class="docs-home">
        <header class="docs-home-head">
          <div>
            <h1 class="docs-home-title">回收站</h1>
          </div>
          <button v-if="trash.length" type="button" class="docs-home-new docs-home-clear" @click="emptyTrash">清空回收站</button>
        </header>
        <table v-if="trash.length" class="docs-table">
          <thead>
            <tr>
              <th>标题</th>
              <th class="docs-col-location">位置</th>
              <th class="docs-trash-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in trash" :key="d.id">
              <td>
                <span class="docs-table-title">
                  <DocTypeIcon :type="d.type" />
                  <span>{{ d.title || '无标题文档' }}</span>
                </span>
              </td>
              <td class="docs-table-muted">{{ folderNameOf(d) || '未分组' }}</td>
              <td class="docs-trash-actions">
                <button type="button" class="docs-trash-btn" @click="restoreDoc(d)">恢复</button>
                <button type="button" class="docs-trash-btn danger" @click="purgeDoc(d)">彻底删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="docs-home-empty">回收站是空的</div>
      </div>

      <!-- 知识库列表 -->
      <div v-else-if="navMode === 'library'" class="docs-home">
        <header class="docs-home-head">
          <div>
            <h1 class="docs-home-title">知识库</h1>
          </div>
          <button type="button" class="docs-home-new" @click="openCreateFolder"><PlusOutlined /> 新建知识库</button>
        </header>
        <div class="docs-library-grid">
          <button
            v-for="f in folders"
            :key="f.id"
            type="button"
            class="docs-library-card"
            @click="openLibrary(f)"
          >
            <span class="docs-library-icon"><FolderFilled /></span>
            <span class="docs-library-name">{{ f.name }}</span>
            <span class="docs-library-meta">{{ docsOfFolder(f) }} 篇文档</span>
          </button>
        </div>
        <div v-if="!folders.length" class="docs-home-empty">还没有知识库，点击右上角新建</div>
      </div>

      <!-- 文档列表首页 -->
      <div v-else class="docs-home">
        <header class="docs-home-head">
          <div>
            <h1 class="docs-home-title">{{ navMode === 'starred' ? '收藏' : navMode === 'shared' ? '与我共享' : navMode === 'owned' ? '归我所有' : '主页' }}</h1>
          </div>
        </header>

        <!-- 快捷入口：新建 / 上传 / 模板库 -->
        <div class="docs-quick-cards">
          <a-dropdown trigger="click" placement="bottomLeft">
            <button type="button" class="docs-quick-card">
              <span class="docs-quick-icon is-new"><PlusOutlined /></span>
              <span class="docs-quick-text"><b>新建</b><small>新建文档开始协作</small></span>
              <DownOutlined class="docs-quick-caret" />
            </button>
            <template #overlay>
              <a-menu @click="onAddMenu($event)">
                <a-menu-item key="doc">新建文档</a-menu-item>
                <a-menu-item key="sheet">新建表格</a-menu-item>
                <a-menu-item key="mindmap">新建思维导图</a-menu-item>
                <a-menu-item key="flow">新建流程图</a-menu-item>
                <a-menu-item key="folder">新建文件夹</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <a-dropdown trigger="click" placement="bottomLeft">
            <button type="button" class="docs-quick-card">
              <span class="docs-quick-icon is-upload"><UploadOutlined /></span>
              <span class="docs-quick-text"><b>上传</b><small>上传本地文件</small></span>
              <DownOutlined class="docs-quick-caret" />
            </button>
            <template #overlay>
              <a-menu @click="onUploadMenu($event)">
                <a-menu-item key="md">Markdown (.md)</a-menu-item>
                <a-menu-item key="txt">文本 (.txt)</a-menu-item>
                <a-menu-item key="html">网页 (.html)</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <a-dropdown trigger="click" placement="bottomLeft">
            <button type="button" class="docs-quick-card">
              <span class="docs-quick-icon is-template"><AppstoreOutlined /></span>
              <span class="docs-quick-text"><b>模板库</b><small>选择模板快速新建</small></span>
            </button>
            <template #overlay>
              <a-menu @click="onTemplateMenu($event)">
                <a-menu-item key="meeting">会议纪要</a-menu-item>
                <a-menu-item key="weekly">周报</a-menu-item>
                <a-menu-item key="prd">产品需求文档</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>

        <input
          ref="uploadInput"
          type="file"
          class="docs-upload-input"
          :accept="uploadAccept"
          @change="onFileSelected"
        />

        <div class="docs-home-toolbar">
          <div class="docs-home-tabs">
            <button type="button" :class="{ active: navMode === 'recent' }" @click="switchNav('recent')">最近访问</button>
            <button type="button" :class="{ active: navMode === 'owned' }" @click="switchNav('owned')">归我所有</button>
            <button type="button" :class="{ active: navMode === 'shared' }" @click="switchNav('shared')">与我共享</button>
            <button type="button" :class="{ active: navMode === 'starred' }" @click="switchNav('starred')">收藏</button>
          </div>
          <div class="docs-home-right">
            <a-select v-model:value="sortBy" size="small" :options="SORT_OPTIONS" class="docs-home-sort">
              <template #suffixIcon><SortAscendingOutlined class="docs-sort-icon" /></template>
            </a-select>
            <div class="docs-view-toggle">
              <button type="button" :class="{ active: listView === 'list' }" title="列表视图" @click="listView = 'list'"><UnorderedListOutlined /></button>
              <button type="button" :class="{ active: listView === 'grid' }" title="网格视图" @click="listView = 'grid'"><AppstoreOutlined /></button>
            </div>
          </div>
        </div>

        <table v-if="listView === 'list'" class="docs-table">
          <thead>
            <tr>
              <th>标题</th>
              <th class="docs-col-location">位置</th>
              <th class="docs-col-owner">所有者</th>
              <th class="docs-col-time">创建时间</th>
              <th class="docs-col-time">最近访问</th>
              <th class="docs-col-op"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in listDocs" :key="d.id" @click="openDocInNewPage(d)">
              <td>
                <span class="docs-table-title">
                  <DocTypeIcon :type="d.type" />
                  <span>{{ d.title || '无标题文档' }}</span>
                  <StarFilled v-if="d.starred" class="docs-item-star" />
                </span>
              </td>
              <td class="docs-table-muted">{{ folderNameOf(d) || '未分组' }}</td>
              <td class="docs-table-muted">{{ ownerName }}</td>
              <td class="docs-table-muted">{{ formatDate(d.createdAt) }}</td>
              <td class="docs-table-muted">{{ formatSmartTime(d.updatedAt) }}</td>
              <td class="docs-col-op" @click.stop>
                <a-dropdown trigger="click" placement="bottomRight">
                  <span class="docs-table-more"><MoreOutlined /></span>
                  <template #overlay>
                    <a-menu @click="onDocMenu($event, d)">
                      <a-menu-item key="star">{{ d.starred ? '取消收藏' : '收藏' }}</a-menu-item>
                      <a-sub-menu key="move" title="移动到">
                        <a-menu-item key="move:none">未分组</a-menu-item>
                        <a-menu-item v-for="f in folders" :key="`move:${f.id}`">{{ f.name }}</a-menu-item>
                      </a-sub-menu>
                      <a-menu-item key="delete" danger>删除</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="docs-grid">
          <button v-for="d in listDocs" :key="d.id" type="button" class="docs-grid-card" @click="openDocInNewPage(d)">
            <DocTypeIcon :type="d.type" size="md" />
            <span class="docs-grid-title">{{ d.title || '无标题文档' }}</span>
            <span class="docs-grid-meta">{{ folderNameOf(d) || '未分组' }} · {{ formatSmartTime(d.updatedAt) }}</span>
            <StarFilled v-if="d.starred" class="docs-grid-star" />
          </button>
        </div>
        <div v-if="!listDocs.length" class="docs-home-empty">
          {{ keyword ? '没有匹配的文档' : navMode === 'shared' ? '暂无共享文档' : '还没有文档，点击上方卡片新建' }}
        </div>
      </div>
    </main>

    <!-- 新建 / 重命名文件夹 -->
    <a-modal
      v-model:open="folderModalOpen"
      :title="folderForm.id ? '重命名文件夹' : '新建文件夹'"
      :width="360"
      centered
      :footer="null"
      destroy-on-close
      class="docs-folder-modal"
    >
      <a-input
        v-model:value="folderForm.name"
        placeholder="文件夹名称"
        :maxlength="30"
        @press-enter="submitFolder"
      />
      <div class="docs-folder-modal-footer">
        <a-button @click="folderModalOpen = false">取消</a-button>
        <a-button type="primary" @click="submitFolder">确定</a-button>
      </div>
    </a-modal>

    <!-- 选中文字后的浮动格式工具栏 -->
    <Teleport to="body">
    <div
      v-if="bubble.visible"
      ref="bubbleRef"
      class="docs-bubble"
      :style="{ top: bubble.top + 'px', left: bubble.left + 'px' }"
      @mousedown.prevent
    >
      <div class="docs-bubble-group">
        <a-tooltip title="标题样式" placement="bottom">
          <button
            type="button"
            class="docs-bubble-btn is-label"
            :class="{ 'is-open': bubble.menu === 'heading' }"
            @click="toggleBubbleMenu('heading')"
          >
            {{ bubble.block }}<DownOutlined class="docs-bubble-caret" />
          </button>
        </a-tooltip>
        <div v-if="bubble.menu === 'heading'" class="docs-bubble-menu">
          <button
            v-for="o in bubbleHeadings"
            :key="o.key"
            type="button"
            class="docs-bubble-menu-item"
            :class="{ 'is-active': bubble.block === (o.key === 'p' ? '正文' : o.key.toUpperCase()) }"
            @click="applyBubble(o.key)"
          >{{ o.label }}</button>
        </div>
      </div>

      <div class="docs-bubble-group">
        <a-tooltip title="列表样式" placement="bottom">
          <button
            type="button"
            class="docs-bubble-btn"
            :class="{ 'is-open': bubble.menu === 'list' }"
            @click="toggleBubbleMenu('list')"
          >
            <UnorderedListOutlined /><DownOutlined class="docs-bubble-caret" />
          </button>
        </a-tooltip>
        <div v-if="bubble.menu === 'list'" class="docs-bubble-menu">
          <button
            v-for="o in bubbleLists"
            :key="o.key"
            type="button"
            class="docs-bubble-menu-item"
            @click="applyBubble(o.key)"
          >{{ o.label }}</button>
        </div>
      </div>

      <span class="docs-bubble-sep" />

      <a-tooltip title="加粗" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('bold')"><BoldOutlined /></button>
      </a-tooltip>
      <a-tooltip title="删除线" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('strike')"><StrikethroughOutlined /></button>
      </a-tooltip>
      <a-tooltip title="斜体" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('italic')"><ItalicOutlined /></button>
      </a-tooltip>
      <a-tooltip title="下划线" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('underline')"><UnderlineOutlined /></button>
      </a-tooltip>
      <a-tooltip title="链接" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('link')"><LinkOutlined /></button>
      </a-tooltip>
      <a-tooltip title="行内代码" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('inline-code')">
          <CodeOutlined />
        </button>
      </a-tooltip>

      <div class="docs-bubble-group">
        <a-tooltip title="高亮颜色" placement="bottom">
          <button
            type="button"
            class="docs-bubble-btn"
            :class="{ 'is-open': bubble.menu === 'color' }"
            @click="toggleBubbleMenu('color')"
          >
            <span class="docs-bubble-mark">A</span><DownOutlined class="docs-bubble-caret" />
          </button>
        </a-tooltip>
        <div v-if="bubble.menu === 'color'" class="docs-bubble-menu is-right docs-bubble-colors">
          <a-tooltip v-for="(c, i) in bubbleColors" :key="c" :title="bubbleColorNames[i]" placement="bottom">
            <button
              type="button"
              class="docs-bubble-color"
              :style="{ background: c }"
              @click="applyBubble('highlight', c)"
            ></button>
          </a-tooltip>
          <button type="button" class="docs-bubble-clear-color" @click="applyBubble('unhighlight')">清除高亮</button>
        </div>
      </div>

      <span class="docs-bubble-sep" />
      <a-tooltip title="清除格式" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('clear')"><ClearOutlined /></button>
      </a-tooltip>
    </div>
    </Teleport>

    <!-- “/”斜杠插入菜单（参考飞书）：输入 / 唤起，关键词过滤 + ↑↓ 选择 + 回车插入 -->
    <Teleport to="body">
      <div
        v-if="slash.visible"
        class="docs-slash"
        :style="{ top: slash.top + 'px', left: slash.left + 'px' }"
        @mousedown.prevent
      >
        <div class="docs-slash-title">插入{{ slash.keyword ? ` · “${slash.keyword}”` : '' }}</div>
        <button
          v-for="(it, i) in slashFiltered"
          :key="it.key"
          type="button"
          class="docs-slash-item"
          :class="{ 'is-active': i === slash.active }"
          @mouseenter="slash.active = i"
          @click="applySlashInsert(it)"
        >
          <span class="docs-slash-icon">
            <component :is="it.icon" v-if="it.icon" />
            <template v-else>{{ it.glyph }}</template>
          </span>
          <span class="docs-slash-label">{{ it.label }}</span>
        </button>
        <div v-if="!slashFiltered.length" class="docs-slash-empty">没有匹配的插入项</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.docs-page {
  /* 父级 workbench-panel 在文档页已无内边距，直接占满 */
  height: 100%;
  width: 100%;
  margin: 0;
  display: flex;
  background: var(--docs-canvas);
  color: var(--docs-text);
  font-family: var(--docs-font);
}

/* ---- 左侧：知识库 / 文件树 ---- */
.docs-side {
  flex: 0 0 304px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 12px 14px;
  background: var(--docs-nav-bg);
  border-right: 1px solid var(--docs-border);
}
.docs-side-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px 4px;
}
/* 折叠按钮：固定在左侧，Logo 与标题整体居中 */
.docs-side-fold {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(calc(-50% - 2px));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 28px;
  height: 28px;
  font-size: 15px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-side-fold:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
/* 折叠态：左侧菜单完全隐藏，展开入口在顶部菜单左侧 */
.docs-page.is-side-collapsed .docs-side {
  display: none;
}
.docs-page.is-side-collapsed .docs-side-head {
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 0;
  padding: 12px 8px 4px;
}
.docs-page.is-side-collapsed .docs-side-fold {
  position: static;
  transform: none;
}
.docs-page.is-side-collapsed .docs-side-brand {
  display: none;
}
.docs-page.is-side-collapsed .docs-search-wrap,
.docs-page.is-side-collapsed .docs-nav,
.docs-page.is-side-collapsed .docs-list,
.docs-page.is-side-collapsed .docs-trash-entry {
  display: none;
}
.docs-side-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.docs-side-logo {
  flex: none;
  display: block;
  width: 34px;
  height: 34px;
  padding: 5px;
  box-sizing: border-box;
  background: linear-gradient(135deg, var(--docs-selected) 0%, var(--c-primary-bg-hover) 100%);
  border-radius: 9px;
}
.docs-side-logo :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.docs-side-brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.docs-side-title {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--docs-text);
}
.docs-side-sub {
  margin-top: 1px;
  font-size: 10px;
  line-height: 1.3;
  color: var(--docs-text-3);
}
.docs-search-wrap {
  position: relative;
}
.docs-search {
  height: 36px;
  padding-right: 44px;
  border-color: var(--docs-border);
  border-radius: var(--docs-radius);
  background: var(--docs-canvas);
  box-shadow: none;
}
.docs-search:hover {
  border-color: var(--docs-border-strong);
}
.docs-search:focus-within {
  border-color: var(--c-primary);
  background: var(--docs-canvas);
}
.docs-search-icon {
  color: var(--docs-text-3);
}
.docs-search-kbd {
  position: absolute;
  top: 50%;
  right: 8px;
  padding: 1px 5px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--docs-text-3);
  background: var(--docs-hover);
  border-radius: var(--docs-radius-sm);
  transform: translateY(-50%);
  pointer-events: none;
}
/* 分组标题（置顶文档 / 置顶知识库 / 我的文档库） */
.docs-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.docs-group-title {
  padding: 8px 8px 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--docs-text-3);
}
/* 置顶区：一行一个 */
.docs-pinned-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
}
.docs-pinned-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  font-size: 13px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-pinned-item:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.docs-pinned-item.active {
  color: var(--c-primary);
  background: var(--docs-selected);
}
.docs-pinned-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-group-title-main {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--docs-border);
}

.docs-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 2px;
}

/* 知识库卡片 */
.docs-library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 20px;
}
.docs-library-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  text-align: left;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.docs-library-card:hover {
  border-color: var(--docs-border-strong);
}
.docs-library-icon {
  font-size: 28px;
  color: var(--docs-warn);
}
.docs-library-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-library-meta {
  font-size: 12px;
  color: var(--docs-text-3);
}

/* 飞书式主导航 */
.docs-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.docs-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  font-size: 14px;
  color: var(--docs-text);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-nav-item :deep(.anticon) {
  font-size: 15px;
  color: var(--docs-text-2);
}
.docs-nav-item:hover {
  background: var(--docs-hover);
}
.docs-nav-item.active {
  color: var(--c-primary);
  background: var(--docs-selected);
}
.docs-nav-item.active :deep(.anticon) {
  color: var(--c-primary);
}
/* 侧栏底部：文档统计 + 新建 */
/* 回收站入口 */
.docs-trash-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  font-size: 14px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-trash-entry:hover {
  background: var(--docs-hover);
}
.docs-trash-entry.active {
  color: var(--c-primary);
  background: var(--docs-selected);
}
.docs-trash-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--docs-text-3);
}

/* 文件夹行 */
.docs-folder {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 5px 8px;
  margin-top: 2px;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s;
}
.docs-folder:hover {
  background: var(--docs-hover);
}
.docs-folder.active {
  background: var(--docs-selected);
}
.docs-folder.active .docs-folder-name {
  color: var(--c-primary);
}
.docs-folder-caret {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  font-size: 9px;
  color: var(--docs-text-3);
  transition: transform 0.15s;
}
.docs-folder-caret.open {
  transform: rotate(90deg);
}
.docs-folder-icon {
  flex: none;
  font-size: 15px;
  color: var(--docs-warn);
}
.docs-folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: var(--docs-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-folder-count {
  flex: none;
  padding: 0;
  font-size: 12px;
  line-height: 16px;
  color: var(--docs-text-3);
  text-align: center;
  background: transparent;
  border-radius: 0;
}
.docs-folder.active .docs-folder-count {
  color: var(--docs-text-2);
  background: transparent;
}
.docs-folder-more {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 11px;
  color: var(--docs-text-3);
  border-radius: var(--docs-radius-sm);
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}
.docs-folder:hover .docs-folder-more {
  opacity: 1;
}
.docs-folder-more:hover {
  background: var(--docs-hover);
}
.docs-folder.is-ungrouped {
  cursor: default;
}
.docs-folder.is-ungrouped:hover {
  background: transparent;
}
.docs-folder-empty {
  padding: 5px 8px 5px 30px;
  font-size: 12px;
  color: var(--docs-text-3);
}

/* 文档行 */
.docs-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  padding: 5px 8px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s;
}
.docs-item.grouped {
  padding-left: 30px;
}
.docs-item:hover {
  background: var(--docs-hover);
}
.docs-item.active {
  background: var(--docs-selected);
  box-shadow: none;
}
.docs-item.active .docs-item-title-text {
  color: var(--c-primary);
  font-weight: 500;
}
.docs-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.docs-item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--docs-text);
}
.docs-item-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-item-type {
  flex: none;
}
.docs-item-meta {
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-item-more {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 11px;
  color: var(--docs-text-3);
  border-radius: var(--docs-radius-sm);
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}
.docs-item:hover .docs-item-more {
  opacity: 1;
}
.docs-item-more:hover {
  background: var(--docs-hover);
}
.docs-list-empty {
  padding: 28px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--docs-text-3);
  text-align: center;
}

/* ---- 右侧编辑区 ---- */
.docs-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  /* 左侧菜单直达顶部后，右侧内容区顶部为顶栏（仅覆盖右侧）预留高度 */
  padding-top: var(--app-header-height, 56px);
  background: var(--docs-canvas);
}
/* 正文 + 右侧大纲 */
.docs-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.docs-outline {
  flex: 0 0 250px;
  overflow-y: auto;
  padding: 28px 14px;
  background: var(--docs-canvas);
}
.docs-outline-title {
  padding: 0 8px 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--docs-text-3);
}
.docs-outline-item {
  display: block;
  width: 100%;
  padding: 4px 8px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  color: var(--docs-text-2);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  transition: color 0.12s, background 0.12s, border-color 0.12s;
}
.docs-outline-item:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
  border-left-color: var(--c-primary);
}
.docs-outline-item.is-h3 {
  padding-left: 20px;
  font-size: 12px;
  color: var(--docs-text-3);
}

/* 正文画布 */
.docs-canvas {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--docs-canvas);
  display: flex;
  flex-direction: column;
}
.docs-canvas-inner {
  flex: 1 0 auto;
  width: 100%;
  /* 正文撑满画布：不限宽、不居中，宽高都占满可视区域 */
  max-width: none;
  margin: 0;
  box-sizing: border-box;
  /* 四周留白收到最小：左侧 40px 只为悬停的加号 / 块手柄留位，其余各边 24px 文字安全边距 */
  padding: 24px 24px 64px 40px;
  background: var(--docs-canvas);
}
/* Mac 客户端：文档正文靠左，去掉 max-width 居中产生的大片左侧留白 */
:global(html.is-mac) .docs-canvas-inner {
  margin-left: 0;
  margin-right: auto;
}
/* 表格 / 思维导图 / 流程图：内容区零留白，编辑器自己撑满 */
.docs-canvas-inner.is-wide {
  max-width: none;
  width: 100%;
  padding: 0;
}
/* 表格：画布零留白，编辑器宽高撑满（滚动交给表格自身） */
.docs-canvas-inner.is-wide.is-sheet {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.docs-canvas-inner.is-wide.is-sheet :deep(.sheet-editor) {
  flex: 1;
  min-height: 0;
  border: none;
  border-radius: 0;
}
.docs-title-input {
  width: 100%;
  padding: 0;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
  color: var(--docs-text);
  border: none;
  outline: none;
}
.docs-title-input::placeholder {
  color: var(--docs-text-3);
}
/* 标题下方作者行：头像 · 作者 · 修改日期 */
.docs-doc-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-doc-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 12px;
  color: #fff;
  border-radius: 50%;
  user-select: none;
}
.docs-doc-author {
  font-weight: 500;
  color: var(--docs-text-2);
}
.docs-doc-sep {
  width: 1px;
  height: 12px;
  margin: 0 4px;
  background: var(--docs-border);
}
.docs-editor-wrap {
  position: relative;
  /* 左侧预留加号槽位：鼠标从正文移向加号不会离开容器，避免 mouseleave 提前藏掉加号 */
  padding-left: 34px;
  margin-left: -34px;
}
/* 悬停行的左外侧"+"插入按钮 */
.docs-block-plus {
  position: absolute;
  left: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 14px;
  color: var(--docs-text-3);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s, box-shadow 0.12s;
}
/* 鼠标悬停 / 菜单展开时颜色变暗 */
.docs-block-plus:hover,
.docs-block-plus.is-open {
  color: var(--docs-text);
  background: var(--docs-hover);
  border-color: var(--docs-border-strong);
}
/* 富文本块：不展示"+",改展示块类型 + 拖拽手柄 */
.docs-block-plus.is-block {
  gap: 3px;
  width: auto;
  min-width: 26px;
  padding: 0 5px;
  color: var(--docs-text-2);
  background: var(--docs-hover);
  border-color: transparent;
}
.docs-block-plus.is-block:hover,
.docs-block-plus.is-block.is-open {
  color: var(--docs-text);
  background: var(--docs-hover);
  border-color: transparent;
}
.docs-block-plus-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}
.docs-block-plus-drag {
  font-size: 12px;
  color: var(--docs-text-3);
}
/* "+"下拉面板：基础排版 + 常用富文本元素 */
.docs-insert-panel {
  width: 288px;
  padding: 8px 12px 12px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.docs-insert-label {
  padding: 8px 0 4px;
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-insert-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
}
.docs-insert-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  font-size: 16px;
  color: var(--docs-text);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-insert-cell:hover {
  color: var(--docs-text-2);
  background: var(--docs-hover);
}
/* 当前块类型高亮 */
.docs-insert-cell.is-active {
  color: var(--c-primary);
  background: var(--c-primary-bg);
}
.docs-insert-glyph {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
/* 块类型手柄面板 */
.docs-block-panel {
  width: 268px;
  padding: 8px 10px 10px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.docs-block-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
}
.docs-block-divider {
  height: 1px;
  margin: 8px 0 6px;
  background: var(--docs-border);
}
.docs-block-row-icon {
  flex: none;
  font-size: 16px;
  color: var(--docs-text-2);
}
/* 删除类操作：悬停转为警示色 */
.docs-insert-item.is-danger:hover .docs-insert-item-label,
.docs-insert-item.is-danger:hover .docs-block-row-icon {
  color: var(--docs-danger);
}
.docs-block-colors {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 6px;
}
.docs-insert-list {
  display: flex;
  flex-direction: column;
}
.docs-insert-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 8px;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s;
}
.docs-insert-item:hover,
.docs-insert-item.is-sub-open {
  background: var(--docs-hover);
}
.docs-insert-item-icon {
  flex: none;
  width: 26px;
  height: 26px;
  padding: 5px;
  font-size: 15px;
  border-radius: var(--docs-radius);
  box-sizing: border-box;
}
.docs-insert-item-label {
  flex: 1;
  font-size: 14px;
  color: var(--docs-text);
}
.docs-insert-item-caret {
  flex: none;
  font-size: 11px;
  color: var(--docs-text-3);
}
.docs-insert-sub {
  position: absolute;
  top: -6px;
  left: calc(100% + 4px);
  z-index: 10;
  min-width: 148px;
  padding: 6px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.docs-insert-sub-item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--docs-text);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.docs-insert-sub-item:hover {
  background: var(--docs-hover);
}
.docs-hidden-file {
  display: none;
}
/* “/”斜杠插入菜单 */
.docs-slash {
  position: fixed;
  z-index: 1400;
  width: 272px;
  /* 矮窗口兼容：不超过视口高度的 60%，避免菜单底部被截断 */
  max-height: min(340px, 60vh);
  padding: 6px;
  overflow-y: auto;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.docs-slash-title {
  padding: 6px 8px 4px;
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-slash-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  color: var(--docs-text);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.docs-slash-item.is-active {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.docs-slash-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 12px;
  font-weight: 600;
  color: var(--docs-text-2);
  background: var(--docs-side-bg);
  border-radius: 5px;
}
.docs-slash-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-slash-empty {
  padding: 14px 8px;
  font-size: 13px;
  color: var(--docs-text-3);
  text-align: center;
}
/* 选中文字的浮动格式工具栏 */
.docs-bubble {
  position: fixed;
  z-index: 1400;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
  transform: translateX(-50%);
  white-space: nowrap;
  user-select: none;
}
.docs-bubble-group {
  position: relative;
  display: flex;
}
.docs-bubble-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 30px;
  height: 30px;
  padding: 0 5px;
  font-size: 15px;
  color: var(--docs-text);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-bubble-btn:hover,
.docs-bubble-btn.is-open {
  background: var(--docs-hover);
}
.docs-bubble-btn.is-label {
  min-width: 44px;
  font-size: 13px;
  font-weight: 600;
}
.docs-bubble-caret {
  font-size: 10px;
  color: var(--docs-text-3);
}
.docs-bubble-sep {
  flex: none;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--docs-border);
}
/* 高亮按钮：字母 A 带色条 */
.docs-bubble-mark {
  position: relative;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}
.docs-bubble-mark::after {
  content: '';
  position: absolute;
  left: -1px;
  right: -1px;
  bottom: -4px;
  height: 3px;
  background: #ffe58f;
  border-radius: 2px;
}
.docs-bubble-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 5;
  min-width: 132px;
  padding: 6px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.docs-bubble-menu.is-right {
  left: auto;
  right: 0;
}
.docs-bubble-menu-item {
  display: block;
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--docs-text);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.docs-bubble-menu-item:hover,
.docs-bubble-menu-item.is-active {
  background: var(--docs-hover);
}
.docs-bubble-colors {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
}
.docs-bubble-color {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 50%;
  cursor: pointer;
}
.docs-bubble-color:hover {
  transform: scale(1.1);
}
.docs-bubble-clear-color {
  padding: 0 4px;
  font-size: 12px;
  color: var(--docs-text-2);
  white-space: nowrap;
  background: transparent;
  border: none;
  cursor: pointer;
}
.docs-bubble-clear-color:hover {
  color: var(--docs-text);
}
.docs-editor {
  position: relative;
  min-height: 46vh;
  /* 正文顶部间距收紧：不再与作者行、首个块的 margin 叠加出大片留白 */
  padding: 0 0 40px;
  font-size: 15px;
  line-height: 1.75;
  color: var(--docs-text);
  outline: none;
}
/* 首个块去掉自带的上外边距，避免顶部留白翻倍 */
.docs-editor > :first-child {
  margin-top: 0;
}
/* 正文数据为空时显示输入提示：绝对定位在内容首行，不参与排版，
   避免提示与光标相互挤行（提示把光标顶下去 / 光标掉到提示下面） */
.docs-editor.is-empty::before {
  content: attr(data-placeholder);
  position: absolute;
  top: 0; /* 与编辑器 padding-top 对齐（已为 0），即内容首行 */
  left: 0;
  color: var(--docs-text-3);
  pointer-events: none;
}
.docs-editor :deep(h1) {
  margin: 34px 0 12px;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
}
.docs-editor :deep(h2) {
  margin: 30px 0 10px;
  font-size: 21px;
  font-weight: 600;
  line-height: 1.3;
}
.docs-editor :deep(h3) {
  margin: 24px 0 8px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}
/* "+"插入的富文本元素 */
/* 编辑模式：鼠标悬停块级元素时展示背景色（段落 / 标题 / 有序无序列表 / 待办任务 / 引用等） */
.docs-editor-wrap.is-edit .docs-editor :deep(p:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(h1:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(h2:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(h3:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(li:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(.docs-todo:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(blockquote:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(pre:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(.docs-callout:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(.docs-cols:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(.docs-insert-table:hover),
.docs-editor-wrap.is-edit .docs-editor :deep(.docs-img:hover) {
  background: var(--docs-side-bg);
  border-radius: var(--docs-radius-sm);
}
.docs-editor :deep(.docs-img) {
  display: block;
  max-width: 100%;
  margin: 12px 0;
  border-radius: var(--docs-radius);
}
/* 不用 flex 布局：contenteditable 里的 flex 容器会让 Chrome 把光标画到容器底部（光标偏下），
   改为块级排版 + 绝对定位勾选框，文字保持普通行内排版，光标高度与文字一致 */
.docs-editor :deep(.docs-todo) {
  position: relative;
  margin: 3px 0;
  /* 勾选框贴左（16px）+ 8px 间距 */
  padding-left: 24px;
  box-sizing: border-box;
}
.docs-editor :deep(.docs-todo-box) {
  position: absolute;
  /* 与列表符号对齐：ul 圆点墨迹约在 x=6px，ol 数字右缘贴文字（x=24px），
     框左缘取 6px、宽 16px（含边框），右缘 22px 恰在文字（24px）之前 */
  left: 6px;
  /* 16px 勾选框在 1.75 行高（28px）文字行内垂直居中 */
  top: 6px;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  background: var(--docs-canvas);
  border: 1.5px solid var(--docs-border-strong);
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
}
/* 勾选后：不整块填充颜色，只描蓝边 + 显示蓝色对勾 */
.docs-editor :deep(.docs-todo.is-done .docs-todo-box) {
  border-color: var(--c-primary);
}
/* CSS 画对勾（伪元素不参与 innerHTML 保存，不会污染文档内容） */
.docs-editor :deep(.docs-todo.is-done .docs-todo-box)::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 2px;
  width: 5px;
  height: 9px;
  border: solid var(--c-primary);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.docs-editor :deep(.docs-todo.is-done .docs-todo-text) {
  color: var(--docs-text-3);
  text-decoration: line-through;
}
.docs-editor :deep(.docs-insert-table) {
  width: 100%;
  margin: 12px 0;
  table-layout: fixed;
  border-collapse: collapse;
}
.docs-editor :deep(.docs-insert-table td) {
  min-width: 40px;
  padding: 6px 10px;
  vertical-align: top;
  border: 1px solid var(--docs-border);
}
.docs-editor :deep(.docs-cols) {
  display: grid;
  gap: 16px;
  margin: 12px 0;
}
.docs-editor :deep(.docs-col) {
  min-height: 44px;
  padding: 8px 10px;
  border: 1px dashed var(--docs-border);
  border-radius: var(--docs-radius);
}
.docs-editor :deep(.docs-callout) {
  margin: 12px 0;
  padding: 12px 14px;
  background: #fff8e6;
  border-left: 3px solid #ffc60a;
  border-radius: var(--docs-radius);
}
.docs-editor :deep(.docs-attach) {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  margin: 4px 0;
  font-size: 13px;
  color: var(--docs-text-2);
  background: var(--docs-hover);
  border-radius: var(--docs-radius);
}
.docs-editor :deep(code) {
  padding: 1px 5px;
  font-size: 14px;
  background: var(--docs-hover);
  border-radius: var(--docs-radius-sm);
}
.docs-editor :deep(pre code) {
  padding: 0;
  background: transparent;
}
.docs-editor :deep(p) {
  margin: 0 0 10px;
}
/* 鼠标选中文案时的背景色：段落 / 有序 / 无序 / 待办 / 引用等所有块统一为主题蓝半透明 */
.docs-editor ::selection,
.docs-editor :deep(::selection),
.docs-title-input::selection {
  background: color-mix(in srgb, var(--c-primary) 24%, transparent);
  color: inherit;
}
.docs-editor :deep(ul),
.docs-editor :deep(ol) {
  margin: 10px 0;
  padding-left: 24px;
}
/* 有序列表序号 / 无序列表圆点显示为主题蓝 */
.docs-editor :deep(ol li)::marker,
.docs-editor :deep(ul li)::marker {
  color: var(--c-primary);
  font-weight: 600;
}
.docs-editor :deep(li) {
  margin: 3px 0;
}
.docs-editor :deep(blockquote) {
  margin: 12px 0;
  padding: 4px 0 4px 14px;
  color: var(--docs-text-2);
  border-left: 3px solid var(--docs-border);
}
.docs-editor :deep(pre) {
  margin: 12px 0;
  padding: 12px 14px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
  color: var(--docs-text);
  white-space: pre-wrap;
  background: var(--docs-side-bg);
  border-radius: var(--docs-radius);
}
.docs-editor :deep(hr) {
  margin: 24px 0;
  border: none;
  border-top: 1px solid var(--docs-border);
}
.docs-editor :deep(a) {
  color: var(--c-primary);
}
.docs-item-star {
  flex: none;
  font-size: 10px;
  color: var(--docs-warn);
}
/* 宽屏 / 专注模式 */
.docs-canvas-inner.is-full {
  max-width: none;
}
.docs-page.is-focus .docs-side {
  display: none;
}
.docs-page.is-focus .docs-canvas-inner {
  max-width: none;
}

/* ---- 文档模式宽度自适应 ---- */
/* 中等宽度：目录收窄，给正文让位 */
@media (max-width: 1240px) {
  .docs-outline {
    flex-basis: 190px;
    padding: 24px 10px;
  }
}
/* 较窄宽度：隐藏目录，正文占满画布 */
@media (max-width: 1060px) {
  .docs-outline {
    display: none;
  }
  .docs-canvas-inner {
    padding: 24px 24px 64px 40px;
  }
  .docs-canvas-inner.is-full,
  .docs-page.is-focus .docs-canvas-inner {
    max-width: none;
  }
}

/* ---- 文档列表首页 ---- */
.docs-home {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 36px 48px 64px;
}
.docs-home-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

/* 快捷入口卡片：新建 / 上传 / 模板库 */
.docs-quick-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}
.docs-quick-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.docs-quick-card:hover {
  background: var(--docs-paper);
  border-color: var(--docs-border-strong);
}
.docs-quick-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 18px;
  color: #fff;
  border-radius: 9px;
}
.docs-quick-icon.is-new {
  background: linear-gradient(135deg, var(--c-primary), var(--c-primary-hover));
}
.docs-quick-icon.is-upload {
  background: var(--docs-hover);
  color: var(--docs-text-2);
}
.docs-quick-icon.is-template {
  background: var(--docs-hover);
  color: var(--docs-text-2);
}
.docs-quick-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.docs-quick-text b {
  font-size: 14px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-quick-text small {
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-quick-caret {
  flex: none;
  font-size: 11px;
  color: var(--docs-text-3);
}
.docs-upload-input {
  display: none;
}
@media (max-width: 720px) {
  .docs-quick-cards {
    grid-template-columns: 1fr;
  }
}
.docs-home-title {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--docs-text);
}
.docs-home-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-home-new {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  /* 静止底色用主题的按下色（苹果蓝 #0071E3）：白字对比度 4.7:1，达到 AA；悬停加深 */
  background: var(--c-primary-active);
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background-color var(--docs-dur) var(--docs-ease), box-shadow var(--docs-dur) var(--docs-ease);
}
.docs-home-new:hover {
  background: color-mix(in srgb, var(--c-primary-active) 88%, #000);
}
.docs-home-new:active {
  background: color-mix(in srgb, var(--c-primary-active) 78%, #000);
}
.docs-home-new:focus-visible {
  outline: none;
  box-shadow: var(--docs-focus);
}
.docs-home-clear {
  color: var(--docs-danger);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
}
.docs-home-clear:hover {
  background: color-mix(in srgb, var(--docs-danger) 8%, transparent);
}
/* 回收站操作 */
.docs-trash-actions {
  width: 160px;
  text-align: right;
  white-space: nowrap;
}
.docs-trash-btn {
  height: 26px;
  padding: 0 10px;
  margin-left: 6px;
  font-size: 12px;
  color: var(--c-primary);
  background: var(--c-primary-bg);
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s;
}
.docs-trash-btn:hover {
  background: var(--c-primary-bg-hover);
}
.docs-trash-btn.danger {
  color: var(--docs-danger);
  background: color-mix(in srgb, var(--docs-danger) 8%, transparent);
}
.docs-trash-btn.danger:hover {
  background: color-mix(in srgb, var(--docs-danger) 14%, transparent);
}
.docs-home-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
  border-bottom: 1px solid var(--docs-border);
}
.docs-home-tabs {
  display: flex;
  gap: 22px;
}
.docs-home-tabs button {
  position: relative;
  padding: 0 0 10px;
  font-size: 13px;
  color: var(--docs-text-2);
  background: none;
  border: none;
  cursor: pointer;
}
.docs-home-tabs button:hover {
  color: var(--docs-text);
}
.docs-home-tabs button.active {
  color: var(--c-primary);
  font-weight: 500;
}
.docs-home-tabs button.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--c-primary);
  border-radius: 1px;
}
.docs-home-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.docs-home-sort {
  width: 126px;
  margin-bottom: 0;
}
.docs-home-sort :deep(.ant-select-selector) {
  height: 30px !important;
  padding: 0 28px 0 10px !important;
  background: var(--docs-side-bg) !important;
  border-color: transparent !important;
  border-radius: var(--docs-radius) !important;
  box-shadow: none !important;
}
.docs-home-sort:hover :deep(.ant-select-selector) {
  background: var(--docs-hover) !important;
}
.docs-home-sort :deep(.ant-select-selection-item) {
  font-size: 12px;
  line-height: 28px !important;
  color: var(--docs-text-2);
}
.docs-sort-icon {
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-view-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--docs-hover);
  border-radius: var(--docs-radius);
}
.docs-view-toggle button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  font-size: 13px;
  color: var(--docs-text-3);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-view-toggle button.active {
  color: var(--docs-text);
  background: var(--docs-canvas);
}
.docs-col-owner {
  width: 14%;
}
.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.docs-grid-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  text-align: left;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.docs-grid-card:hover {
  border-color: var(--docs-border-strong);
}
.docs-grid-title {
  width: 100%;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: var(--docs-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-grid-meta {
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-grid-star {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 12px;
  color: var(--docs-warn);
}
.docs-table {
  width: 100%;
  margin-top: 6px;
  border-collapse: collapse;
  table-layout: fixed;
}
.docs-table th {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 400;
  color: var(--docs-text-3);
  text-align: left;
  border-bottom: 1px solid var(--docs-border);
}
.docs-table td {
  padding: 0 12px;
  overflow: hidden;
  font-size: 14px;
  color: var(--docs-text);
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid var(--docs-border);
  height: 40px;
}
.docs-table tbody tr {
  cursor: pointer;
  transition: background 0.12s;
}
.docs-table tbody tr:hover {
  background: var(--docs-hover);
}
.docs-table-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-weight: 500;
}
.docs-table-title > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-table-muted {
  color: var(--docs-text-3) !important;
  font-size: 12px !important;
}
.docs-col-location {
  width: 18%;
}
.docs-col-time {
  width: 16%;
}
.docs-col-op {
  width: 44px;
  text-align: right;
}
.docs-table-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--docs-text-3);
  border-radius: var(--docs-radius);
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}
.docs-table tbody tr:hover .docs-table-more {
  opacity: 1;
}
.docs-table-more:hover {
  background: var(--docs-hover);
}
.docs-home-empty {
  padding: 60px 0;
  font-size: 13px;
  color: var(--docs-text-3);
  text-align: center;
}

/* ---- 空态 ---- */
.docs-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--docs-text-3);
}
.docs-empty-icon {
  font-size: 36px;
  color: var(--docs-border-strong);
}
.docs-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-empty-desc {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--docs-text-3);
}

/* 文件夹弹窗 */
.docs-folder-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

@media (max-width: 860px) {
  .docs-side {
    flex-basis: 200px;
  }
  /* 左侧仍保留 40px 加号槽位，其余各边保持最小留白 */
  .docs-canvas-inner {
    padding: 24px 24px 64px 40px;
  }
  .docs-canvas-inner.is-wide {
    padding: 0;
  }
  .docs-title-input {
    font-size: 26px;
  }
}

/* 极窄宽度：侧栏再收窄、首页留白收紧、列表隐藏次要列，保证正文/表格可用 */
@media (max-width: 720px) {
  .docs-side {
    flex-basis: 160px;
    padding: 12px 8px 10px;
  }
  .docs-canvas-inner {
    padding: 24px 16px 64px 40px;
  }
  .docs-canvas-inner.is-wide {
    padding: 0;
  }
  .docs-title-input {
    font-size: 24px;
  }
  .docs-home {
    padding: 24px 16px 48px;
  }
  /* 标题行 / 工具行允许换行，避免排序与视图切换被挤出视口 */
  .docs-home-head,
  .docs-home-toolbar {
    flex-wrap: wrap;
  }
  .docs-col-location,
  .docs-col-time {
    display: none;
  }
}

/* ---- 高度自适应：矮窗口收紧垂直留白，保证首屏可见更多正文 ---- */
@media (max-height: 760px) {
  .docs-canvas-inner {
    padding-top: 24px;
    padding-bottom: 64px;
  }
  .docs-canvas-inner.is-wide {
    padding-top: 0;
  }
  .docs-side {
    padding-top: 12px;
  }
  .docs-home {
    padding-top: 24px;
  }
}
/* 极矮窗口（如半屏 / 小窗预览）：标题与首页留白进一步收紧 */
@media (max-height: 600px) {
  .docs-canvas-inner {
    padding-top: 24px;
  }
  .docs-title-input {
    font-size: 26px;
  }
  .docs-home {
    padding-top: 16px;
  }
}
</style>
