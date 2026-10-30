<template>
  <div class="board-page">
    <!-- 顶部工具栏：视图名称 + 刷新 | 数量 + 筛选 + 分组 + 展示字段 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title" :title="pageTitle">{{ pageTitle }}</h1>
        <component :is="ReloadOutlined" class="refresh-icon" :class="{ spinning: loading }" @click="reload" />
      </div>
      <div class="top-bar-right">
        <span class="total-text">共 {{ visibleIssues.length }} 条</span>

        <a-popover
          v-model:open="filterPanelVisible"
          trigger="click"
          placement="bottomRight"
          :overlayInnerStyle="{ padding: 0 }"
          overlayClassName="filter-popover"
          :overlayStyle="{ width: '760px', maxWidth: 'calc(100vw - 32px)' }"
        >
          <template #content>
            <FilterPanel
              v-model:visible="filterPanelVisible"
              v-model="filterConditions"
              v-model:logic="filterLogic"
              @save="handleFilterSave"
              @reset="handleFilterReset"
            />
          </template>
          <a-button class="tool-btn" :class="{ active: filterDisplayCount > 0 }">
            <component :is="AlignCenterOutlined" />
            筛选({{ filterDisplayCount }})
          </a-button>
        </a-popover>

        <!-- 分组：看板列按所选字段的取值划分（默认按状态） -->
        <a-popover
          v-model:open="groupPanelVisible"
          trigger="click"
          placement="bottomRight"
          :overlayInnerStyle="{ padding: 0 }"
          overlayClassName="filter-popover"
          :overlayStyle="{ width: '240px' }"
        >
          <template #content>
            <div class="field-panel">
              <div class="field-panel-head">
                <span class="field-panel-title">分组</span>
                <span class="field-panel-hint">看板列按该字段划分</span>
              </div>
              <a-spin :spinning="fieldLoading">
                <div class="field-panel-list">
                  <label v-for="f in availableFields" :key="f.fieldId" class="field-option">
                    <a-checkbox :checked="groupFieldId === f.fieldId" @change="toggleGroupField(f.fieldId)" />
                    <span class="field-option-name" :title="f.fieldName">{{ f.fieldName }}</span>
                  </label>
                  <div v-if="!fieldLoading && !availableFields.length" class="field-panel-empty">暂无可选字段</div>
                </div>
              </a-spin>
            </div>
          </template>
          <a-button class="tool-btn" :class="{ active: !!groupFieldId }">
            <component :is="PartitionOutlined" />
            分组({{ groupFieldId ? 1 : 0 }})
          </a-button>
        </a-popover>

        <!-- 展示字段：卡片按勾选顺序每个字段一行 -->
        <a-popover
          v-model:open="fieldPanelVisible"
          trigger="click"
          placement="bottomRight"
          :overlayInnerStyle="{ padding: 0 }"
          overlayClassName="filter-popover"
          :overlayStyle="{ width: '280px' }"
        >
          <template #content>
            <div class="field-panel">
              <div class="field-panel-head">
                <span class="field-panel-title">展示字段</span>
                <span class="field-panel-hint">卡片只展示勾选的字段</span>
              </div>
              <a-input v-model:value="fieldKeyword" size="small" allow-clear placeholder="搜索字段" class="field-panel-search">
                <template #prefix><component :is="SearchOutlined" class="field-search-icon" /></template>
              </a-input>
              <a-spin :spinning="fieldLoading">
                <div class="field-panel-list">
                  <label v-for="f in filteredFields" :key="f.fieldId" class="field-option">
                    <a-checkbox :checked="shownFieldIds.includes(f.fieldId)" @change="toggleShownField(f.fieldId)" />
                    <span class="field-option-name" :title="f.fieldName">{{ f.fieldName }}</span>
                  </label>
                  <div v-if="!fieldLoading && !filteredFields.length" class="field-panel-empty">暂无可选字段</div>
                </div>
              </a-spin>
            </div>
          </template>
          <a-button class="tool-btn" :class="{ active: shownFieldIds.length > 0 }">
            <component :is="SettingOutlined" />
            展示字段({{ shownFieldIds.length }})
          </a-button>
        </a-popover>

      </div>
    </div>

    <!-- 看板列 -->
    <a-spin :spinning="loading || universeLoading" wrapper-class-name="board-spin">
      <div class="board-columns">
        <div
          v-for="col in columns"
          :key="col.key"
          class="board-column"
          :class="{
            'is-drop-target': dropKey === col.key && canDropTo(col),
            'can-drop': !!dragIssue && canDropTo(col),
            'no-drop': !!dragIssue && !canDropTo(col) && dragIssue.groupKey !== col.key,
            'is-deny': hoverKey === col.key && isDenied(col),
          }"
          :style="{ '--col': col.color }"
          @dragover="onDragOver($event, col)"
          @dragleave="onDragLeave($event, col.key)"
          @drop.prevent="onDrop(col)"
        >
          <div class="column-header">
            <div class="column-header-left">
              <a-avatar v-if="col.isUser" :size="20" :src="col.avatar || undefined" class="column-avatar">
                {{ col.label.slice(0, 1) }}
              </a-avatar>
              <span v-else class="column-dot" />
              <span class="column-title" :title="col.label">{{ col.label }}</span>
              <span class="column-count">{{ col.issues.length }}</span>
              <span v-if="dragIssue && dragIssue.groupKey !== col.key && !canDropTo(col)" class="column-lock" title="工作流不允许流转到该状态">
                <LockOutlined />
              </span>
            </div>
          </div>

          <!-- 拖到工作流不允许的状态列：红框 + 提示 -->
          <div v-if="hoverKey === col.key && dragIssue && dragIssue.groupKey !== col.key && !canDropTo(col)" class="column-drop-tip" :class="{ checking: !allowedNodes }">
            <template v-if="allowedNodes"><LockOutlined /> 不允许拖动到「{{ col.label }}」</template>
            <template v-else>正在校验工作流…</template>
          </div>
          <div class="column-body">
            <template v-if="hasShownFields">
              <div
                v-for="issue in col.issues"
                :key="issue.id"
                class="board-card"
                :class="{ dragging: dragIssue?.id === issue.id, draggable: canDrag, moving: movingKey === issue.issueKey }"
                :draggable="canDrag"
                :style="{ '--tc-accent': col.color }"
                :title="issue.lines.map((l) => l.text).join('\n')"
                @dragstart="onDragStart($event, issue)"
                @dragend="onDragEnd"
                @click="openIssue(issue.issueKey)"
              >
                <!-- 按勾选顺序每个字段一行：单号 / 状态 / 类型为彩色标签，概要加粗，其余为次要文字 -->
                <span v-for="line in issue.lines" :key="line.id" class="card-line">
                  <span v-if="line.tagColor" class="card-tag" :class="`is-${line.id}`" :style="{ '--tag': line.tagColor }">
                    <span v-if="line.id === 'status'" class="card-tag-dot" />{{ line.text }}
                  </span>
                  <span v-else-if="line.id === 'summary'" class="card-title">{{ line.text }}</span>
                  <span v-else-if="line.isUser" class="card-user">
                    <a-avatar :size="18" :src="line.avatar || undefined" class="card-avatar">{{ line.text.charAt(0) }}</a-avatar>
                    <span class="card-sub">{{ line.text }}</span>
                  </span>
                  <span v-else class="card-sub">{{ line.text }}</span>
                </span>
              </div>
              <div v-if="!col.issues.length" class="column-empty">
                <InboxOutlined class="empty-icon" />
                <span>暂无事项</span>
              </div>
            </template>
            <div v-else class="column-empty">
              <span>未勾选展示字段</span>
            </div>
          </div>
        </div>

        <div v-if="!columns.length && !loading" class="board-empty">
          <a-empty description="暂无事项" />
        </div>
      </div>
    </a-spin>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ReloadOutlined,
  AlignCenterOutlined,
  PartitionOutlined,
  SettingOutlined,
  SearchOutlined,
  InboxOutlined,
  LockOutlined,
} from '@ant-design/icons-vue'
import FilterPanel from '@/components/FilterPanel.vue'
import {
  isConditionComplete,
  buildGlobalFilter,
  parseGlobalFilter,
  type FilterCondition,
  type FilterLogic,
} from '@/utils/issueFilter'
import {
  getIssues,
  getFilterDraft,
  updateFilterDraft,
  queryAvailableFieldList,
  getWorkflowNextNodes,
  changeWorkflowTaskStatus,
  type WorkflowNextNode,
} from '@/api/faiz'
import { getLoginUsername } from '@/utils/auth'
import type { AvailableFieldItem, FilterDraft, GlobalFilter, IssueQueryPayload, IssueRecord } from '@/types/faiz'
import {
  NONE_GROUP_KEY,
  fieldOf,
  objOf,
  issueKeyOf,
  buildFieldLines,
  groupValueOf,
  fetchGroupUniverse,
  safeParse,
  parseShownFieldIds,
  parseGroupFieldId,
  type GroupValue,
  type FieldLine,
} from '@/utils/issue-view'
import { useAuth } from '@/utils/auth'
import { useViewStore } from '@/utils/view-store'

