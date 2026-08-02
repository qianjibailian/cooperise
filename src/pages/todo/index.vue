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
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索标题"
          style="width: 220px"
          allow-clear
          @search="onSearch"
        />
        <a-select
          v-model:value="filterCategory"
          placeholder="分类"
          style="width: 120px"
          allow-clear
          @change="onFilterChange"
        >
          <a-select-option value="requirement">需求</a-select-option>
          <a-select-option value="task">任务</a-select-option>
          <a-select-option value="bug">缺陷</a-select-option>
          <a-select-option value="other">其他</a-select-option>
        </a-select>
        <a-select
          v-model:value="filterStatus"
          placeholder="状态"
          style="width: 120px"
          allow-clear
          @change="onFilterChange"
        >
          <a-select-option :value="1">待处理</a-select-option>
          <a-select-option :value="2">进行中</a-select-option>
          <a-select-option :value="3">已完成</a-select-option>
        </a-select>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <vxe-table
        ref="tableRef"
        :data="dataList"
        :loading="loading"
        :row-config="{ keyField: 'id' }"
        :column-config="{ resizable: true }"
        class="items-table"
      >
        <vxe-column field="code" title="编号" width="140" />
        <vxe-column field="title" title="概要" min-width="260">
          <template #default="{ row }">
            <span class="summary-text">{{ row.title }}</span>
          </template>
        </vxe-column>
        <vxe-column field="priority" title="优先级" width="100">
          <template #default="{ row }">
            <a-tag :color="priorityColor(row.priority)">{{ priorityLabel(row.priority) }}</a-tag>
          </template>
        </vxe-column>
        <vxe-column field="status" title="状态" width="100">
          <template #default="{ row }">
            <a-tag :color="statusColor(row.status)">{{ statusLabel(row.status) }}</a-tag>
          </template>
        </vxe-column>
        <vxe-column field="category" title="分类" width="80">
          <template #default="{ row }">
            <a-tag>{{ categoryLabel(row.category) }}</a-tag>
          </template>
        </vxe-column>
        <vxe-column field="assignee" title="指派人" width="100" />
        <vxe-column field="deadline" title="截止日期" width="120">
          <template #default="{ row }">
            <span v-if="row.deadline">{{ row.deadline?.split('T')[0] }}</span>
          </template>
        </vxe-column>
        <vxe-column field="createdAt" title="创建时间" width="160">
          <template #default="{ row }">
            <span>{{ row.createdAt?.split('T')[0] }}</span>
          </template>
        </vxe-column>
      </vxe-table>
    </div>

    <!-- 底部分页 -->
    <div class="pagination-bar">
      <a-pagination
        v-model:current="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-size-options="['10', '20', '50']"
        show-size-changer
        show-quick-jumper
        :show-total="(t: number) => `共 ${t} 条`"
        @change="onPageChange"
        @show-size-change="onPageSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { VxeTableInstance } from 'vxe-table'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { getIssues } from '@/api/faiz'
import type { Issue } from '@/types/faiz'

const tableRef = ref<VxeTableInstance<Issue>>()

// 查询 / 筛选
const keyword = ref('')
const filterCategory = ref<string>()
const filterStatus = ref<number>()

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const loading = ref(false)
const dataList = ref<Issue[]>([])

function statusLabel(s: number) {
  const map: Record<number, string> = { 1: '待处理', 2: '进行中', 3: '已完成' }
  return map[s] ?? String(s)
}

function statusColor(s: number) {
  const map: Record<number, string> = { 1: 'default', 2: 'processing', 3: 'success' }
  return map[s] ?? 'default'
}

function priorityLabel(p: number) {
  const map: Record<number, string> = { 1: '高', 2: '中', 3: '低' }
  return map[p] ?? String(p)
}

function priorityColor(p: number) {
  const map: Record<number, string> = { 1: 'red', 2: 'orange', 3: 'default' }
  return map[p] ?? 'default'
}

function categoryLabel(c: string) {
  const map: Record<string, string> = { requirement: '需求', task: '任务', bug: '缺陷', other: '其他' }
  return map[c] ?? c
}

async function fetchIssues() {
  loading.value = true
  try {
    const res = await getIssues({
      keyword: keyword.value || undefined,
      category: filterCategory.value,
      status: filterStatus.value,
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    const body = res.data
    if (body && body.list) {
      dataList.value = body.list
      total.value = body.total ?? 0
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

function onSearch() {
  currentPage.value = 1
  fetchIssues()
}

function onFilterChange() {
  currentPage.value = 1
  fetchIssues()
}

function onPageChange(page: number) {
  currentPage.value = page
  fetchIssues()
}

function onPageSizeChange(_current: number, size: number) {
  currentPage.value = 1
  pageSize.value = size
  fetchIssues()
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
  gap: 8px;
}

.total-text {
  font-size: 13px;
  color: #8c8c8c;
  white-space: nowrap;
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

/* 底部分页 */
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 4px;
  border-top: 1px solid #f0f0f0;
}
</style>
