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
        <a-button class="tool-btn filter-btn" :class="{ active: filterCount > 0 }">
          <component :is="AlignCenterOutlined" />
          筛选(2)
        </a-button>
        <a-button class="tool-btn">
          <component :is="UnorderedListOutlined" />
          分组
        </a-button>
        <a-button class="tool-btn sort-btn" :class="{ active: sortCount > 0 }">
          <component :is="SortAscendingOutlined" />
          排序(1)
        </a-button>
        <a-button class="tool-btn">
          <component :is="MenuOutlined" />
          分层
        </a-button>
        <a-button class="tool-btn">
          <component :is="CheckSquareOutlined" />
          批量操作
        </a-button>
        <a-button class="tool-btn">
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
        <a-button class="tool-btn view-btn">
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
        keep-source
        :row-config="{ keyField: 'issueKey' }"
        :column-config="{ resizable: true }"
        :checkbox-config="{ highlight: true, range: false }"
        :edit-config="{ trigger: 'click', mode: 'cell', showStatus: true, showIcon: false }"
        @edit-actived="onEditActived"
        @edit-closed="onEditClosed"
        class="items-table"
      >
        <vxe-column type="checkbox" width="50" align="center" fixed="left" />
        <vxe-column field="summary" title="概要" min-width="300" fixed="left" :edit-render="{}">
          <template #default="{ row }">
            <span class="summary-text">{{ row.summary }}</span>
          </template>
          <template #edit="{ row }">
            <a-input v-model:value="row.summary" size="small" />
          </template>
        </vxe-column>
        <vxe-column field="issueKey" title="编号" width="140">
          <template #default="{ row }">
            <a class="issue-key-link" @click="openDetail(row.issueKey)">{{ row.issueKey }}</a>
          </template>
        </vxe-column>
        <vxe-column field="priorityId" title="优先级" width="100" :edit-render="{}">
          <template #default="{ row }">
            <a-tag :color="priorityColor(row.priorityId)">{{ row.priorityName || priorityLabel(row.priorityId) }}</a-tag>
          </template>
          <template #edit="{ row }">
            <a-select v-model:value="row.priorityId" size="small" style="width:100%" @change="(v: string) => onSelectChange(row, 'priorityId', 'priorityName', v, priorityOptions)">
              <a-select-option v-for="o in priorityOptions" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
          </template>
        </vxe-column>
        <vxe-column field="statusId" title="状态" width="100" :edit-render="{}">
          <template #default="{ row }">
            <a-tag :color="statusColor(row.statusId)">{{ row.statusName || statusLabel(row.statusId) }}</a-tag>
          </template>
          <template #edit="{ row }">
            <a-select v-model:value="row.statusId" size="small" style="width:100%" @change="(v: string) => onSelectChange(row, 'statusId', 'statusName', v, statusOptions)">
              <a-select-option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
          </template>
        </vxe-column>
        <vxe-column field="issuetypeId" title="分类" width="80" :edit-render="{}">
          <template #default="{ row }">
            <a-tag>{{ row.issuetypeName || typeLabel(row.issuetypeId) }}</a-tag>
          </template>
          <template #edit="{ row }">
            <a-select v-model:value="row.issuetypeId" size="small" style="width:100%" @change="(v: string) => onSelectChange(row, 'issuetypeId', 'issuetypeName', v, typeOptions)">
              <a-select-option v-for="o in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
          </template>
        </vxe-column>
        <vxe-column field="assigneeName" title="经办人" width="120" :edit-render="{}">
          <template #edit="{ row }">
            <a-input v-model:value="row.assigneeName" size="small" />
          </template>
        </vxe-column>
        <vxe-column field="createdAt" title="创建时间" width="120">
          <template #default="{ row }">
            <span>{{ row.createdAt?.split(' ')[0] }}</span>
          </template>
        </vxe-column>
        <vxe-column field="updatedAt" title="更新时间" width="120">
          <template #default="{ row }">
            <span>{{ row.updatedAt?.split(' ')[0] }}</span>
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
            <a-dropdown>
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
                <a-checkbox v-model:checked="item.checked">
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
                <a-checkbox v-model:checked="item.checked">
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
import { ref, onMounted } from 'vue'
import type { VxeTableInstance } from 'vxe-table'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  AlignCenterOutlined,
  SortAscendingOutlined,
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
import { getIssues, patchIssue, queryAvailableFields } from '@/api/faiz'
import type { IssueRow, IssueRecord } from '@/types/faiz'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'

const tableRef = ref<VxeTableInstance<IssueRow>>()

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

const shownFields = ref<FieldOption[]>([])
const hiddenFields = ref<FieldOption[]>([])

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
      shownFields.value = list
        .filter((f) => f.frontPage)
        .map((f) => ({ key: f.fieldId, label: f.fieldName, checked: true }))
      hiddenFields.value = list
        .filter((f) => !f.frontPage)
        .map((f) => ({ key: f.fieldId, label: f.fieldName, checked: false }))
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
      const moreHidden = res.data.list
        .filter((f) => !f.frontPage)
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
}