/** 看板卡片 */
interface BoardIssue {
  id: string
  issueKey: string
  group: GroupValue
  lines: FieldLine[]
}

/** 默认按状态分列（草稿未保存过分组时） */
const DEFAULT_GROUP_FIELD_ID = 'status'
/** 看板自身需要、始终随查询请求的字段：单号（跳详情 / 拖拽变更状态）、状态、问题类型（确定状态列取哪些类型的状态） */
const REQUIRED_FIELD_IDS = ['issuekey', 'status', 'issuetype']
/** 一次拉取的事项上限（不分页，按列在前端归类） */
const BOARD_PAGE_SIZE = 1000
/** 不分组时的唯一一列 */
const ALL_COLUMN: GroupValue = { key: '__all__', label: '全部事项', avatar: '', isUser: false, color: '#6B95C9' }

const router = useRouter()
function openIssue(issueKey: string) {
  if (issueKey) router.push({ name: 'IssueDetail', params: { issueKey } })
}

// ---------- 标题：取当前视图名称 ----------
const route = useRoute()
const { ensureLoaded, findViewItem } = useViewStore()
const filterCode = computed(() => (route.params.filterCode as string) || '')
const pageTitle = computed(() => findViewItem(filterCode.value)?.filterName || '看板')

// ---------- 草稿（筛选条件 + 分组 + 展示字段，按视图保存） ----------
const { user } = useAuth()
const draftUserNo = computed(() => user.value?.memberId || '10284941')
const viewCode = computed(() => filterCode.value || 'KAN_BAN')
const draftFilter = ref<FilterDraft | null>(null)

