<template>
  <div class="testing-calendar-page">
    <!-- 顶部工具栏（与日历一体）：视图名称 + 刷新 + 今天 / 翻月 + 月份 | 数量 + 筛选 + 字段映射 + 分组 + 展示字段 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title" :title="pageTitle">{{ pageTitle }}</h1>
        <component :is="ReloadOutlined" class="refresh-icon" :class="{ spinning: loading }" @click="reload" />
        <span class="toolbar-divider" />
        <button type="button" class="cal-today-btn" @click="jumpToday">今天</button>
        <div class="cal-nav">
          <button type="button" class="cal-nav-btn" title="上个月" @click="shiftMonth(-1)"><LeftOutlined /></button>
          <button type="button" class="cal-nav-btn" title="下个月" @click="shiftMonth(1)"><RightOutlined /></button>
        </div>
        <span class="cal-title">{{ viewMonth.format('YYYY 年 M 月') }}</span>
      </div>
      <div class="top-bar-right">
        <span class="total-text">本月 {{ monthIssueCount }} 条 · 共 {{ allIssues.length }} 条</span>
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
          <a-button class="tool-btn filter-btn" :class="{ active: filterDisplayCount > 0 }">
            <component :is="AlignCenterOutlined" />
            筛选({{ filterDisplayCount }})
          </a-button>
        </a-popover>

        <!-- 字段映射：开始 / 结束日期取哪个字段；有结束日期时事项在日历上跨天展示 -->
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
                <span class="field-panel-hint">事项按日期字段落到日历</span>
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
                  placeholder="不设置（只展示在开始日期）"
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
          <a-button class="tool-btn field-btn" :class="{ active: !!endFieldId || startFieldId !== DEFAULT_START_FIELD_ID }">
            <component :is="SwapOutlined" />
            字段映射
          </a-button>
        </a-popover>

        <!-- 分组：选择一个字段，右侧按该字段的取值分组（按视图存草稿） -->
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
                  <!-- 单选：勾选即按该字段分组，再次点击已勾选项取消分组 -->
                  <label v-for="f in groupFieldOptions" :key="f.fieldId" class="field-option">
                    <a-checkbox :checked="groupFieldId === f.fieldId" @change="toggleGroupField(f.fieldId)" />
                    <span class="field-option-name" :title="f.fieldName">{{ f.fieldName }}</span>
                  </label>
                  <div v-if="!fieldLoading && !groupFieldOptions.length" class="field-panel-empty">暂无可选字段</div>
                </div>
              </a-spin>
            </div>
          </template>
          <a-button class="tool-btn field-btn" :class="{ active: !!groupFieldId }">
            <component :is="PartitionOutlined" />
            分组({{ groupFieldId ? 1 : 0 }})
          </a-button>
        </a-popover>

        <!-- 展示字段：勾选的字段展示在事项卡片上（与「我的事项」表头字段同源，按视图存草稿） -->
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
                <span class="field-panel-hint">事项卡片只展示勾选的字段</span>
              </div>
              <a-input
                v-model:value="fieldKeyword"
                size="small"
                allow-clear
                placeholder="搜索字段"
                class="field-panel-search"
              >
                <template #prefix><component :is="SearchOutlined" class="field-search-icon" /></template>
              </a-input>
              <a-spin :spinning="fieldLoading">
                <div class="field-panel-list" @scroll="onFieldListScroll">
                  <label v-for="f in fieldPickerOptions" :key="f.fieldId" class="field-option">
                    <a-checkbox :checked="shownFieldIds.includes(f.fieldId)" @change="toggleShownField(f.fieldId)" />
                    <span class="field-option-name" :title="f.fieldName">{{ f.fieldName }}</span>
                  </label>
                  <div v-if="fieldLoadingMore" class="field-panel-more">加载中...</div>
                  <div v-else-if="!fieldLoading && !fieldPickerOptions.length" class="field-panel-empty">暂无可选字段</div>
                  <div v-else-if="!fieldLoading && !fieldHasMore && fieldPickerOptions.length > 10" class="field-panel-more">已加载全部字段</div>
                </div>
              </a-spin>
            </div>
          </template>
          <a-button class="tool-btn field-btn" :class="{ active: shownFieldIds.length > 0 }">
            <component :is="SettingOutlined" />
            展示字段({{ shownFieldIds.length }})
          </a-button>
        </a-popover>
      </div>
    </div>

    <div class="page-body">
      <!-- 左：月历（周一开始，每格展示当天事项） -->
      <div class="calendar-panel">
        <a-spin :spinning="loading" wrapper-class-name="cal-spin">
          <!--
            按周渲染：每周一行，底层为 7 个日期格，上层事项条按「泳道」排布；
            跨天事项在同一周内连成一条（grid-column 跨列），跨周时在下一周续接
          -->
          <div class="cal-grid">
            <div class="cal-weekdays">
              <span v-for="w in WEEKDAYS" :key="w" class="cal-weekday">{{ w }}</span>
            </div>
            <div
              v-for="week in weeks"
              :key="week.key"
              class="cal-week"
              :style="{ gridTemplateRows: week.rows }"
            >
              <div
                v-for="(day, di) in week.days"
                :key="day.key"
                class="cal-cell"
                :class="{
                  'is-outside': !day.inMonth,
                  'is-today': day.isToday,
                  'is-weekend': day.isWeekend,
                  'is-selected': day.key === selectedDate,
                  'is-last-col': di === 6,
                }"
                :style="{ gridColumn: di + 1 }"
                @click="selectDate(day.key)"
              >
                <div class="cal-cell-head">
                  <span class="cal-date">{{ day.date }}</span>
                  <span v-if="hasShownFields && day.count" class="cal-cell-count">{{ day.count }}</span>
                </div>
              </div>
              <template v-if="hasShownFields">
                <div
                  v-for="seg in week.segments"
                  :key="seg.key"
                  class="cal-chip"
                  :class="{ 'is-cont': seg.contLeft, 'is-more': seg.contRight }"
                  :style="{
                    gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
                    gridRow: seg.lane + 2,
                    '--tc-accent': chipAccent(seg.issue),
                  }"
                  :title="[seg.issue.startDate === seg.issue.endDate ? seg.issue.startDate : `${seg.issue.startDate} ~ ${seg.issue.endDate}`, ...seg.issue.chipLines.map((l) => l.text)].join('\n')"
                  @click.stop="openIssue(seg.issue.issueKey)"
                >
                  <!-- 按勾选顺序每个字段占一行（上下分布）：单号 / 状态 / 类型为彩色标签，概要加粗，其余为次要文字 -->
                  <span v-for="line in seg.issue.chipLines" :key="line.id" class="cal-chip-line">
                    <span
                      v-if="line.tagColor"
                      class="cal-tag"
                      :class="`is-${line.id}`"
                      :style="{ '--tag': line.tagColor }"
                    >
                      <span v-if="line.id === 'status'" class="cal-tag-dot" />{{ line.text }}
                    </span>
                    <span v-else-if="line.id === 'summary'" class="cal-chip-title">{{ line.text }}</span>
                    <span v-else-if="line.isUser" class="cal-chip-user">
                      <a-avatar :size="16" :src="line.avatar || undefined" class="cal-chip-avatar">{{ line.text.charAt(0) }}</a-avatar>
                      <span class="cal-chip-sub">{{ line.text }}</span>
                    </span>
                    <span v-else class="cal-chip-sub">{{ line.text }}</span>
                  </span>
                </div>
              </template>
            </div>
          </div>
        </a-spin>
      </div>

      <!-- 右：分组（所选分组字段的全部取值；彩色复选框勾选的分组展示在日历上） -->
      <div class="detail-panel">
        <div class="detail-header">
          <div class="detail-title">
            <component :is="PartitionOutlined" class="detail-title-icon" />
            <span class="ellipsis">{{ groupFieldId ? `按「${groupFieldName}」分组` : '分组' }}</span>
            <a-tag v-if="groupFieldId && groups.length" color="blue" class="detail-count">{{ groups.length }} 组</a-tag>
          </div>
        </div>

        <a-spin :spinning="groupUniverseLoading" wrapper-class-name="detail-spin">
        <div class="detail-list">
          <div v-if="!groupFieldId" class="detail-empty">
            <a-empty description="点击右上角「分组」选择分组字段" />
          </div>
          <div v-else-if="!groups.length" class="detail-empty">
            <a-empty description="暂无事项" />
          </div>
          <template v-else>
            <label class="group-row all" :style="{ '--gc': '#6B95C9' }">
              <a-checkbox
                class="group-check"
                :checked="allGroupsChecked"
                :indeterminate="!allGroupsChecked && !noGroupChecked"
                @change="toggleAllGroups"
              />
              <span class="group-name">全部</span>
            </label>
            <label
              v-for="g in groups"
              :key="g.key"
              class="group-row"
              :class="{ unchecked: hiddenGroupKeys.includes(g.key), empty: g.key === NONE_GROUP_KEY }"
              :style="{ '--gc': g.color }"
              :title="g.label"
            >
              <a-checkbox class="group-check" :checked="!hiddenGroupKeys.includes(g.key)" @change="toggleGroup(g.key)" />
              <a-avatar v-if="g.isUser" :size="22" :src="g.avatar || undefined" class="group-avatar">
                {{ g.label.slice(0, 1) }}
              </a-avatar>
              <span class="group-name">{{ g.label }}</span>
            </label>
          </template>
        </div>
        </a-spin>
      </div>
    </div>

    <!-- 事项详情抽屉：点击日历中的事项打开 -->
    <IssueDetailDrawer v-model:open="detailOpen" :issue-key="detailIssueKey" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs, { type Dayjs } from 'dayjs'
