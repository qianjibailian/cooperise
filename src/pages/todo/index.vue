<template>
  <div class="todo-page">
    <!-- 顶部标题栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title">我的事项</h1>
        <span class="edit-status">(已编辑 <a class="reset-link" @click="handleReset">重置</a>)</span>
        <a class="save-link">另存为</a>
        <component :is="ReloadOutlined" class="refresh-icon" @click="handleRefresh" />
      </div>
      <div class="top-bar-right">
        <span class="total-text">共{{ allItems.length }}条</span>
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
        :data="allItems"
        :row-config="{ keyField: 'id' }"
        :column-config="{ resizable: true }"
        :scroll-x="{ enabled: true }"
        :checkbox-config="{ range: false }"
        :edit-config="{ trigger: 'click', mode: 'cell', showStatus: true }"
        :keep-source="true"
        class="items-table"
      >
        <vxe-column type="checkbox" width="48" fixed="left" />
        <vxe-column field="summary" title="概要" min-width="240" :edit-render="{ name: 'input' }">
          <template #default="{ row }">
            <span class="summary-text">{{ row.summary }}</span>
          </template>
        </vxe-column>
        <vxe-column field="estimatedHours" title="预估工时" width="120" :edit-render="{ name: 'VxeNumberInput', props: { placeholder: '请输入工时' } }">
          <template #default="{ row }">
            <span v-if="row.estimatedHours">{{ row.estimatedHours }}</span>
          </template>
        </vxe-column>
        <vxe-column field="startDate" title="计划开始日期" width="140" :edit-render="{ name: 'VxeDatePicker', props: { type: 'date', placeholder: '选择日期' } }">
          <template #default="{ row }">
            <span v-if="row.startDate">{{ row.startDate }}</span>
          </template>
        </vxe-column>
        <vxe-column field="endDate" title="计划完成日期" width="140" :edit-render="{ name: 'VxeDatePicker', props: { type: 'date', placeholder: '选择日期' } }">
          <template #default="{ row }">
            <span v-if="row.endDate">{{ row.endDate }}</span>
          </template>
        </vxe-column>
        <vxe-column field="parentIssue" title="父级工单" width="120">
          <template #default="{ row }">
            <span v-if="row.parentIssue" class="parent-issue-link">{{ row.parentIssue }}</span>
          </template>
        </vxe-column>
        <vxe-column title="操作" width="80" fixed="right">
          <template #header>
            <span style="display: flex; align-items: center; gap: 4px;">
              操作
              <component :is="SettingOutlined" style="font-size: 13px; color: #9ca3af; cursor: pointer;" />
            </span>
          </template>
          <template #default>
            <a-button type="link" size="small" class="action-dots">
              <component :is="MoreOutlined" />
            </a-button>
          </template>
        </vxe-column>
      </vxe-table>
    </div>

    <!-- 底部提示 -->
    <div class="no-more-text">没有更多数据了</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { VxeTableInstance } from 'vxe-table'
import {
  SettingOutlined,
  FilterOutlined,
  AppstoreOutlined,
  SortAscendingOutlined,
  MenuOutlined,
  CheckSquareOutlined,
  FullscreenOutlined,
  MoreOutlined,
  UnorderedListOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'

interface MyItem {
  id: string
  summary: string
  estimatedHours?: number
  startDate?: string
  endDate?: string
  parentIssue?: string
}

const filterCount = ref(2)
const sortCount = ref(1)
const tableRef = ref<VxeTableInstance<MyItem>>()

const handleReset = () => {
  tableRef.value?.clearCheckboxRow()
}
const handleRefresh = () => {}

const allItems = ref<MyItem[]>([
  { id: '1', summary: '【需求】用户中心页面改版', estimatedHours: 24, startDate: '2026-07-28', endDate: '2026-08-05', parentIssue: 'UG-101' },
  { id: '2', summary: '【Bug】订单列表加载缓慢问题修复', estimatedHours: 8, startDate: '2026-07-29', endDate: '2026-07-31', parentIssue: 'BUG-238' },
  { id: '3', summary: '【优化】支付接口性能调优', estimatedHours: 16, startDate: '2026-08-01', endDate: '2026-08-03', parentIssue: 'OPT-56' },
  { id: '4', summary: '【新增】数据导出功能开发', estimatedHours: 32, startDate: '2026-07-25', endDate: '2026-08-10', parentIssue: 'UG-203' },
  { id: '5', summary: '【修复】登录页面验证码显示异常', estimatedHours: 4, startDate: '2026-07-28', endDate: '2026-07-29', parentIssue: 'BUG-301' },
])
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

.refresh-icon {
  font-size: 16px;
  color: #8c8c8c;
  cursor: pointer;
  margin-left: 4px;
}

.refresh-icon:hover {
  color: #1890ff;
}

/* 右侧工具栏 */
.top-bar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.total-text {
  font-size: 13px;
  color: #8c8c8c;
  margin-right: 8px;
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

.items-table :deep(.vxe-header--column > .vxe-cell) {
  border-right: none !important;
}

.items-table :deep(.vxe-header--column .vxe-cell) {
  border-right: none !important;
}

.items-table :deep(.vxe-body--column) {
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
  color: #262626;
}

.items-table :deep(.vxe-cell--edit-icon) {
  display: none;
}

.items-table :deep(.vxe-body--row:hover .vxe-body--column) {
  background: #fafafa;
}

.summary-text {
  font-size: 14px;
  color: #262626;
}

.parent-issue-link {
  color: #1890ff;
  cursor: pointer;
}

.parent-issue-link:hover {
  text-decoration: underline;
}

.action-dots {
  color: #1890ff;
  font-size: 16px;
  padding: 0 4px;
}

/* 底部提示 */
.no-more-text {
  text-align: center;
  padding: 4px 0;
  font-size: 13px;
  color: #bfbfbf;
}
</style>
