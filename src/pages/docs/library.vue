<template>
  <template v-if="libLoaded">
  <div class="lib-page">
    <!-- 左侧：知识库菜单（与知识库内文档页共用 LibrarySide） -->
    <LibrarySide
      :library-name="library?.name || ''"
      :library-cover="library?.cover"
      :keyword="keyword"
      :rows="sideRows"
      :move-targets="moveTargets"
      @update:keyword="keyword = $event"
      @home="goHome"
      :home-active="true"
      @library-home="() => {}"
      @library="backToList"
      @new="onNewKey"
      @toggle-folder="(f) => toggleFolder(f.id)"
      @open-doc="(d) => openDoc(d.id)"
      @folder-menu="(k, f) => onFolderMenu({ key: k }, f)"
      @doc-menu="(k, d) => onDocMenu({ key: k }, d)"
    />

    <!-- 右侧：知识库主内容 -->
    <main class="lib-main">
      <div class="lib-hero">
        <!-- 点击封面可更换插画 -->
        <div
          class="lib-hero-cover lib-hero-cover-btn"
          role="button"
          tabindex="0"
          title="更换封面"
          @click="openCoverPicker"
          @keydown.enter="openCoverPicker"
        >
          <DocsLibraryCover class="lib-fill" :name="library?.name || ''" :cover="library?.cover" />
        </div>
        <div class="lib-hero-info">
          <h1 class="lib-title">{{ library?.name || '' }}</h1>
          <a-textarea
            v-if="editingDesc"
            v-model:value="descDraft"
            :auto-size="{ minRows: 1, maxRows: 4 }"
            :maxlength="200"
            class="lib-desc-input"
            placeholder="添加描述"
            @blur="saveDesc"
          />
          <div v-else class="lib-desc" @click="startEditDesc">{{ library?.desc || '暂无描述，点击添加' }}</div>
          <div class="lib-visibility">{{ visibilityText }}</div>
        </div>
        <a-dropdown trigger="click" placement="bottomRight">
          <button type="button" class="lib-more-btn" title="更多"><MoreOutlined /></button>
          <template #overlay>
            <a-menu @click="onLibMenu">
              <a-menu-item key="star">{{ library?.starred ? '取消置顶' : '置顶' }}</a-menu-item>
              <a-menu-item key="rename">重命名</a-menu-item>
              <a-menu-item key="delete" danger>删除知识库</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <div class="lib-tabs" role="tablist">
        <button type="button" role="tab" class="lib-tab" :class="{ active: mainTab === 'activity' }" @click="mainTab = 'activity'">动态</button>
        <button type="button" role="tab" class="lib-tab" :class="{ active: mainTab === 'catalog' }" @click="mainTab = 'catalog'">目录</button>
      </div>

      <!-- 动态：最近修改的文档；没有则显示空状态 -->
      <div v-if="mainTab === 'activity'" class="lib-body">
        <ul v-if="recentDocs.length" class="lib-feed">
          <li v-for="d in recentDocs" :key="d.id" class="lib-feed-item">
            <div class="lib-feed-head">
              <span class="lib-feed-avatar">
                <img v-if="d.authorAvatar" :src="d.authorAvatar" alt="" />
                <template v-else>{{ (d.author || '-').slice(0, 1) }}</template>
              </span>
              <span class="lib-feed-text">
                {{ d.author || '-' }} 在 <b>{{ library?.name || '' }}</b> {{ feedVerb(d) }}文档
              </span>
              <span class="lib-feed-time">{{ fmtTime(d.updatedAt) }}</span>
            </div>
            <div class="lib-feed-card" @click="openDoc(d.id)">
              <DocTypeIcon :type="d.type" size="sm" />
              <span class="lib-feed-title">{{ d.title || '无标题文档' }}</span>
            </div>
          </li>
        </ul>
        <div v-else class="lib-empty">
          <div class="lib-empty-title">暂无动态</div>
          <div class="lib-empty-sub">文档的更新、点赞和评论，将在此出现</div>
        </div>
      </div>

      <!-- 目录：完整的文件夹与文档列表 -->
      <div v-else class="lib-body">
        <ul v-if="treeRows.length" class="lib-catalog">
          <template v-for="r in treeRows" :key="r.key">
            <li
              v-if="r.kind === 'folder' && r.folder"
              class="lib-catalog-row lib-catalog-folder"
              :style="{ paddingLeft: `${12 + r.depth * 20}px` }"
              @click="toggleFolder(r.folder.id)"
            >
              <RightOutlined class="lib-row-caret" :class="{ open: isExpanded(r.folder.id) }" />
              <DocTypeIcon type="folder" size="sm" />
              <span class="lib-catalog-name">{{ r.folder.name }}</span>
            </li>
            <li
              v-else-if="r.doc"
              class="lib-catalog-row"
              :style="{ paddingLeft: `${12 + r.depth * 20 + 16}px` }"
              @click="openDoc(r.doc.id)"
            >
              <DocTypeIcon :type="r.doc.type" size="sm" />
              <span class="lib-catalog-name">{{ r.doc.title || '无标题文档' }}</span>
              <span class="lib-activity-time">{{ fmtTime(r.doc.updatedAt) }}</span>
            </li>
          </template>
        </ul>
        <div v-else class="lib-empty">
          <div class="lib-empty-title">暂无目录</div>
          <div class="lib-empty-sub">点击左侧「新建」添加文档或文件夹</div>
        </div>
      </div>
    </main>

    <!-- 更换封面：默认插画 / 自动生成 -->
    <a-modal
      v-model:open="coverPickerOpen"
      title="更换封面"
      :width="520"
      centered
      destroy-on-close
      :footer="null"
    >
      <div class="lib-cover-grid">
        <button
          v-for="c in LIBRARY_COVERS"
          :key="c.key"
          type="button"
          class="lib-cover-option"
          :class="{ active: library?.cover === c.key }"
          @click="pickCover(c.key)"
        >
          <span class="lib-cover-preview">
            <DocsLibraryCover class="lib-fill" :name="library?.name || ''" :cover="c.key" />
          </span>
          <span>{{ c.label }}</span>
        </button>
        <button
          type="button"
          class="lib-cover-option"
          :class="{ active: !library?.cover }"
          @click="pickCover('')"
        >
          <span class="lib-cover-preview">
            <DocsLibraryCover class="lib-fill" :name="library?.name || ''" />
          </span>
          <span>自动生成</span>
        </button>
      </div>
    </a-modal>

    <!-- 新建 / 重命名 文件夹或知识库 -->
    <a-modal
      v-model:open="modal.open"
      :title="modalTitle"
      :width="360"
      centered
      destroy-on-close
      ok-text="确定"
      cancel-text="取消"
      @ok="submitModal"
    >
      <a-input
        v-model:value="modal.name"
        :maxlength="30"
        :placeholder="modal.kind === 'library' ? '知识库名称' : modal.kind === 'doc' ? '文档名称' : '文件夹名称'"
        @press-enter="submitModal"
      />
    </a-modal>
  </div>
  </template>
  <!-- 数据加载完成前不渲染知识库页，避免先闪出空白菜单 / 空内容 -->
  <div v-else class="lib-page lib-page-pending" aria-busy="true" />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  MoreOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import DocsLibraryCover from '@/components/docs/DocsLibraryCover.vue'