import {
  ReloadOutlined,
  AlignCenterOutlined,
  SettingOutlined,
  SearchOutlined,
  PartitionOutlined,
  SwapOutlined,
  LeftOutlined,
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
  fieldText,
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

// ---------- 类型 ----------
/** /issue/query 单条事项拍平后的日历卡片 */
interface CalendarIssue {
  id: string
  issueKey: string
  summary: string
  statusId: string
  statusName: string
  statusColor: string
  /** YYYY-MM-DD：开始日期（字段映射的开始日期字段） */
  startDate: string
  /** YYYY-MM-DD：结束日期；未映射结束字段或无值时等于开始日期，事项在 [开始, 结束] 每天展示 */
  endDate: string
  /** 分组字段取值（未分组时为空） */
  group: GroupValue | null
  /** 日历格子 chip：按勾选顺序每个字段一行（上下排列），空值不占行 */
  chipLines: FieldLine[]
}

/** 字段映射默认的开始日期字段 */
const DEFAULT_START_FIELD_ID = 'createtime'
/** 跨天展示的最大天数（开始到结束超过此天数时截断，避免异常数据铺满日历） */
const MAX_SPAN_DAYS = 92
/**
 * 日历自身需要、始终随查询请求的字段（均为 /availableField/list 的 fieldId；/issue/query 只返回 showField 里的字段）：
 * 单号（跳详情）、状态（配色）；开始 / 结束日期字段见字段映射。是否展示仍取决于勾选
 */
const REQUIRED_FIELD_IDS = ['issuekey', 'status']

/** 日历一次拉取的事项上限（不分页，按日期在前端归类） */
const CALENDAR_PAGE_SIZE = 1000
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

// ---------- /issue/query 结果拍平 ----------
/** 字段值 → 日期（无值 / 无法解析时为 null） */
function dateOf(rec: IssueRecord, fieldId: string): Dayjs | null {
  if (!fieldId) return null
  const f = fieldOf(rec, fieldId)
  const raw = f?.exportValue ?? f?.value
  const text = objOf(raw) ? String((raw as Record<string, unknown>).value ?? (raw as Record<string, unknown>).name ?? '') : String(raw ?? '')
  if (!text) return null
  const d = dayjs(text)
  return d.isValid() ? d.startOf('day') : null
}

function toCalendarIssue(rec: IssueRecord, index: number): CalendarIssue | null {
  const start = dateOf(rec, startFieldId.value)
  if (!start) return null
  const endRaw = dateOf(rec, endFieldId.value)
  // 结束早于开始视为无效，只展示在开始日期
  const end = endRaw && !endRaw.isBefore(start) ? endRaw : start

  const issueKey = issueKeyOf(rec)
  const status = objOf(fieldOf(rec, 'status')?.value)
  const summary = fieldText(fieldOf(rec, 'summary'))

  return {
    id: issueKey || `row-${index}`,
    issueKey,
    summary,
    statusId: String(status?.id ?? ''),
    statusName: String(status?.name ?? ''),
    statusColor: colorOf(status?.statusColor),
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
    group: groupFieldId.value ? groupValueOf(rec, groupFieldId.value, groupFieldMeta(groupFieldId.value)) : null,
    chipLines: buildFieldLines(rec, shownFieldIds.value),
  }
}

// ---------- 事项详情抽屉 ----------
const detailOpen = ref(false)
const detailIssueKey = ref('')

function openIssue(issueKey: string) {
  if (!issueKey) return
  detailIssueKey.value = issueKey
  detailOpen.value = true
}

// 关闭抽屉后刷新（抽屉内可能修改了状态 / 字段）
watch(detailOpen, (open) => {
  if (!open && detailIssueKey.value) reload()
})

// ---------- 标题：取当前视图名称 ----------
const route = useRoute()
const { ensureLoaded, findViewItem } = useViewStore()
const filterCode = computed(() => (route.params.filterCode as string) || '')
const pageTitle = computed<string>(() => findViewItem(filterCode.value)?.filterName || '测试平台需求日历')

// ---------- 草稿（筛选条件 + 展示字段，按视图保存） ----------
const { user } = useAuth()
/** 草稿归属人：登录用户工号（缺省时与「我的事项」一致兜底） */
const draftUserNo = computed(() => user.value?.memberId || '10284941')
/** 草稿 / 查询的视图编码：取路由上的视图 filterCode */
const viewCode = computed(() => filterCode.value || 'CALENDAR_VIEW')
const draftFilter = ref<FilterDraft | null>(null)

async function loadDraft() {
  try {
    const res = await getFilterDraft(draftUserNo.value, viewCode.value)
    if (res?.success && res.data) {
      draftFilter.value = res.data
      const gf = safeParse<GlobalFilter | null>(res.data.globalFilter, null)
      if (gf?.filter) {
        const { conditions, logic } = parseGlobalFilter(gf)
        filterConditions.value = conditions
        filterLogic.value = logic
      }
      shownFieldIds.value = parseShownFieldIds(res.data.showField)
      groupFieldId.value = parseGroupFieldId(res.data.group) ?? ''
    } else {
      draftFilter.value = null
      shownFieldIds.value = []
      groupFieldId.value = ''
    }
  } catch {
    draftFilter.value = null
  }
}

/** 局部更新草稿（PUT /filter/draft），成功后刷新本地草稿 id */
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
/** 生效的条件数（不完整的条件不计数） */
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

// ---------- 展示字段 ----------
const fieldPanelVisible = ref(false)
const fieldLoading = ref(false)
const fieldLoadingMore = ref(false)
const fieldKeyword = ref('')
const availableFields = ref<AvailableFieldItem[]>([])
/** 字段分页：/availableField/list 按页拉取，滚动到底加载下一页 */
const FIELD_PAGE_SIZE = 30
const fieldPage = ref(1)
const fieldPageCount = ref(1)
const fieldHasMore = computed(() => fieldPage.value < fieldPageCount.value)
/** 已加载过的字段名（跨页 / 跨搜索保留，卡片上回显字段名用） */
const fieldNames = ref<Record<string, string>>({})
/** 勾选的展示字段 ID（有序）；默认不勾选，未勾选时日历不展示任何事项 */
const shownFieldIds = ref<string[]>([])
const hasShownFields = computed(() => shownFieldIds.value.length > 0)


/** 字段列表：接口返回的全部字段，均可勾选 */
const fieldPickerOptions = computed(() => availableFields.value)

let fieldReqSeq = 0
/** 拉取一页字段；page=1 时替换列表（打开面板 / 搜索），否则追加 */
async function fetchFieldPage(page: number) {
  const seq = ++fieldReqSeq
  const more = page > 1
  if (more) fieldLoadingMore.value = true
  else fieldLoading.value = true
  try {
    const res = await queryAvailableFieldList({ page, pageSize: FIELD_PAGE_SIZE, searchKey: fieldKeyword.value.trim() })
    if (seq !== fieldReqSeq || !res?.success || !res.data) return
    const list = (res.data.list || []).filter((f) => !f.obsolete)
    for (const f of list) fieldNames.value[f.fieldId] = f.fieldName
    if (more) {
      const known = new Set(availableFields.value.map((f) => f.fieldId))
      availableFields.value = [...availableFields.value, ...list.filter((f) => !known.has(f.fieldId))]
    } else {
      availableFields.value = list
    }
    fieldPage.value = res.data.currentPage || page
    fieldPageCount.value = res.data.pageCount || 1
  } catch {
    // 请求层已统一提示
  } finally {
    if (seq === fieldReqSeq) {
      fieldLoading.value = false
      fieldLoadingMore.value = false
    }
  }
}

function loadAvailableFields() {
  return fetchFieldPage(1)
}

/** 滚动到底部附近时加载下一页 */
function onFieldListScroll(e: Event) {
  const el = e.target as HTMLElement
  if (fieldLoading.value || fieldLoadingMore.value || !fieldHasMore.value) return
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) fetchFieldPage(fieldPage.value + 1)
}

