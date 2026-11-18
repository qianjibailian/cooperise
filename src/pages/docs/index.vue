<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
  ReadOutlined,
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
  AlignCenterOutlined,
  AlignRightOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignBottomOutlined,
  FontColorsOutlined,
  HighlightOutlined,
  FormOutlined,
  RobotOutlined,
  ScissorOutlined,
  CopyOutlined,
  CommentOutlined,
  MessageOutlined,
  SendOutlined,
  TranslationOutlined,
  ShareAltOutlined,
  FileAddOutlined,
  FolderFilled,
  FileDoneOutlined,
  ScheduleOutlined,
  SnippetsOutlined,
  PlusSquareOutlined,
  LockOutlined,
} from '@ant-design/icons-vue'
import { getLoginUsername, useAuth } from '@/utils/auth'
import type { DocType, DocFolder, DocLibrary, DocItem, DocMeta, DocComment, MindNode, SheetData, MindmapData, FlowData, LibSideRow } from '@/types/docs'
import DocEmojiPicker from '@/components/docs/DocEmojiPicker.vue'
import DocCoverPicker from '@/components/docs/DocCoverPicker.vue'
import { docCoverBackground } from '@/utils/doc-cover'
import DocSheetEditor from '@/components/docs/DocSheetEditor.vue'
import DocIssuePicker from '@/components/docs/DocIssuePicker.vue'
import { TEAM_COLLAB_ITEMS, type TeamManageSpec } from '@/utils/team-collab'
import TeamManageModal from '@/components/docs/TeamManageModal.vue'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'
import DocAiDrawer from '@/components/docs/DocAiDrawer.vue'
import { textToParagraphsHtml, type AiReplacePayload } from '@/utils/ai-blocks'
import { defaultSheetData, normalizeSheetData } from '@/utils/doc-sheet'
import { formatUsDate, formatUsRelative } from '@/utils/us-format'
import { tr } from '@/i18n'
import { fuzzyQueryIssues, type FuzzyIssueItem } from '@/api/faiz'
import DocMindmapEditor from '@/components/docs/DocMindmapEditor.vue'
import DocFlowEditor from '@/components/docs/DocFlowEditor.vue'
import DocTypeIcon from '@/components/docs/DocTypeIcon.vue'
import LibrarySide from '@/components/docs/LibrarySide.vue'
import DocsLibraryCover from '@/components/docs/DocsLibraryCover.vue'
import AppLogo from '@/components/AppLogo.vue'
import { isDesktop } from '@/utils/desktop'
import { startGlobalLoading, stopGlobalLoading } from '@/utils/global-loading'
import { enqueueUploads, uploadDoneSeq, type UploadContext } from '@/utils/upload-queue'
import { docsSideCollapsed, docsEditMode,docsSuggestMode, docsActiveDoc, docsSaveState, docsTitleRev, docsCreateRequest, docsMoreRequest, docsMoveTargets, DOC_UNTITLED, docTitleInputValue } from '@/utils/docs-layout'
import { openDocSharePanel } from '@/utils/doc-share'
import {
  createDoc as createDocApi,
  createDocFolder,
  uploadDocAttachment,
  submitDocParse,
  getDocParseStatus,
  createDocLibrary,
  deleteDocFolder,
  deleteDocLibrary,
  emptyTrash as emptyTrashApi,
  getDocDetail,
  listDocFolders,
  listDocLibraries,
  starDocLibrary,
  updateDocLibrary,
  listDocs as listDocsApi,
  listTrashDocs,
  moveDoc as moveDocApi,
  purgeDoc as purgeDocApi,
  renameDoc as renameDocApi,
  renameDocFolder,
  restoreDoc as restoreDocApi,
  linkIssueDocs,
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
/** 当前文档 ID：/docs/wiki/:docId 优先，兼容旧链接 /docs?doc=xxx */
const routeDocId = computed(() => String(route.params.docId || route.query.doc || ''))
/** 「我的文档库」是否折叠（仅本次页面有效） */
const myDocsCollapsed = ref(false)
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
/** 当前打开的知识库（空 = 知识库列表 / 主页） */
const activeLibraryId = ref('')
/** 知识库列表（顶层实体） */
const libraries = ref<DocLibrary[]>([])
/** 当前新建文档默认归属的文件夹（点击文件夹标题时更新；必须在 activeLibraryId 之内） */
const activeFolderId = ref('')
/** 文件夹展开状态 */
const expanded = reactive<Record<string, boolean>>({})

/**
 * 正文区显示的文档 id：切换文档时保持旧文档，直到新文档的详情返回才替换，避免先出现空白正文。
 * 侧栏高亮、路由仍然跟随 activeId。
 */
const displayedId = ref('')
const activeDoc = computed(() => docs.value.find((d) => d.id === displayedId.value) || null)
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

/** 侧栏分组：folder 为空表示该组是「不带文件夹的文档」（主页下为个人文档，知识库下为库根目录文档） */
interface DocGroup {
  folder: DocFolder | null
  docs: DocItem[]
  flat?: boolean
  /** 文件夹在知识库内的层级（0 = 库根目录下的一级文件夹） */
  depth?: number
}

/**
 * 知识库内的文件夹树（深度优先，子文件夹紧跟父文件夹）。
 * hidden：其任一祖先文件夹被折叠，侧栏中不展示，但仍参与「库根目录文档」的判定。
 */
function folderTree(libraryId: string): { folder: DocFolder; depth: number; hidden: boolean }[] {
  const inLib = folders.value.filter((f) => f.libraryId === libraryId)
  const ids = new Set(inLib.map((f) => f.id))
  const out: { folder: DocFolder; depth: number; hidden: boolean }[] = []
  const walk = (parentId: string | undefined, depth: number, hidden: boolean) => {
    for (const f of inLib) {
      const p = f.parentId && ids.has(f.parentId) ? f.parentId : undefined
      if (p !== parentId) continue
      out.push({ folder: f, depth, hidden })
      walk(f.id, depth + 1, hidden || expanded[f.id] === false)
    }
  }
  walk(undefined, 0, false)
  return out
}

/** 分组数据：搜索时平铺；收藏模式只列星标；打开知识库时列库内目录树；主页只列不属于任何知识库的文档 */
const groups = computed<DocGroup[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  const match = (d: DocItem) =>
    !kw || d.title.toLowerCase().includes(kw) || stripHtml(d.content).toLowerCase().includes(kw)
  // 打开知识库时，侧栏内容（含搜索结果）只限于该知识库，个人文档不再出现
  const scope = activeLibraryId.value
    ? docs.value.filter((d) => d.libraryId === activeLibraryId.value)
    : docs.value
  const visible = scope.filter(match)
  if (navMode.value === 'starred') {
    return [{ folder: null, docs: visible.filter((d) => d.starred), flat: true }]
  }
  if (kw) return [{ folder: null, docs: visible, flat: true }]

  if (activeLibraryId.value) {
    const libId = activeLibraryId.value
    const libDocs = visible.filter((d) => d.libraryId === libId)
    const tree = folderTree(libId)
    const inTree = new Set(tree.map((t) => t.folder.id))
    const result: DocGroup[] = [
      { folder: null, docs: libDocs.filter((d) => !d.folderId || !inTree.has(d.folderId)) },
    ]
    for (const t of tree) {
      if (t.hidden) continue
      result.push({
        folder: t.folder,
        docs: libDocs.filter((d) => d.folderId === t.folder.id),
        depth: t.depth,
      })
    }
    return result
  }
  return [{ folder: null, docs: visible.filter((d) => !d.libraryId) }]
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
  return defaultSheetData()
}

function defaultMindmap(): MindmapData {
  return { root: { id: genDocId('root'), text: '中心主题', children: [] } }
}

/** 补齐各类型需要的数据，兼容历史 / 异常数据 */
function ensureDocData(doc: DocItem) {
  if (doc.type === 'sheet') {
    // 老数据（单表）包装成 Sheet1；多表数据原样保留
    if (!(doc.data as SheetData | undefined)?.sheets?.length) doc.data = normalizeSheetData(doc.data)
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
    libraryId: d.libraryId ? String(d.libraryId) : undefined,
    folderId: d.folderId ? String(d.folderId) : undefined,
    position: d.position === 'library' || d.position === 'home' ? d.position : undefined,
    author: d.author ? String(d.author) : undefined,
    authorAvatar: d.authorAvatar ? String(d.authorAvatar) : d.avatarUrl ? String(d.avatarUrl) : undefined,
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
    libraryId: String(f.libraryId || ''),
    parentId: f.parentId ? String(f.parentId) : undefined,
    createdAt: Number(f.createdAt) || Date.now(),
    starred: !!f.starred,
  }
}

function normalizeLibrary(l: any): DocLibrary {
  return {
    id: String(l.id),
    name: String(l.name || '未命名知识库'),
    desc: l.desc ? String(l.desc) : undefined,
    cover: l.cover ? String(l.cover) : undefined,
    visibility: l.visibility === 'all' ? 'all' : 'members',
    createdAt: Number(l.createdAt) || Date.now(),
    starred: !!l.starred,
  }
}


// ---- 数据加载（后端接口） ----
const loading = ref(false)
/** 按登录用户区分数据归属（后端从 token 解析身份，这里只用于切换账号时重新拉取） */
const ownerKey = computed(() => getLoginUsername() || 'anonymous')

/**
 * 文档详情（GET /docs/{id}）：正文、位置、创建位置等都以详情为准，回写到列表缓存。
 * 有未落盘的本地修改时保留本地的标题 / 正文 / 表格数据，其余字段仍以服务端为准。
 */
async function fetchDocDetail(id: string) {
  startGlobalLoading()
  try {
    const res = await getDocDetail(id)
    if (!res?.success || !res.data) throw new Error('文档不存在')
    const fresh = normalizeDoc(res.data)
    let local: DocItem | undefined = docs.value.find((d) => d.id === id)
    if (!local) {
      docs.value.unshift(fresh)
      local = fresh
    } else {
      if (pendingDoc?.id === id) {
        fresh.title = local.title
        fresh.content = local.content
        fresh.data = local.data
      }
      Object.assign(local, fresh)
    }
    // 只有仍是当前文档时才应用位置并结束加载；快速切换时过期的响应不生效
    if (activeId.value === id) {
      // 菜单由路由决定：/docs/library/wiki/:docId 显示所属知识库（所属库 ID 取详情的 libraryId），/docs/wiki/:docId 显示主页
      const onLibraryRoute = route.name === 'LibraryWikiDoc'
      const asLibrary = onLibraryRoute && isLibraryDoc(local)
      applyDocPosition(local, asLibrary)
      detailReadyId.value = id
      displayedId.value = id
      pageReady.value = true
      // 知识库路由但详情不是知识库文档（或没有所属库）时，改回主页路由
      if (onLibraryRoute && String(route.params.docId) === id && !asLibrary) {
        void router.replace({ name: 'WikiDoc', params: { docId: id } })
      }
    }
  } catch {
    // 详情取不到（已删除 / 无权限）时，回到列表页；请求失败的提示由 request 拦截器统一展示
    if (activeId.value === id) activeId.value = ''
    // 失败也要结束占位，否则页面会一直停在加载中
    pageReady.value = true
  } finally {
    stopGlobalLoading()
  }
}

/** 详情接口返回后，才渲染文档页：该 id 的详情与位置都已确定 */
const detailReadyId = ref('')
/** 文档页是否已经渲染过一次：只有第一次打开时用占位，之后切换文档保持页面结构，不闪白 */
const pageReady = ref(false)
// 地址里带文档 id 时，从挂载开始就用占位，直到该文档的详情返回；
// 否则列表加载期间会先闪出主页列表，再切换到知识库菜单（从知识库新建文档时最明显）
const docPending = computed(() => !pageReady.value && !!routeDocId.value && detailReadyId.value !== routeDocId.value)

/**
 * 按已确定的位置设置左侧菜单：asLibrary 且有 libraryId → 所属知识库的目录树；否则 → 主页。
 */
function applyDocPosition(doc: DocItem, asLibrary: boolean) {
  if (asLibrary && doc.libraryId) {
    activeLibraryId.value = doc.libraryId
    navMode.value = 'library'
  } else {
    activeLibraryId.value = ''
    if (navMode.value === 'library') navMode.value = 'recent'
  }
}

/** 是否知识库内的文档：position 为 library 且有 libraryId（旧数据无 position 时按 libraryId 判断） */
function isLibraryDoc(doc: DocItem): boolean {
  return (doc.position ?? (doc.libraryId ? 'library' : 'home')) === 'library' && !!doc.libraryId
}

/** 文档详情的路由：知识库内的文档为 /docs/library/wiki/:docId，主页文档为 /docs/wiki/:docId */
function docRoute(doc: DocItem) {
  return { name: isLibraryDoc(doc) ? 'LibraryWikiDoc' : 'WikiDoc', params: { docId: doc.id } }
}

// 当前文档变化（列表点开 / 地址变化 / 前进后退 / 刚加载页面）时，统一拉取该文档的详情
watch(activeId, (id) => {
  if (id) void fetchDocDetail(id)
  else displayedId.value = ''
})

/** 拉取文件夹 / 文档 / 回收站列表 */
async function loadDocs() {
  loading.value = true
  try {
    const [lRes, fRes, dRes, tRes] = await Promise.all([
      // 知识库接口失败不影响文档 / 文件夹列表加载
      listDocLibraries().catch(() => null),
      listDocFolders(),
      listDocsApi(),
      listTrashDocs(),
    ])
    if (lRes?.success) libraries.value = (lRes.data || []).map(normalizeLibrary)
    if (fRes.success) folders.value = (fRes.data || []).map(normalizeFolder)
    if (dRes.success) docs.value = (dRes.data || []).map(normalizeDoc)
    if (tRes.success) trash.value = (tRes.data || []).map(normalizeDoc)
    // 默认展开全部文件夹
    for (const f of folders.value) expanded[f.id] = expanded[f.id] ?? true
    // 打开的知识库已被删除 / 不存在时回到知识库列表
    if (activeLibraryId.value && !libraries.value.some((l) => l.id === activeLibraryId.value)) activeLibraryId.value = ''
    // 从 URL 恢复当前文档；没有则停留在列表页。正文由 watch(activeId) 通过详情接口加载
    activeId.value = routeDocId.value
    // 旧链接 /docs?doc=xxx → /docs/wiki/xxx
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

/** 快捷入口：下拉菜单宽度与卡片宽度一致（随窗口宽度变化） */
const quickCardsRef = ref<HTMLElement | null>(null)
const quickCardWidth = ref(0)
const quickMenuStyle = computed(() => (quickCardWidth.value ? { width: `${quickCardWidth.value}px` } : {}))
let quickCardsObserver: ResizeObserver | undefined
onMounted(() => {
  const el = quickCardsRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  const measure = () => {
    const card = el.querySelector<HTMLElement>('.docs-quick-card')
    if (card) quickCardWidth.value = card.clientWidth
  }
  quickCardsObserver = new ResizeObserver(measure)
  quickCardsObserver.observe(el)
  measure()
})
onBeforeUnmount(() => quickCardsObserver?.disconnect())


onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  if (!saved.value) flushSave()
})

// ---- 文档操作 ----
/** 本地登录用户（localStorage）的昵称 / 头像：创建文档时写入创建者信息 */
function localUserNickname(): string {
  return authUser.value?.realName || authUser.value?.coAccount || getLoginUsername() || ''
}

function localUserAvatar(): string {
  return authUser.value?.avatarUrl || ''
}

/** 创建者信息（取自 localStorage 登录数据） */
function localAuthorMeta(): DocMeta {
  const meta: DocMeta = {}
  const name = localUserNickname()
  const avatar = localUserAvatar()
  if (name) meta.authorName = name
  if (avatar) meta.authorAvatar = avatar
  return meta
}

/** 新建文档后补上创建人昵称 / 头像（写入 DocMeta，随文档 data 一起保存） */
function stampLocalAuthor(doc: DocItem) {
  doc.author = localUserNickname() || doc.author
  doc.authorAvatar = localUserAvatar() || doc.authorAvatar
  if (doc.type === 'doc') {
    const meta: DocMeta = { ...((doc.data as DocMeta | undefined) || {}), ...localAuthorMeta() }
    if (Object.keys(meta).length) doc.data = meta
  }
}

function createDoc(type: DocType = 'doc', folderId?: string) {
  const data: SheetData | MindmapData | FlowData | DocMeta | undefined =
    type === 'sheet' ? defaultSheet()
      : type === 'mindmap' ? defaultMindmap()
        : type === 'flow' ? { graph: null }
          : localAuthorMeta()
  // 文件夹必然属于某个知识库；不在文件夹内时，若正打开知识库则新建到该库根目录，否则为个人文档
  const libraryId = folderId
    ? folders.value.find((f) => f.id === folderId)?.libraryId
    : activeLibraryId.value || undefined
  // 先调用创建接口，拿到后端返回的 id 之后才跳转到文档页；等待期间显示全局加载
  startGlobalLoading()
  createDocApi({
    title: DOC_TYPE_TITLE[type],
    type,
    libraryId: libraryId || undefined,
    folderId: folderId || undefined,
    position: libraryId ? 'library' : 'home',
    data,
  })
    .then((res) => {
      if (!res.success || !res.data) return
      const doc = normalizeDoc(res.data)
      stampLocalAuthor(doc)
      docs.value.unshift(doc)
      if (folderId) expanded[folderId] = true
      // 后端生成文档 id（24 位 Base62），打开新的文档页面加载内容
      router.push(docRoute(doc))
      if (type === 'doc') nextTick(() => editorRef.value?.focus())
    })
    .catch(() => {})
    .finally(() => stopGlobalLoading())
}

// ---- 各类型数据 / 展示 ----
/** 表格整体数据（行 + 单元格样式 + 冻结），编辑器直接修改它并通过 change 保存 */
function sheetData(doc: DocItem): SheetData {
  ensureDocData(doc)
  return doc.data as SheetData
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
  createDocApi({
    type,
    title,
    content,
    libraryId: activeLibraryId.value || undefined,
    folderId: activeFolderId.value || undefined,
    position: activeLibraryId.value ? 'library' : 'home',
    data: type === 'doc' ? localAuthorMeta() : undefined,
  })
    .then((res) => {
      if (!res.success || !res.data) return
      const doc = normalizeDoc(res.data)
      stampLocalAuthor(doc)
      docs.value.unshift(doc)
      // 打开新的文档页面（后端生成的文档 id）
      router.push(docRoute(doc))
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

/** 上传：文件 / 文件夹真正上传到服务器（带进度，进度小窗在右下角，见 utils/upload-queue） */
const uploadFileInput = ref<HTMLInputElement | null>(null)
const uploadFolderInput = ref<HTMLInputElement | null>(null)

/** 上传目标：当前知识库（以及选中的文件夹）；个人文档没有文件夹 */
function uploadTarget(): { libraryId?: string; folderId?: string } {
  const libraryId = activeLibraryId.value || undefined
  return { libraryId, folderId: libraryId ? activeFolderId.value || undefined : undefined }
}

/** 文本类文件：上传后异步解析内容，追加到文档正文（与后端 DocFileParser 支持的格式一致） */
const PARSABLE_EXTENSIONS = ['txt', 'md', 'markdown', 'html', 'htm']
const PARSE_POLL_MS = 800
const PARSE_POLL_MAX = 150

/** 轮询解析状态直到完成 / 失败 / 超时；返回最终状态 */
async function waitForParse(docId: string): Promise<string> {
  for (let i = 0; i < PARSE_POLL_MAX; i++) {
    await new Promise((resolve) => setTimeout(resolve, PARSE_POLL_MS))
    const res = await getDocParseStatus(docId)
    const state = res.data?.state || 'none'
    if (state === 'done' || state === 'failed' || state === 'none') return state
  }
  return 'timeout'
}

/** 上传一个文件，创建一篇文档（正文先放附件链接），再异步解析文件内容追加进正文 */
async function uploadFileAsDoc(file: File, target: { libraryId?: string; folderId?: string }, ctx: UploadContext): Promise<void> {
  const res = await uploadDocAttachment(file, ctx.progress)
  if (!res.success || !res.data) throw new Error('上传失败')
  const url = res.data.url
  const name = file.name
  const title = name.replace(/\.[^.]+$/, '') || name
  const content = `<p><a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a></p>`
  const docRes = await createDocApi({
    type: 'doc',
    title,
    content,
    libraryId: target.libraryId,
    folderId: target.folderId,
    position: target.libraryId ? 'library' : 'home',
  })
  if (!docRes.success || !docRes.data) throw new Error('创建文档失败')

  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (!PARSABLE_EXTENSIONS.includes(ext)) return
  ctx.progress(100)
  ctx.stage('解析中…')
  try {
    const docId = String(docRes.data.id)
    await submitDocParse(docId, url.split('/').pop() || '')
    await waitForParse(docId)
  } catch {
    // 解析失败（或服务不可用）只影响正文，附件链接仍保留
  } finally {
    ctx.stage('')
  }
}

function onUploadItem(key: string) {
  uploadOpen.value = false
  if (key === 'folder') uploadFolderInput.value?.click()
  else uploadFileInput.value?.click()
}

function onUploadFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  const target = uploadTarget()
  enqueueUploads(files.map((file) => ({ name: file.name, run: (ctx) => uploadFileAsDoc(file, target, ctx) })))
}

function onUploadFolderPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  const target = uploadTarget()
  if (!target.libraryId) {
    message.info('请先进入一个知识库再上传文件夹')
    return
  }
  const libraryId = target.libraryId
  // 每个目录只创建一次：并发上传的文件共用同一个 Promise
  const folderIds = new Map<string, Promise<string | undefined>>()
  const ensureFolder = (dir: string): Promise<string | undefined> => {
    if (!dir) return Promise.resolve(target.folderId)
    let pending = folderIds.get(dir)
    if (!pending) {
      const cut = dir.lastIndexOf('/')
      const parentDir = cut >= 0 ? dir.slice(0, cut) : ''
      const name = dir.slice(cut + 1)
      pending = ensureFolder(parentDir).then(async (parentId) => {
        const res = await createDocFolder({ name, libraryId, parentId })
        if (!res.success || !res.data) throw new Error('创建文件夹失败')
        return String(res.data.id)
      })
      folderIds.set(dir, pending)
    }
    return pending
  }
  enqueueUploads(
    files.map((file) => {
      const rel = file.webkitRelativePath || file.name
      const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''
      return {
        name: rel,
        run: async (ctx) => {
          const folderId = await ensureFolder(dir)
          await uploadFileAsDoc(file, { libraryId, folderId }, ctx)
        },
      }
    }),
  )
}

// 一批上传结束后刷新文档 / 文件夹列表
watch(uploadDoneSeq, () => {
  void loadDocs()
})

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
  // 文档详情统一走 /docs/wiki/:docId（参考飞书）
  router.replace(docRoute(doc))
}

/** 主内容区的文档：在新页面 / 页签中打开 */
function openDocInNewPage(doc: DocItem) {
  const href = router.resolve(docRoute(doc)).href
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
  // 切换任何导航都回到该导航的顶层（知识库列表 / 主页列表），不保留库内的选中状态
  activeLibraryId.value = ''
  activeFolderId.value = ''
  activeId.value = ''
  const target = mode === 'library' ? 'DocsWiki' : mode === 'trash' ? 'DocsTrash' : 'DocsHome'
  if (route.name !== target) router.push({ name: target })
}

// 直接访问 /docs/wiki（知识库）时，左侧对应高亮
watch(
  () => route.name,
  (name) => {
    // 回到主页 / 知识库列表时，清掉上一次打开的知识库，个人文档区不被占用
    if (name === 'DocsWiki' || name === 'DocsHome') activeLibraryId.value = ''
    if (name === 'DocsTrash') navMode.value = 'trash'
    else if (name === 'DocsWiki') navMode.value = 'library'
    else if (name === 'DocsHome' && (navMode.value === 'library' || navMode.value === 'trash')) navMode.value = 'recent'
  },
  { immediate: true },
)

// 顶栏"+"新建：文档 / 表格 / 思维导图 / 流程图 / 知识库（其余类型暂未开放，顶栏已提示）
watch(
  () => docsCreateRequest.value.seq,
  () => {
    const type = docsCreateRequest.value.type
    if (type === 'wiki') openCreateLibrary()
    else if (['doc', 'sheet', 'mindmap', 'flow'].includes(type)) createDoc(type as DocType, activeFolderId.value || undefined)
  },
)


/** 富文本 HTML → Markdown（标题 / 加粗 / 斜体 / 删除线 / 行内代码 / 代码块 / 链接 / 图片 / 列表 / 引用 / 分隔线） */
function htmlToMarkdown(html: string): string {
  const root = new DOMParser().parseFromString(html, 'text/html').body
  const listToMd = (el: HTMLElement, depth: number): string => {
    const ordered = el.tagName.toLowerCase() === 'ol'
    let index = 0
    return Array.from(el.children)
      .filter((c) => c.tagName.toLowerCase() === 'li')
      .map((li) => {
        index++
        const marker = ordered ? `${index}.` : '-'
        let text = ''
        let nested = ''
        Array.from(li.childNodes).forEach((c) => {
          const t = c.nodeType === Node.ELEMENT_NODE ? (c as HTMLElement).tagName.toLowerCase() : ''
          if (t === 'ul' || t === 'ol') nested += listToMd(c as HTMLElement, depth + 1)
          else text += walk(c, depth + 1)
        })
        return `${'  '.repeat(depth)}${marker} ${text.trim()}\n${nested}`
      })
      .join('') + (depth === 0 ? '\n' : '')
  }
  const walk = (node: Node, depth: number): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/\s+/g, ' ')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const kids = () => Array.from(el.childNodes).map((c) => walk(c, depth)).join('')
    if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${kids().trim()}\n\n`
    switch (tag) {
      case 'p':
      case 'div':
      case 'section':
      case 'article':
        return `${kids().trim()}\n\n`
      case 'br':
        return '\n'
      case 'strong':
      case 'b':
        return `**${kids()}**`
      case 'em':
      case 'i':
        return `*${kids()}*`
      case 's':
      case 'del':
        return `~~${kids()}~~`
      case 'code':
        return `\`${kids()}\``
      case 'pre':
        return `\`\`\`\n${el.textContent || ''}\n\`\`\`\n\n`
      case 'a':
        return `[${kids()}](${el.getAttribute('href') || ''})`
      case 'img':
        return `![${el.getAttribute('alt') || ''}](${el.getAttribute('src') || ''})\n\n`
      case 'hr':
        return '---\n\n'
      case 'blockquote':
        return `${kids().trim().split('\n').map((l) => `> ${l}`).join('\n')}\n\n`
      case 'ul':
      case 'ol':
        return listToMd(el, depth)
      case 'script':
      case 'style':
        return ''
      default:
        return kids()
    }
  }
  return Array.from(root.childNodes)
    .map((c) => walk(c, 0))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'
}

