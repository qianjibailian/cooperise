<template>
  <div class="sprint-board-page">
    <!-- 顶部工具栏 -->
    <div class="board-toolbar">
      <div class="toolbar-left">
        <h1 class="board-title">Sprint 看板</h1>
        <a-tag color="blue" class="sprint-tag">Sprint 26</a-tag>
        <span class="sprint-date">2026.07.15 - 2026.08.15</span>
      </div>
      <div class="toolbar-right">
        <div class="sprint-progress">
          <div class="progress-info">
            <span class="progress-text">{{ doneCount }}/{{ totalCount }} 已完成</span>
            <span class="progress-pct">{{ progressPct }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPct + '%' }" />
          </div>
        </div>
        <a-button class="tool-btn"><FilterOutlined />筛选</a-button>
        <a-button class="tool-btn"><TeamOutlined />成员</a-button>
      </div>
    </div>

    <!-- 看板列 -->
    <div class="board-columns">
      <div v-for="col in columns" :key="col.id" class="board-column">
        <div class="column-header">
          <div class="column-header-left">
            <span :class="['column-dot', col.dotClass]" />
            <span class="column-title">{{ col.title }}</span>
            <span class="column-count">{{ col.issues.length }}</span>
          </div>
          <PlusOutlined class="column-add" />
        </div>
        <div class="column-body">
          <vxe-list
            v-if="col.issues.length > 0"
            :data="col.issues"
            height="100%"
            :row-config="{ keyField: 'id', isHover: false, useKey: true }"
            class="kanban-list"
          >
            <template #default="{ items }">
              <div
                v-for="issue in items"
                :key="issue.id"
                class="kanban-card-wrap"
              >
                <vxe-card
                  class="kanban-card"
                  :class="{ 'card-urgent': issue.priorityId === '1' }"
                  size="small"
                  :border="false"
                  :padding="true"
                >
                  <div class="card-top">
                    <a-tag :color="typeColor(issue.issuetypeId)" class="card-type">{{ typeLabel(issue.issuetypeId) }}</a-tag>
                    <span :class="['priority-flag', priorityClass(issue.priorityId)]">
                      {{ priorityLabel(issue.priorityId) }}
                    </span>
                  </div>
                  <div class="card-summary">{{ issue.summary }}</div>
                  <div v-if="issue.parentIssueKey" class="card-parent">
                    <LinkOutlined /> {{ issue.parentIssueKey }}
                  </div>
                  <div class="card-bottom">
                    <span class="card-key">{{ issue.issueKey }}</span>
                    <div class="card-assignee">
                      <div class="avatar" :style="{ background: avatarColor(issue.assigneeId) }">
                        {{ avatarText(issue.assigneeId) }}
                      </div>
                    </div>
                  </div>
                </vxe-card>
              </div>
            </template>
          </vxe-list>
          <div v-else class="column-empty">
            <InboxOutlined class="empty-icon" />
            <span>暂无事项</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FilterOutlined, TeamOutlined, PlusOutlined, LinkOutlined, InboxOutlined } from '@ant-design/icons-vue'
// sprint 看板本地 mock 事项
interface SprintIssue {
  id: number
  issueKey: string
  projectId: string
  issuetypeId: string
  summary: string
  description: string
  statusId: string
  priorityId: string
  creatorId: string
  assigneeId: string
  parentIssueKey: string | null
  createdAt: string
  updatedAt: string
}

