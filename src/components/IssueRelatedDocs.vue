<template>
  <div class="ird">
    <a-spin :spinning="loading && !loaded" size="small">
      <!-- 已关联：单行列表（图标 + 标题 | 作者 · 更新时间 | 取消关联），与云文档列表一致 -->
      <ul v-if="docs.length" class="ird-list">
        <li
          v-for="d in docs"
          :key="d.id"
          class="ird-row"
          role="link"
          tabindex="0"
          :title="d.title"
          @click="openDoc(d.id)"
          @keydown.enter="openDoc(d.id)"
        >
          <DocTypeIcon :type="d.type" />
          <span class="ird-title">{{ d.title || '无标题文档' }}</span>
          <span class="ird-side">
            <span v-if="d.author" class="ird-author">{{ d.author }}</span>
            <span v-if="d.updatedAt" class="ird-time">{{ formatSmartTime(d.updatedAt) }}</span>
          </span>
          <a-popconfirm
            title="取消关联该文档？"
            description="只解除关联，不会删除文档"
            ok-text="取消关联"
            cancel-text="保留"
            placement="topRight"
            @confirm="removeDoc(d)"
          >
            <button
              type="button"
              class="ird-remove"
              title="取消关联"
              :aria-label="`取消关联 ${d.title}`"
              @click.stop
              @keydown.stop
            >
              <DisconnectOutlined />
            </button>
          </a-popconfirm>
        </li>
      </ul>

      <!-- 添加入口：有文档时是列表下方的轻量按钮，没有文档时是整行虚线占位 -->
      <button type="button" class="ird-add" :class="{ 'is-empty': !docs.length }" @click="openPicker">
        <PlusOutlined /><span>{{ docs.length ? '关联文档' : '从云文档选择关联文档' }}</span>
      </button>
    </a-spin>

    <!-- 从云文档选择 -->
    <a-modal
      v-model:open="pickerOpen"
      title="从云文档选择"
      :width="560"
      :confirm-loading="saving"
      :ok-text="picked.length ? `关联 ${picked.length} 篇` : '关联'"
      cancel-text="取消"
      :ok-button-props="{ disabled: !picked.length }"
      destroy-on-close
      @ok="confirmPick"
    >
      <div class="ird-picker">
        <div class="ird-picker-bar">
          <div class="ird-picker-tabs" role="tablist">
            <button
              v-for="t in SOURCES"
              :key="t.key"
              type="button"
              role="tab"
              :aria-selected="source === t.key"
              :class="['ird-picker-tab', { 'is-active': source === t.key }]"
              @click="source = t.key"
            >
              {{ t.label }}
            </button>
          </div>
          <a-input v-model:value="keyword" placeholder="搜索文档标题" allow-clear class="ird-picker-search">
            <template #prefix><SearchOutlined /></template>
          </a-input>
        </div>
        <a-spin :spinning="pickerLoading">
          <div class="ird-picker-list">
            <label
              v-for="d in pickerDocs"
              :key="d.id"
              class="ird-picker-row"
              :class="{ 'is-disabled': linkedIds.has(d.id), 'is-picked': picked.includes(d.id) }"
            >
              <a-checkbox
                :checked="linkedIds.has(d.id) || picked.includes(d.id)"
                :disabled="linkedIds.has(d.id)"
                @change="togglePick(d.id)"
              />
              <DocTypeIcon :type="d.type" />
              <span class="ird-title" :title="d.title">{{ d.title || '无标题文档' }}</span>
              <span v-if="linkedIds.has(d.id)" class="ird-picker-tag">已关联</span>
              <span v-else class="ird-side">
                <span class="ird-author">{{ d.folderName || (source === 'shared' ? d.author || '共享文档' : '未分组') }}</span>
                <span class="ird-time">{{ formatSmartTime(d.updatedAt) }}</span>
              </span>
            </label>
            <div v-if="!pickerLoading && !pickerDocs.length" class="ird-picker-empty">
              {{ keyword.trim() ? '没有匹配的文档' : source === 'shared' ? '暂无共享给我的文档' : '云文档里还没有文档' }}
            </div>
          </div>
        </a-spin>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { DisconnectOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  listIssueDocs,
  linkIssueDocs,
  unlinkIssueDoc,
  listDocs,
  listSharedDocs,
  listDocFolders,
  type IssueDocItem,
} from '@/api/docs'
import type { DocType } from '@/types/docs'
import { isDesktop } from '@/utils/desktop'
import DocTypeIcon from '@/components/docs/DocTypeIcon.vue'

/**
 * 事项相关文档：展示事项关联的云文档，支持从云文档（我的文档 / 共享给我）选择关联、取消关联。
 * 点击文档在新页面（客户端为新页签）打开 /docs/wiki/{docId}。数据走 /docs/issue/*。
 */
const props = withDefaults(defineProps<{
  issueKey: string
  /** 外层详情刷新时传入新值（如详情数据对象），触发重新加载 */
  reloadTrigger?: unknown
}>(), {
  reloadTrigger: undefined,
})

