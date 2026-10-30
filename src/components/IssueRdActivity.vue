<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  FileTextOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  FileDoneOutlined,
  ExperimentOutlined,
  BugOutlined,
  AlertOutlined,
} from '@ant-design/icons-vue'
import { mockRdActivity, type RdActivityMock } from '@/mock/issueRdActivity'

/** 事项研发活动：按类别分 tab 展示（接口未接入，暂用 mock 数据） */
const props = defineProps<{ issueKey: string }>()

type TabKey = keyof RdActivityMock

const TABS: { key: TabKey; label: string; icon: unknown; empty: string }[] = [
  { key: 'doc', label: '需求文档', icon: FileTextOutlined, empty: '暂无关联的需求文档' },
  { key: 'app', label: '应用名称', icon: AppstoreOutlined, empty: '暂无关联的应用' },
  { key: 'branch', label: '代码分支', icon: BranchesOutlined, empty: '暂无关联的代码分支' },
  { key: 'testReport', label: '提测报告', icon: FileDoneOutlined, empty: '暂无提测报告' },
  { key: 'testPlan', label: '测试计划', icon: ExperimentOutlined, empty: '暂无关联的测试计划' },
  { key: 'bug', label: '缺陷管理', icon: BugOutlined, empty: '暂无关联的缺陷' },
  { key: 'incident', label: '线上故障', icon: AlertOutlined, empty: '暂无关联的线上故障' },
]

const activeKey = ref<TabKey>(TABS[0].key)
const activeTab = computed(() => TABS.find((t) => t.key === activeKey.value) ?? TABS[0])

// TODO: 接入研发活动接口后替换 mock
const data = computed<RdActivityMock>(() => mockRdActivity(props.issueKey))
const countOf = (k: TabKey) => data.value[k].length

// 切换事项时回到第一个 tab
watch(
  () => props.issueKey,
  () => (activeKey.value = TABS[0].key),
)

// ---------- 状态 → 标签样式（文字色 + 浅底） ----------
type Tone = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'purple'
const TONE: Record<Tone, { color: string; bg: string }> = {
  blue: { color: '#1677ff', bg: '#e6f4ff' },
  green: { color: '#389e0d', bg: '#f6ffed' },
  orange: { color: '#d46b08', bg: '#fff7e6' },
  red: { color: '#cf1322', bg: '#fff1f0' },
  gray: { color: '#595959', bg: '#f5f5f5' },
  purple: { color: '#722ed1', bg: '#f9f0ff' },
}
const tone = (t: Tone) => ({ color: TONE[t].color, background: TONE[t].bg })

const DOC_TONE: Record<string, Tone> = { PRD: 'blue', 原型: 'purple', 技术方案: 'green', 接口文档: 'orange' }
const MR_LABEL = { OPEN: ['进行中', 'blue'], MERGED: ['已合并', 'purple'], CLOSED: ['已关闭', 'gray'] } as const
const REPORT_LABEL = { PASS: ['提测通过', 'green'], REJECT: ['打回', 'red'], TESTING: ['测试中', 'blue'] } as const
const PLAN_LABEL = { NOT_STARTED: ['未开始', 'gray'], IN_PROGRESS: ['进行中', 'blue'], DONE: ['已完成', 'green'] } as const
const SEVERITY_TONE: Record<string, Tone> = { 致命: 'red', 严重: 'orange', 一般: 'blue', 提示: 'gray' }
const BUG_STATUS_TONE: Record<string, Tone> = { 待修复: 'red', 修复中: 'blue', 待验证: 'orange', 已关闭: 'gray' }
const LEVEL_TONE: Record<string, Tone> = { P0: 'red', P1: 'orange', P2: 'blue', P3: 'gray' }
const INCIDENT_TONE: Record<string, Tone> = { 处理中: 'red', 已恢复: 'green', 已复盘: 'gray' }

const percent = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
</script>