// 搜索：防抖后从第一页重新查询
let fieldSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(fieldKeyword, () => {
  clearTimeout(fieldSearchTimer)
  fieldSearchTimer = setTimeout(loadAvailableFields, 300)
})

async function toggleShownField(id: string) {
  shownFieldIds.value = shownFieldIds.value.includes(id)
    ? shownFieldIds.value.filter((x) => x !== id)
    : [...shownFieldIds.value, id]
  await saveDraft({ showField: JSON.stringify({ showFieldItemList: shownFieldIds.value }) })
  reload()
}

// 打开面板时刷新字段列表
watch(fieldPanelVisible, (open) => {
  if (open) loadAvailableFields()
})

// ---------- 字段映射（开始 / 结束日期字段，按视图存在本地） ----------
const mappingPanelVisible = ref(false)
const startFieldId = ref(DEFAULT_START_FIELD_ID)
const endFieldId = ref('')

/** 可映射的日期字段：时间分组或日期类型的字段；当前已选的字段始终保留 */
const mappingFieldOptions = computed(() => {
  const list = availableFields.value
    .filter((f) => f.fieldGroup === 'TIME' || DATE_TYPES.has(String(f.filedType || f.type || '').toUpperCase()))
    .map((f) => ({ value: f.fieldId, label: f.fieldName }))
  for (const id of [startFieldId.value, endFieldId.value]) {
    if (id && !list.some((o) => o.value === id)) list.push({ value: id, label: fieldNames.value[id] || id })
  }
  return list
})

