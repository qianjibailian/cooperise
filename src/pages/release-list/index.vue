<template>
  <div class="rl-page">
    <!-- ========== 顶部：标题 + 统计 | 快捷筛选 + 筛选 + 配置 ========== -->
    <header class="rl-top">
      <div class="rl-top-left">
        <h1 class="rl-title" :title="pageTitle">{{ pageTitle }}</h1>
        <span v-if="hasColumns && rows.length" class="rl-summary">
          <b>{{ readyCount }}</b>/{{ rows.length }} 已就绪
        </span>
        <button type="button" class="rl-icon-btn" title="刷新" :disabled="loading" @click="reload">
          <ReloadOutlined :spin="loading" />
        </button>
      </div>

      <div class="rl-top-right">
        <!-- 快捷筛选（分段控件） -->
        <div class="rl-segment" role="tablist">
          <button
            v-for="o in QUICK_OPTIONS"
            :key="o.value"
            type="button"
            role="tab"
            class="rl-segment-item"
            :class="{ active: quick === o.value }"
            :aria-selected="quick === o.value"
            @click="quick = o.value"
          >{{ o.label }}<span v-if="o.value !== 'all'" class="rl-segment-count">{{ quickCount(o.value) }}</span></button>
        </div>

        <a-popover
          v-model:open="filterPanelVisible"
          trigger="click"
          placement="bottomRight"
          :overlay-inner-style="{ padding: 0 }"
          overlay-class-name="filter-popover"
          :overlay-style="{ width: '760px', maxWidth: 'calc(100vw - 32px)' }"
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
          <button type="button" class="rl-tool-btn" :class="{ active: filterDisplayCount > 0 }">
            <FilterOutlined />筛选<span v-if="filterDisplayCount" class="rl-tool-badge">{{ filterDisplayCount }}</span>
          </button>
        </a-popover>

        <button type="button" class="rl-tool-btn" @click="openConfig">
          <SettingOutlined />配置清单
        </button>
      </div>
    </header>

    <!-- 首次加载：骨架占位，数据回来后渲染清单 -->
    <div v-if="!loaded" class="page-skeleton">
      <a-skeleton active :paragraph="{ rows: 10 }" />
    </div>

    <!-- ========== 主体 ========== -->
    <a-spin v-else :spinning="loading" class="rl-spin">
      <!-- 尚未配置清单列：引导配置 -->
      <div v-if="!hasColumns" class="rl-onboard">
        <div class="rl-onboard-title">先配置清单要收集哪些信息</div>
        <div class="rl-onboard-desc">选择「开发填写」和「测试填写」的字段（如代码分支、脚本、上线链接），以及按哪个字段分批（如 Sprint）</div>
        <button type="button" class="rl-primary-btn" @click="openConfig"><SettingOutlined />配置清单</button>
      </div>

      <div v-else-if="!visibleGroups.length" class="rl-empty">
        {{ quick === 'all' ? '没有符合条件的事项' : quick === 'pending' ? '全部已就绪' : '没有你负责的事项' }}
      </div>

      <div v-else class="rl-groups">
        <section v-for="g in visibleGroups" :key="g.key" class="rl-group">
          <button type="button" class="rl-group-head" :aria-expanded="!collapsed[g.key]" @click="toggleGroup(g.key)">
            <RightOutlined class="rl-group-caret" :class="{ open: !collapsed[g.key] }" />
            <span v-if="config.groupField" class="rl-group-field">{{ fieldName(config.groupField) }}</span>
            <span class="rl-group-dot" :style="{ background: g.color }" />
            <span class="rl-group-name">{{ g.label }}</span>
            <span class="rl-group-count">{{ g.rows.length }}</span>
            <span class="rl-group-progress" :title="`已就绪 ${g.readyCount} / ${g.rows.length}`">
              <span class="rl-group-track">
                <span
                  class="rl-group-bar"
                  :class="{ complete: g.readyCount === g.rows.length }"
                  :style="{ width: `${g.rows.length ? Math.round((g.readyCount / g.rows.length) * 100) : 0}%` }"
                />
              </span>
              <span class="rl-group-progress-text">{{ g.readyCount }}/{{ g.rows.length }} 已就绪</span>
            </span>
          </button>

          <div v-show="!collapsed[g.key]" class="rl-table-wrap">
            <a-table
              :columns="tableColumns"
              :data-source="g.rows"
              :pagination="false"
              :scroll="{ x: tableWidth }"
              size="middle"
              row-key="issueKey"
              bordered
              class="rl-table"
            >
              <template #bodyCell="{ column, record }">
                <!-- 就绪状态 -->
                <template v-if="column.key === 'ready'">
                  <a-tooltip :title="record.ready ? '必填项已填完' : `未填写：${record.missing.join('、')}`">
                    <span class="rl-ready" :class="record.ready ? 'is-ready' : 'is-pending'">
                      <CheckOutlined v-if="record.ready" />
                    </span>
                  </a-tooltip>
                </template>

                <template v-else-if="column.key === 'issuekey'">
                  <span class="rl-key-cell">
                    <a class="rl-key" :style="{ color: record.typeColor }" @click="openIssue(record.issueKey)">{{ record.issueKey }}</a>
                    <button type="button" class="rl-cell-icon" title="复制单号" @click.stop="copyText(record.issueKey, '单号已复制')">
                      <CopyOutlined />
                    </button>
                  </span>
                </template>

                <template v-else-if="column.key === 'summary'">
                  <span class="rl-summary-text" :title="record.summary" @click="openIssue(record.issueKey)">{{ record.summary || '（无概要）' }}</span>
                </template>

                <template v-else-if="column.key === 'status'">
                  <span v-if="record.statusName" class="rl-pill" :style="tint(record.statusColor)">{{ record.statusName }}</span>
                </template>

                <template v-else-if="column.key === 'assignee'">
                  <span v-if="record.assigneeName" class="rl-user">
                    <a-avatar :src="record.assigneeAvatar || undefined" :size="20">{{ record.assigneeName.slice(0, 1) }}</a-avatar>
                    <span class="rl-user-name" :title="record.assigneeName">{{ record.assigneeName }}</span>
                  </span>
                  <span v-else class="rl-muted">未分配</span>
                </template>

                <!-- 清单字段：点击编辑（复用详情页的字段编辑器） -->
                <template v-else-if="String(column.key).startsWith('f:')">
                  <div v-if="editingCell === cellKey(record.issueKey, column.fieldId)" class="rl-editor" @click.stop>
                    <FieldValueEditor
                      :field="detailFieldOf(record, column.fieldId)"
                      :issue-key="record.issueKey"
                      @saved="onCellSaved(record, column.fieldId, $event)"
                      @cancel="editingCell = ''"
                    />
                  </div>
                  <div
                    v-else-if="isRichCell(record, column.fieldId)"
                    class="rl-field-cell rl-rich-cell"
                    :class="{ 'is-missing': isRequired(column.fieldId) && !cellText(record, column.fieldId), editable: canEdit(record, column.fieldId) }"
                    :title="cellText(record, column.fieldId) || undefined"
                    @click="canEdit(record, column.fieldId) && openRichEdit(record, column.fieldId)"
                  >
                    <template v-if="cellText(record, column.fieldId)">
                      <div class="rl-rich" v-html="sanitizeHtml(richHtmlOf(record, column.fieldId))" />
                      <button
                        type="button"
                        class="rl-cell-icon"
                        title="复制"
                        @click.stop="copyText(cellText(record, column.fieldId))"
                      ><CopyOutlined /></button>
                    </template>
                    <span v-else class="rl-placeholder">{{ isRequired(column.fieldId) ? '待填写' : '—' }}</span>
                  </div>
                  <div
                    v-else
                    class="rl-field-cell"
                    :class="{ 'is-missing': isRequired(column.fieldId) && !cellText(record, column.fieldId), editable: canEdit(record, column.fieldId) }"
                    @click="canEdit(record, column.fieldId) && (editingCell = cellKey(record.issueKey, column.fieldId))"
                  >
                    <template v-if="cellText(record, column.fieldId)">
                      <a
                        v-if="isUrl(cellText(record, column.fieldId))"
                        class="rl-link"
                        :href="cellText(record, column.fieldId)"
                        target="_blank"
                        rel="noopener noreferrer"
                        :title="cellText(record, column.fieldId)"
                        @click.stop
                      ><LinkOutlined />{{ prettyUrl(cellText(record, column.fieldId)) }}</a>
                      <span v-else class="rl-field-text" :title="cellText(record, column.fieldId)">{{ cellText(record, column.fieldId) }}</span>
                      <button
                        type="button"
                        class="rl-cell-icon"
                        title="复制"
                        @click.stop="copyText(cellText(record, column.fieldId))"
                      ><CopyOutlined /></button>
                    </template>
                    <span v-else class="rl-placeholder">{{ isRequired(column.fieldId) ? '待填写' : '—' }}</span>
                  </div>
                </template>
              </template>
            </a-table>
          </div>
        </section>
      </div>
    </a-spin>

    <!-- ========== 配置清单 ========== -->
    <a-modal
      v-model:open="configOpen"
      title="配置上线清单"
      :width="880"
      class="modal-landscape"
      centered
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="configSaving"
      @ok="saveConfig"
    >
      <a-form layout="vertical" class="rl-config-form">
        <a-form-item label="按哪个字段分批">
          <template #extra>如 Sprint / 上线批次；不选则不分组</template>
          <a-select
            v-model:value="configForm.groupField"
            :options="fieldOptions"
            :loading="fieldLoading"
            show-search
            option-filter-prop="label"
            allow-clear
            placeholder="不分组"
          />
        </a-form-item>
        <a-form-item label="开发填写">
          <template #extra>如 代码分支、合并请求、SQL / 数据脚本、配置变更</template>
          <a-select
            v-model:value="configForm.devFields"
            mode="multiple"
            :options="fieldOptions"
            :loading="fieldLoading"
            option-filter-prop="label"
            placeholder="选择字段"
          />
        </a-form-item>
        <a-form-item label="测试填写">
          <template #extra>如 测试环境链接、上线验证链接、测试结论</template>
          <a-select
            v-model:value="configForm.testFields"
            mode="multiple"
            :options="fieldOptions"
            :loading="fieldLoading"
            option-filter-prop="label"
            placeholder="选择字段"
          />
        </a-form-item>
        <a-form-item label="必填项">
          <template #extra>全部填写后该事项视为「已就绪」；不选则开发 / 测试列都算必填</template>
          <a-select
            v-model:value="configForm.requiredFields"
            mode="multiple"
            :options="requiredOptions"
            option-filter-prop="label"
            placeholder="默认全部"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 富文本字段编辑：表格单元格太窄放不下工具栏，用弹窗承载（与详情页「描述」一致的编辑器） -->
    <a-modal
      :open="!!richEdit"
      :title="richEdit ? `编辑 · ${richEdit.field.name}（${richEdit.row.issueKey}）` : ''"
      :footer="null"
      :width="820"
      destroy-on-close
      :mask-closable="false"
      @cancel="richEdit = null"
    >
      <RichTextField
        v-if="richEdit"
        :field="richEdit.field"
        :issue-key="richEdit.row.issueKey"
        auto-edit
        @saved="onRichSaved"
        @cancel="richEdit = null"
      />
    </a-modal>

    <IssueDetailDrawer v-model:open="detailOpen" :issue-key="detailIssueKey" @changed="reload" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  CheckOutlined,
  CopyOutlined,
  FilterOutlined,
  LinkOutlined,
  ReloadOutlined,
  RightOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'