/** 下载当前文档：Word（.doc）/ PDF（打印窗口另存为 PDF）/ Markdown（.md） */
function downloadDoc(doc: DocItem, format: 'word' | 'pdf' | 'md') {
  const title = doc.title || DOC_UNTITLED
  const content = doc.content || ''
  if (format === 'pdf') {
    const win = window.open('', '_blank')
    if (!win) {
      message.warning('浏览器拦截了打印窗口，请允许弹出窗口后重试')
      return
    }
    win.document.title = title
    win.document.head.innerHTML = `<meta charset="utf-8"><style>
      body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif; color: #1f2329; line-height: 1.7; max-width: 800px; margin: 32px auto; padding: 0 24px; }
      img { max-width: 100%; }
      pre { background: #f5f6f7; padding: 12px; border-radius: 6px; white-space: pre-wrap; }
      blockquote { border-left: 3px solid #dee0e3; margin: 0; padding-left: 12px; color: #646a73; }
      @page { margin: 16mm; }
    </style>`
    win.document.body.innerHTML = `<h1>${escapeHtml(title)}</h1>${content}`
    win.focus()
    setTimeout(() => win.print(), 300)
    return
  }
  let body: string
  let mime: string
  let ext: string
  if (format === 'word') {
    body = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${content}</body></html>`
    mime = 'application/msword'
    ext = 'doc'
  } else {
    body = `# ${title}\n\n${htmlToMarkdown(content)}`
    mime = 'text/markdown;charset=utf-8'
    ext = 'md'
  }
  const url = URL.createObjectURL(new Blob([body], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 「文档信息」弹窗：作者 / 创建时间 / 修改时间 */
function showDocInfo(doc: DocItem) {
  const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-')
  Modal.info({
    title: '文档信息',
    okText: '知道了',
    content: h('div', { style: 'line-height: 2' }, [
      h('div', `作者：${doc.author || '-'}`),
      h('div', `创建时间：${fmt(doc.createdAt)}`),
      h('div', `修改时间：${fmt(doc.updatedAt)}`),
    ]),
  })
}

/** 顶栏「更多」菜单的动作，作用于当前打开的文档 */
watch(
  () => docsMoreRequest.value.seq,
  () => {
    const { action, target } = docsMoreRequest.value
    const doc = activeDoc.value
    if (!doc) return
    if (action === 'move' && target) moveDoc(doc, target)
    else if (action === 'star') toggleStar(doc)
    else if (action === 'download') downloadDoc(doc, target === 'pdf' || target === 'md' ? target : 'word')
    else if (action === 'print') window.print()
    else if (action === 'info') showDocInfo(doc)
    else if (action === 'trash') confirmDelete(doc)
  },
)

// 切换到其他文档（列表点开 / 地址变化）时回到只读；编辑中途仅改地址的情况下同样收起编辑
watch(routeDocId, () => {
  docsEditMode.value = false
  docsSuggestMode.value = false
})

// 点「更新」退出编辑时，立即把防抖中的内容落盘，避免退出后丢最后几次修改
watch(docsEditMode, (edit, wasEdit) => {
  if (wasEdit && !edit) {
    clearTimeout(saveTimer)
    void flushSave()
  }
})

// 浏览器前进 / 后退时同步当前文档
watch(
  () => [route.params.docId, route.query.doc],
  () => {
    activeId.value = routeDocId.value
  },
)

/** 置顶文档 / 置顶知识库 */
/** 打开知识库时只置顶该库内的文档，且不再列出其它知识库 */
const pinnedDocs = computed(() =>
  docs.value
    .filter((d) => d.starred && (!activeLibraryId.value || d.libraryId === activeLibraryId.value))
    .sort((a, b) => b.updatedAt - a.updatedAt),
)
const pinnedLibraries = computed(() =>
  activeLibraryId.value ? [] : libraries.value.filter((l) => l.starred),
)

/** 知识库搜索 */
const libraryKeyword = ref('')
/** 左侧「知识库」下方的知识库列表是否展开 */
const libNavOpen = ref(true)
/** 知识库首页视图（卡片 / 列表） */
const libraryView = ref<'grid' | 'list'>('grid')

/** 知识库卡片里展示的最近文档（按修改时间倒序，最多 3 篇） */
function recentDocsOf(libraryId: string): DocItem[] {
  return docs.value
    .filter((d) => d.libraryId === libraryId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)
}
const libraryList = computed(() => {
  const kw = libraryKeyword.value.trim().toLowerCase()
  return kw ? libraries.value.filter((l) => l.name.toLowerCase().includes(kw)) : libraries.value
})

function docsOfLibrary(lib: DocLibrary): number {
  return docs.value.filter((d) => d.libraryId === lib.id).length
}

/** 当前知识库 */
const activeLibrary = computed(() => libraries.value.find((l) => l.id === activeLibraryId.value) || null)
/** 知识库内的文档页：左侧换成知识库自己的菜单 */
const showLibrarySide = computed(() => !!activeLibrary.value && !!activeId.value)

/** 知识库菜单的「新建」：文档 / 文件夹（新建到当前知识库，选中了文件夹则建到该文件夹） */
function onLibraryNewMenu(key: string) {
  if (key === 'doc') createDoc('doc', activeFolderId.value || undefined)
  else if (key === 'folder') openCreateFolder()
}

/** 知识库菜单的目录行：文件夹 + 文档（文件夹折叠时不列出其中的文档，搜索时平铺） */
const librarySideRows = computed<LibSideRow[]>(() => {
  const rows: LibSideRow[] = []
  for (const g of groups.value) {
    if (g.folder) {
      const open = !!expanded[g.folder.id]
      rows.push({ key: `f-${g.folder.id}`, kind: 'folder', depth: g.depth || 0, folder: g.folder, expanded: open })
      if (!open && !g.flat) continue
    }
    const depth = (g.depth || 0) + (g.folder ? 1 : 0)
    for (const d of g.docs) rows.push({ key: `d-${d.id}`, kind: 'doc', depth, doc: d })
  }
  return rows
})

/** 文档「移动到」的目标：移出知识库（个人文档）+ 各文件夹 */
const librarySideMoveTargets = computed(() => [
  { key: 'none', label: '个人文档（移出知识库）' },
  ...folders.value.map((f) => ({ key: f.id, label: folderPathLabel(f) })),
])
/** 顶栏「更多」菜单可选的移动位置：与侧栏「移动到」一致 */
watch(librarySideMoveTargets, (targets) => (docsMoveTargets.value = targets), { immediate: true })

// ---- 文档重命名（知识库菜单） ----
const docRenameOpen = ref(false)
const docRenameForm = reactive({ id: '', title: '' })

function openRenameDoc(doc: DocItem) {
  docRenameForm.id = doc.id
  docRenameForm.title = doc.title || ''
  docRenameOpen.value = true
}

async function submitRenameDoc() {
  const title = docRenameForm.title.trim()
  if (!title) {
    message.warning('请输入文档名称')
    return
  }
  try {
    const res = await renameDocApi({ id: docRenameForm.id, title })
    if (!res.success) return
    const d = docs.value.find((x) => x.id === docRenameForm.id)
    if (d) d.title = title
    docRenameOpen.value = false
  } catch {}
}
/** 当前选中的知识库内文件夹 */
const activeFolder = computed(() => folders.value.find((f) => f.id === activeFolderId.value) || null)

/** 移动菜单中的文件夹显示：「知识库 / 上级文件夹 / 文件夹」 */
function folderPathLabel(folder: DocFolder): string {
  const parts: string[] = [folder.name]
  let cur = folder
  for (let i = 0; i < 10 && cur.parentId; i++) {
    const p = folders.value.find((f) => f.id === cur.parentId)
    if (!p) break
    parts.unshift(p.name)
    cur = p
  }
  const lib = libraries.value.find((l) => l.id === folder.libraryId)
  return [lib?.name || '未命名知识库', ...parts].join(' / ')
}

/** 打开某个知识库：跳转到知识库独立页面（自己的左侧菜单 + 主内容） */
function openLibrary(lib: DocLibrary) {
  activeLibraryId.value = ''
  router.push({ name: 'DocsLibrary', params: { libraryId: lib.id } })
}

/** 列表首页数据：搜索 + 收藏筛选 + 知识库 / 文件夹范围 + 排序 */
const listDocs = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let list = docs.value
  if (navMode.value === 'starred') list = list.filter((d) => d.starred)
  else if (navMode.value === 'shared') list = []
  else if (navMode.value === 'library') list = activeLibraryId.value ? list.filter((d) => d.libraryId === activeLibraryId.value) : []
  else list = list.filter((d) => !d.libraryId)
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

/** 详情页顶栏 / 作者行使用的美式日期，如 Nov 26, 2025 */
function formatLongDate(ts?: number): string {
  return formatUsDate(ts)
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

/** 文档作者展示名：优先创建时写入的本地昵称 / 创建人，邮箱降级为本地名，不展示完整邮箱 */
const docAuthor = computed(() => {
  const metaName = activeDoc.value?.type === 'doc' ? docMeta.value.authorName : ''
  const raw = metaName || activeDoc.value?.author || authUser.value?.realName || getLoginUsername() || ''
  return toDisplayName(raw) || '匿名'
})
/** 创建人头像：优先创建时写入的本地头像 */
const docCreatorAvatar = computed(() => {
  if (activeDoc.value?.type !== 'doc') return activeDoc.value?.authorAvatar || ''
  return docMeta.value.authorAvatar || activeDoc.value?.authorAvatar || ''
})
function clearDocAvatar() {
  const doc = activeDoc.value
  if (!doc) return
  doc.authorAvatar = ''
  if (doc.type === 'doc') {
    const meta: DocMeta = { ...docMeta.value }
    delete meta.authorAvatar
    doc.data = meta
  }
}
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

/** 移动文档：target 为文件夹 id（所属知识库随文件夹走）；'none' 表示移出知识库，变为个人文档 */
async function moveDoc(doc: DocItem, target: string) {
  const folder = target === 'none' ? undefined : folders.value.find((f) => f.id === target)
  if (target !== 'none' && !folder) return
  const libraryId = folder ? folder.libraryId : undefined
  try {
    const res = await moveDocApi({ id: doc.id, libraryId: libraryId || null, folderId: folder?.id || null })
    if (!res.success) return
    doc.libraryId = libraryId
    doc.folderId = folder?.id
    doc.updatedAt = res.data?.updatedAt || doc.updatedAt
    if (folder) expanded[folder.id] = true
  } catch {}
}

function onDocMenu(e: { key?: string | number }, doc: DocItem) {
  const key = String(e?.key ?? '')
  if (key === 'delete' || key === 'trash') confirmDelete(doc)
  else if (key === 'star') toggleStar(doc)
  else if (key === 'rename') openRenameDoc(doc)
  else if (key.startsWith('move:')) moveDoc(doc, key.slice(5))
}

// ---- 文件夹 / 知识库名称弹窗（新建 / 重命名共用） ----
const folderModalOpen = ref(false)
/** kind：library 为知识库，folder 为文件夹；parentId 为新建时的父文件夹（空 = 知识库根目录） */
const folderForm = reactive({ id: '', name: '', kind: 'folder' as 'folder' | 'library' })

/** 在当前知识库内新建文件夹；若已选中某个文件夹，则嵌套到它下面 */
function openCreateFolder() {
  if (!activeLibraryId.value) {
    message.info('请先进入一个知识库再新建文件夹')
    return
  }
  folderForm.id = ''
  folderForm.name = ''
  folderForm.kind = 'folder'
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
  // 先调用创建接口，拿到后端返回的 id 之后才进入该知识库；等待期间显示全局加载
  startGlobalLoading()
  try {
    const res = await createDocLibrary({
      name,
      desc: libraryInfoForm.desc.trim() || undefined,
      visibility: libraryInfoForm.visibility,
    })
    if (!res.success || !res.data) return
    const lib = normalizeLibrary(res.data)
    libraries.value.push(lib)
    libraryInfoOpen.value = false
    // 新建后直接进入该知识库
    openLibrary(lib)
  } finally {
    libraryInfoSubmitting.value = false
    stopGlobalLoading()
  }
}

function onLibraryFeedback() {
  message.info('反馈功能即将上线')
}

function openRenameFolder(folder: DocFolder) {
  folderForm.id = folder.id
  folderForm.name = folder.name
  folderForm.kind = 'folder'
  folderModalOpen.value = true
}

function openRenameLibrary(lib: DocLibrary) {
  folderForm.id = lib.id
  folderForm.name = lib.name
  folderForm.kind = 'library'
  folderModalOpen.value = true
}

function submitFolder() {
  const name = folderForm.name.trim()
  if (!name) {
    message.warning(folderForm.kind === 'library' ? '请输入知识库名称' : '请输入文件夹名称')
    return
  }
  if (folderForm.kind === 'library') {
    updateDocLibrary({ id: folderForm.id, name })
      .then((res) => {
        if (!res.success) return
        const l = libraries.value.find((x) => x.id === folderForm.id)
        if (l) l.name = name
        folderModalOpen.value = false
      })
      .catch(() => {})
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
    if (!activeLibraryId.value) return
    createDocFolder({
      name,
      libraryId: activeLibraryId.value,
      parentId: activeFolderId.value || undefined,
    })
      .then((res) => {
        if (!res.success || !res.data) return
        const folder = normalizeFolder(res.data)
        folders.value.push(folder)
        expanded[folder.id] = true
        if (folder.parentId) expanded[folder.parentId] = true
        activeFolderId.value = folder.id
        folderModalOpen.value = false
      })
      .catch(() => {})
  }
}

/** 知识库置顶 / 取消置顶 */
function toggleStarLibrary(lib: DocLibrary) {
  const next = !lib.starred
  starDocLibrary({ id: lib.id, starred: next })
    .then((res) => {
      if (res.success) lib.starred = next
    })
    .catch(() => {})
}

/** 删除知识库：库内文档保留，移为个人文档（不删除文档） */
function deleteLibrary(lib: DocLibrary) {
  Modal.confirm({
    title: `删除知识库「${lib.name}」`,
    content: '知识库内的文件夹会一并删除，文档会移到个人文档，不会删除文档。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await deleteDocLibrary(lib.id)
        if (!res.success) return
        docs.value.forEach((d) => {
          if (d.libraryId === lib.id) {
            d.libraryId = undefined
            d.folderId = undefined
          }
        })
        folders.value = folders.value.filter((f) => f.libraryId !== lib.id)
        libraries.value = libraries.value.filter((l) => l.id !== lib.id)
        if (activeLibraryId.value === lib.id) activeLibraryId.value = ''
      } catch {}
    },
  })
}

function onLibraryMenu(e: { key?: string | number }, lib: DocLibrary) {
  const key = String(e?.key ?? '')
  if (key === 'star') toggleStarLibrary(lib)
  else if (key === 'rename') openRenameLibrary(lib)
  else if (key === 'delete') deleteLibrary(lib)
}

function deleteFolder(folder: DocFolder) {
  Modal.confirm({
    title: `删除文件夹「${folder.name}」`,
    content: '文件夹内的文档和子文件夹会移到上一级，不会删除文档。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await deleteDocFolder(folder.id)
        if (!res.success) return
        // 文档和子文件夹上移一级（上一级为空则到知识库根目录）；与后端约定一致
        docs.value.forEach((d) => {
          if (d.folderId === folder.id) d.folderId = folder.parentId
        })
        folders.value.forEach((f) => {
          if (f.parentId === folder.id) f.parentId = folder.parentId
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
  () =>
    folders.value.find((f) => f.id === activeFolderId.value)?.name
    || activeLibrary.value?.name
    || '我的文档库',
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
  { key: 'file', label: '文件', icon: UploadOutlined },
  { key: 'folder', label: '文件夹', icon: FolderFilled },
]
const TEMPLATE_ITEMS = [
  { key: 'meeting', label: '会议纪要', icon: ScheduleOutlined },
  { key: 'weekly', label: '周报', icon: FileDoneOutlined },
  { key: 'prd', label: '产品需求文档', icon: SnippetsOutlined },
]
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
      // 打开文档后按事项最新数据刷新卡片
      void refreshIssueCards()
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
const CODE_INJECTED_SELECTOR = '.docs-code-head, .docs-code-highlight, .docs-suggest-bar'
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
  // <br> 占位产生的末尾换行不额外算一行（空代码块只显示一个行号）；
  // 真正的空行需要两个换行才会出现
  const src = code.endsWith('\n') ? code.slice(0, -1) : code
  const tokens = lang === 'html' || lang === 'xml' ? tokenizeMarkup(src) : tokenizeCode(src, lang)
  // 按行切成块，配合 CSS 计数器给每行生成行号
  const lines: CodeToken[][] = [[]]
  for (const token of tokens) {
    const parts = token.text.split('\n')
    parts.forEach((part, index) => {
      if (index > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ cls: token.cls, text: part })
    })
  }
  return lines
    .map((line) => {
      const inner = line
        .map((t) => (t.cls ? `<span class="${t.cls}">${escapeHtml(t.text)}</span>` : escapeHtml(t.text)))
        .join('')
      return `<div class="docs-code-line">${inner}</div>`
    })
    .join('')
}

/** 绘制彩色代码层（同时负责行号；纯文本显示为无色行号） */
function renderCodeHighlight(pre: HTMLElement) {
  const lang = pre.dataset.lang || 'text'
  const existed = pre.querySelector<HTMLElement>(':scope > .docs-code-highlight')
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
    `<path d="M6 2.5c-1.4 0-2 .6-2 2v1.6c0 .9-.5 1.4-1.5 1.9.9.5 1.5 1 1.5 1.9v1.6c0 1.4.6 2 2 2M10 2.5c1.4 0 2 .6 2 2v1.6c0 .9.5 1.4 1.5 1.9-.9.5-1.5 1-1.5 1.9v1.6c0 1.4-.6 2-2 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>` +
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
  ensureTrailingParagraph(editor)
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

/** 文末是代码块时补一个空段落：否则代码块下面没有地方继续输入 / 新增内容 */
function ensureTrailingParagraph(editor: HTMLElement) {
  if (editor.lastElementChild?.tagName !== 'PRE') return
  const p = document.createElement('p')
  p.innerHTML = '<br>'
  editor.appendChild(p)
}

/**
 * 代码块内连按两次回车（光标在空行末尾）：删掉多余的换行，跳出代码块，
 * 在代码块下方新建一个正文段落并把光标放进去。
 */
function exitCodeBlockOnEnter(editor: HTMLElement | null): boolean {
  if (!editor) return false
  const sel = window.getSelection()
  if (!sel || !sel.isCollapsed || !sel.anchorNode || sel.anchorNode.nodeType !== Node.TEXT_NODE) return false
  const pre = caretCodeBlock()
  if (!pre || !editor.contains(pre)) return false
  // 统计光标前后的代码正文（跳过语言栏与彩色层）
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('.docs-code-head, .docs-code-highlight') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  })
  let before = ''
  let after = ''
  let reached = false
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = n as Text
    if (t === sel.anchorNode) {
      before += t.data.slice(0, sel.anchorOffset)
      after += t.data.slice(sel.anchorOffset)
      reached = true
    } else if (reached) after += t.data
    else before += t.data
  }
  if (!reached || !before.endsWith('\n') || after.trim() !== '') return false
  // 删掉回车产生的那个换行（光标在该文本节点内，delete 删除前一个字符）
  document.execCommand('delete')
  const p = document.createElement('p')
  p.innerHTML = '<br>'
  pre.after(p)
  const caret = document.createRange()
  caret.setStart(p, 0)
  caret.collapse(true)
  sel.removeAllRanges()
  sel.addRange(caret)
  return true
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
  const hasRuntime =
    editor.querySelector(CODE_INJECTED_SELECTOR) ||
    editor.querySelector('pre.is-composing') ||
    editor.querySelector('.is-handle-hover') ||
    editor.querySelector('.docs-cell-active') ||
    editor.querySelector('.docs-row-selected, .docs-col-selected') ||
    editor.querySelector('.is-resize-hover, .is-resizing') ||
    editor.querySelector('.docs-suggest-ins')
  if (!hasRuntime) return editor.innerHTML
  const clone = editor.cloneNode(true) as HTMLElement
  clone.querySelectorAll(CODE_INJECTED_SELECTOR).forEach((h) => h.remove())
  // 分栏拖拽线 / 拖拽态是运行时状态，不写进文档
  clone.querySelectorAll('.is-resize-hover, .is-resizing').forEach((el) => {
    el.classList.remove('is-resize-hover', 'is-resizing')
    ;(el as HTMLElement).style.removeProperty('--resize-x')
  })
  // 修订底色是运行时标记（修订条已在上面按 CODE_INJECTED_SELECTOR 移除）
  clone.querySelectorAll('.docs-suggest-ins').forEach((el) => el.classList.remove('docs-suggest-ins'))
  // 手柄悬停高亮 / 表格当前格描边 / 行列选中底色是运行时类名，不写进文档
  clone.querySelectorAll('.is-handle-hover').forEach((el) => el.classList.remove('is-handle-hover'))
  clone.querySelectorAll('.docs-cell-active').forEach((el) => el.classList.remove('docs-cell-active'))
  clone.querySelectorAll('.docs-row-selected, .docs-col-selected').forEach((el) => {
    el.classList.remove('docs-row-selected', 'docs-col-selected')
  })
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
  scheduleSuggestRefresh()
}

/* ---- 修订：以"修订基准"（最后一次接受后的正文）比对当前正文，逐段接受 / 拒绝 ---- */
/** 一处待处理修订：基准 [bStart, bEnd) 被当前正文 [cStart, cEnd) 替换（按顶层块计） */
interface SuggestHunk {
  bStart: number
  bEnd: number
  cStart: number
  cEnd: number
}
let suggestHunks: SuggestHunk[] = []
const suggestCount = ref(0)
let suggestTimer: ReturnType<typeof setTimeout> | undefined

/** HTML 拆成顶层元素：每个元素是一个比对单位（块） */
function blocksOfHtml(html: string): string[] {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  return Array.from(tpl.content.children).map((el) => el.outerHTML)
}

/** 块的纯文字（用于删除段落的预览） */
function textOfBlock(html: string): string {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  return (tpl.content.textContent || '').replace(/\s+/g, ' ').trim()
}

/** 基准 a → 当前 b 的最长公共子序列比对，返回连续的差异段 */
function diffBlocks(a: string[], b: string[]): SuggestHunk[] {
  const n = a.length
  const m = b.length
  // dp[i][j]：a[i..] 与 b[j..] 的最长公共子序列长度
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: SuggestHunk[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      i++
      j++
      continue
    }
    const h: SuggestHunk = { bStart: i, cStart: j, bEnd: i, cEnd: j }
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) break
      if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) i++
      else j++
    }
    h.bEnd = i
    h.cEnd = j
    out.push(h)
  }
  return out
}

function suggestBaseOf(doc: DocItem): string | undefined {
  return (doc.data as DocMeta | undefined)?.suggestBase
}

/** 写入修订基准（随文档 data 保存） */
function setSuggestBase(doc: DocItem, html: string) {
  doc.data = { ...((doc.data as DocMeta | undefined) ?? {}), suggestBase: html } as DocItem['data']
  scheduleSave()
}