async function loadDraft() {
  try {
    const res = await getFilterDraft(draftUserNo.value, viewCode.value)
    const d = res?.success ? res.data : null
    draftFilter.value = d ?? null
    const gf = safeParse<GlobalFilter | null>(d?.globalFilter, null)
    if (gf?.filter) {
      const { conditions, logic } = parseGlobalFilter(gf)
      filterConditions.value = conditions
      filterLogic.value = logic
    }
    shownFieldIds.value = parseShownFieldIds(d?.showField)
    groupFieldId.value = parseGroupFieldId(d?.group) ?? DEFAULT_GROUP_FIELD_ID
  } catch {
    draftFilter.value = null
    groupFieldId.value = DEFAULT_GROUP_FIELD_ID
  }
}

async function saveDraft(patch: Partial<FilterDraft>) {
  try {
    const res = await updateFilterDraft({
      id: draftFilter.value?.id,
      userNo: draftUserNo.value,
      viewCode: viewCode.value,
      ...patch,
    })
    if (res?.success) {
      const fresh = await getFilterDraft(draftUserNo.value, viewCode.value)
      if (fresh?.success && fresh.data) draftFilter.value = fresh.data
    }
  } catch {
    // 请求层已统一提示
  }
}

// ---------- 筛选（复用「我的事项」的全局筛选组件） ----------
const filterPanelVisible = ref(false)
const filterConditions = ref<FilterCondition[]>([])
const filterLogic = ref<FilterLogic>('AND')
const filterDisplayCount = computed(() => filterConditions.value.filter(isConditionComplete).length)

