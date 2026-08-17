<template>
  <div class="todo-page">
    <!-- 顶部标题栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title">我的事项</h1>
        <span class="edit-status">(已编辑 <a class="reset-link" @click="handleReset">重置</a>)</span>
        <a class="save-link">另存为</a>
        <component :is="ReloadOutlined" class="refresh-icon" @click="fetchIssues" />
      </div>
      <div class="top-bar-right">
        <span class="total-text">共{{ total }}条</span>
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
            />
          </template>
          <a-button
            class="tool-btn filter-btn"
            :class="{ active: filterDisplayCount > 0 }"
          >
            <component :is="AlignCenterOutlined" />
            筛选({{ filterDisplayCount }})
          </a-button>
        </a-popover>
        <a-button v-if="false" class="tool-btn">
          <component :is="UnorderedListOutlined" />
          分组
        </a-button>
        <a-button class="tool-btn sort-btn" :class="{ active: sortCountComputed > 0 }" @click="toggleSortDirection">
          <component :is="isSortDesc ? SortDescendingOutlined : SortAscendingOutlined" />
          排序({{ sortCountComputed }})
        </a-button>
        <a-button v-if="false" class="tool-btn">
          <component :is="MenuOutlined" />
          分层
        </a-button>
        <a-button v-if="false" class="tool-btn">
          <component :is="CheckSquareOutlined" />
          批量操作
        </a-button>
        <a-button v-if="false" class="tool-btn">
          <component :is="FullscreenOutlined" />
          全屏
        </a-button>
        <a-dropdown>
          <a-button class="tool-btn more-btn">
            <component :is="EllipsisOutlined" />
          </a-button>
          <template #overlay>
            <a-menu @click="handleImportExportClick">
              <a-menu-item key="import">导入</a-menu-item>
              <a-menu-item key="export">导出</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-divider type="vertical" class="toolbar-divider" />
        <a-button v-if="false" class="tool-btn view-btn">
          <component :is="UnorderedListOutlined" />
          列表视图
        </a-button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <vxe-table
        ref="tableRef"
        :data="dataList"
        :loading="loading"
        height="100%"
        border="none"
        :row-config="{ keyField: 'issueKey' }"
        :column-config="{ resizable: true }"
        :checkbox-config="{ highlight: true, range: false }"
        class="items-table"
      >
        <vxe-column type="checkbox" width="50" align="center" fixed="left" />
        <vxe-column
          v-for="col in tableColumns"
          :key="col.id"
          :field="col.id"
          :title="col.name"
          min-width="140"
          :fixed="col.id === 'summary' ? 'left' : undefined"
        >
          <template #default="{ row }">
            <a
              v-if="col.id === 'issuekey'"
              class="issue-key-link"
              @click="openDetail(row.issueKey)"
            >{{ getCellValue(row, col.id) }}</a>
            <a-tag
              v-else-if="col.id === 'status'"
              :color="statusColor(getStatusId(row))"
            >{{ getCellValue(row, col.id) }}</a-tag>
            <a-tag
              v-else-if="col.id === 'priority'"
              :color="priorityColor(getPriorityId(row))"
            >{{ getCellValue(row, col.id) }}</a-tag>
            <a-tag v-else-if="col.id === 'issuetype'">{{ getCellValue(row, col.id) }}</a-tag>
            <span v-else>{{ getCellValue(row, col.id) }}</span>
          </template>
        </vxe-column>
        <vxe-column title="操作" width="72" fixed="right" align="center">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0 2px;">
              <span>操作</span>
              <component :is="SettingOutlined" style="font-size: 14px; color: #0050b3; cursor: pointer;" @click.stop="openSettingDrawer" />
            </div>
          </template>
          <template #default="{ row }">
            <a-dropdown :trigger="['click']">
              <a-button type="text" class="action-dots">···</a-button>
              <template #overlay>
                <a-menu @click="handleMenuClick($event, row)">
                  <a-menu-item key="edit">编辑</a-menu-item>
                  <a-menu-item key="copy">复制</a-menu-item>
                  <a-menu-item key="rollback">回滚</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </template>
        </vxe-column>
      </vxe-table>
    </div>

    <!-- 事项详情抽屉 -->
    <IssueDetailDrawer
      v-model:open="detailDrawerOpen"
      :issue-key="detailIssueKey"
    />

    <!-- 列设置抽屉 -->
    <a-drawer
      v-model:open="settingDrawerOpen"
      placement="right"
      :width="340"
      :closable="false"
      :header-style="{ padding: 0 }"
      :body-style="{ padding: '16px' }"
    >
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 12px 16px; background: #f5f5f5;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">表格列管理</span>
            <component
              :is="ReloadOutlined"
              style="font-size: 14px; color: #8c8c8c; cursor: pointer;"
            />
          </div>
          <component
            :is="CloseOutlined"
            style="font-size: 16px; color: #8c8c8c; cursor: pointer;"
            @click="settingDrawerOpen = false"
          />
        </div>
      </template>
      <div class="setting-drawer-body">
        <a-input-search
          v-model:value="settingSearchKeyword"
          placeholder="搜索表头"
          allow-clear
          :loading="settingLoading"
          style="margin-bottom: 8px;"
          @search="handleSettingSearch"
        />
        <a-collapse v-model:active-key="settingCollapseActive" :bordered="false" ghost>
          <template #expandIcon="{ isActive }">
            <component
              :is="CaretRightFilled"
              :style="{ transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }"
            />
          </template>
          <a-collapse-panel key="shown" header="已显示字段">
            <div class="field-list">
              <div
                v-for="(item, index) in shownFields"
                :key="item.key"
                class="field-item"
                :class="{ 'field-item-dragging': shownDragIndex === index }"
                draggable="true"
                @dragstart="onShownDragStart($event, index)"
                @dragover.prevent="onShownDragOver($event, index)"
                @drop="onShownDrop($event, index)"
                @dragend="onShownDragEnd"
              >
                <component
                  :is="HolderOutlined"
                  class="field-drag-handle"
                />
                <a-checkbox v-model:checked="item.checked" @change="onShownFieldUncheck(item)">
                  {{ item.label }}
                </a-checkbox>
              </div>
            </div>
          </a-collapse-panel>
          <a-collapse-panel key="hidden" header="未显示字段">
            <div class="field-list field-list-scroll" @scroll="onHiddenListScroll">
              <div
                v-for="item in hiddenFields"
                :key="item.key"
                class="field-item"
              >
                <a-checkbox v-model:checked="item.checked" @change="onHiddenFieldCheck(item)">
                  {{ item.label }}
                </a-checkbox>
              </div>
              <div v-if="hiddenLoadingMore" class="field-loading-more">加载中...</div>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import type { VxeTableInstance } from 'vxe-table'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  AlignCenterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  MenuOutlined,
  CheckSquareOutlined,
  FullscreenOutlined,
  EllipsisOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  CloseOutlined,
  HolderOutlined,
  CaretRightFilled,
} from '@ant-design/icons-vue'
import { getIssues, queryAvailableFields, getFilterDraft, updateFilterDraft } from '@/api/faiz'
import type {
  IssueRecord,
  IssueQueryPayload,
  ChildConditionGroup,
  SortItem,
  FilterDraft,
} from '@/types/faiz'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'
import FilterPanel from '@/components/FilterPanel.vue'