function mappingStorageKey(): string {
  return `cooperise:calendar:mapping:${viewCode.value}`
}

/** 读取当前视图的字段映射（草稿无对应字段，存浏览器本地；读取失败用默认） */
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
/** 分组字段 ID（字段列表的 fieldId），空为不分组 */
const groupFieldId = ref('')
/** 右侧取消勾选的分组键：默认全部勾选，日历只展示勾选分组的事项 */
const hiddenGroupKeys = ref<string[]>([])

const groupFieldName = computed(() => fieldNames.value[groupFieldId.value] || groupFieldId.value)

/** 可分组字段：/availableField/list 返回的全部字段 */
const groupFieldOptions = computed(() => availableFields.value)

/** 勾选分组字段（单选）；点击已勾选的字段则取消分组 */
async function toggleGroupField(fieldId: string) {
  const id = groupFieldId.value === fieldId ? '' : fieldId
  groupFieldId.value = id
  hiddenGroupKeys.value = []
  await saveDraft({
    group: JSON.stringify({ groupItemList: id ? [{ field: { id } }] : [], isFollowPreviousGroup: true }),
  })
  reload()
}

// ---------- 分组的全部取值（如分组选经办人时列出全部人员，没有事项的计 0） ----------
const groupUniverse = ref<GroupValue[]>([])
const groupUniverseLoading = ref(false)

