<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  PlusOutlined,
  SearchOutlined,
  ControlOutlined,
  CloseOutlined,
  LeftOutlined,
  SmileOutlined,
  MoreOutlined,
  DeleteOutlined,
  FolderFilled,
  RightOutlined,
  DownOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  ClearOutlined,
  CheckOutlined,
  CheckSquareOutlined,
  PictureOutlined,
  PaperClipOutlined,
  TableOutlined,
  LayoutOutlined,
  BgColorsOutlined,
  LinkOutlined,
  CodeOutlined,
  MinusOutlined,
  StarFilled,
  HomeOutlined,
  BookOutlined,
  AppstoreOutlined,
  SortAscendingOutlined,
  UploadOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  DoubleLeftOutlined,
  MenuUnfoldOutlined,
  HolderOutlined,
  LikeOutlined,
  LikeFilled,
  AlignLeftOutlined,
  FontColorsOutlined,
  ScissorOutlined,
  CopyOutlined,
  CommentOutlined,
  MessageOutlined,
  SendOutlined,
  TranslationOutlined,
  ShareAltOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FileMarkdownOutlined,
  FileDoneOutlined,
  Html5Outlined,
  ScheduleOutlined,
  SnippetsOutlined,
  PlusSquareOutlined,
} from '@ant-design/icons-vue'
import { getLoginUsername, useAuth } from '@/utils/auth'
import type { DocType, DocFolder, DocItem, DocMeta, DocComment, MindNode, SheetData, MindmapData, FlowData } from '@/types/docs'
import DocEmojiPicker from '@/components/docs/DocEmojiPicker.vue'
import DocCoverPicker from '@/components/docs/DocCoverPicker.vue'
import { docCoverBackground } from '@/utils/doc-cover'
import DocSheetEditor from '@/components/docs/DocSheetEditor.vue'
import DocMindmapEditor from '@/components/docs/DocMindmapEditor.vue'
import DocFlowEditor from '@/components/docs/DocFlowEditor.vue'
import DocTypeIcon from '@/components/docs/DocTypeIcon.vue'
import DocsLibraryCover from '@/components/docs/DocsLibraryCover.vue'
import AppLogo from '@/components/AppLogo.vue'
import { isDesktop } from '@/utils/desktop'
import { docsSideCollapsed, docsEditMode, docsActiveDoc, docsSaveState, docsTitleRev, DOC_UNTITLED, docTitleInputValue } from '@/utils/docs-layout'
import { openDocSharePanel } from '@/utils/doc-share'
import {
  createDoc as createDocApi,
  createDocFolder,
  deleteDocFolder,
  emptyTrash as emptyTrashApi,
  getDocDetail,
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
/** 当前文档 ID：/wiki/:docId 优先，兼容旧链接 /docs?doc=xxx */
const routeDocId = computed(() => String(route.params.docId || route.query.doc || ''))
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

// ---------------- 左侧目录：折叠 / 展开（记住偏好） ----------------
const OUTLINE_COLLAPSED_KEY = 'cooperise.docs.outlineCollapsed'
function readOutlineCollapsed(): boolean {
  try {
    return localStorage.getItem(OUTLINE_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}
const outlineCollapsed = ref(readOutlineCollapsed())
function toggleOutline() {
  outlineCollapsed.value = !outlineCollapsed.value
  try {
    localStorage.setItem(OUTLINE_COLLAPSED_KEY, outlineCollapsed.value ? '1' : '0')
  } catch {
    // 存储不可用时只在本次生效
  }
}
/** 点击目录里的文档标题：回到正文顶部 */
function scrollToTop() {
  // 文档页的滚动容器是包含封面 / 正文 / 目录 / 评论的外层；其他类型仍在 .docs-canvas 上
  const scroller = document.querySelector('.docs-scroll.is-scroll-page, .docs-canvas') as HTMLElement | null
  scroller?.scrollTo({ top: 0, behavior: 'smooth' })
}

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
  doc: DOC_UNTITLED,
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
    data: (data && typeof data === 'object' ? data : undefined) as DocItem['data'],
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
    const target = routeDocId.value
    // 新页面直接打开文档时，列表里可能还没有这篇（或列表只返回摘要）：按 id 拉一次详情
    if (target && !docs.value.some((d) => d.id === target)) {
      try {
        const detailRes = await getDocDetail(target)
        if (detailRes?.success && detailRes.data) docs.value.unshift(normalizeDoc(detailRes.data))
      } catch {
        // 详情加载失败时按列表结果处理
      }
    }
    activeId.value = target && docs.value.some((d) => d.id === target) ? target : ''
    // 旧链接 /docs?doc=xxx → /wiki/xxx
    if (activeId.value && !route.params.docId && route.query.doc) {
      router.replace({ name: 'WikiDoc', params: { docId: activeId.value } })
    }
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

// ---- 文档图标 / 封面（富文本文档的 data 字段存 DocMeta，随文档内容一起保存） ----
const docMeta = computed<DocMeta>(() => {
  const d = activeDoc.value
  return (d?.type === 'doc' && d.data ? d.data : {}) as DocMeta
})
const docCoverStyle = computed(() => ({ background: docCoverBackground(docMeta.value.cover) }))
/** 选择面板的开关：标题上方「添加图标 / 添加封面」、点击已有图标、封面上的「更换封面」 */
const iconAddOpen = ref(false)
const iconEditOpen = ref(false)
const coverAddOpen = ref(false)
const coverEditOpen = ref(false)

function setDocMeta(patch: DocMeta) {
  const doc = activeDoc.value
  if (!doc || doc.type !== 'doc') return
  const next: DocMeta = { ...docMeta.value, ...patch }
  if (!next.icon) delete next.icon
  if (!next.cover) delete next.cover
  doc.data = next
  onDocChanged(doc)
}
function setDocIcon(icon: string) {
  iconAddOpen.value = false
  iconEditOpen.value = false
  setDocMeta({ icon })
}
function setDocCover(cover: string) {
  coverAddOpen.value = false
  coverEditOpen.value = false
  setDocMeta({ cover })
}

/** 正文大标题输入（输入框里默认标题显示为空，所以不用 v-model，手动回写） */
function onTitleInput(e: Event, doc: DocItem) {
  const el = e.target as HTMLTextAreaElement
  // 标题是单段文字：粘贴进来的换行替换成空格
  if (/[\r\n]/.test(el.value)) el.value = el.value.replace(/\s*[\r\n]+\s*/g, ' ')
  doc.title = el.value
  autosizeTitle()
  onDocChanged(doc)
}

/** 标题文本框高度跟随内容：先收起再按 scrollHeight 撑开（换行 / 删字 / 宽度变化后都要重算） */
const titleInputRef = ref<HTMLTextAreaElement | null>(null)
function autosizeTitle() {
  const el = titleInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
let titleResizeObserver: ResizeObserver | undefined
let titleObservedWidth = 0
watch(titleInputRef, (el) => {
  titleResizeObserver?.disconnect()
  if (!el) return
  autosizeTitle()
  // 只在宽度变化时重算（窗口缩放、目录展开收起、加减图标），高度变化是自己改的，不能再触发
  titleResizeObserver = new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width)
    if (w === titleObservedWidth) return
    titleObservedWidth = w
    autosizeTitle()
  })
  titleResizeObserver.observe(el)
})
// 切换文档 / 标题被别处修改（顶栏文件名）后重算高度
watch(() => [activeDoc.value?.id, activeDoc.value?.title], () => nextTick(autosizeTitle))
onBeforeUnmount(() => titleResizeObserver?.disconnect())

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
      if (folderId) expanded[folderId] = true
      // 后端生成文档 id（24 位 Base62），打开新的文档页面加载内容
      router.push({ name: 'WikiDoc', params: { docId: doc.id } })
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

// ---- HTML 转义 ----
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

/** 新建并写入标题 / 内容（上传文件、模板库共用） */
function createDocWithContent(type: DocType, title: string, content: string) {
  createDocApi({ type, title, content })
    .then((res) => {
      if (!res.success || !res.data) return
      const doc = normalizeDoc(res.data)
      docs.value.unshift(doc)
      // 打开新的文档页面（后端生成的文档 id）
      router.push({ name: 'WikiDoc', params: { docId: doc.id } })
      if (type === 'doc') {
        nextTick(() => {
          if (editorRef.value) {
            editorRef.value.innerHTML = content
            normalizeTodoOrder(editorRef.value)
            normalizeOrderedLists(editorRef.value)
            ensureCodeHeads(editorRef.value)
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
  // 文档详情统一走 /wiki/:docId（参考飞书）
  router.replace({ name: 'WikiDoc', params: { docId: doc.id } })
}

/** 主内容区的文档：在新页面 / 页签中打开 */
function openDocInNewPage(doc: DocItem) {
  const href = router.resolve({ name: 'WikiDoc', params: { docId: doc.id } }).href
  if (isDesktop) {
    // 客户端：由 DesktopTabBar 按完整路径新开页签
    router.push(href)
  } else {
    window.open(href, '_blank')
  }
}

/** 返回文档列表：主页 / 知识库各自对应自己的路由 */
function backToList() {
  activeId.value = ''
  const target = navMode.value === 'library' ? 'DocsWiki' : 'DocsHome'
  if (route.name !== target) router.replace({ name: target })
}

/** 切换左侧导航：主页（/docs/drive/home）、知识库（/docs/wiki）等 */
function switchNav(mode: 'recent' | 'owned' | 'shared' | 'starred' | 'library' | 'trash') {
  navMode.value = mode
  if (mode === 'recent' || mode === 'owned' || mode === 'shared') activeFolderId.value = ''
  activeId.value = ''
  const target = mode === 'library' ? 'DocsWiki' : 'DocsHome'
  if (route.name !== target) router.push({ name: target })
}

// 直接访问 /docs/wiki（知识库）时，左侧对应高亮
watch(
  () => route.name,
  (name) => {
    if (name === 'DocsWiki') navMode.value = 'library'
    else if (name === 'DocsHome' && navMode.value === 'library') navMode.value = 'recent'
  },
  { immediate: true },
)

// 浏览器前进 / 后退时同步当前文档
watch(
  () => [route.params.docId, route.query.doc],
  () => {
    const code = routeDocId.value
    activeId.value = code && docs.value.some((d) => d.id === code) ? code : ''
  },
)

/** 置顶文档 / 置顶知识库 */
const pinnedDocs = computed(() =>
  docs.value.filter((d) => d.starred).sort((a, b) => b.updatedAt - a.updatedAt),
)
const pinnedFolders = computed(() => folders.value.filter((f) => f.starred))

/** 知识库搜索 */
const libraryKeyword = ref('')
const libraryFolders = computed(() => {
  const kw = libraryKeyword.value.trim().toLowerCase()
  return kw ? folders.value.filter((f) => f.name.toLowerCase().includes(kw)) : folders.value
})

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

// ---------------- 新建知识库：先选模板 ----------------
const libraryTemplateOpen = ref(false)
const selectedLibraryTemplate = ref<string | null>(null)

/** 目前仅支持空白知识库模板 */
function openCreateLibrary() {
  selectedLibraryTemplate.value = 'blank'
  libraryTemplateOpen.value = true
}

// 第二步：完善知识库信息
const libraryInfoOpen = ref(false)
const libraryInfoSubmitting = ref(false)
const libraryInfoForm = reactive({
  name: '',
  desc: '',
  visibility: 'members' as 'members' | 'all',
})

function confirmLibraryTemplate() {
  libraryTemplateOpen.value = false
  libraryInfoForm.name = ''
  libraryInfoForm.desc = ''
  libraryInfoForm.visibility = 'members'
  libraryInfoOpen.value = true
}

/** 返回上一步：重新选择模板 */
function backToLibraryTemplate() {
  libraryInfoOpen.value = false
  libraryTemplateOpen.value = true
}

async function submitLibraryInfo() {
  const name = libraryInfoForm.name.trim()
  if (!name) {
    message.warning('请输入知识库名称')
    return
  }
  if (libraryInfoSubmitting.value) return
  libraryInfoSubmitting.value = true
  try {
    const res = await createDocFolder({ name })
    if (!res.success || !res.data) return
    const folder = normalizeFolder(res.data)
    folders.value.push(folder)
    expanded[folder.id] = true
    activeFolderId.value = folder.id
    libraryInfoOpen.value = false
  } finally {
    libraryInfoSubmitting.value = false
  }
}

function onLibraryFeedback() {
  message.info('反馈功能即将上线')
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

/** 新建下拉：悬停 / 点击展开（参考飞书的「新建」面板） */
const addOpen = ref(false)
const ADD_TYPE_ITEMS: { key: DocType; label: string }[] = [
  { key: 'doc', label: '文档' },
  { key: 'sheet', label: '表格' },
]
const ADD_APP_ITEMS: { key: DocType; label: string }[] = [
  { key: 'mindmap', label: '思维导图' },
  { key: 'flow', label: '流程图' },
]
/** 选择文件类型后进入模板选择弹窗 */
const docTemplateOpen = ref(false)
const docTemplateKeyword = ref('')
const docTemplateCategory = ref('recommend')
const docTemplateType = ref<DocType>('doc')

const DOC_TYPE_LABELS: Record<string, string> = {
  doc: '文档',
  sheet: '表格',
  mindmap: '思维导图',
  flow: '流程图',
}
const DOC_BLANK_LABELS: Record<string, string> = {
  doc: '新建空白文档',
  sheet: '新建空白表格',
  mindmap: '新建空白思维导图',
  flow: '新建空白流程图',
}
const DOC_TEMPLATE_CATEGORIES = [
  { key: 'mine', label: '我的模板' },
  { key: 'shared', label: '与我共享' },
  { key: 'recommend', label: '推荐' },
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '热门模板' },
  { key: 'project', label: '项目管理' },
  { key: 'weekly', label: '周报日报' },
  { key: 'meeting', label: '会议' },
  { key: 'okr', label: 'OKR' },
  { key: 'rd', label: '研发' },
  { key: 'product', label: '产品' },
  { key: 'design', label: '设计' },
  { key: 'ops', label: '运营' },
  { key: 'market', label: '市场' },
]

/** 新建到哪个文档库 */
const docTemplateTargetName = computed(
  () => folders.value.find((f) => f.id === activeFolderId.value)?.name || '我的文档库',
)

function openDocTemplate(type: DocType) {
  docTemplateType.value = type
  docTemplateKeyword.value = ''
  docTemplateCategory.value = 'recommend'
  docTemplateOpen.value = true
}

function createBlankDocFromTemplate() {
  const type = docTemplateType.value
  docTemplateOpen.value = false
  createDoc(type, activeFolderId.value || undefined)
}

function onAddItem(key: string) {
  addOpen.value = false
  if (['doc', 'sheet', 'mindmap', 'flow'].includes(key)) {
    openDocTemplate(key as DocType)
    return
  }
  onAddMenu({ key })
}

/** 上传 / 模板库下拉：与「新建」同一套面板样式和悬停 / 点击交互 */
const uploadOpen = ref(false)
const templateOpen = ref(false)
const UPLOAD_ITEMS = [
  { key: 'md', label: 'Markdown (.md)', icon: FileMarkdownOutlined },
  { key: 'txt', label: '文本 (.txt)', icon: FileTextOutlined },
  { key: 'html', label: '网页 (.html)', icon: Html5Outlined },
]
const TEMPLATE_ITEMS = [
  { key: 'meeting', label: '会议纪要', icon: ScheduleOutlined },
  { key: 'weekly', label: '周报', icon: FileDoneOutlined },
  { key: 'prd', label: '产品需求文档', icon: SnippetsOutlined },
]
function onUploadItem(key: string) {
  uploadOpen.value = false
  onUploadMenu({ key })
}
function onTemplateItem(key: string) {
  templateOpen.value = false
  onTemplateMenu({ key })
}

// ---- 编辑器 ----
/** 解析正文 h1 / h2 / h3 生成右侧大纲 */
function refreshOutline() {
  if (!editorRef.value || activeDoc.value?.type !== 'doc') {
    outline.value = []
    return
  }
  refreshEmptyBlocks(editorRef.value)
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

/** 空块占位符（对标飞书）：没有内容的标题 / 引用打 data-empty，样式里显示灰色的块类型提示；
 *  列表项不显示提示（新增的行只保留序号 / 圆点，避免“列表”字样干扰阅读） */
const EMPTY_BLOCK_SELECTOR = 'h1, h2, h3, blockquote'
function refreshEmptyBlocks(editor: HTMLElement) {
  editor.querySelectorAll<HTMLElement>(EMPTY_BLOCK_SELECTOR).forEach((el) => {
    // 零宽字符不算内容；含图片 / 表格 / 嵌套列表等也不算空
    const empty =
      !(el.textContent || '').replace(/[\u200b\ufeff]/g, '') && !el.querySelector('img, table, hr, ul, ol, pre')
    el.toggleAttribute('data-empty', empty)
  })
}

function scrollToHeading(id: string) {
  const el = document.getElementById(id)
  const editor = editorRef.value
  // 目标标题被折叠隐藏时：先展开全部折叠，否则滚不过去
  if (el && editor && el.hasAttribute('data-fold-hidden')) {
    editor.querySelectorAll('[data-folded]').forEach((h) => h.removeAttribute('data-folded'))
    applyHeadingFolds(editor)
  }
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(activeDoc, (doc) => {
  nextTick(() => {
    if (doc?.type === 'doc' && editorRef.value) {
      editorRef.value.innerHTML = doc.content || ''
      normalizeTodoOrder(editorRef.value)
      normalizeOrderedLists(editorRef.value)
      ensureCodeHeads(editorRef.value)
      refreshOutline()
      refreshEmptyState()
      applyHeadingFolds(editorRef.value)
    } else {
      outline.value = []
      editorEmpty.value = false
    }
  })
}, { immediate: true })

/** 编辑器是否为空（无文字，最多残留一个 br） */
function isEditorEmpty(ed: HTMLElement): boolean {
  // 只剩一个空标题 / 空引用不算空：它有自己的类型提示和块手柄
  return !ed.textContent?.trim() && ed.children.length <= 1 && !ed.querySelector('h1, h2, h3, blockquote')
}

/** 正文数据为空时显示占位提示（类名驱动，兼容 <p><br></p> 等残留空结构） */
const editorEmpty = ref(false)
/** 有实际内容的元素：图片 / 表格 / 分割线 / 代码块 / 列表 / 待办 / 高亮块 / 分栏 */
const RICH_CONTENT_SELECTOR = 'img, table, hr, pre, ul, ol, h1, h2, h3, blockquote, .docs-todo, .docs-callout, .docs-cols'

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

// ---- 代码块（对标云文档）：顶部语言栏 + 一键复制 ----
/**
 * 语言栏由脚本注入到 <pre> 里，只承担展示 / 复制，
 * 落盘前会统一剥离，不污染文档内容（参考待办勾选框的伪元素思路）。
 */
const CODE_HEAD_SELECTOR = ':scope > .docs-code-head'
/** 注入到代码块里的只读节点：语言栏 + 彩色代码叠层，落盘前统一剥离 */
const CODE_INJECTED_SELECTOR = '.docs-code-head, .docs-code-highlight'
/** 语言切换菜单的候选项（对齐常见代码块组件，覆盖主流语言） */
const CODE_LANG_OPTIONS: { key: string; label: string }[] = [
  { key: 'text', label: '纯文本' },
  { key: 'bash', label: 'Bash' },
  { key: 'c', label: 'C' },
  { key: 'cpp', label: 'C++' },
  { key: 'csharp', label: 'C#' },
  { key: 'css', label: 'CSS' },
  { key: 'go', label: 'Go' },
  { key: 'html', label: 'HTML' },
  { key: 'java', label: 'Java' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'json', label: 'JSON' },
  { key: 'kotlin', label: 'Kotlin' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'php', label: 'PHP' },
  { key: 'python', label: 'Python' },
  { key: 'ruby', label: 'Ruby' },
  { key: 'rust', label: 'Rust' },
  { key: 'sql', label: 'SQL' },
  { key: 'swift', label: 'Swift' },
  { key: 'typescript', label: 'TypeScript' },
  { key: 'xml', label: 'XML' },
  { key: 'yaml', label: 'YAML' },
]
const CODE_LANG_LABEL: Record<string, string> = Object.fromEntries(
  CODE_LANG_OPTIONS.map((it) => [it.key, it.label]),
)
/** 用户手动选过语言的代码块：不再跟随内容自动识别 */
const manualLangPres = new WeakSet<HTMLElement>()

/** 按内容特征粗判代码语言，仅用于语言栏展示 */
function detectCodeLang(code: string): string {
  const src = code.trim()
  if (!src) return 'text'
  if (/^[\[{]/.test(src)) {
    try {
      JSON.parse(src)
      return 'json'
    } catch {
      /* 不是 JSON，继续往下判断 */
    }
  }
  if (/^#!.*\b(bash|sh|zsh)\b/m.test(src)) return 'bash'
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(src)) return 'sql'
  if (/<\/?[a-z][\w:-]*(\s[^>]*)?>/i.test(src)) return 'html'
  if (/^\s*package\s+\w+|^\s*func\s+[\w>(]/m.test(src)) return 'go'
  if (/^\s*(def|class)\s+\w+\s*[:(]|^\s*from\s+[\w.]+\s+import\s+/m.test(src)) return 'python'
  if (/^\s*(import|export)\b[^\n]*\bfrom\b|^\s*export\s+(default|const|function|class)\b/m.test(src)) return 'javascript'
  if (/^\s*(interface|type)\s+\w+\s*[={]|:\s*(string|number|boolean|any)\b/m.test(src)) return 'typescript'
  if (/^\s*(async\s+)?function\b|^\s*(const|let|var)\s+[\w${]+\s*=|=>/m.test(src)) return 'javascript'
  if (/^\s*public\s+(class|interface)\b|^\s*import\s+java\.|^\s*public\s+static\s+void\s+main\b|System\.out\./m.test(src)) return 'java'
  if (/^\s*[.#]?[\w-]+(\s*[,>]\s*[.#]?[\w-]+)*\s*\{[^}]*:[^}]*\}/m.test(src)) return 'css'
  if (/^\s*[\w-]+\s*:\s*\S/m.test(src) && /^\s*-\s+\S/m.test(src)) return 'yaml'
  if (/^\s*(npm|pnpm|yarn|git|cd|ls|curl|wget|echo|mkdir|rm|cp|mv|node|docker|kubectl)\b/m.test(src)) return 'bash'
  if (/^#{1,6}\s+\S|^\s*[-*]\s+\S/m.test(src)) return 'markdown'
  return 'text'
}

// ---- 代码块语法着色 ----
/**
 * 着色采用「叠层」方案：可编辑文本保持原样（只把颜色设为透明），
 * 彩色文本由注入的只读层绘制，输入、光标、撤销都仍然是原生 contenteditable 行为。
 */
type CodeToken = { cls: string; text: string }
type CodeLangRules = {
  line?: string[]
  block?: [string, string][]
  quotes?: string
  keywords?: Set<string>
  /** SQL 等不区分大小写的语言 */
  ci?: boolean
  /** Shell 变量（$VAR） */
  vars?: boolean
}
const kw = (words: string) => new Set(words.split(/\s+/).filter(Boolean))

const JS_KEYWORDS = kw(
  'async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set super switch this throw true try typeof undefined var void while yield interface type enum implements readonly static declare namespace as',
)
const JS_RULES: CodeLangRules = {
  line: ['//'],
  block: [['/*', '*/']],
  quotes: '"\'`',
  keywords: JS_KEYWORDS,
}
const CODE_LANG_RULES: Record<string, CodeLangRules> = {
  javascript: JS_RULES,
  typescript: JS_RULES,
  json: { quotes: '"', keywords: kw('true false null') },
  python: {
    line: ['#'],
    block: [
      ['"""', '"""'],
      ["'''", "'''"],
    ],
    quotes: '"\'',
    keywords: kw(
      'def class return if elif else for while in not and or import from as with try except finally raise lambda pass break continue global nonlocal yield assert del is None True False async await match case',
    ),
  },
  java: {
    line: ['//'],
    block: [['/*', '*/']],
    quotes: '"\'',
    keywords: kw(
      'public private protected class interface extends implements import package static final void new return if else for while switch case break continue try catch finally throw throws this super int long double float boolean char byte short String true false null record',
    ),
  },
  go: {
    line: ['//'],
    block: [['/*', '*/']],
    quotes: '"\'`',
    keywords: kw(
      'package import func type struct interface var const if else for range switch case break continue return defer go map chan select nil true false string int int64 float64 bool error',
    ),
  },
  rust: {
    line: ['//'],
    block: [['/*', '*/']],
    quotes: '"\'',
    keywords: kw(
      'fn let mut pub use mod struct enum impl trait for while loop if else match return self Self crate super async await move ref where const static type dyn box as true false Some None Ok Err',
    ),
  },
  c: {
    line: ['//'],
    block: [['/*', '*/']],
    quotes: '"\'',
    keywords: kw(
      'int long short char float double void bool struct union enum typedef static const extern inline return if else for while do switch case break continue sizeof new delete true false NULL',
    ),
  },
  cpp: {
    line: ['//'],
    block: [['/*', '*/']],
    quotes: '"\'',
    keywords: kw(
      'int long short char float double void bool class struct union enum typedef static const constexpr extern inline virtual override public private protected namespace using template typename return if else for while do switch case break continue sizeof new delete true false nullptr NULL auto',
    ),
  },
  csharp: {
    line: ['//'],
    block: [['/*', '*/']],
    quotes: '"\'',
    keywords: kw(
      'using namespace class struct interface public private protected internal static readonly const void int string bool var new return if else for foreach while switch case break continue try catch finally throw true false null async await',
    ),
  },
  kotlin: {
    line: ['//'],
    block: [['/*', '*/']],
    quotes: '"\'',
    keywords: kw(
      'fun val var class object interface data enum when if else for while do return import package private public protected internal override open abstract sealed companion true false null this super',
    ),
  },
  swift: {
    line: ['//'],
    block: [['/*', '*/']],
    quotes: '"',
    keywords: kw(
      'func let var class struct enum protocol extension import if else for while repeat switch case break continue return true false nil self Self public private internal static async await try catch throw guard defer',
    ),
  },
  ruby: {
    line: ['#'],
    quotes: '"\'',
    keywords: kw(
      'def end class module if elsif else unless while until for do return yield begin rescue ensure raise true false nil self require attr_accessor attr_reader',
    ),
  },
  php: {
    line: ['//', '#'],
    block: [['/*', '*/']],
    quotes: '"\'',
    keywords: kw(
      'function class interface extends implements public private protected static const return if else elseif foreach for while switch case break continue new echo true false null array async await namespace use',
    ),
  },
  sql: {
    line: ['--'],
    block: [['/*', '*/']],
    quotes: '"\'',
    ci: true,
    keywords: kw(
      'SELECT INSERT UPDATE DELETE CREATE ALTER DROP TABLE FROM WHERE JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER HAVING LIMIT OFFSET VALUES INTO SET AS AND OR NOT NULL IS IN LIKE BETWEEN DISTINCT COUNT SUM AVG MIN MAX PRIMARY KEY FOREIGN REFERENCES INDEX UNION ALL CASE WHEN THEN ELSE END',
    ),
  },
  bash: {
    line: ['#'],
    quotes: '"\'`',
    vars: true,
    keywords: kw(
      'if then elif else fi for in do done case esac function export local return echo cd ls rm mkdir sudo clear source exit read',
    ),
  },
  yaml: {
    line: ['#'],
    quotes: '"\'',
    keywords: kw('true false null yes no on off'),
  },
  css: {
    block: [['/*', '*/']],
    quotes: '"\'',
  },
}

/** 按语言把代码切成带颜色的 token；未知语言原样返回 */
function tokenizeCode(code: string, lang: string): CodeToken[] {
  const rules = CODE_LANG_RULES[lang]
  if (!rules) return [{ cls: '', text: code }]
  const tokens: CodeToken[] = []
  let buf = ''
  const flush = () => {
    if (buf) {
      tokens.push({ cls: '', text: buf })
      buf = ''
    }
  }
  const push = (cls: string, text: string) => {
    flush()
    tokens.push({ cls, text })
  }
  let i = 0
  while (i < code.length) {
    const ch = code[i]
    // 行注释（要求位于行首或空白之后，# 号才不会把 a#b 之类误判成注释）
    const lineMark = rules.line?.find((m) => code.startsWith(m, i))
    if (lineMark && (i === 0 || /\s/.test(code[i - 1]))) {
      let j = code.indexOf('\n', i)
      if (j < 0) j = code.length
      push('tk-c', code.slice(i, j))
      i = j
      continue
    }
    // 块注释
    const blockMark = rules.block?.find(([s]) => code.startsWith(s, i))
    if (blockMark) {
      const end = code.indexOf(blockMark[1], i + blockMark[0].length)
      const j = end < 0 ? code.length : end + blockMark[1].length
      push('tk-c', code.slice(i, j))
      i = j
      continue
    }
    // 字符串（含转义；单行字符串遇到换行即结束）
    if (rules.quotes?.includes(ch)) {
      let j = i + 1
      while (j < code.length) {
        if (code[j] === '\\') {
          j += 2
          continue
        }
        if (code[j] === ch) {
          j++
          break
        }
        if (code[j] === '\n' && ch !== '`') break
        j++
      }
      const text = code.slice(i, j)
      // 字符串后紧跟冒号：JSON / 对象的键
      push(/^\s*:/.test(code.slice(j)) ? 'tk-a' : 'tk-s', text)
      i = j
      continue
    }
    // Shell 变量
    if (rules.vars && ch === '$') {
      const m = /^\$[A-Za-z_]\w*/.exec(code.slice(i))
      if (m) {
        push('tk-v', m[0])
        i += m[0].length
        continue
      }
    }
    // 数字
    if (/[0-9]/.test(ch) && !/[\w$]/.test(code[i - 1] || '')) {
      const m = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(code.slice(i))
      if (m) {
        push('tk-n', m[0])
        i += m[0].length
        continue
      }
    }
    // 标识符：关键字 / 函数调用 / 属性键 / 类型名
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1
      while (j < code.length && /[\w$]/.test(code[j])) j++
      const word = code.slice(i, j)
      const matched = rules.keywords?.has(rules.ci ? word.toUpperCase() : word)
      if (matched) push('tk-k', word)
      else if (/^\s*\(/.test(code.slice(j))) push('tk-f', word)
      else if (/^\s*:/.test(code.slice(j))) push('tk-a', word)
      else if (/^[A-Z]/.test(word)) push('tk-t', word)
      else buf += word
      i = j
      continue
    }
    buf += ch
    i++
  }
  flush()
  return tokens
}

/** HTML / XML：标签、属性、属性值、注释分别着色 */
function tokenizeMarkup(code: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let buf = ''
  const flush = () => {
    if (buf) {
      tokens.push({ cls: '', text: buf })
      buf = ''
    }
  }
  const push = (cls: string, text: string) => {
    flush()
    tokens.push({ cls, text })
  }
  let i = 0
  while (i < code.length) {
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4)
      const j = end < 0 ? code.length : end + 3
      push('tk-c', code.slice(i, j))
      i = j
      continue
    }
    if (code[i] !== '<') {
      buf += code[i]
      i++
      continue
    }
    const tag = /^<\/?([A-Za-z][\w:-]*)/.exec(code.slice(i))
    if (!tag) {
      buf += code[i]
      i++
      continue
    }
    push('', code.slice(i, i + tag[0].length - tag[1].length))
    push('tk-t', tag[1])
    i += tag[0].length
    while (i < code.length) {
      const c = code[i]
      if (c === '>') {
        push('', '>')
        i++
        break
      }
      if (c === '/' && code[i + 1] === '>') {
        push('', '/>')
        i += 2
        break
      }
      if (c === '"' || c === "'") {
        let j = i + 1
        while (j < code.length && code[j] !== c) j++
        j = Math.min(code.length, j + 1)
        push('tk-s', code.slice(i, j))
        i = j
        continue
      }
      const attr = /^[A-Za-z_:][\w:.-]*/.exec(code.slice(i))
      if (attr) {
        push('tk-a', attr[0])
        i += attr[0].length
        continue
      }
      if (c === '=') {
        push('', '=')
        i++
        continue
      }
      buf += c
      i++
    }
  }
  flush()
  return tokens
}

function codeHighlightHtml(code: string, lang: string): string {
  const tokens = lang === 'html' || lang === 'xml' ? tokenizeMarkup(code) : tokenizeCode(code, lang)
  return tokens
    .map((t) => (t.cls ? `<span class="${t.cls}">${escapeHtml(t.text)}</span>` : escapeHtml(t.text)))
    .join('')
}

/** 绘制彩色代码层；纯文本 / Markdown 不着色 */
function renderCodeHighlight(pre: HTMLElement) {
  const lang = pre.dataset.lang || 'text'
  const existed = pre.querySelector<HTMLElement>(':scope > .docs-code-highlight')
  const supported = lang === 'html' || lang === 'xml' || !!CODE_LANG_RULES[lang]
  if (lang === 'text' || lang === 'markdown' || !supported) {
    existed?.remove()
    pre.classList.remove('is-code-colored')
    return
  }
  let layer = existed
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'docs-code-highlight'
    layer.setAttribute('contenteditable', 'false')
    layer.setAttribute('aria-hidden', 'true')
    pre.appendChild(layer)
  }
  pre.classList.add('is-code-colored')
  const html = codeHighlightHtml(codeRenderText(pre), lang)
  if (layer.innerHTML !== html) layer.innerHTML = html
}

/** 代码正文（去掉语言栏），用于语言判断；不挂载到文档，避免触发排版 */
function codeSourceOf(pre: HTMLElement): string {
  const clone = pre.cloneNode(true) as HTMLElement
  clone.querySelectorAll(CODE_INJECTED_SELECTOR).forEach((h) => h.remove())
  // <br> 还原成换行，才能按行做语言特征匹配
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  return (clone.textContent || '').replace(/ /g, ' ')
}

/** 代码正文（去掉注入层），用于着色渲染；保留 &nbsp;，保证与可编辑文本换行一致 */
function codeRenderText(pre: HTMLElement): string {
  const clone = pre.cloneNode(true) as HTMLElement
  clone.querySelectorAll(CODE_INJECTED_SELECTOR).forEach((h) => h.remove())
  clone.removeAttribute('contenteditable')
  clone.style.position = 'absolute'
  clone.style.left = '-99999px'
  clone.style.top = '0'
  clone.style.padding = '0'
  clone.style.border = '0'
  clone.style.whiteSpace = 'pre-wrap'
  document.body.appendChild(clone)
  const text = clone.innerText || clone.textContent || ''
  clone.remove()
  return text
}

/** 代码正文（去掉注入层），用于复制；借助临时挂载拿到真实的换行 */
function codeTextOf(pre: HTMLElement): string {
  const clone = pre.cloneNode(true) as HTMLElement
  clone.querySelectorAll(CODE_INJECTED_SELECTOR).forEach((h) => h.remove())
  clone.removeAttribute('contenteditable')
  clone.style.position = 'absolute'
  clone.style.left = '-99999px'
  clone.style.top = '0'
  clone.style.padding = '0'
  clone.style.border = '0'
  clone.style.whiteSpace = 'pre-wrap'
  document.body.appendChild(clone)
  const text = (clone.innerText || clone.textContent || '').replace(/ /g, ' ')
  clone.remove()
  return text.replace(/\n+$/, '')
}

/** 语言栏模板：左侧语言切换，右侧自动换行开关 + 复制按钮 */
function codeHeadHtml(lang: string, wrapOff: boolean): string {
  const label = escapeHtml(CODE_LANG_LABEL[lang] || CODE_LANG_LABEL.text)
  return (
    `<div class="docs-code-head" contenteditable="false">` +
    `<button type="button" class="docs-code-lang" title="切换代码语言">` +
    `<svg class="docs-code-lang-icon" viewBox="0 0 16 16" aria-hidden="true">` +
    `<path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>` +
    `<span class="docs-code-lang-text">${label}</span>` +
    `<svg class="docs-code-lang-caret" viewBox="0 0 10 10" aria-hidden="true">` +
    `<path d="M2.5 4 5 6.5 7.5 4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>` +
    `</button>` +
    `<div class="docs-code-head-actions">` +
    `<button type="button" class="docs-code-wrap${wrapOff ? '' : ' is-on'}" title="${wrapOff ? '开启自动换行' : '关闭自动换行'}">` +
    `<svg viewBox="0 0 16 16" aria-hidden="true">` +
    `<path d="M2 4h12M2 8h9a2 2 0 0 1 0 4H8.5M2 12h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="m10 10-1.5 2 1.5 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>` +
    `<span>自动换行</span>` +
    `</button>` +
    `<button type="button" class="docs-code-copy" title="复制代码">` +
    `<svg viewBox="0 0 16 16" aria-hidden="true">` +
    `<rect x="5.5" y="5.5" width="8" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/>` +
    `<path d="M10.5 3.6A1.6 1.6 0 0 0 8.9 2H4.1A2.1 2.1 0 0 0 2 4.1v4.8a1.6 1.6 0 0 0 1.6 1.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` +
    `</svg>` +
    `<span class="docs-code-copy-text">复制</span>` +
    `</button>` +
    `</div>` +
    `</div>`
  )
}

/** 同步语言标签（内容变化后调用；手动选过语言的块保持不变） */
function updateCodeLang(pre: HTMLElement) {
  if (manualLangPres.has(pre)) return
  const textEl = pre.querySelector<HTMLElement>('.docs-code-lang-text')
  if (!textEl) return
  const lang = detectCodeLang(codeSourceOf(pre))
  if (pre.dataset.lang === lang) return
  pre.dataset.lang = lang
  textEl.textContent = CODE_LANG_LABEL[lang] || CODE_LANG_LABEL.text
}

/** 给所有代码块补齐语言栏（新建 / 粘贴 / 打开文档后调用） */
function ensureCodeHeads(editor: HTMLElement) {
  editor.querySelectorAll('pre').forEach((node) => {
    const pre = node as HTMLElement
    // 代码块不做拼写检查（透明文字上的红色波浪线会干扰彩色层）
    pre.spellcheck = false
    if (pre.querySelector(CODE_HEAD_SELECTOR)) {
      // 彩色层被撤销 / 剪切等操作带走时补回来
      if (!pre.querySelector(':scope > .docs-code-highlight')) renderCodeHighlight(pre)
      return
    }
    const src = codeSourceOf(pre)
    // 文档里已保存过语言（打开旧文档 / 用户选过）就以它为准，不再自动识别
    const savedLang = pre.dataset.lang
    if (savedLang) manualLangPres.add(pre)
    const lang = savedLang || detectCodeLang(src)
    pre.dataset.lang = lang
    pre.insertAdjacentHTML('afterbegin', codeHeadHtml(lang, pre.dataset.wrap === 'off'))
    // 空代码块补一个换行，保证光标落在语言栏下方而不是栏内
    if (!src.trim() && !pre.querySelector('br')) pre.insertAdjacentHTML('beforeend', '<br>')
    // 新建空代码块时光标停在 pre 开头，注入语言栏后要挪到栏后面
    const head = pre.querySelector<HTMLElement>(CODE_HEAD_SELECTOR)
    const sel = window.getSelection()
    if (head && sel?.rangeCount && pre.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0)
      if (range.startContainer === pre && range.startOffset === 0) {
        const after = document.createRange()
        after.setStartAfter(head)
        after.collapse(true)
        sel.removeAllRanges()
        sel.addRange(after)
      }
    }
    renderCodeHighlight(pre)
  })
}

/** 光标所在的代码块 */
function caretCodeBlock(): HTMLElement | null {
  const node = window.getSelection()?.anchorNode
  const el = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
  return el?.closest<HTMLElement>('pre') ?? null
}

/** 只刷新光标所在代码块（语言标签 + 彩色层），避免每次输入处理全部代码块 */
function refreshCodeBlockAtCaret(editor: HTMLElement) {
  const pre = caretCodeBlock()
  if (!pre || !editor.contains(pre)) return
  updateCodeLang(pre)
  // 中文输入法组合中不刷新彩色层（此时彩色层隐藏、显示原生文字）
  if (!pre.classList.contains('is-composing')) renderCodeHighlight(pre)
}

/** 正在输入法组合的代码块（组合期间彩色层隐藏、显示原生文字） */
let composingCodePre: HTMLElement | null = null

/** 输入法组合开始：暂时隐藏彩色层，让候选 / 拼音可见 */
function onEditorCompositionStart() {
  composingCodePre = caretCodeBlock()
  composingCodePre?.classList.add('is-composing')
}

/** 输入法组合结束：恢复彩色层 */
function onEditorCompositionEnd() {
  const pre = composingCodePre || caretCodeBlock()
  composingCodePre = null
  if (!pre) return
  pre.classList.remove('is-composing')
  renderCodeHighlight(pre)
}

/** 落盘用的干净 HTML：去掉注入的语言栏，文档内容保持原样 */
function editorContentHtml(editor: HTMLElement): string {
  if (!editor.querySelector(CODE_INJECTED_SELECTOR) && !editor.querySelector('pre.is-composing')) return editor.innerHTML
  const clone = editor.cloneNode(true) as HTMLElement
  clone.querySelectorAll(CODE_INJECTED_SELECTOR).forEach((h) => h.remove())
  // 着色态 / 输入法态是运行时类名，不写进文档
  clone.querySelectorAll('pre').forEach((node) => {
    const pre = node as HTMLElement
    pre.classList.remove('is-code-colored', 'is-composing')
    pre.removeAttribute('spellcheck')
    if (!pre.getAttribute('class')) pre.removeAttribute('class')
  })
  return clone.innerHTML
}

/** 复制代码块正文，按钮上给出“已复制”反馈 */
async function copyCodeBlock(pre: HTMLElement, btn?: HTMLElement) {
  const text = codeTextOf(pre)
  if (!text) return
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ok = document.execCommand('copy')
    ta.remove()
  }
  if (!ok) {
    message.warning('复制失败，请手动复制')
    return
  }
  if (!btn) {
    message.success('已复制')
    return
  }
  const textEl = btn.querySelector<HTMLElement>('.docs-code-copy-text')
  btn.classList.add('is-done')
  if (textEl) textEl.textContent = '已复制'
  window.setTimeout(() => {
    btn.classList.remove('is-done')
    if (textEl) textEl.textContent = '复制'
  }, 1600)
}

// ---- 代码块语言切换菜单 ----
const codeLangMenu = reactive({ open: false, top: 0, left: 0, lang: 'text' })
const codeLangMenuRef = ref<HTMLElement | null>(null)
let codeLangMenuPre: HTMLElement | null = null
/** 菜单高度上限（与样式 max-height 一致），用于判断向上还是向下弹出 */
const CODE_LANG_MENU_MAX_H = 300

function closeCodeLangMenu() {
  codeLangMenu.open = false
  codeLangMenuPre = null
}

/** 点击语言栏：在按钮下方弹出语言列表（空间不足时向上弹） */
function openCodeLangMenu(btn: HTMLElement) {
  const pre = btn.closest('pre') as HTMLElement | null
  const wrap = btn.closest('.docs-editor-wrap') as HTMLElement | null
  if (!pre || !wrap) return
  // 再次点击同一个语言按钮：收起
  if (codeLangMenu.open && codeLangMenuPre === pre) {
    closeCodeLangMenu()
    return
  }
  codeLangMenuPre = pre
  codeLangMenu.lang = pre.dataset.lang || 'text'
  const btnRect = btn.getBoundingClientRect()
  const wrapRect = wrap.getBoundingClientRect()
  const menuH = Math.min(CODE_LANG_MENU_MAX_H, CODE_LANG_OPTIONS.length * 30 + 12)
  const openUp = window.innerHeight - btnRect.bottom < menuH + 12
  codeLangMenu.left = Math.max(8, Math.min(btnRect.left - wrapRect.left, wrapRect.width - 184))
  codeLangMenu.top = openUp
    ? Math.max(8, btnRect.top - wrapRect.top - menuH - 6)
    : btnRect.bottom - wrapRect.top + 6
  codeLangMenu.open = true
}

function pickCodeLang(key: string) {
  const pre = codeLangMenuPre
  closeCodeLangMenu()
  if (!pre) return
  pre.dataset.lang = key
  manualLangPres.add(pre)
  const textEl = pre.querySelector<HTMLElement>('.docs-code-lang-text')
  if (textEl) textEl.textContent = CODE_LANG_LABEL[key] || key
  renderCodeHighlight(pre)
  onEditorInput()
}

/** 自动换行开关：默认开启；关闭后代码不折行，可横向滚动 */
function toggleCodeWrap(pre: HTMLElement, btn: HTMLElement) {
  const nextOff = pre.dataset.wrap !== 'off'
  if (nextOff) pre.dataset.wrap = 'off'
  else delete pre.dataset.wrap
  btn.classList.toggle('is-on', !nextOff)
  btn.title = nextOff ? '开启自动换行' : '关闭自动换行'
  onEditorInput()
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
  // 代码块内容变化后同步语言标签与彩色层（只处理光标所在块，开销可控）
  refreshCodeBlockAtCaret(editor)
  // 正文编辑后重新定位评论高亮
  scheduleCommentHighlights()
}

/** 落盘 / 刷新界面状态（原 onEditorInput 主体） */
function onEditorChange(editor: HTMLElement, doc: DocItem) {
  // 先收拢空结构，落盘的 HTML 也保持干净
  refreshEmptyState()
  // 新建 / 粘贴进来的代码块补齐语言栏；语言栏不写进文档内容
  ensureCodeHeads(editor)
  // 有序列表：相邻列表编号连续、修正非法嵌套
  normalizeOrderedLists(editor)
  doc.content = editorContentHtml(editor)
  doc.updatedAt = Date.now()
  refreshOutline()
  // 首行"+"：空文档保持显示（配合输入提示），有内容后收起、由悬停接管
  if (isEditorEmpty(editor)) {
    hoverBlock.value = editor
    hoverBlockType.value = 'p'
    plusTop.value = 0 // 与编辑器首行（输入提示）对齐
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
    plusTop.value = 0 // 与编辑器首行（输入提示）对齐
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
/** 块手柄 / 折叠三角的高度（px），与样式里的 24px 一致 */
const HANDLE_SIZE = 24
const hoverIsHeading = computed(() => /^h[1-3]$/.test(hoverBlockType.value))
/** 只有编辑器直属的标题可以折叠（分栏 / 高亮块里的标题没有"后续内容"可收） */
const hoverFoldable = computed(
  () => hoverIsHeading.value && !!hoverBlock.value && hoverBlock.value.parentElement === editorRef.value,
)
const hoverFolded = ref(false)

/**
 * 按标题上的 data-folded 重新计算被折叠的块：从折叠标题之后，到下一个同级或更高级标题之前。
 * 被隐藏的块打 data-fold-hidden（样式里 display:none）。
 */
function applyHeadingFolds(editor: HTMLElement) {
  editor.querySelectorAll('[data-fold-hidden]').forEach((el) => el.removeAttribute('data-fold-hidden'))
  let hideLevel = 0
  for (const el of Array.from(editor.children)) {
    const level = Number(/^H([1-3])$/.exec(el.tagName)?.[1] || 0)
    if (hideLevel) {
      if (level && level <= hideLevel) hideLevel = 0
      else {
        el.setAttribute('data-fold-hidden', '')
        continue
      }
    }
    if (level && el.hasAttribute('data-folded')) hideLevel = level
  }
}

/** 折叠 / 展开悬停的标题；编辑模式下折叠状态随文档保存 */
function toggleHeadingFold() {
  const editor = editorRef.value
  const block = hoverBlock.value
  const doc = activeDoc.value
  if (!editor || !block || !doc || block.parentElement !== editor) return
  block.toggleAttribute('data-folded')
  hoverFolded.value = block.hasAttribute('data-folded')
  applyHeadingFolds(editor)
  if (docsEditMode.value) {
    doc.content = editorContentHtml(editor)
    scheduleSave()
  }
}

/** 光标所在的标题若已折叠则先展开（在折叠标题里回车时，新行不能落进被隐藏的内容里） */
function unfoldHeadingAtCaret() {
  const editor = editorRef.value
  const node = window.getSelection()?.anchorNode
  if (!editor || !node || !editor.contains(node)) return
  const el = (node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement)?.closest('[data-folded]')
  if (!el || !editor.contains(el)) return
  el.removeAttribute('data-folded')
  if (hoverBlock.value === el) hoverFolded.value = false
  applyHeadingFolds(editor)
}
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
// 代码入口合并为一个：统一插入代码块（行内代码仍可在选中文字的浮动工具栏使用）
const blockExtraBtns = [
  { key: 'todo', title: '任务列表', icon: CheckSquareOutlined },
  { key: 'pre', title: '代码块', icon: CodeOutlined },
  { key: 'quote', title: '引用', glyph: '“' },
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
  { key: 'pre', title: '代码块', icon: CodeOutlined },
  { key: 'quote', title: '引用', glyph: '“' },
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
  const editor = editorRef.value
  if (!editor) return
  const target = e.target as HTMLElement
  if (!editor.contains(target)) return
  // 向上找到编辑器直属的块级元素（段落 / 标题 / 列表 / 引用 / 代码块）
  let block: HTMLElement | null = target
  while (
    block &&
    block !== editor &&
    block.parentElement !== editor &&
    !/^(P|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(block.tagName)
  ) {
    block = block.parentElement
  }
  if (!block || block === editor) {
    // 编辑器空白区：仅空文档（只有占位符）时在首行位置显示加号
    if (isEditorEmpty(editor)) {
      hoverBlock.value = editor
      hoverBlockType.value = 'p'
      plusTop.value = 0 // 与编辑器首行（输入提示）对齐
      plusVisible.value = true
    } else {
      plusVisible.value = false
    }
    return
  }
  hoverBlock.value = block
  hoverBlockType.value = blockTypeOf(block)
  hoverFolded.value = block.hasAttribute('data-folded')
  // 手柄高 24px：与块的首行垂直居中（标题行高比正文大）
  const cs = getComputedStyle(block)
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || HANDLE_SIZE
  plusTop.value = block.offsetTop + Math.max(0, Math.round((lineHeight - HANDLE_SIZE) / 2))
  plusVisible.value = true
}

function onEditorLeave(e: MouseEvent) {
  const rt = e.relatedTarget as HTMLElement | null
  // 仍在编辑器容器内（例如移向行右侧的评论图标）：不隐藏
  if (rt && (e.currentTarget as HTMLElement).contains(rt)) return
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
      // 列表项转待办：从列表里拆出来，不能把 div 留在 ul / ol 里面
      else if (block.tagName === 'LI' && block.parentElement?.parentElement === editor) placeInListGap(block, el, true)
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
      // 代码块：复制正文（去掉语言栏），其余块复制选中内容
      if (block.tagName === 'PRE') void copyCodeBlock(block)
      else {
        selectBlock()
        document.execCommand('copy')
        message.success('已复制')
      }
      break
    case 'comment': {
      // 块菜单里的评论：以整块内容为引用，在块旁边打开评论输入卡片
      openLineComposer(block, blockCommentQuote(block))
      break
    }
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
  // 列表项里「在下方添加列表」：同类型直接补一个新的列表项（每行独立、编号连续），
  // 不同类型另起一个列表，避免把列表插进列表里造成非法嵌套
  if (block.tagName === 'LI' && (kind === 'ul' || kind === 'ol')) {
    const list = block.parentElement
    if (list && /^(UL|OL)$/.test(list.tagName)) {
      const li = document.createElement('li')
      li.innerHTML = '<br>'
      if (list.tagName === kind.toUpperCase()) {
        block.after(li)
      } else {
        const newList = document.createElement(kind)
        newList.appendChild(li)
        list.after(newList)
      }
      editor.focus()
      const range = document.createRange()
      range.selectNodeContents(li)
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      plusVisible.value = false
      return
    }
  }
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

/** 编辑器点击：代码块复制 / 任务列表勾选 */
function onEditorClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const copyBtn = target.closest<HTMLElement>('.docs-code-copy')
  if (copyBtn) {
    const pre = copyBtn.closest('pre')
    if (pre) void copyCodeBlock(pre as HTMLElement, copyBtn)
    return
  }
  const wrapBtn = target.closest<HTMLElement>('.docs-code-wrap')
  if (wrapBtn) {
    const pre = wrapBtn.closest('pre')
    if (pre) toggleCodeWrap(pre as HTMLElement, wrapBtn)
    return
  }
  const langBtn = target.closest<HTMLElement>('.docs-code-lang')
  if (langBtn) {
    openCodeLangMenu(langBtn)
    return
  }
  if (!target.classList?.contains('docs-todo-box')) return
  target.parentElement?.classList.toggle('is-done')
  onEditorInput()
}

/** 点击代码块语言栏按钮时保持光标 / 选区不动，避免 contenteditable 抢焦点 */
function onEditorMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest?.('.docs-code-head button')) e.preventDefault()
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

/**
 * 有序列表整理：
 * 1. 修正历史数据里「列表直接嵌在列表里」的非法结构（旧版“在下方添加”造成）：
 *    同类型就地展开成列表项，保证每行是一行、编号连续；不同类型的挪到列表后面。
 * 2. 相邻的有序列表按顺序设置 start：列表本身保持独立，但序号接着上一个列表往下排。
 */
function normalizeOrderedLists(ed: HTMLElement) {
  // 1. 展开直接嵌在列表里的子列表
  ed.querySelectorAll<HTMLElement>('ol > ol, ol > ul, ul > ol, ul > ul').forEach((list) => {
    const parent = list.parentElement
    if (!parent) return
    if (parent.tagName === list.tagName) {
      // 同类型（有序套有序）：内容提升为父列表的项，编号自然连续
      while (list.firstChild) parent.insertBefore(list.firstChild, list)
      list.remove()
    } else {
      // 不同类型（如有序列表里嵌了无序列表）：挪到父列表后面，避免非法嵌套
      parent.after(list)
    }
  })
  // 展开后可能留下没有列表项的空列表，直接清掉
  ed.querySelectorAll<HTMLElement>('ol, ul').forEach((list) => {
    if (!list.querySelector(':scope > li')) list.remove()
  })
  // 2. 同一个父级里相邻的 ol 编号连续
  const walk = (parent: Element) => {
    let next = 0
    for (const node of Array.from(parent.children)) {
      const el = node as HTMLElement
      if (el.tagName === 'OL') {
        const count = el.querySelectorAll(':scope > li').length
        const start = next || Math.max(1, Number(el.getAttribute('start')) || 1)
        if (next) el.setAttribute('start', String(next))
        else if (el.getAttribute('start') === '1') el.removeAttribute('start')
        next = start + count
      } else {
        next = 0
        // 分栏 / 高亮块 / 表格单元格等容器里也可能有列表；
        // 列表项内部的嵌套列表单独编号，不在父级序列里处理
        if (/^(DIV|TD|TH|BLOCKQUOTE)$/.test(el.tagName)) walk(el)
      }
    }
  }
  walk(ed)
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
  // 光标在顶层列表的某一项里：待办紧跟这一项（空项则替换它），列表从这里拆成两段，
  // 而不是掉到整个列表的后面
  const startNode = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null
  const li = (startNode?.nodeType === 1 ? (startNode as HTMLElement) : startNode?.parentElement)?.closest('li') || null
  if (li && editor.contains(li) && li.parentElement?.parentElement === editor) {
    const empty = !(li.textContent || '').trim() && !li.querySelector('img, table, ul, ol, hr, pre')
    placeInListGap(li, el, empty)
  } else if (!block) {
    editor.appendChild(el)
  } else if (block === editor) {
    // 光标落在编辑器根上（块与块之间）：插到光标所在的位置，没有位置信息才放到末尾
    const offset = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : -1
    const ref = offset >= 0 ? editor.childNodes[offset] : null
    if (ref) editor.insertBefore(el, ref)
    else editor.appendChild(el)
  }
  // 空块直接替换，避免留下空行；非空块插到它下方
  else if (!(block.textContent || '').trim() && !block.querySelector(RICH_CONTENT_SELECTOR)) block.replaceWith(el)
  else block.after(el)
  focusTodoText(el)
}

/**
 * 把列表从 li 处拆开，在拆口放入 node：li 之前的项留在原列表，之后的项另起一个列表
 * （有序列表的序号接着往下排）；removeLi 为真时 li 本身移除（空列表项被替换）。
 */
function placeInListGap(li: Element, node: HTMLElement, removeLi: boolean) {
  const list = li.parentElement
  if (!list) return
  const items = Array.from(list.children)
  const index = items.indexOf(li)
  const after = items.slice(index + 1)
  list.after(node)
  if (after.length) {
    const rest = list.cloneNode(false) as HTMLElement
    rest.removeAttribute('id')
    if (list.tagName === 'OL') {
      // 后半段的起始序号：li 被移除时沿用它的序号，否则从它的下一个开始
      const start = (Number(list.getAttribute('start')) || 1) + index + (removeLi ? 0 : 1)
      rest.setAttribute('start', String(start))
    }
    after.forEach((item) => rest.appendChild(item))
    node.after(rest)
  }
  if (removeLi) li.remove()
  if (!list.children.length) list.remove()
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
  { key: 'pre', label: '代码块', keywords: '代码 daima', icon: CodeOutlined },
  { key: 'quote', label: '引用', keywords: 'yinyong', glyph: '“' },
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

/**
 * 把光标所在块转成指定类型。空文档里没有任何块可转（execCommand 可能什么都不做），
 * 这时直接建一个空块并把光标放进去，保证选了 H1 / H2 / H3 后该行立刻出现类型提示。
 */
function formatBlockAtCaret(editor: HTMLElement, tag: string) {
  if (!editor.firstElementChild && !(editor.textContent || '').trim()) {
    editor.innerHTML = `<${tag}><br></${tag}>`
    const range = document.createRange()
    range.setStart(editor.children[0], 0)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    return
  }
  document.execCommand('formatBlock', false, tag)
}

/**
 * 光标在空的列表项（只有序号 / 圆点、没有内容）里时，把这一行变成空的正文行，返回是否已处理。
 * - 顶层列表项：从列表里拆出来变成空段落；它后面的列表项另起一个列表，有序列表的序号接着往下排
 * - 嵌套列表项：先退回上一级（仍是列表项），再按一次才变成正文
 */
function exitEmptyListItemAtCaret(): boolean {
  const editor = editorRef.value
  const sel = window.getSelection()
  const node = sel?.anchorNode
  if (!editor || !sel || !sel.isCollapsed || !node || !editor.contains(node)) return false
  const li = (node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement)?.closest('li')
  const list = li?.parentElement
  if (!li || !list || !editor.contains(li) || !/^(UL|OL)$/.test(list.tagName)) return false
  // 有文字、图片或子列表都不算空
  if ((li.textContent || '').replace(/[\u200b\ufeff]/g, '') || li.querySelector('img, table, ul, ol, hr, pre')) return false

  if (list.parentElement?.closest('li')) {
    document.execCommand('outdent')
    return true
  }

  const p = document.createElement('p')
  p.innerHTML = '<br>'
  placeInListGap(li, p, true)

  const range = document.createRange()
  range.setStart(p, 0)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}

/**
 * 光标在 H1 / H2 / H3 里按回车：标题保持单行，光标后面的文字（如果有）移到下面新起的正文行，
 * 光标落到新行行首；空标题直接变回正文行。返回是否已处理。
 */
function breakOutOfHeadingAtCaret(): boolean {
  const editor = editorRef.value
  const sel = window.getSelection()
  if (!editor || !sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  const start = range.startContainer
  const heading = (start.nodeType === Node.ELEMENT_NODE ? (start as HTMLElement) : start.parentElement)?.closest<HTMLElement>(
    'h1, h2, h3',
  )
  if (!heading || !editor.contains(heading) || !heading.contains(range.endContainer)) return false

  const p = document.createElement('p')
  if (!heading.textContent && !heading.querySelector('img')) {
    // 空标题：整行变回正文
    p.innerHTML = '<br>'
    heading.replaceWith(p)
  } else {
    // 有选区先删掉，再把光标之后的内容搬到新行
    range.deleteContents()
    const tail = document.createRange()
    tail.selectNodeContents(heading)
    tail.setStart(range.startContainer, range.startOffset)
    p.appendChild(tail.extractContents())
    if (!p.textContent && !p.querySelector('img')) p.innerHTML = '<br>'
    if (!heading.textContent && !heading.querySelector('img')) heading.innerHTML = '<br>'
    heading.after(p)
  }
  const caret = document.createRange()
  caret.setStart(p, 0)
  caret.collapse(true)
  sel.removeAllRanges()
  sel.addRange(caret)
  return true
}

/**
 * 光标在高亮块里按回车：不在高亮块内部继续嵌套，而是在下方新起正文行。
 * 光标后面的内容移到新段落；空高亮块则直接变回正文。返回是否已处理。
 */
function breakOutOfCalloutAtCaret(): boolean {
  const editor = editorRef.value
  const sel = window.getSelection()
  if (!editor || !sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  const start = range.startContainer
  const callout = (start.nodeType === Node.ELEMENT_NODE ? (start as HTMLElement) : start.parentElement)?.closest<HTMLElement>(
    '.docs-callout',
  )
  if (!callout || !editor.contains(callout) || !callout.contains(range.endContainer)) return false

  const p = document.createElement('p')
  const empty = !(callout.textContent || '').replace(/[​﻿]/g, '').trim() && !callout.querySelector('img')
  if (empty) {
    // 空高亮块：整块变回正文行
    p.innerHTML = '<br>'
    callout.replaceWith(p)
  } else {
    // 有选区先删掉，再把光标之后的内容搬到新段落
    range.deleteContents()
    const tail = document.createRange()
    tail.selectNodeContents(callout)
    tail.setStart(range.startContainer, range.startOffset)
    p.appendChild(tail.extractContents())
    if (!p.textContent && !p.querySelector('img')) p.innerHTML = '<br>'
    if (!callout.textContent && !callout.querySelector('img')) callout.innerHTML = '<br>'
    callout.after(p)
  }
  const caret = document.createRange()
  caret.setStart(p, 0)
  caret.collapse(true)
  sel.removeAllRanges()
  sel.addRange(caret)
  return true
}

/** 空标题 / 空引用里按退格：退回普通正文（对标飞书），返回是否已处理 */
function demoteEmptyBlockAtCaret(): boolean {
  const editor = editorRef.value
  const sel = window.getSelection()
  const node = sel?.anchorNode
  if (!editor || !sel || !sel.isCollapsed || !node || !editor.contains(node)) return false
  const el = (node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement)?.closest<HTMLElement>(
    'h1[data-empty], h2[data-empty], h3[data-empty], blockquote[data-empty]',
  )
  if (!el || !editor.contains(el)) return false
  el.removeAttribute('data-folded')
  document.execCommand('formatBlock', false, 'p')
  return true
}

/** 插入命令执行体（"+"菜单与斜杠菜单共用） */
function runInsertCommand(editor: HTMLElement, cmd: string, arg?: string) {
  switch (cmd) {
    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
      formatBlockAtCaret(editor, cmd)
      break
    case 'quote':
      formatBlockAtCaret(editor, 'blockquote')
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
  // 空的有序 / 无序列表项：退格和回车都把这一行变成空的正文行（去掉序号 / 圆点）
  if ((e.key === 'Backspace' || e.key === 'Enter') && !e.shiftKey && !e.isComposing && !slash.visible && exitEmptyListItemAtCaret()) {
    e.preventDefault()
    onEditorInput()
    return
  }
  if (e.key === 'Enter' && !slash.visible) unfoldHeadingAtCaret()
  // 标题只占一行：回车（含 Shift+回车）不在标题里换行，而是在下面新起一行正文
  if (e.key === 'Enter' && !e.isComposing && !slash.visible && breakOutOfHeadingAtCaret()) {
    e.preventDefault()
    onEditorInput()
    return
  }
  // 高亮块：回车退出高亮块，在下方新起正文行（Shift+回车保留块内换行）
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !slash.visible && breakOutOfCalloutAtCaret()) {
    e.preventDefault()
    onEditorInput()
    return
  }
  if (e.key === 'Backspace' && !slash.visible && demoteEmptyBlockAtCaret()) {
    e.preventDefault()
    onEditorInput()
    return
  }
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
  // 工具栏最大宽度按 500px 估算（含评论按钮），居中于选区并做视口内避让
  const half = 250
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
    case 'comment': {
      // 以当前选中的文字为引用，在选区所在行旁边打开评论输入卡片
      const quote = bubbleRange?.toString() || ''
      const block = editorBlockOf(bubbleRange?.startContainer ?? null)
      if (block) openLineComposer(block, quote)
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
  // 代码语言菜单：点菜单和语言按钮以外的位置收起
  if (!codeLangMenuRef.value?.contains(target) && !target.closest?.('.docs-code-lang')) closeCodeLangMenu()
  // 行内评论卡片：点卡片外（以及行评论图标外）收起
  if (
    lineComposerOpen.value &&
    !lineComposerRef.value?.contains(target) &&
    !target.closest?.('.docs-line-comment-hit')
  ) {
    closeLineComposer()
  }
  if (bubbleRef.value?.contains(target)) return
  if (editorRef.value?.contains(target)) return
  hideBubble()
}

onMounted(() => {
  document.addEventListener('selectionchange', updateBubble)
  document.addEventListener('mousedown', onDocMouseDown, true)
  document.addEventListener('scroll', hideFloatPanels, true)
  window.addEventListener('resize', hideFloatPanels)
  // 窗口宽度变化会重排正文，评论高亮跟着重新定位
  window.addEventListener('resize', scheduleCommentHighlights)
})
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', updateBubble)
  document.removeEventListener('mousedown', onDocMouseDown, true)
  document.removeEventListener('scroll', hideFloatPanels, true)
  window.removeEventListener('resize', hideFloatPanels)
  window.removeEventListener('resize', scheduleCommentHighlights)
})

/** 滚动 / 缩放 / 切换文档时收起所有浮动面板（工具栏 + 斜杠菜单） */
function hideFloatPanels(e?: unknown) {
  hideBubble()
  closeSlash()
  // 代码语言菜单内部的滚动（滚轮 / 拖滚动条 / 触控板）不收起菜单
  const target = e instanceof Event ? e.target : null
  if (!(target instanceof Node) || !codeLangMenuRef.value?.contains(target)) closeCodeLangMenu()
}

/** 切换文档 / 退出编辑时收起工具栏 */
watch([activeDoc, docsEditMode], hideFloatPanels)

// ==================== 评论（参考飞书云文档） ====================
/** 右侧评论栏展开状态 */
const commentPanelOpen = ref(true)
const commentRailRef = ref<HTMLElement | null>(null)
/** 行内评论输入卡片：出现在点击的那一行右侧 */
const lineComposerOpen = ref(false)
const lineComposerTop = ref(0)
const lineComposerQuote = ref('')
const lineComposerDraft = ref('')
const lineComposerRef = ref<HTMLElement | null>(null)
const lineComposerInputRef = ref<HTMLTextAreaElement | null>(null)
/** 点击评论卡片后短暂高亮的评论 id */
const activeCommentId = ref('')
/** 正在回复的评论 id 与回复内容 */
const activeReplyId = ref('')
const replyDraft = ref('')
/** 被评论正文的高亮矩形（相对 .docs-editor-wrap，随内容一起滚动） */
const commentHighlights = ref<{ id: string; top: number; left: number; width: number; height: number }[]>([])

const comments = computed<DocComment[]>(() => {
  const list = docMeta.value.comments
  return Array.isArray(list) ? list : []
})
/** 行级评论：展示在右侧评论栏 */
const lineComments = computed(() => comments.value.filter((c) => (c.scope ? c.scope === 'line' : !!c.quote)))
/** 全文评论：展示在文档底部 */
const docComments = computed(() => comments.value.filter((c) => (c.scope ? c.scope === 'doc' : !c.quote)))

/** 悬停的行是否有内容：只有有内容的行右侧才显示评论入口 */
const hoverBlockHasContent = computed(() => {
  const block = hoverBlock.value
  const editor = editorRef.value
  if (!block || !editor || block === editor) return false
  if (block.tagName === 'PRE') return !!codeTextOf(block).trim()
  const text = (block.textContent || '').replace(/[​﻿]/g, '').trim()
  return !!text || !!block.querySelector('img, hr, table')
})

/** 行评论引用的文字（代码块取正文，不含语言栏 / 彩色层） */
function blockCommentQuote(block: HTMLElement): string {
  const text = block.tagName === 'PRE' ? codeTextOf(block) : (block.textContent || '').trim()
  return text.slice(0, 200)
}

/** 点击行右侧的评论图标：在该行旁边打开评论输入卡片 */
function commentHoveredBlock() {
  const block = hoverBlock.value
  if (!block) return
  openLineComposer(block, blockCommentQuote(block))
}

/** 从选区节点找到编辑器直属的块 */
function editorBlockOf(node: Node | null): HTMLElement | null {
  const editor = editorRef.value
  if (!editor || !node) return null
  let block: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  while (block && block !== editor && block.parentElement !== editor) block = block.parentElement
  return block && block !== editor ? block : null
}
/** 当前登录人展示名（评论作者） */
const commentAuthorName = computed(
  () => toDisplayName(authUser.value?.realName || authUser.value?.coAccount || getLoginUsername() || '') || '匿名',
)

function commentAvatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** 评论时间：刚刚 / n 分钟前 / n 小时前 / n 天前 / 日期 */
function commentTimeText(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(ts).toLocaleDateString()
}

function newCommentId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ---- 文档底部：点赞 + 评论 ----
const footCommentDraft = ref('')
const docLikeCount = computed(() => (Array.isArray(docMeta.value.likedBy) ? docMeta.value.likedBy.length : 0))
const docLiked = computed(() => {
  const list = docMeta.value.likedBy
  return Array.isArray(list) ? list.includes(ownerKey.value) : false
})

/** 点赞 / 取消点赞（按登录名记录在文档 data 里，随文档一起保存） */
function toggleDocLike() {
  const doc = activeDoc.value
  if (!doc || doc.type !== 'doc') return
  const key = ownerKey.value
  const list = Array.isArray(docMeta.value.likedBy) ? [...docMeta.value.likedBy] : []
  const index = list.indexOf(key)
  if (index >= 0) list.splice(index, 1)
  else list.push(key)
  const meta: DocMeta = { ...docMeta.value }
  if (list.length) meta.likedBy = list
  else delete meta.likedBy
  doc.data = meta
  onDocChanged(doc)
}

/** 底部评论：不引用正文，直接作为文档级评论 */
function submitFootComment() {
  const content = footCommentDraft.value.trim()
  if (!content) return
  const comment: DocComment = {
    id: newCommentId(),
    author: commentAuthorName.value,
    content,
    createdAt: Date.now(),
    scope: 'doc',
    replies: [],
  }
  updateComments([...comments.value, comment])
  footCommentDraft.value = ''
  activeCommentId.value = comment.id
  nextTick(scheduleCommentHighlights)
}

function onFootCommentKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  submitFootComment()
}

/** 底部评论条：图片 / 更多 */
function onFootCommentImage() {
  message.info('评论暂不支持图片')
}

function onFootCommentMore(e: { key?: string | number }) {
  const key = String(e?.key ?? '')
  if (key === 'send') submitFootComment()
  else if (key === 'clear') footCommentDraft.value = ''
}

/** 写入评论：comments 存在 DocMeta 里，复用文档内容的防抖保存 */
function updateComments(next: DocComment[]) {
  const doc = activeDoc.value
  if (!doc || doc.type !== 'doc') return
  const meta: DocMeta = { ...docMeta.value }
  if (next.length) meta.comments = next
  else delete meta.comments
  doc.data = meta
  onDocChanged(doc)
}

// ---- 行内评论输入卡片（出现在被评论的那一行右侧，参考飞书） ----
/** 在 block 所在行旁边打开评论输入卡片；评论栏收起时先展开 */
function openLineComposer(block: HTMLElement, quote: string) {
  const editor = editorRef.value
  if (!editor || !block) return
  commentPanelOpen.value = true
  lineComposerQuote.value = quote.trim()
  lineComposerDraft.value = ''
  lineComposerOpen.value = true
  hideBubble()
  window.getSelection()?.removeAllRanges()

  const place = () => {
    const rail = commentRailRef.value
    if (!rail) return
    const railRect = rail.getBoundingClientRect()
    const blockRect = block.getBoundingClientRect()
    const cardHeight = lineComposerRef.value?.offsetHeight || 170
    // top 相对评论栏内容顶部，评论栏与正文一起滚动，卡片会跟着这一行走
    const maxTop = Math.max(8, rail.offsetHeight - cardHeight - 12)
    lineComposerTop.value = Math.max(8, Math.min(blockRect.top - railRect.top - 6, maxTop))
  }
  nextTick(() => {
    place()
    lineComposerInputRef.value?.focus()
    // 评论栏从收起展开有 200ms 宽度过渡，正文会重新换行，过渡结束后再校正位置
    window.setTimeout(place, 240)
  })
}

function closeLineComposer() {
  lineComposerOpen.value = false
  lineComposerDraft.value = ''
}

function submitLineComment() {
  const content = lineComposerDraft.value.trim()
  if (!content) return
  const comment: DocComment = {
    id: newCommentId(),
    author: commentAuthorName.value,
    content,
    createdAt: Date.now(),
    scope: 'line',
    replies: [],
  }
  const quote = lineComposerQuote.value.trim()
  if (quote) comment.quote = quote
  updateComments([...comments.value, comment])
  activeCommentId.value = comment.id
  closeLineComposer()
  nextTick(scheduleCommentHighlights)
}

/** 行内评论输入框：Enter 发布，Shift + Enter 换行，Esc 关闭 */
function onLineComposerKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'Escape') {
    e.preventDefault()
    closeLineComposer()
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submitLineComment()
  }
}

function startReply(c: DocComment) {
  activeCommentId.value = c.id
  activeReplyId.value = c.id
  replyDraft.value = ''
}

function cancelReply() {
  activeReplyId.value = ''
  replyDraft.value = ''
}

function submitReply(c: DocComment) {
  const content = replyDraft.value.trim()
  if (!content) return
  const reply = { id: newCommentId(), author: commentAuthorName.value, content, createdAt: Date.now() }
  updateComments(comments.value.map((it) => (it.id === c.id ? { ...it, replies: [...(it.replies || []), reply] } : it)))
  cancelReply()
}

function toggleCommentResolved(c: DocComment) {
  updateComments(comments.value.map((it) => (it.id === c.id ? { ...it, resolved: !it.resolved } : it)))
  nextTick(scheduleCommentHighlights)
}

function removeComment(c: DocComment) {
  Modal.confirm({
    title: '删除评论',
    content: '删除后无法恢复，确定删除这条评论吗？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      updateComments(comments.value.filter((it) => it.id !== c.id))
      if (activeCommentId.value === c.id) activeCommentId.value = ''
      nextTick(scheduleCommentHighlights)
    },
  })
}

/** 点击评论卡片：滚动到被引用的正文并短暂高亮 */
function focusComment(c: DocComment) {
  activeCommentId.value = c.id
  if (c.quote) {
    const range = findCommentRange(c.quote)
    const node = range?.startContainer
    const el = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  window.setTimeout(() => {
    if (activeCommentId.value === c.id) activeCommentId.value = ''
  }, 2200)
}

/**
 * 在正文里按引用文字找 Range。
 * 跳过代码块注入的语言栏 / 彩色层，避免把展示文字算进正文。
 */
function findCommentRange(rawQuote: string): Range | null {
  const editor = editorRef.value
  const quote = rawQuote.trim()
  if (!editor || !quote) return null
  const segs: { node: Text; start: number }[] = []
  let full = ''
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child as Text
        segs.push({ node: text, start: full.length })
        full += text.data
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        if (el.matches('.docs-code-head, .docs-code-highlight')) return
        if (/^(P|DIV|LI|H[1-6]|BLOCKQUOTE|PRE|TR|TD|TH)$/.test(el.tagName)) full += '\n'
        walk(el)
      }
    })
  }
  walk(editor)
  const index = full.indexOf(quote)
  if (index < 0) return null
  const locate = (offset: number, isEnd: boolean): [Text, number] | null => {
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]
      const segEnd = seg.start + seg.node.data.length
      if (isEnd) {
        if (offset > seg.start && offset <= segEnd) return [seg.node, offset - seg.start]
      } else {
        if (offset >= seg.start && offset < segEnd) return [seg.node, offset - seg.start]
        if (offset === segEnd && i === segs.length - 1) return [seg.node, seg.node.data.length]
      }
    }
    return null
  }
  const start = locate(index, false)
  const end = locate(index + quote.length, true)
  if (!start || !end) return null
  const range = document.createRange()
  range.setStart(start[0], start[1])
  range.setEnd(end[0], end[1])
  return range
}

let commentHlFrame = 0
let commentHlTimer: number | undefined
/** 输入 / 列表变化 / 宽度变化后重新计算评论高亮（短暂合并，避免每个按键都遍历全文） */
function scheduleCommentHighlights() {
  window.clearTimeout(commentHlTimer)
  commentHlTimer = window.setTimeout(() => {
    cancelAnimationFrame(commentHlFrame)
    commentHlFrame = requestAnimationFrame(renderCommentHighlights)
  }, 80)
}

function renderCommentHighlights() {
  const editor = editorRef.value
  const wrap = editor?.closest('.docs-editor-wrap') as HTMLElement | null
  if (!editor || !wrap || activeDoc.value?.type !== 'doc') {
    if (commentHighlights.value.length) commentHighlights.value = []
    return
  }
  const wrapRect = wrap.getBoundingClientRect()
  const next: typeof commentHighlights.value = []
  for (const c of comments.value) {
    if (c.resolved || !c.quote) continue
    const range = findCommentRange(c.quote)
    if (!range) continue
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width < 1 || rect.height < 1) continue
      next.push({
        id: c.id,
        top: rect.top - wrapRect.top,
        left: rect.left - wrapRect.left,
        width: rect.width,
        height: rect.height,
      })
    }
  }
  commentHighlights.value = next
}

// 评论变化 / 文档切换 / 评论栏展开收起后重新定位高亮
watch(comments, () => nextTick(scheduleCommentHighlights), { deep: true })
watch([activeDoc, commentPanelOpen], () => nextTick(scheduleCommentHighlights))
// 切换文档时清空未发布的评论 / 回复
watch(
  () => activeDoc.value?.id,
  () => {
    footCommentDraft.value = ''
    replyDraft.value = ''
    activeReplyId.value = ''
    activeCommentId.value = ''
    closeLineComposer()
    nextTick(scheduleCommentHighlights)
  },
)
// 收起评论栏时一并收起行内输入卡片
watch(commentPanelOpen, (open) => {
  if (!open) closeLineComposer()
})

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
              <DocTypeIcon type="folder" mono />
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
            <DocTypeIcon type="folder" mono />
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
        <!-- 文档页：封面 + 正文 + 目录 + 评论共用一个滚动容器，滚动条从封面顶部开始 -->
        <div class="docs-scroll" :class="{ 'is-scroll-page': activeDoc.type === 'doc' }">
        <!-- 封面：通栏展示在正文与目录上方；编辑模式下悬停出现「更换封面 / 移除封面」 -->
        <div
          v-if="activeDoc.type === 'doc' && docMeta.cover"
          class="docs-cover"
          :class="{ 'is-acting': coverEditOpen }"
          :style="docCoverStyle"
        >
          <div v-if="docsEditMode" class="docs-cover-actions">
            <a-popover v-model:open="coverEditOpen" trigger="click" placement="bottomRight">
              <template #content>
                <DocCoverPicker :value="docMeta.cover" @select="setDocCover" />
              </template>
              <button type="button" class="docs-cover-btn">更换封面</button>
            </a-popover>
            <button type="button" class="docs-cover-btn" @click="setDocCover('')">移除封面</button>
          </div>
        </div>
        <!-- 正文 + 左侧大纲 -->
        <div class="docs-body">
          <!-- 文档大纲：一直展示，可折叠 / 展开 -->
          <aside
            v-if="!focusMode && activeDoc.type === 'doc'"
            class="docs-outline"
            :class="{ 'is-collapsed': outlineCollapsed }"
          >
            <button
              type="button"
              class="docs-outline-toggle"
              :title="outlineCollapsed ? '展开目录' : '收起目录'"
              @click="toggleOutline"
            >
              <Transition name="docs-outline-icon" mode="out-in">
                <MenuOutlined v-if="outlineCollapsed" key="collapsed" />
                <DoubleLeftOutlined v-else key="expanded" />
              </Transition>
            </button>
            <Transition name="docs-outline-fade">
              <div v-if="!outlineCollapsed" class="docs-outline-content">
                <button type="button" class="docs-outline-root" @click="scrollToTop">
                  {{ activeDoc.title || '无标题文档' }}
                </button>
                <button
                  v-for="o in outline"
                  :key="o.id"
                  type="button"
                  class="docs-outline-item"
                  :class="{ 'is-h3': o.level === 3 }"
                  @click="scrollToHeading(o.id)"
                >{{ o.text }}</button>
              </div>
            </Transition>
          </aside>

          <!-- 正文 + 评论共用一个滚动容器：滚动条在最右侧，两边一起滚 -->
          <div
            class="docs-doc-scroll"
            :class="{ 'is-scrollable': activeDoc.type === 'doc', 'is-comments-collapsed': !commentPanelOpen }"
            @transitionend="scheduleCommentHighlights"
          >
          <div class="docs-canvas">
            <div
              class="docs-canvas-inner"
              :class="{ 'is-wide': activeDoc.type !== 'doc', 'is-sheet': activeDoc.type === 'sheet', 'is-full': wideMode }"
            >
              <!-- 内容区大标题仅文档显示；表格/思维导图/流程图的文件名在顶栏左上角（可编辑） -->
              <div
                v-if="activeDoc.type === 'doc'"
                class="docs-title-zone"
                :class="{ 'is-acting': iconAddOpen || coverAddOpen }"
              >
                <!-- 标题上方：添加图标 / 添加封面（悬停标题区域时出现，已添加的不再显示） -->
                <div v-if="docsEditMode && (!docMeta.icon || !docMeta.cover)" class="docs-title-actions">
                  <a-popover v-if="!docMeta.icon" v-model:open="iconAddOpen" trigger="click" placement="bottomLeft">
                    <template #content>
                      <DocEmojiPicker @select="setDocIcon" />
                    </template>
                    <button type="button" class="docs-title-action"><SmileOutlined /><span>添加图标</span></button>
                  </a-popover>
                  <a-popover v-if="!docMeta.cover" v-model:open="coverAddOpen" trigger="click" placement="bottomLeft">
                    <template #content>
                      <DocCoverPicker @select="setDocCover" />
                    </template>
                    <button type="button" class="docs-title-action"><PictureOutlined /><span>添加封面</span></button>
                  </a-popover>
                </div>
                <!-- 图标与标题同一行：图标在标题前面；编辑模式下点击图标更换 / 移除 -->
                <div class="docs-title-row">
                  <template v-if="docMeta.icon">
                    <a-popover v-if="docsEditMode" v-model:open="iconEditOpen" trigger="click" placement="bottomLeft">
                      <template #content>
                        <DocEmojiPicker removable @select="setDocIcon" @remove="setDocIcon('')" />
                      </template>
                      <button type="button" class="docs-title-icon" title="更换图标">{{ docMeta.icon }}</button>
                    </a-popover>
                    <span v-else class="docs-title-icon is-static">{{ docMeta.icon }}</span>
                  </template>
                  <!-- 多行文本框：标题过长时自动换行、高度随内容增长；回车不换行，跳到正文 -->
                  <textarea
                    ref="titleInputRef"
                    :value="docTitleInputValue(activeDoc.title)"
                    class="docs-title-input"
                    placeholder="请输入标题"
                    maxlength="120"
                    rows="1"
                    :readonly="!docsEditMode"
                    @input="onTitleInput($event, activeDoc)"
                    @keydown.enter.prevent="editorRef?.focus()"
                  ></textarea>
                </div>
              </div>

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
                  @mousedown="onEditorMouseDown"
                  @keydown="onEditorKeyDown"
                  @paste="onEditorPaste"
                  @compositionstart="onEditorCompositionStart"
                  @compositionend="onEditorCompositionEnd"
                ></div>
                <!-- 评论引用高亮：覆盖在被评论的文字上（只读，不参与命中） -->
                <div class="docs-comment-hl-layer" aria-hidden="true">
                  <span
                    v-for="(r, i) in commentHighlights"
                    :key="`${r.id}-${i}`"
                    class="docs-comment-hl"
                    :class="{ 'is-active': activeCommentId === r.id }"
                    :style="{ top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` }"
                  />
                </div>
                <!-- 行右侧的评论入口：悬停有内容的行时出现；
                     外层命中区从正文边缘一直盖到图标，鼠标移向图标时不会离开编辑区而闪掉 -->
                <div
                  v-show="plusVisible && hoverBlockHasContent"
                  class="docs-line-comment-hit"
                  :style="{ top: plusTop - 2 + 'px' }"
                >
                  <a-tooltip title="评论" placement="bottom">
                    <button
                      type="button"
                      class="docs-line-comment"
                      @mousedown.prevent
                      @click="commentHoveredBlock"
                    >
                      <MessageOutlined />
                    </button>
                  </a-tooltip>
                </div>
                <!-- 标题折叠三角（预览模式同样可用） -->
                <button
                  v-show="plusVisible && hoverFoldable"
                  type="button"
                  class="docs-fold-caret"
                  :class="{ 'is-folded': hoverFolded }"
                  :style="{ top: plusTop + 'px' }"
                  :title="hoverFolded ? '展开' : '折叠'"
                  @mousedown.prevent
                  @click="toggleHeadingFold"
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3h8L5 8z" fill="currentColor" /></svg>
                </button>
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
                    :class="{ 'is-open': plusMenuOpen, 'is-block': plusMode === 'block', 'is-heading': hoverIsHeading }"
                    :style="{ top: plusTop + 'px' }"
                    :title="plusMode === 'block' ? '块操作' : '插入'"
                  >
                    <template v-if="plusMode === 'block'">
                      <span class="docs-block-plus-label">
                        <template v-if="hoverIsHeading">H<sub>{{ hoverBlockType.slice(1) }}</sub></template>
                        <template v-else>{{ hoverBlockLabel }}</template>
                      </span>
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
                <!-- 代码块语言切换菜单：点击代码块语言栏弹出 -->
                <div
                  v-if="codeLangMenu.open"
                  ref="codeLangMenuRef"
                  class="docs-code-lang-menu"
                  :style="{ top: codeLangMenu.top + 'px', left: codeLangMenu.left + 'px' }"
                  @mousedown.stop
                  @click.stop
                >
                  <button
                    v-for="opt in CODE_LANG_OPTIONS"
                    :key="opt.key"
                    type="button"
                    class="docs-code-lang-option"
                    :class="{ 'is-active': codeLangMenu.lang === opt.key }"
                    @click="pickCodeLang(opt.key)"
                  >
                    <span>{{ opt.label }}</span>
                    <CheckOutlined v-if="codeLangMenu.lang === opt.key" class="docs-code-lang-check" />
                  </button>
                </div>
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

              <!-- 文档底部：点赞 + 评论 -->
              <div v-if="activeDoc.type === 'doc'" class="docs-doc-foot">
                <!-- 点赞：大圆按钮 + 文案 -->
                <div class="docs-doc-like" :class="{ 'is-liked': docLiked }">
                  <button
                    type="button"
                    class="docs-doc-like-btn"
                    :title="docLiked ? '取消点赞' : '点赞'"
                    @click="toggleDocLike"
                  >
                    <LikeFilled v-if="docLiked" />
                    <LikeOutlined v-else />
                  </button>
                  <div class="docs-doc-like-slogan"><span>真诚点赞，手留余香</span></div>
                  <div v-if="docLikeCount" class="docs-doc-like-count">{{ docLikeCount }} 人点赞</div>
                </div>

                <!-- 全文评论（没有引用正文的评论才展示在这里） -->
                <section v-if="docComments.length" class="docs-doc-comments">
                  <div
                    v-for="c in docComments"
                    :key="c.id"
                    class="docs-doc-comment"
                    :class="{ 'is-resolved': c.resolved, 'is-active': activeCommentId === c.id }"
                    @click="focusComment(c)"
                  >
                    <span class="docs-comment-avatar" :style="{ background: commentAvatarColor(c.author) }">
                      {{ (c.author || '匿').slice(0, 1).toUpperCase() }}
                    </span>
                    <div class="docs-doc-comment-main">
                      <div class="docs-comment-card-head">
                        <span class="docs-comment-author">{{ c.author || '匿名' }}</span>
                        <span v-if="c.resolved" class="docs-comment-resolved-tag">已解决</span>
                        <span class="docs-comment-time">{{ commentTimeText(c.createdAt) }}</span>
                      </div>
                      <button v-if="c.quote" type="button" class="docs-comment-quote" @click.stop="focusComment(c)">
                        “{{ c.quote }}”
                      </button>
                      <p class="docs-comment-body">{{ c.content }}</p>
                      <div v-for="r in (c.replies || [])" :key="r.id" class="docs-comment-reply">
                        <div class="docs-comment-reply-head">
                          <span class="docs-comment-reply-author">{{ r.author || '匿名' }}</span>
                          <span class="docs-comment-time">{{ commentTimeText(r.createdAt) }}</span>
                        </div>
                        <p class="docs-comment-reply-body">{{ r.content }}</p>
                      </div>
                      <div v-if="activeReplyId === c.id" class="docs-comment-reply-composer" @click.stop>
                        <textarea v-model="replyDraft" placeholder="回复…"></textarea>
                        <div class="docs-comment-reply-foot">
                          <button type="button" class="docs-comment-text-btn" @click="cancelReply">取消</button>
                          <button
                            type="button"
                            class="docs-comment-submit is-small"
                            :disabled="!replyDraft.trim()"
                            @click="submitReply(c)"
                          >回复</button>
                        </div>
                      </div>
                      <div class="docs-comment-actions" @click.stop>
                        <button type="button" @click="startReply(c)">回复</button>
                        <button type="button" @click="toggleCommentResolved(c)">
                          {{ c.resolved ? '重新打开' : '解决' }}
                        </button>
                        <button type="button" class="is-danger" @click="removeComment(c)">删除</button>
                      </div>
                    </div>
                  </div>

                </section>

                <!-- 底部评论输入条 -->
                <div class="docs-doc-comment-bar">
                  <input
                    v-model="footCommentDraft"
                    class="docs-doc-comment-input"
                    placeholder="输入评论"
                    @keydown.enter="onFootCommentKeydown"
                  />
                  <button type="button" class="docs-doc-comment-tool" title="图片" @click="onFootCommentImage">
                    <PictureOutlined />
                  </button>
                  <a-dropdown trigger="click" placement="topRight">
                    <button type="button" class="docs-doc-comment-tool" title="更多">
                      <MoreOutlined />
                    </button>
                    <template #overlay>
                      <a-menu @click="onFootCommentMore">
                        <a-menu-item key="send">发布评论</a-menu-item>
                        <a-menu-item key="clear">清空</a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>

                <!-- 有输入内容时展示取消 / 发送 -->
                <div v-if="footCommentDraft.trim()" class="docs-doc-comment-actions">
                  <button type="button" class="docs-doc-comment-cancel" @click="footCommentDraft = ''">取消</button>
                  <button type="button" class="docs-doc-comment-send" @click="submitFootComment">发送</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧评论栏（参考飞书）：评论列表 + 输入区；收起后只留一条窄栏 -->
          <aside
            v-if="activeDoc.type === 'doc'"
            ref="commentRailRef"
            class="docs-comment-rail"
            :class="{ 'is-collapsed': !commentPanelOpen }"
            @transitionend="scheduleCommentHighlights"
          >
            <div class="docs-comment-rail-head">
              <template v-if="commentPanelOpen">
                <span class="docs-comment-rail-title">
                  评论<span v-if="lineComments.length" class="docs-comment-count">{{ lineComments.length }}</span>
                </span>
                <button type="button" class="docs-comment-icon-btn" title="收起评论" @click="commentPanelOpen = false">
                  <RightOutlined />
                </button>
              </template>
              <button v-else type="button" class="docs-comment-icon-btn" title="展开评论" @click="commentPanelOpen = true">
                <CommentOutlined />
              </button>
            </div>

            <!-- 行内评论输入卡片：出现在被评论的那一行右侧 -->
            <div
              v-if="lineComposerOpen && commentPanelOpen"
              ref="lineComposerRef"
              class="docs-line-composer"
              :style="{ top: lineComposerTop + 'px' }"
              @mousedown.stop
              @click.stop
            >
              <div v-if="lineComposerQuote" class="docs-line-composer-quote">
                <span>“{{ lineComposerQuote }}”</span>
                <button type="button" title="关闭" @click="closeLineComposer"><CloseOutlined /></button>
              </div>
              <div class="docs-line-composer-author">
                <span class="docs-comment-avatar" :style="{ background: commentAvatarColor(commentAuthorName) }">
                  {{ commentAuthorName.slice(0, 1).toUpperCase() }}
                </span>
                <span class="docs-comment-author">{{ commentAuthorName }}</span>
              </div>
              <div class="docs-line-composer-input">
                <textarea
                  ref="lineComposerInputRef"
                  v-model="lineComposerDraft"
                  placeholder="输入评论"
                  rows="1"
                  @keydown="onLineComposerKeydown"
                ></textarea>
                <button
                  type="button"
                  class="docs-line-composer-send"
                  :disabled="!lineComposerDraft.trim()"
                  title="发布"
                  @click="submitLineComment"
                >
                  <SendOutlined />
                </button>
              </div>
            </div>

            <template v-if="commentPanelOpen">
              <div class="docs-comment-list">
                <div
                  v-for="c in lineComments"
                  :key="c.id"
                  class="docs-comment-card"
                  :class="{ 'is-resolved': c.resolved, 'is-active': activeCommentId === c.id }"
                  @click="focusComment(c)"
                >
                  <div class="docs-comment-card-head">
                    <span class="docs-comment-avatar" :style="{ background: commentAvatarColor(c.author) }">
                      {{ (c.author || '匿').slice(0, 1).toUpperCase() }}
                    </span>
                    <span class="docs-comment-author">{{ c.author || '匿名' }}</span>
                    <span v-if="c.resolved" class="docs-comment-resolved-tag">已解决</span>
                    <span class="docs-comment-time">{{ commentTimeText(c.createdAt) }}</span>
                  </div>
                  <button v-if="c.quote" type="button" class="docs-comment-quote" @click.stop="focusComment(c)">
                    “{{ c.quote }}”
                  </button>
                  <p class="docs-comment-body">{{ c.content }}</p>
                  <div v-for="r in (c.replies || [])" :key="r.id" class="docs-comment-reply">
                    <div class="docs-comment-reply-head">
                      <span class="docs-comment-reply-author">{{ r.author || '匿名' }}</span>
                      <span class="docs-comment-time">{{ commentTimeText(r.createdAt) }}</span>
                    </div>
                    <p class="docs-comment-reply-body">{{ r.content }}</p>
                  </div>
                  <div v-if="activeReplyId === c.id" class="docs-comment-reply-composer" @click.stop>
                    <textarea v-model="replyDraft" placeholder="回复…"></textarea>
                    <div class="docs-comment-reply-foot">
                      <button type="button" class="docs-comment-text-btn" @click="cancelReply">取消</button>
                      <button
                        type="button"
                        class="docs-comment-submit is-small"
                        :disabled="!replyDraft.trim()"
                        @click="submitReply(c)"
                      >回复</button>
                    </div>
                  </div>
                  <div class="docs-comment-actions" @click.stop>
                    <button type="button" @click="startReply(c)">回复</button>
                    <button type="button" @click="toggleCommentResolved(c)">{{ c.resolved ? '重新打开' : '解决' }}</button>
                    <button type="button" class="is-danger" @click="removeComment(c)">删除</button>
                  </div>
                </div>
              </div>
            </template>
          </aside>
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
      <div v-else-if="navMode === 'library'" class="docs-home docs-home-main">
        <!-- 快捷入口：新建 / 模板库 / 新建知识库 -->
        <div class="docs-quick-cards">
          <a-dropdown
            v-model:open="addOpen"
            :trigger="['hover', 'click']"
            placement="bottomLeft"
            overlay-class-name="docs-add-popover"
          >
            <button type="button" class="docs-quick-card" :class="{ 'is-open': addOpen }">
              <span class="docs-quick-icon is-new"><PlusOutlined /></span>
              <span class="docs-quick-text"><b>新建</b><small>新建文档开始协作</small></span>
              <DownOutlined class="docs-quick-caret" />
            </button>
            <template #overlay>
              <div class="docs-add-panel" @mousedown.stop>
                <button
                  v-for="it in ADD_TYPE_ITEMS"
                  :key="it.key"
                  type="button"
                  class="docs-add-item"
                  @click="onAddItem(it.key)"
                >
                  <DocTypeIcon :type="it.key" size="md" />
                  <span>{{ it.label }}</span>
                </button>
                <div class="docs-add-divider" />
                <button type="button" class="docs-add-item" @click="onAddItem('folder')">
                  <DocTypeIcon type="folder" size="md" />
                  <span>文件夹</span>
                </button>
                <div class="docs-add-divider" />
                <div class="docs-add-section">文档应用</div>
                <button
                  v-for="it in ADD_APP_ITEMS"
                  :key="it.key"
                  type="button"
                  class="docs-add-item"
                  @click="onAddItem(it.key)"
                >
                  <DocTypeIcon :type="it.key" size="md" />
                  <span>{{ it.label }}</span>
                </button>
              </div>
            </template>
          </a-dropdown>

          <a-dropdown
            v-model:open="templateOpen"
            :trigger="['hover', 'click']"
            placement="bottomLeft"
            overlay-class-name="docs-add-popover"
          >
            <button type="button" class="docs-quick-card" :class="{ 'is-open': templateOpen }">
              <span class="docs-quick-icon is-template"><AppstoreOutlined /></span>
              <span class="docs-quick-text"><b>模板库</b><small>选择模板快速新建</small></span>
              <DownOutlined class="docs-quick-caret" />
            </button>
            <template #overlay>
              <div class="docs-add-panel" @mousedown.stop>
                <button
                  v-for="it in TEMPLATE_ITEMS"
                  :key="it.key"
                  type="button"
                  class="docs-add-item"
                  @click="onTemplateItem(it.key)"
                >
                  <span class="docs-add-icon" :class="`is-${it.key}`">
                    <component :is="it.icon" />
                  </span>
                  <span>{{ it.label }}</span>
                </button>
              </div>
            </template>
          </a-dropdown>

          <button type="button" class="docs-quick-card" @click="openCreateLibrary">
            <span class="docs-quick-icon is-newlib"><FolderFilled /></span>
            <span class="docs-quick-text"><b>新建知识库</b><small>让知识创造价值</small></span>
          </button>
        </div>

        <div class="docs-library-toolbar">
          <div class="docs-library-heading">
            <span>全部知识库</span>
            <ControlOutlined class="docs-library-filter" />
          </div>
          <a-input
            v-model:value="libraryKeyword"
            allow-clear
            placeholder="搜索知识库"
            class="docs-library-search"
          >
            <template #prefix><SearchOutlined class="docs-library-search-icon" /></template>
          </a-input>
        </div>

        <div class="docs-library-grid">
          <button
            v-for="f in libraryFolders"
            :key="f.id"
            type="button"
            class="docs-library-card"
            @click="openLibrary(f)"
          >
            <DocsLibraryCover class="docs-library-cover" :name="f.name" />
            <span class="docs-library-cover-title">{{ f.name }}</span>
            <span class="docs-library-cover-meta">{{ docsOfFolder(f) }} 篇文档</span>
          </button>
        </div>
        <div v-if="!folders.length" class="docs-home-empty">还没有知识库，点击上方卡片新建</div>
        <div v-else-if="!libraryFolders.length" class="docs-home-empty">没有匹配的知识库</div>
      </div>

      <!-- 文档列表首页 -->
      <div v-else class="docs-home docs-home-main">
        <!-- 快捷入口：新建 / 上传 / 模板库 -->
        <div class="docs-quick-cards">
          <a-dropdown
            v-model:open="addOpen"
            :trigger="['hover', 'click']"
            placement="bottomLeft"
            overlay-class-name="docs-add-popover"
          >
            <button type="button" class="docs-quick-card" :class="{ 'is-open': addOpen }">
              <span class="docs-quick-icon is-new"><PlusOutlined /></span>
              <span class="docs-quick-text"><b>新建</b><small>新建文档开始协作</small></span>
              <DownOutlined class="docs-quick-caret" />
            </button>
            <template #overlay>
              <div class="docs-add-panel" @mousedown.stop>
                <button
                  v-for="it in ADD_TYPE_ITEMS"
                  :key="it.key"
                  type="button"
                  class="docs-add-item"
                  @click="onAddItem(it.key)"
                >
                  <DocTypeIcon :type="it.key" size="md" />
                  <span>{{ it.label }}</span>
                </button>
                <div class="docs-add-divider" />
                <button type="button" class="docs-add-item" @click="onAddItem('folder')">
                  <DocTypeIcon type="folder" size="md" />
                  <span>文件夹</span>
                </button>
                <div class="docs-add-divider" />
                <div class="docs-add-section">文档应用</div>
                <button
                  v-for="it in ADD_APP_ITEMS"
                  :key="it.key"
                  type="button"
                  class="docs-add-item"
                  @click="onAddItem(it.key)"
                >
                  <DocTypeIcon :type="it.key" size="md" />
                  <span>{{ it.label }}</span>
                </button>
              </div>
            </template>
          </a-dropdown>

          <a-dropdown
            v-model:open="uploadOpen"
            :trigger="['hover', 'click']"
            placement="bottomLeft"
            overlay-class-name="docs-add-popover"
          >
            <button type="button" class="docs-quick-card" :class="{ 'is-open': uploadOpen }">
              <span class="docs-quick-icon is-upload"><UploadOutlined /></span>
              <span class="docs-quick-text"><b>上传</b><small>上传本地文件</small></span>
              <DownOutlined class="docs-quick-caret" />
            </button>
            <template #overlay>
              <div class="docs-add-panel" @mousedown.stop>
                <button
                  v-for="it in UPLOAD_ITEMS"
                  :key="it.key"
                  type="button"
                  class="docs-add-item"
                  @click="onUploadItem(it.key)"
                >
                  <span class="docs-add-icon" :class="`is-${it.key}`">
                    <component :is="it.icon" />
                  </span>
                  <span>{{ it.label }}</span>
                </button>
              </div>
            </template>
          </a-dropdown>

          <a-dropdown
            v-model:open="templateOpen"
            :trigger="['hover', 'click']"
            placement="bottomLeft"
            overlay-class-name="docs-add-popover"
          >
            <button type="button" class="docs-quick-card" :class="{ 'is-open': templateOpen }">
              <span class="docs-quick-icon is-template"><AppstoreOutlined /></span>
              <span class="docs-quick-text"><b>模板库</b><small>选择模板快速新建</small></span>
              <DownOutlined class="docs-quick-caret" />
            </button>
            <template #overlay>
              <div class="docs-add-panel" @mousedown.stop>
                <button
                  v-for="it in TEMPLATE_ITEMS"
                  :key="it.key"
                  type="button"
                  class="docs-add-item"
                  @click="onTemplateItem(it.key)"
                >
                  <span class="docs-add-icon" :class="`is-${it.key}`">
                    <component :is="it.icon" />
                  </span>
                  <span>{{ it.label }}</span>
                </button>
              </div>
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

    <!-- 新建知识库：选择知识库模板（参考飞书） -->
    <a-modal
      v-model:open="libraryTemplateOpen"
      :width="760"
      :footer="null"
      :closable="false"
      centered
      destroy-on-close
      class="docs-lib-tpl-modal"
      :body-style="{ padding: '0' }"
    >
      <div class="lib-tpl">
        <header class="lib-tpl-head">
          <h3>选择知识库模板</h3>
          <div class="lib-tpl-head-actions">
            <button type="button" class="lib-tpl-feedback" @click="onLibraryFeedback">我要反馈</button>
            <button type="button" class="lib-tpl-close" @click="libraryTemplateOpen = false"><CloseOutlined /></button>
          </div>
        </header>

        <div class="lib-tpl-body">
          <div class="lib-tpl-scroll">
            <section class="lib-tpl-section">
              <h4>推荐</h4>
              <div class="lib-tpl-grid">
                <button
                  type="button"
                  class="lib-tpl-card is-blank"
                  :class="{ active: selectedLibraryTemplate === 'blank' }"
                  @click="selectedLibraryTemplate = 'blank'"
                >
                  <PlusOutlined class="lib-tpl-plus" />
                  <span>空白知识库</span>
                </button>
              </div>
            </section>
          </div>

          <aside class="lib-tpl-preview">
            <h4>模板结构预览</h4>
            <p class="lib-tpl-preview-empty">当前仅支持空白知识库模板</p>
          </aside>
        </div>

        <footer class="lib-tpl-foot">
          <a-button @click="libraryTemplateOpen = false">取消</a-button>
          <a-button type="primary" :disabled="!selectedLibraryTemplate" @click="confirmLibraryTemplate">下一步</a-button>
        </footer>
      </div>
    </a-modal>

    <!-- 新建知识库：完善知识库信息 -->
    <a-modal
      v-model:open="libraryInfoOpen"
      :width="620"
      :footer="null"
      :closable="false"
      centered
      destroy-on-close
      class="docs-lib-info-modal"
      :body-style="{ padding: '0' }"
    >
      <div class="lib-info">
        <header class="lib-info-head">
          <button type="button" class="lib-info-back" title="返回" @click="backToLibraryTemplate">
            <LeftOutlined />
          </button>
          <h3>完善知识库信息</h3>
        </header>

        <div class="lib-info-body">
          <div class="lib-info-field">
            <label>名称<span class="lib-info-required">*</span></label>
            <a-input
              v-model:value="libraryInfoForm.name"
              size="large"
              placeholder="请输入名称"
              :maxlength="30"
              @press-enter="submitLibraryInfo"
            >
              <template #prefix><SmileOutlined class="lib-info-prefix" /></template>
            </a-input>
          </div>

          <div class="lib-info-field">
            <label>简介</label>
            <a-input
              v-model:value="libraryInfoForm.desc"
              size="large"
              placeholder="请输入简介"
              :maxlength="100"
            />
          </div>

          <div class="lib-info-field">
            <label>可见范围<span class="lib-info-required">*</span></label>
            <div class="lib-info-visibility">
              <a-radio-group v-model:value="libraryInfoForm.visibility" class="lib-info-radios">
                <a-radio value="members">仅当前知识库成员可见</a-radio>
                <a-radio value="all">所有人公开可见</a-radio>
              </a-radio-group>
            </div>
          </div>
        </div>

        <footer class="lib-info-foot">
          <a-button @click="libraryInfoOpen = false">取消</a-button>
          <a-button
            type="primary"
            :disabled="!libraryInfoForm.name.trim()"
            :loading="libraryInfoSubmitting"
            @click="submitLibraryInfo"
          >
            创建
          </a-button>
        </footer>
      </div>
    </a-modal>

    <!-- 新建文档：选择模板（参考飞书） -->
    <a-modal
      v-model:open="docTemplateOpen"
      :width="1080"
      :footer="null"
      :closable="false"
      centered
      destroy-on-close
      class="docs-doc-tpl-modal"
      :body-style="{ padding: '0' }"
    >
      <div class="doc-tpl">
        <header class="doc-tpl-head">
          <div class="doc-tpl-target">
            <span class="doc-tpl-target-label">新建到</span>
            <span class="doc-tpl-target-folder">
              <DocTypeIcon type="folder" mono />
              <span>{{ docTemplateTargetName }}</span>
            </span>
          </div>
          <a-input
            v-model:value="docTemplateKeyword"
            allow-clear
            placeholder="搜索模板"
            class="doc-tpl-search"
          >
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <div class="doc-tpl-head-right">
            <span class="doc-tpl-type"><ControlOutlined />{{ DOC_TYPE_LABELS[docTemplateType] || '文档' }}</span>
            <span class="doc-tpl-divider" />
            <button type="button" class="lib-tpl-close" @click="docTemplateOpen = false"><CloseOutlined /></button>
          </div>
        </header>

        <div class="doc-tpl-body">
          <nav class="doc-tpl-nav">
            <button
              v-for="c in DOC_TEMPLATE_CATEGORIES"
              :key="c.key"
              type="button"
              class="doc-tpl-nav-item"
              :class="{ active: docTemplateCategory === c.key }"
              @click="docTemplateCategory = c.key"
            >
              {{ c.label }}
            </button>
          </nav>

          <section class="doc-tpl-content">
            <h4>{{ docTemplateCategory === 'recommend' ? '为你推荐' : (DOC_TEMPLATE_CATEGORIES.find((c) => c.key === docTemplateCategory)?.label || '模板') }}</h4>
            <div
              v-if="docTemplateCategory === 'recommend' && !docTemplateKeyword.trim()"
              class="doc-tpl-grid"
            >
              <button type="button" class="doc-tpl-blank" @click="createBlankDocFromTemplate">
                <PlusOutlined class="doc-tpl-plus" />
                <span>{{ DOC_BLANK_LABELS[docTemplateType] || '新建空白文档' }}</span>
              </button>
            </div>
            <div v-else class="doc-tpl-empty">暂无模板</div>
          </section>
        </div>
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
      <a-tooltip title="评论" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('comment')">
          <CommentOutlined />
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
  /* 左侧菜单的顶部留白：目录折叠箭头据此与「主页 / 知识库」两行的中线对齐 */
  --docs-side-pt: 20px;
  /* 正文右侧的评论栏宽度：随窗口增大，保证评论卡片和输入区有足够空间 */
  --docs-comment-rail: clamp(200px, 16vw, 320px);
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
  flex: 0 0 327px;
  /* flex 子项默认 min-width:auto，会被内部最长的不换行标题撑宽；置 0 后宽度固定，长标题走省略号 */
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: var(--docs-side-pt) 12px 14px;
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
  font-size: 16px;
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
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--docs-text);
}
.docs-side-sub {
  margin-top: 1px;
  font-size: 11px;
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
  font-size: 11px;
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
  font-size: 13px;
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
  font-size: 14px;
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
/* 全部知识库：标题 + 筛选 + 搜索 */
.docs-library-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 28px;
}
.docs-library-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-library-filter {
  font-size: 15px;
  color: var(--docs-text-3);
  cursor: pointer;
}
.docs-library-search {
  width: 260px;
}
.docs-library-search-icon {
  color: var(--docs-text-3);
}

/* 知识库封面卡片 */
.docs-library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 168px));
  justify-content: start;
  gap: 14px;
  margin-top: 16px;
}
.docs-library-card {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  /* 参考飞书知识库卡片比例（约 2:3），避免过于细长 */
  aspect-ratio: 2 / 3;
  overflow: hidden;
  text-align: left;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}
.docs-library-card:hover {
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
  transform: translateY(-2px);
}
/* 插画铺满卡片；顶部 / 底部加一层淡白渐变，保证标题和文档数可读 */
.docs-library-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.docs-library-card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.52) 0%,
    rgba(255, 255, 255, 0) 36%,
    rgba(255, 255, 255, 0) 76%,
    rgba(255, 255, 255, 0.38) 100%
  );
}
.docs-library-cover-title {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 1;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  color: #1d1d1f;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-library-cover-meta {
  position: absolute;
  bottom: 10px;
  left: 12px;
  z-index: 1;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
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
  font-size: 15px;
  color: var(--docs-text);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-nav-item :deep(.anticon) {
  font-size: 16px;
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
  font-size: 15px;
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
  font-size: 13px;
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
  font-size: 10px;
  color: var(--docs-text-3);
  transition: transform 0.15s;
}
.docs-folder-caret.open {
  transform: rotate(90deg);
}
.docs-folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
  color: var(--docs-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-folder-count {
  flex: none;
  padding: 0;
  font-size: 13px;
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
  font-size: 12px;
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
  font-size: 13px;
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
  font-size: 15px;
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
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-item-more {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 12px;
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
  font-size: 13px;
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
/* 文档页整体滚动容器：封面在滚动区域内，滚动条从封面顶部开始 */
.docs-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.docs-scroll.is-scroll-page {
  overflow-y: auto;
}
/* 文档页：正文区高度随内容增长（不压缩），目录吸顶，评论列和正文一起滚动 */
.docs-scroll.is-scroll-page .docs-body {
  flex: 1 0 auto;
}
.docs-scroll.is-scroll-page .docs-outline {
  position: sticky;
  top: 0;
  align-self: flex-start;
  max-height: calc(100vh - var(--app-header-height, 56px));
}
/* 正文 + 右侧大纲 */
.docs-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.docs-outline {
  flex: 0 0 275px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  /*
   * 顶部留白让折叠箭头（高 28px）的中心落在左侧菜单「主页」与「知识库」两行的中线上：
   * 中线 = 菜单顶部留白 + 标题区 38 + 间距 12 + 搜索框 36 + 间距 12 + 主页行 34 + 行距的一半 1；
   * 再减去顶栏高度（--docs-header-h）和箭头半高 14
   */
  padding: calc(var(--docs-side-pt) + 119px - var(--docs-header-h, 56px)) 14px 20px;
  background: var(--docs-canvas);
  /* 宽度变化时与正文区平滑过渡 */
  transition: flex-basis 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}
/* 折叠态：宽度缩小三分之一 */
.docs-outline.is-collapsed {
  flex-basis: 167px;
}
.docs-outline-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

/* 目录内容：折叠时淡出并轻微左移，展开时淡入 */
.docs-outline-fade-enter-active,
.docs-outline-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.docs-outline-fade-enter-from,
.docs-outline-fade-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* 折叠 / 展开图标切换：淡入缩放 */
.docs-outline-icon-enter-active,
.docs-outline-icon-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.docs-outline-icon-enter-from,
.docs-outline-icon-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
/* 折叠 / 展开按钮 */
.docs-outline-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-bottom: 10px;
  padding: 0;
  font-size: 15px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-outline-toggle:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
/* 目录第一项：文档标题（高亮） */
.docs-outline-root {
  display: block;
  width: 100%;
  margin-bottom: 4px;
  padding: 4px 8px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  color: var(--c-primary);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  border: none;
  cursor: pointer;
}
.docs-outline-root:hover {
  background: var(--docs-hover);
  border-radius: 4px;
}
.docs-outline-item {
  display: block;
  width: 100%;
  padding: 4px 8px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--docs-text);
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
  font-size: 13px;
  font-weight: 500;
  color: var(--docs-text-2);
}

/* 正文画布 */
/* 正文 + 评论的共用滚动容器：文档页用 grid，正文和评论一起滚动、滚动条在最右侧；其他类型保持原布局 */
.docs-doc-scroll {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
}
.docs-doc-scroll.is-scrollable {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--docs-comment-rail);
  align-items: stretch;
  overflow-y: auto;
  transition: grid-template-columns 0.2s var(--docs-ease);
}
.docs-doc-scroll.is-scrollable.is-comments-collapsed {
  grid-template-columns: minmax(0, 1fr) 44px;
}
/* 文档页的滚动交给外层容器，画布本身不再单独滚动 */
.docs-doc-scroll.is-scrollable .docs-canvas {
  overflow: visible;
}
/* 文档页的滚动已交给外层 .docs-scroll，内层网格不再单独滚动 */
.docs-scroll.is-scroll-page .docs-doc-scroll.is-scrollable {
  overflow: visible;
}
.docs-canvas {
  flex: 1;
  /* 右侧有固定宽度的评论栏：允许正文列收缩，避免长内容把评论栏挤没 */
  min-width: 0;
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
  padding: 60px 24px 64px 72px;
  background: var(--docs-canvas);
}
/* 文档正文：右侧留出较大的边距，让正文离右侧评论栏更远，也给悬停的评论图标留位置 */
.docs-canvas-inner:not(.is-wide) {
  padding-right: 112px;
}
/* ---- 右侧评论栏（参考飞书云文档）：评论列表 + 输入区 ---- */
.docs-comment-rail {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--docs-canvas);
  border-left: 1px solid var(--docs-border);
  /* clip 不会创建滚动容器，底部输入框可以用 sticky 固定在视口底部 */
  overflow: clip;
}
/* 收起时列宽由外层 grid 控制（.is-comments-collapsed），这里只调整头部 */
.docs-comment-rail.is-collapsed {
  min-width: 0;
}
.docs-comment-rail-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 18px 12px 8px;
}
.docs-comment-rail.is-collapsed .docs-comment-rail-head {
  justify-content: center;
  padding: 18px 0 8px;
}
.docs-comment-rail-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-comment-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  color: var(--docs-text-3);
  text-align: center;
  background: var(--docs-hover);
  border-radius: 9px;
}
.docs-comment-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
}
.docs-comment-icon-btn:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
/* 评论列表不单独滚动：高度随内容撑开，和正文一起由外层容器滚动 */
.docs-comment-list {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 12px 12px;
}
.docs-comment-card {
  padding: 10px 12px;
  background: var(--docs-paper);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}