const tableRef = ref<VxeTableInstance<IssueRecord>>()

// 详情抽屉
const detailDrawerOpen = ref(false)
const detailIssueKey = ref('')

function openDetail(issueKey: string) {
  detailIssueKey.value = issueKey
  detailDrawerOpen.value = true
}

// 列设置抽屉
const settingDrawerOpen = ref(false)
const settingSearchKeyword = ref('')
const settingCollapseActive = ref<string[]>(['shown', 'hidden'])
const settingLoading = ref(false)
const hiddenCurrentPage = ref(1)
const hiddenPageCount = ref(1)
const hiddenLoadingMore = ref(false)

interface FieldOption {
  key: string
  label: string
  checked: boolean
}

/** 标准字段 ID → 中文名称（draft showField 里的标准字段可能不在可用字段列表中） */
const STANDARD_FIELD_LABELS: Record<string, string> = {
  summary: '概要',
  status: '状态',
  assignee: '经办人',
  createtime: '创建时间',
  created: '创建时间',
  updated: '更新时间',
  priority: '优先级',
  issuetype: '分类',
  issuekey: '编号',
  issuetypeId: '分类',
  statusId: '状态',
  priorityId: '优先级',
  assigneeName: '经办人',
}

const shownFields = ref<FieldOption[]>([])
const hiddenFields = ref<FieldOption[]>([])

/** 从 draft 的 showField 解析已展示字段 ID 列表（保留顺序），兼容字符串数组和对象数组两种格式 */
function getDraftShownFieldIds(): string[] {
  const d = draftFilter.value
  if (!d) return []
  const parsed = safeParse<{ showFieldItemList: unknown[] }>(d.showField, { showFieldItemList: [] })
  return parsed.showFieldItemList.map(item => {
    if (typeof item === 'string') return item
    // 兼容旧格式 { field: { id: "xxx" } }
    const obj = item as { field?: { id?: string } }
    return obj?.field?.id ?? ''
  }).filter(Boolean)
}

