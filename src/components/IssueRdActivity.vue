<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { mockRdActivity, type RdActivityMock } from '@/mock/issueRdActivity'

/**
 * 事项研发活动：按类别分 tab 展示（接口未接入，暂用 mock 数据）。
 * 版式统一：左侧「名称 + 次要信息」，右侧固定列「状态标签 + 时间 / 指标」；线形 tab，无外框。
 */
const props = defineProps<{ issueKey: string }>()

type TabKey = Exclude<keyof RdActivityMock, 'doc'>

const TABS: { key: TabKey; label: string; empty: string }[] = [
  { key: 'app', label: '应用名称', empty: '暂无关联的应用' },
  { key: 'branch', label: '代码分支', empty: '暂无关联的代码分支' },
  { key: 'testReport', label: '提测报告', empty: '暂无提测报告' },
  { key: 'testPlan', label: '测试计划', empty: '暂无关联的测试计划' },
  { key: 'bug', label: '缺陷管理', empty: '暂无关联的缺陷' },
  { key: 'incident', label: '线上故障', empty: '暂无关联的线上故障' },
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

// ---------- 标签色（文字色 + 浅底） ----------
type Tone = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'purple'
const TONE: Record<Tone, { color: string; bg: string }> = {
  blue: { color: '#0052d9', bg: '#f2f3ff' },
  green: { color: '#008858', bg: '#e3f9e9' },
  orange: { color: '#be5a00', bg: '#fff1e9' },
  red: { color: '#d54941', bg: '#fff0ed' },
  gray: { color: '#5e6066', bg: '#f3f3f3' },
  purple: { color: '#7d43d8', bg: '#f4eefd' },
}
const tone = (t: Tone) => ({ '--tone': TONE[t].color, '--tone-bg': TONE[t].bg })

const MR_LABEL = { OPEN: ['进行中', 'blue'], MERGED: ['已合并', 'purple'], CLOSED: ['已关闭', 'gray'] } as const
const REPORT_LABEL = { PASS: ['提测通过', 'green'], REJECT: ['打回', 'red'], TESTING: ['测试中', 'blue'] } as const
const PLAN_LABEL = { NOT_STARTED: ['未开始', 'gray'], IN_PROGRESS: ['进行中', 'blue'], DONE: ['已完成', 'green'] } as const
const SEVERITY_TONE: Record<string, Tone> = { 致命: 'red', 严重: 'orange', 一般: 'blue', 提示: 'gray' }
const BUG_STATUS_TONE: Record<string, Tone> = { 待修复: 'red', 修复中: 'blue', 待验证: 'orange', 已关闭: 'gray' }
const LEVEL_TONE: Record<string, Tone> = { P0: 'red', P1: 'orange', P2: 'blue', P3: 'gray' }
const INCIDENT_TONE: Record<string, Tone> = { 处理中: 'red', 已恢复: 'green', 已复盘: 'gray' }

/** 应用的部署环境顺序 */
const ENVS = ['DEV', 'TEST', 'PROD'] as const

const percent = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}
</script>