import FilterPanel from '@/components/FilterPanel.vue'
import FieldValueEditor from '@/components/FieldValueEditor.vue'
import RichTextField from '@/components/RichTextField.vue'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import { isRichTextType, richToText, richValueOf, toRichHtml } from '@/utils/richText'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'
import { getIssues, getFilterDraft, updateFilterDraft, queryWorkbenchFieldList, updateView } from '@/api/faiz'
import type { AvailableFieldItem, DetailField, FilterDraft, GlobalFilter, IssueQueryPayload, IssueRecord } from '@/types/faiz'
import {
  isConditionComplete,
  buildGlobalFilter,
  parseGlobalFilter,
  type FilterCondition,
  type FilterLogic,
} from '@/utils/issueFilter'
import {
  fieldOf,
  fieldText,
  objOf,
  issueKeyOf,
  tagColorOf,
  groupValueOf,
  safeParse,
  NONE_GROUP_KEY,
  type GroupValue,
} from '@/utils/issue-view'
import { personAvatar, personLabel } from '@/utils/person'
import { useViewStore } from '@/utils/view-store'
import { useAuth } from '@/utils/auth'

/**
 * 上线清单视图：一行一个待上线事项，列分「开发填写 / 测试填写」两组，按分批字段（如 Sprint）分组；
 * 必填项都填写后事项视为「已就绪」。清单列配置存在视图 filterConfig（视图内所有人一致），筛选条件按人存草稿。
 */

