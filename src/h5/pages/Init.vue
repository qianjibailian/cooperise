<template>
  <div class="h5-page h5-init">
    <van-nav-bar title="选择使用方式" fixed placeholder />

    <!-- 选择：个人 / 企业 -->
    <div v-if="mode === 'choose'" class="init-cards">
      <button type="button" class="init-card" :disabled="busy" @click="choosePersonal">
        <span class="init-icon init-icon--person"><van-icon name="user-o" /></span>
        <span class="init-text">
          <span class="init-title">个人模式</span>
          <span class="init-desc">仅自己使用，无需创建组织</span>
        </span>
        <van-icon name="arrow" class="init-arrow" />
      </button>
      <button type="button" class="init-card" :disabled="busy" @click="mode = 'enterprise'">
        <span class="init-icon init-icon--enterprise"><van-icon name="friends-o" /></span>
        <span class="init-text">
          <span class="init-title">创建企业</span>
          <span class="init-desc">新建组织，你将成为管理员</span>
        </span>
        <van-icon name="arrow" class="init-arrow" />
      </button>
    </div>

    <!-- 企业名称 -->
    <van-form v-else-if="mode === 'enterprise'" class="init-form" @submit="createEnterprise">
      <van-cell-group inset>
        <van-field
          v-model="orgName"
          placeholder="企业名称"
          left-icon="shop-o"
          :rules="[{ required: true, message: '请输入企业名称' }]"
        />
      </van-cell-group>
      <div class="init-submit">
        <van-button type="primary" block round native-type="submit" :loading="busy">创建</van-button>
      </div>
      <div class="init-back">
        <button type="button" class="link-btn" @click="mode = 'choose'">← 返回</button>
      </div>
    </van-form>

    <!-- 同步进度（与网页版 InitProgress 一致：同步完成后由用户点击进入） -->
    <div v-else class="init-progress">
      <p class="init-status" :class="{ 'is-failed': progress.status === 'FAILED' }">
        <template v-if="progress.status === 'FAILED'">初始化失败</template>
        <template v-else-if="progress.status === 'SUCCESS'">初始化完成，点击下方按钮开始使用</template>
        <template v-else>正在初始化空间…</template>
      </p>
      <van-progress :percentage="percent" :color="progress.status === 'FAILED' ? 'var(--h5-danger)' : undefined" :show-pivot="false" />

      <ul class="init-steps">
        <li v-for="step in progress.steps" :key="step.key" :class="`is-${step.status.toLowerCase()}`">
          <span class="step-name">{{ step.name }}</span>
          <span class="step-state">{{ stepText(step.status) }}</span>
        </li>
      </ul>

      <div class="init-submit">
        <van-button v-if="progress.status === 'SUCCESS'" type="primary" block round @click="enter">进入空间</van-button>
        <van-button v-else-if="progress.status === 'FAILED'" block round @click="retry">重试</van-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showFailToast } from 'vant'
import { createSelfOrganization, getInitConfigProgress, startInitConfig } from '@/api/faiz'
import type { InitConfigProgress } from '@/api/types'
import { setCurrentWorkspace } from '@/utils/workspace'

const router = useRouter()

type Mode = 'choose' | 'enterprise' | 'progress'
const mode = ref<Mode>('choose')
const orgName = ref('')
const busy = ref(false)
/** 进入进度页时使用的组织编码（个人模式为空），以及切换到的工作空间 */
const orgCode = ref<string | undefined>()
const workspace = ref('personal')

const progress = reactive<InitConfigProgress>({ status: 'RUNNING', steps: [] })
const POLL_INTERVAL = 1000
let pollTimer: ReturnType<typeof setInterval> | undefined

const percent = computed(() => {
  if (progress.status === 'SUCCESS') return 100
  const steps = progress.steps || []
  if (!steps.length) return 0
  const sum = steps.reduce((acc, step) => {
    if (step.status === 'SUCCESS') return acc + 1
    if (step.total && step.total > 0) return acc + Math.min(1, (step.done ?? 0) / step.total)
    return acc
  }, 0)
  return Math.min(99, Math.round((sum / steps.length) * 100))
})

function stepText(status: string) {
  return ({ SUCCESS: '已完成', RUNNING: '进行中', FAILED: '失败' } as Record<string, string>)[status] || '等待中'
}

function applyProgress(data: InitConfigProgress) {
  progress.status = data.status
  progress.steps = data.steps || []
  progress.currentStep = data.currentStep
  progress.message = data.message
}

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = undefined
}

function syncPolling() {
  stopPolling()
  if (progress.status === 'RUNNING') pollTimer = setInterval(refresh, POLL_INTERVAL)
}

