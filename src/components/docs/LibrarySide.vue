<template>
  <!-- 知识库左侧菜单：封面（悬停变主页图标，点击回主页）、新建、主页、目录树；知识库页与知识库内文档页共用 -->
  <aside class="lib-side">
    <div class="lib-side-head">
      <button type="button" class="lib-side-cover lib-side-home" title="返回主页" @click="emit('home')">
        <DocsLibraryCover class="lib-fill" :name="libraryName" :cover="libraryCover" />
        <span class="lib-home-overlay"><HomeOutlined /></span>
      </button>
      <div class="lib-side-title">
        <div class="lib-side-name">{{ libraryName || '知识库' }}</div>
        <div class="lib-side-sub" @click="emit('library')">知识库</div>
      </div>
    </div>

    <div class="lib-side-new">
      <a-dropdown trigger="click" placement="bottomLeft">
        <button type="button" class="lib-new-btn"><PlusOutlined /><span>新建</span></button>
        <template #overlay>
          <a-menu @click="onNew">
            <a-menu-item key="doc"><template #icon><FileTextOutlined class="lib-menu-icon is-doc" /></template>文档</a-menu-item>
            <a-menu-item key="folder"><template #icon><FolderOutlined class="lib-menu-icon is-folder" /></template>文件夹</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <button type="button" class="lib-nav-item" :class="{ active: homeActive }" @click="emit('library-home')">
      <AppstoreOutlined />
      <span>主页</span>
    </button>

    <div class="lib-tree-head">
      <button type="button" class="lib-tree-toggle" @click="treeOpen = !treeOpen">
        <UnorderedListOutlined />
        <span>目录</span>
        <DownOutlined class="lib-caret" :class="{ closed: !treeOpen }" />
      </button>
      <CheckSquareOutlined class="lib-search-btn" title="多选" @click="toggleSelectMode" />
      <SearchOutlined class="lib-search-btn" title="搜索" @click="searchOpen = !searchOpen" />
    </div>
    <a-input
      v-if="searchOpen"
      :value="keyword"
      allow-clear
      size="small"
      placeholder="搜索文档 / 文件夹"
      class="lib-search-input"
      @update:value="emit('update:keyword', String($event ?? ''))"
    />

    <div v-if="selectMode" class="lib-batch">
      <span class="lib-batch-count">已选 {{ selected.size }} 项</span>
      <span class="lib-batch-actions">
        <button type="button" class="lib-batch-btn" @click="selectAll">全选</button>
        <button type="button" class="lib-batch-btn danger" :disabled="!selected.size" @click="deleteSelected">删除</button>
        <button type="button" class="lib-batch-btn" @click="exitSelectMode">取消</button>
      </span>
    </div>
    <div v-if="treeOpen" class="lib-tree">
      <template v-for="r in rows" :key="r.key">
        <div
          v-if="r.kind === 'folder' && r.folder"
          class="lib-tree-row lib-tree-folder"
          :style="{ paddingLeft: `${8 + r.depth * 14}px` }"
          :class="{ 'is-selected': selected.has(rowKey(r)) }"
          @click="onRowClick(r, $event)"
        >
          <span v-if="selectMode" class="lib-check" :class="{ on: selected.has(rowKey(r)) }"><CheckOutlined v-if="selected.has(rowKey(r))" /></span>
          <RightOutlined class="lib-row-caret" :class="{ open: r.expanded }" />
          <DocTypeIcon type="folder" size="sm" />
          <span class="lib-row-name">{{ r.folder.name }}</span>
          <a-dropdown trigger="click" placement="bottomRight">
            <span class="lib-row-more" title="更多" @click.stop><MoreOutlined /></span>
            <template #overlay>
              <a-menu @click="onFolderMenu($event, r.folder)">
                <a-menu-item key="star">{{ r.folder.starred ? '取消置顶' : '置顶' }}</a-menu-item>
                <a-menu-item key="rename">重命名</a-menu-item>
                <a-menu-item key="delete" danger>删除文件夹</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
        <div
          v-else-if="r.doc"
          role="button"
          tabindex="0"
          class="lib-tree-row lib-tree-doc"
          :style="{ paddingLeft: `${8 + r.depth * 14 + 14}px` }"
          :class="{ active: r.doc.id === activeDocId, 'is-selected': selected.has(rowKey(r)) }"
          @click="onRowClick(r, $event)"
          @keydown.enter="emit('open-doc', r.doc)"
        >
          <span v-if="selectMode" class="lib-check" :class="{ on: selected.has(rowKey(r)) }"><CheckOutlined v-if="selected.has(rowKey(r))" /></span>
          <DocTypeIcon :type="r.doc.type" size="sm" />
          <span class="lib-row-name">{{ r.doc.title || '无标题文档' }}</span>
          <a-dropdown trigger="click" placement="bottomRight">
            <span class="lib-row-more" title="更多" @click.stop><MoreOutlined /></span>
            <template #overlay>
              <a-menu @click="onDocMenu($event, r.doc)">
                <a-menu-item key="rename">重命名</a-menu-item>
                <a-menu-item key="star">{{ r.doc.starred ? '取消置顶' : '置顶' }}</a-menu-item>
                <a-sub-menu v-if="moveTargets.length" key="move" title="移动到">
                  <a-menu-item v-for="t in moveTargets" :key="`move:${t.key}`">{{ t.label }}</a-menu-item>
                </a-sub-menu>
                <a-menu-item key="trash" danger>删除</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </template>
      <div v-if="!rows.length" class="lib-tree-empty">{{ emptyText }}</div>
    </div>

    <!-- 回收站入口（只在知识库内的文档页显示；知识库页没有回收站入口） -->
    <button
      v-if="showTrash"
      type="button"
      class="lib-nav-item lib-trash"
      :class="{ active: trashActive }"
      @click="emit('trash')"
    >
      <DeleteOutlined />
      <span>回收站</span>
      <span v-if="trashCount" class="lib-trash-count">{{ trashCount }}</span>
    </button>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  AppstoreOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOutlined,
  DownOutlined,
  HomeOutlined,
  MoreOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  CheckOutlined,
  CheckSquareOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue'
