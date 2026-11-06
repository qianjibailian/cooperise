<template>
  <div class="todo-page">
    <!-- 顶部标题栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title" :title="pageTitle">{{ pageTitle }}</h1>
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
              v-model:logic="filterLogic"
              @save="handleFilterSave"
              @reset="handleFilterReset"
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

        <!-- 视图分享：仅创建人可见 -->
        <a-button v-if="listViewItem?.canManage" class="tool-btn" @click="shareOpen = true">
          <ShareAltOutlined />
          分享
        </a-button>
      </div>
    </div>

    <!-- 表格 -->
    <div ref="tableWrapperRef" class="table-wrapper">
      <!-- 首次加载：骨架占位，数据回来后渲染表格 -->
      <div v-if="!initialized" class="table-skeleton">
        <a-skeleton active :paragraph="{ rows: 10 }" />
      </div>
      <a-table
        v-else
        class="items-table"
        :columns="aTableColumns"
        :data-source="dataList"
        :loading="loading"
        :pagination="false"
        :row-key="getIssueKey"
        :scroll="{ x: tableScrollX, y: tableScrollY }"
        :row-selection="rowSelection"
        size="small"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === '__op__'">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0 2px;">
              <span>操作</span>
              <component :is="SettingOutlined" style="font-size: 14px; color: #0050b3; cursor: pointer;" @click.stop="openSettingDrawer" />
            </div>
          </template>
          <template v-else>{{ column.title }}</template>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === '__op__'">
            <div class="action-cell">
              <a-dropdown :trigger="['click']" @open-change="(v: boolean) => v && loadRowButtons(record)">
                <a-button type="text" class="action-dots">···</a-button>
                <template #overlay>
                  <a-menu @click="handleMenuClick($event, record)">
                    <a-menu-item v-if="rowButtonsLoading[getIssueKey(record)]" key="__loading__" disabled>
                      <a-spin size="small" /> <span class="row-btn-hint">加载中…</span>
                    </a-menu-item>
                    <a-menu-item v-else-if="!rowButtons[getIssueKey(record)]?.length" key="__empty__" disabled>
                      <span class="row-btn-hint">暂无可用操作</span>
                    </a-menu-item>
                    <template v-else>
                      <a-menu-item
                        v-for="b in rowButtons[getIssueKey(record)]"
                        :key="String(b.id)"
                        :danger="b.buttonStyle === 'danger'"
                      >
                        {{ b.buttonName }}
                      </a-menu-item>
                    </template>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>
          <div
            v-else
            class="editable-cell"
            :class="{
              'is-editable': isFieldEditable(record, String(column.dataIndex)),
              'has-actions': column.dataIndex === 'issuekey',
            }"
            @mouseenter="column.dataIndex === 'summary' && handleCellHover($event, record)"
            @mouseleave="column.dataIndex === 'summary' && handleCellLeave(record)"
          >
            <div v-if="isCellEditing(record, String(column.dataIndex))" class="cell-editor">
              <a-input-number
                v-if="getFieldType(record, String(column.dataIndex)) === FIELD_TYPE.TEXT_BOX_NUMBER"
                v-focus
                v-model:value="editValue"
                size="small"
                style="width: 100%"
                @pressEnter="confirmCellEdit"
                @blur="confirmCellEdit"
              />
              <a-date-picker
                v-else-if="isDateField(record, String(column.dataIndex))"
                v-focus
                v-model:value="editDateValue"
                format="YYYY-MM-DD"
                size="small"
                style="width: 100%"
                @pressEnter="confirmCellEdit"
                @blur="confirmCellEdit"
              />
              <a-cascader
                v-else-if="isCascaderField(record, String(column.dataIndex))"
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
                v-else-if="isSingleSelectField(record, String(column.dataIndex))"
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
                v-else-if="isUserSingleSelectField(record, String(column.dataIndex))"
                v-focus
                v-model:value="editUserValue"
                show-search
                :filter="false"
                :loading="memberLoading"
                allow-clear
                size="small"
                style="width: 100%"
                placeholder="搜索姓名/账号"
                :dropdown-match-select-width="false"
                popup-class-name="person-select-popup"
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
                  :key="userKeyOf(u)"
                  :value="userKeyOf(u)"
                  :label="formatUserOptionLabel(u)"
                >
                  <span class="user-option-cell">
                    <a-avatar :src="u.avatarUrl || u.userAvatar" :size="18" class="user-option-avatar">
                      {{ userOptionInitial(u) }}
                    </a-avatar>
                    <span class="user-option-label" :title="formatUserOptionLabel(u)">{{ formatUserOptionLabel(u) }}</span>
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
                  v-if="column.dataIndex === 'issuekey'"
                  class="issue-key-link"
                  @click="openDetail(record.issueKey)"
                >{{ getCellValue(record, String(column.dataIndex)) }}</a>
                <a-tag
                  v-else-if="column.dataIndex === 'status'"
                  class="status-cell-clickable"
                  :color="getStatusColor(record)"
                  @click="openWorkflowModal(record)"
                >{{ getCellValue(record, String(column.dataIndex)) }}</a-tag>
                <span
                  v-else-if="column.dataIndex === 'priority'"
                  class="priority-text-cell"
                  :style="{ color: getPriorityTextColor(record) }"
                >
                  <span class="priority-dot" :style="{ background: getPriorityTextColor(record) }"></span>
                  {{ getCellValue(record, String(column.dataIndex)) }}
                </span>
                <a-tag
                  v-else-if="column.dataIndex === 'issuetype'"
                  class="issuetype-tag"
                  :style="getIssueTypeTagStyle(record)"
                ><component :is="issueTypeIconOf(getIssueTypeIconUri(record))" class="issuetype-icon" />{{ getCellValue(record, String(column.dataIndex)) }}</a-tag>
                <div v-else-if="isUserField(record, String(column.dataIndex))" class="user-cell">
                  <a-avatar
                    :src="getUserAvatar(record, String(column.dataIndex))"
                    :size="22"
                    class="user-cell-avatar"
                  >{{ getUserInitial(record, String(column.dataIndex)) }}</a-avatar>
                  <span class="user-cell-text">{{ getUserCellText(record, String(column.dataIndex)) }}</span>
                </div>
                <a-tag
                  v-else-if="isSingleSelectField(record, String(column.dataIndex)) && getCellValue(record, String(column.dataIndex))"
                  class="single-select-tag"
                  :color="getSingleColor(record, String(column.dataIndex)) || undefined"
                >{{ getCellValue(record, String(column.dataIndex)) }}</a-tag>
                <a-tooltip
                  v-else-if="column.dataIndex === 'summary'"
                  :open="summaryTips[record.issueKey]?.visible"
                  :title="summaryTips[record.issueKey]?.title || ''"
                >
                  <span
                    class="summary-cell-text"
                    @click="openDetail(record.issueKey)"
                  >{{ getCellValue(record, String(column.dataIndex)) }}</span>
                </a-tooltip>
                <span v-else>{{ getCellValue(record, String(column.dataIndex)) }}</span>
              </div>
              <span
                v-if="isFieldEditable(record, String(column.dataIndex))"
                class="cell-edit-icon"
                :class="{ 'always-visible': !getCellValue(record, String(column.dataIndex)) }"
                title="编辑"
                @click.stop="startCellEdit(record, String(column.dataIndex))"
              >
                <component :is="EditOutlined" />
              </span>
              <span
                v-if="column.dataIndex === 'issuekey'"
                class="cell-edit-icon"
                title="复制单号"
                @click.stop="handleCopyIssueKey(record)"
              >
                <component :is="CopyOutlined" />
              </span>
              <template v-if="column.dataIndex === 'summary'">
                <span
                  class="cell-edit-icon"
                  title="复制概要"
                  @click.stop="handleCopySummary(record)"
                >
                  <component :is="CopyOutlined" />
                </span>
                <span
                  class="cell-edit-icon"
                  title="复制链接"
                  @click.stop="handleOpenSummaryLink(record)"
                >
                  <component :is="LinkOutlined" />
                </span>
                <span
                  class="cell-edit-icon"
                  title="打开链接"
                  @click.stop="handleOpenIssueInNew(record)"
                >
                  <component :is="ExportOutlined" />
                </span>
              </template>
            </template>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 事项详情抽屉 -->
    <IssueDetailDrawer
      v-model:open="detailDrawerOpen"
      :issue-key="detailIssueKey"
      @changed="fetchIssues"
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
    <AssignIssueModal v-model:open="assignOpen" :issue-key="assignIssueKey" @submitted="fetchIssues" />
    <SplitIssueModal v-model:open="splitOpen" :issue-key="splitIssueKey" @submitted="fetchIssues" />
    <!-- 状态变更弹窗：点击状态列打开，展示当前节点与下一步节点 -->
    <WorkflowNextStepModal v-model:open="wfModalOpen" :issue-key="wfCurrentIssueKey" @submit="handleWfSubmitted" />

    <!-- 视图分享 -->
    <ViewShareDrawer
      v-model:open="shareOpen"
      :filter-code="listViewItem?.filterCode || ''"
      :filter-name="listViewItem?.filterName || pageTitle"
      @saved="refreshViews"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { openIssueLink } from '@/utils/issue-link'