/** 当前正文的顶层块（与基准同一套序列化，保证可以逐块比对） */
function currentBlocks(editor: HTMLElement): string[] {
  return blocksOfHtml(editorContentHtml(editor))
}

function clearSuggestMarks(editor: HTMLElement) {
  editor.querySelectorAll('.docs-suggest-bar').forEach((el) => el.remove())
  editor.querySelectorAll('.docs-suggest-ins').forEach((el) => el.classList.remove('docs-suggest-ins'))
}

/** 修订条：标明这段修订的类型与内容预览，提供接受 / 拒绝 */
function buildSuggestBar(idx: number, h: SuggestHunk, baseBlocks: string[]): HTMLElement {
  const added = h.cEnd - h.cStart
  const removed = h.bEnd - h.bStart
  const bar = document.createElement('div')
  bar.className = 'docs-suggest-bar'
  bar.contentEditable = 'false'
  const label = document.createElement('span')
  label.className = 'docs-suggest-label'
  if (added === 0) {
    const preview = textOfBlock(baseBlocks[h.bStart] ?? '')
    label.textContent = `删除 ${removed} 段${preview ? `：${preview.slice(0, 30)}` : ''}`
  } else if (removed === 0) {
    label.textContent = `新增 ${added} 段`
  } else {
    label.textContent = `修改 ${added} 段（原 ${removed} 段）`
  }
  bar.appendChild(label)
  for (const [act, text] of [
    ['reject', '拒绝'],
    ['accept', '接受'],
  ] as const) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `docs-suggest-btn${act === 'accept' ? ' is-primary' : ''}`
    btn.dataset.act = act
    btn.dataset.idx = String(idx)
    btn.textContent = text
    bar.appendChild(btn)
  }
  return bar
}

/** 按基准与当前正文重新标出修订（只在修订模式下有标记） */
function refreshSuggestMarks() {
  const editor = editorRef.value
  const doc = activeDoc.value
  if (!editor) return
  clearSuggestMarks(editor)
  suggestHunks = []
  suggestCount.value = 0
  if (!docsSuggestMode.value || !doc || doc.type !== 'doc') return
  const base = suggestBaseOf(doc)
  if (base === undefined) return
  const baseBlocks = blocksOfHtml(base)
  suggestHunks = diffBlocks(baseBlocks, currentBlocks(editor))
  suggestCount.value = suggestHunks.length
  const kids = Array.from(editor.children)
  suggestHunks.forEach((h, idx) => {
    for (let k = h.cStart; k < h.cEnd; k++) kids[k]?.classList.add('docs-suggest-ins')
    // 修订条放在这段修订的第一个块之前（删除段则放在后面一个块之前）
    editor.insertBefore(buildSuggestBar(idx, h, baseBlocks), kids[h.cStart] ?? null)
  })
}

function scheduleSuggestRefresh() {
  if (!docsSuggestMode.value) return
  clearTimeout(suggestTimer)
  suggestTimer = setTimeout(refreshSuggestMarks, 300)
}

/** 用新的正文替换编辑器内容，并落盘 */
function applyEditorHtml(editor: HTMLElement, doc: DocItem, html: string) {
  clearSuggestMarks(editor)
  editor.innerHTML = html
  onEditorChange(editor, doc)
  refreshSuggestMarks()
}

/** 接受一处修订：基准采用当前这段内容 */
function acceptSuggest(idx: number) {
  const doc = activeDoc.value
  const editor = editorRef.value
  const h = suggestHunks[idx]
  if (!doc || !editor || !h) return
  const base = blocksOfHtml(suggestBaseOf(doc) ?? '')
  const cur = currentBlocks(editor)
  setSuggestBase(doc, [...base.slice(0, h.bStart), ...cur.slice(h.cStart, h.cEnd), ...base.slice(h.bEnd)].join(''))
  refreshSuggestMarks()
}

/** 拒绝一处修订：正文中这段恢复为基准内容 */
function rejectSuggest(idx: number) {
  const doc = activeDoc.value
  const editor = editorRef.value
  const h = suggestHunks[idx]
  if (!doc || !editor || !h) return
  const base = blocksOfHtml(suggestBaseOf(doc) ?? '')
  const cur = currentBlocks(editor)
  applyEditorHtml(editor, doc, [...cur.slice(0, h.cStart), ...base.slice(h.bStart, h.bEnd), ...cur.slice(h.cEnd)].join(''))
}

function acceptAllSuggest() {
  const doc = activeDoc.value
  const editor = editorRef.value
  if (!doc || !editor) return
  setSuggestBase(doc, currentBlocks(editor).join(''))
  refreshSuggestMarks()
}

function rejectAllSuggest() {
  const doc = activeDoc.value
  const editor = editorRef.value
  if (!doc || !editor) return
  applyEditorHtml(editor, doc, suggestBaseOf(doc) ?? '')
}

// 进入修订模式：首次进入时以当前正文作为修订基准；之后的改动都会与基准比对
watch(docsSuggestMode, (on) => {
  const doc = activeDoc.value
  const editor = editorRef.value
  if (on && doc && doc.type === 'doc' && editor && suggestBaseOf(doc) === undefined) {
    setSuggestBase(doc, editorContentHtml(editor))
  }
  refreshSuggestMarks()
})

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
  p: 'T',
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  ul: '•',
  ol: '1.',
  todo: '☑',
  quote: '❝',
  pre: '{}',
  table: '▦',
  columns: '栏',
  img: '图',
  attach: '附件',
  hr: '—',
}
const hoverBlockLabel = computed(() => BLOCK_HANDLE_LABEL[hoverBlockType.value] || '')
/** 块手柄 / 折叠三角的高度（px），与样式里的 28px 一致 */
const HANDLE_SIZE = 28
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
/** 空行展示 "+" 插入；有内容的行展示块手柄（编辑 / 拖拽），不再展示加号 */
const plusMode = computed<'plus' | 'block'>(() =>
  hoverBlockType.value === 'p' && !hoverBlockHasContent.value ? 'plus' : 'block',
)

/** 判断块级元素属于哪种富文本类型 */
/** 判断块里是否内嵌了富文本组件（附件 / 图片 / 表格等） */
function richInlineKind(el: HTMLElement): string {
  if (el.classList.contains('docs-attach')) return 'attach'
  if (el.querySelector('.docs-attach')) return 'attach'
  if (el.querySelector('img')) return 'img'
  if (el.querySelector('table')) return 'table'
  if (el.querySelector('.docs-todo')) return 'todo'
  if (el.querySelector('.docs-callout')) return 'callout'
  if (el.querySelector('.docs-cols')) return 'columns'
  if (el.querySelector('hr')) return 'hr'
  if (el.querySelector('pre')) return 'pre'
  return ''
}

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
  // 段落 / 行内容里内嵌了富文本组件：展示块手柄（编辑），不再展示 "+"
  if (tag === 'P' || tag === 'SPAN') {
    const kind = richInlineKind(el)
    if (kind) return kind
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
  { key: 'pre', title: '代码块', glyph: '{}' },
  { key: 'quote', title: '引用', glyph: '❝' },
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
  { key: 'pre', title: '代码块', glyph: '{}' },
  { key: 'quote', title: '引用', glyph: '❝' },
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
      { key: 'columns:4', label: '四栏' },
      { key: 'columns:5', label: '五栏' },
    ],
  },
  { key: 'callout', label: '高亮块', icon: BgColorsOutlined, color: 'var(--docs-type-flow)' },
]
/** 当前展开的二级菜单 */
const activeInsertSub = ref('')
/** 表格插入尺寸选择：悬停网格高亮 */
const tablePickerHover = reactive({ rows: 0, cols: 0 })
/** 分栏栏数选择：图形化缩略图（每个缩略图的竖条数 = 栏数），悬停高亮 */
const colsPickerOptions = [2, 3, 4, 5]
const colsPickerHover = ref(0)
/** 图片 / 文件选择框 */
const imageInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function onEditorHover(e: MouseEvent) {
  const editor = editorRef.value
  if (!editor) return
  cancelPlusHide()
  const target = e.target as HTMLElement
  if (!editor.contains(target)) {
    tableEdgeHovered = false
    // 延迟收起：给鼠标移到外侧 + 的准确位置留出时间
    scheduleTableEdgeHide()
    return
  }
  // 表格：悬停单元格时显示灰色边条 / 行列圆点 / 角上的 + 按钮
  const cell = target.closest('td, th') as HTMLTableCellElement | null
  const table = cell?.closest('table.docs-insert-table') as HTMLTableElement | null
  if (cell && table) {
    tableEdgeHovered = true
    updateTableEdge(cell, table)
  } else {
    tableEdgeHovered = false
    if (!tableEdgeSelected) hideTableEdge()
  }
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
  // 手柄高 24px：普通文本块与首行垂直居中；高亮块 / 任务等有上下内边距的组件，
  // 手柄顶部直接与组件顶部对齐
  const cs = getComputedStyle(block)
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || HANDLE_SIZE
  const padTop = parseFloat(cs.paddingTop) || 0
  plusTop.value =
    padTop > 0 ? block.offsetTop : block.offsetTop + Math.max(0, Math.round((lineHeight - HANDLE_SIZE) / 2))
  plusVisible.value = true
}

/** 延迟收起块手柄：给鼠标从正文移到左侧手柄留出时间，避免手柄闪一下就消失 */
let plusHideTimer: number | undefined
function cancelPlusHide() {
  if (plusHideTimer) {
    window.clearTimeout(plusHideTimer)
    plusHideTimer = undefined
  }
}
function schedulePlusHide() {
  cancelPlusHide()
  plusHideTimer = window.setTimeout(() => {
    plusHideTimer = undefined
    if (!plusMenuOpen.value) plusVisible.value = false
  }, 200)
}

function onEditorLeave(e: MouseEvent) {
  clearColsHover()
  const rt = e.relatedTarget as HTMLElement | null
  // 仍在编辑器容器内（例如移向行右侧的评论图标）：不隐藏
  if (rt && (e.currentTarget as HTMLElement).contains(rt)) return
  // 移向加号按钮或插入菜单时不隐藏，否则加号永远点不到
  if (rt && plusBtnRef.value?.contains(rt)) return
  if (rt && rt.closest?.('.ant-dropdown')) return
  if (!plusMenuOpen.value) schedulePlusHide()
  // 鼠标可能移向表格左侧的快捷 +，延迟收起；光标仍在表格里时保持显示
  tableEdgeHovered = false
  scheduleTableEdgeHide()
}
watch(plusMenuOpen, (open) => {
  if (!open) {
    plusVisible.value = false
    activeInsertSub.value = ''
    setHandleHover(null)
  }
})

// ---- 块手柄悬停高亮：只有鼠标停在左侧手柄上时才给该块加行背景 ----
let handleHoverEl: HTMLElement | null = null

function setHandleHover(block: HTMLElement | null) {
  if (handleHoverEl && handleHoverEl !== block) handleHoverEl.classList.remove('is-handle-hover')
  handleHoverEl = block
  block?.classList.add('is-handle-hover')
}

function onHandleEnter() {
  cancelPlusHide()
  // 鼠标已经到手柄上，保持手柄可见
  plusVisible.value = true
  const block = hoverBlock.value
  if (block && block !== editorRef.value) setHandleHover(block)
}

function onHandleLeave() {
  if (plusMenuOpen.value) return
  setHandleHover(null)
}

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
  const rows = Math.max(1, Math.min(rowCount, 20))
  const cols = Math.max(1, Math.min(colCount, 12))
  const cell = '<td><br></td>'
  const row = `<tr>${cell.repeat(cols)}</tr>`
  const tpl = document.createElement('template')
  tpl.innerHTML = `<table class="docs-insert-table docs-table-header"><tbody>${row.repeat(rows)}</tbody></table><p><br></p>`
  const table = tpl.content.firstElementChild as HTMLTableElement
  const sel = window.getSelection()
  const range =
    sel && sel.rangeCount > 0 && sel.anchorNode && editor.contains(sel.anchorNode) ? sel.getRangeAt(0) : null
  if (range) {
    range.deleteContents()
    range.insertNode(tpl.content)
  } else {
    editor.appendChild(tpl.content)
  }
  // 光标放进第一个单元格，直接开始输入
  focusTableCell(table.rows[0]?.cells[0] || null)
}

// ---- 表格工具条（参考飞书：光标在表格里时出现） ----
const tableTool = reactive({
  visible: false,
  top: 0,
  left: 0,
  header: false,
  /** 对齐 / 高亮颜色下拉菜单与当前单元格对齐状态 */
  alignOpen: false,
  colorOpen: false,
  /** 文字颜色 / 单元格背景色下拉菜单 */
  fontColorOpen: false,
  cellBgOpen: false,
  hAlign: 'left',
  vAlign: 'top',
})
const tableToolRef = ref<HTMLElement | null>(null)
let tableToolEl: HTMLTableElement | null = null
let tableActiveCell: HTMLElement | null = null
// ---- 表格行 / 列快捷插入（悬停单元格时出现，参考飞书边缘的 + 按钮） ----
const tableEdge = reactive({
  visible: false,
  /** 左下角 +：添加一行（底部蓝线指示插入位置） */
  rowPlusTop: 0,
  rowPlusLeft: 0,
  rowLineTop: 0,
  rowLineLeft: 0,
  rowLineWidth: 0,
  /** 右上角 +：添加一列 */
  colPlusTop: 0,
  colPlusLeft: 0,
  /** 当前悬停的行 / 列索引（决定 + 出现在哪一行 / 哪一列） */
  hoverRow: -1,
  hoverCol: -1,
  /** 表格外侧的浅灰边条与行列圆点 */
  frameTop: 0,
  frameLeft: 0,
  frameWidth: 0,
  frameHeight: 0,
  /** 每行 / 每列的位置，用于边条上的悬停与选中 */
  rows: [] as { top: number; height: number }[],
  cols: [] as { left: number; width: number }[],
})
const tableFrameHover = reactive({ row: -1, col: -1 })
const tableFrameSelected = reactive({ row: -1, col: -1 })
let tableEdgeTable: HTMLTableElement | null = null
let tableEdgeRow: HTMLTableRowElement | null = null
let tableEdgeTimer: number | undefined
/** 鼠标是否在表格上 / 光标是否选中了表格（任一条件成立就展示灰色边条） */
let tableEdgeHovered = false
let tableEdgeSelected: HTMLTableElement | null = null
/** 鼠标是否停在角上的 + 按钮上（避免延迟收起时清掉表格引用） */
let tableEdgeButtonHovered = false

function cancelTableEdgeHide() {
  if (tableEdgeTimer) {
    window.clearTimeout(tableEdgeTimer)
    tableEdgeTimer = undefined
  }
}

function scheduleTableEdgeHide() {
  cancelTableEdgeHide()
  tableEdgeTimer = window.setTimeout(() => {
    tableEdgeTimer = undefined
    if (tableEdgeHovered || tableEdgeButtonHovered) return
    // 表格仍处于选中状态：保留灰色边条，只收起悬停出现的 + 按钮
    if (tableEdgeSelected && tableEdgeSelected === tableEdgeTable) {
      tableEdge.hoverRow = -1
      tableEdge.hoverCol = -1
      return
    }
    hideTableEdge()
  }, 200)
}

/** 角上 + 的悬停：保持表格引用，保证点击能拿到目标表格 */
function onEdgePlusEnter() {
  tableEdgeButtonHovered = true
  cancelTableEdgeHide()
}

function onEdgePlusLeave() {
  tableEdgeButtonHovered = false
  scheduleTableEdgeHide()
}

function hideTableEdge() {
  cancelTableEdgeHide()
  tableEdgeButtonHovered = false
  tableEdge.visible = false
  tableEdgeTable = null
  tableEdgeRow = null
  tableEdge.hoverRow = -1
  tableEdge.hoverCol = -1
  tableFrameHover.row = -1
  tableFrameHover.col = -1
  tableFrameSelected.row = -1
  tableFrameSelected.col = -1
  clearTableFrameSelectionClasses()
}

/** 清掉行 / 列选中的单元格底色（运行时类名） */
function clearTableFrameSelectionClasses() {
  editorRef.value?.querySelectorAll('.docs-row-selected, .docs-col-selected').forEach((el) => {
    el.classList.remove('docs-row-selected', 'docs-col-selected')
  })
}

/** 给整行 / 整列加遮罩底色（写在单元格上，文字颜色不受影响） */
function applyTableFrameSelection(kind: 'row' | 'col', index: number) {
  const table = tableEdgeTable
  if (!table) return
  clearTableFrameSelectionClasses()
  if (kind === 'row') {
    table.rows[index]?.classList.add('docs-row-selected')
  } else {
    Array.from(table.rows).forEach((tr) => tr.cells[index]?.classList.add('docs-col-selected'))
  }
  tableFrameSelected.row = kind === 'row' ? index : -1
  tableFrameSelected.col = kind === 'col' ? index : -1
}

/** 行 / 列选中时的代表单元格（工具栏操作使用） */
function frameSelectedCell(): HTMLTableCellElement | null {
  const table = tableEdgeTable
  if (!table) return null
  if (tableFrameSelected.row >= 0) {
    return (table.rows[tableFrameSelected.row]?.cells[0] as HTMLTableCellElement) || null
  }
  if (tableFrameSelected.col >= 0) {
    return (table.rows[0]?.cells[tableFrameSelected.col] as HTMLTableCellElement) || null
  }
  return null
}

/** 悬停 / 离开表格外侧的行列把手（只做行列高亮，不直接显示 +） */
function onFrameHover(kind: 'row' | 'col', index: number) {
  cancelTableEdgeHide()
  if (kind === 'row') tableFrameHover.row = index
  else tableFrameHover.col = index
}

/** 只有鼠标移动到 + 的准确位置附近，才展示加号 */
function onDocMouseMove(e: MouseEvent) {
  if (!tableEdge.visible || !tableEdgeTable || !docsEditMode.value) return
  const x = e.clientX
  const y = e.clientY
  let row = -1
  let col = -1
  for (let i = 0; i < tableEdge.rows.length; i++) {
    const r = tableEdge.rows[i]
    if (Math.abs(x - (tableEdge.frameLeft - 33)) <= 18 && Math.abs(y - (r.top + r.height)) <= 18) {
      row = i
      break
    }
  }
  for (let i = 0; i < tableEdge.cols.length; i++) {
    const c = tableEdge.cols[i]
    if (Math.abs(x - (c.left + c.width)) <= 18 && Math.abs(y - (tableEdge.frameTop - 17)) <= 18) {
      col = i
      break
    }
  }
  if (row !== tableEdge.hoverRow) {
    tableEdge.hoverRow = row
    if (row >= 0) {
      const r = tableEdge.rows[row]
      tableEdge.rowPlusTop = Math.max(8, Math.min(window.innerHeight - 34, r.top + r.height - 13))
      tableEdge.rowPlusLeft = Math.max(8, tableEdge.frameLeft - 46)
      tableEdge.rowLineTop = r.top + r.height - 1
      tableEdge.rowLineLeft = tableEdge.frameLeft
      tableEdge.rowLineWidth = tableEdge.frameWidth
    }
  }
  if (col !== tableEdge.hoverCol) {
    tableEdge.hoverCol = col
    if (col >= 0) {
      const c = tableEdge.cols[col]
      tableEdge.colPlusLeft = Math.max(8, Math.min(window.innerWidth - 34, c.left + c.width - 13))
      tableEdge.colPlusTop = Math.max(8, tableEdge.frameTop - 30)
    }
  }
  if (row >= 0 || col >= 0) cancelTableEdgeHide()
}

function onFrameLeave(kind: 'row' | 'col') {
  if (kind === 'row') tableFrameHover.row = -1
  else tableFrameHover.col = -1
  scheduleTableEdgeHide()
}

/** 点击左侧 / 右侧边条：选中整行（只加遮罩底色，不选中文字） */
function selectTableRow(index: number) {
  const table = tableEdgeTable
  if (!table?.rows[index]) return
  applyTableFrameSelection('row', index)
  cancelTableEdgeHide()
  nextTick(updateTableTool)
}

/** 点击顶部边条：选中整列（只加遮罩底色，不选中文字） */
function selectTableColumn(index: number) {
  if (!tableEdgeTable) return
  applyTableFrameSelection('col', index)
  cancelTableEdgeHide()
  nextTick(updateTableTool)
}

/** 鼠标在单元格上时更新行/列插入按钮的位置 */
function updateTableEdge(cell: HTMLTableCellElement, table: HTMLTableElement) {
  if (!docsEditMode.value) {
    hideTableEdge()
    return
  }
  const row = cell.parentElement as HTMLTableRowElement | null
  if (!row) return
  cancelTableEdgeHide()
  tableEdgeTable = table
  tableEdgeRow = row
  const tableRect = table.getBoundingClientRect()
  // 表格外侧的浅灰边条 + 行列圆点
  tableEdge.frameTop = tableRect.top
  tableEdge.frameLeft = tableRect.left
  tableEdge.frameWidth = tableRect.width
  tableEdge.frameHeight = tableRect.height
  tableEdge.rows = Array.from(table.rows).map((tr) => {
    const r = tr.getBoundingClientRect()
    return { top: r.top, height: r.height }
  })
  const firstRow = table.rows[0]
  tableEdge.cols = firstRow
    ? Array.from(firstRow.cells).map((td) => {
        const r = td.getBoundingClientRect()
        return { left: r.left, width: r.width }
      })
    : []
  tableFrameHover.row = -1
  tableFrameHover.col = -1
  tableEdge.visible = true
}

/** 行左下角 +：在当前行下方插入一行 */
function appendRowAtEdge() {
  const table = tableEdgeTable
  if (!table) return
  const row = table.rows[tableEdge.hoverRow] || table.rows[table.rows.length - 1]
  const colCount = row?.cells.length || 1
  const tr = document.createElement('tr')
  for (let i = 0; i < colCount; i++) {
    const td = document.createElement('td')
    td.innerHTML = '<br>'
    tr.appendChild(td)
  }
  if (row) row.after(tr)
  else (table.tBodies[0] || table).appendChild(tr)
  hideTableEdge()
  focusTableCell(tr.cells[0] || null)
  onEditorInput()
  nextTick(updateTableTool)
}

/** 列右上角 +：在当前列右侧插入一列 */
function appendColumnAtEdge() {
  const table = tableEdgeTable
  if (!table) return
  const index = tableEdge.hoverCol >= 0 ? tableEdge.hoverCol + 1 : (table.rows[0]?.cells.length || 0)
  Array.from(table.rows).forEach((tr) => {
    const td = document.createElement('td')
    td.innerHTML = '<br>'
    tr.insertBefore(td, tr.cells[index] || null)
  })
  const row = tableEdgeRow || table.rows[0]
  hideTableEdge()
  focusTableCell(row?.cells[index] || null)
  onEditorInput()
  nextTick(updateTableTool)
}

/** 行 / 列高亮覆盖层的定位 */
function tableFrameRowStyle(index: number) {
  const row = tableEdge.rows[index]
  if (!row) return {}
  return {
    top: `${row.top}px`,
    left: `${tableEdge.frameLeft}px`,
    width: `${tableEdge.frameWidth}px`,
    height: `${row.height}px`,
  }
}
function tableFrameColStyle(index: number) {
  const col = tableEdge.cols[index]
  if (!col) return {}
  return {
    top: `${tableEdge.frameTop}px`,
    left: `${col.left}px`,
    width: `${col.width}px`,
    height: `${tableEdge.frameHeight}px`,
  }
}

/** 删除按钮提示：选中列 → 删除列；选中行 → 删除行；否则删除整表 */
const tableDeleteTip = computed(() =>
  tableFrameSelected.col >= 0 ? '删除列' : tableFrameSelected.row >= 0 ? '删除行' : '删除表格',
)

/** 删除按钮：按当前选中范围删除列 / 行 / 整表 */
function deleteTableOrSelection() {
  const table = tableToolEl || tableEdgeTable
  if (!table) return
  const rows = Array.from(table.rows)
  if (tableFrameSelected.col >= 0) {
    const index = tableFrameSelected.col
    if ((rows[0]?.cells.length || 0) <= 1) {
      removeTable(table)
      return
    }
    rows.forEach((tr) => tr.cells[index]?.remove())
    tableFrameSelected.col = -1
    clearTableFrameSelectionClasses()
    const nextRow = rows[0]
    focusTableCell((nextRow?.cells[Math.min(index, (nextRow?.cells.length || 1) - 1)] as HTMLTableCellElement) || null)
  } else if (tableFrameSelected.row >= 0) {
    const index = tableFrameSelected.row
    if (rows.length <= 1) {
      removeTable(table)
      return
    }
    rows[index]?.remove()
    tableFrameSelected.row = -1
    clearTableFrameSelectionClasses()
    const nextRow = table.rows[Math.min(index, table.rows.length - 1)]
    focusTableCell((nextRow?.cells[0] as HTMLTableCellElement) || null)
  } else {
    removeTable(table)
    return
  }
  onEditorInput()
  nextTick(updateTableTool)
}

/** 对齐按钮图标跟随当前单元格的水平对齐 */
const tableAlignIcon = computed(() =>
  tableTool.hAlign === 'center'
    ? AlignCenterOutlined
    : tableTool.hAlign === 'right'
      ? AlignRightOutlined
      : AlignLeftOutlined,
)