import { LIBRARY_COVERS } from '@/utils/library-cover'
import DocTypeIcon from '@/components/docs/DocTypeIcon.vue'
import LibrarySide from '@/components/docs/LibrarySide.vue'
import { startGlobalLoading, stopGlobalLoading } from '@/utils/global-loading'
import {
  createDoc,
  createDocFolder,
  deleteDocFolder,
  deleteDocLibrary,
  listDocFolders,
  listDocLibraries,
  listDocs,
  moveDoc,
  renameDoc,
  renameDocFolder,
  starDoc,
  starDocFolder,
  starDocLibrary,
  trashDoc,
  updateDocLibrary,
} from '@/api/docs'
import type { DocFolder, DocItem, DocLibrary, LibSideRow } from '@/types/docs'

const route = useRoute()
const router = useRouter()

const libraryId = computed(() => String(route.params.libraryId || ''))
const libraries = ref<DocLibrary[]>([])
const folders = ref<DocFolder[]>([])
const docs = ref<DocItem[]>([])

const library = computed(() => libraries.value.find((l) => l.id === libraryId.value) || null)
const libFolders = computed(() => folders.value.filter((f) => f.libraryId === libraryId.value))
const libDocs = computed(() => docs.value.filter((d) => d.libraryId === libraryId.value))
const visibilityText = computed(() => (library.value?.visibility === 'all' ? '全员可见' : '仅成员可见'))
const recentDocs = computed(() => [...libDocs.value].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30))