import { useAuth } from '@/utils/auth'
import { useViewStore } from '@/utils/view-store'
import { personLabel, personAvatar, personInitial } from '@/utils/person'

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
  ExportOutlined,
  ShareAltOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { currentSpaceCode } from '@/utils/current-space'
import { getIssues, queryWorkbenchFieldList, getFilterDraft, updateFilterDraft, patchIssue, getAvailableFieldOptions, queryUsers, queryIssueButtonsForIssue, type IssueButtonItem } from '@/api/faiz'
import { runIssueButton } from '@/utils/issueButtons'
import type { IssueRecord, IssueQueryPayload, SortItem, FilterDraft, GlobalFilter, CustomFieldOptionItem, UserItem } from '@/types/faiz'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'
import WorkflowNextStepModal from '@/components/WorkflowNextStepModal.vue'
import ViewShareDrawer from '@/components/ViewShareDrawer.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import { buildGlobalFilter, parseGlobalFilter, defaultConditions, isConditionComplete, type FilterCondition, type FilterLogic } from '@/utils/issueFilter'
import SortPanel from '@/components/SortPanel.vue'
import NewIssueFormModal from '@/components/NewIssueFormModal.vue'
import AssignIssueModal from '@/components/AssignIssueModal.vue'
import SplitIssueModal from '@/components/SplitIssueModal.vue'
import { onIssueCreated } from '@/utils/issue-events'
import { MY_TODO_VIEW_CODE, setTodoCount } from '@/utils/todo-count'
import { FIELD_TYPE } from '@/types/fieldType'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'

