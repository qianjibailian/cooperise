<template>
  <div class="gantt-page">
    <!-- 顶部工具栏：视图名称 + 刷新 + 今天 / 刻度 | 数量 + 筛选 + 字段映射 + 分组 + 展示字段 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title" :title="pageTitle">{{ pageTitle }}</h1>
        <component :is="ReloadOutlined" class="refresh-icon" :class="{ spinning: loading }" @click="reload" />
        <span class="toolbar-divider" />
        <button type="button" class="today-btn" @click="scrollToToday">今天</button>
        <div class="scale-switch">
          <button
            v-for="s in SCALES"
            :key="s.value"
            type="button"
            class="scale-btn"
            :class="{ active: scale === s.value }"
            @click="setScale(s.value)"
          >{{ s.label }}</button>
        </div>
      </div>
      <div class="top-bar-right">
        <span class="total-text">共 {{ rows.length }} 条</span>

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

        <!-- 字段映射：任务条的开始 / 结束日期取哪个字段 -->
        <a-popover
          v-model:open="mappingPanelVisible"
          trigger="click"
          placement="bottomRight"
          :overlayInnerStyle="{ padding: 0 }"
          overlayClassName="filter-popover"
          :overlayStyle="{ width: '300px' }"
        >
          <template #content>
            <div class="field-panel mapping-panel">
              <div class="field-panel-head">
                <span class="field-panel-title">字段映射</span>
                <span class="field-panel-hint">任务条按日期字段排布</span>
              </div>
              <div class="mapping-row">
                <span class="mapping-label">开始日期</span>
                <a-select
                  :value="startFieldId"
                  size="small"
                  class="mapping-select"
                  :options="mappingFieldOptions"
                  :loading="fieldLoading"
                  show-search
                  option-filter-prop="label"
                  @change="(v: unknown) => setMapping('start', String(v ?? ''))"
                />
              </div>
              <div class="mapping-row">
                <span class="mapping-label">结束日期</span>
                <a-select
                  :value="endFieldId || undefined"
                  size="small"
                  class="mapping-select"
                  placeholder="不设置（任务条只占开始当天）"
                  allow-clear
                  :options="mappingFieldOptions.filter((o) => o.value !== startFieldId)"
                  :loading="fieldLoading"
                  show-search
                  option-filter-prop="label"
                  @change="(v: unknown) => setMapping('end', v == null ? '' : String(v))"
                />
              </div>
            </div>
          </template>
          <a-button class="tool-btn" :class="{ active: !!endFieldId || startFieldId !== DEFAULT_START_FIELD_ID }">
            <component :is="SwapOutlined" />
            字段映射
          </a-button>
        </a-popover>

        <!-- 分组：左侧按所选字段分组，可折叠 -->
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
                <span class="field-panel-hint">勾选一个字段，再次点击取消</span>
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

        <!-- 展示字段：左侧任务列按勾选顺序每个字段一行 -->
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
                <span class="field-panel-hint">任务只展示勾选的字段</span>
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

    <!-- 甘特图：左侧任务列（吊顶 + 吸左）+ 右侧时间轴，同一个滚动容器保证上下 / 左右同步 -->
    <a-spin :spinning="loading || universeLoading" wrapper-class-name="gantt-spin">
      <div class="gantt-body">
        <div v-if="!hasShownFields" class="gantt-empty">
          <a-empty description="未勾选展示字段，点击右上角「展示字段」勾选后展示事项" />
        </div>
        <div v-else-if="!rows.length && !loading" class="gantt-empty">
          <a-empty description="暂无事项" />
        </div>
        <div v-else ref="scrollRef" class="gantt-scroll">
          <div class="gantt-canvas" :style="{ width: `${LEFT_WIDTH + timelineWidth}px` }">
            <!-- 表头 -->
            <div class="g-head">
              <div class="g-head-left">
                <span>事项</span>
                <span class="g-head-count">{{ rows.length }}</span>
              </div>
              <div class="g-head-timeline" :style="{ width: `${timelineWidth}px` }">
                <div class="g-head-top">
                  <span
                    v-for="m in headerTop"
                    :key="m.key"
                    class="g-head-cell"
                    :style="{ left: `${m.left}px`, width: `${m.width}px` }"
                  >{{ m.label }}</span>
                </div>
                <div class="g-head-bottom">
                  <span
                    v-for="d in headerBottom"
                    :key="d.key"
                    class="g-head-cell"
                    :class="{ weekend: d.weekend, today: d.today }"
                    :style="{ left: `${d.left}px`, width: `${d.width}px` }"
                  >{{ d.label }}</span>
                </div>
              </div>
            </div>

            <!-- 行 -->
            <div class="g-rows" :style="{ '--day': `${dayWidth}px` }">
              <!-- 今天竖线 -->
              <div v-if="todayOffset !== null" class="g-today-line" :style="{ left: `${LEFT_WIDTH + todayOffset}px` }" />

              <template v-for="block in blocks" :key="block.key">
                <!-- 分组行 -->
                <div v-if="block.group" class="g-row g-group-row" @click="toggleCollapse(block.key)">
                  <div class="g-left g-group-left" :style="{ '--gc': block.group.color }">
                    <component :is="collapsed.includes(block.key) ? RightOutlined : DownOutlined" class="g-group-arrow" />
                    <a-avatar v-if="block.group.isUser" :size="20" :src="block.group.avatar || undefined" class="g-group-avatar">
                      {{ block.group.label.slice(0, 1) }}
                    </a-avatar>
                    <span v-else class="g-group-dot" />
                    <span class="g-group-name" :title="block.group.label">{{ block.group.label }}</span>
                    <span class="g-group-count">{{ block.rows.length }}</span>
                  </div>
                  <div class="g-track g-group-track" />
                </div>

                <!-- 任务行 -->
                <template v-if="!collapsed.includes(block.key)">
                  <div v-for="row in block.rows" :key="row.id" class="g-row" @click="openIssue(row.issueKey)">
                    <div class="g-left">
                      <span v-for="line in row.lines" :key="line.id" class="g-line">
                        <span
                          v-if="line.tagColor"
                          class="g-tag"
                          :class="`is-${line.id}`"
                          :style="{ '--tag': line.tagColor }"
                        >
                          <span v-if="line.id === 'status'" class="g-tag-dot" />{{ line.text }}
                        </span>
                        <span v-else-if="line.id === 'summary'" class="g-title">{{ line.text }}</span>
                        <span v-else-if="line.isUser" class="g-user">
                          <a-avatar :size="16" :src="line.avatar || undefined" class="g-avatar">{{ line.text.charAt(0) }}</a-avatar>
                          <span class="g-sub">{{ line.text }}</span>
                        </span>
                        <span v-else class="g-sub">{{ line.text }}</span>
                      </span>
                    </div>
                    <div class="g-track">
                      <div
                        class="g-bar"
                        :class="{ 'is-point': row.startDate === row.endDate }"
                        :style="{
                          left: `${row.left}px`,
                          width: `${row.width}px`,
                          '--bar': row.color,
                        }"
                        :title="`${row.title || row.issueKey}\n${row.startDate === row.endDate ? row.startDate : `${row.startDate} ~ ${row.endDate}`}`"
                      >
                        <span class="g-bar-text">{{ row.title || row.issueKey }}</span>
                      </div>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- 事项详情抽屉 -->
    <IssueDetailDrawer v-model:open="detailOpen" :issue-key="detailIssueKey" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import dayjs, { type Dayjs } from 'dayjs'