// ---------- 视图 & 配置 ----------
interface ReleaseConfig {
  groupField: string
  devFields: string[]
  testFields: string[]
  requiredFields: string[]
}

const route = useRoute()
const { ensureLoaded, findViewItem } = useViewStore()
const filterCode = computed(() => (route.params.filterCode as string) || '')
const viewItem = computed(() => findViewItem(filterCode.value))
const pageTitle = computed(() => viewItem.value?.filterName || '上线清单')

const config = computed<ReleaseConfig>(() => {
  const raw = safeParse<Partial<ReleaseConfig> | null>(viewItem.value?.filterConfig ?? null, null)
  return {
    groupField: raw?.groupField || '',
    devFields: Array.isArray(raw?.devFields) ? raw!.devFields : [],
    testFields: Array.isArray(raw?.testFields) ? raw!.testFields : [],
    requiredFields: Array.isArray(raw?.requiredFields) ? raw!.requiredFields : [],
  }
})
const hasColumns = computed(() => config.value.devFields.length + config.value.testFields.length > 0)
/** 必填项：配置了就按配置（且须在清单列内），否则开发 + 测试列全部必填 */
const requiredSet = computed(() => {
  const cols = new Set([...config.value.devFields, ...config.value.testFields])
  const picked = config.value.requiredFields.filter((id) => cols.has(id))
  return new Set(picked.length ? picked : cols)
})
function isRequired(fieldId: string) {
  return requiredSet.value.has(fieldId)
}

