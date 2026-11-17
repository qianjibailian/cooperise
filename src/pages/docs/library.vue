<template>
  <div class="lib-page">
    <!-- 左侧：知识库自己的菜单（新建 / 主页 / 目录） -->
    <aside class="lib-side">
      <div class="lib-side-head">
        <div class="lib-side-cover">
          <DocsLibraryCover class="lib-fill" :name="library?.name || ''" />
        </div>
        <div class="lib-side-title">
          <div class="lib-side-name">{{ library?.name || '知识库' }}</div>
          <div class="lib-side-sub" @click="backToList">知识库</div>
        </div>
      </div>

      <div class="lib-side-new">
        <a-dropdown trigger="click" placement="bottomLeft">
          <button type="button" class="lib-new-btn"><PlusOutlined /><span>新建</span></button>
          <template #overlay>
            <a-menu @click="onNewMenu">
              <a-menu-item key="doc">文档</a-menu-item>
              <a-menu-item key="folder">文件夹</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <button type="button" class="lib-nav-item active">
        <AppstoreOutlined />
        <span>主页</span>
      </button>

      <div class="lib-tree-head">
        <button type="button" class="lib-tree-toggle" @click="treeOpen = !treeOpen">
          <UnorderedListOutlined />
          <span>目录</span>
          <DownOutlined class="lib-caret" :class="{ closed: !treeOpen }" />
        </button>
        <SearchOutlined class="lib-search-btn" title="搜索" @click="searchOpen = !searchOpen" />
      </div>
      <a-input
        v-if="searchOpen"
        v-model:value="keyword"
        allow-clear
        size="small"
        placeholder="搜索文档 / 文件夹"
        class="lib-search-input"
      />

      <div v-if="treeOpen" class="lib-tree">
        <template v-for="r in treeRows" :key="r.key">
          <div
            v-if="r.kind === 'folder' && r.folder"
            class="lib-tree-row lib-tree-folder"
            :style="{ paddingLeft: `${8 + r.depth * 14}px` }"
            @click="toggleFolder(r.folder.id)"
          >
            <RightOutlined class="lib-row-caret" :class="{ open: isExpanded(r.folder.id) }" />
            <DocTypeIcon type="folder" size="sm" />
            <span class="lib-row-name">{{ r.folder.name }}</span>
          </div>
          <button
            v-else-if="r.doc"
            type="button"
            class="lib-tree-row lib-tree-doc"
            :style="{ paddingLeft: `${8 + r.depth * 14 + 14}px` }"
            @click="openDoc(r.doc.id)"
          >
            <DocTypeIcon :type="r.doc.type" size="sm" />
            <span class="lib-row-name">{{ r.doc.title || '无标题文档' }}</span>
          </button>
        </template>
        <div v-if="!treeRows.length" class="lib-tree-empty">{{ keyword ? '没有匹配的内容' : '暂无文档，点击「新建」开始' }}</div>
      </div>
    </aside>

    <!-- 右侧：知识库主内容 -->
    <main class="lib-main">
      <div class="lib-hero">
        <div class="lib-hero-cover">
          <DocsLibraryCover class="lib-fill" :name="library?.name || ''" />
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
        <ul v-if="recentDocs.length" class="lib-activity">
          <li v-for="d in recentDocs" :key="d.id" class="lib-activity-item" @click="openDoc(d.id)">
            <DocTypeIcon :type="d.type" size="sm" />
            <span class="lib-activity-title">{{ d.title || '无标题文档' }}</span>
            <span class="lib-activity-time">{{ fmtTime(d.updatedAt) }}</span>
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
        :placeholder="modal.kind === 'library' ? '知识库名称' : '文件夹名称'"
        @press-enter="submitModal"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  AppstoreOutlined,
  DownOutlined,
  MoreOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue'
import DocsLibraryCover from '@/components/docs/DocsLibraryCover.vue'
import DocTypeIcon from '@/components/docs/DocTypeIcon.vue'
import {
  createDoc,
  createDocFolder,
  deleteDocLibrary,
  listDocFolders,
  listDocLibraries,
  listDocs,
  renameDocFolder,
  starDocLibrary,
  updateDocLibrary,
} from '@/api/docs'
import type { DocFolder, DocItem, DocLibrary } from '@/types/docs'

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

