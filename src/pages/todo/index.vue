<template>
  <div class="todo-page">
    <!-- 顶部标题栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title">我的事项</h1>
        <span class="edit-status">(已编辑 <a class="reset-link" @click="handleReset">重置</a>)</span>
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
              @save="handleFilterSave"
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
        <a-popover
          v-model:open="sortPanelVisible"
          trigger="click"
          placement="bottomRight"
          :overlayInnerStyle="{ padding: 0 }"
          overlayClassName="filter-popover"
          :overlayStyle="{ width: '400px', maxWidth: 'calc(100vw - 32px)' }"
        >
          <template #content>
            <SortPanel
              v-model:visible="sortPanelVisible"
              v-model="sortItemList"
            />
          </template>
          <a-button class="tool-btn sort-btn" :class="{ active: sortCountComputed > 0 }">
            <component :is="isSortDesc ? SortDescendingOutlined : SortAscendingOutlined" />
            排序({{ sortCountComputed }})
          </a-button>
        </a-popover>
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
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <vxe-table
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
          :width="columnWidths[col.id]"
          :fixed="col.id === 'summary' ? 'left' : undefined"
        >
          <template #default="{ row }">
            <div
              class="editable-cell"
              :class="{ 'is-editable': isFieldEditable(row, col.id) }"
            >
              <div v-if="isCellEditing(row, col.id)" class="cell-editor">
                <a-input-number
                  v-if="getFieldType(row, col.id) === FIELD_TYPE.TEXT_BOX_NUMBER"
                  v-focus
                  v-model:value="editValue"
                  size="small"
                  style="width: 100%"
                  @pressEnter="confirmCellEdit"
                  @blur="confirmCellEdit"
                />
                <a-date-picker
                  v-else-if="isDateField(row, col.id)"
                  v-focus
                  v-model:value="editDateValue"
                  format="YYYY-MM-DD"
                  size="small"
                  style="width: 100%"
                  @pressEnter="confirmCellEdit"
                  @blur="confirmCellEdit"
                />
                <a-cascader
                  v-else-if="isCascaderField(row, col.id)"
                  v-focus
                  v-model:value="editCascaderValue"
                  :options="cascaderOptions"
                  :loading="cascaderLoading"
                  :field-names="{ label: 'name', value: 'value', children: 'children' }"
                  size="small"
                  style="width: 100%"
                  placeholder="请选择"
                  @change="confirmCellEdit"
                />
                <a-select
                  v-else-if="isSingleSelectField(row, col.id)"
                  v-focus
                  v-model:value="editValue"
                  :loading="singleLoading"
                  allow-clear
                  size="small"
                  style="width: 100%"
                  placeholder="请选择"
                  @change="confirmCellEdit"
                >
                  <template #selection="{ value }">
                    <span class="single-option-item">
                      <a-tag
                        v-if="getSingleOptionColor(String(value))"
                        class="single-option-tag"
                        :color="getSingleOptionColor(String(value))"
                      >{{ getSingleOptionName(String(value)) }}</a-tag>
                      <span v-else>{{ getSingleOptionName(String(value)) }}</span>
                    </span>
                  </template>
                  <a-select-option
                    v-for="opt in singleOptions"
                    :key="String(opt.value)"
                    :value="String(opt.value)"
                    :disabled="opt.disabled"
                  >
                    <span class="single-option-item">
                      <a-tag v-if="opt.color" class="single-option-tag" :color="opt.color">{{ opt.name }}</a-tag>
                      <span v-else>{{ opt.name }}</span>
                    </span>
                  </a-select-option>
                </a-select>
                <a-select
                  v-else-if="isUserSingleSelectField(row, col.id)"
                  v-focus
                  v-model:value="editUserValue"
                  show-search
                  :filter="false"
                  :loading="memberLoading"
                  allow-clear
                  size="small"
                  style="width: 100%"
                  placeholder="搜索姓名/账号"
                  @search="handleMemberSearch"
                  @change="confirmCellEdit"
                >
                  <template #selection="{ value }">
                    <span class="user-selection-cell">
                      <a-avatar
                        :src="memberSelectionAvatar(String(value ?? ''))"
                        :size="18"
                        class="user-option-avatar"
                      >{{ memberSelectionInitial(String(value ?? '')) }}</a-avatar>
                      <span>{{ memberSelectionLabel(String(value ?? '')) }}</span>
                    </span>
                  </template>
                  <a-select-option
                    v-for="u in memberOptions"
                    :key="String(u.userNo)"
                    :value="String(u.userNo)"
                    :label="formatUserOptionLabel(u)"
                  >
                    <span class="user-option-cell">
                      <a-avatar :src="u.avatarUrl || u.userAvatar" :size="18" class="user-option-avatar">
                        {{ userOptionInitial(u) }}
                      </a-avatar>
                      <span>{{ formatUserOptionLabel(u) }}</span>
                    </span>
                  </a-select-option>
                </a-select>
                <a-input
                  v-else
                  v-focus
                  v-model:value="editValue"
                  size="small"
                  @pressEnter="confirmCellEdit"
                  @blur="confirmCellEdit"
                  @keydown.esc="cancelCellEdit"
                />
              </div>
              <template v-else>
                <div class="cell-content">
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
                  <div v-else-if="isUserField(row, col.id)" class="user-cell">
                    <a-avatar
                      :src="getUserAvatar(row, col.id)"
                      :size="22"
                      class="user-cell-avatar"
                    >{{ getUserInitial(row, col.id) }}</a-avatar>
                    <span class="user-cell-text">{{ getUserCellText(row, col.id) }}</span>
                  </div>
                  <a-tag
                    v-else-if="isSingleSelectField(row, col.id) && getCellValue(row, col.id)"
                    class="single-select-tag"
                    :color="getSingleColor(row, col.id) || undefined"
                  >{{ getCellValue(row, col.id) }}</a-tag>
                  <span v-else>{{ getCellValue(row, col.id) }}</span>
                </div>
                <span
                  v-if="isFieldEditable(row, col.id)"
                  class="cell-edit-icon"
                  :class="{ 'always-visible': !getCellValue(row, col.id) }"
                  title="编辑"
                  @click.stop="startCellEdit(row, col.id)"
                >
                  <component :is="EditOutlined" />
                </span>
                <template v-if="col.id === 'summary'">
                  <span
                    class="cell-edit-icon"
                    title="复制概要"
                    @click.stop="handleCopySummary(row)"
                  >
                    <component :is="CopyOutlined" />
                  </span>
                  <span
                    class="cell-edit-icon"
                    title="复制链接"
                    @click.stop="handleOpenSummaryLink(row)"
                  >
                    <component :is="LinkOutlined" />
                  </span>
                </template>
              </template>
            </div>
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
    <!-- 编辑弹窗：与顶部新建弹窗同一组件，传入 issueKey 进入编辑模式 -->
    <NewIssueFormModal v-model:open="editFormOpen" :issue-key="editIssueKey" @submitted="handleEditSubmitted" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'