// ---------- 字段元数据（当前空间可用字段） ----------
const availableFields = ref<AvailableFieldItem[]>([])
const fieldLoading = ref(false)
async function loadAvailableFields() {
  fieldLoading.value = true
  try {
    const res = await queryWorkbenchFieldList({ page: 1, pageSize: 500, searchKey: '' })
    if (res?.success && res.data?.list) availableFields.value = res.data.list.filter((f) => !f.obsolete)
  } catch {
    // 请求层已统一提示
  } finally {
    fieldLoading.value = false
  }
}
const fieldMeta = (id: string) => availableFields.value.find((f) => f.fieldId === id)
const fieldName = (id: string) => fieldMeta(id)?.fieldName || id
const fieldOptions = computed(() => availableFields.value.map((f) => ({ value: f.fieldId, label: f.fieldName })))

// ---------- 草稿 & 筛选（按人、按视图保存，与其它视图一致） ----------
const { user } = useAuth()
const draftUserNo = computed(() => user.value?.memberId || '')
const viewCode = computed(() => filterCode.value || 'RELEASE_LIST')
const draft = ref<FilterDraft | null>(null)
const filterPanelVisible = ref(false)
const filterConditions = ref<FilterCondition[]>([])
const filterLogic = ref<FilterLogic>('AND')
const filterDisplayCount = computed(() => filterConditions.value.filter(isConditionComplete).length)

async function loadDraft() {
  try {
    const res = await getFilterDraft(draftUserNo.value, viewCode.value)
    draft.value = res?.success ? res.data ?? null : null
    const gf = safeParse<GlobalFilter | null>(draft.value?.globalFilter, null)
    if (gf?.filter) {
      const parsed = parseGlobalFilter(gf)
      filterConditions.value = parsed.conditions
      filterLogic.value = parsed.logic
    }
  } catch {
    draft.value = null
  }
}

async function handleFilterSave() {
  try {
    await updateFilterDraft({
      id: draft.value?.id,
      userNo: draftUserNo.value,
      viewCode: viewCode.value,
      globalFilter: JSON.stringify(buildGlobalFilter(filterConditions.value, filterLogic.value)),
    })
  } catch {
    // 请求层已统一提示
  }
  reload()
}
function handleFilterReset() {
  filterConditions.value = []
  filterLogic.value = 'AND'
  handleFilterSave()
}

// ---------- 查询 ----------
/** 每行都需要的基础字段 */
const BASE_FIELDS = ['issuekey', 'summary', 'issuetype', 'status', 'assignee']
const PAGE_SIZE = 500
const records = ref<IssueRecord[]>([])
const loading = ref(false)
const loaded = ref(false)
let seq = 0

function buildPayload(): IssueQueryPayload {
  const c = config.value
  const showIds = [...new Set([...BASE_FIELDS, ...(c.groupField ? [c.groupField] : []), ...c.devFields, ...c.testFields])]
  return {
    globalFilter: buildGlobalFilter(filterConditions.value, filterLogic.value),
    group: { groupItemList: [], isFollowPreviousGroup: true },
    layered: { layeredItemList: [], layerType: 'FLAT' },
    page: 1,
    pageSize: PAGE_SIZE,
    showField: { showFieldItemList: showIds },
    sort: { sortItemList: [{ field: { id: 'createtime' }, sortTypeCode: 'DESC' }] },
    viewCode: draft.value?.viewCode ?? viewCode.value,
    needShowGroupValues: [],
    referencedFilter: safeParse(draft.value?.referencedFilter, { filter: null }),
  }
}

async function reload() {
  if (!hasColumns.value) {
    loaded.value = true
    return
  }
  const cur = ++seq
  loading.value = true
  try {
    const res = await getIssues(buildPayload())
    if (cur === seq) records.value = res?.success ? res.data?.list ?? [] : []
  } catch {
    if (cur === seq) records.value = []
  } finally {
    if (cur === seq) {
      loading.value = false
      loaded.value = true
    }
  }
}

// ---------- 行数据 ----------
/** 经办人字段在不同接口里的 id 不一致，按顺序取第一个有值的 */
const ASSIGNEE_IDS = ['assignee', 'systemfield_10004', '11714']

function cellText(rec: Row | IssueRecord, fieldId: string): string {
  const r = ('rec' in rec ? (rec as Row).rec : rec) as IssueRecord
  if (isRichField(r, fieldId)) return richToText(richHtmlOf(r, fieldId))
  return fieldText(fieldOf(r, fieldId)).trim()
}

/** 富文本字段（RICH_TEXT）：行内字段类型优先，取不到时看字段元数据 */
function isRichField(rec: IssueRecord, fieldId: string): boolean {
  const meta = fieldMeta(fieldId)
  return isRichTextType(fieldOf(rec, fieldId)?.type || meta?.filedType || meta?.type)
}
function isRichCell(row: Row, fieldId: string): boolean {
  return isRichField(row.rec, fieldId)
}
function richHtmlOf(rec: Row | IssueRecord, fieldId: string): string {
  const r = ('rec' in rec ? (rec as Row).rec : rec) as IssueRecord
  return toRichHtml(richValueOf(fieldOf(r, fieldId)))
}