.docs-comment-card:hover {
  border-color: var(--docs-border-strong);
}
.docs-comment-card.is-active {
  border-color: color-mix(in srgb, var(--c-primary) 45%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 10%, transparent);
}
.docs-comment-card.is-resolved {
  opacity: 0.6;
}
.docs-comment-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.docs-comment-avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 11px;
  color: #fff;
  border-radius: 50%;
}
.docs-comment-author {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  color: var(--docs-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-comment-time {
  flex: none;
  margin-left: auto;
  font-size: 11px;
  color: var(--docs-text-3);
  white-space: nowrap;
}
.docs-comment-resolved-tag {
  flex: none;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  color: var(--docs-success);
  background: color-mix(in srgb, var(--docs-success) 10%, transparent);
  border-radius: 9px;
}
.docs-comment-quote {
  display: -webkit-box;
  width: 100%;
  margin: 8px 0 6px;
  padding: 5px 8px;
  overflow: hidden;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: var(--docs-text-2);
  text-align: left;
  cursor: pointer;
  background: rgba(255, 196, 0, 0.12);
  border: none;
  border-left: 2px solid #ffc60a;
  border-radius: 4px;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.docs-comment-quote:hover {
  background: rgba(255, 196, 0, 0.2);
}
.docs-comment-body,
.docs-comment-reply-body {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--docs-text);
  white-space: pre-wrap;
  word-break: break-word;
}
.docs-comment-reply {
  margin-top: 9px;
  padding-left: 8px;
  border-left: 2px solid var(--docs-border);
}
.docs-comment-reply-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.docs-comment-reply-author {
  font-size: 12px;
  font-weight: 600;
  color: var(--docs-text-2);
}
.docs-comment-reply-body {
  font-size: 12px;
  color: var(--docs-text-2);
}
.docs-comment-actions {
  display: flex;
  gap: 2px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}
.docs-comment-card:hover .docs-comment-actions,
.docs-comment-card.is-active .docs-comment-actions {
  opacity: 1;
}
.docs-comment-actions button {
  height: 22px;
  padding: 0 6px;
  font: inherit;
  font-size: 12px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.docs-comment-actions button:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.docs-comment-actions button.is-danger:hover {
  color: var(--docs-danger);
  background: color-mix(in srgb, var(--docs-danger) 8%, transparent);
}
.docs-comment-reply-composer {
  margin-top: 8px;
}
.docs-comment-reply-composer textarea {
  width: 100%;
  min-height: 54px;
  padding: 6px 8px;
  box-sizing: border-box;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: var(--docs-text);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-sm);
  outline: none;
  resize: vertical;
}
.docs-comment-reply-composer textarea:focus {
  border-color: color-mix(in srgb, var(--c-primary) 45%, transparent);
}
.docs-comment-reply-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.docs-comment-text-btn {
  height: 26px;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.docs-comment-text-btn:hover {
  background: var(--docs-hover);
}
.docs-comment-submit {
  height: 28px;
  padding: 0 14px;
  font: inherit;
  font-size: 13px;
  color: #fff;
  background: var(--c-primary);
  border: none;
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}
.docs-comment-submit:hover:not(:disabled) {
  background: var(--c-primary-active);
}
.docs-comment-submit:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.docs-comment-submit.is-small {
  height: 26px;
  padding: 0 12px;
  font-size: 12px;
}
/* 被评论文字的高亮（只读覆盖层，跟随正文滚动） */
.docs-comment-hl-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
.docs-comment-hl {
  position: absolute;
  border-radius: 3px;
  background: rgba(255, 196, 0, 0.16);
  box-shadow: inset 0 -2px 0 rgba(255, 168, 0, 0.45);
  transition: background-color 0.15s;
}
.docs-comment-hl.is-active {
  background: rgba(255, 176, 0, 0.34);
}
/* 行右侧的评论入口：外层命中区延伸到正文边缘，避免鼠标经过空白时悬停状态丢失 */
.docs-line-comment-hit {
  position: absolute;
  right: -40px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 42px;
  height: 28px;
}
.docs-line-comment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 18px;
  color: var(--docs-text-3);
  cursor: pointer;
  background: var(--docs-canvas);
  border: none;
  border-radius: var(--docs-radius-sm);
  transition: color 0.12s, background 0.12s;
}
.docs-line-comment:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
/* 行内评论输入卡片：出现在被评论的那一行右侧，随正文一起滚动 */
.docs-line-composer {
  position: absolute;
  right: 10px;
  left: 10px;
  z-index: 6;
  padding: 12px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-top: 3px solid #ffc60a;
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.docs-line-composer-quote {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
  padding-left: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--docs-text-2);
  border-left: 2px solid var(--docs-border-strong);
}
.docs-line-composer-quote span {
  display: -webkit-box;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.docs-line-composer-quote button {
  flex: none;
  padding: 0 2px;
  font-size: 12px;
  color: var(--docs-text-3);
  cursor: pointer;
  background: transparent;
  border: none;
}
.docs-line-composer-author {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.docs-line-composer-author .docs-comment-avatar {
  width: 28px;
  height: 28px;
  font-size: 12px;
}
.docs-line-composer-input {
  position: relative;
}
.docs-line-composer-input textarea {
  width: 100%;
  min-height: 38px;
  max-height: 120px;
  padding: 9px 38px 9px 10px;
  box-sizing: border-box;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--docs-text);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius);
  outline: none;
  resize: none;
}
.docs-line-composer-input textarea:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 12%, transparent);
}
.docs-line-composer-input textarea::placeholder {
  color: var(--docs-text-3);
}
.docs-line-composer-send {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 14px;
  color: var(--c-primary);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius-sm);
}
.docs-line-composer-send:hover:not(:disabled) {
  background: var(--docs-hover);
}
.docs-line-composer-send:disabled {
  color: var(--docs-text-3);
  cursor: not-allowed;
  opacity: 0.6;
}
/* ---- 文档底部：点赞 + 评论（参考飞书文档底部） ---- */
.docs-doc-foot {
  margin-top: 64px;
  padding-top: 40px;
  border-top: 1px solid var(--docs-border);
}
/* 点赞：大圆按钮 + 文案 */
.docs-doc-like {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 8px 0 4px;
}
.docs-doc-like-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  padding: 0;
  font-size: 30px;
  color: var(--c-primary);
  cursor: pointer;
  background: transparent;
  border: 1.5px solid color-mix(in srgb, var(--c-primary) 70%, #fff);
  border-radius: 50%;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}
