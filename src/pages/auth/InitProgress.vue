<template>
  <AuthLayout class="init-page" no-visual hide-lang title="初始化空间">
    <div class="init-progress">
      <p class="progress-status">
        <template v-if="progress.status === 'FAILED'">初始化失败</template>
        <template v-else-if="progress.status === 'SUCCESS'">初始化完成，点击下方按钮开始使用</template>
        <template v-else>正在初始化空间…</template>
      </p>

      <ul class="step-list">
        <li v-for="step in progress.steps" :key="step.key" class="step" :class="step.status.toLowerCase()">
          <span class="step-icon">
            <LoadingOutlined v-if="step.status === 'RUNNING'" spin />
            <CheckOutlined v-else-if="step.status === 'SUCCESS'" />
            <CloseOutlined v-else-if="step.status === 'FAILED'" />
            <span v-else class="step-dot" />
          </span>
          <span class="step-body">
            <span class="step-head">
              <span class="step-name">{{ step.name }}</span>
              <span v-if="step.total" class="step-count">{{ step.done ?? 0 }} / {{ step.total }}</span>
            </span>
            <span v-if="step.total" class="step-bar">
              <span
                class="step-bar-fill"
                :style="{ width: Math.round(((step.done ?? 0) / step.total) * 100) + '%' }"
              />
            </span>
            <span v-if="step.status === 'FAILED' && step.message" class="step-error">{{ step.message }}</span>
          </span>
        </li>
      </ul>

      <p v-if="progress.status === 'FAILED' && progress.message" class="progress-error">{{ progress.message }}</p>

      <div v-if="progress.status === 'SUCCESS'" class="progress-actions progress-actions--center">
        <button type="button" class="enter-btn" @click="enterSpace">开始你的新旅程</button>
      </div>

      <div v-if="progress.status === 'FAILED'" class="progress-actions">
        <button type="button" class="init-back" @click="router.replace('/init')">返回选择</button>
        <button type="button" class="auth-btn" @click="retry">重试</button>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import AuthLayout from './AuthLayout.vue'
import {
  getInitConfigProgress,
  startInitConfig,
  type InitConfigProgress,
} from '@/api/faiz'
import { setCurrentWorkspace } from '@/utils/workspace'

/**
 * 初始化空间进度页。
 * 查询参数：org = 企业组织编码（个人模式不传）；ws = 进入空间时切换到的工作空间（个人为 personal，企业为组织 ID）
 * 同步完成后不自动进入系统，由用户点击「进入空间」。
 */
const route = useRoute()
const router = useRouter()

const orgCode = typeof route.query.org === 'string' && route.query.org ? route.query.org : undefined
const workspace = typeof route.query.ws === 'string' && route.query.ws ? route.query.ws : 'personal'

const POLL_INTERVAL = 1000
let pollTimer: ReturnType<typeof setInterval> | undefined

const progress = ref<InitConfigProgress>({ status: 'RUNNING', steps: [] })

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = undefined
}

/** 同步完成：停止轮询，等待用户点击「进入空间」 */
function markDone() {
  stopPolling()
}

/** 用户点击「进入空间」：切换到目标工作空间并进入首页 */
function enterSpace() {
  setCurrentWorkspace(workspace)
  router.replace('/')
}

async function refresh() {
  try {
    const res = await getInitConfigProgress(orgCode)
    if (!res?.success || !res.data) return
    progress.value = res.data
    if (res.data.status !== 'RUNNING') markDone()
  } catch {
    // 请求层已统一提示；保持轮询
  }
}

/** 按当前任务状态轮询；同步已在选择模式页开始，这里只负责展示进度 */
function syncPolling() {
  stopPolling()
  if (progress.value.status === 'RUNNING') {
    pollTimer = setInterval(refresh, POLL_INTERVAL)
  }
}

async function load() {
  try {
    const res = await getInitConfigProgress(orgCode)
    if (!res?.success || !res.data) return
    progress.value = res.data
    syncPolling()
  } catch {
    // 请求层已统一提示
  }
}

/** 失败后的重试（同一目标，步骤可重入） */
async function retry() {
  stopPolling()
  progress.value = { status: 'RUNNING', steps: [] }
  try {
    const res = await startInitConfig(orgCode ? { organizationCode: orgCode } : {})
    if (!res?.success || !res.data) return
    progress.value = res.data
    syncPolling()
  } catch {
    // 错误提示由 request 拦截器统一处理
  }
}

onMounted(load)
onBeforeUnmount(stopPolling)
</script>

<style scoped>
.init-page :deep(.auth-title) {
  font-size: clamp(24px, 2.2vw, 30px);
  letter-spacing: -0.3px;
}

.init-progress {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.progress-status {
  margin: 0;
  font-size: 13px;
  color: #6e6e73;
  text-align: center;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
}

.step-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  font-size: 12px;
  border-radius: 50%;
}

.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c7c7cc;
}

.step.running .step-icon {
  color: #0052cc;
}

.step.success .step-icon {
  color: #fff;
  background: #34c759;
}

.step.failed .step-icon {
  color: #fff;
  background: #ff3b30;
}

.step-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.step-name {
  font-size: 14px;
  color: #1d1d1f;
}

.step-count {
  font-size: 12px;
  color: #86868b;
  font-variant-numeric: tabular-nums;
}

.step-bar {
  display: block;
  height: 4px;
  overflow: hidden;
  background: #f0f0f3;
  border-radius: 2px;
}

.step-bar-fill {
  display: block;
  height: 100%;
  background: #0052cc;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.step-error {
  font-size: 12px;
  color: #ff3b30;
  word-break: break-all;
}

.progress-error {
  margin: 0;
  font-size: 13px;
  color: #ff3b30;
  word-break: break-all;
}

.progress-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.progress-actions--center {
  justify-content: center;
}

.init-back {
  margin: 0;
  padding: 0;
  font-size: 13px;
  color: #6e6e73;
  background: none;
  border: none;
  cursor: pointer;
}

.progress-actions .auth-btn {
  width: auto;
  padding: 0 24px;
}

/* 进入空间：高亮主按钮 */
.enter-btn {
  min-width: 200px;
  height: 46px;
  padding: 0 28px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: #0052cc;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(0, 82, 204, 0.28);
  transition: background 0.15s, box-shadow 0.15s;
}

.enter-btn:hover {
  background: #0065ff;
  box-shadow: 0 8px 20px rgba(0, 101, 255, 0.32);
}
</style>