async function fetchAvailableFields(keyword?: string) {
  settingLoading.value = true
  hiddenCurrentPage.value = 1
  try {
    const res = await queryAvailableFields({
      page: 1,
      perPage: 20,
      searchKey: keyword || '',
    })
    if (res.success && res.data?.list) {
      const list = res.data.list
      // 构建 fieldId → fieldName 映射
      const labelMap: Record<string, string> = {}
      for (const f of list) labelMap[f.fieldId] = f.fieldName

      const shownIds = new Set(getDraftShownFieldIds())

      if (shownIds.size > 0) {
        // 有 draft：shownFields 取 draft 的 showFieldItemList（保留顺序），label 从可用字段/标准映射/fieldNameMap 取
        const allLabelMap: Record<string, string> = { ...STANDARD_FIELD_LABELS, ...labelMap }
        for (const [k, v] of Object.entries(fieldNameMap.value)) {
          if (v && v.trim()) allLabelMap[k] = v
        }
        shownFields.value = getDraftShownFieldIds().map(id => ({
          key: id,
          label: allLabelMap[id] || id,
          checked: true,
        }))
        // hiddenFields = 可用字段中不在 shownIds 里的
        hiddenFields.value = list
          .filter((f) => !shownIds.has(f.fieldId))
          .map((f) => ({ key: f.fieldId, label: f.fieldName, checked: false }))
      } else {
        // 无 draft：走 frontPage 逻辑兜底
        shownFields.value = list
          .filter((f) => f.frontPage)
          .map((f) => ({ key: f.fieldId, label: f.fieldName, checked: true }))
        hiddenFields.value = list
          .filter((f) => !f.frontPage)
          .map((f) => ({ key: f.fieldId, label: f.fieldName, checked: false }))
      }
      hiddenCurrentPage.value = res.data.currentPage
      hiddenPageCount.value = res.data.pageCount
    }
  } catch {
    // 接口异常时保持空列表
  } finally {
    settingLoading.value = false
  }
}

async function loadMoreHiddenFields() {
  if (hiddenLoadingMore.value || hiddenCurrentPage.value >= hiddenPageCount.value) return
  hiddenLoadingMore.value = true
  const nextPage = hiddenCurrentPage.value + 1
  try {
    const res = await queryAvailableFields({
      page: nextPage,
      perPage: 20,
      searchKey: settingSearchKeyword.value || '',
    })
    if (res.success && res.data?.list) {
      const shownIds = new Set(getDraftShownFieldIds())
      const moreHidden = res.data.list
        .filter((f) => shownIds.size > 0 ? !shownIds.has(f.fieldId) : !f.frontPage)
        .map((f) => ({ key: f.fieldId, label: f.fieldName, checked: false }))
      hiddenFields.value.push(...moreHidden)
      hiddenCurrentPage.value = res.data.currentPage
      hiddenPageCount.value = res.data.pageCount
    }
  } catch {
    // 忽略加载更多异常
  } finally {
    hiddenLoadingMore.value = false
  }
}

function onHiddenListScroll(e: Event) {
  const el = e.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) {
    loadMoreHiddenFields()
  }
}

function openSettingDrawer() {
  settingCollapseActive.value = ['shown', 'hidden']
  settingSearchKeyword.value = ''
  settingDrawerOpen.value = true
  fetchAvailableFields()
}

function handleSettingSearch(value: string) {
  fetchAvailableFields(value || undefined)
}

// 已显示字段拖拽排序
const shownDragIndex = ref<number | null>(null)