// ---------- 数据 ----------
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

function normalizeDoc(d: any): DocItem {
  const type = ['doc', 'sheet', 'mindmap', 'flow'].includes(d.type) ? d.type : 'doc'
  return {
    id: String(d.id),
    title: String(d.title || ''),
    type,
    content: '',
    updatedAt: Number(d.updatedAt) || Date.now(),
    createdAt: Number(d.createdAt) || Number(d.updatedAt) || Date.now(),
    libraryId: d.libraryId ? String(d.libraryId) : undefined,
    folderId: d.folderId ? String(d.folderId) : undefined,
    starred: !!d.starred,
  }
}

/** 首次加载完成标记：之后切换知识库不再重新显示占位 */
const libLoaded = ref(false)

async function load() {
  try {
    const [lRes, fRes, dRes] = await Promise.all([listDocLibraries(), listDocFolders(), listDocs()])
    if (lRes.success) libraries.value = (lRes.data || []).map(normalizeLibrary)
    if (fRes.success) folders.value = (fRes.data || []).map(normalizeFolder)
    if (dRes.success) docs.value = (dRes.data || []).map(normalizeDoc)
  } catch {
    message.error('加载知识库失败')
  }
  libLoaded.value = true
  if (!library.value) {
    message.warning('知识库不存在或已删除')
    router.replace({ name: 'DocsWiki' })
  }
}

onMounted(load)
watch(libraryId, () => {
  keyword.value = ''
  editingDesc.value = false
  load()
})

// ---------- 目录树 ----------
const keyword = ref('')
/** 文件夹展开状态（默认展开） */
const expanded = reactive<Record<string, boolean>>({})
const mainTab = ref<'activity' | 'catalog'>('activity')

function isExpanded(id: string): boolean {
  return expanded[id] !== false
}

function toggleFolder(id: string) {
  expanded[id] = !isExpanded(id)
}

interface TreeRow {
  key: string
  kind: 'folder' | 'doc'
  depth: number
  folder?: DocFolder
  doc?: DocItem
}

/** 目录行：文件夹（可折叠）与其下的文档、子文件夹，按层级展开；搜索时平铺匹配项 */
const treeRows = computed<TreeRow[]>(() => {
  const rows: TreeRow[] = []
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    for (const f of libFolders.value) {
      if (f.name.toLowerCase().includes(kw)) rows.push({ key: `f-${f.id}`, kind: 'folder', depth: 0, folder: f })
    }
    for (const d of libDocs.value) {
      if ((d.title || '').toLowerCase().includes(kw)) rows.push({ key: `d-${d.id}`, kind: 'doc', depth: 0, doc: d })
    }
    return rows
  }
  const ids = new Set(libFolders.value.map((f) => f.id))
  // 库根目录的文档（不在任何文件夹内）排在最前
  for (const d of libDocs.value) {
    if (!d.folderId || !ids.has(d.folderId)) rows.push({ key: `d-${d.id}`, kind: 'doc', depth: 0, doc: d })
  }
  const walk = (parentId: string | undefined, depth: number) => {
    for (const f of libFolders.value) {
      const p = f.parentId && ids.has(f.parentId) ? f.parentId : undefined
      if (p !== parentId) continue
      rows.push({ key: `f-${f.id}`, kind: 'folder', depth, folder: f })
      if (!isExpanded(f.id)) continue
      for (const d of libDocs.value) {
        if (d.folderId === f.id) rows.push({ key: `d-${d.id}`, kind: 'doc', depth: depth + 1, doc: d })
      }
      walk(f.id, depth + 1)
    }
  }
  walk(undefined, 0)
  return rows
})

// ---------- 跳转 / 时间 ----------
function backToList() {
  router.push({ name: 'DocsWiki' })
}

/** 返回主页（云文档首页） */
function goHome() {
  router.push({ name: 'DocsHome' })
}

/** 打开本知识库内的文档：/docs/library/wiki/:docId */
function openDoc(docId: string) {
  router.push({ name: 'LibraryWikiDoc', params: { docId } })
}

/** 动态里的动词：创建时间与修改时间基本一致视为「创建了」，否则「编辑了」 */
function feedVerb(d: DocItem): string {
  return Math.abs((d.updatedAt || 0) - (d.createdAt || 0)) < 1000 ? '创建了' : '编辑了'
}