// ---- mock 数据 ----
const mockIssues: SprintIssue[] = [
  { id: 1,  issueKey: 'UG-900001', projectId: '18701', issuetypeId: '10001', summary: '首页推荐流懒加载优化', description: '', statusId: '2', priorityId: '1', creatorId: 'U001', assigneeId: 'U004', parentIssueKey: null,    createdAt: '2026-07-15T09:30:00', updatedAt: '2026-07-28T14:20:00' },
  { id: 2,  issueKey: 'UG-900002', projectId: '18701', issuetypeId: '10002', summary: '用户标签体系接口联调', description: '', statusId: '2', priorityId: '2', creatorId: 'U001', assigneeId: 'U005', parentIssueKey: null,    createdAt: '2026-07-16T10:15:00', updatedAt: '2026-07-30T16:45:00' },
  { id: 4,  issueKey: 'UG-900004', projectId: '18701', issuetypeId: '10001', summary: '新增自定义表单设计器', description: '', statusId: '2', priorityId: '2', creatorId: 'U001', assigneeId: 'U004', parentIssueKey: null,    createdAt: '2026-07-18T08:45:00', updatedAt: '2026-08-01T17:00:00' },
  { id: 8,  issueKey: 'UG-900008', projectId: '18701', issuetypeId: '10001', summary: '我的事项列表页开发', description: '', statusId: '2', priorityId: '2', creatorId: 'U001', assigneeId: 'U004', parentIssueKey: null,    createdAt: '2026-07-24T10:00:00', updatedAt: '2026-08-01T11:45:00' },
  { id: 9,  issueKey: 'UG-900009', projectId: '18702', issuetypeId: '10001', summary: '前台架构微前端改造', description: '', statusId: '1', priorityId: '1', creatorId: 'U003', assigneeId: 'U005', parentIssueKey: null,    createdAt: '2026-07-10T08:00:00', updatedAt: '2026-07-26T17:30:00' },
  { id: 11, issueKey: 'UG-900011', projectId: '18702', issuetypeId: '10003', summary: '路由切换内存泄漏', description: '', statusId: '2', priorityId: '1', creatorId: 'U002', assigneeId: 'U005', parentIssueKey: null,    createdAt: '2026-07-21T15:45:00', updatedAt: '2026-07-30T10:00:00' },
  { id: 12, issueKey: 'UG-900012', projectId: '18703', issuetypeId: '10001', summary: '运营平台数据看板', description: '', statusId: '1', priorityId: '2', creatorId: 'U001', assigneeId: 'U002', parentIssueKey: null,    createdAt: '2026-07-26T11:20:00', updatedAt: '2026-07-26T11:20:00' },
  { id: 14, issueKey: 'UG-900014', projectId: '18703', issuetypeId: '10003', summary: '导出大文件超时', description: '', statusId: '1', priorityId: '2', creatorId: 'U003', assigneeId: 'U005', parentIssueKey: null,    createdAt: '2026-07-28T14:30:00', updatedAt: '2026-07-28T14:30:00' },
  { id: 15, issueKey: 'UG-900015', projectId: '18701', issuetypeId: '10001', summary: '用户权限精细化控制', description: '', statusId: '1', priorityId: '2', creatorId: 'U001', assigneeId: 'U005', parentIssueKey: null,    createdAt: '2026-07-29T10:00:00', updatedAt: '2026-07-29T10:00:00' },
  { id: 16, issueKey: 'UG-900016', projectId: '18701', issuetypeId: '10002', summary: '表单数据校验规则配置', description: '', statusId: '2', priorityId: '3', creatorId: 'U001', assigneeId: 'U004', parentIssueKey: 'UG-900004', createdAt: '2026-07-30T08:30:00', updatedAt: '2026-08-02T14:00:00' },
  { id: 19, issueKey: 'UG-900019', projectId: '18703', issuetypeId: '10001', summary: '消息通知中心', description: '', statusId: '2', priorityId: '2', creatorId: 'U001', assigneeId: 'U002', parentIssueKey: null,    createdAt: '2026-07-22T09:45:00', updatedAt: '2026-07-31T15:30:00' },
  { id: 21, issueKey: 'UG-900021', projectId: '18701', issuetypeId: '10002', summary: '批量操作功能开发', description: '', statusId: '1', priorityId: '2', creatorId: 'U001', assigneeId: 'U004', parentIssueKey: 'UG-900008', createdAt: '2026-08-01T10:00:00', updatedAt: '2026-08-01T10:00:00' },
  { id: 22, issueKey: 'UG-900022', projectId: '18702', issuetypeId: '10001', summary: '前端国际化方案落地', description: '', statusId: '1', priorityId: '3', creatorId: 'U003', assigneeId: 'U005', parentIssueKey: null,    createdAt: '2026-08-02T08:00:00', updatedAt: '2026-08-02T08:00:00' },
  { id: 3,  issueKey: 'UG-900003', projectId: '18701', issuetypeId: '10003', summary: '搜索结果页白屏问题', description: '', statusId: '3', priorityId: '1', creatorId: 'U002', assigneeId: 'U004', parentIssueKey: null,    createdAt: '2026-07-20T11:00:00', updatedAt: '2026-07-20T11:30:00' },
  { id: 5,  issueKey: 'UG-900005', projectId: '18701', issuetypeId: '10002', summary: '组件列表页开发', description: '', statusId: '3', priorityId: '3', creatorId: 'U001', assigneeId: 'U004', parentIssueKey: 'UG-900004', createdAt: '2026-07-22T14:00:00', updatedAt: '2026-07-31T10:30:00' },
  { id: 6,  issueKey: 'UG-900006', projectId: '18701', issuetypeId: '10002', summary: '模板配置页面开发', description: '', statusId: '3', priorityId: '2', creatorId: 'U001', assigneeId: 'U004', parentIssueKey: 'UG-900004', createdAt: '2026-07-19T09:00:00', updatedAt: '2026-07-29T15:20:00' },
  { id: 7,  issueKey: 'UG-900007', projectId: '18701', issuetypeId: '10003', summary: '弹窗递归更新警告', description: '', statusId: '3', priorityId: '1', creatorId: 'U002', assigneeId: 'U004', parentIssueKey: null,    createdAt: '2026-07-25T13:30:00', updatedAt: '2026-08-02T09:15:00' },
  { id: 10, issueKey: 'UG-900010', projectId: '18702', issuetypeId: '10002', summary: '公共组件库抽离', description: '', statusId: '3', priorityId: '3', creatorId: 'U003', assigneeId: 'U005', parentIssueKey: 'UG-900009', createdAt: '2026-07-12T09:30:00', updatedAt: '2026-07-28T14:00:00' },
  { id: 13, issueKey: 'UG-900013', projectId: '18703', issuetypeId: '10002', summary: '工单导出功能', description: '', statusId: '3', priorityId: '3', creatorId: 'U001', assigneeId: 'U002', parentIssueKey: 'UG-900012', createdAt: '2026-07-27T09:00:00', updatedAt: '2026-08-01T16:30:00' },
  { id: 17, issueKey: 'UG-900017', projectId: '18701', issuetypeId: '10004', summary: '技术文档整理', description: '', statusId: '3', priorityId: '3', creatorId: 'U001', assigneeId: 'U004', parentIssueKey: null,    createdAt: '2026-07-15T16:00:00', updatedAt: '2026-08-01T09:00:00' },
  { id: 18, issueKey: 'UG-900018', projectId: '18702', issuetypeId: '10002', summary: '性能监控埋点接入', description: '', statusId: '3', priorityId: '2', creatorId: 'U003', assigneeId: 'U005', parentIssueKey: 'UG-900009', createdAt: '2026-07-18T13:00:00', updatedAt: '2026-07-25T17:00:00' },
  { id: 20, issueKey: 'UG-900020', projectId: '18701', issuetypeId: '10003', summary: '富文本编辑器粘贴图片丢失', description: '', statusId: '3', priorityId: '1', creatorId: 'U002', assigneeId: 'U004', parentIssueKey: null,    createdAt: '2026-07-24T14:15:00', updatedAt: '2026-08-02T10:30:00' },
]