.docs-doc-like-btn:hover {
  background: color-mix(in srgb, var(--c-primary) 6%, transparent);
  transform: translateY(-1px);
}
.docs-doc-like.is-liked .docs-doc-like-btn {
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border-color: var(--c-primary);
}
.docs-doc-like-slogan {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: var(--docs-text-3);
}
.docs-doc-like-slogan::before,
.docs-doc-like-slogan::after {
  content: '';
  width: 96px;
  height: 1px;
  background: var(--docs-border);
}
.docs-doc-like-count {
  margin-top: -4px;
  font-size: 12px;
  color: var(--docs-text-3);
}
/* 评论列表 */
.docs-doc-comments {
  margin-top: 28px;
}
.docs-doc-comment {
  display: flex;
  gap: 10px;
  padding: 14px 0;
  border-bottom: 1px solid var(--docs-border);
  cursor: pointer;
}
.docs-doc-comment:last-of-type {
  border-bottom: none;
}
.docs-doc-comment.is-resolved {
  opacity: 0.6;
}
.docs-doc-comment .docs-comment-avatar {
  width: 30px;
  height: 30px;
  font-size: 13px;
}
.docs-doc-comment-main {
  flex: 1;
  min-width: 0;
}
.docs-doc-comment:hover .docs-comment-actions,
.docs-doc-comment.is-active .docs-comment-actions {
  opacity: 1;
}
/* 底部评论输入条 */
.docs-doc-comment-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 48px;
  margin-top: 24px;
  padding: 0 10px 0 14px;
  box-sizing: border-box;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.docs-doc-comment-bar:focus-within {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 10%, transparent);
}
.docs-doc-comment-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  font: inherit;
  font-size: 14px;
  color: var(--docs-text);
  background: transparent;
  border: none;
  outline: none;
}
.docs-doc-comment-input::placeholder {
  color: var(--docs-text-3);
}
.docs-doc-comment-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 17px;
  color: var(--docs-text-2);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: color 0.12s, background 0.12s;
}
.docs-doc-comment-tool:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
/* 输入框有内容时出现：取消 / 发送 */
.docs-doc-comment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}
.docs-doc-comment-cancel,
.docs-doc-comment-send {
  height: 32px;
  padding: 0 16px;
  font: inherit;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}
