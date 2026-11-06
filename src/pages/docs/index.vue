<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
  OrderedListOutlined,
  UnorderedListOutlined,
  DownloadOutlined,
  StarOutlined,
  StarFilled,
  HomeOutlined,
  BookOutlined,
  LeftOutlined,
  AppstoreOutlined,
  SortAscendingOutlined,
  UploadOutlined,
  DownOutlined,
  ColumnWidthOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons-vue'
import { getLoginUsername, useAuth } from '@/utils/auth'
import type { DocType, DocFolder, DocItem, MindNode, SheetData, MindmapData, FlowData } from '@/types/docs'
import DocSheetEditor from '@/components/docs/DocSheetEditor.vue'
import DocMindmapEditor from '@/components/docs/DocMindmapEditor.vue'
import DocFlowEditor from '@/components/docs/DocFlowEditor.vue'
import DocTypeIcon from '@/components/docs/DocTypeIcon.vue'
import BeeLogo from '@/components/docs/BeeLogo.vue'

/**
 * 文档（前端本地版）
 * 后端暂无文档接口：文档 / 文件夹按登录用户存 localStorage，后续接接口时替换 loadDocs / saveDocs 即可。
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
const ownerName = computed(
  () => authUser.value?.realName || authUser.value?.coAccount || getLoginUsername() || '-',
)
/** 当前新建文档默认归属的文件夹（点击文件夹标题时更新） */
const activeFolderId = ref('')
/** 文件夹展开状态 */
const expanded = reactive<Record<string, boolean>>({})

const activeDoc = computed(() => docs.value.find((d) => d.id === activeId.value) || null)

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

/** 按登录用户隔离，避免同一浏览器不同账号看到彼此的本地文档 */
const storageKey = computed(() => `cooperise_docs:${getLoginUsername() || 'anonymous'}`)

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 左侧导航：主页 / 知识库 / 收藏 */
const navMode = ref<'all' | 'starred' | 'library' | 'trash'>('all')

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
  const doc: DocItem = {
    id: String(d.id),
    title: String(d.title || DOC_TYPE_TITLE[type]),
    type,
    content: String(d.content || ''),
    updatedAt: Number(d.updatedAt) || Date.now(),
    createdAt: Number(d.createdAt) || Number(d.updatedAt) || Date.now(),
    folderId: d.folderId ? String(d.folderId) : undefined,
    data: d.data && typeof d.data === 'object' ? d.data : undefined,
    starred: !!d.starred,
  }
  ensureDocData(doc)
  return doc
}

