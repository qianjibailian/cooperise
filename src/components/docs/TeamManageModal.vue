<template>
  <!-- 团队协作：点击条目在弹窗中管理（不跳转页面）；事项类可新建、查看详情 -->
  <a-modal :open="open" :title="title" :width="880" :footer="null" destroy-on-close @cancel="close">
    <div class="tm-toolbar">
      <a-input v-model:value="keyword" allow-clear :placeholder="placeholder" class="tm-search" @change="onKeywordChange" />
      <a-button v-if="kind === 'issue'" type="primary" @click="createOpen = true">新建{{ typeName || '事项' }}</a-button>
    </div>
    <a-table
      :columns="columns"
      :data-source="pagedRows"
      :loading="loading"
      :pagination="{ current: page, pageSize: PAGE_SIZE, total: rows.length, showSizeChanger: false, onChange: (p: number) => (page = p) }"
      :custom-row="customRow"
      :row-selection="selectable ? { selectedRowKeys: selectedKeys, onChange: onSelectChange } : undefined"
      row-key="key"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <span :style="record.statusColor ? { color: record.statusColor } : undefined">{{ record.status || '-' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'active'">
          <a-tag :color="record.active ? 'green' : 'default'">{{ record.active ? '在职' : '离职' }}</a-tag>
        </template>
      </template>
    </a-table>
    <div v-if="truncated" class="tm-hint">仅展示前 {{ FETCH_LIMIT }} 条事项中的匹配结果，可通过搜索缩小范围。</div>
    <div v-if="selectable" class="tm-foot">
      <span class="tm-count">已选 {{ selectedKeys.length }} 项</span>
      <a-button type="primary" :disabled="!selectedKeys.length" @click="confirmInsert">插入到文档</a-button>
    </div>
  </a-modal>

  <IssueDetailDrawer v-if="kind === 'issue'" v-model:open="detailOpen" :issue-key="detailKey" @changed="load" />
  <NewIssueFormModal v-if="kind === 'issue'" v-model:open="createOpen" @submitted="load" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  fuzzyQueryIssues,
  queryUsers,
  getOrganizationTree,
  type FuzzyIssueItem,
  type OrganizationNode,
} from '@/api/faiz'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'
import NewIssueFormModal from '@/components/NewIssueFormModal.vue'

type Kind = 'issue' | 'users' | 'dept'
interface Row {
  key: string
  [k: string]: unknown
}

const props = defineProps<{
  open: boolean
  kind: Kind
  title: string
  /** 事项类型名称（需求 / 任务）；为空表示全部事项 */
  typeName?: string
  /** 允许把选中的事项插入到文档（仅文档正文里打开时开启） */
  insertable?: boolean
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  /** 插入到文档：选中的事项原始数据 */
  confirm: [items: FuzzyIssueItem[]]
}>()

const selectable = computed(() => !!props.insertable && props.kind === 'issue')
/** 已选事项（跨页保留）：issueKey → 原始事项 */
const selectedMap: Record<string, FuzzyIssueItem> = {}
const selectedKeys = ref<string[]>([])
function clearSelection() {
  for (const k of Object.keys(selectedMap)) delete selectedMap[k]
  selectedKeys.value = []
}
function onSelectChange(keys: (string | number)[]) {
  const set = new Set(keys.map(String))
  // 只对当前页可见的行做增删，其它页的选择保持不变
  for (const r of rows.value) {
    if (!r.raw) continue
    const key = String(r.key)
    if (set.has(key)) selectedMap[key] = r.raw as FuzzyIssueItem
    else delete selectedMap[key]
  }
  selectedKeys.value = Object.keys(selectedMap)
}
function confirmInsert() {
  const items = Object.values(selectedMap)
  if (!items.length) return
  emit('confirm', items)
  clearSelection()
  emit('update:open', false)
}

const PAGE_SIZE = 10
/** 事项搜索接口没有按类型过滤参数，按类型筛选时最多拉取的条数（每页 10 条，最多 5 页） */
const FETCH_LIMIT = 50
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*-\d*$/

const keyword = ref('')
const loading = ref(false)
const rows = ref<Row[]>([])
const truncated = ref(false)
const page = ref(1)
const createOpen = ref(false)
const detailOpen = ref(false)
const detailKey = ref('')

const placeholder = computed(() =>
  props.kind === 'issue' ? '搜索事项编号或标题' : props.kind === 'users' ? '搜索姓名 / 账号' : '搜索部门名称',
)

const columns = computed(() => {
  if (props.kind === 'issue') {
    return [
      { title: '编号', dataIndex: 'code', width: 130 },
      { title: '标题', dataIndex: 'name', ellipsis: true },
      { title: '类型', dataIndex: 'typeLabel', width: 90 },
      { title: '状态', dataIndex: 'status', width: 110 },
      { title: '更新时间', dataIndex: 'updated', width: 160 },
    ]
  }
  if (props.kind === 'users') {
    return [
      { title: '姓名', dataIndex: 'name' },
      { title: '账号', dataIndex: 'code', width: 160 },
      { title: '状态', dataIndex: 'active', width: 100 },
    ]
  }
  return [
    { title: '部门', dataIndex: 'name', ellipsis: true },
    { title: '编码', dataIndex: 'code', width: 180 },
    { title: '层级', dataIndex: 'level', width: 90 },
  ]
})

const pagedRows = computed(() => rows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

function formatTime(v?: string): string {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('zh-CN', { hour12: false })
}

function issueRow(it: FuzzyIssueItem): Row {
  return {
    key: it.issueKey,
    code: it.issueKey,
    name: it.summary || '未命名事项',
    typeLabel: it.issueTypeName || '-',
    status: it.statusName || '',
    statusColor: it.statusColor,
    updated: formatTime(it.updateTime),
    raw: it,
  }
}

async function loadIssues(kw: string) {
  const found: Row[] = []
  truncated.value = false
  for (let p = 1; p <= FETCH_LIMIT / PAGE_SIZE; p++) {
    const payload = kw
      ? KEY_PATTERN.test(kw)
        ? { issueKey: kw, page: p, pageSize: PAGE_SIZE }
        : { summary: kw, page: p, pageSize: PAGE_SIZE }
      : { page: p, pageSize: PAGE_SIZE }
    const res = await fuzzyQueryIssues(payload)
    if (!res.success || !res.data) break
    const list = res.data.list || []
    for (const it of list) {
      if (!props.typeName || it.issueTypeName === props.typeName) found.push(issueRow(it))
    }
    const pageCount = res.data.pageCount ?? p
    if (list.length < PAGE_SIZE || p >= pageCount) break
    // 已拉满上限且服务端还有更多数据：提示结果可能不完整
    if (p === FETCH_LIMIT / PAGE_SIZE) truncated.value = true
  }
  rows.value = found
}

async function loadUsers(kw: string) {
  const res = await queryUsers({ keyword: kw, page: 1, pageSize: 50 })
  const list = res.success && res.data ? res.data.list || [] : []
  rows.value = list.map((u) => ({
    key: String(u.memberId ?? u.userNo),
    name: u.coAccount || u.userCoAccount || u.userEnName || u.userNo,
    code: u.userNo,
    active: u.isActive === true || u.isActive === 1,
  }))
}

function flattenOrg(nodes: OrganizationNode[], out: Row[], level = 1) {
  for (const n of nodes) {
    out.push({
      key: String(n.id),
      name: n.pathName || n.organizationName,
      code: n.organizationCode || '-',
      level,
    })
    const children = (n as OrganizationNode & { children?: OrganizationNode[] }).children
    if (children?.length) flattenOrg(children, out, level + 1)
  }
}

async function loadDepts(kw: string) {
  const res = await getOrganizationTree()
  const out: Row[] = []
  if (res.success && res.data) flattenOrg(res.data, out)
  const q = kw.trim().toLowerCase()
  rows.value = q ? out.filter((r) => String(r.name).toLowerCase().includes(q)) : out
}

async function load() {
  const kw = keyword.value.trim()
  loading.value = true
  try {
    if (props.kind === 'issue') await loadIssues(kw)
    else if (props.kind === 'users') await loadUsers(kw)
    else await loadDepts(kw)
  } catch {
    rows.value = []
  } finally {
    loading.value = false
    page.value = 1
  }
}

let timer: number | undefined
function onKeywordChange() {
  window.clearTimeout(timer)
  timer = window.setTimeout(load, 300)
}

function customRow(record: Row) {
  return {
    onClick: () => {
      if (props.kind !== 'issue') return
      detailKey.value = String(record.key)
      detailOpen.value = true
    },
    style: props.kind === 'issue' ? { cursor: 'pointer' } : undefined,
  }
}

function close() {
  emit('update:open', false)
}

watch(
  () => props.open,
  (v) => {
    if (!v) return
    keyword.value = ''
    clearSelection()
    void load()
  },
)
</script>

<style scoped>
.tm-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.tm-search {
  max-width: 320px;
}
.tm-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--docs-text-3);
}
.tm-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
.tm-count {
  margin-right: auto;
  font-size: 13px;
  color: var(--docs-text-3);
}
</style>