// ---- 看板列 ----
const columns = computed(() => [
  { id: '1', title: '待处理', dotClass: 'dot-todo',    issues: mockIssues.filter(i => i.statusId === '1') },
  { id: '2', title: '进行中', dotClass: 'dot-progress', issues: mockIssues.filter(i => i.statusId === '2') },
  { id: '3', title: '已完成', dotClass: 'dot-done',    issues: mockIssues.filter(i => i.statusId === '3') },
])

const totalCount = computed(() => mockIssues.length)
const doneCount = computed(() => mockIssues.filter(i => i.statusId === '3').length)
const progressPct = computed(() => totalCount.value > 0 ? Math.round(doneCount.value / totalCount.value * 100) : 0)

// ---- 工具函数 ----
function typeLabel(t: string) {
  const map: Record<string, string> = { '10001': '需求', '10002': '任务', '10003': '缺陷', '10004': '其他' }
  return map[t] ?? t
}
function typeColor(t: string) {
  const map: Record<string, string> = { '10001': 'blue', '10002': 'cyan', '10003': 'red', '10004': 'default' }
  return map[t] ?? 'default'
}
function priorityLabel(p: string) {
  const map: Record<string, string> = { '1': '紧急', '2': '中等', '3': '低' }
  return map[p] ?? p
}
function priorityClass(p: string) {
  const map: Record<string, string> = { '1': 'flag-urgent', '2': 'flag-medium', '3': 'flag-low' }
  return map[p] ?? 'flag-low'
}

const userMap: Record<string, string> = {
  U001: 'Allen Shen', U002: 'San Zhang', U003: 'Si Li', U004: 'Wu Wang', U005: 'Liu Zhao',
}
const colorMap: Record<string, string> = {
  U001: '#3b82f6', U002: '#10b981', U003: '#f97316', U004: '#8b5cf6', U005: '#ec4899',
}
function avatarText(uid: string) {
  const name = userMap[uid] || uid
  return name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
}
function avatarColor(uid: string) {
  return colorMap[uid] || '#6b7280'
}
</script>

<style scoped>
.sprint-board-page {
  padding: 0 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
}