function fmtTime(ts?: number): string {
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

// ---------- 新建 ----------
const creatingDoc = ref(false)
/** 先调用创建接口，拿到后端返回的 id 之后才跳转到文档页；创建中不允许重复点击 */
async function newDoc() {
  if (creatingDoc.value) return
  creatingDoc.value = true
  startGlobalLoading()
  try {
    const res = await createDoc({ type: 'doc', title: '无标题文档', libraryId: libraryId.value, position: 'library' })
    if (res.success && res.data) openDoc(String(res.data.id))
  } catch {
    message.error('新建文档失败')
  } finally {
    creatingDoc.value = false
    stopGlobalLoading()
  }
}

/** 左侧菜单「新建」：doc 文档 / folder 文件夹 */
function onNewKey(key: string) {
  if (key === 'doc') newDoc()
  else openNewFolder()
}

/** 左侧目录的行（文件夹 + 文档），展开状态随行下发 */
const sideRows = computed<LibSideRow[]>(() =>
  treeRows.value.map((r) => (r.kind === 'folder' && r.folder ? { ...r, expanded: isExpanded(r.folder.id) } : r)),
)

/** 文档「移动到」的目标：库根目录 + 本库内的文件夹 */
const moveTargets = computed(() => [
  { key: 'root', label: '知识库根目录' },
  ...libFolders.value.map((f) => ({ key: f.id, label: folderPathLabel(f) })),
])

// ---------- 文件夹 / 知识库 名称弹窗（新建 / 重命名共用） ----------
const modal = reactive({
  open: false,
  kind: 'folder' as 'folder' | 'library' | 'doc',
  id: '',
  name: '',
  parentId: '',
})

const modalTitle = computed(() => {
  if (modal.kind === 'library') return '重命名知识库'
  if (modal.kind === 'doc') return '重命名文档'
  return modal.id ? '重命名文件夹' : '新建文件夹'
})

function openRenameFolder(folder: DocFolder) {
  modal.kind = 'folder'
  modal.id = folder.id
  modal.name = folder.name
  modal.parentId = ''
  modal.open = true
}

function openRenameDoc(doc: DocItem) {
  modal.kind = 'doc'
  modal.id = doc.id
  modal.name = doc.title || ''
  modal.parentId = ''
  modal.open = true
}

// ---------- 目录行操作：文件夹 / 文档 的 置顶、重命名、删除 ----------
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
  else if (key === 'delete') deleteFolderRow(folder)
}

function deleteFolderRow(folder: DocFolder) {
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
        // 文档和子文件夹上移一级（上一级为空则到知识库根目录），与后端约定一致
        docs.value.forEach((d) => {
          if (d.folderId === folder.id) d.folderId = folder.parentId
        })
        folders.value.forEach((f) => {
          if (f.parentId === folder.id) f.parentId = folder.parentId
        })
        folders.value = folders.value.filter((f) => f.id !== folder.id)
      } catch {}
    },
  })
}

function onDocMenu(e: { key?: string | number }, doc: DocItem) {
  const key = String(e?.key ?? '')
  if (key === 'rename') openRenameDoc(doc)
  else if (key === 'star') {
    const next = !doc.starred
    starDoc({ id: doc.id, starred: next })
      .then((res) => {
        if (res.success) doc.starred = next
      })
      .catch(() => {})
  } else if (key === 'trash') trashDocRow(doc)
  else if (key.startsWith('move:')) moveDocInLibrary(doc, key.slice(5))
}

/** 文件夹完整路径（同一知识库内，如「需求 / 2026 / Q1」），用于移动菜单展示 */
function folderPathLabel(folder: DocFolder): string {
  const parts = [folder.name]
  let parent = folders.value.find((f) => f.id === folder.parentId)
  for (let guard = 0; parent && guard < 20; guard++) {
    parts.unshift(parent.name)
    const next = parent.parentId
    parent = folders.value.find((f) => f.id === next)
  }
  return parts.join(' / ')
}

/** 在当前知识库内移动文档：target 为 root（库根目录）或本库内的文件夹 id */
async function moveDocInLibrary(doc: DocItem, target: string) {
  const folder = target === 'root' ? undefined : libFolders.value.find((f) => f.id === target)
  if (target !== 'root' && !folder) return
  try {
    const res = await moveDoc({ id: doc.id, libraryId: libraryId.value, folderId: folder?.id || null })
    if (!res.success) return
    doc.libraryId = libraryId.value
    doc.folderId = folder?.id
    doc.updatedAt = res.data?.updatedAt || doc.updatedAt
    if (folder) expanded[folder.id] = true
  } catch {}
}