<template>
  <div class="rd">
    <div class="rd-tabs" role="tablist">
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

    <div v-if="!countOf(activeKey)" class="rd-empty">{{ activeTab.empty }}</div>

    <ul v-else class="rd-list">
      <!-- 应用名称 -->
      <template v-if="activeKey === 'app'">
        <li v-for="a in data.app" :key="a.id" class="rd-item">
          <div class="rd-main">
            <div class="rd-title">{{ a.name }}</div>
            <div class="rd-meta">
              <span>{{ a.code }}</span>
              <span>负责人 {{ a.owner }}</span>
            </div>
          </div>
          <!-- 部署环境：DEV → TEST → PROD，已部署的点亮 -->
          <ol class="rd-envs" :aria-label="`已部署：${a.envs.join('、') || '无'}`">
            <li v-for="e in ENVS" :key="e" class="rd-env" :class="{ 'is-on': a.envs.includes(e) }">
              <span class="rd-env-dot" />
              <span class="rd-env-name">{{ e }}</span>
            </li>
          </ol>
        </li>
      </template>

      <!-- 代码分支 -->
      <template v-else-if="activeKey === 'branch'">
        <li v-for="b in data.branch" :key="b.id" class="rd-item">
          <div class="rd-main">
            <div class="rd-title-row">
              <span class="rd-title" :title="b.branch">{{ b.branch }}</span>
              <button type="button" class="rd-copy" title="复制分支名" @click="copy(b.branch)"><CopyOutlined /></button>
            </div>
            <div class="rd-meta">
              <span>{{ b.repo }}</span>
              <span>{{ b.commits }} 次提交</span>
              <span>{{ b.author }}</span>
            </div>
          </div>
          <div class="rd-side">
            <span class="rd-tag" :style="tone(MR_LABEL[b.mrStatus][1])">{{ MR_LABEL[b.mrStatus][0] }}</span>
            <span class="rd-side-sub">{{ b.updatedAt }}</span>
          </div>
        </li>
      </template>

      <!-- 提测报告 -->
      <template v-else-if="activeKey === 'testReport'">
        <li v-for="r in data.testReport" :key="r.id" class="rd-item">
          <div class="rd-main">
            <div class="rd-title">{{ r.version }}</div>
            <div class="rd-meta">
              <span>提测人 {{ r.submitter }}</span>
              <span>{{ r.submittedAt }}</span>
            </div>
          </div>
          <div class="rd-side">
            <span class="rd-tag" :style="tone(REPORT_LABEL[r.result][1])">{{ REPORT_LABEL[r.result][0] }}</span>
            <span class="rd-side-sub">用例 {{ r.casePassed }}/{{ r.caseTotal }} · <b>{{ percent(r.casePassed, r.caseTotal) }}%</b></span>
          </div>
        </li>
      </template>

      <!-- 测试计划 -->
      <template v-else-if="activeKey === 'testPlan'">
        <li v-for="p in data.testPlan" :key="p.id" class="rd-item">
          <div class="rd-main">
            <div class="rd-title">{{ p.name }}</div>
            <div class="rd-meta">
              <span>负责人 {{ p.owner }}</span>
              <span>已执行 {{ p.passed + p.failed }}/{{ p.total }}</span>
              <span v-if="p.failed" class="rd-fail">失败 {{ p.failed }}</span>
            </div>
          </div>
          <div class="rd-side">
            <span class="rd-tag" :style="tone(PLAN_LABEL[p.status][1])">{{ PLAN_LABEL[p.status][0] }}</span>
            <span class="rd-progress" :title="`通过 ${p.passed} · 失败 ${p.failed} · 未执行 ${p.total - p.passed - p.failed}`">
              <span class="rd-bar">
                <span class="rd-bar-pass" :style="{ width: `${percent(p.passed, p.total)}%` }" />
                <span class="rd-bar-fail" :style="{ width: `${percent(p.failed, p.total)}%` }" />
              </span>
              <span class="rd-side-sub">{{ percent(p.passed + p.failed, p.total) }}%</span>
            </span>
          </div>
        </li>
      </template>

      <!-- 缺陷管理 -->
      <template v-else-if="activeKey === 'bug'">
        <li v-for="b in data.bug" :key="b.key" class="rd-item" :class="{ 'is-closed': b.status === '已关闭' }">
          <div class="rd-main">
            <div class="rd-title" :title="b.title">{{ b.title }}</div>
            <div class="rd-meta">
              <span>{{ b.key }}</span>
              <span class="rd-severity" :style="tone(SEVERITY_TONE[b.severity] ?? 'gray')">{{ b.severity }}</span>
              <span>{{ b.assignee }}</span>
            </div>
          </div>
          <div class="rd-side">
            <span class="rd-tag" :style="tone(BUG_STATUS_TONE[b.status] ?? 'gray')">{{ b.status }}</span>
          </div>
        </li>
      </template>

      <!-- 线上故障 -->
      <template v-else-if="activeKey === 'incident'">
        <li v-for="i in data.incident" :key="i.id" class="rd-item">
          <div class="rd-main">
            <div class="rd-title-row">
              <span class="rd-level" :style="tone(LEVEL_TONE[i.level] ?? 'gray')">{{ i.level }}</span>
              <span class="rd-title" :title="i.title">{{ i.title }}</span>
            </div>
            <div class="rd-meta">
              <span>{{ i.id }}</span>
              <span>{{ i.occurredAt }}</span>
            </div>
          </div>
          <div class="rd-side">
            <span class="rd-tag" :style="tone(INCIDENT_TONE[i.status] ?? 'gray')">{{ i.status }}</span>
            <span class="rd-side-sub">{{ /^\d/.test(i.duration) ? `持续 ${i.duration}` : '持续中' }}</span>
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>