.docs-doc-comment-cancel {
  color: var(--docs-text);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
}
.docs-doc-comment-cancel:hover {
  background: var(--docs-hover);
}
.docs-doc-comment-send {
  color: #fff;
  background: var(--c-primary);
  border: none;
}
.docs-doc-comment-send:hover {
  background: var(--c-primary-active);
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
  display: block;
  width: 100%;
  padding: 0;
  /* 多行文本框：不出现滚动条和拖拽角，高度由脚本按内容设置 */
  overflow: hidden;
  resize: none;
  font-family: inherit;
  word-break: break-word;
  background: transparent;
  font-size: 34px;
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
/* 标题区：标题上方的「添加图标 / 添加封面」绝对定位在留白里，不占高度，标题位置不变 */
.docs-title-zone {
  position: relative;
}
.docs-title-actions {
  position: absolute;
  bottom: 100%;
  left: -6px;
  display: flex;
  gap: 4px;
  /* 用内边距而不是外边距留间隔：鼠标从标题移上来时不会经过"空隙"而丢失悬停 */
  padding-bottom: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.docs-title-zone:hover .docs-title-actions,
.docs-title-zone:focus-within .docs-title-actions,
.docs-title-zone.is-acting .docs-title-actions {
  opacity: 1;
}
.docs-title-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 6px;
  font: inherit;
  font-size: 14px;
  color: var(--docs-text-2);
  white-space: nowrap;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-title-action:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.docs-title-action :deep(.anticon) {
  font-size: 15px;
}
/* 图标 + 标题同一行 */
.docs-title-row {
  display: flex;
  /* 标题可能换成多行：图标对齐第一行 */
  align-items: flex-start;
  gap: 6px;
}
.docs-title-row .docs-title-input {
  flex: 1;
  min-width: 0;
}
/* 文档图标：标题前面的 emoji，大小跟随标题字号（1em = 标题字号） */
.docs-title-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3em;
  height: 1.3em;
  margin-left: -4px;
  padding: 0;
  font-size: 34px;
  line-height: 1;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}
.docs-title-icon:not(.is-static):hover {
  background: var(--docs-hover);
}
.docs-title-icon.is-static {
  cursor: default;
}
/* 封面：文档区顶部通栏（横跨正文与目录）；
   宽度随文档区自适应，高度按宽高比联动，并用 min/max 限制在合理范围 */
.docs-cover {
  position: relative;
  flex: none;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 4.1;
  min-height: 180px;
  max-height: 320px;
  overflow: hidden;
}
.docs-cover-actions {
  position: absolute;
  right: 24px;
  bottom: 12px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}
.docs-cover:hover .docs-cover-actions,
.docs-cover:focus-within .docs-cover-actions,
.docs-cover.is-acting .docs-cover-actions {
  opacity: 1;
}
.docs-cover-btn {
  height: 28px;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  color: #1f2329;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: var(--docs-radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: background 0.12s;
}
.docs-cover-btn:hover {
  background: #fff;
}
/* 标题下方作者行：头像 · 作者 · 修改日期 */
.docs-doc-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  font-size: 14px;
  color: var(--docs-text-3);
}
.docs-doc-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 13px;
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
  height: 14px;
  margin: 0 4px;
  background: var(--docs-border);
}
.docs-editor-wrap {
  position: relative;
  /* 左侧预留加号槽位：鼠标从正文移向加号不会离开容器，避免 mouseleave 提前藏掉加号 */
  --docs-gutter: 66px;
  padding-left: var(--docs-gutter);
  margin-left: calc(-1 * var(--docs-gutter));
  /* 正文与上方作者行的间距 */
  margin-top: 36px;
}
/*
 * 悬停行左外侧的块手柄（对标飞书）：白底描边胶囊，蓝色块类型 + 灰色六点拖拽柄；
 * 普通段落是"+"。右对齐到正文左边缘，标题块再让出折叠三角的位置。
 */