interface Row {
  issueKey: string
  rec: IssueRecord
  summary: string
  typeColor: string
  statusName: string
  statusColor: string
  assigneeId: string
  assigneeName: string
  assigneeAvatar: string
  group: GroupValue
  ready: boolean
  missing: string[]
}

const rows = computed<Row[]>(() => records.value.map((rec) => {
  const issueKey = issueKeyOf(rec)
  const assigneeField = ASSIGNEE_IDS.map((id) => fieldOf(rec, id)).find((f) => objOf(f?.value))
  const assignee = objOf(assigneeField?.value)
  const missing = [...requiredSet.value].filter((id) => !cellText(rec, id)).map(fieldName)
  const groupField = config.value.groupField
  return {
    issueKey,
    rec,
    summary: fieldText(fieldOf(rec, 'summary')),
    typeColor: tagColorOf(rec, 'issuetype'),
    statusName: fieldText(fieldOf(rec, 'status')),
    statusColor: tagColorOf(rec, 'status'),
    assigneeId: String(assignee?.memberId ?? ''),
    assigneeName: assignee ? personLabel(assignee) : '',
    assigneeAvatar: assignee ? personAvatar(assignee) : '',
    group: groupField
      ? groupValueOf(rec, groupField, fieldMeta(groupField))
      : { key: 'all', label: '全部事项', avatar: '', isUser: false, color: '#8e8e93' },
    ready: missing.length === 0,
    missing,
  }
}))
const readyCount = computed(() => rows.value.filter((r) => r.ready).length)

// ---------- 快捷筛选 ----------
type Quick = 'all' | 'pending' | 'mine'
const QUICK_OPTIONS: { value: Quick; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '未就绪' },
  { value: 'mine', label: '我负责的' },
]
const quick = ref<Quick>('all')
const myId = computed(() => String(user.value?.memberId ?? ''))
function matchQuick(r: Row, q: Quick) {
  if (q === 'pending') return !r.ready
  if (q === 'mine') return !!myId.value && r.assigneeId === myId.value
  return true
}
function quickCount(q: Quick) {
  return rows.value.filter((r) => matchQuick(r, q)).length
}

// ---------- 分组 ----------
const collapsed = reactive<Record<string, boolean>>({})
function toggleGroup(key: string) {
  collapsed[key] = !collapsed[key]
}
/** 分组顺序：按事项（创建时间倒序）首次出现的顺序，较新的批次在前；「未设置」排最后 */
const visibleGroups = computed(() => {
  const map = new Map<string, { key: string; label: string; color: string; rows: Row[]; readyCount: number }>()
  for (const r of rows.value) {
    if (!matchQuick(r, quick.value)) continue
    const g = map.get(r.group.key) ?? { key: r.group.key, label: r.group.label, color: r.group.color, rows: [], readyCount: 0 }
    g.rows.push(r)
    if (r.ready) g.readyCount++
    map.set(r.group.key, g)
  }
  const list = [...map.values()]
  return [...list.filter((g) => g.key !== NONE_GROUP_KEY), ...list.filter((g) => g.key === NONE_GROUP_KEY)]
})

// ---------- 表格列 ----------
const FIELD_COL_WIDTH = 200
function fieldColumn(id: string, group: 'dev' | 'test') {
  return {
    title: fieldName(id),
    key: `f:${id}`,
    fieldId: id,
    width: FIELD_COL_WIDTH,
    customHeaderCell: () => ({ class: `rl-th-${group}${isRequired(id) ? ' rl-th-required' : ''}` }),
  }
}
const tableColumns = computed(() => {
  const c = config.value
  const cols: Record<string, unknown>[] = [
    { title: '', key: 'ready', width: 44, fixed: 'left', align: 'center' },
    { title: '单号', key: 'issuekey', width: 130, fixed: 'left' },
    { title: '概要', key: 'summary', width: 260, fixed: 'left' },
    { title: '状态', key: 'status', width: 100 },
    { title: '经办人', key: 'assignee', width: 130 },
  ]
  if (c.devFields.length) {
    cols.push({
      title: '开发填写',
      key: 'g:dev',
      customHeaderCell: () => ({ class: 'rl-th-dev rl-th-group' }),
      children: c.devFields.map((id) => fieldColumn(id, 'dev')),
    })
  }
  if (c.testFields.length) {
    cols.push({
      title: '测试填写',
      key: 'g:test',
      customHeaderCell: () => ({ class: 'rl-th-test rl-th-group' }),
      children: c.testFields.map((id) => fieldColumn(id, 'test')),
    })
  }
  return cols
})
const tableWidth = computed(() => 44 + 130 + 260 + 100 + 130
  + (config.value.devFields.length + config.value.testFields.length) * FIELD_COL_WIDTH)

// ---------- 单元格编辑 ----------
const editingCell = ref('')
const cellKey = (issueKey: string, fieldId: string) => `${issueKey}::${fieldId}`