<style scoped>
.rd {
  /* 名称色：主题色压暗一点，避免整列亮蓝像一排链接 */
  --rd-name: color-mix(in srgb, var(--c-primary, #0a84ff) 78%, #0b1a33);
  --rd-text: #1f2329;
  --rd-sub: #646a73;
  --rd-faint: #8f959e;
  --rd-split: #f0f1f3;
  font-size: 13px;
  color: var(--rd-text);
}

/* ---------- 线形 tab ---------- */
.rd-tabs {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  border-bottom: 1px solid var(--rd-split);
  scrollbar-width: none;
}
.rd-tabs::-webkit-scrollbar {
  display: none;
}
.rd-tab {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 0;
  font-size: 13px;
  color: var(--rd-sub);
  white-space: nowrap;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
}
.rd-tab:hover {
  color: var(--rd-text);
}
.rd-tab:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
  border-radius: 2px;
}
.rd-tab.is-active {
  color: var(--c-primary);
  font-weight: 500;
}
.rd-tab.is-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--c-primary);
  border-radius: 1px;
}
.rd-tab-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--rd-faint);
  font-variant-numeric: tabular-nums;
}
.rd-tab.is-active .rd-tab-count {
  color: inherit;
  opacity: 0.75;
}

/* ---------- 列表 ---------- */
.rd-list {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}
.rd-item {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 -8px;
  padding: 12px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}
.rd-item + .rd-item {
  box-shadow: inset 0 1px 0 var(--rd-split);
}
.rd-item:hover {
  background: #f7f8fa;
  box-shadow: none;
}
.rd-item:hover + .rd-item {
  box-shadow: none;
}

.rd-main {
  flex: 1;
  min-width: 0;
}
.rd-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.rd-title {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  color: var(--rd-name);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.rd-item.is-closed .rd-title {
  color: var(--rd-faint);
}

/* 次要信息：12px 灰色，用「·」分隔 */
.rd-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 2px;
  font-size: 12px;
  line-height: 20px;
  color: var(--rd-faint);
  font-variant-numeric: tabular-nums;
}
.rd-meta > * + *::before {
  content: '·';
  margin: 0 6px;
  color: #c9cdd4;
}
.rd-severity {
  color: var(--tone);
}
.rd-fail {
  color: #d54941;
}

.rd-copy {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 12px;
  color: var(--rd-faint);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}
.rd-item:hover .rd-copy,
.rd-copy:focus-visible {
  opacity: 1;
}
.rd-copy:hover {
  color: var(--c-primary);
}

.rd-level {
  flex-shrink: 0;
  padding: 0 5px;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  color: var(--tone);
  background: var(--tone-bg);
  border-radius: 4px;
}

/* ---------- 右侧固定列：状态 + 时间 / 指标 ---------- */
.rd-side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 112px;
}
.rd-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--tone);
  white-space: nowrap;
  background: var(--tone-bg);
  border-radius: 4px;
}
.rd-side-sub {
  font-size: 12px;
  line-height: 20px;
  color: var(--rd-faint);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.rd-side-sub b {
  font-weight: 500;
  color: var(--rd-text);
}
.rd-progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.rd-bar {
  display: flex;
  width: 72px;
  height: 4px;
  overflow: hidden;
  background: #eff0f2;
  border-radius: 2px;
}
.rd-bar-pass {
  background: #2ba471;
}
.rd-bar-fail {
  background: #d54941;
}

/* ---------- 部署环境轨道 ---------- */
.rd-envs {
  flex-shrink: 0;
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rd-env {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 44px;
}
.rd-env + .rd-env::before {
  content: '';
  position: absolute;
  top: 3px;
  right: 50%;
  width: 100%;
  height: 1px;
  background: #e3e5e8;
}
.rd-env.is-on + .rd-env.is-on::before {
  background: #2ba471;
}
.rd-env-dot {
  position: relative;
  z-index: 1;
  width: 7px;
  height: 7px;
  background: #fff;
  border: 1px solid #c9cdd4;
  border-radius: 50%;
}
.rd-env.is-on .rd-env-dot {
  background: #2ba471;
  border-color: #2ba471;
}
.rd-env-name {
  font-size: 12px;
  line-height: 16px;
  color: #c9cdd4;
}
.rd-env.is-on .rd-env-name {
  color: var(--rd-sub);
}

/* ---------- 空态 ---------- */
.rd-empty {
  padding: 32px 0;
  font-size: 12px;
  text-align: center;
  color: var(--rd-faint);
}

@media (max-width: 576px) {
  .rd-side {
    min-width: 0;
  }
  .rd-bar {
    width: 48px;
  }
}
</style>