function trashDocRow(doc: DocItem) {
  Modal.confirm({
    title: '移到回收站',
    content: `确定将「${doc.title || '无标题文档'}」移到回收站？`,
    okText: '移到回收站',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await trashDoc(doc.id)
        if (!res.success) return
        docs.value = docs.value.filter((d) => d.id !== doc.id)
      } catch {}
    },
  })
}

function openNewFolder(parentId = '') {
  modal.kind = 'folder'
  modal.id = ''
  modal.name = ''
  modal.parentId = parentId
  modal.open = true
}

function openRenameLibrary() {
  if (!library.value) return
  modal.kind = 'library'
  modal.id = library.value.id
  modal.name = library.value.name
  modal.parentId = ''
  modal.open = true
}

// ---------- 封面插画 ----------
const coverPickerOpen = ref(false)

function openCoverPicker() {
  if (library.value) coverPickerOpen.value = true
}

/** 选择封面：key 为空表示恢复自动生成 */
async function pickCover(key: string) {
  if (!library.value) return
  try {
    const res = await updateDocLibrary({ id: library.value.id, cover: key })
    if (!res.success) return
    library.value.cover = key || undefined
    coverPickerOpen.value = false
  } catch {
    message.error('更换封面失败')
  }
}

async function submitModal() {
  const name = modal.name.trim()
  if (!name) {
    message.warning(modal.kind === 'library' ? '请输入知识库名称' : modal.kind === 'doc' ? '请输入文档名称' : '请输入文件夹名称')
    return
  }
  try {
    if (modal.kind === 'library') {
      const res = await updateDocLibrary({ id: modal.id, name })
      if (!res.success) return
      if (library.value) library.value.name = name
    } else if (modal.kind === 'doc') {
      const res = await renameDoc({ id: modal.id, title: name })
      if (!res.success) return
      const d = docs.value.find((x) => x.id === modal.id)
      if (d) d.title = name
    } else if (modal.id) {
      const res = await renameDocFolder({ id: modal.id, name })
      if (!res.success) return
      const f = folders.value.find((x) => x.id === modal.id)
      if (f) f.name = name
    } else {
      const res = await createDocFolder({
        name,
        libraryId: libraryId.value,
        parentId: modal.parentId || undefined,
      })
      if (!res.success || !res.data) return
      folders.value.push(normalizeFolder(res.data))
      if (modal.parentId) expanded[modal.parentId] = true
    }
    modal.open = false
  } catch {
    message.error('保存失败')
  }
}

// ---------- 描述 ----------
const editingDesc = ref(false)
const descDraft = ref('')

function startEditDesc() {
  descDraft.value = library.value?.desc || ''
  editingDesc.value = true
}

async function saveDesc() {
  if (!editingDesc.value) return
  editingDesc.value = false
  const lib = library.value
  const next = descDraft.value.trim()
  if (!lib || next === (lib.desc || '')) return
  try {
    const res = await updateDocLibrary({ id: lib.id, desc: next })
    if (res.success) lib.desc = next || undefined
  } catch {
    message.error('保存描述失败')
  }
}

// ---------- 更多菜单 ----------
async function onLibMenu({ key }: { key: string | number }) {
  const lib = library.value
  if (!lib) return
  const k = String(key)
  if (k === 'rename') {
    openRenameLibrary()
  } else if (k === 'star') {
    const next = !lib.starred
    try {
      const res = await starDocLibrary({ id: lib.id, starred: next })
      if (res.success) lib.starred = next
    } catch {
      message.error('操作失败')
    }
  } else if (k === 'delete') {
    Modal.confirm({
      title: `删除知识库「${lib.name}」`,
      content: '知识库内的文件夹会一并删除，文档会移到个人文档，不会删除文档。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const res = await deleteDocLibrary(lib.id)
        if (!res.success) return
        router.replace({ name: 'DocsWiki' })
      },
    })
  }
}
</script>

<style scoped>
/* 数据加载前的占位：与页面同背景，避免闪白 */
.lib-page-pending {
  height: 100%;
  background: #fff;
}