// 详情抽屉
const detailDrawerOpen = ref(false)
const detailIssueKey = ref('')

function openDetail(issueKey: string) {
  detailIssueKey.value = issueKey
  detailDrawerOpen.value = true
}

/** 概要列 Tooltip（单元格维度）：按行隔离状态，悬停整个单元格时若概要文本溢出则展示完整内容 */
const summaryTips = reactive<Record<string, { visible: boolean; title: string }>>({})

function handleCellHover(e: MouseEvent, rec: IssueRecord) {
  const el = e.currentTarget as HTMLElement
  const text = getCellValue(rec, 'summary') || ''
  const textEl = el.querySelector<HTMLElement>('.summary-cell-text')
  const overflow = textEl ? textEl.scrollWidth > textEl.clientWidth : el.scrollWidth > el.clientWidth
  summaryTips[String(rec.issueKey)] = { visible: overflow && !!text, title: text }
}

function handleCellLeave(rec: IssueRecord) {
  const tip = summaryTips[String(rec.issueKey)]
  if (tip) tip.visible = false
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

// ---------- 空间隔离：顶部选了空间时，列表列 / 列设置只展示该空间的字段 ----------
/** 当前空间可用的字段 ID（系统字段 + 关联本空间问题类型的自定义字段）；null 表示不限（未选空间或未取到） */
const spaceFieldIds = ref<Set<string> | null>(null)
let spaceFieldsReq: Promise<void> | null = null
function ensureSpaceFields(): Promise<void> {
  if (!currentSpaceCode.value) return Promise.resolve()
  if (!spaceFieldsReq) {
    spaceFieldsReq = (async () => {
      try {
        const res = await queryWorkbenchFieldList({ page: 1, pageSize: 999, searchKey: '' })
        if (res?.success && res.data?.list) spaceFieldIds.value = new Set(res.data.list.map(f => f.fieldId))
      } catch {
        // 取不到时不做空间过滤，避免列全部消失
      }
    })()
  }
  return spaceFieldsReq
}
/** 字段是否属于当前空间：标准字段（单号 / 概要 / 状态等）各空间都有 */
function isSpaceField(id: string): boolean {
  return !spaceFieldIds.value || id in STANDARD_FIELD_LABELS || spaceFieldIds.value.has(id)
}
/** 草稿里属于其它空间的已显示字段：列设置中不展示，保存时原样写回，切回原空间时列不丢 */
const outOfSpaceShownIds = ref<string[]>([])
// 页面加载即取空间字段（表格列依赖它）；切换空间时页面会整体重挂载，无需监听
// eslint-disable-next-line @typescript-eslint/no-floating-promises
ensureSpaceFields()

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

/** 展示位置：列表 / 列设置只取 LIST 场景的字段（与后端 displayScene 取值一致） */
const DISPLAY_SCENE_LIST = 'LIST'

async function fetchAvailableFields(keyword?: string) {
  settingLoading.value = true
  hiddenCurrentPage.value = 1
  try {
    await ensureSpaceFields()
    const res = await queryWorkbenchFieldList({
      page: 1,
      pageSize: 20,
      searchKey: keyword || '',
      displayScene: DISPLAY_SCENE_LIST,
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
        const draftIds = getDraftShownFieldIds()
        outOfSpaceShownIds.value = draftIds.filter(id => id && !isSpaceField(id))
        shownFields.value = draftIds.filter(id => isSpaceField(id)).map(id => ({
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
    const res = await queryWorkbenchFieldList({
      page: nextPage,
      pageSize: 20,
      searchKey: settingSearchKeyword.value || '',
      displayScene: DISPLAY_SCENE_LIST,
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
  // 无草稿时也要保存（后端按 userNo + viewCode 创建草稿），与 handleFilterSave 保持一致
  const userNo = draftUserNo.value
  // showFieldItemList 直接传字段 ID 字符串数组；其它空间的已显示字段追加在末尾保留
  const showFieldItemList = [
    ...shownFields.value.map(f => f.key),
    ...outOfSpaceShownIds.value.filter(id => !shownFields.value.some(f => f.key === id)),
  ]
  const newShowField = JSON.stringify({ showFieldItemList })
  try {
    const res = await updateFilterDraft({
      id: d?.id,
      userNo,
      viewCode: viewCode.value,
      showField: newShowField,
    })
    if (res?.success) {
      // 更新成功后重新拉取 draft
      const fresh = await getFilterDraft(userNo, viewCode.value)
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
/** 全局筛选条件（草稿有则回填，否则用默认：经办人=当前用户 + 未结束状态） */
const filterConditions = ref<FilterCondition[]>(defaultConditions())
const filterLogic = ref<FilterLogic>('AND')

/** 生效的条件数（不完整的条件不提交，也不计数） */
const filterDisplayCount = computed(() => filterConditions.value.filter(isConditionComplete).length)

// 排序 / 分组 / 分层 / 视图状态
const sortPanelVisible = ref(false)
/** 默认排序（视图草稿未保存排序时使用）：按创建时间倒序 */
const DEFAULT_SORT_ITEMS: SortItem[] = [{ field: { id: 'createtime' }, sortTypeCode: 'DESC' }]
const sortItemList = ref<SortItem[]>(JSON.parse(JSON.stringify(DEFAULT_SORT_ITEMS)))
const sortCountComputed = computed(() => sortItemList.value.length)
const isSortDesc = computed(() => sortItemList.value[0]?.sortTypeCode === 'DESC')

// 视图编码（请求 /filter/draft 时的视图标识，草稿按「用户 + 视图」隔离）：
// 列表视图取路由上的 filterCode，「我的事项」本身用固定编码；issue/query 入参取接口返回的 data.viewCode
const route = useRoute()
const viewCode = computed(() => String(route.query.filterCode || '') || 'MY_TODO21941')
/** 标题：列表视图取视图名称，「我的事项」本身（无 filterCode）显示固定标题 */
const { ensureLoaded: ensureViewsLoaded, findViewItem } = useViewStore()
ensureViewsLoaded()
const pageTitle = computed(() => {
  const code = String(route.query.filterCode || '')
  return (code && findViewItem(code)?.filterName) || '我的事项'
})
const listViewItem = computed(() => {
  const code = String(route.query.filterCode || '')
  return code ? findViewItem(code) : null
})
const shareOpen = ref(false)

/** 分享保存后刷新侧边栏视图列表（可见范围变化） */
async function refreshViews() {
  await ensureViewsLoaded(true)
}
/** 草稿归属人：登录用户工号（缺省兜底） */
const { user: authUser } = useAuth()
const draftUserNo = computed(() => authUser.value?.memberId || '10284941')


/** 全局筛选：重置为默认条件（经办人=当前用户 + 未结束状态）并保存草稿、刷新列表 */
async function handleFilterReset() {
  filterConditions.value = defaultConditions()
  filterLogic.value = 'AND'
  await handleFilterSave()
}

/** 保存全局筛选到草稿（PUT /filter/draft） */
async function handleFilterSave() {
  const d = draftFilter.value
  const globalFilter = buildGlobalFilter(filterConditions.value, filterLogic.value)
  try {
    const userNo = draftUserNo.value
    const res = await updateFilterDraft({
      id: d?.id,
      userNo,
      viewCode: viewCode.value,
      globalFilter: JSON.stringify(globalFilter),
      sort: JSON.stringify({ sortItemList: sortItemList.value }),
    })
    if (res?.success) {
      // 保存成功后重新拉取草稿并刷新列表
      const fresh = await getFilterDraft(userNo, viewCode.value)
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

/**
 * 构建完整查询入参：
 * - globalFilter：筛选面板当前条件（buildGlobalFilter）
 * - sort：排序面板当前排序项
 * - 其余（分组 / 分层 / 显示字段 / 视图）取自 /filter/draft，page/pageSize 用本地状态
 */
function buildQueryPayload(): IssueQueryPayload {
  const d = draftFilter.value
  const globalFilter = buildGlobalFilter(filterConditions.value, filterLogic.value)
  const sort = { sortItemList: sortItemList.value }
  if (!d) {
    return {
      globalFilter,
      group: { groupItemList: [], isFollowPreviousGroup: true },
      layered: { layeredItemList: [], layerType: 'FLAT' },
      page: currentPage.value,
      pageSize: pageSize.value,
      showField: { showFieldItemList: [] },
      sort,
      viewCode: viewCode.value,
      needShowGroupValues: [],
      referencedFilter: { filter: null },
    }
  }
  return {
    globalFilter,
    group: safeParse(d.group, { groupItemList: [], isFollowPreviousGroup: true }),
    layered: safeParse(d.layered, { layeredItemList: [], layerType: 'FLAT' }),
    page: currentPage.value,
    pageSize: pageSize.value,
    showField: safeParse(d.showField, { showFieldItemList: [] }),
    sort,
    viewCode: d.viewCode ?? viewCode.value,
    needShowGroupValues: safeParse(d.needShowGroupValues, []),
    referencedFilter: safeParse(d.referencedFilter, { filter: null }),
  }
}

/** 草稿回填：已保存过的筛选条件 / 逻辑 / 排序覆盖默认值 */
function restoreFromDraft(d: FilterDraft) {
  const gf = safeParse<GlobalFilter | null>(d.globalFilter, null)
  if (gf?.filter) {
    const { conditions, logic } = parseGlobalFilter(gf)
    filterConditions.value = conditions
    filterLogic.value = logic
  }
  const sort = safeParse<{ sortItemList?: SortItem[] } | null>(d.sort, null)
  // 与当前值不同才回填，否则 watch 不触发，restoringSort 会误吞下一次用户修改
  if (Array.isArray(sort?.sortItemList) && JSON.stringify(sort.sortItemList) !== JSON.stringify(sortItemList.value)) {
    restoringSort = true
    sortItemList.value = sort.sortItemList
  }
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
/** 首次数据加载完成前只渲染骨架，避免先出现空表格 */
const initialized = ref(false)
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
      // 顶部选了空间时不展示其它空间的字段列
      if (!isSpaceField(f.id)) continue
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
      (col.id === 'status' || col.id === 'issuetype' || isSingleSelectField(sample, col.id))
    ) {
      extra += 22 // tag 内边距
    } else if (col.id === 'issuekey') {
      extra += 12 + 22 // 链接留白 + 复制 icon 18 + 间隙 4
    }
    if (sample && isFieldEditable(sample, col.id)) {
      extra += 22 // 编辑 icon 18 + 间隙 4
    }
    if (col.id === 'summary') {
      res[col.id] = 200 // 概要固定宽度
      continue
    }
    res[col.id] = Math.max(Math.ceil(maxText + extra), 90)
  }
  return res
})

/** a-table 列配置：动态字段列（summary 固定左侧）+ 操作列（固定右侧） */
const aTableColumns = computed(() => {
  const cols: Array<{
    title: string
    dataIndex?: string
    key: string
    width?: number
    fixed?: 'left' | 'right'
    align?: 'center' | 'left' | 'right'
    className?: string
  }> = tableColumns.value.map(col => ({
    title: col.name,
    dataIndex: col.id,
    key: col.id,
    width: columnWidths.value[col.id],
    fixed: col.id === 'summary' ? 'left' : undefined,
  }))
  cols.push({
    title: '操作',
    key: '__op__',
    width: 72,
    fixed: 'right',
    align: 'center',
    // 固定右列默认按右对齐渲染，这里给该列加类名强制居中
    className: 'op-cell',
  })
  return cols
})

/** 横向滚动宽度：复选框列 50 + 所有动态列 + 操作列 72 */
const tableScrollX = computed(() => {
  let w = 50
  for (const col of tableColumns.value) {
    w += columnWidths.value[col.id] || 90
  }
  w += 72
  return w
})

/** 表格容器测量（用于 scroll.y 实现固定表头 + 内容滚动） */
const tableWrapperRef = ref<HTMLDivElement | null>(null)
const tableScrollY = ref(400)
let tableResizeObserver: ResizeObserver | null = null

function updateTableLayout() {
  const el = tableWrapperRef.value
  if (!el) return
  // a-table small 表头高度约 40px，剩余高度给内容区
  tableScrollY.value = Math.max(el.clientHeight - 40, 100)
}

function bindTableResizeObserver() {
  updateTableLayout()
  if (tableResizeObserver) tableResizeObserver.disconnect()
  if (tableWrapperRef.value) {
    tableResizeObserver = new ResizeObserver(updateTableLayout)
    tableResizeObserver.observe(tableWrapperRef.value)
  }
}

/** 复选框多选（固定左侧），保持与旧 vxe checkbox 列一致 */
const selectedRowKeys = ref<(string | number)[]>([])
const rowSelection = computed(() => ({
  fixed: true,
  columnWidth: 50,
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedRowKeys.value = keys
  },
}))

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
  // 单选下拉字段：优先取 value 对象中的显示名（pname/optionName/name），否则回退 exportValue
  if (String(f.type ?? '').toUpperCase() === FIELD_TYPE.SELECT_LIST_SINGLE) {
    const raw = f.value ?? f.exportValue
    if (raw == null) return ''
    if (typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      return String(obj.pname ?? obj.optionName ?? obj.name ?? '')
    }
    const sv = f.exportValue ?? f.value
    return sv == null ? '' : String(sv)
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
  realName?: unknown
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

/** 用户文字：realName（coAccount），如 王芳（wangfang） */
function formatUserText(u: UserLike): string {
  return personLabel(u as Record<string, unknown>)
}

/** 人员单元格/下拉文字：realName（coAccount） */
function getUserCellText(rec: IssueRecord, fieldId: string): string {
  const raw = getUserField(rec, fieldId)
  return raw == null ? '' : typeof raw === 'object' ? formatUserText(raw) : String(raw)
}

/** 人员头像：avatarUrl（旧接口 userAvatar），无头像返回空串（显示首字母占位） */
function getUserAvatar(rec: IssueRecord, fieldId: string): string {
  const raw = getUserField(rec, fieldId)
  if (raw == null || typeof raw === 'string') return ''
  return personAvatar(raw as Record<string, unknown>)
}

/** 无头像时显示的名称首字母（账号/姓名/英文名首字符） */
function getUserInitial(rec: IssueRecord, fieldId: string): string {
  const raw = getUserField(rec, fieldId)
  if (raw == null || typeof raw === 'string') return ''
  return personInitial(raw as Record<string, unknown>)
}

/** 下拉选项 label（选中后标签显示）：realName（coAccount） */
function formatUserOptionLabel(u: UserItem): string {
  return formatUserText(u as UserLike)
}

/** 下拉选项无头像时的首字母 */
function userOptionInitial(u: UserItem): string {
  return personInitial(u as unknown as Record<string, unknown>)
}

/** 根据 userNo 从当前选项列表中查找用户对象 */
/** 人员唯一键：新接口 memberId（userNo 可能为空），兼容旧接口 userNo / id */
function userKeyOf(u: { memberId?: unknown; userNo?: unknown; id?: unknown }): string {
  return String(u.memberId || u.userNo || u.id || '')
}

function findMemberByNo(no: string): UserItem | undefined {
  return memberOptions.value.find(u => userKeyOf(u) === no)
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
  return u ? personAvatar(u as unknown as Record<string, unknown>) : ''
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
      const res = await queryUsers({ keyword, isActive: 1, issueKey: editingCell.value?.key || undefined, page: 1, pageSize: 20 })
      if (res?.success) {
        const list = Array.isArray(res.data?.list) ? res.data.list : []
        const cur = editUserValue.value
        if (cur && !list.some(u => userKeyOf(u) === String(cur))) {
          // 保留预填充的完整用户对象，避免降级为仅 userNo 的占位
          const existing = memberOptions.value.find(u => userKeyOf(u) === String(cur))
          memberOptions.value = [existing ?? ({ memberId: cur, userNo: cur } as UserItem), ...list]
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
      issueTypeCode: '',
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
      ? userKeyOf(raw as Record<string, unknown>)
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
    if (uv && curUser && userKeyOf(curUser) === uv) {
      memberOptions.value = [{ ...(curUser as unknown as UserItem) }]
    } else if (uv) {
      memberOptions.value = [{ memberId: uv, userNo: uv } as UserItem]
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
      const found = memberOptions.value.find(u => userKeyOf(u) === String(uv))
      fieldValue = found || { memberId: String(uv) }
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

/** 复制问题单号到剪贴板 */
async function handleCopyIssueKey(rec: IssueRecord) {
  const key = getIssueKey(rec)
  if (!key) return
  try {
    await navigator.clipboard.writeText(key)
    message.success('单号已复制')
  } catch {}
}

/** 获取概要对应事项链接（域名/jira/browse/{issueKey}）并复制到剪贴板 */
async function handleOpenSummaryLink(rec: IssueRecord) {
  const key = getIssueKey(rec)
  if (!key) return
  const link = `${window.location.origin}/jira/browse/${key}`
  try {
    await navigator.clipboard.writeText(link)
    message.success('链接已复制')
  } catch {}
}

const router = useRouter()
/** 打开事项链接：浏览器新开页面；客户端新增页签 */
function handleOpenIssueInNew(rec: IssueRecord) {
  openIssueLink(getIssueKey(rec), router)
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

// ---------- 状态列：点击状态打开流程状态变更弹窗 ----------
const wfModalOpen = ref(false)
const wfCurrentIssueKey = ref('')

/** 点击状态字段：打开状态变更弹窗（后端按单号匹配流程） */
function openWorkflowModal(rec: IssueRecord) {
  const issueKey = String(rec.issueKey || '')
  if (!issueKey) return
  wfCurrentIssueKey.value = issueKey
  wfModalOpen.value = true
}

/** 工作流提交成功：刷新列表 */
function handleWfSubmitted() {
  fetchIssues()
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

/** 问题类型图标 key（issuetype.value.iconUri） */
function getIssueTypeIconUri(rec: IssueRecord): string | undefined {
  const v = rec.issueField?.find(it => it.id === 'issuetype')?.value
  const icon = v != null && typeof v === 'object' ? (v as Record<string, unknown>).iconUri : undefined
  return typeof icon === 'string' ? icon : undefined
}

/** 问题类型标签样式：取后端下发的 issueTypeColor（十六进制），浅色底 + 同色描边与文字；无有效值时用默认样式 */
function getIssueTypeTagStyle(rec: IssueRecord): Record<string, string> | undefined {
  const v = rec.issueField?.find(it => it.id === 'issuetype')?.value
  const c = v != null && typeof v === 'object' ? (v as Record<string, unknown>).issueTypeColor : undefined
  if (typeof c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c)) return undefined
  return { color: c, background: `${c}1a`, borderColor: `${c}59` }
}

/** status 标签颜色：优先用后端下发的 statusColor（十六进制），兜底按 id 映射预设色 */
function getStatusColor(rec: IssueRecord): string {
  const f = rec.issueField?.find(it => it.id === 'status')
  const v = f?.value
  if (v != null && typeof v === 'object') {
    const sc = (v as Record<string, unknown>).statusColor
    if (typeof sc === 'string' && /^#[0-9a-fA-F]{6}$/.test(sc)) return sc
  }
  return statusColor(getStatusId(rec))
}

function priorityColor(p: string) {
  const map: Record<string, string> = { '1': 'red', '2': 'orange', '3': 'default' }
  return map[p] ?? 'default'
}

/** priority 标签颜色：优先用 value.statusColor（十六进制），兜底按 id 映射预设色 */
function getPriorityColor(rec: IssueRecord): string {
  const f = rec.issueField?.find(it => it.id === 'priority')
  const v = f?.value
  if (v != null && typeof v === 'object') {
    const sc = (v as Record<string, unknown>).statusColor
    if (typeof sc === 'string' && /^#[0-9a-fA-F]{6}$/.test(sc)) return sc
  }
  return priorityColor(getPriorityId(rec))
}

/** priority 圆点/文字颜色（实际 CSS 色值）：优先 statusColor 十六进制，否则按预设色映射 */
function getPriorityTextColor(rec: IssueRecord): string {
  const c = getPriorityColor(rec)
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c
  const map: Record<string, string> = { red: '#cf1322', orange: '#d46b08', default: '#595959' }
  return map[c] ?? '#595959'
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
    // 侧边栏「我的事项 (N)」与列表总数一致（其它列表视图不影响该数字）
    if (viewCode.value === MY_TODO_VIEW_CODE) setTodoCount(total.value)
  } catch {
    rawIssueRecords.value = []
    dataList.value = []
  } finally {
    loading.value = false
    initialized.value = true
  }
}

// ---------- 行操作「···」：每次展开按事项的问题类型 + 当前状态拉取可用按钮（/issue-button/issue） ----------
const rowButtons = reactive<Record<string, IssueButtonItem[]>>({})
const rowButtonsLoading = reactive<Record<string, boolean>>({})

async function loadRowButtons(row: IssueRecord) {
  const key = getIssueKey(row)
  if (!key) return
  rowButtonsLoading[key] = true
  try {
    const res = await queryIssueButtonsForIssue(key)
    rowButtons[key] = res?.success ? res.data || [] : []
  } catch {
    rowButtons[key] = []
  } finally {
    rowButtonsLoading[key] = false
  }
}

async function handleMenuClick(e: { key: string | number }, row: IssueRecord) {
  const key = getIssueKey(row)
  const btn = rowButtons[key]?.find(b => String(b.id) === String(e.key))
  if (!btn) return
  const changed = await runIssueButton(btn, key, {
    // 打开编辑弹窗（复用新建弹窗组件，传入 issueKey 进入编辑模式）
    onEdit: () => {
      editIssueKey.value = key
      editFormOpen.value = true
    },
    onAssign: () => {
      assignIssueKey.value = key
      assignOpen.value = true
    },
    onSplit: () => {
      splitIssueKey.value = key
      splitOpen.value = true
    },
  })
  if (changed) fetchIssues()
}

/** 行操作「分配」：分配经办人弹窗 */
const assignOpen = ref(false)
const assignIssueKey = ref('')

/** 行操作「拆分任务」：拆分任务弹窗 */
const splitOpen = ref(false)
const splitIssueKey = ref('')

/** 编辑弹窗：与顶部新建弹窗同一组件，传入 issueKey 进入编辑模式 */
const editFormOpen = ref(false)
const editIssueKey = ref('')
function handleEditSubmitted() {
  fetchIssues()
}

/** 顶部新建弹窗提交成功后刷新列表 */
onIssueCreated(() => fetchIssues())

// 筛选面板关闭时，若条件有变化则重新查询
/** 只比较会提交的内容（完整条件 + 逻辑），未填完的条件不触发查询 */
function filterSignature() {
  return JSON.stringify(buildGlobalFilter(filterConditions.value, filterLogic.value))
}
let filterSnapshot = filterSignature()
watch(filterPanelVisible, (open) => {
  if (!open) {
    const current = filterSignature()
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

// 排序变化时重新查询（草稿回填排序时跳过，由初始化统一查询）
let restoringSort = false
watch(sortItemList, () => {
  if (restoringSort) {
    restoringSort = false
    return
  }
  currentPage.value = 1
  fetchIssues()
  saveSortToDraft()
}, { deep: true })

/** 排序变化后存到当前视图的草稿（防抖，连续调整只保存最后一次） */
let sortSaveTimer: ReturnType<typeof setTimeout> | undefined
function saveSortToDraft() {
  clearTimeout(sortSaveTimer)
  sortSaveTimer = setTimeout(async () => {
    try {
      const res = await updateFilterDraft({
        id: draftFilter.value?.id,
        userNo: draftUserNo.value,
        viewCode: viewCode.value,
        sort: JSON.stringify({ sortItemList: sortItemList.value }),
      })
      if (res?.success) {
        const fresh = await getFilterDraft(draftUserNo.value, viewCode.value)
        if (fresh?.success && fresh.data) draftFilter.value = fresh.data
      }
    } catch { /* 请求层已统一提示 */ }
  }, 400)
}

// 分页变化时重新查询
watch([currentPage, pageSize], () => {
  fetchIssues()
})

/** 加载当前视图的草稿并查询：每个视图的筛选 / 排序 / 显示字段各自独立，切换视图时先恢复默认再回填 */
async function loadView() {
  draftFilter.value = null
  filterConditions.value = defaultConditions()
  filterLogic.value = 'AND'
  // 排序也恢复默认（回填时由 restoringSort 吞掉 watch，避免多查一次）
  if (JSON.stringify(sortItemList.value) !== JSON.stringify(DEFAULT_SORT_ITEMS)) {
    restoringSort = true
    sortItemList.value = JSON.parse(JSON.stringify(DEFAULT_SORT_ITEMS))
  }
  // 先获取草稿筛选（showField 决定已展示字段，其他字段决定 issue/query 入参）
  try {
    const res = await getFilterDraft(draftUserNo.value, viewCode.value)
    if (res?.success && res.data) {
      draftFilter.value = res.data
      currentPage.value = res.data.page || 1
      pageSize.value = res.data.pageSize || 50
      restoreFromDraft(res.data)
    }
  } catch { /* 草稿获取失败时走默认筛选 */ }
  // 再加载字段配置（shownFields 从 draft 的 showField 解析）
  await fetchAvailableFields()
  shownFieldsSnapshot = JSON.stringify(shownFields.value)
  filterSnapshot = filterSignature()
  fetchIssues()
}

onMounted(async () => {
  await loadView()
  // 测量表格容器尺寸（scroll.y 需在 DOM 渲染后计算）
  bindTableResizeObserver()
})

// 同一页面内切换列表视图（filterCode 变化）：重新加载该视图自己的草稿
watch(viewCode, () => {
  loadView()
})

onBeforeUnmount(() => {
  if (tableResizeObserver) {
    tableResizeObserver.disconnect()
    tableResizeObserver = null
  }
})
</script>

<style scoped>
.todo-page {
  padding: 1vh 1vh 1vh;
  background: #ffffff;
  height: calc(100vh - var(--app-header-height, 56px) - 19px);
  height: calc(100dvh - var(--app-header-height, 56px) - 19px);
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
  max-width: 360px;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.refresh-icon {
  font-size: 16px;
  color: #8c8c8c;
  cursor: pointer;
}

.refresh-icon:hover {
  color: var(--c-primary);
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
  color: var(--c-primary);
}

.tool-btn.active {
  color: var(--c-primary);
}

.filter-btn {
  background: var(--c-primary-bg) !important;
  color: var(--c-primary) !important;
  gap: 2px !important;
  padding: 0 8px !important;
  height: 28px;
}

.filter-btn:hover {
  background: var(--c-primary-bg-hover) !important;
}

.sort-btn {
  background: var(--c-primary-bg) !important;
  color: var(--c-primary) !important;
  gap: 2px !important;
  padding: 0 8px !important;
  height: 28px;
}

.sort-btn:hover {
  background: var(--c-primary-bg-hover) !important;
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

/* 首次加载占位：保持表格区域高度稳定，数据回来后整块替换 */
.table-skeleton {
  min-height: 360px;
  padding: 16px 8px;
}

.items-table :deep(.ant-table) {
  background: transparent;
}

.items-table :deep(.ant-table-container),
.items-table :deep(.ant-table-content),
.items-table :deep(.ant-table-body) {
  background: transparent;
}

/* 表头 */
.items-table :deep(.ant-table-thead > tr > th) {
  background: #f5f5f5;
  color: #262626;
  font-weight: 600;
  font-size: 13px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  text-align: left;
}

/* 单元格 */
.items-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
  color: #262626;
  padding: 8px 12px;
}

/* 行 hover */
.items-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #fafafa;
}

/* 固定列背景（避免内容透出） */
.items-table :deep(.ant-table-cell-fix-left),
.items-table :deep(.ant-table-cell-fix-right) {
  background: #fff;
}
.items-table :deep(.ant-table-thead > tr > .ant-table-cell-fix-left),
.items-table :deep(.ant-table-thead > tr > .ant-table-cell-fix-right) {
  background: #f5f5f5;
}
.items-table :deep(.ant-table-tbody > tr:hover > td.ant-table-cell-fix-left),
.items-table :deep(.ant-table-tbody > tr:hover > td.ant-table-cell-fix-right) {
  background: #fafafa;
}

/* 选中行高亮 */
.items-table :deep(.ant-table-tbody > tr.ant-table-row-selected > td) {
  background: var(--c-primary-bg);
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
.summary-cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  cursor: pointer;
  transition: color 0.2s;
}
.summary-cell-text:hover {
  color: var(--c-primary);
  text-decoration: underline;
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
  color: var(--c-primary-active);
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
}

.editable-cell.is-editable:hover .cell-edit-icon,
.editable-cell.has-actions:hover .cell-edit-icon,
.cell-edit-icon.always-visible {
  display: inline-flex;
}

.cell-edit-icon:hover {
  background: var(--c-primary-bg);
}

/* 优先级：圆点 + 文字（只改文字颜色） */
.priority-text-cell {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}
.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
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
  background: var(--c-primary);
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
  background: var(--c-primary);
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
  color: var(--c-primary);
  cursor: pointer;
  text-decoration: none;
}

.issue-key-link:hover {
  text-decoration: underline;
}

/* 状态列：点击打开流程状态变更弹窗 */
.issuetype-tag {
  margin-inline-end: 0;
  font-weight: 500;
}
.issuetype-icon {
  margin-right: 4px;
}
.status-cell-clickable {
  cursor: pointer;
}

/* 操作列三点按钮 */
/* 三点靠左显示，与表头「操作」文字对齐 */
.items-table :deep(.op-cell) {
  text-align: left !important;
}

.action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
}

/* 三点按钮按 inline 级参与单元格文本居中，避免受 cell 内部宽度影响 */
.action-cell :deep(.ant-dropdown-trigger),
.action-cell .action-dots {
  margin: 0;
}

/* 行操作下拉：加载中 / 无按钮提示 */
.row-btn-hint {
  font-size: 13px;
  color: #8c8c8c;
}

.action-dots {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 18px;
  color: #8c8c8c;
  letter-spacing: -1px;
  padding: 0;
  border-radius: 4px;
  line-height: 1;
}

.action-dots:hover {
  color: var(--c-primary);
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
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06);
}

.filter-popover .ant-popover-inner-content {
  padding: 0;
}

.filter-popover .ant-popover-arrow {
  display: none;
}
</style>