function onShownDragStart(e: DragEvent, index: number) {
  shownDragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // 兼容 Firefox，必须设置数据
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onShownDragOver(e: DragEvent, _index: number) {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function onShownDrop(_e: DragEvent, targetIndex: number) {
  const sourceIndex = shownDragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) return
  const list = shownFields.value.slice()
  const [moved] = list.splice(sourceIndex, 1)
  list.splice(targetIndex, 0, moved)
  shownFields.value = list
  saveShownFields()
}

function onShownDragEnd() {
  shownDragIndex.value = null
}

/** 将当前 shownFields 保存到 /filter/draft，成功后重新拉取 draft 刷新本地 */
async function saveShownFields() {
  const d = draftFilter.value
  if (!d) return
  // showFieldItemList 直接传字段 ID 字符串数组
  const showFieldItemList = shownFields.value.map(f => f.key)
  const newShowField = JSON.stringify({ showFieldItemList })
  try {
    const res = await updateFilterDraft({
      id: d.id,
      userNo: d.userNo,
      showField: newShowField,
    })
    if (res?.success) {
      // 更新成功后重新拉取 draft
      const fresh = await getFilterDraft(d.userNo)
      if (fresh?.success && fresh.data) {
        draftFilter.value = fresh.data
      }
    }
  } catch { /* 保存失败静默处理 */ }
}

/** 未显示字段勾选 → 移到已显示字段 → 保存 */
function onHiddenFieldCheck(item: FieldOption) {
  if (!item.checked) return
  // 从 hiddenFields 移除，加入 shownFields
  hiddenFields.value = hiddenFields.value.filter(f => f.key !== item.key)
  shownFields.value.push({ key: item.key, label: item.label, checked: true })
  saveShownFields()
}

/** 已显示字段取消勾选 → 移到未显示字段 → 保存 */
function onShownFieldUncheck(item: FieldOption) {
  if (item.checked) return
  // 从 shownFields 移除，加入 hiddenFields
  shownFields.value = shownFields.value.filter(f => f.key !== item.key)
  hiddenFields.value.unshift({ key: item.key, label: item.label, checked: false })
  saveShownFields()
}

// 工具栏状态
const filterCount = ref(0)
const sortCount = ref(0)

// 筛选面板
const filterPanelVisible = ref(false)
const filterConditions = ref<Array<{ logic: string; field: string; operator: string; value: string }>>([
  { logic: '且', field: 'assignee', operator: '属于', value: '当前用户' },
  { logic: '且', field: 'status', operator: '属于', value: '所有未结束状态' },
])

const filterDisplayCount = computed(() => filterConditions.value.length)

// 排序 / 分组 / 分层 / 视图状态
const sortItemList = ref<SortItem[]>([
  { field: { id: 'customfield_46508' }, sortTypeCode: 'DESC' },
])
const sortCountComputed = computed(() => sortItemList.value.length)
const isSortDesc = computed(() => sortItemList.value[0]?.sortTypeCode === 'DESC')

function toggleSortDirection() {
  if (sortItemList.value.length === 0) return
  const first = sortItemList.value[0]
  first.sortTypeCode = first.sortTypeCode === 'DESC' ? 'ASC' : 'DESC'
}

// 视图编码（与后端约定，标识"我的事项"视图）
const viewCode = ref('MY_TODO219415')

// 值映射：页面文案 → 后端枚举
const VALUE_MAP: Record<string, string> = {
  '当前用户': 'CURRENT_USER',
  '所有未结束状态': 'ALL_NOT_DONE',
  '已完成': 'DONE',
  '高': 'HIGH',
  '中': 'MEDIUM',
  '低': 'LOW',
}
// 操作符映射：中文 → 后端枚举
const OPERATOR_MAP: Record<string, string> = {
  '属于': 'BELONG',
  '等于': 'EQUAL',
  '不等于': 'NOT_EQUAL',
  '包含': 'CONTAIN',
  '不包含': 'NOT_CONTAIN',
  '大于': 'GREATER_THAN',
  '小于': 'LESS_THAN',
}
// 逻辑映射：中文 → 后端枚举
const LOGIC_MAP: Record<string, string> = { '且': 'AND', '或': 'OR' }

/** 把 filterConditions 转换为后端 globalFilter.childConditionGroupList */
function buildChildConditionGroups(): ChildConditionGroup[] {
  return filterConditions.value.map((c) => {
    const mappedValue = VALUE_MAP[c.value] ?? c.value
    const isCurrentUser = c.field === 'assignee' && c.value === '当前用户'
    return {
      isGroupModule: false,
      condition: {
        conditionValueList: [
          {
            value: mappedValue,
            userSpecialIdentifier: isCurrentUser ? 'CURRENT_USER' : '',
            timeOperationDirectionTypeCode: null,
            timeFormatTypeCode: null,
            comparedField: null,
          },
        ],
        field: { id: c.field, datasourceId: 0 },
        operationType: OPERATOR_MAP[c.operator] ?? c.operator,
        conditionGroup: null,
        dateScopeType: null,
        comparedTypeCode: null,
        disable: null,
        includeObsolete: null,
      },
    }
  })
}

/** 草稿筛选（从 GET /filter/draft 获取，issue/query 入参全部取自此处） */
const draftFilter = ref<FilterDraft | null>(null)

/** 安全 parse JSON 字符串 */
function safeParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try { return JSON.parse(str) as T } catch { return fallback }
}