function groupFieldMeta(fieldId: string): AvailableFieldItem | undefined {
  return availableFields.value.find((f) => f.fieldId === fieldId)
}

let universeSeq = 0
async function loadGroupUniverse() {
  const seq = ++universeSeq
  const fieldId = groupFieldId.value
  groupUniverse.value = []
  if (!fieldId) return
  groupUniverseLoading.value = true
  try {
    const list = await fetchGroupUniverse(fieldId, groupFieldMeta(fieldId))
    if (seq === universeSeq) groupUniverse.value = list
  } catch {
    // 请求层已统一提示；仅展示有事项的取值
  } finally {
    if (seq === universeSeq) groupUniverseLoading.value = false
  }
}

// 分组字段变化（勾选 / 草稿回填 / 切换视图）时重新拉取全部取值；字段列表加载后人员判断才准确，也需重拉
watch(groupFieldId, loadGroupUniverse)
watch(
  () => (groupFieldId.value ? groupFieldMeta(groupFieldId.value)?.fieldId : ''),
  (id, prev) => {
    if (id && id !== prev) loadGroupUniverse()
  },
)

function toggleGroup(key: string) {
  hiddenGroupKeys.value = hiddenGroupKeys.value.includes(key)
    ? hiddenGroupKeys.value.filter((k) => k !== key)
    : [...hiddenGroupKeys.value, key]
}

const allGroupsChecked = computed(() => groups.value.every((g) => !hiddenGroupKeys.value.includes(g.key)))
const noGroupChecked = computed(() => groups.value.every((g) => hiddenGroupKeys.value.includes(g.key)))

/** 全部：已全选则全部取消，否则全部勾选 */
function toggleAllGroups() {
  hiddenGroupKeys.value = allGroupsChecked.value ? groups.value.map((g) => g.key) : []
}

// 打开分组 / 字段映射面板时刷新字段列表（清掉展示字段面板的搜索词，保证列出全部字段）
watch([groupPanelVisible, mappingPanelVisible], ([groupOpen, mappingOpen]) => {
  const open = groupOpen || mappingOpen
  if (!open) return
  if (fieldKeyword.value) fieldKeyword.value = ''
  else loadAvailableFields()
})

// ---------- 查询 ----------
const allIssues = ref<CalendarIssue[]>([])
const loading = ref(false)

/** /issue/query 入参：筛选取面板条件，showField = 日历自身需要的字段 + 映射的日期字段 + 勾选字段 + 分组字段，按开始日期升序 */
function buildQueryPayload(): IssueQueryPayload {
  const d = draftFilter.value
  const groupIds = groupFieldId.value ? [groupFieldId.value] : []
  const mappingIds = [startFieldId.value, endFieldId.value].filter(Boolean)
  const showFieldItemList = [...new Set([...REQUIRED_FIELD_IDS, ...mappingIds, ...shownFieldIds.value, ...groupIds])]
  return {
    globalFilter: buildGlobalFilter(filterConditions.value, filterLogic.value),
    // 分组字段随查询传给后端：取 /availableField/list 的 fieldId（如 经办人 → systemfield_10004）；未分组时为空
    group: {
      groupItemList: groupFieldId.value ? [{ field: { id: groupFieldId.value } }] : [],
      isFollowPreviousGroup: true,
    },
    layered: { layeredItemList: [], layerType: 'FLAT' },
    page: 1,
    pageSize: CALENDAR_PAGE_SIZE,
    showField: { showFieldItemList },
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
    if (seq !== querySeq) return
    const list = res?.success ? res.data?.list ?? [] : []
    allIssues.value = list.map(toCalendarIssue).filter((x): x is CalendarIssue => !!x)
  } catch {
    if (seq === querySeq) allIssues.value = []
  } finally {
    if (seq === querySeq) loading.value = false
  }
}

/** 事项分组值 → 右侧分组键：先按键匹配全部取值，对不上再按名称匹配，都没有则用自身键 */
const resolveGroupKey = computed(() => {
  const keys = new Set(groupUniverse.value.map((g) => g.key))
  const byLabel = new Map(groupUniverse.value.map((g) => [g.label, g.key] as const))
  return (g: GroupValue): string => (keys.has(g.key) ? g.key : byLabel.get(g.label) ?? g.key)
})

/** 日历上展示的事项：分组时只展示勾选分组的事项 */
const visibleIssues = computed<CalendarIssue[]>(() => {
  const hidden = new Set(hiddenGroupKeys.value)
  if (!groupFieldId.value || !hidden.size) return allIssues.value
  return allIssues.value.filter((i) => !i.group || !hidden.has(resolveGroupKey.value(i.group)))
})

/** 按日期聚合：事项出现在开始到结束的每一天 */
const issuesByDate = computed<Record<string, CalendarIssue[]>>(() => {
  const map: Record<string, CalendarIssue[]> = {}
  for (const it of visibleIssues.value) {
    let d = dayjs(it.startDate)
    const end = dayjs(it.endDate)
    for (let i = 0; i < MAX_SPAN_DAYS && !d.isAfter(end); i++, d = d.add(1, 'day')) {
      ;(map[d.format('YYYY-MM-DD')] ||= []).push(it)
    }
  }
  return map
})