/** 示例数据：首次进入时生成一次，方便直接看到列表效果 */
function seedDemoData() {
  try {
    if (localStorage.getItem(storageKey.value + ':seeded')) return
    localStorage.setItem(storageKey.value + ':seeded', '1')
  } catch {
    return
  }
  const now = Date.now()
  const day = 86_400_000
  const fProduct: DocFolder = { id: genDocId('folder'), name: '产品文档', createdAt: now - 40 * day }
  const fTech: DocFolder = { id: genDocId('folder'), name: '技术方案', createdAt: now - 35 * day }
  folders.value.push(fProduct, fTech)

  const samples: DocItem[] = [
    {
      id: genDocId('doc'),
      title: '产品需求文档 PRD',
      type: 'doc',
      content:
        '<h2>背景</h2><p>当前协作平台的文档能力需要支持产品、研发、测试共同维护需求资料。</p><h2>目标</h2><ul><li>统一文档入口</li><li>支持多种文档类型</li><li>支持文件夹归档</li></ul><h2>方案</h2><p>文档中心提供富文本、表格、思维导图与流程图，并按文件夹组织。</p><h2>后续计划</h2><p>接入后端接口，支持多人协作与权限分享。</p>',
      folderId: fProduct.id,
      starred: true,
      createdAt: now - 12 * day,
      updatedAt: now - 2 * 3600_000,
    },
    {
      id: genDocId('doc'),
      title: '2026 Q2 迭代规划',
      type: 'sheet',
      content: '',
      data: {
        rows: [
          ['模块', '负责人', '状态', '计划完成'],
          ['文档首页', 'Shenyuan', '进行中', '2026-11-10'],
          ['表格编辑器', 'Shenyuan', '待开始', '2026-11-16'],
          ['思维导图', 'Shenyuan', '待开始', '2026-11-20'],
          ['流程图', 'Shenyuan', '待开始', '2026-11-24'],
          ['权限分享', 'Shenyuan', '待开始', '2026-11-28'],
        ],
      },
      folderId: fProduct.id,
      createdAt: now - 9 * day,
      updatedAt: now - 5 * 3600_000,
    },
    {
      id: genDocId('doc'),
      title: '系统架构思维导图',
      type: 'mindmap',
      content: '',
      data: {
        root: {
          id: genDocId('root'),
          text: '文档中心',
          children: [
            {
              id: genDocId('m'),
              text: '文档类型',
              children: [
                { id: genDocId('m'), text: '富文本', children: [] },
                { id: genDocId('m'), text: '表格', children: [] },
                { id: genDocId('m'), text: '思维导图', children: [] },
                { id: genDocId('m'), text: '流程图', children: [] },
              ],
            },
            {
              id: genDocId('m'),
              text: '组织方式',
              children: [
                { id: genDocId('m'), text: '文件夹', children: [] },
                { id: genDocId('m'), text: '收藏', children: [] },
              ],
            },
          ],
        },
      },
      folderId: fTech.id,
      starred: true,
      createdAt: now - 7 * day,
      updatedAt: now - day,
    },
    {
      id: genDocId('doc'),
      title: '登录流程',
      type: 'flow',
      content: '',
      data: { graph: null },
      folderId: fTech.id,
      createdAt: now - 6 * day,
      updatedAt: now - 2 * day,
    },
    {
      id: genDocId('doc'),
      title: '会议纪要 10-26',
      type: 'doc',
      content:
        '<h2>会议主题</h2><p>文档中心二期需求评审</p><h2>参会人</h2><ul><li>产品：Shenyuan</li><li>研发：Allen</li><li>测试：Li Si</li></ul><h2>结论</h2><ul><li>本期先支持在线新建与编辑</li><li>导出格式采用兼容格式</li><li>权限分享后续迭代补充</li></ul>',
      createdAt: now - 5 * day,
      updatedAt: now - 3 * day,
    },
    {
      id: genDocId('doc'),
      title: 'API 接口说明',
      type: 'doc',
      content:
        '<h2>查询文档列表</h2><pre>GET /api/docs</pre><h2>新建文档</h2><pre>POST /api/docs</pre><h2>更新文档</h2><pre>PUT /api/docs/:id</pre>',
      folderId: fTech.id,
      createdAt: now - 4 * day,
      updatedAt: now - 4 * day,
    },
    {
      id: genDocId('doc'),
      title: '竞品调研',
      type: 'doc',
      content:
        '<h2>调研范围</h2><p>飞书文档、语雀、Notion。</p><h2>结论</h2><ul><li>左侧文件树 + 右侧编辑是共同形态</li><li>目录大纲、宽屏、专注模式使用频率高</li><li>收藏与最近访问是高频入口</li></ul>',
      createdAt: now - 3 * day,
      updatedAt: now - 5 * 3600_000,
    },
    {
      id: genDocId('doc'),
      title: '数据分析日报',
      type: 'sheet',
      content: '',
      data: {
        rows: [
          ['日期', '访问量', '新增文档', '活跃用户'],
          ['2026-11-01', '1280', '12', '86'],
          ['2026-11-02', '1420', '18', '92'],
          ['2026-11-03', '1365', '9', '88'],
          ['2026-11-04', '1590', '21', '101'],
          ['2026-11-05', '1712', '16', '110'],
        ],
      },
      createdAt: now - 2 * day,
      updatedAt: now - 6 * 3600_000,
    },
  ]
  docs.value = [...samples, ...docs.value]
}

// ---- 本地存取（兼容旧版纯文档数组） ----
function loadDocs() {
  try {
    const raw = localStorage.getItem(storageKey.value)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) {
      docs.value = parsed.filter((d: any) => d && typeof d.id === 'string').map(normalizeDoc)
      folders.value = []
      trash.value = []
    } else if (parsed && Array.isArray(parsed.docs)) {
      folders.value = (Array.isArray(parsed.folders) ? parsed.folders : [])
        .filter((f: any) => f && typeof f.id === 'string')
        .map((f: any) => ({
          id: String(f.id),
          name: String(f.name || '未命名文件夹'),
          createdAt: Number(f.createdAt) || Date.now(),
          starred: !!f.starred,
        }))
      docs.value = parsed.docs.filter((d: any) => d && typeof d.id === 'string').map(normalizeDoc)
      trash.value = (Array.isArray(parsed.trash) ? parsed.trash : [])
        .filter((d: any) => d && typeof d.id === 'string')
        .map(normalizeDoc)
    } else {
      docs.value = []
      folders.value = []
      trash.value = []
    }
  } catch {
    docs.value = []
    folders.value = []
    trash.value = []
  }
  // 首次进入生成示例数据
  seedDemoData()
  // 默认展开全部文件夹
  for (const f of folders.value) expanded[f.id] = expanded[f.id] ?? true
  // 从 URL 恢复当前文档；没有则停留在列表页
  const target = String(route.query.doc || '')
  activeId.value = target && docs.value.some((d) => d.id === target) ? target : ''
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