const router = useRouter()

const DOC_TYPES: DocType[] = ['doc', 'sheet', 'mindmap', 'flow']
const toDocType = (t: unknown): DocType => (DOC_TYPES.includes(t as DocType) ? (t as DocType) : 'doc')

const pad = (n: number) => String(n).padStart(2, '0')
/** 与云文档列表一致：今天 / 昨天带时分，更早显示日期（今年省略年份） */
function formatSmartTime(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return `今天 ${time}`
  if (d.toDateString() === new Date(now.getTime() - 86_400_000).toDateString()) return `昨天 ${time}`
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}-${md}`
}

// ---------- 已关联文档 ----------
const docs = ref<IssueDocItem[]>([])
const loading = ref(false)
const loaded = ref(false)
let loadSeq = 0

async function load() {
  const key = props.issueKey
  if (!key) return
  const seq = ++loadSeq
  loading.value = true
  try {
    const res = await listIssueDocs(key)
    if (seq !== loadSeq) return
    docs.value = res?.success
      ? (res.data || []).map((d) => ({
          id: String(d.id),
          title: String(d.title || ''),
          type: toDocType(d.type),
          author: d.author ? String(d.author) : undefined,
          updatedAt: Number(d.updatedAt) || undefined,
        }))
      : []
    loaded.value = true
  } catch {
    // 请求层已统一提示
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

watch(
  () => [props.issueKey, props.reloadTrigger],
  ([key], old) => {
    // 切换事项：先清空，避免短暂展示上一个事项的文档
    if (key !== old?.[0]) {
      docs.value = []
      loaded.value = false
    }
    load()
  },
  { immediate: true },
)

const linkedIds = computed(() => new Set(docs.value.map((d) => d.id)))

function openDoc(id: string) {
  const href = router.resolve({ name: 'WikiDoc', params: { docId: id } }).href
  // 客户端：由 DesktopTabBar 按完整路径新开页签
  if (isDesktop) router.push(href)
  else window.open(href, '_blank', 'noopener')
}

async function removeDoc(d: IssueDocItem) {
  try {
    const res = await unlinkIssueDoc({ issueKey: props.issueKey, docId: d.id })
    if (res?.success) docs.value = docs.value.filter((x) => x.id !== d.id)
  } catch {
    // 请求层已统一提示
  }
}

// ---------- 从云文档选择 ----------
type Source = 'mine' | 'shared'
const SOURCES: { key: Source; label: string }[] = [
  { key: 'mine', label: '我的文档' },
  { key: 'shared', label: '共享给我' },
]
interface PickerDoc {
  id: string
  title: string
  type: DocType
  author?: string
  updatedAt: number
  folderName?: string
}

const pickerOpen = ref(false)
const pickerLoading = ref(false)
const saving = ref(false)
const source = ref<Source>('mine')
const keyword = ref('')
const picked = ref<string[]>([])
const sourceDocs = ref<Record<Source, PickerDoc[]>>({ mine: [], shared: [] })

const pickerDocs = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const list = sourceDocs.value[source.value]
  return kw ? list.filter((d) => d.title.toLowerCase().includes(kw)) : list
})

function openPicker() {
  picked.value = []
  keyword.value = ''
  source.value = 'mine'
  pickerOpen.value = true
  loadPickerDocs()
}

async function loadPickerDocs() {
  pickerLoading.value = true
  try {
    // 三个请求互不影响：某一个失败时其余照常展示
    const [mineRes, sharedRes, folderRes] = await Promise.allSettled([listDocs(), listSharedDocs(), listDocFolders()])
    const dataOf = <T,>(r: PromiseSettledResult<{ success: boolean; data: T[] }>): T[] =>
      r.status === 'fulfilled' && r.value?.success ? r.value.data || [] : []
    const folderName = new Map(dataOf(folderRes).map((f) => [String(f.id), f.name]))
    const toPickerDoc = (d: any): PickerDoc => ({
      id: String(d.id),
      title: String(d.title || '无标题文档'),
      type: toDocType(d.type),
      author: d.author ? String(d.author) : undefined,
      updatedAt: Number(d.updatedAt) || 0,
      folderName: d.folderId ? folderName.get(String(d.folderId)) : undefined,
    })
    const byUpdated = (a: PickerDoc, b: PickerDoc) => b.updatedAt - a.updatedAt
    const mine = dataOf(mineRes).map(toPickerDoc).sort(byUpdated)
    const mineIds = new Set(mine.map((d) => d.id))
    sourceDocs.value = {
      mine,
      shared: dataOf(sharedRes).map(toPickerDoc).filter((d) => !mineIds.has(d.id)).sort(byUpdated),
    }
  } finally {
    pickerLoading.value = false
  }
}

function togglePick(id: string) {
  if (linkedIds.value.has(id)) return
  picked.value = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
}

async function confirmPick() {
  if (!picked.value.length || saving.value) return
  saving.value = true
  try {
    const res = await linkIssueDocs({ issueKey: props.issueKey, docIds: picked.value })
    if (res?.success) {
      // 后端未返回提示文案时补一条
      if (!res.message) message.success(`已关联 ${picked.value.length} 篇文档`)
      pickerOpen.value = false
      load()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/*
 * 列表版式对齐云文档列表（docs-table）：单行、细分隔线、悬停浅底；
 * 颜色用 App.vue :root 上的 --docs-* 变量（弹窗挂在 body 下同样可用）。
 */
.ird {
  /* 按面板宽度自适应：抽屉较窄时隐藏作者 */
  container-type: inline-size;
  font-size: 13px;
  color: var(--docs-text, #1d1d1f);
}
.ird :deep(.ant-spin-container) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ---------- 已关联列表 ---------- */
.ird-list {
  margin: 0 -8px;
  padding: 0;
  list-style: none;
}
.ird-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}
/* 分隔线画在行内（左右留出圆角位置），悬停行及其上一行不显示，避免与浅底打架 */
.ird-row + .ird-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 1px;
  background: var(--docs-border, rgba(0, 0, 0, 0.08));
  transition: opacity 0.12s;
}
.ird-row:hover::before,
.ird-row:hover + .ird-row::before {
  opacity: 0;
}
.ird-row:hover {
  background: var(--docs-hover, rgba(0, 0, 0, 0.05));
}
.ird-row:focus-visible,
.ird-remove:focus-visible,
.ird-add:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--c-primary, #0a84ff) 60%, transparent);
  outline-offset: -2px;
}
.ird-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--docs-text, #1d1d1f);
  transition: color 0.12s;
}
.ird-row:hover .ird-title {
  color: var(--c-primary, #0a84ff);
}
.ird-side {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--docs-text-3, #86868b);
  white-space: nowrap;
}
.ird-author {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ird-time {
  min-width: 72px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
@container (max-width: 420px) {
  .ird-row .ird-author {
    display: none;
  }
}
.ird-remove {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 13px;
  color: var(--docs-text-3, #86868b);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s, background 0.12s;
}
.ird-row:hover .ird-remove,
.ird-remove:focus-visible,
.ird-remove.ant-popover-open {
  opacity: 1;
}
.ird-remove:hover {
  color: var(--docs-danger, #d70015);
  background: color-mix(in srgb, var(--docs-danger, #d70015) 10%, transparent);
}
/* 触屏没有 hover：取消关联按钮常显 */
@media (hover: none) {
  .ird-remove {
    opacity: 1;
  }
}

/* ---------- 添加入口 ---------- */
.ird-add {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  margin-left: -8px;
  padding: 0 8px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--c-primary, #0a84ff);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.ird-add:hover {
  background: color-mix(in srgb, var(--c-primary, #0a84ff) 8%, transparent);
}
/* 空状态：整行虚线占位，一眼能看到可以从哪里加 */
.ird-add.is-empty {
  align-self: stretch;
  justify-content: center;
  height: 40px;
  margin-left: 0;
  font-weight: 400;
  color: var(--docs-text-3, #86868b);
  border: 1px dashed var(--docs-border-strong, rgba(0, 0, 0, 0.14));
  border-radius: 8px;
}
.ird-add.is-empty:hover {
  color: var(--c-primary, #0a84ff);
  background: color-mix(in srgb, var(--c-primary, #0a84ff) 4%, transparent);
  border-color: color-mix(in srgb, var(--c-primary, #0a84ff) 50%, transparent);
}

/* ---------- 选择弹窗 ---------- */
.ird-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
}
.ird-picker-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
/* 分段控件 */
.ird-picker-tabs {
  flex-shrink: 0;
  display: inline-flex;
  padding: 2px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}
.ird-picker-tab {
  height: 26px;
  padding: 0 12px;
  font: inherit;
  font-size: 12.5px;
  color: var(--docs-text-2, #6e6e73);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
}
.ird-picker-tab.is-active {
  font-weight: 600;
  color: var(--docs-text, #1d1d1f);
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.ird-picker-search {
  max-width: 240px;
}
.ird-picker-list {
  height: 344px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--docs-border, rgba(0, 0, 0, 0.08));
  border-radius: 10px;
}
.ird-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.ird-picker-row:hover {
  background: var(--docs-hover, rgba(0, 0, 0, 0.05));
}
.ird-picker-row.is-picked {
  background: color-mix(in srgb, var(--c-primary, #0a84ff) 8%, transparent);
}
.ird-picker-row.is-disabled {
  cursor: not-allowed;
  background: transparent;
}
.ird-picker-row.is-disabled .ird-title {
  color: var(--docs-text-3, #86868b);
}
.ird-picker-tag {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--docs-text-3, #86868b);
}
.ird-picker-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 13px;
  color: var(--docs-text-3, #86868b);
}

@media (prefers-reduced-motion: reduce) {
  .ird *,
  .ird-picker * {
    transition: none !important;
  }
}
</style>
