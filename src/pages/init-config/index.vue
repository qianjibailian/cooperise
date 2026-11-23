<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <h2 class="mgmt-title">初始化配置</h2>
    </header>

    <a-tabs v-model:activeKey="activeTab" class="init-tabs">
      <a-tab-pane key="PERSONAL" tab="个人配置" />
      <a-tab-pane key="ENTERPRISE" tab="企业配置" />
      <a-tab-pane key="TASKS" tab="同步任务" />
    </a-tabs>

    <section v-if="activeTab === 'PERSONAL'" class="mgmt-card">
      <div class="module-title">个人空间模板</div>
      <p class="module-desc">新用户选择个人模式时，从这个空间复制数据到个人空间</p>
      <a-form layout="vertical" class="config-form">
        <a-form-item label="模板空间">
          <a-select
            v-model:value="personalSelected"
            show-search
            allow-clear
            :options="spaceOptions"
            :loading="loading"
            :filter-option="filterSpace"
            placeholder="选择个人空间模板"
          />
          <div class="hint">
            <span v-if="config.personal?.fromDefault">当前使用配置文件默认值</span>
            <span v-else-if="config.personal?.spaceName">当前：{{ config.personal.spaceName }}</span>
          </div>
        </a-form-item>
        <div class="actions">
          <a-button type="primary" :loading="saving" @click="save">保存</a-button>
        </div>
      </a-form>
    </section>

    <section v-else-if="activeTab === 'ENTERPRISE'" class="mgmt-card">
      <div class="module-title">企业默认空间模板</div>
      <p class="module-desc">新用户创建企业时，从这个空间复制数据到企业默认空间</p>
      <a-form layout="vertical" class="config-form">
        <a-form-item label="模板空间">
          <a-select
            v-model:value="enterpriseSelected"
            show-search
            allow-clear
            :options="spaceOptions"
            :loading="loading"
            :filter-option="filterSpace"
            placeholder="选择企业默认空间模板"
          />
          <div class="hint">
            <span v-if="config.enterprise?.fromDefault">当前使用配置文件默认值</span>
            <span v-else-if="config.enterprise?.spaceName">当前：{{ config.enterprise.spaceName }}</span>
          </div>
        </a-form-item>
        <div class="actions">
          <a-button type="primary" :loading="saving" @click="save">保存</a-button>
        </div>
      </a-form>
    </section>

    <section v-else class="mgmt-card task-card">
      <div class="task-header">
        <div>
          <h3 class="task-title">同步任务</h3>
          <p class="task-desc">每个用户、每个目标（个人或企业）的初始化记录，包含各步骤进度和失败原因</p>
        </div>
        <div class="task-tools">
          <a-segmented v-model:value="taskStatus" :options="STATUS_FILTERS" @change="loadTasks" />
          <a-button :loading="tasksLoading" @click="loadTasks">刷新</a-button>
        </div>
      </div>

      <a-table
        :columns="taskColumns"
        :data-source="tasks"
        :loading="tasksLoading"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 1000 }"
        :expand-row-by-click="true"
        :expanded-row-keys="expandedKeys"
        @expand="onExpand"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'user'">
            <div class="user-cell">
              <span class="user-name">{{ record.userName || record.memberId }}</span>
              <span class="user-id">{{ record.memberId }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'target'">
            <a-tag v-if="record.targetKey === 'PERSONAL'" color="green">个人</a-tag>
            <a-tag v-else color="blue">企业 {{ record.targetKey.replace('ORG:', '') }}</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="STATUS_COLOR[record.status] || 'default'">{{ STATUS_TEXT[record.status] || record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'step'">
            <span class="muted">{{ stepNameOf(record) }}</span>
          </template>
          <template v-else-if="column.key === 'progress'">
            <span class="muted">{{ progressOf(record) }}</span>
          </template>
          <template v-else-if="column.key === 'space'">
            <span class="muted">{{ record.spaceCode || '-' }}</span>
          </template>
          <template v-else-if="column.key === 'updateTime'">
            <span class="muted">{{ formatTime(record.updateTime) }}</span>
          </template>
          <template v-else-if="column.key === 'error'">
            <span v-if="record.errorMsg" class="error-text" :title="record.errorMsg">{{ record.errorMsg }}</span>
            <span v-else class="muted">-</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="record.status === 'FAILED'"
              size="small"
              type="primary"
              :loading="retryingId === record.id"
              @click.stop="retryTask(record)"
            >
              重试
            </a-button>
          </template>
        </template>

        <template #expandedRowRender="{ record }">
          <ul class="step-list">
            <li v-for="step in record.steps" :key="step.key" class="step-item">
              <span class="step-tag" :class="step.status.toLowerCase()">{{ STEP_STATUS_TEXT[step.status] || step.status }}</span>
              <span class="step-name">{{ step.name }}</span>
              <span v-if="step.total" class="muted">{{ step.done ?? 0 }} / {{ step.total }}</span>
              <span v-if="step.status === 'FAILED' && step.message" class="error-text">{{ step.message }}</span>
            </li>
          </ul>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  getInitConfigSettings,
  getInitConfigTasks,
  querySpaceOptions,
  retryInitConfigTask,
  saveInitConfigSettings,
  type InitConfigSettings,
  type InitConfigTask,
} from '@/api/faiz'

const loading = ref(false)
const saving = ref(false)
const config = ref<InitConfigSettings>({})
const personalSelected = ref<string | undefined>()
const enterpriseSelected = ref<string | undefined>()
const spaceOptions = ref<{ value: string; label: string }[]>([])

// ---- 模块切换：个人 / 企业 ----
const activeTab = ref<'PERSONAL' | 'ENTERPRISE' | 'TASKS'>('PERSONAL')

// ---- 同步任务（第三个页签，列出所有目标）----
const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
]
const STATUS_TEXT: Record<string, string> = { RUNNING: '进行中', SUCCESS: '成功', FAILED: '失败' }
const STATUS_COLOR: Record<string, string> = { RUNNING: 'processing', SUCCESS: 'success', FAILED: 'error' }
const STEP_STATUS_TEXT: Record<string, string> = { PENDING: '待执行', RUNNING: '执行中', SUCCESS: '完成', FAILED: '失败' }

const taskColumns = [
  { title: '用户', key: 'user', width: 200 },
  { title: '目标', key: 'target', width: 120 },
  { title: '状态', key: 'status', width: 90 },
  { title: '当前步骤', key: 'step', width: 120 },
  { title: '进度', key: 'progress', width: 100 },
  { title: '空间编码', key: 'space', width: 130 },
  { title: '更新时间', key: 'updateTime', width: 160 },
  { title: '失败原因', key: 'error', ellipsis: true },
  { title: '操作', key: 'action', width: 90, fixed: 'right' as const },
]

const taskStatus = ref<string>('all')
const tasks = ref<InitConfigTask[]>([])
const tasksLoading = ref(false)
const expandedKeys = ref<number[]>([])
let pollTimer: ReturnType<typeof setInterval> | undefined

const hasRunning = computed(() => tasks.value.some((t) => t.status === 'RUNNING'))

async function loadTasks() {
  tasksLoading.value = true
  try {
    const res = await getInitConfigTasks({
      status: taskStatus.value === 'all' ? undefined : taskStatus.value,
      limit: 100,
    })
    if (res?.success) tasks.value = res.data || []
  } catch {
    // 请求层已统一提示
  } finally {
    tasksLoading.value = false
  }
}

/** 手动重试失败的任务：后端沿用原目标（个人或对应企业）重新执行，步骤可重入 */
const retryingId = ref<number | null>(null)
async function retryTask(record: InitConfigTask) {
  retryingId.value = record.id
  try {
    const res = await retryInitConfigTask(record.id)
    if (res?.success) {
      message.success('已开始重试')
      await loadTasks()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    retryingId.value = null
  }
}

function onExpand(expanded: boolean, record: InitConfigTask) {
  expandedKeys.value = expanded
    ? [...expandedKeys.value, record.id]
    : expandedKeys.value.filter((k) => k !== record.id)
}

function stepNameOf(task: InitConfigTask) {
  const step = task.steps.find((s) => s.key === task.currentStep)
  if (task.status === 'SUCCESS') return '已完成'
  return step ? step.name : '-'
}

/** 当前步骤的进度（有计数的步骤） */
function progressOf(task: InitConfigTask) {
  const step = task.steps.find((s) => s.key === task.currentStep)
  if (step?.total) return `${step.done ?? 0} / ${step.total}`
  return '-'
}

function formatTime(v?: string) {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 仅在「同步任务」页签内、有进行中的任务时每 3 秒刷新一次 */
function syncPolling() {
  clearInterval(pollTimer)
  pollTimer = activeTab.value === 'TASKS' && hasRunning.value ? setInterval(loadTasks, 3000) : undefined
}
watch(hasRunning, syncPolling)

/** 切换页签：进入任务页签时加载任务并启停轮询，离开时停止轮询 */
watch(activeTab, (tab) => {
  expandedKeys.value = []
  if (tab === 'TASKS') loadTasks()
  syncPolling()
})

async function loadSpaces() {
  loading.value = true
  try {
    const res = await querySpaceOptions()
    if (res?.success) {
      spaceOptions.value = (res.data || []).map((s) => ({
        value: s.spaceCode,
        label: `${s.spaceName}（${s.spaceCode}）`,
      }))
    }
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

async function loadConfig() {
  try {
    const res = await getInitConfigSettings()
    if (res?.success && res.data) {
      config.value = res.data
      personalSelected.value = res.data.personal?.spaceCode || undefined
      enterpriseSelected.value = res.data.enterprise?.spaceCode || undefined
    }
  } catch {
    // 请求层已统一提示
  }
}

async function save() {
  saving.value = true
  try {
    const res = await saveInitConfigSettings({
      personalSpaceCode: personalSelected.value ?? '',
      enterpriseSpaceCode: enterpriseSelected.value ?? '',
    })
    if (res?.success && res.data) {
      config.value = res.data
      personalSelected.value = res.data.personal?.spaceCode || undefined
      enterpriseSelected.value = res.data.enterprise?.spaceCode || undefined
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

function filterSpace(input: string, option?: { label?: string }) {
  return String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
}

onMounted(() => {
  loadSpaces()
  loadConfig()
})

onBeforeUnmount(() => clearInterval(pollTimer))
</script>

<style scoped>
.mgmt-page {
  padding: 20px 24px 32px;
  background: #fff;
}

.mgmt-header {
  margin-bottom: 16px;
}

.mgmt-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
}

.init-tabs {
  max-width: 1100px;
  margin-bottom: 8px;
}

.module-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.module-desc {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.6;
  color: #6e6e73;
}

.mgmt-card {
  max-width: 760px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mgmt-card + .mgmt-card {
  margin-top: 16px;
}

.task-card {
  max-width: 1100px;
}

.task-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.task-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.task-desc {
  margin: 0;
  font-size: 12px;
  color: #86868b;
}

.task-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-cell {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 13px;
  color: #1d1d1f;
}

.user-id {
  font-size: 11px;
  color: #86868b;
}

.muted {
  font-size: 12px;
  color: #6e6e73;
}

.error-text {
  font-size: 12px;
  color: #ff3b30;
  word-break: break-all;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.step-tag {
  min-width: 56px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  border-radius: 4px;
  background: #f0f0f3;
  color: #6e6e73;
}

.step-tag.success {
  background: #e6f7ec;
  color: #1f8f4a;
}

.step-tag.running {
  background: #e6f0ff;
  color: #0052cc;
}

.step-tag.failed {
  background: #ffe9e7;
  color: #ff3b30;
}

.step-name {
  color: #1d1d1f;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.hint {
  font-size: 12px;
  color: #86868b;
}

@media (max-width: 768px) {
  .mgmt-page {
    padding: 16px;
  }
}
</style>
