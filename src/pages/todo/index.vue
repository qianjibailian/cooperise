<template>
  <div class="todo-page">
    <!-- 顶部标题栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title">我的事项</h1>
        <component :is="ReloadOutlined" class="refresh-icon" @click="fetchIssues" />
      </div>
      <div class="top-bar-right">
        <span class="total-text">共{{ total }}条</span>
        <span class="edit-status">(已编辑 <a class="reset-link" @click="handleReset">重置</a>)</span>
        <a class="save-link">另存为</a>
        <a-button class="tool-btn" :class="{ active: filterCount > 0 }">
          <component :is="FilterOutlined" />
          筛选<span v-if="filterCount > 0">({{ filterCount }})</span>
        </a-button>
        <a-button class="tool-btn">
          <component :is="AppstoreOutlined" />
          分组
        </a-button>
        <a-button class="tool-btn" :class="{ active: sortCount > 0 }">
          <component :is="SortAscendingOutlined" />
          排序<span v-if="sortCount > 0">({{ sortCount }})</span>
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
        <a-button class="tool-btn more-btn">
          <component :is="MoreOutlined" />
        </a-button>
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
        :row-config="{ keyField: 'issueKey' }"
        :column-config="{ resizable: true }"
        :checkbox-config="{ highlight: true, range: false }"
        :edit-config="{ trigger: 'click', mode: 'cell', showStatus: true, showIcon: false }"
        @edit-actived="onEditActived"
        @edit-closed="onEditClosed"
        class="items-table"
      >
        <vxe-column type="checkbox" width="50" align="center" />
        <vxe-column field="issueKey" title="编号" width="140" />
        <vxe-column field="summary" title="概要" min-width="260" :edit-render="{}">
          <template #default="{ row }">
            <span class="summary-text">{{ row.summary }}</span>
          </template>
          <template #edit="{ row }">
            <a-input v-model:value="row.summary" size="small" />
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
        <vxe-column title="操作" width="60" fixed="right" align="center">
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { VxeTableInstance } from 'vxe-table'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  FilterOutlined,
  AppstoreOutlined,
  SortAscendingOutlined,
  MenuOutlined,
  CheckSquareOutlined,
  FullscreenOutlined,
  MoreOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue'
import { getIssues, patchIssue } from '@/api/faiz'
import type { IssueRow, IssueRecord } from '@/types/faiz'

const tableRef = ref<VxeTableInstance<IssueRow>>()

// 工具栏状态
const filterCount = ref(0)
const sortCount = ref(0)

function handleReset() {
  filterCount.value = 0
  sortCount.value = 0
  currentPage.value = 1
  fetchIssues()
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
  padding: 2vh 1vh 1vh;
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
  padding: 16px 0;
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
  height: 32px;
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
  overflow-y: auto;
}

.items-table {
  --vxe-ui-table-header-background-color: #f5f5f5;
}

.items-table :deep(.vxe-header--column) {
  background: var(--vxe-ui-table-header-background-color);
  color: #262626;
  font-weight: 600;
  font-size: 13px;
  border-right: none !important;
}

.items-table :deep(.vxe-body--column) {
  border-bottom: 1px solid #f0f0f0;
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
</style>