/** 把光标放进单元格开头 */
function focusTableCell(cell: HTMLTableCellElement | null) {
  if (!cell) return
  editorRef.value?.focus()
  const range = document.createRange()
  range.selectNodeContents(cell)
  range.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function clearTableActiveCell() {
  tableActiveCell?.classList.remove('docs-cell-active')
  tableActiveCell = null
}

function hideTableTool() {
  tableTool.visible = false
  tableTool.alignOpen = false
  tableTool.colorOpen = false
  tableToolEl = null
  clearTableActiveCell()
}

/** 文字格式工具条的目标单元格：整行 / 整列 / 当前单元格 */
function tableFormatCells(): HTMLTableCellElement[] {
  const table = tableToolEl || tableEdgeTable
  if (!table) return []
  const cells: HTMLTableCellElement[] = []
  if (tableFrameSelected.row >= 0) {
    const row = table.rows[tableFrameSelected.row]
    if (row) cells.push(...Array.from(row.cells))
  } else if (tableFrameSelected.col >= 0) {
    Array.from(table.rows).forEach((tr) => {
      const td = tr.cells[tableFrameSelected.col] as HTMLTableCellElement | undefined
      if (td) cells.push(td)
    })
  } else {
    const cell = currentTableCell()
    if (cell) cells.push(cell)
  }
  return cells
}

/** 对单元格文字应用格式（加粗 / 删除线 / 斜体 / 下划线 / 行内代码 / 高亮） */
function applyTableCellFormat(cmd: string, value?: string) {
  const cells = tableFormatCells()
  if (!cells.length) return
  const editor = editorRef.value
  editor?.focus()
  const sel = window.getSelection()
  cells.forEach((cell) => {
    // 单元格背景色：直接写在单元格上，不动文字
    if (cmd === 'cellBg') {
      cell.style.backgroundColor = value || ''
      if (!cell.getAttribute('style')) cell.removeAttribute('style')
      return
    }
    const range = document.createRange()
    range.selectNodeContents(cell)
    sel?.removeAllRanges()
    sel?.addRange(range)
    if (cmd === 'textColor') {
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('foreColor', false, value || textColors[0])
    } else if (cmd === 'inline-code') {
      document.execCommand('insertHTML', false, `<code>${escapeHtml(cell.textContent || '')}</code>`)
    } else if (cmd === 'hilite') {
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('hiliteColor', false, value || bubbleColors[0])
    } else if (cmd === 'unhighlight') {
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('hiliteColor', false, 'transparent')
    } else {
      document.execCommand(cmd)
    }
  })
  // 清掉文本选区：整行/整列保持遮罩，单格把光标放回格尾
  sel?.removeAllRanges()
  if (tableFrameSelected.row < 0 && tableFrameSelected.col < 0 && cells.length === 1) {
    const range = document.createRange()
    range.selectNodeContents(cells[0])
    range.collapse(false)
    sel?.addRange(range)
  }
  tableTool.colorOpen = false
  tableTool.fontColorOpen = false
  tableTool.cellBgOpen = false
  onEditorInput()
  nextTick(updateTableTool)
}

/** 表格工具条下拉菜单：同一时间只开一个 */
function toggleTableMenu(key: 'fontColorOpen' | 'cellBgOpen') {
  const open = !tableTool[key]
  tableTool.colorOpen = false
  tableTool.alignOpen = false
  tableTool.fontColorOpen = false
  tableTool.cellBgOpen = false
  tableTool[key] = open
}

function currentTableCell(): HTMLTableCellElement | null {
  const node = window.getSelection()?.anchorNode
  if (!node) return null
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  return el?.closest<HTMLTableCellElement>('td, th') ?? null
}

/** 光标在表格里时更新工具条位置与当前单元格描边 */
function updateTableTool() {
  const editor = editorRef.value
  if (!editor || !docsEditMode.value) {
    tableEdgeSelected = null
    hideTableTool()
    return
  }
  let cell = currentTableCell()
  let table = cell?.closest('table.docs-insert-table') as HTMLTableElement | null
  // 通过灰色边条选中整行 / 整列时，用代表单元格维持工具条
  if ((!cell || !table) && tableEdgeTable && (tableFrameSelected.row >= 0 || tableFrameSelected.col >= 0)) {
    table = tableEdgeTable
    cell = tableFrameSelected.row >= 0
      ? ((table.rows[tableFrameSelected.row]?.cells[0] as HTMLTableCellElement | undefined) || null)
      : ((table.rows[0]?.cells[tableFrameSelected.col] as HTMLTableCellElement | undefined) || null)
  }
  if (!cell || !table || !editor.contains(table)) {
    tableEdgeSelected = null
    hideTableTool()
    if (!tableEdgeHovered) hideTableEdge()
    return
  }
  // 光标在表格里（选中状态）：即使鼠标不在表格上也展示灰色边条
  tableEdgeSelected = table
  if (!tableEdge.visible) updateTableEdge(cell, table)
  // 整行 / 整列选中时只保留行遮罩，不再给单个单元格加描边
  if (tableFrameSelected.row >= 0 || tableFrameSelected.col >= 0) {
    clearTableActiveCell()
  } else if (tableActiveCell !== cell) {
    clearTableActiveCell()
    tableActiveCell = cell
    cell.classList.add('docs-cell-active')
  }
  tableToolEl = table
  tableTool.header = table.classList.contains('docs-table-header')
  tableTool.hAlign = cell.style.textAlign || 'left'
  tableTool.vAlign = cell.style.verticalAlign || 'top'
  const rect = table.getBoundingClientRect()
  const width = tableToolRef.value?.offsetWidth || 380
  // 工具条放在表格正顶部居中
  tableTool.top = rect.top > 88 ? rect.top - 68 : rect.bottom + 8
  tableTool.left = Math.max(
    12,
    Math.min(rect.left + (rect.width - width) / 2, window.innerWidth - width - 12),
  )
  tableTool.visible = true
}

function removeTable(table: HTMLTableElement) {
  const editor = editorRef.value
  table.remove()
  hideTableTool()
  if (editor && !editor.children.length) editor.innerHTML = '<p><br></p>'
}

/** 表格工具条操作：增删行列 / 标题行 / 删除表格 */
function tableAction(cmd: string) {
  const table = tableToolEl
  const cell = currentTableCell() || frameSelectedCell()
  if (!table || !cell) return
  const row = cell.parentElement as HTMLTableRowElement | null
  if (!row) return
  const rows = Array.from(table.rows)
  const colIndex = Array.from(row.cells).indexOf(cell)
  switch (cmd) {
    case 'row-above':
    case 'row-below': {
      const tr = document.createElement('tr')
      for (let i = 0; i < row.cells.length; i++) {
        const td = document.createElement('td')
        td.innerHTML = '<br>'
        tr.appendChild(td)
      }
      row.parentElement?.insertBefore(tr, cmd === 'row-above' ? row : row.nextSibling)
      focusTableCell(tr.cells[0] || null)
      break
    }
    case 'col-left':
    case 'col-right': {
      const insertAt = cmd === 'col-left' ? colIndex : colIndex + 1
      rows.forEach((tr) => {
        const td = document.createElement('td')
        td.innerHTML = '<br>'
        tr.insertBefore(td, tr.cells[insertAt] || null)
      })
      focusTableCell((rows[rows.indexOf(row)] || row).cells[insertAt] || null)
      break
    }
    case 'row-delete': {
      if (rows.length <= 1) {
        removeTable(table)
        break
      }
      const nextRow = (row.nextElementSibling || row.previousElementSibling) as HTMLTableRowElement | null
      row.remove()
      focusTableCell(nextRow?.cells[0] || null)
      break
    }
    case 'col-delete': {
      if ((rows[0]?.cells.length || 0) <= 1) {
        removeTable(table)
        break
      }
      rows.forEach((tr) => tr.cells[colIndex]?.remove())
      focusTableCell(row.cells[colIndex] || row.cells[colIndex - 1] || null)
      break
    }
    case 'header':
      table.classList.toggle('docs-table-header')
      tableTool.header = table.classList.contains('docs-table-header')
      break
    case 'delete-table':
      removeTable(table)
      break
  }
  tableFrameSelected.row = -1
  tableFrameSelected.col = -1
  clearTableFrameSelectionClasses()
  onEditorInput()
  nextTick(updateTableTool)
}

/** 单元格对齐：水平左 / 中 / 右，垂直上 / 中 / 下；跨单元格选区时一起应用 */
function applyCellAlign(kind: string) {
  const table = tableToolEl
  if (!table) return
  const cells: HTMLTableCellElement[] = []
  if (tableFrameSelected.row >= 0) {
    const row = table.rows[tableFrameSelected.row]
    if (row) cells.push(...Array.from(row.cells))
  } else if (tableFrameSelected.col >= 0) {
    Array.from(table.rows).forEach((tr) => {
      const td = tr.cells[tableFrameSelected.col] as HTMLTableCellElement | undefined
      if (td) cells.push(td)
    })
  } else {
    const cell = currentTableCell()
    if (!cell) return
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    table.querySelectorAll<HTMLTableCellElement>('td, th').forEach((td) => {
      if (!range || range.collapsed) {
        if (td === cell) cells.push(td)
      } else if (range.intersectsNode(td)) {
        cells.push(td)
      }
    })
    if (!cells.length) cells.push(cell)
  }
  const cell = currentTableCell() || cells[0]
  if (!cell) return
  const prop = (
    {
      left: ['textAlign', 'left'],
      center: ['textAlign', 'center'],
      right: ['textAlign', 'right'],
      top: ['verticalAlign', 'top'],
      middle: ['verticalAlign', 'middle'],
      bottom: ['verticalAlign', 'bottom'],
    } as Record<string, [string, string]>
  )[kind]
  if (prop) {
    cells.forEach((td) => {
      if (prop[0] === 'textAlign') td.style.textAlign = prop[1]
      else td.style.verticalAlign = prop[1]
    })
  }
  tableTool.hAlign = cell.style.textAlign || 'left'
  tableTool.vAlign = cell.style.verticalAlign || 'top'
  tableTool.alignOpen = false
  onEditorInput()
  nextTick(updateTableTool)
}

/** 分栏：栏数范围、拖拽最小栏宽、窄屏堆叠断点（与样式里的 @media 保持一致） */
const COLS_MIN = 2
const COLS_MAX = 5
const COLS_MIN_PX = 120
const COLS_STACK_QUERY = '(max-width: 720px)'
/** 允许写入文档的列宽模板（粘贴时校验，防止外部样式注入） */
const COLS_TEMPLATE_RE = /^(minmax\(0,\s*\d+(\.\d+)?fr\)\s*)+$/

function equalColsTemplate(count: number): string {
  return Array.from({ length: count }, () => 'minmax(0,1fr)').join(' ')
}

/** 构造一组等宽分栏：每栏一个空段落，不写入占位文字 */
function buildColumns(count: number): HTMLElement {
  const cols = document.createElement('div')
  cols.className = 'docs-cols'
  cols.style.gridTemplateColumns = equalColsTemplate(count)
  for (let i = 0; i < count; i++) {
    const col = document.createElement('div')
    col.className = 'docs-col'
    col.innerHTML = '<p><br></p>'
    cols.appendChild(col)
  }
  return cols
}

/**
 * 插入分栏（块级插入）：光标所在的顶层块为空则替换它，否则插在它之后；
 * 分栏之后补一个空段落，光标落到第一栏。不再把 div 塞进段落里。
 */
function insertColumns(editor: HTMLElement, count: number) {
  const n = Math.min(COLS_MAX, Math.max(COLS_MIN, count))
  const cols = buildColumns(n)
  const sel = window.getSelection()
  let block: HTMLElement | null = null
  const anchor = sel && sel.rangeCount > 0 ? sel.anchorNode : null
  if (anchor && editor.contains(anchor)) {
    let node: Node | null = anchor
    while (node && node.parentNode !== editor) node = node.parentNode
    block = node as HTMLElement | null
  }
  if (block && block !== editor) {
    const isEmptyP =
      block.tagName === 'P' &&
      !(block.textContent || '').replace(/[​﻿]/g, '').trim() &&
      !block.querySelector('img, table, hr, ul, ol, pre')
    if (isEmptyP) block.replaceWith(cols)
    else block.after(cols)
  } else {
    editor.appendChild(cols)
  }
  const after = document.createElement('p')
  after.innerHTML = '<br>'
  cols.after(after)
  editor.focus()
  const first = cols.querySelector('.docs-col p')
  if (first && sel) {
    const caret = document.createRange()
    caret.setStart(first, 0)
    caret.collapse(true)
    sel.removeAllRanges()
    sel.addRange(caret)
  }
}

/* ---- 分栏：悬停分隔缝显示拖拽线，拖动调整相邻两栏宽度，双击恢复等宽 ---- */
/** 当前悬停的分栏容器（运行时类名 / 变量，保存时剥离） */
let colsHoverEl: HTMLElement | null = null
let colsDrag: { cols: HTMLElement; gap: number; startX: number; widths: number[]; moved: boolean } | null = null
/** 分隔缝命中宽度（缝两侧各 6px） */
const COLS_HIT_PX = 6

function colCellsOf(cols: HTMLElement): HTMLElement[] {
  return Array.from(cols.children).filter((el) => el.classList.contains('docs-col')) as HTMLElement[]
}

/** 指针 x 落在哪一条分隔缝上（第 i 缝位于第 i 栏与第 i+1 栏之间）；不在缝上或已堆叠时返回 -1 */
function colsGapAt(cols: HTMLElement, x: number): number {
  if (window.matchMedia(COLS_STACK_QUERY).matches) return -1
  const rects = colCellsOf(cols).map((c) => c.getBoundingClientRect())
  for (let i = 0; i < rects.length - 1; i++) {
    if (x >= rects[i].right - COLS_HIT_PX && x <= rects[i + 1].left + COLS_HIT_PX) return i
  }
  return -1
}

function clearColsHover() {
  if (!colsHoverEl) return
  colsHoverEl.classList.remove('is-resize-hover')
  colsHoverEl.style.removeProperty('--resize-x')
  colsHoverEl = null
}

/** 编辑态下悬停分隔缝：显示拖拽线 */
function onColsHover(e: MouseEvent) {
  const editor = editorRef.value
  if (!editor || !docsEditMode.value || colsDrag) return
  const cols = (e.target as HTMLElement).closest?.('.docs-cols') as HTMLElement | null
  const gap = cols && editor.contains(cols) ? colsGapAt(cols, e.clientX) : -1
  if (!cols || gap < 0) {
    clearColsHover()
    return
  }
  if (colsHoverEl !== cols) clearColsHover()
  const rects = colCellsOf(cols).map((c) => c.getBoundingClientRect())
  const x = (rects[gap].right + rects[gap + 1].left) / 2 - cols.getBoundingClientRect().left
  colsHoverEl = cols
  cols.classList.add('is-resize-hover')
  cols.style.setProperty('--resize-x', `${x}px`)
}

/** 把各栏的实际宽度写成 minmax(0, Nfr)，比例保持、总和保持 */
function colsTemplateOf(widths: number[]): string {
  const total = widths.reduce((a, b) => a + b, 0) || 1
  const n = widths.length
  return widths.map((w) => `minmax(0,${((w / total) * n).toFixed(3)}fr)`).join(' ')
}

function startColsDrag(cols: HTMLElement, gap: number, startX: number) {
  const widths = colCellsOf(cols).map((c) => c.getBoundingClientRect().width)
  colsDrag = { cols, gap, startX, widths, moved: false }
  cols.classList.add('is-resizing')
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', onColsDragMove)
  document.addEventListener('mouseup', onColsDragEnd)
}

function onColsDragMove(e: MouseEvent) {
  const d = colsDrag
  if (!d) return
  const { cols, gap, widths } = d
  // 相邻两栏都不能小于最小栏宽
  const minDx = -Math.max(0, widths[gap] - COLS_MIN_PX)
  const maxDx = Math.max(0, widths[gap + 1] - COLS_MIN_PX)
  const dx = Math.min(maxDx, Math.max(minDx, e.clientX - d.startX))
  const next = widths.slice()
  next[gap] += dx
  next[gap + 1] -= dx
  cols.style.gridTemplateColumns = colsTemplateOf(next)
  if (dx !== 0) d.moved = true
}

function onColsDragEnd() {
  const d = colsDrag
  document.removeEventListener('mousemove', onColsDragMove)
  document.removeEventListener('mouseup', onColsDragEnd)
  document.body.style.cursor = ''
  colsDrag = null
  if (!d) return
  d.cols.classList.remove('is-resizing')
  if (d.moved) onEditorInput()
}

/** 双击分隔缝：恢复等宽 */
function resetColsWidths(cols: HTMLElement) {
  cols.style.gridTemplateColumns = equalColsTemplate(colCellsOf(cols).length)
  onEditorInput()
}

/** 插入空高亮块，并把光标放进去（不再写入默认提示文字） */
function insertCalloutAtCaret(editor: HTMLElement) {
  const sel = window.getSelection()
  const range =
    sel && sel.rangeCount > 0 && sel.anchorNode && editor.contains(sel.anchorNode) ? sel.getRangeAt(0) : null
  const tpl = document.createElement('template')
  tpl.innerHTML = '<div class="docs-callout"><br></div><p><br></p>'
  const callout = tpl.content.firstElementChild as HTMLElement
  if (range) {
    range.deleteContents()
    range.insertNode(tpl.content)
  } else {
    editor.appendChild(tpl.content)
  }
  // 光标放进高亮块，直接输入内容
  if (callout.isConnected) {
    const caret = document.createRange()
    caret.setStart(callout, 0)
    caret.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(caret)
  }
}

/** "+"菜单：把枚举的富文本元素应用到悬停的块 */
/* ---- 项目管理：选择事项后以事项卡片的形式插入正文 ---- */
const issuePickerOpen = ref(false)
/** 打开选择弹窗时记下的插入位置（编辑器顶层块，卡片插在它后面） */
let issueInsertAnchor: HTMLElement | null = null

// 切回窗口时刷新事项卡片（事项可能在别处被改过）
function onWindowFocusRefreshIssues() {
  void refreshIssueCards()
}
onMounted(() => window.addEventListener('focus', onWindowFocusRefreshIssues))
onBeforeUnmount(() => window.removeEventListener('focus', onWindowFocusRefreshIssues))

/* ---- 问问 AI：记住正文中最近一次选中的内容，右侧抽屉交给 AI 处理，结果可替换回原处 ---- */
const aiOpen = ref(false)
const aiSelectionText = ref('')
/** 选中内容的富文本 HTML（发给 AI；与文档保存格式一致） */
const aiSelectionHtml = ref('')
/** 选中区域的快照（Range 随 DOM 变化自动更新，替换前会校验文字是否一致） */
let aiRange: Range | null = null
/** 记录选区时判定：是否选中了整篇正文（选区之前、之后都没有文字） */
const aiWholeDoc = ref(false)

/** 选区起点之前、终点之后都没有文字，即整篇正文被选中（不依赖文字长度比例，代码标签等不影响判断） */
function isWholeEditorSelected(range: Range, editor: HTMLElement): boolean {
  const before = document.createRange()
  before.setStart(editor, 0)
  before.setEnd(range.startContainer, range.startOffset)
  const after = document.createRange()
  after.setStart(range.endContainer, range.endOffset)
  after.setEnd(editor, editor.childNodes.length)
  return squashText(before.toString()) === '' && squashText(after.toString()) === ''
}

function captureAiSelection() {
  const editor = editorRef.value
  const sel = window.getSelection()
  if (!editor || !sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return
  const text = sel.toString().trim()
  if (!text) return
  aiSelectionText.value = text
  aiRange = range.cloneRange()
  aiWholeDoc.value = isWholeEditorSelected(range, editor)
  aiSelectionHtml.value = aiWholeDoc.value ? editorContentHtml(editor) : selectionHtmlOf(range)
}

/** 选区的富文本 HTML：去掉代码块语言栏、彩色层、修订条等运行时元素 */
function selectionHtmlOf(range: Range): string {
  const box = document.createElement('div')
  box.appendChild(range.cloneContents())
  box.querySelectorAll('.docs-code-head, .docs-code-highlight, .docs-suggest-bar').forEach((el) => el.remove())
  box.querySelectorAll('.docs-suggest-ins').forEach((el) => el.classList.remove('docs-suggest-ins'))
  return box.innerHTML
}

function openAi() {
  captureAiSelection()
  aiOpen.value = true
}

/** 去掉全部空白后比较，用于判断选中的是不是整篇正文 */
function squashText(s: string): string {
  return s.replace(/\s+/g, '')
}

/** 行内元素：局部选区里只需替换文字，不需要替换整段 */
const AI_INLINE_TAGS = new Set(['SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'CODE', 'A', 'BR'])

/**
 * 把 AI 返回的富文本 HTML 写入正文。
 * - 先按粘贴的清洗规则过滤（只保留允许的结构和样式，事项卡片保留编号）；
 * - 整篇选中：整篇替换；
 * - 局部选中：返回的是行内内容则只替换选中的文字，否则替换选区所在的整段。
 */
function applyAiHtml(rawHtml: string) {
  const editor = editorRef.value
  const doc = activeDoc.value
  if (!editor || !doc) {
    message.warning('请先打开文档')
    return
  }
  const html = sanitizePasteHtml(rawHtml).trim()
  if (!html) {
    message.warning('AI 没有返回可用的内容')
    return
  }
  const docLen = squashText(editor.textContent || '').length
  const selLen = squashText(aiSelectionText.value).length
  let done = ''
  if (aiWholeDoc.value || (selLen > 0 && docLen > 0 && selLen >= docLen * 0.95)) {
    editor.innerHTML = html
    done = '已全文替换'
  } else {
    // 优先用记录的选区；若编辑器期间有改动导致选区端点失效，则按选中的文字在正文中重新定位
    let range = aiRange?.cloneRange() ?? null
    const valid =
      !!range && editor.contains(range.commonAncestorContainer) && range.toString().trim() === aiSelectionText.value
    if (!valid) range = findCommentRange(aiSelectionText.value)
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      message.warning('正文中找不到原来选中的内容，请重新选中后再试')
      return
    }
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    const inlineOnly = Array.from(tpl.content.childNodes).every(
      (n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && AI_INLINE_TAGS.has((n as Element).tagName)),
    )
    const first = editorBlockOf(range.startContainer)
    const last = editorBlockOf(range.endContainer)
    if (inlineOnly && first && first === last) {
      editor.focus()
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      range.deleteContents()
      range.insertNode(tpl.content)
      done = '已替换'
    } else {
      if (!first || !last) {
        message.warning('原选区已变化，请重新选中内容后再试')
        return
      }
      // 收集选区覆盖的顶层块（从第一个到最后一个）
      const covered: HTMLElement[] = []
      let cur: Element | null = first
      while (cur) {
        covered.push(cur as HTMLElement)
        if (cur === last) break
        cur = cur.nextElementSibling
      }
      if (!covered.includes(last)) {
        message.warning('原选区已变化，请重新选中内容后再试')
        return
      }
      first.before(tpl.content)
      covered.forEach((el) => el.remove())
      done = '已替换'
    }
  }
  // 事项卡片保持不可编辑（整体点击打开详情）
  editor.querySelectorAll<HTMLElement>('.docs-issue-card').forEach((c) => (c.contentEditable = 'false'))
  onEditorChange(editor, doc)
  refreshSuggestMarks()
  aiRange = null
  aiSelectionText.value = ''
  aiSelectionHtml.value = ''
  aiWholeDoc.value = false
  message.success(done)
}

/** 「问问 AI」抽屉的替换入口：结果为富文本 HTML（纯文本会先转段落） */
function replaceAiSelection(payload: AiReplacePayload) {
  applyAiHtml(payload.html ?? textToParagraphsHtml(payload.text ?? ''))
}

onMounted(() => document.addEventListener('selectionchange', captureAiSelection))
onBeforeUnmount(() => document.removeEventListener('selectionchange', captureAiSelection))

/* ---- 事项卡片：点击在右侧抽屉中查看事项详情（不离开文档） ---- */
const issueDrawer = reactive({ open: false, key: '' })
function openIssueDrawer(issueKey: string) {
  issueDrawer.key = issueKey
  issueDrawer.open = true
}

/* ---- 团队协作：点击条目在弹窗中管理（需求 / 任务 / 看板 / 人员 / 部门） ---- */
const teamManage = reactive({
  open: false,
  title: '',
  kind: 'issue' as TeamManageSpec['kind'],
  typeName: '',
  insertable: false,
})
function openTeamManage(key: string) {
  const item = TEAM_COLLAB_ITEMS.find((t) => t.key === key)
  if (!item) return
  teamManage.title = item.label
  teamManage.kind = item.manage.kind
  teamManage.typeName = item.manage.typeName || ''
  teamManage.insertable = item.manage.insertable === true
  // 可插入的弹窗：先记下插入位置（点击「+」所在的块）
  if (teamManage.insertable) captureIssueInsertAnchor()
  teamManage.open = true
}

/** 记下插入位置：优先点击「+」所在的块，否则取光标所在的块 */
function captureIssueInsertAnchor(anchorNode?: Node | null) {
  const editor = editorRef.value
  const hovered = hoverBlock.value
  issueInsertAnchor =
    hovered && editor && hovered !== editor && hovered.parentElement === editor
      ? hovered
      : editorBlockOf(anchorNode ?? window.getSelection()?.anchorNode ?? null)
}

function openIssuePicker(anchorNode?: Node | null) {
  captureIssueInsertAnchor(anchorNode)
  issuePickerOpen.value = true
}

/** 事项卡片：编号 + 标题 + 状态，点击在新标签页打开事项详情 */
function buildIssueCard(it: FuzzyIssueItem): HTMLElement {
  const card = document.createElement('div')
  card.className = 'docs-issue-card'
  card.contentEditable = 'false'
  card.dataset.issueKey = it.issueKey
  const key = document.createElement('span')
  key.className = 'docs-issue-key'
  key.textContent = it.issueKey
  const title = document.createElement('span')
  title.className = 'docs-issue-title'
  title.textContent = it.summary || '未命名事项'
  card.append(key, title)
  if (it.statusName) {
    const status = document.createElement('span')
    status.className = 'docs-issue-status'
    status.textContent = it.statusName
    if (it.statusColor) status.style.color = it.statusColor
    card.appendChild(status)
  }
  return card
}

function insertIssueCards(items: FuzzyIssueItem[]) {
  const editor = editorRef.value
  const doc = activeDoc.value
  if (!editor || !doc || !items.length) return
  const frag = document.createDocumentFragment()
  for (const it of items) frag.appendChild(buildIssueCard(it))
  // 卡片之后补一个空段落，方便继续输入
  const tail = document.createElement('p')
  tail.innerHTML = '<br>'
  frag.appendChild(tail)
  const anchor = issueInsertAnchor && editor.contains(issueInsertAnchor) ? issueInsertAnchor : null
  if (anchor) anchor.after(frag)
  else editor.appendChild(frag)
  issueInsertAnchor = null
  onEditorInput()
  // 把本文档关联到这些事项：事项详情的「相关文档」里就能看到它（接口幂等，重复插入不会重复关联）
  for (const it of items) {
    linkIssueDocs({ issueKey: it.issueKey, docIds: [doc.id] }).then(
      (res) => {
        if (!res?.success) message.warning(`事项 ${it.issueKey} 关联文档失败`)
      },
      () => message.warning(`事项 ${it.issueKey} 关联文档失败`),
    )
  }
}

/**
 * 按事项最新数据刷新正文里的事项卡片（编号 / 标题 / 状态）。
 * 只更新页面显示，不写回文档内容，因此打开文档不会产生保存；查不到的事项保留原快照。
 */
async function refreshIssueCards() {
  const editor = editorRef.value
  const doc = activeDoc.value
  if (!editor || !doc) return
  const cards = Array.from(editor.querySelectorAll<HTMLElement>('.docs-issue-card[data-issue-key]'))
  if (!cards.length) return
  const docId = doc.id
  const keys = [...new Set(cards.map((c) => c.dataset.issueKey || ''))].filter(Boolean)
  const latest = new Map<string, FuzzyIssueItem>()
  await Promise.all(
    keys.map(async (key) => {
      try {
        const res = await fuzzyQueryIssues({ issueKey: key, pageSize: 10 })
        const hit = res.success ? res.data?.list?.find((i) => i.issueKey === key) : undefined
        if (hit) latest.set(key, hit)
      } catch {
        // 查询失败：保留卡片原有内容
      }
    }),
  )
  // 文档已切换：丢弃结果
  if (activeDoc.value?.id !== docId || editorRef.value !== editor) return
  for (const card of cards) {
    const item = latest.get(card.dataset.issueKey || '')
    if (!item) continue
    const title = card.querySelector<HTMLElement>('.docs-issue-title')
    if (title) title.textContent = item.summary || '未命名事项'
    let status = card.querySelector<HTMLElement>('.docs-issue-status')
    if (item.statusName) {
      if (!status) {
        status = document.createElement('span')
        status.className = 'docs-issue-status'
        card.appendChild(status)
      }
      status.textContent = item.statusName
      status.style.color = item.statusColor || ''
    } else status?.remove()
  }
}

function applyInsert(key: string) {
  const editor = editorRef.value
  if (!editor) return
  plusMenuOpen.value = false
  activeInsertSub.value = ''
  const [cmd, arg] = key.split(':')
  // 项目管理：先选事项，确认后再插入卡片
  if (cmd === 'issue') {
    openIssuePicker()
    return
  }
  // 团队协作：在弹窗中管理（不插入内容、不跳转页面）
  if (cmd === 'team') {
    openTeamManage(arg)
    return
  }
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
      const text = escapeHtml((block.textContent || '').trim())
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
          ? '<div class="docs-todo"><span class="docs-todo-text"></span><span class="docs-todo-box" contenteditable="false"></span></div>'
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
  // 事项卡片：点击在右侧抽屉中打开事项详情
  const issueCard = target.closest<HTMLElement>('.docs-issue-card')
  if (issueCard?.dataset.issueKey) {
    openIssueDrawer(issueCard.dataset.issueKey)
    return
  }
  // 修订条：接受 / 拒绝这一段修订
  const suggestBtn = target.closest<HTMLElement>('.docs-suggest-btn')
  if (suggestBtn) {
    const idx = Number(suggestBtn.dataset.idx)
    if (suggestBtn.dataset.act === 'accept') acceptSuggest(idx)
    else rejectSuggest(idx)
    return
  }
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
  // 修订条不参与选区，点按钮时保持光标位置
  if (target.closest?.('.docs-suggest-bar')) {
    e.preventDefault()
    return
  }
  if (target.closest?.('.docs-code-head button')) {
    e.preventDefault()
    return
  }
  if (e.button !== 0 || !docsEditMode.value) return
  // 分栏分隔缝：拖动调宽，双击恢复等宽（不让浏览器开始文字选区）
  const cols = target.closest?.('.docs-cols') as HTMLElement | null
  if (!cols) return
  const gap = colsGapAt(cols, e.clientX)
  if (gap < 0) return
  e.preventDefault()
  if (e.detail >= 2) resetColsWidths(cols)
  else startColsDrag(cols, gap, e.clientX)
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
 * 任务列表回车（参考飞书）：
 * - 光标在任务项里回车：在当前项下方新建一个任务项，光标后的内容移到新项；
 * - 空任务回车：退出任务列表，变回普通正文。
 * 返回是否已处理。
 */
function insertTodoOnEnter(editor: HTMLElement | null): boolean {
  if (!editor) return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
  const range = sel.getRangeAt(0)
  const start = range.startContainer
  const todo = (start.nodeType === Node.ELEMENT_NODE ? (start as HTMLElement) : start.parentElement)?.closest<HTMLElement>(
    '.docs-todo',
  )
  if (!todo || !editor.contains(todo) || !todo.contains(range.endContainer)) return false

  const textEl = todo.querySelector<HTMLElement>('.docs-todo-text') || todo
  const text = (textEl.textContent || '').replace(/[​﻿]/g, '').trim()

  // 空任务回车：整块变回普通正文行
  if (!text) {
    const p = document.createElement('p')
    p.innerHTML = '<br>'
    todo.replaceWith(p)
    const caret = document.createRange()
    caret.setStart(p, 0)
    caret.collapse(true)
    sel.removeAllRanges()
    sel.addRange(caret)
    return true
  }

  // 新建任务项：把光标之后的内容搬到新任务里
  const next = document.createElement('div')
  next.className = 'docs-todo'
  const nextText = document.createElement('span')
  nextText.className = 'docs-todo-text'
  const nextBox = document.createElement('span')
  nextBox.className = 'docs-todo-box'
  nextBox.setAttribute('contenteditable', 'false')
  next.appendChild(nextText)
  next.appendChild(nextBox)
  // 新任务沿用当前任务的缩进层级
  if (todo.style.marginLeft) next.style.marginLeft = todo.style.marginLeft

  if (textEl.contains(range.startContainer)) {
    range.deleteContents()
    const tail = document.createRange()
    tail.selectNodeContents(textEl)
    tail.setStart(range.startContainer, range.startOffset)
    nextText.appendChild(tail.extractContents())
  }
  // 光标不在文字区（如落到了任务块末尾）：新任务从空开始，原任务保留文字

  todo.after(next)
  // 光标放到新任务文字的开头（拆分时从后半段开始输入）
  const caret = document.createRange()
  caret.selectNodeContents(nextText)
  caret.collapse(true)
  sel.removeAllRanges()
  sel.addRange(caret)
  return true
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
  { key: 'pre', label: '代码块', keywords: '代码 daima', glyph: '{}' },
  { key: 'quote', label: '引用', keywords: 'yinyong', glyph: '❝' },
  { key: 'callout', label: '高亮块', keywords: '提示 gaoliangkuai', glyph: '▎' },
  { key: 'issue', label: '项目管理', keywords: '事项 xiangmuguanli', glyph: '▣' },
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
  if (it.key === 'issue') {
    openIssuePicker()
    onEditorInput()
    return
  }
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
      insertTodoAtCaret(editor, '')
      break
    case 'callout':
      insertCalloutAtCaret(editor)
      break
    case 'table': {
      const spec = String(arg || '3')
      const [rows, cols] = spec.includes('x')
        ? spec.split('x').map((n) => Number(n) || 3)
        : [Number(spec) || 3, Number(spec) || 3]
      insertTable(editor, rows, cols)
      break
    }
    case 'columns':
      insertColumns(editor, Number(arg) || 2)
      break
  }
}

/** 高亮块内回车：在块内插入换行，仍然属于同一个高亮块（不新建块） */
function insertCalloutLineBreak(editor: HTMLElement | null): boolean {
  if (!editor) return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  const node = sel.anchorNode
  const callout = (
    node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
  )?.closest<HTMLElement>('.docs-callout')
  if (!callout || !editor.contains(callout)) return false
  document.execCommand('insertLineBreak')
  return true
}

/** 编辑器按键（参考飞书）：斜杠菜单导航 / Tab 缩进列表 / 空待办退格转正文 */
function onEditorKeyDown(e: KeyboardEvent) {
  // 空的有序 / 无序列表项：退格和回车都把这一行变成空的正文行（去掉序号 / 圆点）
  if ((e.key === 'Backspace' || e.key === 'Enter') && !e.shiftKey && !e.isComposing && !slash.visible && exitEmptyListItemAtCaret()) {
    e.preventDefault()
    onEditorInput()
    return
  }
  // 代码块：连按两次回车跳出代码块，在下方新建正文
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !slash.visible && exitCodeBlockOnEnter(editorRef.value)) {
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
  // 高亮块：回车在块内新增一行，仍然属于同一个高亮块
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !slash.visible && insertCalloutLineBreak(editorRef.value)) {
    e.preventDefault()
    onEditorInput()
    return
  }
  // 任务列表：回车新建下一项（空任务回车退出任务列表）
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !slash.visible && insertTodoOnEnter(editorRef.value)) {
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

  // Tab / Shift+Tab：列表项缩进 / 反缩进；任务项缩进 40px；其他位置插入空格
  if (e.key === 'Tab') {
    e.preventDefault()
    const todo = el.closest<HTMLElement>('.docs-todo')
    if (todo) {
      const cur = parseInt(todo.style.marginLeft || '0', 10) || 0
      const next = e.shiftKey ? Math.max(0, cur - 32) : cur + 32
      todo.style.marginLeft = next ? `${next}px` : ''
    } else if (el.closest('li')) {
      document.execCommand(e.shiftKey ? 'outdent' : 'indent')
    } else {
      document.execCommand('insertText', false, '  ')
    }
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
/** 内联样式白名单：属性 → 值校验。只放行文字 / 背景颜色、对齐和分栏列宽 */
const COLOR_VALUE_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.,%\s]+\))$/i
const INLINE_STYLE_RULES: Record<string, RegExp> = {
  color: COLOR_VALUE_RE,
  'background-color': COLOR_VALUE_RE,
  'text-align': /^(left|center|right|justify)$/,
  'vertical-align': /^(top|middle|bottom)$/,
  'grid-template-columns': COLS_TEMPLATE_RE,
}
function cleanInlineStyle(raw: string): string {
  return raw
    .split(';')
    .map((decl) => {
      const i = decl.indexOf(':')
      if (i < 0) return ''
      const prop = decl.slice(0, i).trim().toLowerCase()
      const val = decl.slice(i + 1).trim()
      const ok = Object.prototype.hasOwnProperty.call(INLINE_STYLE_RULES, prop) && INLINE_STYLE_RULES[prop].test(val)
      return ok ? `${prop}: ${val}` : ''
    })
    .filter(Boolean)
    .join('; ')
}

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
              : el.tagName === 'DIV' && el.classList.contains('docs-issue-card')
                ? ['data-issue-key'] // 事项卡片保留编号，用于点击打开详情
                : []
      Array.from(el.attributes).forEach((attr) => {
        const val = attr.value || ''
        // style 只保留白名单内、值合法的声明（文字 / 背景颜色、对齐、分栏列宽），其余丢弃
        if (attr.name === 'style') {
          const s = cleanInlineStyle(val)
          if (s) el.setAttribute('style', s)
          else el.removeAttribute('style')
        } else if (!keep.includes(attr.name)) el.removeAttribute(attr.name)
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
type BubbleMenu = '' | 'heading' | 'color' | 'fontcolor'
const bubble = reactive({
  visible: false,
  top: 0,
  left: 0,
  menu: '' as BubbleMenu,
  /** 当前块类型按钮上的短标签：正文 / H1 / 无序 ... */
  block: '正文',
  /** 当前块类型 key，用于类型菜单高亮 */
  blockKey: 'p',
})
const bubbleRef = ref<HTMLElement | null>(null)
const bubbleColors = ['#ffe58f', '#ffd6e7', '#d3e5ff', '#d9f7be', '#ffccc7']
const bubbleColorNames = ['柠檬黄', '樱花粉', '天空蓝', '青草绿', '珊瑚红']
/** 文字颜色 / 单元格背景色调色板（参考飞书） */
const textColors = ['#1f1f1f', '#8c8c8c', '#f5222d', '#fa8c16', '#fadb14', '#52c41a', '#1677ff', '#722ed1']
const textColorNames = ['默认', '灰色', '红色', '橙色', '黄色', '绿色', '蓝色', '紫色']
const cellBgColors = ['#fff1b8', '#ffd6e7', '#d6e4ff', '#d9f7be', '#ffccc7', '#f0f0f0', '#e6f7ff', '#f9f0ff']
const cellBgColorNames = ['柠檬黄', '樱花粉', '天空蓝', '青草绿', '珊瑚红', '浅灰', '浅蓝', '浅紫']
interface BubbleBlockType {
  key: string
  label: string
  glyph?: string
  icon?: Component
  divider?: boolean
}
/** 块类型下拉菜单（参考飞书：正文 / 标题 / 列表 / 任务 / 代码块 / 引用 / 高亮块） */
const bubbleBlockTypes: BubbleBlockType[] = [
  { key: 'p', label: '正文', glyph: 'T' },
  { key: 'h1', label: '一级标题', glyph: 'H1' },
  { key: 'h2', label: '二级标题', glyph: 'H2' },
  { key: 'h3', label: '三级标题', glyph: 'H3' },
  { key: 'ol', label: '有序列表', icon: OrderedListOutlined },
  { key: 'ul', label: '无序列表', icon: UnorderedListOutlined },
  { key: 'todo', label: '任务', icon: CheckSquareOutlined },
  { key: 'pre', label: '代码块', glyph: '{}' },
  { key: 'divider', label: '', divider: true },
  { key: 'quote', label: '引用', glyph: '❝' },
  { key: 'callout', label: '高亮块', icon: BgColorsOutlined },
]
/** 工具栏按钮上的块类型短标签 */
const BUBBLE_BLOCK_LABEL: Record<string, string> = {
  p: '正文',
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  ul: '无序',
  ol: '有序',
  todo: '任务',
  pre: '代码',
  quote: '引用',
  callout: '高亮',
  img: '图片',
  table: '表格',
  hr: '分割线',
  attach: '附件',
  columns: '分栏',
}
/** 记录选区，点击工具栏时不丢选区 */
let bubbleRange: Range | null = null

function hideBubble() {
  bubble.visible = false
  bubble.menu = ''
}

/** 选区所在的块级元素（列表项取 li，方便判断类型） */
function bubbleBlockOf(node: Node | null): HTMLElement | null {
  const editor = editorRef.value
  if (!editor || !node) return null
  let block: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  while (
    block &&
    block !== editor &&
    block.parentElement !== editor &&
    !/^(P|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(block.tagName)
  ) {
    block = block.parentElement
  }
  return block && block !== editor ? block : null
}

/** 选区变化时刷新工具栏位置 / 显隐 */
function updateBubble() {
  updateTableTool()
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
  const block = bubbleBlockOf(range.startContainer)
  const blockKey = blockTypeOf(block)
  bubble.blockKey = blockKey
  bubble.block = BUBBLE_BLOCK_LABEL[blockKey] || '正文'
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
    case 'textColor':
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('foreColor', false, value || textColors[0])
      break
    case 'align':
      document.execCommand(`justify${value === 'center' ? 'Center' : value === 'right' ? 'Right' : 'Left'}`)
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
    case 'pre':
      document.execCommand('formatBlock', false, 'pre')
      break
    case 'quote':
      document.execCommand('formatBlock', false, 'blockquote')
      break
    case 'callout': {
      // 选区所在块转换成高亮块（列表项从列表里拆出来）
      const block = bubbleBlockOf(bubbleRange?.startContainer ?? null)
      if (!block || block.classList.contains('docs-callout')) break
      const callout = document.createElement('div')
      callout.className = 'docs-callout'
      callout.innerHTML = block.innerHTML || '<br>'
      if (editor && block.tagName === 'LI' && block.parentElement?.parentElement === editor) {
        placeInListGap(block, callout, true)
      } else {
        block.replaceWith(callout)
      }
      const sel = window.getSelection()
      const caret = document.createRange()
      caret.selectNodeContents(callout)
      caret.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(caret)
      break
    }
    case 'ul':
      document.execCommand('insertUnorderedList')
      break
    case 'ol':
      document.execCommand('insertOrderedList')
      break
    case 'todo': {
      // 选中的文字转成任务块（替换所在块），光标落在任务文字里
      const text = window.getSelection()?.toString().trim() || ''
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
  // 表格对齐 / 高亮菜单：点菜单外收起
  if (tableTool.alignOpen && !target.closest?.('.docs-table-tool-align')) tableTool.alignOpen = false
  if (!target.closest?.('.docs-table-tool-color-wrap')) {
    tableTool.colorOpen = false
    tableTool.fontColorOpen = false
    tableTool.cellBgOpen = false
  }
  // 点击表格外侧边条与工具条以外的位置：清空行 / 列选中态
  // （点工具条里的删除 / 对齐 / 格式按钮时要保留选中的行或列）
  if (!target.closest?.('.docs-table-frame-seg') && !target.closest?.('.docs-table-tool')) {
    tableFrameSelected.row = -1
    tableFrameSelected.col = -1
    clearTableFrameSelectionClasses()
  }
  if (bubbleRef.value?.contains(target)) return
  if (editorRef.value?.contains(target)) return
  hideBubble()
}

onMounted(() => {
  document.addEventListener('selectionchange', updateBubble)
  document.addEventListener('mousedown', onDocMouseDown, true)
  document.addEventListener('mousemove', onDocMouseMove)
  document.addEventListener('scroll', hideFloatPanels, true)
  window.addEventListener('resize', hideFloatPanels)
  // 窗口宽度变化会重排正文，评论高亮跟着重新定位
  window.addEventListener('resize', scheduleCommentHighlights)
})
onBeforeUnmount(() => {
  // 分栏拖拽中途切换页面：撤掉拖拽监听，恢复光标
  document.removeEventListener('mousemove', onColsDragMove)
  document.removeEventListener('mouseup', onColsDragEnd)
  document.body.style.cursor = ''
  document.removeEventListener('selectionchange', updateBubble)
  document.removeEventListener('mousedown', onDocMouseDown, true)
  document.removeEventListener('mousemove', onDocMouseMove)
  document.removeEventListener('scroll', hideFloatPanels, true)
  window.removeEventListener('resize', hideFloatPanels)
  window.removeEventListener('resize', scheduleCommentHighlights)
})

/** 滚动 / 缩放 / 切换文档时收起所有浮动面板（工具栏 + 斜杠菜单） */
function hideFloatPanels(e?: unknown) {
  hideBubble()
  closeSlash()
  hideTableTool()
  hideTableEdge()
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
/** 鼠标悬停的评论（悬停评论卡片 / 行上的评论标记时，高亮对应的正文） */
const hoverCommentId = ref('')
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
/** 右侧评论栏是否展示：没有行内评论、也没有正在输入的评论时整栏折叠隐藏，正文占满 */
const commentRailShown = computed(() => lineComments.value.length > 0 || lineComposerOpen.value)
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
/** 评论作者：与文档标题下方的作者名保持一致 */
const commentAuthorName = computed(() => docAuthor.value || '匿名')
/** 评论头像：与文档标题下方的头像保持一致 */
const commentSelfAvatar = computed(() => docCreatorAvatar.value || '')

function commentAvatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** 评论 / 回复头像：优先使用记录的头像，旧数据按作者名匹配文档作者头像 */
function commentAvatarUrl(c: { author?: string; avatar?: string }): string {
  if (c.avatar) return c.avatar
  if (c.author && c.author === docAuthor.value) return docCreatorAvatar.value || ''
  return ''
}

function commentAvatarStyle(c: { author?: string; avatar?: string }): Record<string, string> {
  return commentAvatarUrl(c) ? {} : { background: commentAvatarColor(c.author || '') }
}

/** 评论时间：just now / 5 min ago / 2 hr ago / 3 days ago / 日期（美式） */
function commentTimeText(ts: number): string {
  return formatUsRelative(ts)
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
    avatar: commentSelfAvatar.value || undefined,
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
    avatar: commentSelfAvatar.value || undefined,
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
  const reply = {
    id: newCommentId(),
    author: commentAuthorName.value,
    avatar: commentSelfAvatar.value || undefined,
    content,
    createdAt: Date.now(),
  }
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
  // 匹配时忽略空白（块与块之间的换行、引文里的空格差异都不影响定位），
  // 同时记下每个非空白字符在原文中的偏移，用于映射回 Range
  const norm: string[] = []
  const origin: number[] = []
  for (let k = 0; k < full.length; k++) {
    if (/\s/.test(full[k])) continue
    norm.push(full[k])
    origin.push(k)
  }
  const normFull = norm.join('')
  const normQuote = quote.replace(/\s+/g, '')
  if (!normQuote) return null
  const normIndex = normFull.indexOf(normQuote)
  if (normIndex < 0) return null
  const index = origin[normIndex]
  const lastIndex = origin[normIndex + normQuote.length - 1]
  if (index === undefined || lastIndex === undefined) return null
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
  const end = locate(lastIndex + 1, true)
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
  const railRect = commentRailRef.value?.getBoundingClientRect() ?? null
  const next: typeof commentHighlights.value = []
  const anchors: Record<string, number> = {}
  for (const c of comments.value) {
    if (!c.quote) continue
    const range = findCommentRange(c.quote)
    if (!range) continue
    const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 1 && r.height >= 1)
    if (!rects.length) continue
    // 评论卡片对齐到被评论文字的第一行（已解决的评论也要对齐，只是不再画高亮）
    if (railRect) anchors[c.id] = rects[0].top - railRect.top
    if (c.resolved) continue
    for (const rect of rects) {
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
  commentAnchorMap = anchors
  // 折叠态标记：行内评论按锚点行聚合，同一行的评论合并为一个标记
  const lineIds = new Set(lineComments.value.map((c) => c.id))
  const groups = new Map<number, { count: number; firstId: string }>()
  for (const c of comments.value) {
    const anchor = anchors[c.id]
    if (!lineIds.has(c.id) || anchor === undefined) continue
    const key = Math.round(anchor)
    const g = groups.get(key)
    if (g) g.count++
    else groups.set(key, { count: 1, firstId: c.id })
  }
  const markers = Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([top, g]) => ({ key: String(top), top, count: g.count, firstId: g.firstId }))
  // 原文已找不到的行内评论：不丢弃，放在已定位标记的下方，与展开态里排在最后的卡片一致
  const unanchored = lineComments.value.filter((c) => anchors[c.id] === undefined)
  if (unanchored.length) {
    const lastTop = markers.length ? markers[markers.length - 1].top : -24
    markers.push({ key: 'unanchored', top: lastTop + 24, count: unanchored.length, firstId: unanchored[0].id })
  }
  commentMarkers.value = markers
  nextTick(layoutCommentCards)
}

/* ---- 评论卡片与被评论内容水平对齐：卡片顶端对齐被评论文字的第一行，重叠时向下顺延 ---- */
/** 评论锚点：评论 id → 被评论文字第一行相对评论栏顶部的位置 */
let commentAnchorMap: Record<string, number> = {}
/** 各卡片在评论列表中的 top（已扣除列表偏移） */
const commentCardTop = ref<Record<string, number>>({})
const COMMENT_CARD_GAP = 10
const COMPOSER_KEY = '__composer__'
/** 折叠态评论标记：按被评论的行聚合，top 为该行在评论栏内的位置 */
const commentMarkers = ref<{ key: string; top: number; count: number; firstId: string }[]>([])

/** 点击折叠态的标记：展开评论栏，并定位到这条评论 */
function expandToComment(id: string) {
  const c = comments.value.find((x) => x.id === id)
  commentPanelOpen.value = true
  if (c) nextTick(() => focusComment(c))
}

/** 按锚点排布评论卡片（与正文水平对齐），行内评论输入卡片同样参与排布 */
function layoutCommentCards() {
  const list = commentRailRef.value?.querySelector<HTMLElement>('.docs-comment-list')
  if (!list) return
  const offset = list.offsetTop
  const items: { id: string; anchor: number; height: number }[] = Array.from(
    list.querySelectorAll<HTMLElement>('.docs-comment-card[data-cid]'),
  ).map((el) => {
    const id = el.dataset.cid || ''
    return { id, anchor: commentAnchorMap[id] ?? Infinity, height: el.offsetHeight }
  })
  const composer = lineComposerOpen.value ? lineComposerRef.value : null
  if (composer) items.push({ id: COMPOSER_KEY, anchor: lineComposerTop.value, height: composer.offsetHeight })
  // 按锚点从上到下排；没有锚点（原文已删除）的排在最后
  items.sort((a, b) => (a.anchor === b.anchor ? 0 : a.anchor < b.anchor ? -1 : 1))
  const tops: Record<string, number> = {}
  let bottom = 0
  items.forEach((it, idx) => {
    const minY = idx === 0 ? 0 : bottom + COMMENT_CARD_GAP
    const y = Math.max(Number.isFinite(it.anchor) ? it.anchor : minY, minY)
    tops[it.id] = y
    bottom = y + it.height
  })
  const next: Record<string, number> = {}
  for (const [id, y] of Object.entries(tops)) {
    if (id === COMPOSER_KEY) {
      if (lineComposerTop.value !== y) lineComposerTop.value = y
    } else next[id] = y - offset
  }
  commentCardTop.value = next
  list.style.minHeight = `${Math.max(0, bottom - offset) + 12}px`
}

// 输入卡片出现 / 移动、评论栏展开收起时重新排布卡片
watch([lineComposerOpen, lineComposerTop, commentPanelOpen, activeCommentId, activeReplyId, replyDraft], () =>
  nextTick(layoutCommentCards),
)

// 评论变化 / 文档切换 / 评论栏展开收起后重新定位高亮
watch(comments, () => nextTick(scheduleCommentHighlights), { deep: true })
watch([activeDoc, commentPanelOpen, commentRailShown], () => nextTick(scheduleCommentHighlights))
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
  <template v-if="!docPending">
  <div class="docs-page" :class="{ 'is-focus': focusMode, 'is-side-collapsed': docsSideCollapsed }">
    <!-- 左侧：文件夹 + 文档 -->
    <aside v-if="!showLibrarySide" class="docs-side">
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
            <span class="docs-side-title">{{ tr('云文档', 'Docs') }}</span>
          </div>
        </div>
      </header>

      <div class="docs-search-wrap">
        <a-input ref="searchRef" v-model:value="keyword" size="small" allow-clear :placeholder="tr('搜索', 'Search')" class="docs-search">
          <template #prefix><SearchOutlined class="docs-search-icon" /></template>
        </a-input>
        <span class="docs-search-kbd">⌘K</span>
      </div>

      <nav class="docs-nav">
        <button type="button" class="docs-nav-item" :class="{ active: ['recent', 'owned', 'shared', 'starred'].includes(navMode) }" @click="switchNav('recent')">
          <HomeOutlined />
          <span>{{ tr('首页', 'Home') }}</span>
        </button>
        <div class="docs-nav-row">
          <button type="button" class="docs-nav-item" :class="{ active: navMode === 'library' && !activeLibraryId }" @click="switchNav('library')">
            <ReadOutlined />
            <span>{{ tr('知识库', 'Wiki') }}</span>
          </button>
          <span
            class="docs-nav-caret"
            :class="{ open: libNavOpen }"
            :title="libNavOpen ? '收起知识库' : '展开知识库'"
            @click="libNavOpen = !libNavOpen"
          ><RightOutlined /></span>
        </div>
        <!-- 知识库列表：新建的知识库直接展示在「知识库」下方，点击进入 -->
        <div v-if="libNavOpen" class="docs-nav-libs">
          <button
            v-for="l in libraries"
            :key="l.id"
            type="button"
            class="docs-nav-sub"
            :class="{ active: activeLibraryId === l.id }"
            :title="l.name"
            @click="openLibrary(l)"
          >
            <span class="docs-nav-sub-name">{{ l.name }}</span>
          </button>

          <div v-if="!libraries.length" class="docs-nav-sub-empty">暂无知识库</div>
        </div>
      </nav>

      <div class="docs-list">
        <!-- 置顶：文档 + 知识库，左右两列分布 -->
        <div v-if="pinnedDocs.length || pinnedLibraries.length" class="docs-group">
          <div class="docs-group-title">{{ tr('置顶', 'Pinned') }}</div>
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
              v-for="l in pinnedLibraries"
              :key="`pinl-${l.id}`"
              class="docs-pinned-item"
              :title="l.name"
              @click="openLibrary(l)"
            >
              <DocsLibraryCover class="docs-pinned-cover" :name="l.name" :cover="l.cover" />
              <span class="docs-pinned-name">{{ l.name }}</span>
            </div>
          </div>
        </div>

        <!-- 主页侧栏始终是「个人文档」：知识库由知识库菜单 / 知识库页展示，不占用这里 -->
        <div class="docs-group-title docs-group-title-main docs-collapsible" @click="myDocsCollapsed = !myDocsCollapsed">
          <span>{{ tr('个人文档', 'My docs') }}</span>
          <span class="docs-group-caret" :class="{ open: !myDocsCollapsed }"><RightOutlined /></span>
        </div>

        <template v-for="g in myDocsCollapsed ? [] : groups" :key="g.folder?.id || '__ungrouped__'">
          <!-- 文件夹标题（知识库内的目录，可嵌套） -->
          <div
            v-if="g.folder"
            class="docs-folder"
            :class="{ active: activeFolderId === g.folder.id }"
            :style="{ paddingLeft: `${8 + (g.depth || 0) * 14}px` }"
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
                  <a-menu-item key="star">{{ g.folder.starred ? tr('取消置顶', 'Unpin') : tr('置顶', 'Pin') }}</a-menu-item>
                  <a-menu-item key="rename">{{ tr('重命名', 'Rename') }}</a-menu-item>
                  <a-menu-item key="delete" danger>{{ tr('删除文件夹', 'Delete folder') }}</a-menu-item>
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
                      <a-menu-item key="move:none">个人文档（移出知识库）</a-menu-item>
                      <a-menu-item v-for="f in folders" :key="`move:${f.id}`">{{ folderPathLabel(f) }}</a-menu-item>
                    </a-sub-menu>
                    <a-menu-item key="delete" danger>删除</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </button>
            <div v-if="g.folder && !g.docs.length" class="docs-folder-empty">空文件夹</div>
          </template>
        </template>

        <div v-if="!groups.length && !myDocsCollapsed" class="docs-list-empty">
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

    <!-- 知识库内的文档：左侧显示知识库菜单（与知识库页共用 LibrarySide） -->
    <LibrarySide
      v-else
      :library-name="activeLibrary?.name || ''"
      :library-cover="activeLibrary?.cover"
      :keyword="keyword"
      :rows="librarySideRows"
      :move-targets="librarySideMoveTargets"
      :active-doc-id="activeId"
      show-trash
      :trash-count="trash.length"
      :empty-text="keyword ? '没有匹配的文档' : '暂无文档，点击「新建」开始'"
      @update:keyword="keyword = $event"
      @home="switchNav('recent')"
      @library-home="activeLibrary && openLibrary(activeLibrary)"
      @library="switchNav('library')"
      @new="onLibraryNewMenu"
      @toggle-folder="selectFolder"
      @open-doc="selectDoc"
      @folder-menu="(k, f) => onFolderMenu({ key: k }, f)"
      @doc-menu="(k, d) => onDocMenu({ key: k }, d)"
      @trash="switchNav('trash')"
    />

    <!-- 重命名文档（知识库菜单的「重命名」） -->
    <a-modal
      v-model:open="docRenameOpen"
      title="重命名文档"
      :width="360"
      centered
      destroy-on-close
      ok-text="确定"
      cancel-text="取消"
      @ok="submitRenameDoc"
    >
      <a-input v-model:value="docRenameForm.title" :maxlength="60" placeholder="文档名称" @press-enter="submitRenameDoc" />
    </a-modal>

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
            :class="{
              'is-scrollable': activeDoc.type === 'doc',
              'is-comments-collapsed': !commentPanelOpen,
              'is-comments-hidden': activeDoc.type === 'doc' && !commentRailShown,
            }"
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
                <span class="docs-doc-avatar" :style="docCreatorAvatar ? undefined : docAvatarStyle">
                  <img v-if="docCreatorAvatar" :src="docCreatorAvatar" alt="" @error="clearDocAvatar" />
                  <template v-else>{{ docAuthor.slice(0, 1).toUpperCase() }}</template>
                </span>
                <span class="docs-doc-author">{{ docAuthor }}</span>
                <span class="docs-doc-sep" />
                <span class="docs-doc-date">{{ formatLongDate(activeDoc.updatedAt) }}修改</span>
              </div>

              <!-- 修订模式状态条：待处理修订数量，支持全部接受 / 全部拒绝 -->
              <div v-if="docsSuggestMode && activeDoc.type === 'doc'" class="docs-suggest-banner">
                <span class="docs-suggest-banner-text">
                  <FormOutlined />
                  修订模式{{ suggestCount ? `：${suggestCount} 处待处理修订` : '：暂无待处理修订' }}
                </span>
                <template v-if="suggestCount">
                  <button type="button" class="docs-suggest-banner-btn" @click="rejectAllSuggest">全部拒绝</button>
                  <button type="button" class="docs-suggest-banner-btn is-primary" @click="acceptAllSuggest">全部接受</button>
                </template>
              </div>
              <div
                v-if="activeDoc.type === 'doc'"
                class="docs-editor-wrap"
                :class="{ 'is-edit': docsEditMode }"
                @mouseover="onEditorHover"
                @mousemove="onColsHover"
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
                    :class="{
                      'is-active': activeCommentId === r.id,
                      'is-visible': hoverCommentId === r.id || activeCommentId === r.id,
                    }"
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
                    :class="{
                      'is-open': plusMenuOpen,
                      'is-block': plusMode === 'block',
                      'is-heading': hoverIsHeading,
                      'is-table': hoverBlockType === 'table',
                    }"
                    :style="{ top: plusTop + 'px' }"
                    :title="plusMode === 'block' ? '块操作' : '插入'"
                    @mouseenter="onHandleEnter"
                    @mouseleave="onHandleLeave"
                  >
                    <template v-if="plusMode === 'block'">
                      <span
                        v-if="hoverIsHeading || hoverBlockType === 'callout' || hoverBlockLabel"
                        class="docs-block-plus-label"
                        :class="{ 'is-quote': hoverBlockType === 'quote' }"
                      >
                        <template v-if="hoverIsHeading">H<sub>{{ hoverBlockType.slice(1) }}</sub></template>
                        <BgColorsOutlined v-else-if="hoverBlockType === 'callout'" class="docs-block-plus-label-icon" />
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
                          <span v-else class="docs-insert-glyph" :class="{ 'is-quote': it.key === 'quote' }">{{ it.glyph }}</span>
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
                            <!-- 表格：悬停选择行列数 -->
                            <div
                              v-if="it.key === 'table'"
                              class="docs-table-picker"
                              @mouseleave="tablePickerHover.rows = 0; tablePickerHover.cols = 0"
                            >
                              <div v-for="r in 6" :key="r" class="docs-table-picker-row">
                                <button
                                  v-for="c in 6"
                                  :key="c"
                                  type="button"
                                  class="docs-table-picker-cell"
                                  :class="{ 'is-on': r <= tablePickerHover.rows && c <= tablePickerHover.cols }"
                                  @mouseenter="tablePickerHover.rows = r; tablePickerHover.cols = c"
                                  @click.stop="applyInsert(`table:${r}x${c}`)"
                                />
                              </div>
                              <div class="docs-table-picker-label">
                                {{ tablePickerHover.rows ? `${tablePickerHover.rows} × ${tablePickerHover.cols}` : '选择大小' }}
                              </div>
                            </div>
                            <div
                              v-else-if="it.key === 'columns'"
                              class="docs-cols-picker"
                              @mouseleave="colsPickerHover = 0"
                            >
                              <div class="docs-cols-picker-title">选择栏数</div>
                              <div class="docs-cols-picker-box">
                                <button
                                  v-for="n in colsPickerOptions"
                                  :key="n"
                                  type="button"
                                  class="docs-cols-picker-opt"
                                  :class="{ 'is-on': colsPickerHover === n }"
                                  @mouseenter="colsPickerHover = n"
                                  @click.stop="applyInsert(`columns:${n}`)"
                                >
                                  <span
                                    v-for="c in n"
                                    :key="c"
                                    class="docs-cols-picker-bar"
                                    :class="{ 'is-on': colsPickerHover === n }"
                                  />
                                </button>
                              </div>
                              <div class="docs-table-picker-label">
                                {{ colsPickerHover ? `${colsPickerHover} 栏` : '悬停选择' }}
                              </div>
                            </div>
                            <template v-else>
                              <button
                                v-for="s in it.sub"
                                :key="s.key"
                                type="button"
                                class="docs-insert-sub-item"
                                @click.stop="applyInsert(s.key)"
                              >{{ s.label }}</button>
                            </template>
                          </div>
                        </div>
                      </div>

                      <!-- 团队协作：与「常用」同级的分组，直接列出各协作入口，点击跳转 -->
                      <div class="docs-insert-label">团队协作</div>
                      <div class="docs-insert-list">
                        <div
                          v-for="t in TEAM_COLLAB_ITEMS"
                          :key="t.key"
                          class="docs-insert-item"
                          @click="applyInsert(`team:${t.key}`)"
                        >
                          <component :is="t.icon" class="docs-insert-item-icon" :style="{ color: t.color, background: `color-mix(in srgb, ${t.color} 10%, transparent)` }" />
                          <span class="docs-insert-item-label">{{ t.label }}</span>
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
                            <span v-else class="docs-insert-glyph" :class="{ 'is-quote': it.key === 'quote' }">{{ it.glyph }}</span>
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
                            <span v-else class="docs-insert-glyph" :class="{ 'is-quote': it.key === 'quote' }">{{ it.glyph }}</span>
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
                <!-- 项目管理：选择事项，插入为事项卡片 -->
                <DocIssuePicker v-model:open="issuePickerOpen" @confirm="insertIssueCards" />
                <!-- 团队协作：需求 / 任务 / 看板 / 人员 / 部门，在弹窗中管理 -->
                <TeamManageModal
                  v-model:open="teamManage.open"
                  :kind="teamManage.kind"
                  :title="teamManage.title"
                  :type-name="teamManage.typeName"
                  :insertable="teamManage.insertable"
                  @confirm="insertIssueCards"
                />
                <!-- 问问 AI：右侧抽屉（不遮罩，选中内容时可边看边改） -->
                <DocAiDrawer
                  v-model:open="aiOpen"
                  :selected-text="aiSelectionText"
                  :selected-html="aiSelectionHtml"
                  :can-replace="docsEditMode"
                  :whole-doc="aiWholeDoc"
                  @replace="replaceAiSelection"
                />
                <!-- 事项卡片：右侧抽屉查看 / 操作事项 -->
                <IssueDetailDrawer v-model:open="issueDrawer.open" :issue-key="issueDrawer.key" @changed="refreshIssueCards" />
              </div>
              <DocSheetEditor
                v-else-if="activeDoc.type === 'sheet'"
                :key="`sheet-${activeDoc.id}`"
                :data="sheetData(activeDoc)"
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
                  <div class="docs-doc-like-slogan"><span>若有收获，就点个赞吧</span></div>
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
                    <span class="docs-comment-avatar" :style="commentAvatarStyle(c)">
                      <img v-if="commentAvatarUrl(c)" :src="commentAvatarUrl(c)" alt="" />
                      <template v-else>{{ (c.author || '匿').slice(0, 1).toUpperCase() }}</template>
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
                          <span class="docs-comment-avatar is-small" :style="commentAvatarStyle(r)">
                            <img v-if="commentAvatarUrl(r)" :src="commentAvatarUrl(r)" alt="" />
                            <template v-else>{{ (r.author || '匿').slice(0, 1).toUpperCase() }}</template>
                          </span>
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
            v-if="activeDoc.type === 'doc' && commentRailShown"
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
              <!-- 与正文右侧的评论入口同款（MessageOutlined + .docs-line-comment） -->
              <button
                v-else
                type="button"
                class="docs-line-comment is-bordered"
                title="展开评论"
                @click="commentPanelOpen = true"
              >
                <MessageOutlined />
              </button>
            </div>
            <!-- 折叠态：每条评论在它所评论的那一行高度上放一个标记（数字为该行的评论数），点击展开并定位 -->
            <template v-if="!commentPanelOpen">
              <button
                v-for="m in commentMarkers"
                :key="m.key"
                type="button"
                class="docs-comment-marker"
                :style="{ top: m.top + 'px' }"
                @mouseenter="hoverCommentId = m.firstId"
                @mouseleave="hoverCommentId = ''"
                :title="`${m.count} 条评论`"
                @click="expandToComment(m.firstId)"
              >{{ m.count }}</button>
            </template>

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
                <span
                  class="docs-comment-avatar"
                  :style="commentAvatarStyle({ author: commentAuthorName, avatar: commentSelfAvatar })"
                >
                  <img v-if="commentSelfAvatar" :src="commentSelfAvatar" alt="" />
                  <template v-else>{{ commentAuthorName.slice(0, 1).toUpperCase() }}</template>
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
                  :data-cid="c.id"
                  :style="{ top: (commentCardTop[c.id] ?? 0) + 'px' }"
                  :class="{ 'is-resolved': c.resolved, 'is-active': activeCommentId === c.id }"
                  @mouseenter="hoverCommentId = c.id"
                  @mouseleave="hoverCommentId = ''"
                  @click="focusComment(c)"
                >
                  <div class="docs-comment-card-head">
                    <span class="docs-comment-avatar" :style="commentAvatarStyle(c)">
                      <img v-if="commentAvatarUrl(c)" :src="commentAvatarUrl(c)" alt="" />
                      <template v-else>{{ (c.author || '匿').slice(0, 1).toUpperCase() }}</template>
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
                      <span class="docs-comment-avatar is-small" :style="commentAvatarStyle(r)">
                        <img v-if="commentAvatarUrl(r)" :src="commentAvatarUrl(r)" alt="" />
                        <template v-else>{{ (r.author || '匿').slice(0, 1).toUpperCase() }}</template>
                      </span>
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
      <div v-else-if="navMode === 'library' && !activeLibraryId" class="docs-home docs-home-main docs-lib-home">
        <div class="docs-lib-home-bar">
          <div class="docs-lib-home-label">全部知识库</div>

          <div class="docs-lib-home-actions">
            <a-input
              v-model:value="libraryKeyword"
              allow-clear
              placeholder="搜索知识库"
              class="docs-lib-search"
            >
              <template #prefix><SearchOutlined class="docs-library-search-icon" /></template>
            </a-input>
            <a-dropdown trigger="click" placement="bottomRight">
              <button type="button" class="docs-lib-add" title="新建">
                <PlusOutlined />
                <DownOutlined class="docs-lib-add-caret" />
              </button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="new-library" @click="openCreateLibrary()">新建知识库</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <div class="docs-lib-views" role="group" aria-label="视图">
              <button
                type="button"
                class="docs-lib-view-btn"
                :class="{ active: libraryView === 'grid' }"
                title="卡片视图"
                @click="libraryView = 'grid'"
              ><AppstoreOutlined /></button>
              <button
                type="button"
                class="docs-lib-view-btn"
                :class="{ active: libraryView === 'list' }"
                title="列表视图"
                @click="libraryView = 'list'"
              ><UnorderedListOutlined /></button>
            </div>
          </div>
        </div>

        <!-- 卡片视图：图标 + 名称 + 可见范围锁 + 最近文档 -->
          <div v-if="libraryView === 'grid'" class="docs-lib-cards">
            <div
              v-for="l in libraryList"
              :key="l.id"
              role="button"
              tabindex="0"
              class="docs-lib-card"
              @click="openLibrary(l)"
              @keydown.enter="openLibrary(l)"
            >
              <div class="docs-lib-card-head">
                <ReadOutlined class="docs-lib-card-book" />
                <span class="docs-lib-card-name">{{ l.name }}</span>
                <LockOutlined v-if="l.visibility === 'members'" class="docs-lib-card-lock" title="仅成员可见" />
                <a-dropdown trigger="click" placement="bottomRight" @click.stop>
                  <span class="docs-lib-card-more" @click.stop><MoreOutlined /></span>
                  <template #overlay>
                    <a-menu @click="onLibraryMenu($event, l)">
                      <a-menu-item key="star">{{ l.starred ? '取消置顶' : '置顶' }}</a-menu-item>
                      <a-menu-item key="rename">重命名</a-menu-item>
                      <a-menu-item key="delete" danger>删除知识库</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </div>
              <ul class="docs-lib-recent">
                <li v-for="d in recentDocsOf(l.id)" :key="d.id" class="docs-lib-recent-item">
                  <span class="docs-lib-recent-title">{{ d.title || '无标题文档' }}</span>
                  <span class="docs-lib-recent-time">{{ formatSmartTime(d.updatedAt) }}</span>
                </li>
                <li v-if="!recentDocsOf(l.id).length" class="docs-lib-recent-empty">暂无文档</li>
              </ul>
            </div>
          </div>

          <!-- 列表视图：一行一个知识库 -->
          <div v-else class="docs-lib-rows">
            <div
              v-for="l in libraryList"
              :key="l.id"
              role="button"
              tabindex="0"
              class="docs-lib-row"
              @click="openLibrary(l)"
              @keydown.enter="openLibrary(l)"
            >
              <ReadOutlined class="docs-lib-card-book" />
              <span class="docs-lib-row-name">{{ l.name }}</span>
              <LockOutlined v-if="l.visibility === 'members'" class="docs-lib-card-lock" title="仅成员可见" />
              <span class="docs-lib-row-meta">{{ docsOfLibrary(l) }} 篇文档</span>
              <span class="docs-lib-row-meta">{{ formatSmartTime(l.createdAt) }}</span>
              <a-dropdown trigger="click" placement="bottomRight" @click.stop>
                <span class="docs-lib-card-more" @click.stop><MoreOutlined /></span>
                <template #overlay>
                  <a-menu @click="onLibraryMenu($event, l)">
                    <a-menu-item key="star">{{ l.starred ? '取消置顶' : '置顶' }}</a-menu-item>
                    <a-menu-item key="rename">重命名</a-menu-item>
                    <a-menu-item key="delete" danger>删除知识库</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </div>

          <div v-if="!libraries.length" class="docs-home-empty">还没有知识库，点击右上角「+」新建</div>
          <div v-else-if="!libraryList.length" class="docs-home-empty">没有匹配的知识库</div>
      </div>

      <!-- 文档列表首页 -->
      <div v-else class="docs-home docs-home-main">
        <!-- 知识库内部：面包屑（知识库 / 库名 / 文件夹），与个人主页区分 -->
        <nav v-if="activeLibrary" class="docs-lib-crumb" aria-label="知识库路径">
          <span class="docs-lib-crumb-link" @click="switchNav('library')">知识库</span>
          <span class="docs-lib-crumb-sep">/</span>
          <span
            class="docs-lib-crumb-link"
            :class="{ 'is-current': !activeFolder }"
            @click="activeFolderId = ''"
          >{{ activeLibrary.name }}</span>
          <template v-if="activeFolder">
            <span class="docs-lib-crumb-sep">/</span>
            <span class="docs-lib-crumb-link is-current">{{ activeFolder.name }}</span>
          </template>
        </nav>
        <!-- 快捷入口（参考飞书首页）：第一行 新建文档 / 新建知识库 / 模板中心 / 百宝箱；第二行 AI 对话写文档 / 语雀 Board / 上传 -->
        <div ref="quickCardsRef" class="docs-quick-cards">
          <a-dropdown
            v-model:open="addOpen"
            :trigger="['hover', 'click']"
            placement="bottomLeft"
            overlay-class-name="docs-add-popover docs-quick-popover" :overlay-style="quickMenuStyle"
          >
            <button type="button" class="docs-quick-card" style="order: 1" :class="{ 'is-open': addOpen }">
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
            overlay-class-name="docs-add-popover docs-quick-popover" :overlay-style="quickMenuStyle"
          >
            <button type="button" class="docs-quick-card" style="order: 7" :class="{ 'is-open': uploadOpen }">
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
            overlay-class-name="docs-add-popover docs-quick-popover" :overlay-style="quickMenuStyle"
          >
            <button type="button" class="docs-quick-card" style="order: 3" :class="{ 'is-open': templateOpen }">
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
          <button v-if="!activeLibrary" type="button" class="docs-quick-card" style="order: 2" @click="openCreateLibrary">
            <span class="docs-quick-icon is-newlib"><ReadOutlined /></span>
            <span class="docs-quick-text"><b>新建知识库</b><small>使用知识库整理知识</small></span>
          </button>
        </div>

        <input
          ref="uploadFileInput"
          type="file"
          multiple
          class="docs-upload-input"
          @change="onUploadFilesPicked"
        />
        <input
          ref="uploadFolderInput"
          type="file"
          multiple
          webkitdirectory
          class="docs-upload-input"
          @change="onUploadFolderPicked"
        />

        <h2 class="docs-home-section">文档</h2>
        <div class="docs-home-toolbar">
          <div class="docs-home-tabs">
            <!-- 编辑过 / 浏览过：对应归我所有 / 最近访问；点赞、评论的数据后端暂未提供 -->
            <button type="button" :class="{ active: navMode === 'owned' }" @click="switchNav('owned')">编辑过</button>
            <button type="button" :class="{ active: navMode === 'recent' }" @click="switchNav('recent')">浏览过</button>
            <button type="button" @click="message.info(tr('我点赞的即将开放', 'Liked docs coming soon'))">我点赞的</button>
            <button type="button" @click="message.info(tr('我评论的即将开放', 'Commented docs coming soon'))">我评论的</button>
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
          <tbody>
            <tr v-for="d in listDocs" :key="d.id" @click="openDocInNewPage(d)">
              <td>
                <span class="docs-table-title">
                  <DocTypeIcon :type="d.type" />
                  <span>{{ d.title || '无标题文档' }}</span>
                  <StarFilled v-if="d.starred" class="docs-item-star" />
                </span>
              </td>
              <td class="docs-table-muted">{{ ownerName }} / {{ folderNameOf(d) || '未分组' }}</td>
              <td class="docs-table-muted docs-col-time">{{ formatSmartTime(d.updatedAt) }}</td>
              <td class="docs-col-op" @click.stop>
                <a-dropdown trigger="click" placement="bottomRight">
                  <span class="docs-table-more"><MoreOutlined /></span>
                  <template #overlay>
                    <a-menu @click="onDocMenu($event, d)">
                      <a-menu-item key="star">{{ d.starred ? '取消收藏' : '收藏' }}</a-menu-item>
                      <a-sub-menu key="move" title="移动到">
                        <a-menu-item key="move:none">个人文档（移出知识库）</a-menu-item>
                        <a-menu-item v-for="f in folders" :key="`move:${f.id}`">{{ folderPathLabel(f) }}</a-menu-item>
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
      :title="folderForm.kind === 'library' ? '重命名知识库' : folderForm.id ? '重命名文件夹' : '新建文件夹'"
      :width="360"
      centered
      :footer="null"
      destroy-on-close
      class="docs-folder-modal"
    >
      <a-input
        v-model:value="folderForm.name"
        :placeholder="folderForm.kind === 'library' ? '知识库名称' : '文件夹名称'"
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
      <!-- 问问 AI：把选中的内容交给 AI 润色 / 精简 / 扩写 / 修正（选区在鼠标按下时已保留） -->
      <button type="button" class="docs-bubble-btn is-ai" @click="openAi">
        <RobotOutlined /><span>问问 AI</span>
      </button>
      <span class="docs-bubble-sep" />
      <div class="docs-bubble-group">
        <a-tooltip title="块类型" placement="bottom">
          <button
            type="button"
            class="docs-bubble-btn is-label"
            :class="{ 'is-open': bubble.menu === 'heading' }"
            @click="toggleBubbleMenu('heading')"
          >
            {{ bubble.block }}<DownOutlined class="docs-bubble-caret" />
          </button>
        </a-tooltip>
        <div v-if="bubble.menu === 'heading'" class="docs-bubble-menu is-block-menu">
          <template v-for="o in bubbleBlockTypes" :key="o.key">
            <div v-if="o.divider" class="docs-bubble-menu-divider" />
            <button
              v-else
              type="button"
              class="docs-bubble-menu-item is-block-item"
              :class="{ 'is-active': bubble.blockKey === o.key }"
              @click="applyBubble(o.key)"
            >
              <span class="docs-bubble-block-icon">
                <component :is="o.icon" v-if="o.icon" />
                <template v-else>{{ o.glyph }}</template>
              </span>
              <span class="docs-bubble-block-label">{{ o.label }}</span>
              <CheckOutlined v-if="bubble.blockKey === o.key" class="docs-bubble-block-check" />
            </button>
          </template>
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

      <div class="docs-bubble-group">
        <a-tooltip title="文字颜色" placement="bottom">
          <button
            type="button"
            class="docs-bubble-btn"
            :class="{ 'is-open': bubble.menu === 'fontcolor' }"
            @click="toggleBubbleMenu('fontcolor')"
          >
            <FontColorsOutlined /><DownOutlined class="docs-bubble-caret" />
          </button>
        </a-tooltip>
        <div v-if="bubble.menu === 'fontcolor'" class="docs-bubble-menu is-right docs-bubble-colors">
          <a-tooltip v-for="(c, i) in textColors" :key="c" :title="textColorNames[i]" placement="bottom">
            <button
              type="button"
              class="docs-bubble-color"
              :style="{ background: c }"
              @click="applyBubble('textColor', c)"
            ></button>
          </a-tooltip>
        </div>
      </div>

      <span class="docs-bubble-sep" />
      <a-tooltip title="左对齐" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('align', 'left')"><AlignLeftOutlined /></button>
      </a-tooltip>
      <a-tooltip title="居中对齐" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('align', 'center')"><AlignCenterOutlined /></button>
      </a-tooltip>
      <a-tooltip title="右对齐" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('align', 'right')"><AlignRightOutlined /></button>
      </a-tooltip>

      <span class="docs-bubble-sep" />
      <a-tooltip title="清除格式" placement="bottom">
        <button type="button" class="docs-bubble-btn" @click="applyBubble('clear')"><ClearOutlined /></button>
      </a-tooltip>
    </div>
    </Teleport>

    <!-- 表格工具条：光标在表格里时出现在表格右上方 -->
    <Teleport to="body">
      <div
        v-if="tableTool.visible"
        ref="tableToolRef"
        class="docs-table-tool"
        :style="{ top: tableTool.top + 'px', left: tableTool.left + 'px' }"
        @mousedown.prevent
      >
        <!-- 单元格对齐 -->
        <div class="docs-table-tool-align">
          <button
            type="button"
            class="docs-table-tool-btn is-align"
            :class="{ 'is-on': tableTool.alignOpen }"
            title="单元格对齐"
            @click="tableTool.alignOpen = !tableTool.alignOpen; tableTool.colorOpen = false"
          >
            <component :is="tableAlignIcon" />
            <DownOutlined class="docs-table-tool-caret" />
          </button>
          <div v-if="tableTool.alignOpen" class="docs-table-tool-menu">
            <button
              type="button"
              class="docs-table-tool-menu-item"
              :class="{ 'is-active': tableTool.hAlign === 'left' }"
              @click="applyCellAlign('left')"
            >
              <AlignLeftOutlined /><span>左对齐</span><CheckOutlined v-if="tableTool.hAlign === 'left'" />
            </button>
            <button
              type="button"
              class="docs-table-tool-menu-item"
              :class="{ 'is-active': tableTool.hAlign === 'center' }"
              @click="applyCellAlign('center')"
            >
              <AlignCenterOutlined /><span>居中对齐</span><CheckOutlined v-if="tableTool.hAlign === 'center'" />
            </button>
            <button
              type="button"
              class="docs-table-tool-menu-item"
              :class="{ 'is-active': tableTool.hAlign === 'right' }"
              @click="applyCellAlign('right')"
            >
              <AlignRightOutlined /><span>右对齐</span><CheckOutlined v-if="tableTool.hAlign === 'right'" />
            </button>
            <div class="docs-table-tool-menu-divider" />
            <button
              type="button"
              class="docs-table-tool-menu-item"
              :class="{ 'is-active': tableTool.vAlign === 'top' }"
              @click="applyCellAlign('top')"
            >
              <VerticalAlignTopOutlined /><span>顶端对齐</span><CheckOutlined v-if="tableTool.vAlign === 'top'" />
            </button>
            <button
              type="button"
              class="docs-table-tool-menu-item"
              :class="{ 'is-active': tableTool.vAlign === 'middle' }"
              @click="applyCellAlign('middle')"
            >
              <VerticalAlignMiddleOutlined /><span>垂直居中</span><CheckOutlined v-if="tableTool.vAlign === 'middle'" />
            </button>
            <button
              type="button"
              class="docs-table-tool-menu-item"
              :class="{ 'is-active': tableTool.vAlign === 'bottom' }"
              @click="applyCellAlign('bottom')"
            >
              <VerticalAlignBottomOutlined /><span>底端对齐</span><CheckOutlined v-if="tableTool.vAlign === 'bottom'" />
            </button>
          </div>
        </div>
        <span class="docs-table-tool-sep" />
        <a-tooltip title="标题行" placement="bottom">
          <button
            type="button"
            class="docs-table-tool-btn"
            :class="{ 'is-on': tableTool.header }"
            @click="tableAction('header')"
          ><TableOutlined /></button>
        </a-tooltip>
        <span class="docs-table-tool-sep" />
        <!-- 单元格文字格式 -->
        <a-tooltip title="加粗" placement="bottom">
          <button type="button" class="docs-table-tool-btn" @click="applyTableCellFormat('bold')"><BoldOutlined /></button>
        </a-tooltip>
        <a-tooltip title="删除线" placement="bottom">
          <button type="button" class="docs-table-tool-btn" @click="applyTableCellFormat('strikeThrough')"><StrikethroughOutlined /></button>
        </a-tooltip>
        <a-tooltip title="斜体" placement="bottom">
          <button type="button" class="docs-table-tool-btn" @click="applyTableCellFormat('italic')"><ItalicOutlined /></button>
        </a-tooltip>
        <a-tooltip title="下划线" placement="bottom">
          <button type="button" class="docs-table-tool-btn" @click="applyTableCellFormat('underline')"><UnderlineOutlined /></button>
        </a-tooltip>
        <a-tooltip title="行内代码" placement="bottom">
          <button type="button" class="docs-table-tool-btn" @click="applyTableCellFormat('inline-code')"><CodeOutlined /></button>
        </a-tooltip>
        <div class="docs-table-tool-color-wrap">
          <button
            type="button"
            class="docs-table-tool-btn is-align"
            :class="{ 'is-on': tableTool.colorOpen }"
            title="文字背景"
            @click="tableTool.colorOpen = !tableTool.colorOpen; tableTool.alignOpen = false; tableTool.fontColorOpen = false; tableTool.cellBgOpen = false"
          >
            <HighlightOutlined /><DownOutlined class="docs-table-tool-caret" />
          </button>
          <div v-if="tableTool.colorOpen" class="docs-table-tool-menu is-color">
            <div class="docs-table-tool-colors">
              <button
                v-for="c in bubbleColors"
                :key="c"
                type="button"
                class="docs-table-tool-color"
                :style="{ background: c }"
                :title="c"
                @click="applyTableCellFormat('hilite', c)"
              />
            </div>
            <button type="button" class="docs-table-tool-menu-item" @click="applyTableCellFormat('unhighlight')">
              <ClearOutlined /><span>清除高亮</span>
            </button>
          </div>
        </div>
        <div class="docs-table-tool-color-wrap">
          <button
            type="button"
            class="docs-table-tool-btn is-align"
            :class="{ 'is-on': tableTool.fontColorOpen }"
            title="文字颜色"
            @click="toggleTableMenu('fontColorOpen')"
          >
            <FontColorsOutlined /><DownOutlined class="docs-table-tool-caret" />
          </button>
          <div v-if="tableTool.fontColorOpen" class="docs-table-tool-menu is-color">
            <div class="docs-table-tool-colors">
              <button
                v-for="(c, i) in textColors"
                :key="c"
                type="button"
                class="docs-table-tool-color"
                :style="{ background: c }"
                :title="textColorNames[i]"
                @click="applyTableCellFormat('textColor', c)"
              />
            </div>
          </div>
        </div>
        <div class="docs-table-tool-color-wrap">
          <button
            type="button"
            class="docs-table-tool-btn is-align"
            :class="{ 'is-on': tableTool.cellBgOpen }"
            title="单元格背景色"
            @click="toggleTableMenu('cellBgOpen')"
          >
            <BgColorsOutlined /><DownOutlined class="docs-table-tool-caret" />
          </button>
          <div v-if="tableTool.cellBgOpen" class="docs-table-tool-menu is-color">
            <div class="docs-table-tool-colors">
              <button
                v-for="(c, i) in cellBgColors"
                :key="c"
                type="button"
                class="docs-table-tool-color"
                :style="{ background: c }"
                :title="cellBgColorNames[i]"
                @click="applyTableCellFormat('cellBg', c)"
              />
            </div>
            <button type="button" class="docs-table-tool-menu-item" @click="applyTableCellFormat('cellBg', '')">
              <ClearOutlined /><span>清除背景</span>
            </button>
          </div>
        </div>
        <span class="docs-table-tool-sep" />
        <a-tooltip :title="tableDeleteTip" placement="bottom">
          <button type="button" class="docs-table-tool-btn is-danger" @click="deleteTableOrSelection"><DeleteOutlined /></button>
        </a-tooltip>
      </div>
    </Teleport>

    <!-- 表格行快捷插入：悬停单元格时在表格左侧出现 +，当前行显示蓝色顶线 -->
    <Teleport to="body">
      <div v-if="tableEdge.visible" class="docs-table-edge" aria-hidden="true">
        <div
          class="docs-table-frame-left"
          :style="{
            top: tableEdge.frameTop + 'px',
            left: tableEdge.frameLeft - 16 + 'px',
            height: tableEdge.frameHeight + 'px',
          }"
        />
        <div
          class="docs-table-frame-top"
          :style="{
            top: tableEdge.frameTop - 16 + 'px',
            left: tableEdge.frameLeft + 'px',
            width: tableEdge.frameWidth + 'px',
          }"
        />
        <div
          class="docs-table-frame-right"
          :style="{
            top: tableEdge.frameTop + 'px',
            left: tableEdge.frameLeft + tableEdge.frameWidth + 'px',
            height: tableEdge.frameHeight + 'px',
          }"
        />
        <!-- 行 / 列悬停与选中高亮 -->
        <div
          v-if="tableFrameHover.row >= 0"
          class="docs-table-frame-hover"
          :style="tableFrameRowStyle(tableFrameHover.row)"
        />
        <div
          v-if="tableFrameHover.col >= 0"
          class="docs-table-frame-hover"
          :style="tableFrameColStyle(tableFrameHover.col)"
        />
        <!-- 左侧 / 右侧边条：逐行悬停、点击选中整行 -->
        <button
          v-for="(r, i) in tableEdge.rows"
          :key="`edge-row-l-${i}`"
          type="button"
          class="docs-table-frame-seg"
          :style="{ top: r.top + 'px', left: tableEdge.frameLeft - 16 + 'px', width: '16px', height: r.height + 'px' }"
          @mousedown.prevent
          @mouseenter="onFrameHover('row', i)"
          @mouseleave="onFrameLeave('row')"
          @click="selectTableRow(i)"
        ><span class="docs-table-frame-dot" /></button>
        <button
          v-for="(r, i) in tableEdge.rows"
          :key="`edge-row-r-${i}`"
          type="button"
          class="docs-table-frame-seg"
          :style="{
            top: r.top + 'px',
            left: tableEdge.frameLeft + tableEdge.frameWidth + 'px',
            width: '16px',
            height: r.height + 'px',
          }"
          @mousedown.prevent
          @mouseenter="onFrameHover('row', i)"
          @mouseleave="onFrameLeave('row')"
          @click="selectTableRow(i)"
        ><span class="docs-table-frame-dot" /></button>
        <!-- 顶部边条：逐列悬停、点击选中整列 -->
        <button
          v-for="(c, i) in tableEdge.cols"
          :key="`edge-col-${i}`"
          type="button"
          class="docs-table-frame-seg"
          :style="{
            top: tableEdge.frameTop - 16 + 'px',
            left: c.left + 'px',
            width: c.width + 'px',
            height: '16px',
          }"
          @mousedown.prevent
          @mouseenter="onFrameHover('col', i)"
          @mouseleave="onFrameLeave('col')"
          @click="selectTableColumn(i)"
        ><span class="docs-table-frame-dot" /></button>
        <div
          v-if="tableEdge.hoverRow >= 0"
          class="docs-table-edge-rowline"
          :style="{
            top: tableEdge.rowLineTop + 'px',
            left: tableEdge.rowLineLeft + 'px',
            width: tableEdge.rowLineWidth + 'px',
          }"
        />
      </div>
    </Teleport>

    <!-- 角上的 + 单独一层，避免被表格工具条 / 灰色边条挡住点击 -->
    <Teleport to="body">
      <div v-if="tableEdge.visible" class="docs-table-edge-actions">
        <button
          v-if="tableEdge.hoverRow >= 0"
          type="button"
          class="docs-table-edge-plus"
          title="插入行"
          :style="{ top: tableEdge.rowPlusTop + 'px', left: tableEdge.rowPlusLeft + 'px' }"
          @mousedown.prevent
          @mouseenter="onEdgePlusEnter"
          @mouseleave="onEdgePlusLeave"
          @click="appendRowAtEdge"
        ><PlusOutlined /></button>
        <button
          v-if="tableEdge.hoverCol >= 0"
          type="button"
          class="docs-table-edge-plus"
          title="插入列"
          :style="{ top: tableEdge.colPlusTop + 'px', left: tableEdge.colPlusLeft + 'px' }"
          @mousedown.prevent
          @mouseenter="onEdgePlusEnter"
          @mouseleave="onEdgePlusLeave"
          @click="appendColumnAtEdge"
        ><PlusOutlined /></button>
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
            <span v-else class="docs-slash-glyph" :class="{ 'is-quote': it.key === 'quote' }">{{ it.glyph }}</span>
          </span>
          <span class="docs-slash-label">{{ it.label }}</span>
        </button>
        <div v-if="!slashFiltered.length" class="docs-slash-empty">没有匹配的插入项</div>
      </div>
    </Teleport>
  </div>
  </template>
  <!-- 详情接口返回前不渲染文档页（加载遮罩由 App.vue 全局显示），避免先显示主页菜单再切换 -->
  <div v-else class="docs-page-pending" aria-busy="true" />