import {
  ReloadOutlined,
  AlignCenterOutlined,
  SwapOutlined,
  PartitionOutlined,
  SettingOutlined,
  SearchOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import FilterPanel from '@/components/FilterPanel.vue'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'
import {
  isConditionComplete,
  buildGlobalFilter,
  parseGlobalFilter,
  type FilterCondition,
  type FilterLogic,
} from '@/utils/issueFilter'
import { getIssues, getFilterDraft, updateFilterDraft, queryAvailableFieldList } from '@/api/faiz'
import type { AvailableFieldItem, FilterDraft, GlobalFilter, IssueQueryPayload, IssueRecord } from '@/types/faiz'
import {
  DATE_TYPES,
  NONE_GROUP_KEY,
  fieldOf,
  objOf,
  colorOf,
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

/** 甘特任务行 */
interface GanttRow {
  id: string
  issueKey: string
  title: string
  startDate: string
  endDate: string
  statusColor: string
  group: GroupValue | null
  lines: FieldLine[]
}

/** 字段映射默认的开始日期字段 */
const DEFAULT_START_FIELD_ID = 'createtime'
/** 看板自身需要、始终随查询请求的字段：单号（详情）、状态（配色）、概要（任务条文字） */
const REQUIRED_FIELD_IDS = ['issuekey', 'status', 'summary']
const GANTT_PAGE_SIZE = 1000
/** 左侧任务列宽度 */
const LEFT_WIDTH = 320
/** 时间轴最长天数（异常数据保护） */
const MAX_RANGE_DAYS = 730
const SCALES = [
  { value: 'day', label: '日', dayWidth: 36 },
  { value: 'week', label: '周', dayWidth: 18 },
  { value: 'month', label: '月', dayWidth: 6 },
] as const
type Scale = (typeof SCALES)[number]['value']
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

// ---------- 标题 ----------
const route = useRoute()
const { ensureLoaded, findViewItem } = useViewStore()
const filterCode = computed(() => (route.params.filterCode as string) || '')
const pageTitle = computed(() => findViewItem(filterCode.value)?.filterName || '甘特图')

// ---------- 事项详情抽屉 ----------
const detailOpen = ref(false)
const detailIssueKey = ref('')
function openIssue(issueKey: string) {
  if (!issueKey) return
  detailIssueKey.value = issueKey
  detailOpen.value = true
}
watch(detailOpen, (open) => {
  if (!open && detailIssueKey.value) reload()
})

// ---------- 草稿（筛选 + 分组 + 展示字段，按视图保存） ----------
const { user } = useAuth()
const draftUserNo = computed(() => user.value?.memberId || '10284941')
const viewCode = computed(() => filterCode.value || 'gantt')
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
    groupFieldId.value = parseGroupFieldId(d?.group) ?? ''
  } catch {
    draftFilter.value = null
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

// ---------- 筛选 ----------
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

// ---------- 字段列表（字段映射 / 分组 / 展示字段共用） ----------
const availableFields = ref<AvailableFieldItem[]>([])
const fieldLoading = ref(false)
const fieldNames = computed(() => new Map(availableFields.value.map((f) => [f.fieldId, f.fieldName] as const)))

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

// ---------- 字段映射（开始 / 结束日期字段，按视图存本地） ----------
const mappingPanelVisible = ref(false)
const startFieldId = ref(DEFAULT_START_FIELD_ID)
const endFieldId = ref('')

const mappingFieldOptions = computed(() => {
  const list = availableFields.value
    .filter((f) => f.fieldGroup === 'TIME' || DATE_TYPES.has(String(f.filedType || f.type || '').toUpperCase()))
    .map((f) => ({ value: f.fieldId, label: f.fieldName }))
  for (const id of [startFieldId.value, endFieldId.value]) {
    if (id && !list.some((o) => o.value === id)) list.push({ value: id, label: fieldNames.value.get(id) || id })
  }
  return list
})

function mappingStorageKey(): string {
  return `cooperise:gantt:mapping:${viewCode.value}`
}

function loadMapping() {
  let saved: { start?: string; end?: string } | null = null
  try {
    saved = JSON.parse(localStorage.getItem(mappingStorageKey()) || 'null')
  } catch {
    saved = null
  }
  startFieldId.value = saved?.start || DEFAULT_START_FIELD_ID
  endFieldId.value = saved?.end && saved.end !== startFieldId.value ? saved.end : ''
}

function setMapping(which: 'start' | 'end', id: string) {
  if (which === 'start') {
    if (!id || id === startFieldId.value) return
    startFieldId.value = id
    if (endFieldId.value === id) endFieldId.value = ''
  } else {
    if (id === endFieldId.value) return
    endFieldId.value = id
  }
  try {
    localStorage.setItem(mappingStorageKey(), JSON.stringify({ start: startFieldId.value, end: endFieldId.value }))
  } catch {
    // 本地存储不可用时仅本次生效
  }
  reload()
}

// ---------- 分组 ----------
const groupPanelVisible = ref(false)
const groupFieldId = ref('')
const groupUniverse = ref<GroupValue[]>([])
const universeLoading = ref(false)
/** 折叠的分组键 */
const collapsed = ref<string[]>([])

async function toggleGroupField(fieldId: string) {
  const id = groupFieldId.value === fieldId ? '' : fieldId
  groupFieldId.value = id
  collapsed.value = []
  await saveDraft({
    group: JSON.stringify({ groupItemList: id ? [{ field: { id } }] : [], isFollowPreviousGroup: true }),
  })
  reload()
}

function toggleCollapse(key: string) {
  collapsed.value = collapsed.value.includes(key) ? collapsed.value.filter((k) => k !== key) : [...collapsed.value, key]
}

let universeSeq = 0
async function loadGroupUniverse() {
  const seq = ++universeSeq
  const fieldId = groupFieldId.value
  groupUniverse.value = []
  if (!fieldId) return
  universeLoading.value = true
  try {
    const list = await fetchGroupUniverse(fieldId, fieldMeta(fieldId))
    if (seq === universeSeq) groupUniverse.value = list
  } catch {
    // 请求层已统一提示
  } finally {
    if (seq === universeSeq) universeLoading.value = false
  }
}
watch(groupFieldId, loadGroupUniverse)
watch(
  () => (groupFieldId.value ? fieldMeta(groupFieldId.value)?.fieldId : ''),
  (id, prev) => {
    if (id && id !== prev) loadGroupUniverse()
  },
)

watch([groupPanelVisible, fieldPanelVisible, mappingPanelVisible], ([a, b, c]) => {
  if (a || b || c) loadAvailableFields()
})

// ---------- 查询 ----------
const rawRecords = ref<IssueRecord[]>([])
const loading = ref(false)

function buildQueryPayload(): IssueQueryPayload {
  const d = draftFilter.value
  const groupIds = groupFieldId.value ? [groupFieldId.value] : []
  const mappingIds = [startFieldId.value, endFieldId.value].filter(Boolean)
  return {
    globalFilter: buildGlobalFilter(filterConditions.value, filterLogic.value),
    group: { groupItemList: groupIds.map((id) => ({ field: { id } })), isFollowPreviousGroup: true },
    layered: { layeredItemList: [], layerType: 'FLAT' },
    page: 1,
    pageSize: GANTT_PAGE_SIZE,
    showField: {
      showFieldItemList: [...new Set([...REQUIRED_FIELD_IDS, ...mappingIds, ...groupIds, ...shownFieldIds.value])],
    },
    sort: { sortItemList: [{ field: { id: startFieldId.value }, sortTypeCode: 'ASC' }] },
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

/** 字段值 → 日期 */
function dateOf(rec: IssueRecord, fieldId: string): Dayjs | null {
  if (!fieldId) return null
  const f = fieldOf(rec, fieldId)
  const raw = f?.exportValue ?? f?.value
  const o = objOf(raw)
  const text = o ? String(o.value ?? o.name ?? '') : String(raw ?? '')
  if (!text) return null
  const d = dayjs(text)
  return d.isValid() ? d.startOf('day') : null
}

const resolveGroupKey = computed(() => {
  const keys = new Set(groupUniverse.value.map((g) => g.key))
  const byLabel = new Map(groupUniverse.value.map((g) => [g.label, g.key] as const))
  return (g: GroupValue): string => (keys.has(g.key) ? g.key : byLabel.get(g.label) ?? g.key)
})

/** 拍平后的任务（无开始日期的事项不进甘特图） */
const tasks = computed<GanttRow[]>(() => {
  const list: GanttRow[] = []
  rawRecords.value.forEach((rec, i) => {
    const start = dateOf(rec, startFieldId.value)
    if (!start) return
    const endRaw = dateOf(rec, endFieldId.value)
    const end = endRaw && !endRaw.isBefore(start) ? endRaw : start
    const issueKey = issueKeyOf(rec)
    const status = objOf(fieldOf(rec, 'status')?.value)
    const summaryField = fieldOf(rec, 'summary')
    list.push({
      id: issueKey || `row-${i}`,
      issueKey,
      title: String(summaryField?.exportValue ?? summaryField?.value ?? ''),
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      statusColor: colorOf(status?.statusColor),
      group: groupFieldId.value ? groupValueOf(rec, groupFieldId.value, fieldMeta(groupFieldId.value)) : null,
      lines: buildFieldLines(rec, shownFieldIds.value),
    })
  })
  return list
})

// ---------- 时间轴 ----------
const scale = ref<Scale>('week')
const dayWidth = computed(() => SCALES.find((s) => s.value === scale.value)?.dayWidth ?? 18)

function scaleStorageKey(): string {
  return `cooperise:gantt:scale:${viewCode.value}`
}
function setScale(v: Scale) {
  scale.value = v
  try {
    localStorage.setItem(scaleStorageKey(), v)
  } catch {
    // 忽略
  }
  nextTick(scrollToToday)
}
function loadScale() {
  let v: string | null = null
  try {
    v = localStorage.getItem(scaleStorageKey())
  } catch {
    v = null
  }
  scale.value = SCALES.some((s) => s.value === v) ? (v as Scale) : 'week'
}

/** 时间轴范围：覆盖全部任务与今天，前后留白；按月对齐 */
const range = computed(() => {
  const today = dayjs().startOf('day')
  let min = today
  let max = today
  for (const t of tasks.value) {
    const s = dayjs(t.startDate)
    const e = dayjs(t.endDate)
    if (s.isBefore(min)) min = s
    if (e.isAfter(max)) max = e
  }
  let start = min.subtract(7, 'day').startOf('month')
  let end = max.add(14, 'day').endOf('month').startOf('day')
  if (end.diff(start, 'day') > MAX_RANGE_DAYS) {
    start = today.subtract(MAX_RANGE_DAYS / 2, 'day').startOf('month')
    end = start.add(MAX_RANGE_DAYS, 'day')
  }
  return { start, days: end.diff(start, 'day') + 1 }
})

const timelineWidth = computed(() => range.value.days * dayWidth.value)

function offsetOf(date: string): number {
  return dayjs(date).diff(range.value.start, 'day') * dayWidth.value
}

const todayOffset = computed(() => {
  const d = dayjs().startOf('day').diff(range.value.start, 'day')
  return d >= 0 && d < range.value.days ? d * dayWidth.value + dayWidth.value / 2 : null
})

/** 表头上行：月份 */
const headerTop = computed(() => {
  const list: { key: string; label: string; left: number; width: number }[] = []
  let d = range.value.start
  const last = range.value.start.add(range.value.days - 1, 'day')
  while (!d.isAfter(last)) {
    const monthEnd = d.endOf('month').startOf('day')
    const end = monthEnd.isAfter(last) ? last : monthEnd
    const days = end.diff(d, 'day') + 1
    list.push({
      key: d.format('YYYY-MM'),
      label: scale.value === 'month' && days * dayWidth.value < 70 ? d.format('M月') : d.format('YYYY 年 M 月'),
      left: d.diff(range.value.start, 'day') * dayWidth.value,
      width: days * dayWidth.value,
    })
    d = end.add(1, 'day')
  }
  return list
})

/** 表头下行：日刻度为每天，周刻度为每周一，月刻度不分 */
const headerBottom = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  const list: { key: string; label: string; left: number; width: number; weekend: boolean; today: boolean }[] = []
  const { start, days } = range.value
  if (scale.value === 'day') {
    for (let i = 0; i < days; i++) {
      const d = start.add(i, 'day')
      list.push({
        key: d.format('YYYY-MM-DD'),
        label: `${d.date()} ${WEEK_LABELS[d.day()]}`,
        left: i * dayWidth.value,
        width: dayWidth.value,
        weekend: d.day() === 0 || d.day() === 6,
        today: d.format('YYYY-MM-DD') === today,
      })
    }
  } else if (scale.value === 'week') {
    for (let i = 0; i < days; i++) {
      const d = start.add(i, 'day')
      if (d.day() !== 1 && i !== 0) continue
      const span = Math.min(7 - ((d.day() + 6) % 7), days - i)
      list.push({
        key: d.format('YYYY-MM-DD'),
        label: d.format('M/D'),
        left: i * dayWidth.value,
        width: span * dayWidth.value,
        weekend: false,
        today: false,
      })
    }
  }
  return list
})

/** 带位置信息的任务行 */
type PlacedRow = GanttRow & { left: number; width: number; color: string }

/** 分组块：分组字段的全部取值 + 事项里出现的取值；不分组时只有一块（无分组行） */
const blocks = computed<{ key: string; group: (GroupValue & { count: number }) | null; rows: PlacedRow[] }[]>(() => {
  const place = (t: GanttRow, color: string): PlacedRow => {
    const left = offsetOf(t.startDate)
    const days = dayjs(t.endDate).diff(dayjs(t.startDate), 'day') + 1
    return { ...t, left: left + 2, width: Math.max(days * dayWidth.value - 4, 8), color }
  }
  if (!groupFieldId.value) {
    return [{ key: '__all__', group: null, rows: tasks.value.map((t) => place(t, t.statusColor)) }]
  }
  const map = new Map<string, { group: GroupValue & { count: number }; rows: PlacedRow[] }>()
  for (const g of groupUniverse.value) map.set(g.key, { group: { ...g, count: 0 }, rows: [] })
  for (const t of tasks.value) {
    if (!t.group) continue
    const key = resolveGroupKey.value(t.group)
    const entry = map.get(key) ?? { group: { ...t.group, key, count: 0 }, rows: [] }
    entry.rows.push(place(t, entry.group.color))
    entry.group.count = entry.rows.length
    map.set(key, entry)
  }
  // 只展示有事项的分组；「未设置」排最后
  const list = [...map.values()].filter((e) => e.rows.length)
  list.sort((a, b) => (a.group.key === NONE_GROUP_KEY ? 1 : b.group.key === NONE_GROUP_KEY ? -1 : 0))
  return list.map((e) => ({ key: e.group.key, group: e.group, rows: e.rows }))
})

const rows = computed(() => tasks.value)

// ---------- 滚动 ----------
const scrollRef = ref<HTMLElement | null>(null)

/** 横向滚动到今天（今天放在时间轴可视区约 1/3 处） */
function scrollToToday() {
  const el = scrollRef.value
  if (!el || todayOffset.value === null) return
  const visible = el.clientWidth - LEFT_WIDTH
  el.scrollTo({ left: Math.max(0, todayOffset.value - visible / 3), behavior: 'smooth' })
}

// ---------- 生命周期 ----------
async function init() {
  loadMapping()
  loadScale()
  await loadDraft()
  await reload()
  await nextTick()
  scrollToToday()
}

onMounted(() => {
  ensureLoaded()
  loadAvailableFields()
  init()
})

watch(filterCode, () => {
  draftFilter.value = null
  filterConditions.value = []
  filterLogic.value = 'AND'
  shownFieldIds.value = []
  groupFieldId.value = ''
  collapsed.value = []
  init()
})
</script>

<style scoped>
.gantt-page {
  /* 与「我的事项」一致：抵消布局内边距，撑满内容区 */
  height: calc(100vh - 75px);
  width: calc(100% + 1vh);
  max-width: none;
  margin: -2vh -0.5vh;
  min-height: 560px;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ---- 顶部工具栏（与日历 / 看板一致） ---- */
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
  max-width: 280px;
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
  color: #0a84ff;
}
.refresh-icon.spinning {
  animation: gantt-spin 0.8s linear infinite;
}
@keyframes gantt-spin {
  to { transform: rotate(360deg); }
}
.toolbar-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: #e5e5ea;
}
.today-btn {
  height: 30px;
  padding: 0 14px;
  border: 1px solid #d2d2d7;
  border-radius: 15px;
  background: #fff;
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.today-btn:hover {
  background: #f5f5f7;
  border-color: #c7c7cc;
}
/* 刻度：分段控件 */
.scale-switch {
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: #f2f2f7;
}
.scale-btn {
  min-width: 40px;
  height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #3a3a3c;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}
.scale-btn.active {
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
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
  color: #0a84ff !important;
  background: #e8f1ff !important;
}

/* ---- 字段面板 ---- */
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
.mapping-panel {
  padding-bottom: 14px;
}
.mapping-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
}
.mapping-label {
  flex-shrink: 0;
  width: 56px;
  font-size: 13px;
  color: #6e6e73;
}
.mapping-select {
  flex: 1;
  min-width: 0;
}

/* ---- 甘特主体 ---- */
.gantt-spin {
  flex: 1;
  min-height: 0;
}
.gantt-spin :deep(.ant-spin-container) {
  height: 100%;
}
.gantt-body {
  height: 100%;
  padding: 0 24px 20px;
}
.gantt-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
}
.gantt-scroll {
  height: 100%;
  overflow: auto;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
  overscroll-behavior: contain;
}
.gantt-canvas {
  position: relative;
  min-height: 100%;
}

/* 表头：吸顶；左上角同时吸左 */
.g-head {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e5e5ea;
}
.g-head-left {
  position: sticky;
  left: 0;
  z-index: 5;
  flex: 0 0 320px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 600;
  color: #6e6e73;
  background: #fff;
  border-right: 1px solid #e5e5ea;
}
.g-head-count {
  padding: 0 7px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 18px;
  color: #6e6e73;
  background: #f2f2f7;
}
.g-head-timeline {
  position: relative;
  flex-shrink: 0;
}
.g-head-top,
.g-head-bottom {
  position: relative;
  height: 28px;
}
.g-head-top {
  border-bottom: 1px solid #f0f0f3;
}
.g-head-cell {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 8px;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12px;
  color: #6e6e73;
  border-left: 1px solid #f0f0f3;
}
.g-head-top .g-head-cell {
  font-weight: 600;
  color: #3a3a3c;
}
.g-head-bottom .g-head-cell {
  justify-content: center;
  padding: 0;
  font-size: 11px;
}
.g-head-bottom .g-head-cell.weekend {
  color: #aeaeb2;
  background: #fafafc;
}
.g-head-bottom .g-head-cell.today {
  font-weight: 600;
  color: #fff;
  background: #0a84ff;
}

/* 行 */
.g-rows {
  position: relative;
}
.g-row {
  display: flex;
  min-height: 44px;
  border-bottom: 1px solid #f2f2f5;
  cursor: pointer;
  transition: background 0.12s;
}
.g-row:hover {
  background: #fafbff;
}
.g-row:hover .g-left {
  background: #fafbff;
}
/* 左侧任务列：吸左，字段上下分布 */
.g-left {
  position: sticky;
  left: 0;
  z-index: 2;
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 16px;
  background: #fff;
  border-right: 1px solid #e5e5ea;
  transition: background 0.12s;
}
.g-line {
  display: flex;
  min-width: 0;
}
.g-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
}
.g-sub {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #6e6e73;
}
.g-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.g-avatar {
  flex-shrink: 0;
  font-size: 9px;
  line-height: 16px;
  background: #6b95c9;
}
.g-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  height: 18px;
  padding: 0 7px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  color: color-mix(in srgb, var(--tag) 70%, #1d1d1f);
  background: color-mix(in srgb, var(--tag) 14%, #fff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.g-tag.is-issuekey {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 400;
  color: #6e6e73;
  background: #f2f2f7;
}
.g-tag.is-status {
  color: #3a3a3c;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.g-tag-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--tag);
}

/* 时间轴轨道：每天一条细竖线 */
.g-track {
  position: relative;
  flex: 1 0 auto;
  background-image: linear-gradient(to right, #f4f4f7 1px, transparent 1px);
  background-size: var(--day) 100%;
}
.g-today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 2px;
  margin-left: -1px;
  background: rgba(10, 132, 255, 0.55);
  pointer-events: none;
}

/* 任务条：同色浅底 + 左侧色条 */
.g-bar {
  position: absolute;
  top: 50%;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-left: 3px solid var(--bar);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bar) 18%, #fff);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transform: translateY(-50%);
  overflow: hidden;
  transition: background 0.15s, box-shadow 0.15s;
}
.g-row:hover .g-bar {
  background: color-mix(in srgb, var(--bar) 28%, #fff);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
}
.g-bar.is-point {
  padding: 0 4px;
}
.g-bar-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: color-mix(in srgb, var(--bar) 35%, #1d1d1f);
}

/* 分组行 */
.g-group-row {
  min-height: 38px;
  background: #fafafc;
}
.g-group-row:hover,
.g-group-row:hover .g-left {
  background: #f5f5f8;
}
.g-group-left {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 6px 12px;
  background: #fafafc;
}
.g-group-arrow {
  flex-shrink: 0;
  font-size: 10px;
  color: #8e8e93;
}
.g-group-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 3px;
  background: var(--gc);
}
.g-group-avatar {
  flex-shrink: 0;
  font-size: 10px;
  background: var(--gc);
}
.g-group-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
}
.g-group-count {
  flex-shrink: 0;
  padding: 0 7px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 18px;
  color: #6e6e73;
  background: #ececf0;
}
.g-group-track {
  background-color: #fafafc;
}

@media (max-width: 768px) {
  .top-bar {
    flex-wrap: wrap;
    padding: 14px 16px 12px;
  }
  .top-bar-right {
    flex-wrap: wrap;
  }
  .gantt-body {
    padding: 0 16px 16px;
  }
}
</style>