/** 事项的日期区间是否与当前月份有交集 */
function inViewMonth(it: CalendarIssue): boolean {
  const first = viewMonth.value.startOf('month').format('YYYY-MM-DD')
  const last = viewMonth.value.endOf('month').format('YYYY-MM-DD')
  return it.startDate <= last && it.endDate >= first
}

/**
 * 右侧分组列表：分组字段的全部取值（如全部经办人，没有事项的计 0）+ 事项里出现但不在列表中的取值；
 * 事项按键匹配，键对不上时按名称匹配。按当月数量倒序，「未分配 / 未设置」排最后
 */
const groups = computed(() => {
  const map = new Map<string, GroupValue & { monthCount: number }>()
  for (const g of groupUniverse.value) {
    if (!map.has(g.key)) map.set(g.key, { ...g, monthCount: 0 })
  }
  for (const it of allIssues.value) {
    if (!it.group) continue
    const key = resolveGroupKey.value(it.group)
    const g = map.get(key) ?? { ...it.group, key, monthCount: 0 }
    if (inViewMonth(it)) g.monthCount++
    map.set(key, g)
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === NONE_GROUP_KEY) return 1
    if (b.key === NONE_GROUP_KEY) return -1
    return b.monthCount - a.monthCount || a.label.localeCompare(b.label, 'zh-CN')
  })
})

/** 分组键 → 分组颜色（与右侧复选框同色） */
const groupColorMap = computed(() => new Map(groups.value.map((g) => [g.key, g.color] as const)))

/** 日历 chip 的强调色：分组时取所属分组颜色，否则取状态色 */
function chipAccent(issue: CalendarIssue): string {
  if (groupFieldId.value && issue.group) {
    return groupColorMap.value.get(resolveGroupKey.value(issue.group)) || issue.group.color || issue.statusColor
  }
  return issue.statusColor
}

// ---------- 月历 ----------
const viewMonth = ref<Dayjs>(dayjs().startOf('month'))
const selectedDate = ref<string | null>(null)

/** 某周内的一段事项条：列从 0 开始，lane 为泳道序号（同一泳道内事项不重叠） */
interface WeekSegment {
  key: string
  issue: CalendarIssue
  colStart: number
  colEnd: number
  lane: number
  /** 事项在本周之前已开始 / 本周之后仍继续：该侧不画圆角，表示续接 */
  contLeft: boolean
  contRight: boolean
}

/** 6 周 × 7 天，周一开始；每周计算事项条与泳道 */
const weeks = computed(() => {
  const start = viewMonth.value.startOf('month')
  const first = start.subtract((start.day() + 6) % 7, 'day')
  const today = dayjs().format('YYYY-MM-DD')
  return Array.from({ length: 6 }, (_, w) => {
    const weekStart = first.add(w * 7, 'day')
    const weekStartKey = weekStart.format('YYYY-MM-DD')
    const weekEndKey = weekStart.add(6, 'day').format('YYYY-MM-DD')
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = weekStart.add(i, 'day')
      const key = d.format('YYYY-MM-DD')
      return {
        key,
        date: d.date(),
        inMonth: d.month() === start.month(),
        isToday: key === today,
        isWeekend: d.day() === 0 || d.day() === 6,
        count: issuesByDate.value[key]?.length ?? 0,
      }
    })

    // 与本周有交集的事项 → 本周内的起止列（跨天上限 MAX_SPAN_DAYS）
    const raw: Omit<WeekSegment, 'lane'>[] = []
    if (hasShownFields.value) {
      for (const issue of visibleIssues.value) {
        const issueStart = dayjs(issue.startDate)
        const cappedEnd = dayjs(issue.endDate).isAfter(issueStart.add(MAX_SPAN_DAYS - 1, 'day'))
          ? issueStart.add(MAX_SPAN_DAYS - 1, 'day')
          : dayjs(issue.endDate)
        const endKey = cappedEnd.format('YYYY-MM-DD')
        if (issue.startDate > weekEndKey || endKey < weekStartKey) continue
        raw.push({
          key: `${issue.id}@${weekStartKey}`,
          issue,
          colStart: Math.max(0, issueStart.diff(weekStart, 'day')),
          colEnd: Math.min(6, cappedEnd.diff(weekStart, 'day')),
          contLeft: issue.startDate < weekStartKey,
          contRight: endKey > weekEndKey,
        })
      }
    }
    // 泳道：先排开始早的，同起点时长的在上；放进第一个不冲突的泳道
    raw.sort((a, b) => a.colStart - b.colStart || b.colEnd - b.colStart - (a.colEnd - a.colStart))
    const laneEnds: number[] = []
    const segments: WeekSegment[] = raw.map((seg) => {
      let lane = laneEnds.findIndex((end) => end < seg.colStart)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = seg.colEnd
      return { ...seg, lane }
    })
    // 行：日期头 + 每条泳道一行 + 底部留白（撑满剩余高度，点击空白选中日期）
    const rows = `30px ${'auto '.repeat(laneEnds.length)}minmax(10px, 1fr)`
    return { key: weekStartKey, days, segments, rows }
  })
})