async function handleFilterSave() {
  await saveDraft({ globalFilter: JSON.stringify(buildGlobalFilter(filterConditions.value, filterLogic.value)) })
  reload()
}

function handleFilterReset() {
  filterConditions.value = []
  filterLogic.value = 'AND'
  handleFilterSave()
}

// ---------- 字段列表（分组 / 展示字段共用，取 /availableField/list） ----------
const availableFields = ref<AvailableFieldItem[]>([])
const fieldLoading = ref(false)

async function loadAvailableFields() {
  fieldLoading.value = true
  try {
    const res = await queryAvailableFieldList({ page: 1, pageSize: 500, searchKey: '' })
    if (res?.success && res.data?.list) availableFields.value = res.data.list.filter((f) => !f.obsolete)
  } catch {
    // 请求层已统一提示
  } finally {
    fieldLoading.value = false
  }
}

function fieldMeta(fieldId: string): AvailableFieldItem | undefined {
  return availableFields.value.find((f) => f.fieldId === fieldId)
}

// ---------- 展示字段 ----------
const fieldPanelVisible = ref(false)
const fieldKeyword = ref('')
/** 勾选的展示字段 ID（有序）；未勾选时卡片不展示内容 */
const shownFieldIds = ref<string[]>([])
const hasShownFields = computed(() => shownFieldIds.value.length > 0)

const filteredFields = computed(() => {
  const kw = fieldKeyword.value.trim().toLowerCase()
  return kw ? availableFields.value.filter((f) => f.fieldName.toLowerCase().includes(kw)) : availableFields.value
})

async function toggleShownField(id: string) {
  shownFieldIds.value = shownFieldIds.value.includes(id)
    ? shownFieldIds.value.filter((x) => x !== id)
    : [...shownFieldIds.value, id]
  await saveDraft({ showField: JSON.stringify({ showFieldItemList: shownFieldIds.value }) })
  reload()
}

// ---------- 查询结果（分组的状态列也依赖它，需先声明） ----------
const rawRecords = ref<IssueRecord[]>([])
const loading = ref(false)

// ---------- 分组（看板列） ----------
const groupPanelVisible = ref(false)
/** 分组字段 ID；空为不分组（只有一列） */
const groupFieldId = ref(DEFAULT_GROUP_FIELD_ID)
const groupUniverse = ref<GroupValue[]>([])
const universeLoading = ref(false)

/** 勾选分组字段（单选）；点击已勾选的字段则取消分组 */
async function toggleGroupField(fieldId: string) {
  const id = groupFieldId.value === fieldId ? '' : fieldId
  groupFieldId.value = id
  await saveDraft({
    group: JSON.stringify({ groupItemList: id ? [{ field: { id } }] : [], isFollowPreviousGroup: true }),
  })
  reload()
}

let universeSeq = 0
/** 分组字段的全部取值：没有事项的取值也作为空列展示 */
/**
 * 状态列取哪些问题类型的状态：
 * 筛选里有「问题类型 属于 …」时取所选类型；否则取查询结果里出现的类型（都没有时为空，表示全部类型）
 */
const statusIssueTypeCodes = computed<string[]>(() => {
  const cond = filterConditions.value.find(
    (c) => c.field === 'issuetype' && c.operator === 'BELONG' && isConditionComplete(c),
  )
  if (cond) return [...new Set(cond.values)].sort()
  const codes = new Set<string>()
  for (const rec of rawRecords.value) {
    const o = objOf(fieldOf(rec, 'issuetype')?.value)
    const code = o?.issueTypeCode ?? o?.id
    if (code != null && code !== '') codes.add(String(code))
  }
  return [...codes].sort()
})

