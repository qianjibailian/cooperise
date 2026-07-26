<template>
  <div class="my-items-page">
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
      <a-table
        :columns="columns"
        :data-source="allItems"
        :pagination="false"
        :scroll="{ x: 'max-content' }"
        row-key="id"
        :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
        class="items-table"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'action'">
            <span style="display: flex; align-items: center; gap: 4px;">
              操作
              <component :is="SettingOutlined" style="font-size: 13px; color: #9ca3af; cursor: pointer;" />
            </span>
          </template>
          <template v-else>{{ column.title }}</template>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'summary'">
            <span class="summary-text">{{ record.summary }}</span>
          </template>
          <template v-else-if="column.key === 'estimatedHours'">
            <span v-if="record.estimatedHours">{{ record.estimatedHours }}</span>
          </template>
          <template v-else-if="column.key === 'startDate'">
            <span v-if="record.startDate">{{ record.startDate }}</span>
          </template>
          <template v-else-if="column.key === 'endDate'">
            <span v-if="record.endDate">{{ record.endDate }}</span>
          </template>
          <template v-else-if="column.key === 'parentIssue'">
            <span v-if="record.parentIssue" class="parent-issue-link">{{ record.parentIssue }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" class="action-dots">
              <component :is="MoreOutlined" />
            </a-button>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 底部提示 -->
    <div class="no-more-text">没有更多数据了</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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

const columns = [
  { title: '概要', key: 'summary' },
  { title: '预估工时', key: 'estimatedHours', width: 120 },
  { title: '计划开始日期', key: 'startDate', width: 140 },
  { title: '计划完成日期', key: 'endDate', width: 140 },
  { title: '父级工单', key: 'parentIssue', width: 120 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' },
]

const filterCount = ref(2)
const sortCount = ref(1)
const selectedRowKeys = ref<string[]>([])

const onSelectChange = (keys: string[]) => {
  selectedRowKeys.value = keys
}

const handleReset = () => {}
const handleRefresh = () => {}

const allItems = ref<MyItem[]>([
  { id: '1', summary: '【频道页】CLUB新增开卡大额券', estimatedHours: 56, startDate: '2026-07-20', endDate: '2026-07-31', parentIssue: 'UG-872' },
  { id: '2', summary: '开发在籍页动画 1）缺少本次新增大额券 2）由于新增大额券 导致最下面的...', parentIssue: 'UG-872' },
])
</script>

<style scoped>
.my-items-page {
  padding: 0 24px 24px;
  background: #ffffff;
  min-height: 100%;
  width: calc(100% + 48px);
  max-width: none;
  margin: -24px;
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
}

.items-table {
  padding: 0;
}

.items-table :deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  color: #262626;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e8e8e8;
  padding: 12px 16px;
}

.items-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f0f0f0;
  padding: 14px 16px;
  font-size: 14px;
  color: #262626;
}

.items-table :deep(.ant-table-tbody > tr:hover > td) {
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
  padding: 24px 0;
  font-size: 13px;
  color: #bfbfbf;
}
</style>