.docs-block-plus {
  position: absolute;
  right: calc(100% - var(--docs-gutter) + 6px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 13px;
  color: #646a73;
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.docs-block-plus.is-heading {
  right: calc(100% - var(--docs-gutter) + 24px);
}
/* 鼠标悬停 / 菜单展开时底色变深 */
.docs-block-plus:hover,
.docs-block-plus.is-open {
  color: #1f2329;
  background: #f2f3f5;
  border-color: #d0d3d6;
}
.docs-block-plus.is-block {
  gap: 3px;
  width: auto;
  padding: 0 4px 0 5px;
}
.docs-block-plus-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  color: #3370ff;
  white-space: nowrap;
}
/* H1 / H2 / H3 的级别数字：小号下标 */
.docs-block-plus-label sub {
  bottom: -0.1em;
  margin-left: 0.5px;
  font-size: 9px;
  font-weight: 600;
  vertical-align: baseline;
  position: relative;
}
.docs-block-plus-drag {
  font-size: 12px;
  color: #8f959e;
}
/* 标题折叠三角：悬停标题时出现在正文左侧，点击折叠 / 展开该标题下的内容 */
.docs-fold-caret {
  position: absolute;
  left: calc(var(--docs-gutter) - 20px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 24px;
  padding: 0;
  color: #1f2329;
  background: var(--docs-canvas);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.docs-fold-caret:hover {
  background: #f2f3f5;
}
.docs-fold-caret svg {
  width: 10px;
  height: 10px;
  transition: transform 0.15s;
}
.docs-fold-caret.is-folded svg {
  transform: rotate(-90deg);
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
/* 空块占位（对标飞书）：该行还没有内容时，显示灰色的块类型（H1 / H2 / H3 / 列表 / 引用）；
   浮动且不占高度，不会把光标挤到下一行；输入内容后消失 */
.docs-editor :deep([data-empty]::before) {
  float: left;
  height: 0;
  color: #bbbfc4;
  pointer-events: none;
}
.docs-editor :deep(blockquote[data-empty]::before) {
  content: '引用';
}
.docs-editor :deep(h1[data-empty]::before) {
  content: 'H1';
}
.docs-editor :deep(h2[data-empty]::before) {
  content: 'H2';
}
.docs-editor :deep(h3[data-empty]::before) {
  content: 'H3';
}
/* 已折叠的标题：左侧常驻一个向右的三角；被折叠的内容整体隐藏 */
.docs-editor :deep([data-folded]) {
  position: relative;
}
.docs-editor :deep([data-folded]::after) {
  content: '';
  position: absolute;
  top: calc(0.65em - 5px);
  left: -15px;
  border: 5px solid transparent;
  border-left-color: #1f2329;
  border-right-width: 0;
  pointer-events: none;
}
.docs-editor :deep([data-fold-hidden]) {
  display: none !important;
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
/* 行内代码：等宽字体 + 淡底，与代码块区分开 */
.docs-editor :deep(code) {
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 0.88em;
  color: #c02b48;
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--docs-radius-sm);
}
.docs-editor :deep(pre code) {
  padding: 0;
  color: inherit;
  font-size: inherit;
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
/* 代码块：顶部语言栏 + 正文的浅色卡片 */
.docs-editor :deep(pre) {
  position: relative;
  /* 上下留白交给语言栏和底部 padding，左右与语言栏负 margin 对齐 */
  margin: 16px 0;
  padding: 0 16px 14px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.7;
  tab-size: 2;
  color: var(--docs-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--docs-paper);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  transition: border-color 0.15s var(--docs-ease), box-shadow 0.15s var(--docs-ease);
}
/* 关闭自动换行：保持单行，横向滚动（语言栏 sticky 固定在顶部） */
.docs-editor :deep(pre[data-wrap='off']) {
  white-space: pre;
  overflow-x: auto;
}
/* 彩色代码层：与可编辑文本完全重叠（继承同一套字体 / 行高 / 换行规则），
   只读、不参与命中测试；顶部 48px = 语言栏 36px + 间距 12px */
.docs-editor :deep(.docs-code-highlight) {
  position: absolute;
  top: 48px;
  right: 16px;
  left: 16px;
  z-index: 0;
  color: var(--docs-text);
  white-space: inherit;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}
/* 彩色层存在时隐藏原生文字，只显示彩色文字；光标颜色单独保留 */
.docs-editor :deep(pre.is-code-colored) {
  color: transparent;
  caret-color: var(--docs-text);
}
/* 输入法组合中：恢复原生文字、暂时隐藏彩色层，保证拼音 / 候选可见 */
.docs-editor :deep(pre.is-code-colored.is-composing) {
  color: var(--docs-text);
}
.docs-editor :deep(pre.is-composing > .docs-code-highlight) {
  display: none;
}
/* token 配色（浅色代码卡片，参考 GitHub Light 的对比度） */
.docs-editor :deep(.docs-code-highlight) .tk-c {
  color: #6e7781;
  font-style: italic;
}
.docs-editor :deep(.docs-code-highlight) .tk-k {
  color: #cf222e;
}
.docs-editor :deep(.docs-code-highlight) .tk-s {
  color: #0a3069;
}
.docs-editor :deep(.docs-code-highlight) .tk-n {
  color: #0550ae;
}
.docs-editor :deep(.docs-code-highlight) .tk-f {
  color: #8250df;
}
.docs-editor :deep(.docs-code-highlight) .tk-t {
  color: #116329;
}
.docs-editor :deep(.docs-code-highlight) .tk-a {
  color: #0550ae;
}
.docs-editor :deep(.docs-code-highlight) .tk-v {
  color: #953800;
}
/* 编辑态：悬停 / 聚焦时描边加深，与其它块的整行底色区分 */
.docs-editor-wrap.is-edit .docs-editor :deep(pre:hover) {
  border-color: var(--docs-border-strong);
}
.docs-editor-wrap.is-edit .docs-editor :deep(pre:focus-within) {
  border-color: color-mix(in srgb, var(--c-primary) 45%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 10%, transparent);
}
/* 语言栏：负 margin 铺满整个卡片宽度，顶部圆角随卡片裁切；
   sticky 是为了「不自动换行」横向滚动时代码从语言栏下方滚过，语言栏保持可见 */
.docs-editor :deep(.docs-code-head) {
  position: sticky;
  left: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  margin: 0 -16px 12px;
  padding: 0 8px 0 14px;
  font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  white-space: normal;
  background: var(--docs-side-bg);
  border-bottom: 1px solid var(--docs-border);
  user-select: none;
  -webkit-user-select: none;
}
.docs-editor :deep(.docs-code-head-actions) {
  display: flex;
  align-items: center;
  gap: 4px;
}
/* 语言切换按钮 */
.docs-editor :deep(.docs-code-lang) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 6px;
  margin-left: -6px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: var(--docs-text-3);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--docs-radius-sm);
  transition: background 0.15s var(--docs-ease), color 0.15s var(--docs-ease);
}
.docs-editor :deep(.docs-code-lang:hover) {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.docs-editor :deep(.docs-code-lang-icon) {
  width: 14px;
  height: 14px;
  color: var(--c-primary);
}
.docs-editor :deep(.docs-code-lang-caret) {
  width: 10px;
  height: 10px;
  opacity: 0.7;
}
/* 自动换行开关：开启时为主色，关闭时置灰 */
.docs-editor :deep(.docs-code-wrap) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 7px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1;
  color: var(--docs-text-3);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--docs-radius-sm);
  transition: background 0.15s var(--docs-ease), color 0.15s var(--docs-ease);
}
.docs-editor :deep(.docs-code-wrap svg) {
  width: 13px;
  height: 13px;
}
.docs-editor :deep(.docs-code-wrap.is-on) {
  color: var(--c-primary);
}
.docs-editor :deep(.docs-code-wrap:hover) {
  background: var(--docs-hover);
}
.docs-editor :deep(.docs-code-wrap:not(.is-on)) {
  color: var(--docs-text-3);
  opacity: 0.72;
}
.docs-editor :deep(.docs-code-copy) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1;
  color: var(--docs-text-2);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--docs-radius-sm);
  transition: background 0.15s var(--docs-ease), color 0.15s var(--docs-ease);
}
.docs-editor :deep(.docs-code-copy svg) {
  width: 13px;
  height: 13px;
}
.docs-editor :deep(.docs-code-copy:hover) {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.docs-editor :deep(.docs-code-copy.is-done) {
  color: var(--docs-success);
}
/* 代码语言切换菜单 */
.docs-code-lang-menu {
  position: absolute;
  z-index: 30;
  width: 168px;
  max-height: 300px;
  padding: 6px;
  overflow-y: auto;
  /* 滚到列表尽头时不把滚动传给文档，避免菜单被滚动收起的逻辑误伤 */
  overscroll-behavior: contain;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.docs-code-lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--docs-text);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--docs-radius-sm);
}
.docs-code-lang-option:hover {
  background: var(--docs-hover);
}
.docs-code-lang-option.is-active {
  font-weight: 500;
  color: var(--c-primary);
}
.docs-code-lang-check {
  font-size: 12px;
}
/* 窄屏：语言栏只留图标，避免挤压代码显示区 */
@media (max-width: 720px) {
  .docs-editor :deep(.docs-code-wrap span),
  .docs-editor :deep(.docs-code-copy-text) {
    display: none;
  }
  .docs-editor :deep(.docs-code-wrap),
  .docs-editor :deep(.docs-code-copy) {
    padding: 0 6px;
  }
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
    flex-basis: 209px;
    padding-right: 10px;
    padding-bottom: 24px;
    padding-left: 10px;
  }
}
/* 较窄宽度：隐藏目录，正文占满画布 */
@media (max-width: 1060px) {
  .docs-outline {
    display: none;
  }
  .docs-canvas-inner {
    padding: 60px 24px 64px 72px;
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
  /* 三个入口卡片比内容区略窄，左侧对齐 */
  grid-template-columns: repeat(3, minmax(0, 300px));
  justify-content: start;
  gap: 12px;
  margin-top: 12px;
}

/* 主页：新建 / 上传 / 模板库 一行与左侧菜单搜索框顶部水平对齐 */
.docs-home.docs-home-main {
  padding-top: 14px;
}
.docs-home-main .docs-quick-cards {
  margin-top: 0;
}
.docs-quick-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 18px 16px;
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
  font-size: 19px;
  color: #fff;
  border-radius: 9px;
}
.docs-quick-icon.is-new {
  background: linear-gradient(135deg, var(--c-primary), var(--c-primary-hover));
}
.docs-quick-icon.is-upload {
  background: linear-gradient(135deg, #ff7d00, #ffa940);
  color: #ffffff;
}
.docs-quick-icon.is-template {
  background: linear-gradient(135deg, #ff7d00 0%, #ff4d4f 35%, #8b5cf6 70%, #3370ff 100%);
  color: #ffffff;
}
.docs-quick-icon.is-newlib {
  background: linear-gradient(135deg, #3370ff, #34d399);
  color: #ffffff;
}
.docs-quick-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.docs-quick-text b {
  font-size: 15px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-quick-text small {
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-quick-caret {
  flex: none;
  font-size: 14px;
  color: var(--docs-text-2);
  transition: transform 0.15s;
}

.docs-quick-card.is-open .docs-quick-caret {
  transform: rotate(180deg);
}

/* 新建下拉面板（参考飞书「新建」） */
.docs-add-panel {
  width: 300px;
  padding: 8px;
  background: #ffffff;
  border: 1px solid var(--docs-border);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06);
}

.docs-add-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 44px;
  padding: 0 10px;
  font-size: 14px;
  color: #1d1d1f;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}

.docs-add-item:hover {
  background: #f5f6f8;
}

.docs-add-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-size: 16px;
  color: #ffffff;
  border-radius: 8px;
}

.docs-add-icon.is-md {
  background: linear-gradient(135deg, #3f4652, #6b7280);
}
.docs-add-icon.is-txt {
  background: linear-gradient(135deg, #4e83fd, #7aa7ff);
}
.docs-add-icon.is-html {
  background: linear-gradient(135deg, #ff7d00, #ffa940);
}
.docs-add-icon.is-meeting {
  background: linear-gradient(135deg, #3370ff, #5b8cff);
}
.docs-add-icon.is-weekly {
  background: linear-gradient(135deg, #00b96b, #34d399);
}
.docs-add-icon.is-prd {
  background: linear-gradient(135deg, #8b5cf6, #b794f6);
}

.docs-add-divider {
  height: 1px;
  margin: 6px 8px;
  background: #f0f0f2;
}

.docs-add-section {
  padding: 8px 10px 4px;
  font-size: 12px;
  color: #8f959e;
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
  font-size: 31px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--docs-text);
}
.docs-home-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-home-new {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
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
  font-size: 13px;
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
  font-size: 14px;
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
  font-size: 13px;
  line-height: 28px !important;
  color: var(--docs-text-2);
}
.docs-sort-icon {
  font-size: 14px;
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
  font-size: 14px;
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
  font-size: 15px;
  font-weight: 500;
  color: var(--docs-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-grid-meta {
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-grid-star {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 13px;
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
  font-size: 13px;
  font-weight: 400;
  color: var(--docs-text-3);
  text-align: left;
  border-bottom: 1px solid var(--docs-border);
}
.docs-table td {
  padding: 0 12px;
  overflow: hidden;
  font-size: 15px;
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
  font-size: 13px !important;
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
  font-size: 14px;
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
  font-size: 37px;
  color: var(--docs-border-strong);
}
.docs-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-empty-desc {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--docs-text-3);
}

/* 文件夹弹窗 */
.docs-folder-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

/* ==================== 新建知识库：选择模板弹窗 ==================== */
.docs-lib-tpl-modal :deep(.ant-modal-content) {
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
}

.lib-tpl {
  display: flex;
  flex-direction: column;
  height: 640px;
  background: #ffffff;
}

.lib-tpl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid #f0f0f2;
}

.lib-tpl-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
}

.lib-tpl-head-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.lib-tpl-feedback {
  padding: 0;
  font-size: 13px;
  color: #6e6e73;
  background: transparent;
  border: none;
  cursor: pointer;
}

.lib-tpl-feedback:hover {
  color: #1d1d1f;
}

.lib-tpl-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 15px;
  color: #6e6e73;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.lib-tpl-close:hover {
  color: #1d1d1f;
  background: #f2f3f5;
}

.lib-tpl-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.lib-tpl-scroll {
  flex: 1;
  min-width: 0;
  padding: 20px 24px 28px;
  overflow-y: auto;
}

.lib-tpl-section + .lib-tpl-section {
  margin-top: 26px;
}

.lib-tpl-section h4 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.lib-tpl-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.lib-tpl-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  overflow: hidden;
  text-align: left;
  background: #ffffff;
  border: 1px solid #e8e8ec;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.lib-tpl-card:hover {
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
}

.lib-tpl-card.active {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 1px var(--c-primary) inset;
}

.lib-tpl-card.is-blank {
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 186px;
  font-size: 14px;
  color: #1d1d1f;
  border-color: var(--c-primary);
}

.lib-tpl-plus {
  font-size: 34px;
  color: var(--c-primary);
}

.lib-tpl-cover {
  display: block;
  width: 100%;
  height: 108px;
}

.lib-tpl-name {
  padding: 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}

.lib-tpl-desc {
  padding: 0 12px 14px;
  font-size: 12px;
  color: #8f959e;
}

.lib-tpl-preview {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  border-left: 1px solid #f0f0f2;
}

.lib-tpl-preview h4 {
  margin: 0 0 18px;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.lib-tpl-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 0.55;
  transition: opacity 0.15s;
}

.lib-tpl-tree.is-active {
  opacity: 1;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
}

.tree-row.indent {
  padding-left: 18px;
}

.tree-row .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c9ccd1;
}

.tree-row .dot.dark {
  background: #9aa0a6;
}

.tree-row .dot.gold {
  background: #f5b400;
}

.tree-row .bar {
  height: 6px;
  border-radius: 3px;
  background: #e5e6e8;
}

.tree-row .bar.gold {
  background: #f5b400;
}

.tree-row .w72 { width: 72px; }
.tree-row .w64 { width: 64px; }
.tree-row .w56 { width: 56px; }
.tree-row .w48 { width: 48px; }

.lib-tpl-preview-empty {
  margin-top: auto;
  padding: 20px 0 8px;
  font-size: 13px;
  color: #8f959e;
  text-align: center;
}

.lib-tpl-preview-empty.is-selected {
  color: var(--c-primary);
}

.lib-tpl-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: none;
  gap: 12px;
  height: 64px;
  padding: 0 24px;
  border-top: 1px solid #f0f0f2;
}

/* ==================== 新建知识库：完善信息弹窗 ==================== */
.docs-lib-info-modal :deep(.ant-modal-content) {
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
}

.lib-info {
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.lib-info-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 28px 10px;
}

.lib-info-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 15px;
  color: #4b5563;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.lib-info-back:hover {
  color: #1d1d1f;
  background: #f2f3f5;
}

.lib-info-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
}

.lib-info-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px 28px 8px;
}

.lib-info-field label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #1d1d1f;
}