function onShownDragEnd() {
  shownDragIndex.value = null
}

// 工具栏状态
const filterCount = ref(0)
const sortCount = ref(0)

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
const dataList = ref<IssueRow[]>([])

function statusLabel(s: string) {
  const map: Record<string, string> = { '1': '待处理', '2': '进行中', '3': '已完成' }
  return map[s] ?? s
}

function statusColor(s: string) {
  const map: Record<string, string> = { '1': 'default', '2': 'processing', '3': 'success' }
  return map[s] ?? 'default'
}

function priorityLabel(p: string) {
  const map: Record<string, string> = { '1': '高', '2': '中', '3': '低' }
  return map[p] ?? p
}

function priorityColor(p: string) {
  const map: Record<string, string> = { '1': 'red', '2': 'orange', '3': 'default' }
  return map[p] ?? 'default'
}

function typeLabel(t: string) {
  const map: Record<string, string> = { '10001': '需求', '10002': '任务', '10003': '缺陷', '10004': '其他' }
  return map[t] ?? t
}

// ---------- 单元格编辑 ----------
const priorityOptions = [
  { value: '1', label: '高' },
  { value: '2', label: '中' },
  { value: '3', label: '低' },
]
const statusOptions = [
  { value: '1', label: '待处理' },
  { value: '2', label: '进行中' },
  { value: '3', label: '已完成' },
]
const typeOptions = [
  { value: '10001', label: '需求' },
  { value: '10002', label: '任务' },
  { value: '10003', label: '缺陷' },
  { value: '10004', label: '其他' },
]

// 下拉选择变更时同步 name 字段
function onSelectChange(row: IssueRow, idField: string, nameField: string, val: string, options: { value: string; label: string }[]) {
  ;(row as unknown as Record<string, unknown>)[idField] = val
  const o = options.find(i => i.value === val)
  ;(row as unknown as Record<string, unknown>)[nameField] = o ? o.label : ''
}

// 编辑前的快照
const editBackup = ref<{ issueKey: string; field: string; value: unknown } | null>(null)

function onEditActived(params: { row: IssueRow; column: { field: string } }) {
  const { row, column } = params
  editBackup.value = {
    issueKey: row.issueKey,
    field: column.field,
    value: (row as unknown as Record<string, unknown>)[column.field],
  }
}

function onEditClosed(params: { row: IssueRow; column: { field: string } }) {
  const { row, column } = params
  const field = column.field
  if (!editBackup.value || editBackup.value.issueKey !== row.issueKey || editBackup.value.field !== field) return
  const oldVal = editBackup.value.value
  const newVal = (row as unknown as Record<string, unknown>)[field]
  editBackup.value = null
  if (oldVal === newVal) return
  // 调后端保存
  patchIssue(row.issueKey, { [field]: newVal })
    .then(() => message.success('已保存'))
    .catch(() => message.error('保存失败'))
}

// 将后端 issueField 数组拍平为表格行对象
function flattenIssue(rec: IssueRecord): IssueRow {
  const m: Record<string, unknown> = {}
  rec.issueField?.forEach((f) => { m[f.id] = f.value })
  const status = (m.status || {}) as Record<string, unknown>
  const priority = (m.priority || {}) as Record<string, unknown>
  const issuetype = (m.issuetype || {}) as Record<string, unknown>
  const assignee = (m.assignee || {}) as Record<string, unknown>
  const creator = (m.creator || {}) as Record<string, unknown>
  const project = (m.project || {}) as Record<string, unknown>
  return {
    issueKey: String(m.issuekey ?? ''),
    summary: String(m.summary ?? ''),
    description: String(m.description ?? ''),
    statusId: String(status.id ?? ''),
    statusName: String(status.name ?? ''),
    priorityId: String(priority.id ?? ''),
    priorityName: String(priority.pname ?? ''),
    issuetypeId: String(issuetype.id ?? ''),
    issuetypeName: String(issuetype.name ?? ''),
    assigneeName: String(assignee.userEnName || assignee.userCoAccount || ''),
    creatorName: String(creator.userEnName || creator.userCoAccount || ''),
    createdAt: String(m.created ?? ''),
    updatedAt: String(m.updated ?? ''),
    projectName: String(project.name ?? ''),
    parentIssueKey: (m.parentIssueKey as string | null) ?? null,
  }
}

async function fetchIssues() {
  loading.value = true
  try {
    const res = await getIssues({
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    const info = res?.data
    if (info && info.list) {
      dataList.value = info.list.map(flattenIssue)
      total.value = info.total ?? 0
    } else {
      dataList.value = []
      total.value = 0
    }
  } catch {
    dataList.value = []
  } finally {
    loading.value = false
  }
}

function handleMenuClick(e: { key: string }, row: IssueRow) {
  handleAction(e.key, row)
}

function handleAction(key: string, row: IssueRow) {
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

onMounted(() => {
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
  flex-wrap: wrap;
}

.total-text {
  font-size: 13px;
  color: #8c8c8c;
  margin-right: 8px;
  white-space: nowrap;
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