</template>

<style scoped>
/* 主页 ↔ 知识库列表切换：新列表挂载时淡入并轻微上浮（不闪白，也不需要等待旧页面离开） */
@keyframes docs-list-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.docs-home-main {
  animation: docs-list-enter 0.24s cubic-bezier(0.25, 0.1, 0.25, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .docs-home-main {
    animation: none;
  }
}
.docs-page-pending {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
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
  flex: 0 0 240px;
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
  font-weight: 400;
}
/* 「我的文档库」可折叠：标题右侧箭头，展开时朝下 */
.docs-collapsible {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  border-radius: var(--docs-radius-sm);
}
.docs-collapsible:hover {
  color: var(--docs-text-2);
}
.docs-group-caret {
  display: inline-flex;
  font-size: 10px;
  transition: transform 0.2s var(--docs-ease);
}
.docs-group-caret.open {
  transform: rotate(90deg);
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
/* 知识库卡片右上角的更多菜单（置顶 / 重命名 / 删除） */
.docs-library-more {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--docs-text-2);
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}
.docs-library-more:hover {
  color: var(--docs-text);
  background: #fff;
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
/* 「知识库」行：导航按钮 + 右侧展开箭头 */
.docs-nav-row {
  position: relative;
  display: flex;
  align-items: center;
}
.docs-nav-row > .docs-nav-item {
  flex: 1;
  min-width: 0;
}
.docs-nav-caret {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 11px;
  color: var(--docs-text-3);
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: transform 0.15s, background 0.12s;
}
.docs-nav-caret:hover {
  background: var(--docs-hover);
  color: var(--docs-text);
}
.docs-nav-caret.open {
  transform: translateY(-50%) rotate(90deg);
}
/* 知识库下的列表（缩进） */
.docs-nav-libs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 14px;
}
.docs-nav-sub {
  display: flex;
  align-items: center;
  width: 100%;
  height: 30px;
  padding: 0 10px;
  font-size: 14px;
  color: var(--docs-text-2);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.docs-nav-sub:hover {
  background: var(--docs-hover);
  color: var(--docs-text);
}
.docs-nav-sub.active {
  color: var(--docs-selected-fg);
  background: var(--docs-selected);
}
.docs-nav-sub-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-nav-sub-empty {
  padding: 4px 10px;
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-nav-item:hover {
  background: var(--docs-hover);
}
.docs-nav-item.active {
  color: var(--docs-selected-fg);
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

/* 侧栏：打开知识库时的标题行（返回知识库列表） */
.docs-library-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 6px 8px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--docs-text);
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.docs-library-head:hover {
  background: var(--docs-hover);
}
.docs-library-back {
  flex: none;
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-library-head-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-pinned-cover {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

/* 知识库内部面包屑：知识库 / 库名 / 文件夹 */
.docs-lib-crumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0 12px;
  font-size: 14px;
  color: var(--docs-text-3);
}
.docs-lib-crumb-link {
  cursor: pointer;
  color: var(--docs-text-2);
}
.docs-lib-crumb-link:hover {
  color: var(--docs-text);
}
.docs-lib-crumb-link.is-current {
  color: var(--docs-text);
  font-weight: 600;
  cursor: default;
}
.docs-lib-crumb-sep {
  color: var(--docs-text-3);
}

/* ---- 知识库首页（参考：标题 / 范围切换 / 卡片网格） ---- */
.docs-lib-home {
  padding: 28px 40px 40px;
  box-sizing: border-box;
}
.docs-lib-home-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
/* 首页左上角标签：全部知识库 */
.docs-lib-home-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-lib-home-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.docs-lib-search {
  width: 200px;
}
.docs-lib-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  font-size: 16px;
  color: var(--docs-text);
  background: #fff;
  border: 1px solid var(--docs-border);
  border-radius: 10px;
  cursor: pointer;
}
.docs-lib-add:hover {
  border-color: var(--docs-border-strong);
}
.docs-lib-add-caret {
  font-size: 12px;
  color: var(--docs-text-3);
}
/* 视图切换：卡片 / 列表 */
.docs-lib-views {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  gap: 2px;
  border-left: 1px solid var(--docs-border);
  margin-left: 4px;
  padding-left: 8px;
}
.docs-lib-view-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-size: 16px;
  color: var(--docs-text-3);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.docs-lib-view-btn.active {
  color: var(--docs-text);
  background: #f2f3f5;
}
.docs-lib-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.docs-lib-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 220px;
  padding: 20px 22px;
  background: #fff;
  border: 1px solid #ebedf0;
  border-radius: 12px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.docs-lib-card:hover {
  border-color: #d5d9e0;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.07);
}
.docs-lib-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.docs-lib-card-book {
  flex: none;
  font-size: 22px;
  color: #3370ff;
}
.docs-lib-card-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 500;
  color: var(--docs-text);
}
.docs-lib-card-lock {
  flex: none;
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-lib-card-more {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--docs-text-3);
  border-radius: 8px;
  cursor: pointer;
}
.docs-lib-card-more:hover {
  color: var(--docs-text);
  background: #f2f3f5;
}
.docs-lib-recent {
  flex: 1;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}
.docs-lib-recent-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0 6px 14px;
  font-size: 14px;
  color: var(--docs-text-3);
}
.docs-lib-recent-item::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 50%;
  width: 4px;
  height: 4px;
  margin-top: -2px;
  border-radius: 50%;
  background: #9aa0a6;
}
.docs-lib-recent-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-lib-recent-time {
  flex: none;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.docs-lib-recent-empty {
  padding: 6px 0 6px 14px;
  font-size: 14px;
  color: var(--docs-text-3);
}
/* 列表视图 */
.docs-lib-rows {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebedf0;
  border-radius: 12px;
  overflow: hidden;
}
.docs-lib-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  cursor: pointer;
}
.docs-lib-row + .docs-lib-row {
  border-top: 1px solid #f0f1f3;
}
.docs-lib-row:hover {
  background: #fafbfc;
}
.docs-lib-row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  color: var(--docs-text);
}
.docs-lib-row-meta {
  flex: none;
  font-size: 13px;
  color: var(--docs-text-3);
  font-variant-numeric: tabular-nums;
}