function canEdit(row: Row, fieldId: string) {
  return fieldOf(row.rec, fieldId)?.editable !== false
}
/** 行里没有该字段（值为空时接口可能不返回）时，用字段元数据补一个空值字段 */
function detailFieldOf(row: Row, fieldId: string): DetailField {
  const f = fieldOf(row.rec, fieldId)
  const meta = fieldMeta(fieldId)
  return {
    id: fieldId,
    name: f?.name || meta?.fieldName || fieldId,
    type: String(f?.type || meta?.filedType || meta?.type || 'TEXT_BOX_SINGLE_LINE'),
    value: f?.value ?? null,
    exportValue: f?.exportValue,
    editable: true,
  }
}
const richEdit = ref<{ row: Row; field: DetailField } | null>(null)
function openRichEdit(row: Row, fieldId: string) {
  editingCell.value = ''
  richEdit.value = { row, field: detailFieldOf(row, fieldId) }
}
function onRichSaved(payload: { value: unknown; exportValue: unknown }) {
  const cur = richEdit.value
  if (!cur) return
  onCellSaved(cur.row, cur.field.id, payload)
  richEdit.value = null
}

function onCellSaved(row: Row, fieldId: string, payload: { value: unknown; exportValue: unknown }) {
  const list = row.rec.issueField || (row.rec.issueField = [])
  const f = list.find((x) => x.id === fieldId)
  if (f) {
    f.value = payload.value
    f.exportValue = payload.exportValue
  } else {
    const meta = fieldMeta(fieldId)
    list.push({ id: fieldId, name: meta?.fieldName ?? fieldId, type: meta?.filedType, value: payload.value, exportValue: payload.exportValue })
  }
  // 触发 rows 重算（就绪状态随之更新）
  records.value = [...records.value]
  editingCell.value = ''
}

// ---------- 展示工具 ----------
function isUrl(text: string) {
  return /^https?:\/\/\S+$/i.test(text)
}
/** 链接只展示域名 + 路径末段，完整地址放 title */
function prettyUrl(url: string) {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    return last ? `${u.host}/…/${last}` : u.host
  } catch {
    return url
  }
}
function tint(color: string) {
  return { color, background: `color-mix(in srgb, ${color} 12%, transparent)` }
}
async function copyText(text: string, tip = '已复制') {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    message.success(tip)
  } catch {
    // 剪贴板不可用（非安全上下文等）
  }
}

// ---------- 详情 ----------
const detailOpen = ref(false)
const detailIssueKey = ref('')
function openIssue(key: string) {
  if (!key) return
  detailIssueKey.value = key
  detailOpen.value = true
}

// ---------- 配置弹窗 ----------
const configOpen = ref(false)
const configSaving = ref(false)
const configForm = reactive<{ groupField?: string; devFields: string[]; testFields: string[]; requiredFields: string[] }>({
  groupField: undefined,
  devFields: [],
  testFields: [],
  requiredFields: [],
})
const requiredOptions = computed(() => [...new Set([...configForm.devFields, ...configForm.testFields])]
  .map((id) => ({ value: id, label: fieldName(id) })))