/** 构建完整查询入参（全部取自 /filter/draft 返回值，page/pageSize 用本地状态） */
function buildQueryPayload(): IssueQueryPayload {
  const d = draftFilter.value
  if (!d) {
    return {
      globalFilter: { filter: { logicType: 'AND', isGroupModule: false, condition: null, disable: null, includeObsolete: null, isPass: null, associatedConditions: [], matchAllLinks: false, isDevActivity: null, isSprintBlock: null, isVersionBlock: null, isCustomColumnBlock: null, childConditionGroupList: [] }, isOnlyShowAssociation: false },
      group: { groupItemList: [], isFollowPreviousGroup: true },
      layered: { layeredItemList: [], layerType: 'FLAT' },
      page: currentPage.value,
      pageSize: pageSize.value,
      showField: { showFieldItemList: [] },
      sort: { sortItemList: [] },
      viewCode: viewCode.value,
      needShowGroupValues: [],
      referencedFilter: { filter: null },
    }
  }
  return {
    globalFilter: safeParse(d.globalFilter, { filter: null, isOnlyShowAssociation: false }),
    group: safeParse(d.group, { groupItemList: [], isFollowPreviousGroup: true }),
    layered: safeParse(d.layered, { layeredItemList: [], layerType: 'FLAT' }),
    page: currentPage.value,
    pageSize: pageSize.value,
    showField: safeParse(d.showField, { showFieldItemList: [] }),
    sort: safeParse(d.sort, { sortItemList: [] }),
    viewCode: d.viewCode ?? viewCode.value,
    needShowGroupValues: safeParse(d.needShowGroupValues, []),
    referencedFilter: safeParse(d.referencedFilter, { filter: null }),
  }
}

function handleReset() {
  filterCount.value = 0
  sortCount.value = 0
  currentPage.value = 1
  fetchIssues()
}

function handleImportExportClick(e: { key: string }) {
  switch (e.key) {
    case 'import':
      message.info('导入功能')
      break
    case 'export':
      message.info('导出功能')
      break
  }
}

// 查询 / 筛选

// 分页
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)

const loading = ref(false)
const dataList = ref<IssueRecord[]>([])
const rawIssueRecords = ref<IssueRecord[]>([])

/** fieldId → name 映射（仅包含 name 非空的字段），用于列设置抽屉 */
const fieldNameMap = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {}
  for (const rec of rawIssueRecords.value) {
    if (!rec.issueField) continue
    for (const f of rec.issueField) {
      if (!f.id) continue
      const name = f.name != null ? String(f.name).trim() : ''
      if (name && !(f.id in m)) m[f.id] = name
    }
  }
  return m
})

/** 动态表格列：取自 issueField，name 为空则不展示该列 */
const tableColumns = computed(() => {
  const m: Record<string, { id: string; name: string; type?: string }> = {}
  for (const rec of rawIssueRecords.value) {
    if (!rec.issueField) continue
    for (const f of rec.issueField) {
      if (!f.id) continue
      const name = f.name != null ? String(f.name).trim() : ''
      if (!name) continue
      if (!(f.id in m)) m[f.id] = { id: f.id, name, type: f.type }
    }
  }
  return Object.values(m)
})

/** 从 issueField 取单元格显示值 */
function getCellValue(rec: IssueRecord, fieldId: string): string {
  const f = rec.issueField?.find(it => it.id === fieldId)
  if (!f) return ''
  if (f.exportValue != null) return String(f.exportValue)
  const v = f.value
  if (v == null) return ''
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    return String(obj.name ?? obj.id ?? '')
  }
  return String(v)
}

/** 取 issueKey（用于行标识和详情跳转） */
function getIssueKey(rec: IssueRecord): string {
  const f = rec.issueField?.find(it => it.id === 'issuekey')
  return f ? String(f.value ?? '') : ''
}

/** 取 status id（用于 tag 颜色） */
function getStatusId(rec: IssueRecord): string {
  const f = rec.issueField?.find(it => it.id === 'status')
  if (!f || !f.value) return ''
  const v = f.value
  if (typeof v === 'object') return String((v as Record<string, unknown>).id ?? '')
  return String(v)
}

/** 取 priority id（用于 tag 颜色） */
function getPriorityId(rec: IssueRecord): string {
  const f = rec.issueField?.find(it => it.id === 'priority')
  if (!f || !f.value) return ''
  const v = f.value
  if (typeof v === 'object') return String((v as Record<string, unknown>).id ?? '')
  return String(v)
}