/* ---- 顶部工具栏 ---- */
.board-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 8px; gap: 16px; flex-wrap: wrap; }
.toolbar-left { display: flex; align-items: center; gap: 12px; }
.board-title { font-size: 20px; font-weight: 700; color: #1d1d1f; margin: 0; }
.sprint-tag { font-size: 12px; border-radius: 6px; font-weight: 600; }
.sprint-date { font-size: 13px; color: #86868b; }
.toolbar-right { display: flex; align-items: center; gap: 16px; }
.sprint-progress { min-width: 160px; }
.progress-info { display: flex; justify-content: space-between; margin-bottom: 4px; }
.progress-text { font-size: 13px; color: #86868b; }
.progress-pct { font-size: 13px; font-weight: 600; color: #1d1d1f; }
.progress-bar { height: 6px; background: #f0f0f5; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #34c759, #30d158); border-radius: 3px; transition: width 0.4s; }
.tool-btn { border: none !important; background: #f5f5f7 !important; border-radius: 10px !important; font-size: 13px; color: #595959; display: inline-flex; align-items: center; gap: 4px; }
.tool-btn:hover { background: #e8e8ed !important; color: #1d1d1f; }

/* ---- 看板列 ---- */
.board-columns { display: flex; gap: 16px; flex: 1; overflow-x: auto; padding: 0 8px 12px; min-height: 0; }
.board-column { flex: 1; min-width: 300px; max-width: 380px; background: #f5f5f7; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; }
.column-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; flex-shrink: 0; }
.column-header-left { display: flex; align-items: center; gap: 8px; }
.column-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-todo { background: #8e8e93; }
.dot-progress { background: #007aff; box-shadow: 0 0 0 3px rgba(0,122,255,.2); }
.dot-done { background: #34c759; box-shadow: 0 0 0 3px rgba(52,199,89,.2); }
.column-title { font-size: 14px; font-weight: 600; color: #1d1d1f; }
.column-count { font-size: 12px; color: #86868b; background: #e0e0e5; border-radius: 8px; padding: 1px 8px; min-width: 20px; text-align: center; }
.column-add { font-size: 14px; color: #86868b; cursor: pointer; padding: 4px; border-radius: 6px; transition: all 0.15s; }
.column-add:hover { background: #e0e0e5; color: #1d1d1f; }

/* ---- 列内容区 ---- */
.column-body { flex: 1; overflow: hidden; padding: 0 10px 12px; display: flex; flex-direction: column; min-height: 0; }

/* ---- vxe-list ---- */
.kanban-list {
  flex: 1;
  min-height: 0;
  background: transparent !important;
}
.kanban-list :deep(.vxe-list--render-wrapper),
.kanban-list :deep(.vxe-list--body),
.kanban-list :deep(.vxe-body--wrapper) {
  background: transparent !important;
}
.kanban-list :deep(.vxe-body--row) {
  background: transparent !important;
}

.kanban-card-wrap {
  padding: 4px 0;
}

/* ---- vxe-card ---- */
.kanban-card {
  border-radius: 12px !important;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff !important;
  display: block;
}
.kanban-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,.06) !important;
  transform: translateY(-1px);
}
.kanban-card.card-urgent {
  position: relative;
}
.kanban-card.card-urgent::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: #ff3b30;
  border-radius: 12px 0 0 12px;
}
.kanban-card :deep(.vxe-card--wrapper) {
  background: #fff !important;
  border: 1px solid #f0f0f0 !important;
  border-radius: 12px !important;
  box-shadow: 0 1px 2px rgba(0,0,0,.04) !important;
}
.kanban-card :deep(.vxe-card--body) {
  padding: 12px 14px !important;
  display: block !important;
}

/* 卡片内结构 */
.card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.card-type { font-size: 11px; border-radius: 5px; line-height: 1; margin: 0; }
.priority-flag { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
.flag-urgent { background: #fff2f0; color: #ff3b30; }
.flag-medium { background: #fff7e6; color: #fa8c16; }
.flag-low { background: #f0f0f5; color: #86868b; }
.card-summary { font-size: 14px; color: #1d1d1f; line-height: 1.4; font-weight: 500; margin-bottom: 6px; }
.card-parent { font-size: 12px; color: #86868b; display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.card-key { font-size: 12px; color: #aeaeb2; font-family: 'SF Mono', monospace; }
.card-assignee { display: flex; align-items: center; }
.avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff; }

/* ---- 空列 ---- */
.column-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 32px 0; color: #c7c7cc; flex: 1; }
.empty-icon { font-size: 24px; }
.column-empty span { font-size: 12px; }
</style>