/** 未配置分组时，默认选名称像 Sprint / 迭代 / 上线批次 的字段 */
function guessGroupField() {
  const hit = availableFields.value.find((f) => /sprint|迭代|上线批次|版本/i.test(f.fieldName))
  return hit?.fieldId
}
function openConfig() {
  const c = config.value
  configForm.groupField = c.groupField || guessGroupField()
  configForm.devFields = [...c.devFields]
  configForm.testFields = [...c.testFields]
  configForm.requiredFields = [...c.requiredFields]
  configOpen.value = true
  loadAvailableFields().then(() => {
    if (!configForm.groupField && !c.groupField) configForm.groupField = guessGroupField()
  })
}
async function saveConfig() {
  const overlap = configForm.devFields.filter((id) => configForm.testFields.includes(id))
  if (overlap.length) {
    message.warning(`「${overlap.map(fieldName).join('、')}」不能同时属于开发和测试`)
    return
  }
  if (!configForm.devFields.length && !configForm.testFields.length) {
    message.warning('请至少选择一个开发或测试填写的字段')
    return
  }
  const view = viewItem.value
  if (!view) return
  const cols = new Set([...configForm.devFields, ...configForm.testFields])
  const next: ReleaseConfig = {
    groupField: configForm.groupField || '',
    devFields: configForm.devFields,
    testFields: configForm.testFields,
    requiredFields: configForm.requiredFields.filter((id) => cols.has(id)),
  }
  configSaving.value = true
  try {
    const res = await updateView({
      filterCode: view.filterCode,
      filterName: view.filterName,
      viewType: view.viewType,
      filterConfig: JSON.stringify(next),
    })
    if (res?.success) {
      message.success('清单配置已保存')
      configOpen.value = false
      await ensureLoaded(true)
      reload()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    configSaving.value = false
  }
}

// ---------- 初始化 ----------
// 配置变化（保存配置 / 视图数据刷新）后按新列重查
watch(() => viewItem.value?.filterConfig, (v, old) => {
  if (v !== old && loaded.value) reload()
})

onMounted(async () => {
  await ensureLoaded()
  await Promise.all([loadDraft(), loadAvailableFields()])
  reload()
})
</script>

<style scoped>
/* 富文本单元格：完整渲染 HTML，行高随内容撑开 */
.rl-field-cell.rl-rich-cell {
  align-items: flex-start;
}
.rl-rich {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  white-space: normal;
}
.rl-rich :deep(p),
.rl-rich :deep(ul),
.rl-rich :deep(ol),
.rl-rich :deep(blockquote),
.rl-rich :deep(pre),
.rl-rich :deep(h1),
.rl-rich :deep(h2),
.rl-rich :deep(h3) {
  margin: 0 0 4px;
}
.rl-rich :deep(:is(p, ul, ol, blockquote, pre, h1, h2, h3):last-child) {
  margin-bottom: 0;
}
.rl-rich :deep(h1),
.rl-rich :deep(h2),
.rl-rich :deep(h3) {
  font-size: 14px;
  font-weight: 600;
}
.rl-rich :deep(pre) {
  padding: 6px 8px;
  border-radius: 6px;
  background: #f7f8fa;
  white-space: pre-wrap;
}
.rl-rich :deep(blockquote) {
  padding-left: 8px;
  border-left: 3px solid #e5e6eb;
  color: #646a73;
}
.rl-rich :deep(a) {
  color: var(--c-primary, #1677ff);
}
.rl-rich :deep(ul),
.rl-rich :deep(ol) {
  padding-left: 18px;
}
.rl-rich :deep(img) {
  max-width: 100%;
  height: auto;
  vertical-align: middle;
  border-radius: 4px;
}
.rl-rich :deep(code) {
  padding: 0 3px;
  border-radius: 3px;
  background: #f2f3f5;
  font-size: 12px;
}

/* 视觉：Apple 分组列表 + 分段控件；Google 式文字按钮与焦点环 */
.rl-page {
  --rl-text: #1d1d1f;
  --rl-text-2: #6e6e73;
  --rl-text-3: #aeaeb2;
  --rl-fill: #f5f5f7;
  --rl-sep: rgba(60, 60, 67, 0.12);
  --rl-primary: var(--c-primary, #0a84ff);
  --rl-dev: #5e5ce6;
  --rl-test: #30b0c7;
  --rl-ok: #34c759;
  --rl-warn: #ff9f0a;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 4px 20px 16px;
  color: var(--rl-text);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue',
    'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 首次加载占位：保持主体高度稳定，数据回来后整块替换 */
.page-skeleton {
  flex: 1;
  min-height: 360px;
  padding: 20px;
}

/* ---------- 顶部 ---------- */
.rl-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
}
.rl-top-left,
.rl-top-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.rl-title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.rl-summary {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--rl-text-2);
  font-variant-numeric: tabular-nums;
}
.rl-summary b {
  font-weight: 600;
  color: var(--rl-text);
}
.rl-icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--rl-text-2);
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
}
.rl-icon-btn:hover {
  background: var(--rl-fill);
}

/* 分段控件 */
.rl-segment {
  display: inline-flex;
  padding: 2px;
  background: var(--rl-fill);
  border-radius: 9px;
}
.rl-segment-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
  color: var(--rl-text-2);
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.rl-segment-item.active {
  font-weight: 500;
  color: var(--rl-text);
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
}
.rl-segment-count {
  font-size: 11px;
  color: var(--rl-text-3);
  font-variant-numeric: tabular-nums;
}
.rl-segment-item.active .rl-segment-count {
  color: var(--rl-text-2);
}

.rl-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
  color: var(--rl-text);
  background: #fff;
  border: 1px solid var(--rl-sep);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.rl-tool-btn:hover {
  background: var(--rl-fill);
}
.rl-tool-btn.active {
  color: var(--rl-primary);
  border-color: color-mix(in srgb, var(--rl-primary) 40%, transparent);
  background: color-mix(in srgb, var(--rl-primary) 6%, #fff);
}
.rl-tool-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
  background: var(--rl-primary);
  border-radius: 8px;
}
.rl-primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 16px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: var(--rl-primary);
  border: none;
  border-radius: 17px;
  cursor: pointer;
}
.rl-primary-btn:hover {
  background: color-mix(in srgb, var(--rl-primary) 88%, #000);
}
.rl-icon-btn:focus-visible,
.rl-segment-item:focus-visible,
.rl-tool-btn:focus-visible,
.rl-primary-btn:focus-visible,
.rl-group-head:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--rl-primary) 60%, transparent);
  outline-offset: 2px;
}