function statusColor(s: string) {
  const map: Record<string, string> = { '1': 'default', '2': 'processing', '3': 'success' }
  return map[s] ?? 'default'
}

function priorityColor(p: string) {
  const map: Record<string, string> = { '1': 'red', '2': 'orange', '3': 'default' }
  return map[p] ?? 'default'
}

async function fetchIssues() {
  loading.value = true
  try {
    const res = await getIssues(buildQueryPayload())
    const info = res?.data
    if (info && info.list) {
      rawIssueRecords.value = info.list
      dataList.value = info.list.map(rec => ({ ...rec, issueKey: getIssueKey(rec) }))
      total.value = info.total ?? 0
    } else {
      rawIssueRecords.value = []
      dataList.value = []
      total.value = 0
    }
  } catch {
    rawIssueRecords.value = []
    dataList.value = []
  } finally {
    loading.value = false
  }
}

function handleMenuClick(e: { key: string }, row: IssueRecord) {
  handleAction(e.key, row)
}

function handleAction(key: string, row: IssueRecord) {
  switch (key) {
    case 'edit':
      console.log('编辑:', row)
      break
    case 'copy':
      console.log('复制:', row)
      break
    case 'rollback':
      console.log('回滚:', row)
      break
  }
}

// 筛选面板关闭时，若条件有变化则重新查询
let filterSnapshot = JSON.stringify(filterConditions.value)
watch(filterPanelVisible, (open) => {
  if (!open) {
    const current = JSON.stringify(filterConditions.value)
    if (current !== filterSnapshot) {
      filterSnapshot = current
      currentPage.value = 1
      fetchIssues()
    }
  }
})

// 字段配置抽屉关闭时，若显示字段有变化则重新查询
let shownFieldsSnapshot = JSON.stringify(shownFields.value)
watch(settingDrawerOpen, (open) => {
  if (!open) {
    const current = JSON.stringify(shownFields.value)
    if (current !== shownFieldsSnapshot) {
      shownFieldsSnapshot = current
      fetchIssues()
    }
  }
})

// 排序变化时重新查询
watch(sortItemList, () => {
  currentPage.value = 1
  fetchIssues()
}, { deep: true })

// 分页变化时重新查询
watch([currentPage, pageSize], () => {
  fetchIssues()
})

onMounted(async () => {
  // 先获取草稿筛选（showField 决定已展示字段，其他字段决定 issue/query 入参）
  try {
    const res = await getFilterDraft('10284941')
    if (res?.success && res.data) {
      draftFilter.value = res.data
      currentPage.value = res.data.page || 1
      pageSize.value = res.data.pageSize || 50
    }
  } catch { /* 草稿获取失败时走兜底空筛选 */ }
  // 再加载字段配置（shownFields 从 draft 的 showField 解析）
  await fetchAvailableFields()
  shownFieldsSnapshot = JSON.stringify(shownFields.value)
  filterSnapshot = JSON.stringify(filterConditions.value)
  fetchIssues()
})
</script>

<style scoped>
.todo-page {
  padding: 1vh 1vh 1vh;
  background: #ffffff;
  height: calc(100vh - 75px);
  width: calc(100% + 1vh);
  max-width: none;
  margin: -2vh -0.5vh;
  display: flex;
  flex-direction: column;
}

/* 顶部标题栏 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 0;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.refresh-icon {
  font-size: 16px;
  color: #8c8c8c;
  cursor: pointer;
}

.refresh-icon:hover {
  color: #1890ff;
}

/* 右侧工具栏 */
.top-bar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
  flex-shrink: 1;
  min-width: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.top-bar-right::-webkit-scrollbar {
  display: none;
}

/* 所有直接子元素（含 a-popover/a-dropdown 包裹 span）均不收缩，保证按钮不变形 */
.top-bar-right > :deep(*) {
  flex-shrink: 0;
}