const monthIssueCount = computed(() => visibleIssues.value.filter(inViewMonth).length)

function shiftMonth(delta: number) {
  viewMonth.value = viewMonth.value.add(delta, 'month')
}

/** 选中日期；点到上 / 下月的日期时同时翻页 */
function selectDate(key: string) {
  selectedDate.value = key
  const d = dayjs(key)
  if (!d.isSame(viewMonth.value, 'month')) viewMonth.value = d.startOf('month')
}

function jumpToday() {
  selectDate(dayjs().format('YYYY-MM-DD'))
}

/** 默认选中今天；本月无事项而其他月份有时，跳到最近一条事项所在日期 */
function pickDefaultDate() {
  const today = dayjs().format('YYYY-MM-DD')
  const monthPrefix = today.slice(0, 7)
  const dates = Object.keys(issuesByDate.value).sort()
  if (!dates.length || dates.some((k) => k.startsWith(monthPrefix))) {
    selectDate(today)
  } else {
    selectDate(dates[dates.length - 1])
  }
}

// ---------- 生命周期 ----------
async function init() {
  loadMapping()
  await loadDraft()
  await reload()
  pickDefaultDate()
}

onMounted(() => {
  ensureLoaded()
  loadAvailableFields()
  init()
})

// 同一组件内切换日历视图：重新读草稿并查询
watch(filterCode, () => {
  draftFilter.value = null
  filterConditions.value = []
  filterLogic.value = 'AND'
  shownFieldIds.value = []
  groupFieldId.value = ''
  hiddenGroupKeys.value = []
  init()
})
</script>

<style scoped lang="scss">
.testing-calendar-page {
  /* 与「我的事项」一致：抵消布局内边距，撑满内容区 */
  height: calc(100vh - 75px);
  width: calc(100% + 1vh);
  max-width: none;
  margin: -2vh -0.5vh;
  min-height: 600px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 顶部工具栏：与日历同一白色画布，按钮为浅灰圆角（参考 Apple / Google 日历） */
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
  animation: tc-spin 0.8s linear infinite;
}
@keyframes tc-spin {
  to { transform: rotate(360deg); }
}
.toolbar-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: #e5e5ea;
}
.cal-today-btn {
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
.cal-today-btn:hover {
  background: #f5f5f7;
  border-color: #c7c7cc;
}
.cal-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}
.cal-nav-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 13px;
  color: #3a3a3c;
  cursor: pointer;
  transition: background 0.15s;
}
.cal-nav-btn:hover {
  background: #f2f2f7;
}
.cal-title {
  flex-shrink: 0;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.2px;
  color: #1d1d1f;
  white-space: nowrap;
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
.tool-btn.active:hover {
  background: #dbe9ff !important;
}

/* 展示字段面板 */
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
/* 高度随视口收缩，超出出现滚动条，滚到底加载下一页 */
.field-panel-list {
  max-height: min(360px, calc(100vh - 240px));
  min-height: 120px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 6px;
}
.field-panel-list::-webkit-scrollbar {
  width: 6px;
}
.field-panel-list::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: #d2d2d7;
}
.field-panel-list::-webkit-scrollbar-thumb:hover {
  background: #aeaeb2;
}
.field-panel-more {
  padding: 8px 0 4px;
  font-size: 12px;
  color: #86868b;
  text-align: center;
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

/* 主体：日历与右侧分组同在白色画布上，日历只保留细线描边 */
.page-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 0 24px 20px;
  overflow: auto;
}
.calendar-panel {
  flex: 0 0 calc((100% - 20px) * 0.8);
  max-width: calc((100% - 20px) * 0.8);
  min-width: 0;
  /* 内容少时撑满可视高度，内容多时随内容增高（主体滚动） */
  min-height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}