/* ---------- 主体 ---------- */
.rl-spin {
  flex: 1;
  min-height: 0;
}
.rl-spin :deep(.ant-spin-container) {
  height: 100%;
}
.rl-groups {
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 8px;
}
.rl-onboard,
.rl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 80px 16px;
  text-align: center;
}
.rl-onboard-title {
  font-size: 15px;
  font-weight: 600;
}
.rl-onboard-desc {
  max-width: 460px;
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 20px;
  color: var(--rl-text-2);
}
.rl-empty {
  font-size: 13px;
  color: var(--rl-text-3);
}

/* 分组 */
.rl-group {
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--rl-sep);
  border-radius: 12px;
}
.rl-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  padding: 0 14px;
  font: inherit;
  text-align: left;
  background: #fff;
  border: none;
  cursor: pointer;
}
.rl-group-head:hover {
  background: #fafafc;
}
.rl-group-caret {
  font-size: 10px;
  color: var(--rl-text-3);
  transition: transform 0.2s;
}
.rl-group-caret.open {
  transform: rotate(90deg);
}
.rl-group-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}
/* 分批字段名：放在分批值左侧，弱化显示 */
.rl-group-field {
  flex-shrink: 0;
  max-width: 10em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #8e8e93;
}
.rl-group-field::after {
  content: '：';
}
.rl-group-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}
.rl-group-count {
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--rl-text-2);
  background: var(--rl-fill);
  border-radius: 9px;
}
.rl-group-progress {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.rl-group-track {
  width: 120px;
  height: 6px;
  overflow: hidden;
  background: var(--rl-fill);
  border-radius: 3px;
}
.rl-group-bar {
  display: block;
  height: 100%;
  background: var(--rl-warn);
  border-radius: 3px;
  transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), background 0.2s;
}
.rl-group-bar.complete {
  background: var(--rl-ok);
}
.rl-group-progress-text {
  min-width: 72px;
  font-size: 12px;
  color: var(--rl-text-2);
  font-variant-numeric: tabular-nums;
}
.rl-table-wrap {
  border-top: 1px solid var(--rl-sep);
}

/* 表格 */
.rl-table :deep(.ant-table) {
  font-size: 13px;
}
.rl-table :deep(.ant-table-container) {
  border-inline-start: none !important;
  border-top: none !important;
}
.rl-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 600;
  color: var(--rl-text-2);
  background: #fafafc;
}
.rl-table :deep(th.rl-th-group) {
  text-align: center;
  letter-spacing: 0.04em;
}
.rl-table :deep(th.rl-th-dev) {
  color: var(--rl-dev);
  background: color-mix(in srgb, var(--rl-dev) 6%, #fff);
}
.rl-table :deep(th.rl-th-test) {
  color: var(--rl-test);
  background: color-mix(in srgb, var(--rl-test) 7%, #fff);
}
.rl-table :deep(th.rl-th-required)::after {
  content: ' *';
  color: #ff3b30;
}
.rl-table :deep(.ant-table-tbody > tr > td) {
  padding-top: 8px;
  padding-bottom: 8px;
  vertical-align: middle;
}
.rl-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #fafafc;
}

.rl-ready {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #fff;
  border-radius: 50%;
}
.rl-ready.is-ready {
  background: var(--rl-ok);
}
.rl-ready.is-pending {
  background: transparent;
  box-shadow: inset 0 0 0 2px var(--rl-warn);
}
.rl-key-cell,
.rl-field-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.rl-key {
  font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.rl-key:hover {
  text-decoration: underline;
}
.rl-summary-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.rl-summary-text:hover {
  color: var(--rl-primary);
}
.rl-pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 20px;
  padding: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
}
.rl-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.rl-user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rl-muted,
.rl-placeholder {
  font-size: 12px;
  color: var(--rl-text-3);
}

.rl-field-cell {
  min-height: 24px;
  margin: -4px -6px;
  padding: 4px 6px;
  border-radius: 6px;
}
.rl-field-cell.editable {
  cursor: pointer;
}
.rl-field-cell.editable:hover {
  background: var(--rl-fill);
}
.rl-field-cell.is-missing .rl-placeholder {
  font-weight: 500;
  color: var(--rl-warn);
}
.rl-field-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rl-link {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rl-primary);
}
.rl-link:hover {
  text-decoration: underline;
}
.rl-cell-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 11px;
  color: var(--rl-text-2);
  background: transparent;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}
.rl-table :deep(tr:hover) .rl-cell-icon,
.rl-cell-icon:focus-visible {
  opacity: 1;
}
.rl-cell-icon:hover {
  color: var(--rl-primary);
  background: color-mix(in srgb, var(--rl-primary) 10%, transparent);
}
@media (hover: none) {
  .rl-cell-icon {
    opacity: 1;
  }
}
.rl-editor {
  min-width: 0;
}

.rl-config-form :deep(.ant-form-item) {
  margin-bottom: 18px;
}

@media (prefers-reduced-motion: reduce) {
  .rl-page *,
  .rl-page :deep(*) {
    transition: none !important;
  }
}
</style>