.total-text {
  font-size: 13px;
  color: #8c8c8c;
  margin-right: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 功能按钮 */
.edit-status {
  font-size: 13px;
  color: #8c8c8c;
}

.reset-link {
  color: #1890ff;
  cursor: pointer;
  text-decoration: none;
}

.reset-link:hover {
  text-decoration: underline;
}

.save-link {
  font-size: 13px;
  color: #595959;
  cursor: pointer;
}

.save-link:hover {
  color: #1890ff;
}

.tool-btn {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  height: 28px;
  padding: 0 10px;
  font-size: 13px;
  color: #595959;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

.tool-btn:hover {
  background: #f0f0f0 !important;
  color: #1890ff;
}

.tool-btn.active {
  color: #1890ff;
}

.filter-btn {
  background: #e6f4ff !important;
  color: #1890ff !important;
  gap: 2px !important;
  padding: 0 8px !important;
  height: 28px;
}

.filter-btn:hover {
  background: #bae0ff !important;
}

.sort-btn {
  background: #e6f4ff !important;
  color: #1890ff !important;
  gap: 2px !important;
  padding: 0 8px !important;
  height: 28px;
}

.sort-btn:hover {
  background: #bae0ff !important;
}

.more-btn {
  padding: 0 8px;
}

.toolbar-divider {
  margin: 0 4px;
  height: 16px;
  flex-shrink: 0;
}

.view-btn {
  margin-left: 4px;
}

/* 表格 */
.table-wrapper {
  background: transparent;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.items-table {
  --vxe-ui-table-header-background-color: #f5f5f5;
  --vxe-ui-table-border-color: transparent;
  --vxe-ui-table-border-width: 0;
  --vxe-ui-table-header-column-border-right-color: transparent;
  --vxe-ui-table-body-column-border-right-color: transparent;
  --vxe-ui-table-column-resizable-color: transparent;
  --vxe-table-resizable-color: transparent;
}

.items-table :deep(.vxe-table),
.items-table :deep(.vxe-table--main-wrapper),
.items-table :deep(.vxe-table--header-wrapper),
.items-table :deep(.vxe-table--body-wrapper) {
  --vxe-ui-table-border-color: transparent !important;
  --vxe-ui-table-border-width: 0 !important;
}

.items-table :deep(.vxe-header--column),
.items-table :deep(.vxe-table--header .vxe-cell),
.items-table :deep(.vxe-table--header-wrapper .vxe-header--column),
.items-table :deep(.vxe-table--header th),
.items-table :deep(.vxe-table--header .col--ellipsis) {
  background: var(--vxe-ui-table-header-background-color);
  color: #262626;
  font-weight: 600;
  font-size: 13px;
  border-right: 0 !important;
  border-left: 0 !important;
  border-top: 0 !important;
  box-shadow: none !important;
  outline: none !important;
}

.items-table :deep(.vxe-table--header-wrapper),
.items-table :deep(.vxe-table--border-line),
.items-table :deep(.vxe-table--scroll-x-body),
.items-table :deep(.vxe-table--header-inner-wrapper) {
  --vxe-table-header-column-border-right-color: transparent !important;
  --vxe-ui-table-header-column-border-right-color: transparent !important;
}

.items-table :deep(.vxe-table--border-line) {
  border: 0 !important;
  border-right: 0 !important;
  border-left: 0 !important;
  display: none !important;
}

.items-table :deep(.vxe-table--header .vxe-header--column:not(:last-child)::after),
.items-table :deep(.vxe-table--header .vxe-header--column:not(:last-child)::before),
.items-table :deep(.vxe-cell--col-resizable),
.items-table :deep(.vxe-table--column-resizable) {
  display: none !important;
  border: 0 !important;
  background: transparent !important;
}

.items-table :deep(.vxe-body--column),
.items-table :deep(.vxe-table--body td) {
  border-bottom: 1px solid #f0f0f0;
  border-right: 0 !important;
  border-left: 0 !important;
  font-size: 14px;
  color: #262626;
}

.items-table :deep(.vxe-body--row:hover .vxe-body--column) {
  background: #fafafa;
}

.summary-text {
  font-size: 14px;
  color: #262626;
}

.issue-key-link {
  font-size: 14px;
  color: #1890ff;
  cursor: pointer;
  text-decoration: none;
}

.issue-key-link:hover {
  text-decoration: underline;
}

/* 操作列三点按钮 */
.action-dots {
  font-size: 18px;
  color: #8c8c8c;
  letter-spacing: -1px;
  padding: 0 4px;
  line-height: 1;
}

.action-dots:hover {
  color: #1890ff;
}

/* 列设置抽屉 */
.setting-drawer-body {
  padding: 0;
}

/* 去掉搜索输入框内部竖向分割线（同时保留外框） */
.setting-drawer-body :deep(.ant-input-affix-wrapper) {
  border-left: 1px solid #d9d9d9 !important;
  border-right: 1px solid #d9d9d9 !important;
  border-radius: 6px !important;
}

/* 去掉 搜索图标(prefix)和输入文字之间、清空按钮(suffix)左侧 的竖线 */
.setting-drawer-body :deep(.ant-input-prefix),
.setting-drawer-body :deep(.ant-input-suffix) {
  border-right: 0 !important;
  border-left: 0 !important;
  box-shadow: none !important;
}

.setting-drawer-body :deep(.ant-input-prefix) {
  margin-inline-end: 0 !important;
}

.setting-drawer-body :deep(.ant-input-suffix) {
  margin-inline-start: 0 !important;
}

/* 清除 affix-wrapper 内部可能渲染的伪元素分割线 */
.setting-drawer-body :deep(.ant-input-affix-wrapper::before),
.setting-drawer-body :deep(.ant-input-affix-wrapper::after),
.setting-drawer-body :deep(.ant-input::before),
.setting-drawer-body :deep(.ant-input::after) {
  display: none !important;
  box-shadow: none !important;
}

/* 保证 affix-wrapper 内部前缀、后缀和输入框之间无 inset 阴影分割线 */
.setting-drawer-body :deep(.ant-input),
.setting-drawer-body :deep(.ant-input-affix-wrapper .ant-input) {
  box-shadow: none !important;
  border-inline-end: 0 !important;
  border-inline-start: 0 !important;
  padding-inline-start: 8px !important;
  padding-inline-end: 8px !important;
}

.setting-drawer-body :deep(.ant-input-search) {
  width: 100%;
}

/* 有 enter-button / group-addon 时，清除中间的竖线 */
.setting-drawer-body :deep(.ant-input-search .ant-input-group-addon),
.setting-drawer-body :deep(.ant-input-search .ant-input-search-button) {
  border-left: 0 !important;
  border-right: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* 清除 affix-wrapper 与后面 addon 之间的右边框（输入框与搜索图标之间的竖线） */
.setting-drawer-body :deep(.ant-input-group > .ant-input-affix-wrapper:not(:last-child)) {
  border-inline-end: 0 !important;
  border-right: 0 !important;
}

/* 保证最外侧的左右边框完整（左：第一个子元素；右：最后一个子元素） */
.setting-drawer-body
  :deep(.ant-input-group > .ant-input-group-addon:first-child),
.setting-drawer-body :deep(.ant-input-group > .ant-input:first-child),
.setting-drawer-body
  :deep(.ant-input-group > .ant-input-affix-wrapper:first-child) {
  border-inline-start: 1px solid #d9d9d9 !important;
}

.setting-drawer-body
  :deep(.ant-input-group > .ant-input-group-addon:last-child),
.setting-drawer-body :deep(.ant-input-group > .ant-input:last-child),
.setting-drawer-body
  :deep(.ant-input-group > .ant-input-affix-wrapper:last-child) {
  border-inline-end: 1px solid #d9d9d9 !important;
}

.setting-drawer-body :deep(.ant-collapse) {
  background: transparent;
}

.setting-drawer-body :deep(.ant-collapse.ant-collapse-ghost),
.setting-drawer-body :deep(.ant-collapse > .ant-collapse-item) {
  padding: 0;
  margin: 0;
}

.setting-drawer-body :deep(.ant-collapse > .ant-collapse-item) {
  border-bottom: 1px solid #f0f0f0;
}

.setting-drawer-body :deep(.ant-collapse > .ant-collapse-item > .ant-collapse-header) {
  padding: 12px 16px;
  margin: 0 -16px;
  font-weight: 600;
  font-size: 13px;
  color: #262626;
  background: #f5f5f5;
  border-radius: 0;
  margin-bottom: 0;
}

.setting-drawer-body :deep(.ant-collapse-content > .ant-collapse-content-box) {
  padding: 8px 0 16px;
}

.field-list {
  display: flex;
  flex-direction: column;
}

.field-list-scroll {
  max-height: 300px;
  overflow-y: auto;
}

.field-loading-more {
  text-align: center;
  padding: 8px 0;
  font-size: 12px;
  color: #8c8c8c;
}

.field-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  transition: background-color 0.15s, opacity 0.15s;
}

.field-item:hover {
  background: #f5f5f5;
}

.field-item-dragging {
  opacity: 0.4;
}

.field-drag-handle {
  font-size: 16px;
  color: #bfbfbf;
  margin-right: 6px;
  cursor: move;
  flex-shrink: 0;
  user-select: none;
}

.field-item :deep(.ant-checkbox-wrapper) {
  flex: 1;
  font-size: 13px;
  color: #262626;
}
</style>

<style>
.filter-popover .ant-popover-inner {
  padding: 0;
  border-radius: 6px;
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
}

.filter-popover .ant-popover-inner-content {
  padding: 0;
}

.filter-popover .ant-popover-arrow {
  display: none;
}
</style>