async function loadGroupUniverse() {
  const seq = ++universeSeq
  const fieldId = groupFieldId.value
  groupUniverse.value = []
  if (!fieldId) return
  universeLoading.value = true
  try {
    const list = await fetchGroupUniverse(fieldId, fieldMeta(fieldId), {
      issueTypeCodes: fieldId === 'status' ? statusIssueTypeCodes.value : undefined,
    })
    if (seq === universeSeq) groupUniverse.value = list
  } catch {
    // 请求层已统一提示；仅展示有事项的列
  } finally {
    if (seq === universeSeq) universeLoading.value = false
  }
}

watch(groupFieldId, loadGroupUniverse)
// 按状态分组时，相关问题类型变化（改了筛选 / 结果里的类型变了）需重拉状态列
watch(
  () => (groupFieldId.value === 'status' ? statusIssueTypeCodes.value.join(',') : ''),
  (key, prev) => {
    if (groupFieldId.value === 'status' && key !== prev) loadGroupUniverse()
  },
)
// 字段列表加载后人员 / 下拉字段判断才准确，需重拉
watch(
  () => (groupFieldId.value ? fieldMeta(groupFieldId.value)?.fieldId : ''),
  (id, prev) => {
    if (id && id !== prev) loadGroupUniverse()
  },
)

// 打开分组 / 展示字段面板时刷新字段列表
watch([groupPanelVisible, fieldPanelVisible], ([a, b]) => {
  if (a || b) loadAvailableFields()
})

// ---------- 查询 ----------

function buildQueryPayload(): IssueQueryPayload {
  const d = draftFilter.value
  const groupIds = groupFieldId.value ? [groupFieldId.value] : []
  return {
    globalFilter: buildGlobalFilter(filterConditions.value, filterLogic.value),
    group: { groupItemList: groupIds.map((id) => ({ field: { id } })), isFollowPreviousGroup: true },
    layered: { layeredItemList: [], layerType: 'FLAT' },
    page: 1,
    pageSize: BOARD_PAGE_SIZE,
    showField: { showFieldItemList: [...new Set([...REQUIRED_FIELD_IDS, ...groupIds, ...shownFieldIds.value])] },
    sort: { sortItemList: [{ field: { id: 'createtime' }, sortTypeCode: 'DESC' }] },
    viewCode: d?.viewCode ?? viewCode.value,
    needShowGroupValues: [],
    referencedFilter: safeParse(d?.referencedFilter, { filter: null }),
  }
}

let querySeq = 0
async function reload() {
  const seq = ++querySeq
  loading.value = true
  try {
    const res = await getIssues(buildQueryPayload())
    if (seq === querySeq) rawRecords.value = res?.success ? res.data?.list ?? [] : []
  } catch {
    if (seq === querySeq) rawRecords.value = []
  } finally {
    if (seq === querySeq) loading.value = false
  }
}

/** 事项分组值 → 列键：先按键匹配全部取值，对不上再按名称匹配 */
const resolveGroupKey = computed(() => {
  const keys = new Set(groupUniverse.value.map((g) => g.key))
  const byLabel = new Map(groupUniverse.value.map((g) => [g.label, g.key] as const))
  return (g: GroupValue): string => (keys.has(g.key) ? g.key : byLabel.get(g.label) ?? g.key)
})

const visibleIssues = computed<(BoardIssue & { groupKey: string })[]>(() =>
  rawRecords.value.map((rec, i) => {
    const issueKey = issueKeyOf(rec)
    const group = groupFieldId.value ? groupValueOf(rec, groupFieldId.value, fieldMeta(groupFieldId.value)) : ALL_COLUMN
    return {
      id: issueKey || `row-${i}`,
      issueKey,
      group,
      groupKey: groupFieldId.value ? resolveGroupKey.value(group) : ALL_COLUMN.key,
      lines: buildFieldLines(rec, shownFieldIds.value),
    }
  }),
)