/* 右侧分组：侧栏样式，随主体滚动吸顶 */
.detail-panel {
  position: sticky;
  top: 0;
  flex: 0 0 calc((100% - 20px) * 0.2);
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 日期格子（首行为星期） */
.cal-spin {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: auto;
}
.cal-spin :deep(.ant-spin-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.cal-grid {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: calc(120px * 7);
}
.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(120px, 1fr));
  flex-shrink: 0;
  border-bottom: 1px solid #e5e5ea;
}
.cal-weekday {
  padding: 10px 10px 8px;
  font-size: 12px;
  font-weight: 500;
  color: #8e8e93;
  border-right: 1px solid #f0f0f3;
}
.cal-weekday:last-child {
  border-right: none;
}
/* 一周一行：6 周均分剩余高度撑满面板；事项多时该周随泳道增高 */
.cal-week {
  flex: 1 0 auto;
  min-height: 92px;
  display: grid;
  grid-template-columns: repeat(7, minmax(120px, 1fr));
  row-gap: 3px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f3;
}
.cal-week:last-child {
  border-bottom: none;
}
/* 日期格：铺满整周的所有行，事项条叠在上层 */
.cal-cell {
  grid-row: 1 / -1;
  min-width: 0;
  /* 抵消周行底部留白，让日期格背景铺满 */
  margin-bottom: -6px;
  padding: 6px 8px;
  border-right: 1px solid #f0f0f3;
  cursor: pointer;
  transition: background 0.15s;
}
.cal-cell.is-last-col {
  border-right: none;
}
.cal-cell:hover {
  background: #fafafc;
}
.cal-cell.is-weekend {
  background: #fcfcfd;
}
.cal-cell.is-outside .cal-date {
  color: #c7c7cc;
}
.cal-cell.is-outside .cal-chip {
  opacity: 0.5;
}
.cal-cell.is-selected {
  background: #f4f8ff;
}
.cal-cell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.cal-date {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}
.cal-cell.is-today .cal-date {
  background: #0a84ff;
  color: #fff;
  font-weight: 600;
}
.cal-cell-count {
  font-size: 11px;
  color: #aeaeb2;
}
.cal-cell-issues {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 0;
}
/* 事项条（参考 Apple / Google 日历）：左侧色条 + 同色浅底，标题加粗，标签与次要信息收在下方；跨天时横跨多列 */
.cal-chip {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  margin: 0 6px;
  padding: 5px 8px 6px 8px;
  border-left: 3px solid var(--tc-accent, #8c8c8c);
  border-radius: 6px;
  font-size: 12px;
  line-height: 16px;
  color: #1d1d1f;
  background: color-mix(in srgb, var(--tc-accent, #8c8c8c) 11%, #fff);
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}
.cal-chip:hover {
  background: color-mix(in srgb, var(--tc-accent, #8c8c8c) 18%, #fff);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}
.cal-chip-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.1px;
  color: color-mix(in srgb, var(--tc-accent, #8c8c8c) 30%, #1d1d1f);
}
.cal-chip-line {
  display: flex;
  min-width: 0;
}
/* 标签：圆角胶囊，同色浅底 + 加深的同色文字 */
.cal-tag {
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
/* 单号：不抢视觉，白底灰字等宽 */
.cal-tag.is-issuekey {
  padding: 0 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 400;
  color: #6e6e73;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
/* 状态：白底 + 状态色圆点 */
.cal-tag.is-status {
  color: #3a3a3c;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.cal-tag-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--tag);
}
.cal-chip-user {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.cal-chip-avatar {
  flex-shrink: 0;
  font-size: 9px;
  line-height: 16px;
  background: var(--tc-accent, #8c8c8c);
}
.cal-chip-sub {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: #6e6e73;
}

/* 右侧头部 */
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 10px;
  flex-shrink: 0;
}
.detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #3a3a3c;
}
.detail-title-icon {
  color: #8e8e93;
}
.detail-count {
  margin: 0;
  border: none;
  border-radius: 999px;
  font-weight: 500;
}

/* 列表 */
.detail-list {
  flex: 1;
  min-height: 0;
  padding: 0 0 12px;
  overflow-y: auto;
}
.detail-empty {
  padding: 56px 0;
}

.detail-spin {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.detail-spin :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 字段映射面板 */
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

/* 跨周续接的事项条：续接一侧贴边、取消圆角与色条 */
.cal-chip.is-cont {
  margin-left: 0;
  border-left-color: transparent;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.cal-chip.is-more {
  margin-right: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

/* 分组列表：彩色复选框（颜色取 --gc） */
.group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 10px;
  margin-bottom: 2px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.group-row:hover {
  background: #f0f4fa;
}
.group-row.all {
  margin-bottom: 6px;
  border-bottom: 1px solid #f0f1f4;
  border-radius: 8px 8px 0 0;
}
.group-row.unchecked .group-name,
.group-row.unchecked .group-avatar {
  opacity: 0.5;
}
.group-row.empty .group-name {
  color: #86868b;
}
.group-check :deep(.ant-checkbox-inner) {
  border-color: var(--gc) !important;
  border-width: 2px;
}
.group-check :deep(.ant-checkbox-checked .ant-checkbox-inner),
.group-check :deep(.ant-checkbox-indeterminate .ant-checkbox-inner) {
  background-color: var(--gc) !important;
  border-color: var(--gc) !important;
}
.group-check :deep(.ant-checkbox-indeterminate .ant-checkbox-inner::after) {
  background-color: #fff !important;
}
.group-check :deep(.ant-checkbox-checked::after) {
  border-color: var(--gc) !important;
}
.group-avatar {
  flex-shrink: 0;
  font-size: 11px;
  background: var(--gc, #0a84ff);
}
.group-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #1d1d1f;
}
.ellipsis {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 响应式：窄屏两栏堆叠 */
@media (max-width: 1100px) {
  .top-bar {
    flex-wrap: wrap;
    padding: 14px 16px 12px;
  }
  .top-bar-right {
    flex-wrap: wrap;
  }
  .page-body {
    flex-direction: column;
    align-items: stretch;
    padding: 0 16px 16px;
  }
  .calendar-panel {
    flex: 0 0 auto;
    max-width: 100%;
    min-height: 0;
  }
  .detail-panel {
    position: static;
    flex: 0 0 auto;
    min-width: 0;
    height: auto;
    min-height: 320px;
  }
}
</style>