async function load() {
  try {
    const [lRes, fRes, dRes] = await Promise.all([listDocLibraries(), listDocFolders(), listDocs()])
    if (lRes.success) libraries.value = (lRes.data || []).map(normalizeLibrary)
    if (fRes.success) folders.value = (fRes.data || []).map(normalizeFolder)
    if (dRes.success) docs.value = (dRes.data || []).map(normalizeDoc)
  } catch {
    message.error('加载知识库失败')
  }
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
const treeOpen = ref(true)
const searchOpen = ref(false)
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

function openDoc(docId: string) {
  router.push({ name: 'WikiDoc', params: { docId } })
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
async function newDoc() {
  try {
    const res = await createDoc({ type: 'doc', title: '无标题文档', libraryId: libraryId.value })
    if (res.success && res.data) openDoc(String(res.data.id))
  } catch {
    message.error('新建文档失败')
  }
}

function onNewMenu({ key }: { key: string | number }) {
  if (String(key) === 'doc') newDoc()
  else openNewFolder()
}

// ---------- 文件夹 / 知识库 名称弹窗（新建 / 重命名共用） ----------
const modal = reactive({
  open: false,
  kind: 'folder' as 'folder' | 'library',
  id: '',
  name: '',
  parentId: '',
})

const modalTitle = computed(() => {
  if (modal.kind === 'library') return '重命名知识库'
  return modal.id ? '重命名文件夹' : '新建文件夹'
})

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

async function submitModal() {
  const name = modal.name.trim()
  if (!name) {
    message.warning(modal.kind === 'library' ? '请输入知识库名称' : '请输入文件夹名称')
    return
  }
  try {
    if (modal.kind === 'library') {
      const res = await updateDocLibrary({ id: modal.id, name })
      if (!res.success) return
      if (library.value) library.value.name = name
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
/* 整页：左侧知识库菜单 + 右侧主内容；占满文档布局的内容区 */
.lib-page {
  display: flex;
  height: 100%;
  min-height: 0;
  background: #fff;
  color: var(--docs-text, #1f2329);
  font-family: var(--docs-font, inherit);
}

/* ---------- 左侧菜单 ---------- */
.lib-side {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 16px 12px;
  box-sizing: border-box;
  background: #f7f8fa;
  border-right: 1px solid #ebedf0;
  overflow: hidden;
}
.lib-side-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 4px 8px;
  min-width: 0;
}
.lib-side-cover {
  position: relative;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.lib-side-title {
  min-width: 0;
}
.lib-side-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
}
.lib-side-sub {
  font-size: 12px;
  color: #8f959e;
  cursor: pointer;
}
.lib-side-sub:hover {
  color: #3370ff;
}
.lib-fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.lib-side-new {
  padding: 0 2px 4px;
}
.lib-new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  font-size: 14px;
  color: #1f2329;
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 17px;
  cursor: pointer;
}
.lib-new-btn:hover {
  border-color: #3370ff;
  color: #3370ff;
}
.lib-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  font-size: 14px;
  color: #1f2329;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}
.lib-nav-item:hover {
  background: #eef0f3;
}
.lib-nav-item.active {
  background: #eaecf0;
}
.lib-tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 6px 4px;
}
.lib-tree-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #1f2329;
  background: transparent;
  border: none;
  cursor: pointer;
}
.lib-caret {
  font-size: 10px;
  color: #8f959e;
  transition: transform 0.15s;
}
.lib-caret.closed {
  transform: rotate(-90deg);
}
.lib-search-btn {
  color: #8f959e;
  cursor: pointer;
}
.lib-search-btn:hover {
  color: #1f2329;
}
.lib-search-input {
  margin: 0 2px;
}
.lib-tree {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.lib-tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 4px 8px;
  font-size: 14px;
  color: #1f2329;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.lib-tree-row:hover {
  background: #eef0f3;
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
.lib-row-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lib-tree-empty {
  padding: 12px 8px;
  font-size: 13px;
  color: #8f959e;
}

/* ---------- 右侧主内容 ---------- */
.lib-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 40px 72px 48px;
  box-sizing: border-box;
}
.lib-hero {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  max-width: 880px;
}
.lib-hero-cover {
  position: relative;
  flex: none;
  width: 132px;
  height: 132px;
  border: 1px solid #ebedf0;
  border-radius: 14px;
  overflow: hidden;
}
.lib-hero-info {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}
.lib-title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
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
  .lib-side {
    flex-basis: 200px;
  }
  .lib-main {
    padding: 24px 20px 32px;
  }
  .lib-hero-cover {
    width: 88px;
    height: 88px;
  }
}
</style>