async function refresh() {
  try {
    const res = await getInitConfigProgress(orgCode.value)
    if (!res?.success || !res.data) return
    applyProgress(res.data)
    syncPolling()
  } catch {
    // 请求层已统一提示；保持轮询
  }
}

function enterProgress(code: string | undefined, ws: string) {
  orgCode.value = code
  workspace.value = ws
  mode.value = 'progress'
  applyProgress({ status: 'RUNNING', steps: [] })
  void refresh()
}

/** 个人模式：开始同步个人空间数据，然后展示进度 */
async function choosePersonal() {
  if (busy.value) return
  busy.value = true
  try {
    const res = await startInitConfig({})
    if (!res?.success || !res.data) return
    enterProgress(undefined, 'personal')
    applyProgress(res.data)
    syncPolling()
  } catch {
    // 请求层已统一提示
  } finally {
    busy.value = false
  }
}

/** 企业模式：创建组织 → 开始同步该组织的空间数据 */
async function createEnterprise() {
  const name = orgName.value.trim()
  if (!name) {
    showFailToast('请输入企业名称')
    return
  }
  if (busy.value) return
  busy.value = true
  try {
    const res = await createSelfOrganization({ organizationName: name })
    if (res?.success === false || !res?.data) return
    const org = res.data
    const started = await startInitConfig({ organizationCode: org.organizationCode })
    if (!started?.success || !started.data) return
    enterProgress(org.organizationCode, org.id ? String(org.id) : 'personal')
    applyProgress(started.data)
    syncPolling()
  } catch {
    // 请求层已统一提示
  } finally {
    busy.value = false
  }
}

/** 失败后重试（步骤可重入） */
async function retry() {
  stopPolling()
  applyProgress({ status: 'RUNNING', steps: [] })
  try {
    const res = await startInitConfig(orgCode.value ? { organizationCode: orgCode.value } : {})
    if (!res?.success || !res.data) return
    applyProgress(res.data)
    syncPolling()
  } catch {
    // 请求层已统一提示
  }
}

/** 同步完成后进入空间，与网页版一致 */
function enter() {
  setCurrentWorkspace(workspace.value)
  router.replace('/issues')
}

// 刷新页面时：若已有进行中或失败的初始化任务，直接展示进度
onMounted(async () => {
  try {
    const res = await getInitConfigProgress()
    if (res?.success && res.data && res.data.status !== 'NONE') {
      enterProgress(undefined, 'personal')
      applyProgress(res.data)
      syncPolling()
    }
  } catch {
    // 查询失败则停留在选择页
  }
})

onBeforeUnmount(stopPolling)
</script>

<style scoped>
.h5-init {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  background: var(--h5-bg);
}

.init-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 16px 0;
}

.init-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 72px;
  padding: 14px 16px;
  border: 0;
  border-radius: var(--h5-radius);
  background: var(--h5-card);
  box-shadow: var(--h5-shadow-1);
  text-align: left;
}

.init-card:disabled {
  opacity: 0.6;
}

.init-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
  color: #fff;
  font-size: 22px;
}

.init-icon--person {
  background: #34c759;
}

.init-icon--enterprise {
  background: var(--h5-primary);
}

.init-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.init-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--h5-text);
}

.init-desc {
  font-size: 13px;
  color: var(--h5-text-3);
}

.init-arrow {
  color: var(--h5-text-4);
}

.init-form {
  padding-top: 20px;
}

.init-submit {
  margin: 24px 16px 0;
}

.init-submit :deep(.van-button) {
  height: 48px;
  font-size: 16px;
}

.init-back {
  margin-top: 14px;
  text-align: center;
}

.init-progress {
  padding: 28px 16px 0;
}

.init-status {
  margin: 0 0 14px;
  font-size: 15px;
  color: var(--h5-text-2);
  text-align: center;
}

.init-status.is-failed {
  color: var(--h5-danger);
}

.init-steps {
  list-style: none;
  margin: 20px 0 0;
  padding: 0;
  background: var(--h5-card);
  border-radius: var(--h5-radius);
  box-shadow: var(--h5-shadow-1);
}

.init-steps li {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 14px;
  border-top: 0.5px solid var(--h5-border);
}

.init-steps li:first-child {
  border-top: 0;
}

.init-steps .step-state {
  color: var(--h5-text-3);
}

.init-steps .is-success .step-state {
  color: #34c759;
}

.init-steps .is-failed .step-state {
  color: var(--h5-danger);
}

.link-btn {
  padding: 4px 2px;
  border: 0;
  background: none;
  color: var(--h5-text);
  font-size: 14px;
  font-weight: 500;
}
</style>