/** 看板列：分组字段的取值（按状态分组时只取相关问题类型的状态，顺序沿用状态配置）+ 事项里出现的其它取值，「未设置」排最后 */
const columns = computed(() => {
  const map = new Map<string, GroupValue & { issues: typeof visibleIssues.value }>()
  if (!groupFieldId.value) {
    return [{ ...ALL_COLUMN, issues: visibleIssues.value }]
  }
  for (const g of groupUniverse.value) {
    if (!map.has(g.key)) map.set(g.key, { ...g, issues: [] })
  }
  for (const it of visibleIssues.value) {
    const col = map.get(it.groupKey) ?? { ...it.group, key: it.groupKey, issues: [] }
    col.issues.push(it)
    map.set(it.groupKey, col)
  }
  const list = [...map.values()]
  const none = list.filter((c) => c.key === NONE_GROUP_KEY)
  return [...list.filter((c) => c.key !== NONE_GROUP_KEY), ...none]
})

// ---------- 拖拽：仅按状态分组时可用，只能拖到工作流允许流转的状态 ----------
type DragIssue = BoardIssue & { groupKey: string }
const canDrag = computed(() => groupFieldId.value === 'status')
const dragIssue = ref<DragIssue | null>(null)
const dropKey = ref('')
/** 拖拽经过的列（含不可放下的列，用于红框提示） */
const hoverKey = ref('')
/** 当前拖拽事项可流转的节点：状态编码 → 节点（拖拽开始时按单号查询工作流） */
const allowedNodes = ref<Map<string, WorkflowNextNode> | null>(null)
/** 正在提交状态变更的事项（卡片显示处理中） */
const movingKey = ref('')
/** 状态变更操作人：登录账号（与状态变更弹窗一致） */
const operator = getLoginUsername() || localStorage.getItem('wf_current_user') || '10284941'

let nextNodesSeq = 0
async function loadAllowedNodes(issueKey: string) {
  const seq = ++nextNodesSeq
  allowedNodes.value = null
  try {
    const res = await getWorkflowNextNodes(issueKey)
    if (seq !== nextNodesSeq) return
    const map = new Map<string, WorkflowNextNode>()
    for (const n of res?.data?.nextNodes ?? []) {
      // 列键为状态编码；节点未配置状态编码时按节点名与列名匹配
      const key = n.statusCode || `name:${n.nodeName}`
      if (!map.has(key)) map.set(key, n)
    }
    allowedNodes.value = map
  } catch {
    if (seq === nextNodesSeq) allowedNodes.value = new Map()
  }
}

/** 列对应的可流转节点（没有则不可拖入） */
function nodeForColumn(col: GroupValue): WorkflowNextNode | undefined {
  const map = allowedNodes.value
  if (!map) return undefined
  return map.get(col.key) ?? map.get(`name:${col.label}`)
}

function canDropTo(col: GroupValue): boolean {
  return !!dragIssue.value && dragIssue.value.groupKey !== col.key && !!nodeForColumn(col)
}

/** 工作流已校验完且不允许流转到该列（原列不算） */
function isDenied(col: GroupValue): boolean {
  return !!dragIssue.value && !!allowedNodes.value && dragIssue.value.groupKey !== col.key && !nodeForColumn(col)
}

function onDragStart(e: DragEvent, issue: DragIssue) {
  if (!canDrag.value || !issue.issueKey || movingKey.value) {
    e.preventDefault()
    return
  }
  dragIssue.value = issue
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', issue.issueKey)
  }
  loadAllowedNodes(issue.issueKey)
}

function onDragEnd() {
  dragIssue.value = null
  dropKey.value = ''
  hoverKey.value = ''
  allowedNodes.value = null
  nextNodesSeq++
}