<template>
  <!-- 自绘等分 tab：a-tabs 拉伸撑满后溢出计算失准，会把末尾 tab 误收进「···」 -->
  <div class="rd-tabs">
    <div class="rd-tab-bar" role="tablist">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="activeKey === t.key"
        :class="['rd-tab', { 'is-active': activeKey === t.key }]"
        @click="activeKey = t.key"
      >
        {{ t.label }}<span v-if="countOf(t.key)" class="rd-tab-count">{{ countOf(t.key) }}</span>
      </button>
    </div>

    <div v-if="!countOf(activeKey)" class="rd-empty">
      <component :is="activeTab.icon" class="rd-empty-icon" />
      <span>{{ activeTab.empty }}</span>
    </div>

    <div v-else class="rd-list">
      <!-- 需求文档 -->
      <template v-if="activeKey === 'doc'">
        <div v-for="d in data.doc" :key="d.id" class="rd-row">
          <span class="rd-tag" :style="tone(DOC_TONE[d.type] ?? 'gray')">{{ d.type }}</span>
          <a class="rd-title is-link" :href="d.url" target="_blank" rel="noopener noreferrer">{{ d.title }}</a>
          <span class="rd-meta">{{ d.author }}</span>
          <span class="rd-meta rd-time">{{ d.updatedAt }}</span>
        </div>
      </template>

      <!-- 应用名称 -->
      <template v-else-if="activeKey === 'app'">
        <div v-for="a in data.app" :key="a.id" class="rd-row">
          <span class="rd-title">{{ a.name }}</span>
          <span class="rd-code">{{ a.code }}</span>
          <span class="rd-envs">
            <span v-for="e in a.envs" :key="e" class="rd-tag" :style="tone(e === 'PROD' ? 'red' : e === 'TEST' ? 'orange' : 'blue')">{{ e }}</span>
          </span>
          <span class="rd-meta">负责人 {{ a.owner }}</span>
        </div>
      </template>

      <!-- 代码分支 -->
      <template v-else-if="activeKey === 'branch'">
        <div v-for="b in data.branch" :key="b.id" class="rd-row">
          <span class="rd-title rd-mono">{{ b.branch }}</span>
          <span class="rd-meta">{{ b.repo }}</span>
          <span class="rd-meta">{{ b.commits }} 次提交</span>
          <span class="rd-tag" :style="tone(MR_LABEL[b.mrStatus][1])">{{ MR_LABEL[b.mrStatus][0] }}</span>
          <span class="rd-meta">{{ b.author }}</span>
          <span class="rd-meta rd-time">{{ b.updatedAt }}</span>
        </div>
      </template>

      <!-- 提测报告 -->
      <template v-else-if="activeKey === 'testReport'">
        <div v-for="r in data.testReport" :key="r.id" class="rd-row">
          <span class="rd-title rd-mono">{{ r.version }}</span>
          <span class="rd-tag" :style="tone(REPORT_LABEL[r.result][1])">{{ REPORT_LABEL[r.result][0] }}</span>
          <span class="rd-meta">用例 {{ r.casePassed }}/{{ r.caseTotal }}</span>
          <span class="rd-meta">提测人 {{ r.submitter }}</span>
          <span class="rd-meta rd-time">{{ r.submittedAt }}</span>
        </div>
      </template>

      <!-- 测试计划 -->
      <template v-else-if="activeKey === 'testPlan'">
        <div v-for="p in data.testPlan" :key="p.id" class="rd-row">
          <span class="rd-title">{{ p.name }}</span>
          <a-progress
            class="rd-progress"
            :percent="percent(p.passed + p.failed, p.total)"
            :success="{ percent: percent(p.passed, p.total) }"
            size="small"
            :show-info="false"
          />
          <span class="rd-meta">{{ p.passed + p.failed }}/{{ p.total }}<template v-if="p.failed">，失败 {{ p.failed }}</template></span>
          <span class="rd-tag" :style="tone(PLAN_LABEL[p.status][1])">{{ PLAN_LABEL[p.status][0] }}</span>
          <span class="rd-meta">{{ p.owner }}</span>
        </div>
      </template>

      <!-- 缺陷管理 -->
      <template v-else-if="activeKey === 'bug'">
        <div v-for="b in data.bug" :key="b.key" class="rd-row">
          <span class="rd-key">{{ b.key }}</span>
          <span class="rd-title">{{ b.title }}</span>
          <span class="rd-tag" :style="tone(SEVERITY_TONE[b.severity] ?? 'gray')">{{ b.severity }}</span>
          <span class="rd-tag" :style="tone(BUG_STATUS_TONE[b.status] ?? 'gray')">{{ b.status }}</span>
          <span class="rd-meta">{{ b.assignee }}</span>
        </div>
      </template>

      <!-- 线上故障 -->
      <template v-else-if="activeKey === 'incident'">
        <div v-for="i in data.incident" :key="i.id" class="rd-row">
          <span class="rd-tag rd-level" :style="tone(LEVEL_TONE[i.level] ?? 'gray')">{{ i.level }}</span>
          <span class="rd-title">{{ i.title }}</span>
          <span class="rd-tag" :style="tone(INCIDENT_TONE[i.status] ?? 'gray')">{{ i.status }}</span>
          <span class="rd-meta">持续 {{ i.duration }}</span>
          <span class="rd-meta rd-time">{{ i.occurredAt }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rd-tab-bar {
  display: flex;
  margin-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.rd-tab {
  position: relative;
  flex: 1;
  min-width: 0;
  padding: 8px 4px;
  overflow: hidden;
  font-size: 13px;
  color: #595959;
  white-space: nowrap;
  text-overflow: ellipsis;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
}
.rd-tab:hover {
  color: var(--c-primary);
}
.rd-tab.is-active {
  color: var(--c-primary);
  font-weight: 500;
}
.rd-tab.is-active::after {
  content: '';
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: -1px;
  height: 2px;
  background: var(--c-primary);
  border-radius: 1px;
}
.rd-tab-count {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: #8c8c8c;
}
.rd-tab.is-active .rd-tab-count {
  color: var(--c-primary);
}

.rd-list {
  display: flex;
  flex-direction: column;
}
.rd-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 6px 8px;
  border-bottom: 1px solid #f5f5f5;
  border-radius: 6px;
  transition: background 0.12s;
}
.rd-row:last-child {
  border-bottom: none;
}
.rd-row:hover {
  background: #fafafa;
}
.rd-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  color: #262626;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.rd-title.is-link {
  color: var(--c-primary);
}
.rd-title.is-link:hover {
  text-decoration: underline;
}
.rd-mono,
.rd-code,
.rd-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.rd-code {
  flex-shrink: 0;
  font-size: 12px;
  color: #8c8c8c;
}
.rd-key {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--c-primary);
}
.rd-meta {
  flex-shrink: 0;
  font-size: 12px;
  color: #8c8c8c;
  white-space: nowrap;
}
.rd-time {
  width: 112px;
  text-align: right;
}
.rd-tag {
  flex-shrink: 0;
  padding: 0 8px;
  font-size: 12px;
  line-height: 20px;
  border-radius: 4px;
  white-space: nowrap;
}
.rd-level {
  font-weight: 600;
}
.rd-envs {
  display: inline-flex;
  flex-shrink: 0;
  gap: 4px;
}
.rd-progress {
  flex-shrink: 0;
  width: 120px;
  margin: 0;
}

.rd-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 96px;
  font-size: 12px;
  color: #bfbfbf;
}
.rd-empty-icon {
  font-size: 22px;
  color: #d9d9d9;
}
</style>