/* 「新建知识库」占位：虚线框，放在卡片 / 列表底部 */
.docs-lib-card-new {
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  font-size: 15px;
  color: var(--docs-text-2);
  background: transparent;
  border: 1px dashed #d5d9e0;
  box-shadow: none;
  font-family: inherit;
}
.docs-lib-card-new:hover {
  color: #3370ff;
  border-color: #3370ff;
  box-shadow: none;
  transform: none;
}
.docs-lib-card-new-icon {
  font-size: 22px;
}
.docs-lib-row-new {
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  font-family: inherit;
  width: 100%;
  cursor: pointer;
}
.docs-lib-row-new:hover {
  color: #3370ff;
}

@media (max-width: 720px) {
  .docs-lib-home {
    padding: 20px 16px 32px;
  }
  .docs-lib-search {
    width: 140px;
  }
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
  color: var(--docs-selected-fg);
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
  grid-template-columns: minmax(0, 1fr) 48px;
}
/* 没有评论时评论栏整栏隐藏，正文占满（比收起态的 44px 窄条优先级更高） */
.docs-doc-scroll.is-scrollable.is-comments-hidden,
.docs-doc-scroll.is-scrollable.is-comments-hidden.is-comments-collapsed {
  grid-template-columns: minmax(0, 1fr);
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
  background: var(--comment-surface);
  border-left: 1px solid var(--docs-border);
  /* clip 不会创建滚动容器，底部输入框可以用 sticky 固定在视口底部 */
  overflow: clip;
}
/* 收起时列宽由外层 grid 控制（.is-comments-collapsed），这里只调整头部 */
.docs-comment-rail.is-collapsed {
  min-width: 0;
  border-left: none;
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
/* 折叠态：标记贴在被评论的那一行上（左右居中于 44px 的折叠条） */
/* 黄色评论气泡：数量写在气泡里，底部带小尾巴，指向所评论的那一行 */
.docs-comment-marker {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 22px;
  font-weight: 600;
  text-align: center;
  color: #fff;
  background: #ffc60a;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  box-sizing: border-box;
}
.docs-comment-marker::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -5px;
  margin-left: -5px;
  border-width: 5px 5px 0;
  border-style: solid;
  border-color: #ffc60a transparent transparent;
}
.docs-comment-marker:hover {
  background: #ffb800;
}
.docs-comment-marker:hover::after {
  border-top-color: #ffb800;
}
.docs-comment-icon-btn:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
/* 评论列表不单独滚动：高度随内容撑开，和正文一起由外层容器滚动 */
.docs-comment-list {
  position: relative;
  flex: 1 0 auto;
}
/* 卡片绝对定位：顶端由 layoutCommentCards 对齐到被评论的文字 */
.docs-comment-card {
  position: absolute;
  left: 12px;
  right: 12px;
  padding: 10px 12px;
  background: var(--comment-surface);
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
  overflow: hidden;
  font-size: 11px;
  color: #fff;
  border-radius: 50%;
}
.docs-comment-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.docs-comment-avatar.is-small {
  width: 18px;
  height: 18px;
  font-size: 10px;
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
  background: var(--comment-surface);
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
/* 评论高亮默认隐藏：仅在悬停或点击对应评论时显示 */
.docs-comment-hl {
  opacity: 0;
}
.docs-comment-hl.is-visible {
  opacity: 1;
}
/* 行右侧的评论入口：外层命中区延伸到正文边缘，避免鼠标经过空白时悬停状态丢失 */
.docs-line-comment-hit {
  position: absolute;
  /* 图标整体右移 16px；命中区向左延伸回正文边缘，鼠标移动过程中不会丢失悬停 */
  right: -56px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 58px;
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
/* 折叠态评论栏的展开按钮：贴住右侧边缘，像从右侧长出来的标签（只有左 / 上 / 下边框，左侧圆角） */
.docs-comment-rail.is-collapsed .docs-comment-rail-head {
  justify-content: flex-end;
  padding: 18px 0 8px;
}
.docs-line-comment.is-bordered {
  width: 48px;
  height: 40px;
  margin: 0;
  color: var(--docs-text-2);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-right: none;
  border-radius: 18px 0 0 18px;
  box-shadow: -2px 0 6px rgba(0, 0, 0, 0.04);
}
.docs-line-comment.is-bordered:hover {
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
  background: var(--comment-surface);
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
  background: var(--comment-surface);
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
/* 点赞图标：黄色线性大拇指，无圆圈、无底色；悬停微微上浮，点赞后实心 */
.docs-doc-like-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 40px;
  line-height: 1;
  color: #faad14;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: transform 0.15s;
}
.docs-doc-like-btn:hover {
  transform: translateY(-2px);
}
.docs-doc-like-slogan {
  font-size: 15px;
  color: var(--docs-text-3);
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
  background: var(--comment-surface);
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
  background: var(--comment-surface);
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
  overflow: hidden;
  font-size: 13px;
  color: #fff;
  border-radius: 50%;
  user-select: none;
}
.docs-doc-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  width: 28px;
  height: 28px;
  font-size: 14px;
  color: #646a73;
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.docs-block-plus.is-heading {
  right: calc(100% - var(--docs-gutter) + 24px);
}
/* 表格：左侧有灰色行头边条，手柄整体左移，落在左上角夹角外侧 */
.docs-block-plus.is-table {
  right: calc(100% - var(--docs-gutter) + 22px);
}
/* 鼠标悬停 / 菜单展开时底色变深 */
.docs-block-plus:hover,
.docs-block-plus.is-open {
  color: #1f2329;
  background: #f2f3f5;
  border-color: #d0d3d6;
}
.docs-block-plus.is-block {
  gap: 4px;
  width: auto;
  padding: 0 6px 0 7px;
}
.docs-block-plus-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  color: #3370ff;
  white-space: nowrap;
}
/* 引用手柄的双引号放大一点 */
.docs-block-plus-label.is-quote {
  font-size: 18px;
  line-height: 1;
}
/* 高亮块手柄：用图标代替「高亮」文字，尺寸与其它块类型标识一致 */
.docs-block-plus-label-icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  line-height: 1;
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
  font-size: 13px;
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
  height: 36px;
  font-size: 18px;
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
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
/* 双引号字形本身偏小，单独放大一档 */
.docs-insert-glyph.is-quote {
  font-size: 20px;
  line-height: 1;
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
  font-size: 18px;
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
  width: 28px;
  height: 28px;
  padding: 5px;
  font-size: 17px;
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
/* 表格插入：悬停选择行列数 */
.docs-table-picker {
  padding: 2px 2px 4px;
}
.docs-table-picker-row {
  display: flex;
  gap: 3px;
  margin-bottom: 3px;
}
.docs-table-picker-cell {
  width: 18px;
  height: 18px;
  padding: 0;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}
.docs-table-picker-cell.is-on {
  background: color-mix(in srgb, var(--c-primary) 14%, transparent);
  border-color: var(--c-primary);
}
.docs-table-picker-label {
  margin-top: 2px;
  font-size: 12px;
  color: var(--docs-text-3);
  text-align: center;
}
/* 分栏插入：图形化选栏数，每个缩略图的竖条数即栏数 */
.docs-cols-picker {
  width: 220px;
  padding: 4px 2px 2px;
}
.docs-cols-picker-title {
  padding: 0 4px 8px;
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-cols-picker-box {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: var(--docs-side-bg);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius);
}
.docs-cols-picker-opt {
  flex: 1;
  display: flex;
  gap: 3px;
  height: 56px;
  padding: 6px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.1s;
}
.docs-cols-picker-opt.is-on {
  border-color: var(--c-primary);
}
.docs-cols-picker-bar {
  flex: 1;
  min-width: 0;
  background: var(--docs-hover);
  border-radius: 2px;
  transition: background 0.1s;
}
.docs-cols-picker-bar.is-on {
  background: color-mix(in srgb, var(--c-primary) 16%, transparent);
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
.docs-slash-glyph.is-quote {
  font-size: 16px;
  line-height: 1;
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
/* 气泡工具条最左侧：问问 AI（图标 + 文字，主色突出） */
.docs-bubble-btn.is-ai {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: auto;
  padding: 0 8px;
  font-size: 13px;
  color: var(--c-primary);
  font-weight: 500;
  white-space: nowrap;
}
.docs-bubble-btn.is-ai:hover {
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
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
/* 块类型下拉：图标 + 名称 + 当前类型勾选 */
.docs-bubble-menu.is-block-menu {
  min-width: 214px;
  max-height: 60vh;
  padding: 8px 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.docs-bubble-menu-item.is-block-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  font-size: 14px;
}
.docs-bubble-menu-item.is-block-item.is-active {
  color: var(--c-primary);
  background: transparent;
}
.docs-bubble-block-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--docs-text-2);
}
.docs-bubble-menu-item.is-block-item.is-active .docs-bubble-block-icon {
  color: var(--c-primary);
}
.docs-bubble-block-label {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.docs-bubble-block-check {
  flex: none;
  font-size: 13px;
  color: var(--c-primary);
}
.docs-bubble-menu-divider {
  height: 1px;
  margin: 6px 4px;
  background: var(--docs-border);
}
/* 表格工具条（光标在表格里时出现） */
.docs-table-tool {
  position: fixed;
  z-index: 1400;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-xl);
  box-shadow: var(--docs-shadow-float);
}
.docs-table-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 16px;
  color: var(--docs-text-2);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius-sm);
  transition: color 0.12s, background 0.12s;
}
.docs-table-tool-btn:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.docs-table-tool-btn.is-on {
  color: var(--c-primary);
  background: var(--c-primary-bg);
}
.docs-table-tool-btn.is-danger:hover {
  color: var(--docs-danger);
  background: color-mix(in srgb, var(--docs-danger) 8%, transparent);
}
.docs-table-tool-sep {
  width: 1px;
  height: 20px;
  margin: 0 5px;
  background: var(--docs-border);
}
/* 单元格对齐 / 高亮颜色下拉 */
.docs-table-tool-align,
.docs-table-tool-color-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.docs-table-tool-btn.is-align {
  width: 44px;
  gap: 2px;
}
.docs-table-tool-caret {
  font-size: 9px;
  opacity: 0.7;
}
.docs-table-tool-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 2;
  width: 200px;
  padding: 6px;
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
}
.docs-table-tool-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 34px;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  line-height: 1;
  color: var(--docs-text);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius-sm);
}
.docs-table-tool-menu-item > .anticon {
  flex: none;
  font-size: 14px;
}
.docs-table-tool-menu-item span {
  flex: 1;
  min-width: 0;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
}
.docs-table-tool-menu-item:hover {
  background: var(--docs-hover);
}
.docs-table-tool-menu-item.is-active {
  color: var(--c-primary);
}
.docs-table-tool-menu-divider {
  height: 1px;
  margin: 6px 4px;
  background: var(--docs-border);
}
/* 高亮颜色菜单 */
.docs-table-tool-menu.is-color {
  width: 176px;
}
.docs-table-tool-colors {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}
.docs-table-tool-color {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 50%;
  cursor: pointer;
}
/* 表格行快捷插入（悬停单元格时出现） */
.docs-table-edge {
  position: fixed;
  inset: 0;
  z-index: 1390;
  pointer-events: none;
}
/* 表格外侧浅灰边条 + 行列小圆点（只在悬停 / 选中表格时出现） */
.docs-table-frame-left {
  position: absolute;
  width: 16px;
  background: var(--docs-side-bg);
  border-radius: 6px 0 0 6px;
}
.docs-table-frame-top {
  position: absolute;
  height: 16px;
  background: var(--docs-side-bg);
  border-radius: 6px 6px 0 0;
}
.docs-table-frame-right {
  position: absolute;
  width: 16px;
  background: var(--docs-side-bg);
  border-radius: 0 6px 6px 0;
}
/* 边条上逐行 / 逐列的命中区（透明，悬停时给对应行 / 列加浅蓝高亮） */
.docs-table-frame-seg {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  pointer-events: auto;
  background: transparent;
  border: none;
}
.docs-table-frame-seg:hover {
  background: color-mix(in srgb, var(--c-primary) 6%, transparent);
}
.docs-table-frame-dot {
  width: 4px;
  height: 4px;
  background: #c3c6cc;
  border-radius: 50%;
  pointer-events: none;
}
.docs-table-frame-hover {
  position: absolute;
  pointer-events: none;
  background: color-mix(in srgb, var(--c-primary) 6%, transparent);
}
/* 选中的整行 / 整列：作为单元格底色遮罩，文字颜色保持不变 */
.docs-editor :deep(.docs-insert-table tr.docs-row-selected > td),
.docs-editor :deep(.docs-insert-table.docs-table-header tr.docs-row-selected > td),
.docs-editor :deep(.docs-insert-table td.docs-col-selected) {
  background: color-mix(in srgb, var(--c-primary) 20%, transparent);
}
.docs-table-edge-rowline {
  position: absolute;
  height: 2px;
  background: var(--c-primary);
  border-radius: 1px;
  opacity: 0.9;
}
.docs-table-edge-actions {
  position: fixed;
  inset: 0;
  z-index: 1500;
  pointer-events: none;
}
/* 角上的 +：蓝色圆形按钮（参考截图） */
.docs-table-edge-plus {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 12px;
  color: #fff;
  cursor: pointer;
  pointer-events: auto;
  background: var(--c-primary);
  border: none;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  transition: background 0.12s, transform 0.12s;
}
.docs-table-edge-plus:hover {
  background: var(--c-primary-active);
  transform: scale(1.06);
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
  font-size: 16px;
  line-height: 1.8;
  letter-spacing: 0.1px;
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
/* 空块占位（对标飞书）：该行还没有内容时，显示灰色的块类型（H1 / H2 / H3）；
   引用不显示占位文字；浮动且不占高度，不会把光标挤到下一行；输入内容后消失 */
.docs-editor :deep([data-empty]::before) {
  float: left;
  height: 0;
  color: #bbbfc4;
  pointer-events: none;
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
  margin: 40px 0 14px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.3px;
}
.docs-editor :deep(h2) {
  margin: 34px 0 12px;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: -0.2px;
}
.docs-editor :deep(h3) {
  margin: 28px 0 10px;
  font-size: 19px;
  font-weight: 650;
  line-height: 1.4;
}
/* "+"插入的富文本元素 */
/* 所有块：悬停正文内容不显示背景色，只有悬停左侧块手柄时才显示整行背景（浅蓝） */
.docs-editor-wrap.is-edit .docs-editor :deep(.is-handle-hover) {
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
  border-radius: var(--docs-radius-sm);
}
.docs-editor :deep(.docs-img) {
  display: block;
  max-width: 100%;
  margin: 12px 0;
  border-radius: var(--docs-radius);
}
/* 任务列表（参考飞书）：块级排版 + 绝对定位勾选框，文字保持行内排版，光标高度与文字一致 */
/* 任务行参考飞书：整行有上下内边距，悬停时是一块圆角浅灰背景 */
.docs-editor :deep(.docs-todo) {
  position: relative;
  margin: 2px 0;
  padding: 5px 10px 5px 32px;
  border-radius: 6px;
  box-sizing: border-box;
}
/* 空任务也要占一行高度，否则新建任务时没有行盒，光标不可见 */
.docs-editor :deep(.docs-todo-text:empty) {
  display: inline-block;
  min-width: 1px;
  height: 1.75em;
  vertical-align: top;
}
.docs-editor :deep(.docs-todo-box) {
  position: absolute;
  /* 勾选框 18px，右缘 26px；文字从 32px 开始，间距 6px */
  left: 8px;
  top: 9px;
  width: 18px;
  height: 18px;
  box-sizing: border-box;
  background: var(--docs-canvas);
  border: 1.5px solid #c9ccd1;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
}
/* 未勾选悬停：描边变主题色 + 淡光环 */
.docs-editor :deep(.docs-todo-box:hover) {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 10%, transparent);
}
/* 勾选后：白色底 + 主题蓝对勾 */
.docs-editor :deep(.docs-todo.is-done .docs-todo-box) {
  background: var(--docs-canvas);
  border-color: var(--c-primary);
}
/* CSS 画对勾（伪元素不参与 innerHTML 保存，不会污染文档内容） */
.docs-editor :deep(.docs-todo.is-done .docs-todo-box)::after {
  content: '';
  position: absolute;
  left: 4.5px;
  top: 2px;
  width: 4.5px;
  height: 8px;
  border: solid var(--c-primary);
  border-width: 0 1.8px 1.8px 0;
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
  background: var(--docs-canvas);
}
.docs-editor :deep(.docs-insert-table td),
.docs-editor :deep(.docs-insert-table th) {
  min-width: 40px;
  padding: 7px 10px;
  vertical-align: top;
  border: 1px solid var(--docs-border);
  line-height: 1.6;
}
/* 标题行：首行浅灰底 + 加粗 */
.docs-editor :deep(.docs-insert-table.docs-table-header tr:first-child td),
.docs-editor :deep(.docs-insert-table.docs-table-header tr:first-child th) {
  font-weight: 600;
  background: var(--docs-side-bg);
}
/* 光标所在单元格描边 */
.docs-editor :deep(.docs-insert-table td.docs-cell-active),
.docs-editor :deep(.docs-insert-table th.docs-cell-active) {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c-primary) 60%, transparent);
}
/* 分栏（参考飞书）：栏与栏之间用细缝分隔，悬停缝显示拖拽线，拖动调宽 */
.docs-editor :deep(.docs-cols) {
  position: relative;
  display: grid;
  gap: 12px;
  margin: 12px 0;
}
.docs-editor :deep(.docs-col) {
  min-width: 0;
  min-height: 44px;
  padding: 4px 8px;
  background: var(--docs-side-bg);
  border-radius: var(--docs-radius);
  transition: background-color 0.15s;
}
.docs-editor :deep(.docs-col > :first-child) {
  margin-top: 0;
}
.docs-editor :deep(.docs-col > :last-child) {
  margin-bottom: 0;
}
/* 编辑态下分栏边界一直可见（浅色虚线），悬停时再加底色 */
.docs-editor-wrap.is-edit .docs-editor :deep(.docs-col) {
  border: 1px dashed var(--docs-border);
}
.docs-editor-wrap.is-edit .docs-editor :deep(.docs-col:hover) {
  background: color-mix(in srgb, var(--docs-side-bg) 88%, #000);
}
.docs-editor :deep(.docs-cols.is-resize-hover::after),
.docs-editor :deep(.docs-cols.is-resizing::after) {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--resize-x, 0);
  width: 2px;
  margin-left: -1px;
  border-radius: 2px;
  background: var(--c-primary);
  pointer-events: none;
}
.docs-editor :deep(.docs-cols.is-resizing) {
  cursor: col-resize;
}
/* 窄屏（手机 / 窄窗口）：分栏自动上下堆叠，不再拖拽 */
@media (max-width: 720px) {
  .docs-editor :deep(.docs-cols) {
    grid-template-columns: minmax(0, 1fr) !important;
  }
}
/* 修订：待处理修订的块用绿色底 + 左侧色条标出；块前的修订条给出类型、预览与接受 / 拒绝 */
.docs-editor :deep(.docs-suggest-ins) {
  background: color-mix(in srgb, #52c41a 10%, transparent);
  box-shadow: inset 3px 0 0 #52c41a;
  border-radius: var(--docs-radius-sm);
}
.docs-editor :deep(.docs-suggest-bar) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--docs-text-2);
  background: var(--docs-side-bg);
  border-radius: var(--docs-radius);
  user-select: none;
}
.docs-editor :deep(.docs-suggest-label) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-editor :deep(.docs-suggest-btn) {
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--docs-text-2);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
}
.docs-editor :deep(.docs-suggest-btn.is-primary) {
  color: #fff;
  background: var(--c-primary);
  border-color: var(--c-primary);
}
.docs-suggest-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--docs-text-2);
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
  border-radius: var(--docs-radius);
}
.docs-suggest-banner-text {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--c-primary);
}
.docs-suggest-banner-btn {
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--docs-text-2);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
}
.docs-suggest-banner-btn.is-primary {
  color: #fff;
  background: var(--c-primary);
  border-color: var(--c-primary);
}
/* 项目管理：事项卡片（编号 + 标题 + 状态），整张卡可点击打开事项详情 */
.docs-editor :deep(.docs-issue-card) {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--docs-text);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-left: 3px solid var(--c-primary);
  border-radius: var(--docs-radius);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}