.lib-info-required {
  margin-left: 2px;
  color: #ff4d4f;
}

.lib-info-prefix {
  font-size: 16px;
  color: #b0b3b8;
}

.lib-info-visibility {
  padding: 8px 14px;
  border: 1px solid #e8e8ec;
  border-radius: 10px;
}

.lib-info-radios {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lib-info-radios :deep(.ant-radio-wrapper) {
  margin-right: 0;
  padding: 2px 0;
  font-size: 14px;
}

.lib-info-foot {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 28px 24px;
}

/* ==================== 新建文档：选择模板弹窗 ==================== */
.docs-doc-tpl-modal :deep(.ant-modal-content) {
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
}

.doc-tpl {
  display: flex;
  flex-direction: column;
  height: 700px;
  background: #ffffff;
}

.doc-tpl-head {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: none;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid #f0f0f2;
}

.doc-tpl-target {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
}

.doc-tpl-target-label {
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.doc-tpl-target-folder {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 14px;
  color: var(--c-primary);
  background: #f2f5ff;
  border-radius: 8px;
}

.doc-tpl-search {
  width: 420px;
  max-width: 38vw;
}

.doc-tpl-head-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.doc-tpl-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 13px;
  color: var(--c-primary);
  background: #eef4ff;
  border-radius: 8px;
}

.doc-tpl-divider {
  width: 1px;
  height: 20px;
  background: #e8e8ec;
}

.doc-tpl-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.doc-tpl-nav {
  flex: 0 0 180px;
  padding: 16px 12px;
  overflow-y: auto;
  border-right: 1px solid #f0f0f2;
}

.doc-tpl-nav-item {
  display: block;
  width: 100%;
  margin-bottom: 2px;
  padding: 8px 12px;
  font-size: 14px;
  color: #4b5563;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.doc-tpl-nav-item:hover {
  background: #f5f6f8;
}

.doc-tpl-nav-item.active {
  font-weight: 600;
  color: var(--c-primary);
  background: #eef4ff;
}

.doc-tpl-content {
  flex: 1;
  min-width: 0;
  padding: 20px 24px;
  overflow-y: auto;
}

.doc-tpl-content h4 {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
}

.doc-tpl-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.doc-tpl-blank {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  aspect-ratio: 3 / 4;
  font-size: 14px;
  color: #1d1d1f;
  background: #ffffff;
  border: 1px solid #e8e8ec;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.doc-tpl-blank:hover {
  border-color: var(--c-primary);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
}

.doc-tpl-plus {
  font-size: 44px;
  color: var(--c-primary);
}

.doc-tpl-empty {
  padding: 80px 0;
  font-size: 13px;
  color: #8f959e;
  text-align: center;
}

@media (max-width: 860px) {
  .docs-side {
    flex-basis: 200px;
  }
  /* 左侧仍保留 40px 加号槽位，其余各边保持最小留白 */
  .docs-canvas-inner {
    padding: 60px 24px 64px 72px;
  }
  .docs-canvas-inner.is-wide {
    padding: 0;
  }
  .docs-title-input,
  .docs-title-icon {
    font-size: 30px;
  }
}

/* 窄屏：收起右侧评论栏，正文优先占满画布（外层 grid 同时去掉评论列） */
@media (max-width: 860px) {
  .docs-comment-rail {
    display: none;
  }
  .docs-doc-scroll.is-scrollable,
  .docs-doc-scroll.is-scrollable.is-comments-collapsed {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* 极窄宽度：侧栏再收窄、首页留白收紧、列表隐藏次要列，保证正文/表格可用 */
@media (max-width: 720px) {
  .docs-page {
    --docs-side-pt: 12px;
  }
  .docs-side {
    flex-basis: 160px;
    padding: var(--docs-side-pt) 8px 10px;
  }
  .docs-canvas-inner {
    padding: 60px 16px 64px 72px;
  }
  .docs-canvas-inner.is-wide {
    padding: 0;
  }
  .docs-title-input,
  .docs-title-icon {
    font-size: 27px;
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
    padding-top: 56px;
    padding-bottom: 64px;
  }
  .docs-canvas-inner.is-wide {
    padding-top: 0;
  }
  .docs-page {
    --docs-side-pt: 12px;
  }
  .docs-home {
    padding-top: 24px;
  }
}
/* 极矮窗口（如半屏 / 小窗预览）：标题与首页留白进一步收紧 */
@media (max-height: 600px) {
  /* 标题上方留白不再单独收紧到 24px（沿用上面 760px 档的值），否则在矮窗口里调大上边距看不到变化 */
  .docs-title-input,
  .docs-title-icon {
    font-size: 30px;
  }
  .docs-home {
    padding-top: 16px;
  }
}
</style>