import DocsLibraryCover from '@/components/docs/DocsLibraryCover.vue'
import DocTypeIcon from '@/components/docs/DocTypeIcon.vue'
import type { DocFolder, DocItem, LibSideRow } from '@/types/docs'

const props = withDefaults(
  defineProps<{
    libraryName: string
    libraryCover?: string
    keyword: string
    rows: LibSideRow[]
    /** 「移动到」子菜单的目标：key 为 root / none / 文件夹 id，label 为展示文案 */
    moveTargets?: { key: string; label: string }[]
    activeDocId?: string
    /** 菜单「主页」是否高亮（知识库页本身即知识库主页时为 true） */
    homeActive?: boolean
    showTrash?: boolean
    trashCount?: number
    trashActive?: boolean
    emptyText?: string
  }>(),
  {
    moveTargets: () => [],
    activeDocId: '',
    homeActive: false,
    showTrash: false,
    trashCount: 0,
    trashActive: false,
    emptyText: '暂无文档，点击「新建」开始',
  },
)

const emit = defineEmits<{
  'update:keyword': [value: string]
  home: []
  /** 菜单里的「主页」：知识库自己的主页（停留在当前知识库） */
  'library-home': []
  library: []
  /** 新建菜单：doc 文档 / folder 文件夹 */
  new: [key: string]
  'toggle-folder': [folder: DocFolder]
  'open-doc': [doc: DocItem]
  /** 文件夹菜单：star 置顶 / rename 重命名 / delete 删除 */
  'folder-menu': [key: string, folder: DocFolder]
  /** 文档菜单：rename / star / move:<目标> / trash */
  'doc-menu': [key: string, doc: DocItem]
  trash: []
  /** 批量删除：文档移入回收站，文件夹删除（内容移到上一级） */
  'batch-delete': [items: { kind: 'folder' | 'doc'; id: string }[]]
}>()

const treeOpen = ref(true)
/** 多选：按住 Ctrl / Cmd 点击，或点目录标题右侧的「多选」进入多选模式 */
const selectMode = ref(false)
const selected = ref<Set<string>>(new Set())