.docs-editor :deep(.docs-issue-card:hover) {
  background: var(--docs-hover);
}
.docs-editor :deep(.docs-issue-key) {
  flex: none;
  color: var(--c-primary);
  font-weight: 500;
}
.docs-editor :deep(.docs-issue-title) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-editor :deep(.docs-issue-status) {
  flex: none;
  font-size: 12px;
  color: var(--docs-text-2);
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
  margin: 0 0 12px;
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
  margin: 12px 0;
  padding-left: 26px;
}
/* 有序列表序号 / 无序列表圆点显示为主题蓝 */
.docs-editor :deep(ol li)::marker,
.docs-editor :deep(ul li)::marker {
  color: var(--c-primary);
  font-weight: 600;
}
.docs-editor :deep(li) {
  margin: 4px 0;
}
.docs-editor :deep(blockquote) {
  margin: 14px 0;
  padding: 10px 14px;
  color: var(--docs-text-2);
  background: var(--docs-side-bg);
  border-left: 3px solid color-mix(in srgb, var(--c-primary) 60%, transparent);
  border-radius: 0 8px 8px 0;
}
/* 代码块：顶部语言栏 + 正文的浅色卡片 */
.docs-editor :deep(pre) {
  position: relative;
  /* 左侧预留行号栏（38px），正文与彩色层从行号栏右侧开始 */
  --docs-code-gutter: 38px;
  /* 上下留白交给语言栏和底部 padding，左右与语言栏负 margin 对齐 */
  margin: 16px 0;
  padding: 0 16px 14px calc(16px + var(--docs-code-gutter));
  /* 默认至少展示 2 行高度（语言栏 36 + 间距 12 + 2 行代码 + 底部 14 + 边框） */
  min-height: calc(64px + 3.4em);
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
  left: calc(16px + var(--docs-code-gutter));
  z-index: 0;
  color: var(--docs-text);
  white-space: inherit;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  counter-reset: code-line;
}
/* 每行一个块：空行也保留行高，行号用计数器画在左侧行号栏里 */
.docs-editor :deep(.docs-code-line) {
  position: relative;
  min-height: 1.7em;
}
.docs-editor :deep(.docs-code-line)::before {
  counter-increment: code-line;
  content: counter(code-line);
  position: absolute;
  top: 0;
  right: calc(100% + 10px);
  width: 26px;
  font-size: 12px;
  line-height: 22px;
  color: #a3a7ae;
  text-align: right;
  font-variant-numeric: tabular-nums;
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
  /* 左侧负 margin 抵消正文的行号栏，语言栏仍铺满整个卡片宽度 */
  margin: 0 -16px 12px calc(-16px - var(--docs-code-gutter));
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

/* 中等宽度：侧栏与评论栏逐级收窄，保证正文列在 860–1240px 之间仍有足够宽度 */
@media (max-width: 1240px) {
  .docs-side {
    flex-basis: 280px;
  }
}
@media (max-width: 1060px) {
  .docs-side {
    flex-basis: 240px;
  }
  .docs-page {
    --docs-comment-rail: 220px;
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
  /* 参考飞书首页：四列入口卡片，两行 */
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}
/* 首页分区标题：开始 / 文档 */
.docs-home-section {
  margin: 28px 0 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--docs-text);
}
.docs-quick-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.docs-quick-card.is-disabled:hover {
  background: var(--docs-canvas);
}
.docs-quick-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  color: #b25000;
  background: #fff1e0;
  border-radius: 4px;
  vertical-align: middle;
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
/* 快捷入口图标：无底色、统一线性深灰（参考飞书首页，不使用彩色渐变） */
.docs-quick-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 20px;
  color: #8f959e;
  background: transparent;
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
/* 快捷入口的下拉：面板宽度跟随菜单（菜单宽度 = 卡片宽度） */
.docs-quick-popover .docs-add-panel {
  width: 100%;
}
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
/* 上传菜单（参考飞书）：文件 = 实心蓝底白箭头；文件夹 = 浅蓝文件夹图形 */
.docs-add-icon.is-file {
  background: #2f6bff;
  color: #ffffff;
}
.docs-add-icon.is-folder {
  background: transparent;
  color: #7aa9ff;
  font-size: 26px;
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
/* 分段控件（参考飞书首页）：浅灰底容器，选中项为白底圆角块 */
.docs-home-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--docs-side-bg);
  border-radius: var(--docs-radius);
}
.docs-home-tabs button {
  position: relative;
  height: 30px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--docs-text-2);
  background: none;
  border: none;
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.docs-home-tabs button:hover {
  color: var(--docs-text);
}
.docs-home-tabs button.active {
  color: var(--docs-text);
  font-weight: 500;
  background: var(--docs-canvas);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
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
  height: 56px;
}
/* 参考飞书文档列表：位置列宽、时间列固定宽度，无表头 */
.docs-table td.docs-col-time {
  width: 180px;
  text-align: right;
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