/* 整页：左侧知识库菜单 + 右侧主内容；占满文档布局的内容区 */
.lib-page {
  display: flex;
  height: 100%;
  min-height: 0;
  background: #fff;
  color: var(--docs-text, #1f2329);
  font-family: var(--docs-font, inherit);
}

.lib-fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.lib-row-caret {
  flex: none;
  font-size: 10px;
  color: #8f959e;
  transition: transform 0.15s;
}
.lib-row-caret.open {
  transform: rotate(90deg);
}
/* ---------- 右侧主内容 ---------- */
.lib-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  /* 顶栏是固定定位，右侧内容需从顶栏下方开始，避免被盖住 */
  padding: calc(var(--docs-header-h, 72px) + 24px) 56px 40px;
  box-sizing: border-box;
}
.lib-hero {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  max-width: 880px;
}
.lib-hero-cover-btn {
  cursor: pointer;
}
.lib-hero-cover-btn:hover {
  box-shadow: 0 0 0 3px rgba(51, 112, 255, 0.18);
}
.lib-cover-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.lib-cover-option {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  font-size: 13px;
  color: #1f2329;
  background: #fff;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
}
.lib-cover-option:hover {
  border-color: #c9d6f7;
}
.lib-cover-option.active {
  border-color: #3370ff;
}
.lib-cover-preview {
  position: relative;
  display: block;
  height: 96px;
  overflow: hidden;
  border-radius: 8px;
}
.lib-hero-cover {
  position: relative;
  flex: none;
  width: 160px;
  height: 160px;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  overflow: hidden;
}
.lib-hero-info {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}
.lib-title {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  line-height: 1.3;
  color: #1f2329;
  word-break: break-all;
}
.lib-desc {
  margin-top: 8px;
  font-size: 14px;
  color: #8f959e;
  cursor: text;
}
.lib-desc:hover {
  color: #646a73;
}
.lib-desc-input {
  margin-top: 8px;
}
.lib-visibility {
  margin-top: 12px;
  font-size: 13px;
  color: #8f959e;
}
.lib-more-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 16px;
  color: #1f2329;
  background: #f2f3f5;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.lib-more-btn:hover {
  background: #e5e6eb;
}

.lib-tabs {
  display: flex;
  gap: 28px;
  max-width: 880px;
  margin-top: 36px;
  border-bottom: 1px solid #ebedf0;
}
.lib-tab {
  position: relative;
  padding: 0 0 10px;
  font-size: 15px;
  color: #8f959e;
  background: transparent;
  border: none;
  cursor: pointer;
}
.lib-tab.active {
  color: #1f2329;
  font-weight: 500;
}
.lib-tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: #1f2329;
  border-radius: 2px;
}

.lib-body {
  max-width: 880px;
  min-height: 320px;
}
.lib-activity,
.lib-catalog {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}
.lib-activity-item,
.lib-catalog-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px 12px;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
}
.lib-activity-item:hover,
.lib-catalog-row:hover {
  background: #f5f6f7;
}
.lib-activity-title,
.lib-catalog-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lib-catalog-folder .lib-catalog-name {
  font-weight: 500;
}
.lib-activity-time {
  flex: none;
  font-size: 13px;
  color: #8f959e;
  font-variant-numeric: tabular-nums;
}
/* 动态（参考飞书知识库主页）：头像 + 「谁在哪个知识库创建 / 编辑了文档」+ 时间，下方是浅灰文档卡片 */
.lib-feed {
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
}
.lib-feed-item {
  padding: 0 0 20px;
}
.lib-feed-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #1f2329;
}
.lib-feed-avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 6px;
  background: #3370ff;
  color: #fff;
  font-size: 12px;
}
.lib-feed-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lib-feed-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lib-feed-text b {
  font-weight: 500;
}
.lib-feed-time {
  flex: none;
  font-size: 13px;
  color: #8f959e;
  font-variant-numeric: tabular-nums;
}
.lib-feed-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0 0 38px;
  padding: 12px 14px;
  background: #f7f8fa;
  border-radius: 8px;
  cursor: pointer;
}
.lib-feed-card:hover {
  background: #eef0f3;
}
.lib-feed-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: #1f2329;
}

.lib-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  text-align: center;
}
.lib-empty-title {
  font-size: 16px;
  color: #1f2329;
}
.lib-empty-sub {
  margin-top: 6px;
  font-size: 13px;
  color: #8f959e;
}

@media (max-width: 860px) {
  .lib-main {
    padding: 24px 20px 32px;
  }
  .lib-hero-cover {
    width: 88px;
    height: 88px;
  }
}
</style>