/** 只有可流转的列才接受放下（preventDefault），其余列浏览器显示禁止光标并红框提示 */
function onDragOver(e: DragEvent, col: GroupValue) {
  if (!dragIssue.value) return
  hoverKey.value = col.key
  if (!canDropTo(col)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropKey.value = col.key
}

/** 离开列：移到列内子元素时也会触发 dragleave，需排除 */
function onDragLeave(e: DragEvent, key: string) {
  const to = e.relatedTarget as Node | null
  if (to && (e.currentTarget as HTMLElement).contains(to)) return
  if (dropKey.value === key) dropKey.value = ''
  if (hoverKey.value === key) hoverKey.value = ''
}

/** 放到可流转的列：按工作流节点变更状态 */
async function onDrop(col: GroupValue) {
  const issue = dragIssue.value
  const node = nodeForColumn(col)
  onDragEnd()
  if (!issue || !node || issue.groupKey === col.key) return
  movingKey.value = issue.issueKey
  try {
    const res = await changeWorkflowTaskStatus({
      issueKey: issue.issueKey,
      targetStatus: node.nodeId,
      ...(node.statusCode ? { statusId: node.statusCode } : {}),
      operator,
    })
    if (res?.success) await reload()
  } catch {
    // 请求层已统一提示
  } finally {
    movingKey.value = ''
  }
}


// ---------- 生命周期 ----------
async function init() {
  await loadDraft()
  await reload()
}

onMounted(() => {
  ensureLoaded()
  loadAvailableFields()
  init()
})

// 同一组件内切换看板视图：重新读草稿并查询
watch(filterCode, () => {
  draftFilter.value = null
  filterConditions.value = []
  filterLogic.value = 'AND'
  shownFieldIds.value = []
  groupFieldId.value = DEFAULT_GROUP_FIELD_ID
  init()
})
</script>

<style scoped>
.board-page {
  /* 与「我的事项」一致：抵消布局内边距，撑满内容区 */
  height: calc(100vh - 75px);
  height: calc(100dvh - 75px);
  width: calc(100% + 1vh);
  max-width: none;
  margin: -2vh -0.5vh;
  min-height: 560px;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ---- 顶部工具栏（与日历看板一致） ---- */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 24px 14px;
  flex-shrink: 0;
}
.top-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.refresh-icon {
  flex-shrink: 0;
  font-size: 15px;
  color: #8e8e93;
  cursor: pointer;
  transition: color 0.2s;
}
.refresh-icon:hover {
  color: var(--c-primary);
}
.refresh-icon.spinning {
  animation: board-spin 0.8s linear infinite;
}
@keyframes board-spin {
  to { transform: rotate(360deg); }
}
.top-bar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.total-text {
  margin-right: 6px;
  font-size: 13px;
  color: #86868b;
  white-space: nowrap;
}
.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px !important;
  font-size: 13px;
  font-weight: 500;
  color: #3a3a3c !important;
  background: #f2f2f7 !important;
  border: none !important;
  border-radius: 8px !important;
  box-shadow: none !important;
  transition: background 0.15s, color 0.15s;
}
.tool-btn:hover {
  background: #e5e5ea !important;
}
.tool-btn.active {
  color: var(--c-primary) !important;
  background: var(--c-primary-bg) !important;
}