import {
  ReloadOutlined,
  AlignCenterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  EllipsisOutlined,
  SettingOutlined,
  CloseOutlined,
  HolderOutlined,
  CaretRightFilled,
  EditOutlined,
  CopyOutlined,
  LinkOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { getIssues, queryAvailableFields, getFilterDraft, updateFilterDraft, patchIssue, getAvailableFieldOptions, queryUsers } from '@/api/faiz'
import type {
  IssueRecord,
  IssueQueryPayload,
  ChildConditionGroup,
  SortItem,
  FilterDraft,
  GlobalFilter,
  CustomFieldOptionItem,
  UserItem,
} from '@/types/faiz'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import SortPanel from '@/components/SortPanel.vue'
import NewIssueFormModal from '@/components/NewIssueFormModal.vue'
import { FIELD_TYPE } from '@/types/fieldType'

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
      pageSize: 20,
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
      pageSize: 20,
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

// 筛选面板
const filterPanelVisible = ref(false)
const filterConditions = ref<Array<{ logic: string; field: string; operator: string; value: string }>>([
  { logic: '且', field: 'assignee', operator: '属于', value: '当前用户' },
  { logic: '且', field: 'status', operator: '属于', value: '所有未结束状态' },
])

const filterDisplayCount = computed(() => filterConditions.value.length)

// 排序 / 分组 / 分层 / 视图状态
const sortPanelVisible = ref(false)
const sortItemList = ref<SortItem[]>([
  { field: { id: 'customfield_46508' }, sortTypeCode: 'DESC' },
])
const sortCountComputed = computed(() => sortItemList.value.length)
const isSortDesc = computed(() => sortItemList.value[0]?.sortTypeCode === 'DESC')

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

/** 保存全局筛选到草稿（PUT /filter/draft） */
async function handleFilterSave() {
  const d = draftFilter.value
  const globalFilter: GlobalFilter = {
    filter: {
      logicType: 'AND',
      isGroupModule: true,
      condition: null,
      disable: null,
      includeObsolete: null,
      isPass: null,
      associatedConditions: [],
      matchAllLinks: false,
      isDevActivity: null,
      isSprintBlock: null,
      isVersionBlock: null,
      isCustomColumnBlock: null,
      childConditionGroupList: buildChildConditionGroups(),
    },
    isOnlyShowAssociation: false,
  }
  try {
    const userNo = d?.userNo ?? '10284941'
    const res = await updateFilterDraft({
      id: d?.id,
      userNo,
      globalFilter: JSON.stringify(globalFilter),
    })
    if (res?.success) {
      // 保存成功后重新拉取草稿并刷新列表
      const fresh = await getFilterDraft(userNo)
      if (fresh?.success && fresh.data) {
        draftFilter.value = fresh.data
      }
      currentPage.value = 1
      fetchIssues()
    }
  } catch {}
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
  currentPage.value = 1
  fetchIssues()
}

function handleImportExportClick(e: { key: string }) {
  switch (e.key) {
    case 'import':
      break
    case 'export':
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

/** 估算文本渲染宽度（px）：中文字符按字号、英文/数字按 0.62 倍 */
function estimateTextWidth(text: unknown, fontSize = 13): number {
  const t = String(text ?? '')
  let w = 0
  for (const ch of t) {
    w += ch.charCodeAt(0) > 255 ? fontSize : fontSize * 0.62
  }
  return w
}

/** 每列宽度：根据该列单元格值内容动态计算，值越长列越宽 */
const columnWidths = computed<Record<string, number>>(() => {
  const res: Record<string, number> = {}
  const rows = dataList.value
  for (const col of tableColumns.value) {
    const sample = rows.find(r => getCellValue(r, col.id) !== '') || rows[0]
    let maxText = 0
    for (const row of rows) {
      // 用户字段取 账号（工号），其余取单元格显示值
      const text = isUserField(row, col.id) ? getUserCellText(row, col.id) : getCellValue(row, col.id)
      if (!text) continue
      const w = estimateTextWidth(text)
      if (w > maxText) maxText = w
    }
    // 表头文本也要放得下
    maxText = Math.max(maxText, estimateTextWidth(col.name) + 6)
    // 按单元格渲染形态附加宽度
    let extra = 24 // 单元格左右 padding
    if (sample && isUserField(sample, col.id)) {
      extra += 28 // 头像 22 + 间隙 6
    } else if (
      sample &&
      (col.id === 'status' || col.id === 'priority' || col.id === 'issuetype' || isSingleSelectField(sample, col.id))
    ) {
      extra += 22 // tag 内边距
    } else if (col.id === 'issuekey') {
      extra += 12
    }
    if (sample && isFieldEditable(sample, col.id)) {
      extra += 22 // 编辑 icon 18 + 间隙 4
    }
    if (col.id === 'summary') {
      extra += 44 // 复制 + 链接 icon
    }
    res[col.id] = Math.max(Math.ceil(maxText + extra), 90)
  }
  return res
})

/** 从 issueField 取单元格显示值 */
function getCellValue(rec: IssueRecord, fieldId: string): string {
  const f = rec.issueField?.find(it => it.id === fieldId)
  if (!f) return ''
  // 日期字段：统一格式化为 YYYY-MM-DD，不显示时间
  if (String(f.type ?? '').toUpperCase() === FIELD_TYPE.DATE_PICKER) {
    const rawDate = f.exportValue ?? f.value
    if (rawDate == null) return ''
    const rawText = typeof rawDate === 'object'
      ? String((rawDate as Record<string, unknown>).name ?? (rawDate as Record<string, unknown>).id ?? '')
      : String(rawDate)
    const d = rawText ? dayjs(rawText) : null
    return d && d.isValid() ? d.format('YYYY-MM-DD') : rawText
  }
  // 级联字段：逐层取 label，一级与二级用 / 分隔显示（如 后端任务 / 代码开发）
  if (String(f.type ?? '').toUpperCase() === FIELD_TYPE.CASCADER_SINGLE) {
    const rawC = f.exportValue ?? f.value
    if (rawC == null) return ''
    return cascadingValueToLabels(rawC)
  }
  // 人员单选字段：显示 账号（工号），如 Shenyuan1（10284941）
  if (String(f.type ?? '').toUpperCase() === FIELD_TYPE.SELECT_USER_SINGLE) {
    return getUserCellText(rec, fieldId)
  }
  // 单选下拉字段：value 结构为 { optionId, optionName }，显示 optionName
  if (String(f.type ?? '').toUpperCase() === FIELD_TYPE.SELECT_LIST_SINGLE) {
    const sv = f.exportValue ?? f.value
    if (sv == null) return ''
    if (typeof sv === 'object') {
      const obj = sv as Record<string, unknown>
      return String(obj.optionName ?? obj.name ?? '')
    }
    return String(sv)
  }
  if (f.exportValue != null) return String(f.exportValue)
  const v = f.value
  if (v == null) return ''
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    return String(obj.name ?? obj.id ?? '')
  }
  return String(v)
}

/** 单选下拉字段：读取选项颜色（value 结构为 { optionId, optionName, color }） */
function getSingleColor(rec: IssueRecord, fieldId: string): string {
  const f = rec.issueField?.find(it => it.id === fieldId)
  const v = f?.value
  if (v != null && typeof v === 'object') {
    const color = (v as Record<string, unknown>).color
    return typeof color === 'string' ? color : ''
  }
  return ''
}

/** 单选下拉：按 optionId 查找选项显示名 */
function getSingleOptionName(value: string): string {
  const opt = singleOptions.value.find(o => String(o.value) === String(value))
  return opt ? opt.name : value
}

/** 单选下拉：按 optionId 查找选项颜色 */
function getSingleOptionColor(value: string): string {
  const opt = singleOptions.value.find(o => String(o.value) === String(value))
  return typeof opt?.color === 'string' && opt.color ? opt.color : ''
}

/** 判断字段是否可编辑（issueField 中 editable 为 true） */
function isFieldEditable(rec: IssueRecord, fieldId: string): boolean {
  const f = rec.issueField?.find(it => it.id === fieldId)
  return !!f?.editable
}

/** 用户字段可展示的信息（名称/账号/工号/头像，兼容 UserItem 与接口原始对象） */
interface UserLike {
  userNo?: unknown
  coAccount?: unknown
  userCoAccount?: unknown
  userEnName?: unknown
  displayName?: unknown
  name?: unknown
  avatarUrl?: unknown
  userAvatar?: unknown
}

/** 取人员字段的原始用户对象（exportValue 与 value 中优先取信息更完整的对象，兼容字符串） */
function getUserField(rec: IssueRecord, fieldId: string): UserLike | string | null {
  const f = rec.issueField?.find(it => it.id === fieldId)
  if (!f) return null
  // exportValue 常为字符串/空串，value 才是完整用户对象（含 avatarUrl/userNo/coAccount）
  const asObj = (v: unknown): UserLike | null =>
    v != null && typeof v === 'object' ? (v as UserLike) : null
  const candidates = [asObj(f.exportValue), asObj(f.value)]
  const valid = candidates.filter((c): c is UserLike => c != null)
  if (valid.length) {
    const score = (u: UserLike): number =>
      (u.avatarUrl != null ? 1 : 0) + (u.userNo != null ? 1 : 0) + (u.coAccount != null ? 1 : 0)
    valid.sort((a, b) => score(b) - score(a))
    return valid[0]
  }
  const raw = f.exportValue ?? f.value
  if (raw == null) return null
  return String(raw)
}

/** 取人员字段当前已选用户对象（同 getUserField，仅对象返回，字符串返回 null） */
function getUserFieldObj(rec: IssueRecord, fieldId: string): Record<string, unknown> | null {
  const raw = getUserField(rec, fieldId)
  return raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

/** 用户文字：账号/姓名（工号），如 Shenyuan1（10284941）或 王芳（20240003） */
function formatUserText(u: UserLike): string {
  const account = String(u.coAccount ?? u.userCoAccount ?? u.userEnName ?? u.displayName ?? u.name ?? '').trim()
  const no = u.userNo != null ? String(u.userNo).trim() : ''
  if (!account && !no) return ''
  if (!account) return no
  return no ? `${account}（${no}）` : account
}

/** 人员单元格/下拉文字：账号（工号） */
function getUserCellText(rec: IssueRecord, fieldId: string): string {
  const raw = getUserField(rec, fieldId)
  return raw == null ? '' : typeof raw === 'object' ? formatUserText(raw) : String(raw)
}

/** 人员头像：avatarUrl（旧接口 userAvatar），无头像返回空串（显示首字母占位） */
function getUserAvatar(rec: IssueRecord, fieldId: string): string {
  const raw = getUserField(rec, fieldId)
  if (raw == null || typeof raw === 'string') return ''
  return String(raw.avatarUrl ?? raw.userAvatar ?? '')
}

/** 无头像时显示的名称首字母（账号/姓名/英文名首字符） */
function getUserInitial(rec: IssueRecord, fieldId: string): string {
  const raw = getUserField(rec, fieldId)
  if (raw == null || typeof raw === 'string') return ''
  const name = String(raw.coAccount ?? raw.userCoAccount ?? raw.userEnName ?? '').trim()
  return name ? name.charAt(0).toUpperCase() : ''
}

/** 下拉选项 label（选中后标签显示）：账号（工号） */
function formatUserOptionLabel(u: UserItem): string {
  return formatUserText(u as UserLike)
}

/** 下拉选项无头像时的首字母 */
function userOptionInitial(u: UserItem): string {
  const name = String(u.coAccount ?? u.userCoAccount ?? u.userEnName ?? '').trim()
  return name ? name.charAt(0).toUpperCase() : ''
}

/** 根据 userNo 从当前选项列表中查找用户对象 */
function findMemberByNo(no: string): UserItem | undefined {
  return memberOptions.value.find(u => String(u.userNo) === no)
}

/** 选中标签文字：账号（工号），选项未加载时兜底显示 userNo */
function memberSelectionLabel(no: string): string {
  if (!no) return ''
  const u = findMemberByNo(no)
  return u ? formatUserOptionLabel(u) : no
}

/** 选中标签头像：avatarUrl（旧接口 userAvatar），无头像返回空串显示首字母 */
function memberSelectionAvatar(no: string): string {
  if (!no) return ''
  const u = findMemberByNo(no)
  return u ? String(u.avatarUrl ?? u.userAvatar ?? '') : ''
}

/** 选中标签无头像时的首字母 */
function memberSelectionInitial(no: string): string {
  if (!no) return ''
  const u = findMemberByNo(no)
  if (!u) return ''
  return userOptionInitial(u)
}

/** 当前正在编辑的单元格（行引用 + 字段 id，严格只影响当前单元格） */
const editingCell = ref<{ key: string; row: IssueRecord; fieldId: string } | null>(null)
const editValue = ref<string | number | null>(null)
/** 日期字段编辑值（a-date-picker 的 v-model 为 dayjs 对象） */
const editDateValue = ref<Dayjs | null>(null)
/** 级联字段编辑值（a-cascader 的 v-model 为 optionId 路径数组） */
const editCascaderValue = ref<string[]>([])
/** 级联字段选项 */
const cascaderOptions = ref<CustomFieldOptionItem[]>([])
/** 级联字段原始选项（未归一化，保存时取整个对象用） */
const cascaderRawOptions = ref<unknown[]>([])
const cascaderLoading = ref(false)
/** 单选下拉字段选项（SELECT_LIST_SINGLE） */
const singleOptions = ref<CustomFieldOptionItem[]>([])
/** 单选下拉字段原始选项 */
const singleRawOptions = ref<unknown[]>([])
const singleLoading = ref(false)
/** 人员单选字段编辑值（userNo） */
const editUserValue = ref<string | null>(null)
/** 人员单选字段选项（UserItem[]，label 取 userEnName） */
const memberOptions = ref<UserItem[]>([])
const memberLoading = ref(false)
let memberSearchTimer: ReturnType<typeof setTimeout> | null = null

/** 单元格编辑输入框自动聚焦 */
const vFocus = {
  mounted: (el: HTMLElement) => {
    const input = el.querySelector('input')
    input?.focus()
  },
}

/** 取字段类型（与新增字段一致，如 TEXT_BOX_SINGLE_LINE / TEXT_BOX_NUMBER） */
function getFieldType(rec: IssueRecord, fieldId: string): string {
  return rec.issueField?.find(it => it.id === fieldId)?.type ?? ''
}

/** 是否为日期字段（DATE_PICKER，大小写不敏感） */
function isDateField(rec: IssueRecord, fieldId: string): boolean {
  return getFieldType(rec, fieldId).toUpperCase() === FIELD_TYPE.DATE_PICKER
}

/** 是否为级联字段（CASCADER_SINGLE，大小写不敏感） */
function isCascaderField(rec: IssueRecord, fieldId: string): boolean {
  return getFieldType(rec, fieldId).toUpperCase() === FIELD_TYPE.CASCADER_SINGLE
}

/** 是否为单选下拉字段（SELECT_LIST_SINGLE，大小写不敏感） */
function isSingleSelectField(rec: IssueRecord, fieldId: string): boolean {
  return getFieldType(rec, fieldId).toUpperCase() === FIELD_TYPE.SELECT_LIST_SINGLE
}

/** 是否为人员单选字段（SELECT_USER_SINGLE，大小写不敏感） */
function isUserSingleSelectField(rec: IssueRecord, fieldId: string): boolean {
  return getFieldType(rec, fieldId).toUpperCase() === FIELD_TYPE.SELECT_USER_SINGLE
}

/** 是否为用户类型字段：人员单选、创建人（creator）、更新人（updater） */
function isUserField(rec: IssueRecord, fieldId: string): boolean {
  const id = String(fieldId ?? '').toLowerCase()
  return id === 'creator' || id === 'updater' || isUserSingleSelectField(rec, fieldId)
}

/**
 * 远程搜索人员（参考新增/编辑字段组件：POST /user/query，300ms 防抖）
 * 并保证当前已选人员始终出现在选项中
 */
function handleMemberSearch(keyword: string) {
  if (memberSearchTimer) clearTimeout(memberSearchTimer)
  memberSearchTimer = setTimeout(async () => {
    memberLoading.value = true
    try {
      const res = await queryUsers({ keyword, isActive: 1, page: 1, pageSize: 20 })
      if (res?.success) {
        const list = Array.isArray(res.data?.list) ? res.data.list : []
        const cur = editUserValue.value
        if (cur && !list.some(u => String(u.userNo) === String(cur))) {
          // 保留预填充的完整用户对象，避免降级为仅 userNo 的占位
          const existing = memberOptions.value.find(u => String(u.userNo) === String(cur))
          memberOptions.value = [existing ?? ({ userNo: cur } as UserItem), ...list]
        } else {
          memberOptions.value = list
        }
      } else {
        memberOptions.value = []
      }
    } catch {
      memberOptions.value = []
    } finally {
      memberLoading.value = false
    }
  }, 300)
}

/**
 * 将后端级联 value 转为 a-cascader 需要的路径数组（如 ["backend_task", "code_development"]）
 * 兼容两种结构：{optionId, childJOptions:[...]} 与 {label, value, children:[...]}
 */
function cascadingValueToPath(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map(x => String(x)).filter(Boolean)
  }
  if (typeof raw === 'object') {
    const path: string[] = []
    let cur = raw as Record<string, unknown> | null
    let guard = 0
    while (cur && guard++ < 20) {
      const id = cur.value ?? cur.id ?? cur.optionId ?? cur.key
      if (id == null || String(id).trim() === '') break
      path.push(String(id))
      const children = Array.isArray(cur.children)
        ? cur.children
        : Array.isArray(cur.childJOptions)
          ? cur.childJOptions
          : []
      cur = children.length ? (children[0] as Record<string, unknown>) : null
    }
    return path
  }
  return [String(raw)]
}

/**
 * 将后端级联 value 转为 label 显示文本（如 "后端任务 / 代码开发"）
 * 兼容 {optionId, optionName, childJOptions} 与 {label, value, children} 两种结构，
 * 一级与二级用 "/" 分隔
 */
function cascadingValueToLabels(raw: unknown): string {
  if (raw == null) return ''
  const parts: string[] = []
  let cur = typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  let guard = 0
  while (cur && guard++ < 20) {
    const label = cur.label ?? cur.name ?? cur.optionName ?? cur.text ?? cur.title
    const id = cur.value ?? cur.id ?? cur.optionId ?? cur.key
    if (label != null && String(label).trim() !== '') {
      parts.push(String(label))
    } else if (id != null && String(id).trim() !== '') {
      // 无 label 时兜底展示 id
      parts.push(String(id))
    } else {
      break
    }
    const children = Array.isArray(cur.children)
      ? cur.children
      : Array.isArray(cur.childJOptions)
        ? cur.childJOptions
        : []
    cur = children.length ? (children[0] as Record<string, unknown>) : null
  }
  return parts.join(' / ')
}

/**
 * 根据 a-cascader 路径数组，在原始选项树中查找节点并组装为嵌套对象
 * 每个节点保留接口原始字段（label/value/children 或 optionId/optionName/childJOptions），
 * 祖先节点的 children 仅保留路径上的下一级
 */
function cascadingPathToObject(path: string[], rawOptions: unknown[]): Record<string, unknown> | null {
  const ids = (path ?? [])
    .map(x => (x == null ? '' : String(x).trim()))
    .filter(x => x !== '')
  if (!ids.length || !Array.isArray(rawOptions) || !rawOptions.length) return null

  const nodeVal = (n: Record<string, unknown>): string =>
    String(n.value ?? n.id ?? n.optionId ?? n.key ?? '')
  const childOf = (n: Record<string, unknown>): unknown[] =>
    Array.isArray(n.children) ? n.children : Array.isArray(n.childJOptions) ? n.childJOptions : []

  // 沿路径逐层取节点（从根到叶）
  const nodes: Record<string, unknown>[] = []
  let level: unknown[] = rawOptions
  for (const id of ids) {
    const found = level.find((x: unknown) => {
      const n = (x ?? {}) as Record<string, unknown>
      return nodeVal(n) === id
    })
    if (!found) break
    const node = (found ?? {}) as Record<string, unknown>
    nodes.push(node)
    level = childOf(node)
  }
  if (!nodes.length) return null

  // 从叶子向上组装：每层克隆完整原始字段，children 指向路径上的下一级
  let nested: Record<string, unknown> | null = null
  for (let i = nodes.length - 1; i >= 0; i--) {
    const cur: Record<string, unknown> = { ...nodes[i] }
    if (nested) {
      if (Array.isArray(cur.children)) {
        cur.children = [nested]
      } else if (Array.isArray(cur.childJOptions)) {
        cur.childJOptions = [nested]
      } else {
        cur.children = [nested]
      }
    }
    nested = cur
  }
  return nested
}

/** 将任意 label/value/children（或 name/optionId/childJOptions）结构递归转为 CustomFieldOptionItem */
function toOptionItem(raw: unknown, idx: number): CustomFieldOptionItem {
  const base = (raw ?? {}) as Record<string, unknown>
  const label = String(base.label ?? base.name ?? base.optionName ?? base.text ?? base.title ?? `选项${idx + 1}`)
  const value = String(base.value ?? base.id ?? base.optionId ?? base.key ?? '')
  const childArr = Array.isArray(base.children)
    ? base.children
    : Array.isArray(base.childJOptions)
      ? base.childJOptions
      : null
  const children = childArr ? childArr.map((c: unknown, i: number) => toOptionItem(c, i)) : undefined
  const ext = base.ext && typeof base.ext === 'object'
    ? (base.ext as Record<string, unknown>)
    : undefined
  const color = typeof base.color === 'string'
    ? base.color
    : typeof ext?.color === 'string'
      ? ext.color
      : undefined
  return {
    id: value,
    name: label,
    value,
    disabled: !!base.disabled || !!base.obsolete,
    color: color || undefined,
    children,
  }
}

/**
 * 拉取自定义字段枚举选项（级联/单选下拉等）：
 * 优先用字段自带 configSchema / options，否则调 POST /availableField/customOptions
 */
async function fetchEnumOptions(
  kind: typeof FIELD_TYPE.CASCADER_SINGLE | typeof FIELD_TYPE.SELECT_LIST_SINGLE,
  rec: IssueRecord,
  fieldId: string,
): Promise<{ raw: unknown[]; items: CustomFieldOptionItem[] }> {
  const f = rec.issueField?.find(it => it.id === fieldId)
  const fRec = f as Record<string, unknown> | undefined
  const optionsRaw = fRec?.options
  const cfgRaw = fRec?.configSchema
    ?? (optionsRaw && typeof optionsRaw === 'object'
      ? (optionsRaw as { options?: unknown }).options
      : undefined)
  if (Array.isArray(cfgRaw) && cfgRaw.length) {
    const arr = cfgRaw.filter((x: unknown) => x != null)
    return { raw: arr, items: arr.map((x: unknown, i: number) => toOptionItem(x, i)) }
  }
  const res = await getAvailableFieldOptions([
    {
      fieldId,
      type: kind,
      projectId: '',
      issueTypeId: '',
      issueKey: getIssueKey(rec),
      page: 1,
      pageSize: 100,
    },
  ])
  if (res?.success && Array.isArray(res.data)) {
    const bucket = res.data.find(
      (b: any) => String(b.fieldId ?? b.customFieldId ?? b.customId ?? '') === fieldId,
    )
    const bucketRec = bucket as Record<string, unknown> | undefined
    const jOptionsRaw = bucketRec?.joptions
    const jList = jOptionsRaw && typeof jOptionsRaw === 'object'
      ? (jOptionsRaw as { list?: unknown }).list
      : undefined
    const rawOptions = bucketRec?.options
    // 兼容三种选项结构：joptions.list（optionId/optionName/childJOptions）、
    // options.options 嵌套、options 直接为数组（label/value/children）
    let innerOpts: unknown[] | null = null
    if (Array.isArray(rawOptions)) {
      innerOpts = rawOptions
    } else if (
      rawOptions &&
      typeof rawOptions === 'object' &&
      Array.isArray((rawOptions as Record<string, unknown>).options)
    ) {
      innerOpts = (rawOptions as Record<string, unknown>).options as unknown[]
    }
    if (Array.isArray(jList) && jList.length) {
      const arr = jList.filter((x: unknown) => x != null)
      return { raw: arr, items: arr.map((x: unknown, i: number) => toOptionItem(x, i)) }
    }
    if (innerOpts && innerOpts.length) {
      const arr = innerOpts.filter((x: unknown) => x != null)
      return { raw: arr, items: arr.map((x: unknown, i: number) => toOptionItem(x, i)) }
    }
  }
  return { raw: [], items: [] }
}

/** 加载级联字段选项（CASCADER_SINGLE） */
async function loadCascaderOptions(rec: IssueRecord, fieldId: string) {
  cascaderLoading.value = true
  try {
    const { raw, items } = await fetchEnumOptions(FIELD_TYPE.CASCADER_SINGLE, rec, fieldId)
    cascaderRawOptions.value = raw
    cascaderOptions.value = items
  } catch {
    cascaderRawOptions.value = []
    cascaderOptions.value = []
  } finally {
    cascaderLoading.value = false
  }
}

/** 加载单选下拉字段选项（SELECT_LIST_SINGLE） */
async function loadSingleOptions(rec: IssueRecord, fieldId: string) {
  singleLoading.value = true
  try {
    const { raw, items } = await fetchEnumOptions(FIELD_TYPE.SELECT_LIST_SINGLE, rec, fieldId)
    singleRawOptions.value = raw
    singleOptions.value = items
  } catch {
    singleRawOptions.value = []
    singleOptions.value = []
  } finally {
    singleLoading.value = false
  }
}

/** 该单元格是否处于编辑态（行引用 + 字段 id 严格比对，仅当前单元格生效） */
function isCellEditing(rec: IssueRecord, fieldId: string): boolean {
  const cell = editingCell.value
  return !!cell && cell.row === rec && cell.fieldId === fieldId
}

/** 点击编辑 icon 进入编辑态 */
function startCellEdit(rec: IssueRecord, fieldId: string) {
  const f = rec.issueField?.find(it => it.id === fieldId)
  const type = String(f?.type ?? '')
  const raw = f?.value
  let val: string | number | null = ''
  if (raw == null) {
    // 数字字段初始为空时用 null，避免字符串导致 a-input-number 异常
    val = type === FIELD_TYPE.TEXT_BOX_NUMBER ? null : ''
  } else if (type === FIELD_TYPE.TEXT_BOX_NUMBER) {
    // 数字字段保持 number 类型
    if (typeof raw === 'number') {
      val = raw
    } else {
      const n = Number(raw)
      val = Number.isFinite(n) ? n : null
    }
  } else if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    val = String(obj.name ?? obj.id ?? '')
  } else {
    val = String(raw)
  }
  editingCell.value = { key: getIssueKey(rec), row: rec, fieldId }
  editValue.value = val
  const upperType = type.toUpperCase()
  if (upperType === FIELD_TYPE.DATE_PICKER) {
    // 日期字段：将显示值解析为 dayjs 对象（复用 getCellValue 的 YYYY-MM-DD 格式化）
    const text = getCellValue(rec, fieldId)
    const d = text ? dayjs(text) : null
    editDateValue.value = d && d.isValid() ? d : null
    editValue.value = null
  } else if (upperType === FIELD_TYPE.CASCADER_SINGLE) {
    // 级联字段：路径数组回填 + 异步加载选项
    editCascaderValue.value = cascadingValueToPath(raw)
    editValue.value = null
    editDateValue.value = null
    cascaderOptions.value = []
    cascaderRawOptions.value = []
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadCascaderOptions(rec, fieldId)
  } else if (upperType === FIELD_TYPE.SELECT_USER_SINGLE) {
    // 人员单选字段：回填 userNo + 预填充当前用户 + 预取用户列表（含当前值）
    const uv = typeof raw === 'object' && raw != null
      ? String((raw as Record<string, unknown>).userNo ?? (raw as Record<string, unknown>).id ?? '')
      : raw == null
        ? ''
        : String(raw)
    editUserValue.value = uv || null
    editValue.value = null
    editDateValue.value = null
    editCascaderValue.value = []
    cascaderOptions.value = []
    cascaderRawOptions.value = []
    // 预填充当前已选用户对象，避免选项异步加载前 a-select 只显示 userNo
    memberOptions.value = []
    const curUser = getUserFieldObj(rec, fieldId)
    if (uv && curUser && String(curUser.userNo ?? curUser.id ?? '') === uv) {
      memberOptions.value = [{ ...(curUser as unknown as UserItem) }]
    } else if (uv) {
      memberOptions.value = [{ userNo: uv } as UserItem]
    }
    handleMemberSearch('')
  } else if (upperType === FIELD_TYPE.SELECT_LIST_SINGLE) {
    // 单选下拉字段：回填 optionId（value 结构为 { optionId, optionName }）+ 异步加载选项
    const sv = raw != null && typeof raw === 'object'
      ? String((raw as Record<string, unknown>).optionId ?? '')
      : raw == null
        ? ''
        : String(raw)
    editValue.value = sv || null
    editDateValue.value = null
    editCascaderValue.value = []
    cascaderOptions.value = []
    cascaderRawOptions.value = []
    editUserValue.value = null
    memberOptions.value = []
    singleOptions.value = []
    singleRawOptions.value = []
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadSingleOptions(rec, fieldId)
  } else {
    editDateValue.value = null
    editCascaderValue.value = []
    cascaderOptions.value = []
    cascaderRawOptions.value = []
    editUserValue.value = null
    memberOptions.value = []
    singleOptions.value = []
    singleRawOptions.value = []
  }
}

/** 取消编辑 */
function cancelCellEdit() {
  if (memberSearchTimer) clearTimeout(memberSearchTimer)
  editingCell.value = null
  cascaderOptions.value = []
  cascaderRawOptions.value = []
  editCascaderValue.value = []
  memberOptions.value = []
  editUserValue.value = null
  singleOptions.value = []
  singleRawOptions.value = []
}

/** 确认编辑：调用 PATCH /issue/{id} 保存（body 为 [{ fieldId, fieldValue }] 数组） */
async function confirmCellEdit() {
  const cell = editingCell.value
  if (!cell) return
  editingCell.value = null
  let fieldValue: unknown
  if (isDateField(cell.row, cell.fieldId)) {
    // 日期字段只传日期（YYYY-MM-DD），不传时间
    fieldValue = editDateValue.value
      ? editDateValue.value.format('YYYY-MM-DD')
      : null
  } else if (isCascaderField(cell.row, cell.fieldId)) {
    // 级联字段：按选中路径取原始选项的整个对象（保留 label/value/children 等字段）
    fieldValue = cascadingPathToObject(editCascaderValue.value, cascaderRawOptions.value)
  } else if (isUserSingleSelectField(cell.row, cell.fieldId)) {
    // 人员单选字段：保存选中用户对象（参考新增/编辑字段）
    const uv = editUserValue.value
    if (uv == null || String(uv).trim() === '') {
      fieldValue = null
    } else {
      const found = memberOptions.value.find(u => String(u.userNo) === String(uv))
      fieldValue = found || { userNo: String(uv) }
    }
  } else if (isSingleSelectField(cell.row, cell.fieldId)) {
    // 单选下拉字段：传整个选项对象 { optionId, optionName, color }（与新增/编辑弹窗一致）
    const sv = editValue.value == null ? '' : String(editValue.value).trim()
    if (sv === '') {
      fieldValue = null
    } else {
      const found = singleOptions.value.find(o => String(o.value) === sv)
      fieldValue = found
        ? {
            optionId: found.value,
            optionName: found.name,
            ...(found.color ? { color: found.color } : {}),
          }
        : { optionId: sv, optionName: sv }
    }
  } else {
    fieldValue = editValue.value
  }
  try {
    const res = await patchIssue(cell.key, [{ fieldId: cell.fieldId, fieldValue }])
    if (res?.success) {
      fetchIssues()
    }
  } catch {}
}

/** 复制概要内容到剪贴板 */
async function handleCopySummary(rec: IssueRecord) {
  const text = getCellValue(rec, 'summary')
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {}
}

/** 获取概要对应事项链接（域名/jira/browse/{issueKey}）并复制到剪贴板 */
async function handleOpenSummaryLink(rec: IssueRecord) {
  const key = getIssueKey(rec)
  if (!key) return
  const link = `${window.location.origin}/jira/browse/${key}`
  try {
    await navigator.clipboard.writeText(link)
  } catch {}
}

/** 取 issueKey（用于行标识、详情跳转和单元格更新 URL 路径），优先 issueField，兜底记录顶层字段 */
function getIssueKey(rec: IssueRecord): string {
  const f = rec.issueField?.find(it => it.id === 'issuekey')
  let key = ''
  if (f) {
    const v = f.value
    if (v != null) {
      key = typeof v === 'object'
        ? String((v as Record<string, unknown>).id ?? (v as Record<string, unknown>).name ?? '')
        : String(v)
    }
  }
  if (!key) {
    const topKey = (rec as Record<string, unknown>).issuekey ?? (rec as Record<string, unknown>).issueKey
    key = topKey != null ? String(topKey) : ''
  }
  return key
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
      // 打开编辑弹窗（复用新建弹窗组件，传入 issueKey 触发 /issue/queryDetail 回填）
      editIssueKey.value = getIssueKey(row)
      editFormOpen.value = true
      break
    case 'copy':
      console.log('复制:', row)
      break
    case 'rollback':
      console.log('回滚:', row)
      break
  }
}