function saveDocs() {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify({ folders: folders.value, docs: docs.value, trash: trash.value }))
    saved.value = true
  } catch {
    // 本地存储不可用时静默，编辑内容仍保留在当前页面
  }
}

function scheduleSave() {
  saved.value = false
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveDocs, 400)
}

watch([docs, folders, trash], scheduleSave, { deep: true })
watch(storageKey, loadDocs, { immediate: true })

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
  if (!saved.value) saveDocs()
})

// ---- 文档操作 ----
function createDoc(type: DocType = 'doc', folderId?: string) {
  const data: SheetData | MindmapData | FlowData | undefined =
    type === 'sheet' ? defaultSheet()
      : type === 'mindmap' ? defaultMindmap()
        : type === 'flow' ? { graph: null }
          : undefined
  const doc: DocItem = {
    id: genDocId('doc'),
    title: DOC_TYPE_TITLE[type],
    type,
    content: '',
    data,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    folderId: folderId || undefined,
  }
  docs.value.unshift(doc)
  selectDoc(doc)
  if (folderId) expanded[folderId] = true
  if (type === 'doc') nextTick(() => editorRef.value?.focus())
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
  doc.updatedAt = Date.now()
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
  createDoc(type)
  const doc = activeDoc.value
  if (!doc) return
  doc.title = title
  doc.content = content
  doc.updatedAt = Date.now()
  if (type === 'doc') {
    nextTick(() => {
      if (editorRef.value) editorRef.value.innerHTML = content
      refreshOutline()
    })
  }
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
  window.open(href, '_blank')
}

/** 返回文档列表 */
function backToList() {
  activeId.value = ''
  const query = { ...route.query }
  delete query.doc
  router.replace({ query })
}

/** 切换左侧导航：全部 / 收藏 */
function switchNav(mode: 'all' | 'starred' | 'library' | 'trash') {
  navMode.value = mode
  if (mode === 'all') activeFolderId.value = ''
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
  navMode.value = 'all'
  backToList()
}

/** 列表首页数据：搜索 + 收藏筛选 + 当前文件夹过滤 + 排序 */
const listDocs = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let list = docs.value
  if (navMode.value === 'starred') list = list.filter((d) => d.starred)
  else if (navMode.value === 'library') list = []
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
    onOk: () => {
      docs.value = docs.value.filter((d) => d.id !== doc.id)
      trash.value.unshift(doc)
      if (activeId.value === doc.id) backToList()
      message.success('已移到回收站')
    },
  })
}

/** 从回收站恢复 */
function restoreDoc(doc: DocItem) {
  trash.value = trash.value.filter((d) => d.id !== doc.id)
  docs.value.unshift(doc)
  message.success('已恢复')
}

/** 彻底删除 */
function purgeDoc(doc: DocItem) {
  Modal.confirm({
    title: '彻底删除',
    content: `确定彻底删除「${doc.title || '无标题文档'}」？删除后不可恢复。`,
    okText: '彻底删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      trash.value = trash.value.filter((d) => d.id !== doc.id)
      message.success('已彻底删除')
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
    onOk: () => {
      trash.value = []
      message.success('回收站已清空')
    },
  })
}