/* ---- 字段面板（分组 / 展示字段） ---- */
.field-panel {
  padding: 12px 0 8px;
}
.field-panel-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 14px 8px;
}
.field-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}
.field-panel-hint {
  font-size: 12px;
  color: #86868b;
}
.field-panel-search {
  margin: 0 14px 6px;
  width: calc(100% - 28px);
}
.field-search-icon {
  color: #aeaeb2;
}
.field-panel-list {
  max-height: min(360px, calc(100vh - 240px));
  max-height: min(360px, calc(100dvh - 240px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 6px;
}
.field-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.field-option:hover {
  background: #f5f5f7;
}
.field-option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #1d1d1f;
}
.field-panel-empty {
  padding: 16px 0;
  font-size: 12px;
  color: #86868b;
  text-align: center;
}

/* ---- 看板列 ---- */
.board-spin {
  flex: 1;
  min-height: 0;
}
.board-spin :deep(.ant-spin-container) {
  height: 100%;
}
.board-columns {
  height: 100%;
  display: flex;
  align-items: stretch;
  gap: 14px;
  padding: 0 24px 20px;
  overflow-x: auto;
}
.board-column {
  position: relative;
  flex: 0 0 288px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: #fafafc;
  transition: background 0.15s, box-shadow 0.15s;
}
.board-column.can-drop {
  box-shadow: inset 0 0 0 1px transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--col) 45%, transparent);
}
.board-column.no-drop {
  opacity: 0.5;
}
/* 拖到不允许的列：红框，取消置灰让提示清晰 */
.board-column.is-deny {
  opacity: 1;
  background: #fff5f5;
  box-shadow: inset 0 0 0 2px #ff6b6b;
}
.column-drop-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: calc(100% - 24px);
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #d92d20;
  background: #fff;
  box-shadow: 0 6px 20px rgba(217, 45, 32, 0.16), 0 0 0 1px rgba(217, 45, 32, 0.18);
  transform: translate(-50%, -50%);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.column-drop-tip.checking {
  color: #6e6e73;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.08);
}
.column-lock {
  flex-shrink: 0;
  font-size: 12px;
  color: #aeaeb2;
}
.board-card.moving {
  opacity: 0.55;
  pointer-events: none;
}
.board-column.is-drop-target {
  background: #fafafc;
  background: color-mix(in srgb, var(--col) 8%, #fafafc);
  box-shadow: inset 0 0 0 2px var(--col);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--col) 55%, transparent);
}
.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 8px 14px;
  flex-shrink: 0;
}
.column-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.column-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 3px;
  background: var(--col);
}
.column-avatar {
  flex-shrink: 0;
  font-size: 10px;
  background: var(--col);
}
.column-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}
.column-count {
  flex-shrink: 0;
  min-width: 20px;
  padding: 0 7px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  color: #6e6e73;
  background: #efeff3;
}
.column-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 10px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ---- 卡片：白底 + 列色左条，字段上下分布（与日历事项条一致） ---- */
.board-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-shrink: 0;
  padding: 10px 12px 10px 13px;
  border-left: 3px solid var(--tc-accent, #8c8c8c);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.03);
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s, opacity 0.15s;
}
.board-card:hover {
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.04);
  transform: translateY(-1px);
}
.board-card.draggable {
  cursor: grab;
}
.board-card.dragging {
  opacity: 0.45;
}
.card-line {
  display: flex;
  min-width: 0;
}
.card-title {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: #1d1d1f;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.card-avatar {
  flex-shrink: 0;
  font-size: 10px;
  line-height: 18px;
  background: var(--tc-accent, #8c8c8c);
}
.card-sub {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  color: #6e6e73;
}
/* 标签：圆角胶囊，同色浅底 + 加深的同色文字 */
.card-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  line-height: 20px;
  color: var(--tag);
  color: color-mix(in srgb, var(--tag) 70%, #1d1d1f);
  background: #fff;
  background: color-mix(in srgb, var(--tag) 14%, #fff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-tag.is-issuekey {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 400;
  color: #6e6e73;
  background: #f2f2f7;
}
.card-tag.is-status {
  color: #3a3a3c;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.card-tag-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--tag);
}

/* ---- 空态 ---- */
.column-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 0;
  font-size: 12px;
  color: #aeaeb2;
}
.empty-icon {
  font-size: 22px;
}
.board-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .top-bar {
    flex-wrap: wrap;
    padding: 14px 16px 12px;
  }
  .top-bar-right {
    flex-wrap: wrap;
  }
  .board-columns {
    padding: 0 16px 16px;
  }
  .board-column {
    flex-basis: 260px;
  }
}
</style>