/** 编辑弹窗：与顶部新建弹窗同一组件，传入 issueKey 进入编辑模式 */
const editFormOpen = ref(false)
const editIssueKey = ref('')
function handleEditSubmitted() {
  fetchIssues()
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

/* 单元格悬停编辑 icon */
.editable-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-height: 22px;
}

.editable-cell .cell-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.single-select-tag {
  margin-right: 0;
}
.single-option-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.single-option-tag {
  margin-right: 0;
}

.cell-edit-icon {
  display: none;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 12px;
  color: #0050b3;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
}

.editable-cell.is-editable:hover .cell-edit-icon,
.cell-edit-icon.always-visible {
  display: inline-flex;
}

.cell-edit-icon:hover {
  background: #e6f4ff;
}

/* 人员字段单元格（头像 + 账号（工号）） */
.user-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.user-cell-avatar {
  flex-shrink: 0;
  background: #1890ff;
  font-size: 12px;
}

.user-cell-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 人员下拉选项（头像 + 账号（工号）） */
.user-option-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.user-option-avatar {
  flex-shrink: 0;
  background: #1890ff;
  font-size: 11px;
}

/* a-select 选中标签（头像 + 账号（工号）） */
.user-selection-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.user-selection-cell > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 单元格编辑态 */
.cell-editor {
  width: 100%;
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