function moveDoc(doc: DocItem, folderId: string) {
  doc.folderId = folderId === 'none' ? undefined : folderId
  doc.updatedAt = Date.now()
  if (doc.folderId) expanded[doc.folderId] = true
  message.success('已移动')
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
    const f = folders.value.find((x) => x.id === folderForm.id)
    if (f) f.name = name
    message.success('文件夹已重命名')
  } else {
    const folder: DocFolder = {
      id: `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      createdAt: Date.now(),
    }
    folders.value.push(folder)
    expanded[folder.id] = true
    activeFolderId.value = folder.id
    message.success('文件夹已创建')
  }
  folderModalOpen.value = false
}

function deleteFolder(folder: DocFolder) {
  Modal.confirm({
    title: `删除文件夹「${folder.name}」`,
    content: '文件夹内的文档会移到未分组，不会删除文档。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      docs.value.forEach((d) => {
        if (d.folderId === folder.id) d.folderId = undefined
      })
      folders.value = folders.value.filter((f) => f.id !== folder.id)
      if (activeFolderId.value === folder.id) activeFolderId.value = ''
      message.success('文件夹已删除')
    },
  })
}

function onFolderMenu(e: { key?: string | number }, folder: DocFolder) {
  const key = String(e?.key ?? '')
  if (key === 'star') folder.starred = !folder.starred
  else if (key === 'rename') openRenameFolder(folder)
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
/** 解析正文 h2 / h3 生成右侧大纲 */
function refreshOutline() {
  if (!editorRef.value || activeDoc.value?.type !== 'doc') {
    outline.value = []
    return
  }
  const nodes = Array.from(editorRef.value.querySelectorAll<HTMLElement>('h2, h3'))
  outline.value = nodes.map((el, i) => {
    const id = `doc-h-${i}`
    el.id = id
    return {
      id,
      text: (el.textContent || '').trim() || `标题 ${i + 1}`,
      level: el.tagName === 'H2' ? 2 : 3,
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
      refreshOutline()
    } else {
      outline.value = []
    }
  })
}, { immediate: true })

function onEditorInput() {
  const doc = activeDoc.value
  if (!doc || !editorRef.value) return
  doc.content = editorRef.value.innerHTML
  doc.updatedAt = Date.now()
  refreshOutline()
}

function execCmd(cmd: string, value?: string) {
  editorRef.value?.focus()
  document.execCommand(cmd, false, value)
  onEditorInput()
}

/** 收藏 / 取消收藏 */
function toggleStar(doc: DocItem) {
  doc.starred = !doc.starred
  doc.updatedAt = Date.now()
}

/** 当前文档所属文件夹名称 */
function folderNameOf(doc: DocItem | null): string {
  if (!doc?.folderId) return ''
  return folders.value.find((f) => f.id === doc.folderId)?.name || ''
}
</script>

<template>
  <div class="docs-page" :class="{ 'is-focus': focusMode }">
    <!-- 左侧：文件夹 + 文档 -->
    <aside class="docs-side">
      <header class="docs-side-head">
        <div class="docs-side-brand">
          <BeeLogo class="docs-side-logo" />
          <div class="docs-side-brand-text">
            <span class="docs-side-title">先蜂云文档</span>
          </div>
        </div>
        <a-dropdown trigger="click" placement="bottomRight">
          <button type="button" class="docs-add" title="新建"><PlusOutlined /></button>
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
      </header>

      <div class="docs-search-wrap">
        <a-input ref="searchRef" v-model:value="keyword" size="small" allow-clear placeholder="搜索" class="docs-search">
          <template #prefix><SearchOutlined class="docs-search-icon" /></template>
        </a-input>
        <span class="docs-search-kbd">⌘K</span>
      </div>

      <nav class="docs-nav">
        <button type="button" class="docs-nav-item" :class="{ active: navMode === 'all' }" @click="switchNav('all')">
          <HomeOutlined />
          <span>主页</span>
        </button>
        <button type="button" class="docs-nav-item" :class="{ active: navMode === 'library' }" @click="switchNav('library')">
          <BookOutlined />
          <span>知识库</span>
        </button>
      </nav>

      <div class="docs-list">
        <!-- 置顶文档 -->
        <div v-if="pinnedDocs.length" class="docs-group">
          <div class="docs-group-title">置顶文档</div>
          <button
            v-for="d in pinnedDocs"
            :key="`pin-${d.id}`"
            type="button"
            class="docs-item"
            :class="{ active: d.id === activeId }"
            @click="selectDoc(d)"
          >
            <DocTypeIcon :type="d.type" mono />
            <span class="docs-item-main">
              <span class="docs-item-title">
                <span class="docs-item-title-text">{{ d.title || '无标题文档' }}</span>
                <StarFilled class="docs-item-star" />
              </span>
            </span>
          </button>
        </div>

        <!-- 置顶知识库 -->
        <div v-if="pinnedFolders.length" class="docs-group">
          <div class="docs-group-title">置顶知识库</div>
          <div
            v-for="f in pinnedFolders"
            :key="`pinf-${f.id}`"
            class="docs-folder"
            @click="openLibrary(f)"
          >
            <FolderFilled class="docs-folder-icon" />
            <span class="docs-folder-name">{{ f.name }}</span>
            <span class="docs-folder-count">{{ docsOfFolder(f) }}</span>
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
        <!-- 顶部工具条 -->
        <div class="docs-toolbar">
          <button type="button" class="docs-back" @click="backToList"><LeftOutlined /> 文档</button>
          <div class="docs-toolbar-pill">
            <template v-if="activeDoc.type === 'doc'">
              <button type="button" class="docs-tool" title="加粗" @mousedown.prevent @click="execCmd('bold')"><b>B</b></button>
              <button type="button" class="docs-tool" title="斜体" @mousedown.prevent @click="execCmd('italic')"><i>I</i></button>
              <button type="button" class="docs-tool" title="下划线" @mousedown.prevent @click="execCmd('underline')"><u>U</u></button>
              <span class="docs-tool-sep" />
              <button type="button" class="docs-tool docs-tool-text" title="一级标题" @mousedown.prevent @click="execCmd('formatBlock', 'h2')">H2</button>
              <button type="button" class="docs-tool docs-tool-text" title="二级标题" @mousedown.prevent @click="execCmd('formatBlock', 'h3')">H3</button>
              <button type="button" class="docs-tool docs-tool-text" title="引用" @mousedown.prevent @click="execCmd('formatBlock', 'blockquote')">❝</button>
              <button type="button" class="docs-tool docs-tool-text" title="代码块" @mousedown.prevent @click="execCmd('formatBlock', 'pre')">&lt;/&gt;</button>
              <button type="button" class="docs-tool" title="无序列表" @mousedown.prevent @click="execCmd('insertUnorderedList')"><UnorderedListOutlined /></button>
              <button type="button" class="docs-tool" title="有序列表" @mousedown.prevent @click="execCmd('insertOrderedList')"><OrderedListOutlined /></button>
              <button type="button" class="docs-tool docs-tool-text" title="分割线" @mousedown.prevent @click="execCmd('insertHorizontalRule')">―</button>
            </template>
            <span v-else class="docs-type-label">
              <DocTypeIcon :type="activeDoc.type" />
              {{ activeDoc.type === 'sheet' ? '表格' : activeDoc.type === 'mindmap' ? '思维导图' : '流程图' }}
            </span>
          </div>

          <div class="docs-toolbar-actions">
            <button type="button" class="docs-export" :class="{ 'is-active': activeDoc.starred }" @click="toggleStar(activeDoc)">
              <StarFilled v-if="activeDoc.starred" class="docs-star-icon" />
              <StarOutlined v-else class="docs-star-icon" />
              {{ activeDoc.starred ? '已收藏' : '收藏' }}
            </button>
            <button type="button" class="docs-export" @click="wideMode = !wideMode">
              <ColumnWidthOutlined /> {{ wideMode ? '标准' : '宽屏' }}
            </button>
            <button type="button" class="docs-export" @click="focusMode = !focusMode">
              <FullscreenExitOutlined v-if="focusMode" />
              <FullscreenOutlined v-else />
              {{ focusMode ? '退出专注' : '专注' }}
            </button>
            <a-dropdown trigger="click" placement="bottomRight">
              <button type="button" class="docs-export"><DownloadOutlined /> 导出</button>
              <template #overlay>
                <a-menu @click="onExport($event)">
                  <a-menu-item v-if="activeDoc.type === 'doc'" key="word">Word (.doc)</a-menu-item>
                  <a-menu-item v-else-if="activeDoc.type === 'sheet'" key="excel">Excel (.xls)</a-menu-item>
                  <a-menu-item v-else-if="activeDoc.type === 'mindmap'" key="xmind">XMind (.mm)</a-menu-item>
                  <a-menu-item v-else key="flow-json">流程图 (.json)</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <span class="docs-saved">
              <span class="docs-saved-dot" />
              {{ saved ? '已保存' : '保存中…' }}
            </span>
          </div>
        </div>

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
            <div class="docs-canvas-inner" :class="{ 'is-wide': activeDoc.type !== 'doc', 'is-full': wideMode }">
              <input
                v-model="activeDoc.title"
                class="docs-title-input"
                placeholder="无标题文档"
                maxlength="120"
                @input="touch(activeDoc)"
              />

              <div
                v-if="activeDoc.type === 'doc'"
                ref="editorRef"
                class="docs-editor"
                contenteditable="true"
                data-placeholder="输入正文，开始记录你的想法…"
                @input="onEditorInput"
              ></div>
              <DocSheetEditor
                v-else-if="activeDoc.type === 'sheet'"
                :key="`sheet-${activeDoc.id}`"
                :rows="sheetRows(activeDoc)"
                @change="touch(activeDoc)"
              />
              <DocMindmapEditor
                v-else-if="activeDoc.type === 'mindmap'"
                :key="`mind-${activeDoc.id}`"
                :root="mindRoot(activeDoc)"
                @change="touch(activeDoc)"
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
            <p class="docs-home-sub">共 {{ trash.length }} 篇文档</p>
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
            <p class="docs-home-sub">共 {{ folders.length }} 个知识库</p>
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
            <h1 class="docs-home-title">{{ navMode === 'starred' ? '收藏' : '主页' }}</h1>
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
            <button type="button" :class="{ active: navMode === 'all' }" @click="switchNav('all')">全部</button>
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
          {{ keyword ? '没有匹配的文档' : '还没有文档，点击右上角新建' }}
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
  </div>
</template>

<style scoped>
.docs-page {
  /* 父级 workbench-panel 上下各有 2vh padding，负 margin 抵消后高度要补回 4vh 才能贴底 */
  height: calc(100% + 4vh);
  width: calc(100% + 1vh);
  margin: -2vh -0.5vh;
  display: flex;
  background: #fff;
  color: #37352f;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto,
    'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* ---- 左侧：知识库 / 文件树 ---- */
.docs-side {
  flex: 0 0 334px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 12px 14px;
  background: #f7f8fa;
  border-right: 1px solid #ececec;
}
.docs-side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 4px;
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
  background: linear-gradient(135deg, #e8f0fe 0%, #dbeafe 100%);
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
  color: #111827;
}
.docs-side-sub {
  margin-top: 1px;
  font-size: 10px;
  line-height: 1.3;
  color: #9ca3af;
}
.docs-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-add:hover {
  color: #111827;
  background: #e5e7eb;
}
.docs-search-wrap {
  position: relative;
}
.docs-search {
  height: 36px;
  padding-right: 44px;
  border-color: #e5e6eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(31, 35, 41, 0.03);
}
.docs-search:hover {
  border-color: #d0d3d9;
}
.docs-search:focus-within {
  border-color: #3370ff;
  background: #fff;
}
.docs-search-icon {
  color: #8f959e;
}
.docs-search-kbd {
  position: absolute;
  top: 50%;
  right: 8px;
  padding: 1px 5px;
  font-size: 10px;
  line-height: 1.4;
  color: #b0b3b8;
  background: #eceef0;
  border-radius: 4px;
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
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #91918e;
}
.docs-group-title-main {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid #ededf0;
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
  background: #fff;
  border: 1px solid #eff0f2;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.docs-library-card:hover {
  border-color: #dcdde1;
  box-shadow: 0 4px 16px rgba(31, 35, 41, 0.06);
  transform: translateY(-1px);
}
.docs-library-icon {
  font-size: 28px;
  color: #f0b429;
}
.docs-library-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.docs-library-meta {
  font-size: 11px;
  color: #8f959e;
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
  height: 36px;
  padding: 0 10px;
  font-size: 14px;
  color: #374151;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-nav-item :deep(.anticon) {
  font-size: 15px;
  color: #6b7280;
}
.docs-nav-item:hover {
  background: #f2f3f5;
}
.docs-nav-item.active {
  color: #3370ff;
  background: #e8f0fe;
}
.docs-nav-item.active :deep(.anticon) {
  color: #3370ff;
}
/* 侧栏底部：文档统计 + 新建 */
/* 回收站入口 */
.docs-trash-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  color: #6b7280;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-trash-entry:hover {
  background: #eef0f2;
}
.docs-trash-entry.active {
  color: #3370ff;
  background: #e8f0fe;
}
.docs-trash-count {
  margin-left: auto;
  font-size: 11px;
  color: #9ca3af;
}

/* 文件夹行 */
.docs-folder {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 5px 8px;
  margin-top: 2px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}
.docs-folder:hover {
  background: #f5f5f5;
}
.docs-folder.active {
  background: #e8f0fe;
}
.docs-folder.active .docs-folder-name {
  color: #3370ff;
}
.docs-folder-caret {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  font-size: 9px;
  color: #9ca3af;
  transition: transform 0.15s;
}
.docs-folder-caret.open {
  transform: rotate(90deg);
}
.docs-folder-icon {
  flex: none;
  font-size: 15px;
  color: #f0b429;
}
.docs-folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-folder-count {
  flex: none;
  padding: 0;
  font-size: 11px;
  line-height: 16px;
  color: #9ca3af;
  text-align: center;
  background: transparent;
  border-radius: 0;
}
.docs-folder.active .docs-folder-count {
  color: #6b7280;
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
  color: #91918e;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}
.docs-folder:hover .docs-folder-more {
  opacity: 1;
}
.docs-folder-more:hover {
  background: rgba(0, 0, 0, 0.06);
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
  color: #b0b3b8;
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
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}
.docs-item.grouped {
  padding-left: 30px;
}
.docs-item:hover {
  background: #f5f5f5;
}
.docs-item.active {
  background: #e8f0fe;
  box-shadow: none;
}
.docs-item.active .docs-item-title-text {
  color: #3370ff;
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
  font-weight: 400;
  color: #374151;
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
  font-size: 11px;
  color: #91918e;
}
.docs-item-more {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 11px;
  color: #91918e;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}
.docs-item:hover .docs-item-more {
  opacity: 1;
}
.docs-item-more:hover {
  background: rgba(0, 0, 0, 0.06);
}
.docs-list-empty {
  padding: 28px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #91918e;
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
  background: #fff;
}
/* 正文 + 右侧大纲 */
.docs-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.docs-outline {
  flex: 0 0 210px;
  overflow-y: auto;
  padding: 28px 14px;
  background: #fff;
  border-right: 1px solid #e9e9e7;
}
.docs-outline-title {
  padding: 0 8px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #91918e;
}
.docs-outline-item {
  display: block;
  width: 100%;
  padding: 4px 8px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  color: #787774;
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
  color: #37352f;
  background: rgba(0, 0, 0, 0.04);
  border-left-color: #00b96b;
}
.docs-outline-item.is-h3 {
  padding-left: 20px;
  font-size: 12px;
  color: #91918e;
}

/* 顶部工具条：与正文同色、无分割线，融成一块画布 */
.docs-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 48px;
  background: transparent;
  border-bottom: none;
}
.docs-toolbar-pill {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0;
  background: transparent;
}
.docs-tool {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  font-size: 13px;
  line-height: 1;
  color: #787774;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-tool:hover {
  color: #37352f;
  background: rgba(0, 0, 0, 0.05);
}
.docs-tool-sep {
  width: 1px;
  height: 16px;
  margin: 0 6px;
  background: #e9e9e7;
}
.docs-tool-text {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.docs-star-icon {
  font-size: 12px;
  color: #91918e;
}
.docs-export.is-active {
  color: #d4a72c;
}
.docs-export.is-active .docs-star-icon {
  color: #d4a72c;
}
.docs-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}
.docs-export {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  color: #787774;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-export:hover {
  color: #37352f;
  background: rgba(0, 0, 0, 0.05);
}
.docs-type-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  font-size: 13px;
  font-weight: 500;
  color: #787774;
}
.docs-saved {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 0;
  font-size: 12px;
  color: #91918e;
}
.docs-saved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34c759;
}

/* 正文画布 */
.docs-canvas {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.docs-canvas-inner {
  flex: 1 0 auto;
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 48px 72px 120px;
  background: #fff;
}
/* 表格 / 思维导图 / 流程图：内容区撑满 */
.docs-canvas-inner.is-wide {
  max-width: none;
  width: 100%;
  padding: 32px 48px 48px;
}
.docs-title-input {
  width: 100%;
  padding: 0;
  font-size: 36px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: #37352f;
  border: none;
  outline: none;
}
.docs-title-input::placeholder {
  color: #c7c7c5;
}
.docs-editor {
  min-height: 46vh;
  padding: 36px 0 40px;
  font-size: 16px;
  line-height: 1.75;
  color: #37352f;
  outline: none;
}
.docs-editor:empty::before {
  content: attr(data-placeholder);
  color: #c7c7c5;
}
.docs-editor :deep(h2) {
  margin: 30px 0 10px;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.3;
}
.docs-editor :deep(p) {
  margin: 0 0 10px;
}
.docs-editor :deep(ul),
.docs-editor :deep(ol) {
  margin: 10px 0;
  padding-left: 24px;
}
.docs-editor :deep(li) {
  margin: 3px 0;
}
.docs-editor :deep(blockquote) {
  margin: 12px 0;
  padding: 4px 0 4px 14px;
  color: #787774;
  border-left: 3px solid #e9e9e7;
}
.docs-editor :deep(pre) {
  margin: 12px 0;
  padding: 12px 14px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
  color: #37352f;
  white-space: pre-wrap;
  background: #f7f7f5;
  border-radius: 6px;
}
.docs-editor :deep(hr) {
  margin: 24px 0;
  border: none;
  border-top: 1px solid #e9e9e7;
}
.docs-editor :deep(a) {
  color: #00b96b;
}
.docs-item-star {
  flex: none;
  font-size: 10px;
  color: #d4a72c;
}
/* 宽屏 / 专注模式 */
.docs-canvas-inner.is-full {
  max-width: 1200px;
}
.docs-page.is-focus .docs-side {
  display: none;
}
.docs-page.is-focus .docs-canvas-inner {
  max-width: 1040px;
}

.docs-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px;
  font-size: 13px;
  color: #646a73;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-back:hover {
  color: #1f2329;
  background: #f2f3f5;
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
  background: #fff;
  border: 1px solid #eff0f2;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.docs-quick-card:hover {
  background: #fcfcfd;
  border-color: #dcdde1;
  box-shadow: 0 4px 16px rgba(31, 35, 41, 0.06);
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
  background: linear-gradient(135deg, #3370ff, #5b8cff);
}
.docs-quick-icon.is-upload {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
}
.docs-quick-icon.is-template {
  background: linear-gradient(135deg, #8b5cf6, #a78bfa);
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
  color: #1f2329;
}
.docs-quick-text small {
  font-size: 11px;
  color: #8f959e;
}
.docs-quick-caret {
  flex: none;
  font-size: 11px;
  color: #b0b3b8;
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
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #1f2329;
}
.docs-home-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8f959e;
}
.docs-home-new {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  color: #fff;
  background: #3370ff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.docs-home-new:hover {
  background: #2860e0;
}
.docs-home-clear {
  color: #d54941;
  background: #fff;
  border: 1px solid #f2c1c1;
}
.docs-home-clear:hover {
  background: #fff1f0;
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
  color: #3370ff;
  background: #f2f6ff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.docs-trash-btn:hover {
  background: #e8f0fe;
}
.docs-trash-btn.danger {
  color: #d54941;
  background: #fff1f0;
}
.docs-trash-btn.danger:hover {
  background: #ffe4e2;
}
.docs-home-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
  border-bottom: 1px solid #eff0f2;
}
.docs-home-tabs {
  display: flex;
  gap: 22px;
}
.docs-home-tabs button {
  position: relative;
  padding: 0 0 10px;
  font-size: 13px;
  color: #646a73;
  background: none;
  border: none;
  cursor: pointer;
}
.docs-home-tabs button:hover {
  color: #1f2329;
}
.docs-home-tabs button.active {
  color: #3370ff;
  font-weight: 500;
}
.docs-home-tabs button.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: #3370ff;
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
  background: #f5f6f7 !important;
  border-color: transparent !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}
.docs-home-sort:hover :deep(.ant-select-selector) {
  background: #eef0f2 !important;
}
.docs-home-sort :deep(.ant-select-selection-item) {
  font-size: 12px;
  line-height: 28px !important;
  color: #50565e;
}
.docs-sort-icon {
  font-size: 13px;
  color: #8f959e;
}
.docs-view-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: #f2f3f5;
  border-radius: 7px;
}
.docs-view-toggle button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  font-size: 13px;
  color: #8f959e;
  background: transparent;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-view-toggle button.active {
  color: #1f2329;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
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
  background: #fff;
  border: 1px solid #eff0f2;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.docs-grid-card:hover {
  border-color: #dcdde1;
  box-shadow: 0 4px 16px rgba(31, 35, 41, 0.06);
  transform: translateY(-1px);
}
.docs-grid-title {
  width: 100%;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: #1f2329;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-grid-meta {
  font-size: 11px;
  color: #8f959e;
}
.docs-grid-star {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 12px;
  color: #f5b400;
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
  color: #8f959e;
  text-align: left;
  border-bottom: 1px solid #eff0f2;
}
.docs-table td {
  padding: 12px;
  overflow: hidden;
  font-size: 13px;
  color: #1f2329;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid #f2f3f5;
}
.docs-table tbody tr {
  cursor: pointer;
  transition: background 0.12s;
}
.docs-table tbody tr:hover {
  background: #f7f8fa;
}
.docs-table-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.docs-table-title > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-table-muted {
  color: #8f959e !important;
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
  color: #8f959e;
  border-radius: 5px;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}
.docs-table tbody tr:hover .docs-table-more {
  opacity: 1;
}
.docs-table-more:hover {
  background: #eef0f2;
}
.docs-home-empty {
  padding: 60px 0;
  font-size: 13px;
  color: #8f959e;
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
  color: #91918e;
}
.docs-empty-icon {
  font-size: 36px;
  color: #d3d3d1;
}
.docs-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #37352f;
}
.docs-empty-desc {
  margin-bottom: 8px;
  font-size: 12px;
  color: #91918e;
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
  .docs-canvas-inner {
    padding: 32px 24px 80px;
  }
  .docs-canvas-inner.is-wide {
    padding: 20px 16px 24px;
  }
  .docs-title-input {
    font-size: 28px;
  }
}
</style>