function rowKey(r: LibSideRow): string {
  return r.kind === 'folder' && r.folder ? `f:${r.folder.id}` : `d:${r.doc?.id ?? ''}`
}

function toggleSelect(key: string) {
  const next = new Set(selected.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selected.value = next
}

function toggleSelectMode() {
  if (selectMode.value) exitSelectMode()
  else selectMode.value = true
}

function exitSelectMode() {
  selectMode.value = false
  selected.value = new Set()
}

function selectAll() {
  selected.value = new Set(props.rows.map(rowKey))
}

function onRowClick(r: LibSideRow, e: MouseEvent) {
  if (selectMode.value || e.ctrlKey || e.metaKey) {
    selectMode.value = true
    toggleSelect(rowKey(r))
    return
  }
  if (r.kind === 'folder' && r.folder) emit('toggle-folder', r.folder)
  else if (r.doc) emit('open-doc', r.doc)
}

function deleteSelected() {
  const items: { kind: 'folder' | 'doc'; id: string }[] = []
  for (const r of props.rows) {
    if (!selected.value.has(rowKey(r))) continue
    if (r.kind === 'folder' && r.folder) items.push({ kind: 'folder', id: r.folder.id })
    else if (r.doc) items.push({ kind: 'doc', id: r.doc.id })
  }
  if (!items.length) return
  emit('batch-delete', items)
  exitSelectMode()
}
const searchOpen = ref(false)

function onNew(e: { key?: string | number }) {
  emit('new', String(e?.key ?? ''))
}
function onFolderMenu(e: { key?: string | number }, folder: DocFolder) {
  emit('folder-menu', String(e?.key ?? ''), folder)
}
function onDocMenu(e: { key?: string | number }, doc: DocItem) {
  emit('doc-menu', String(e?.key ?? ''), doc)
}
</script>

<style scoped>
/* ---------- 左侧菜单 ---------- */
.lib-side {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  height: 100%;
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
/* 左上角知识库图标：可点击返回主页，悬停时用主页图标覆盖 */
.lib-side-home {
  padding: 0;
  border: none;
  cursor: pointer;
}
.lib-home-overlay {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  color: #1f2329;
  font-size: 18px;
}
.lib-side-home:hover .lib-home-overlay,
.lib-side-home:focus-visible .lib-home-overlay {
  display: flex;
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
.lib-trash-count {
  margin-left: auto;
  font-size: 12px;
  color: #8f959e;
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
/* 当前打开的文档：浅蓝底 + 蓝字 */
.lib-tree-row.active {
  background: #e6efff;
  color: #1456f0;
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
/* 目录行右侧的「更多」按钮：默认弱化，悬停行时加深 */
.lib-row-more {
  flex: none;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: #8f959e;
  cursor: pointer;
}
.lib-row-more:hover {
  background: #dfe3e8;
  color: #1f2329;
}
/* 新建菜单的图标：文档蓝、文件夹黄，与目录行的文档 / 文件夹图标同色系 */
.lib-menu-icon {
  font-size: 16px;
}
.lib-menu-icon.is-doc {
  color: #3370ff;
}
.lib-menu-icon.is-folder {
  color: #e0a100;
}
/* 多选：复选框、选中行、批量操作条 */
.lib-check {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 10px;
  color: #ffffff;
  border: 1px solid #c4c9d2;
  border-radius: 4px;
  background: #ffffff;
}
.lib-check.on {
  background: #3370ff;
  border-color: #3370ff;
}
.lib-tree-row.is-selected {
  background: #e6efff;
}
.lib-batch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: #646a73;
  background: #ffffff;
  border: 1px solid #dee0e3;
  border-radius: 8px;
}
.lib-batch-actions {
  display: inline-flex;
  gap: 2px;
}
.lib-batch-btn {
  height: 22px;
  padding: 0 6px;
  font-size: 12px;
  color: #1f2329;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.lib-batch-btn:hover:not(:disabled) {
  background: #eef0f3;
}
.lib-batch-btn:disabled {
  color: #c4c9d2;
  cursor: not-allowed;
}
.lib-batch-btn.danger {
  color: #d70015;
}
.lib-tree-empty {
  padding: 12px 8px;
  font-size: 13px;
  color: #8f959e;
}
</style>
