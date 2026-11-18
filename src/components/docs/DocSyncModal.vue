<template>
  <!-- 知识库仓库同步（GitLab）：绑定仓库目录、凭证、编辑权限，并显示 Webhook 配置与同步状态 -->
  <a-modal
    :open="open"
    title="知识库设置"
    :width="560"
    centered
    destroy-on-close
    @cancel="emit('update:open', false)"
  >
    <a-spin :spinning="loading">
      <div class="sync-section-title">Git 仓库同步</div>
      <div v-if="testResult" :class="['sync-test-result', testResult.ok ? 'is-ok' : 'is-fail']">
        {{ testResult.ok ? '✓ ' : '✕ ' }}{{ testResult.message }}
        <span v-if="testResult.ok && testResult.commit"> · 分支最新提交 {{ testResult.commit.slice(0, 8) }}</span>
      </div>
      <a-form layout="vertical" class="sync-form">
        <a-form-item label="仓库地址" required>
          <a-input v-model:value="form.gitlabUrl" placeholder="https://gitlab.company.com/group/project" />
        </a-form-item>
        <div class="sync-row">
          <a-form-item label="分支" required class="sync-row-branch">
            <a-input v-model:value="form.branch" placeholder="main" />
          </a-form-item>
          <a-form-item label="子目录（留空 = 仓库根目录）" class="sync-row-subdir">
            <a-input v-model:value="form.subdir" placeholder="docs/" />
          </a-form-item>
        </div>
        <a-form-item :label="hasToken ? '访问凭证（已保存，留空则沿用）' : '访问凭证'" :required="!hasToken">
          <a-input-password v-model:value="form.token" :placeholder="hasToken ? '••••••••（不修改请留空）' : 'Project Access Token（read_repository）'" />
        </a-form-item>
        <a-form-item label="云文档中允许编辑">
          <a-switch v-model:checked="form.editable" />
          <span class="sync-hint">{{ form.editable ? '可编辑：编辑后保存在云文档，提交回仓库的功能后续开放' : '只读：同步来的文档不能在云文档里修改' }}</span>
        </a-form-item>
        <a-form-item label="启用同步">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
      </a-form>

      <div v-if="config?.configured" class="sync-status">
        <div class="sync-status-row">
          <span class="sync-label">同步状态</span>
          <span :class="['sync-badge', `is-${config.status || 'idle'}`]">{{ statusText }}</span>
          <a-button size="small" :disabled="!config.enabled" :loading="running" @click="runNow">立即同步</a-button>
        </div>
        <div class="sync-meta">
          上次同步：{{ config.lastSyncedAt ? fmt(config.lastSyncedAt) : '—' }}
          <template v-if="config.lastCommit"> · 提交 {{ config.lastCommit.slice(0, 8) }}</template>
        </div>
        <div v-if="config.lastError" class="sync-error">{{ config.lastError }}</div>

        <div class="sync-webhook">
          <div class="sync-label">GitLab Webhook（项目 → Settings → Webhooks）</div>
          <div class="sync-meta">URL：<code>{{ webhookUrl }}</code></div>
          <div class="sync-meta">Secret token：<code>{{ config.webhookSecret }}</code></div>
          <div class="sync-meta">触发事件选择 Push events，并勾选对应分支。</div>
        </div>
      </div>
      <DocSyncBoard v-if="config?.configured" :library-id="libraryId" :active="open" />
    </a-spin>
    <template #footer>
      <div class="sync-footer">
        <a-button :loading="testing" @click="testConn">测试连接</a-button>
        <span class="sync-footer-right">
          <a-button @click="emit('update:open', false)">取消</a-button>
          <a-button type="primary" :loading="saving" @click="submit">保存</a-button>
        </span>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { getDocSync, runDocSync, saveDocSync, testDocSync, type DocSyncConfig } from '@/api/docs'
import DocSyncBoard from '@/components/docs/DocSyncBoard.vue'

const props = defineProps<{ open: boolean; libraryId: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const loading = ref(false)
const saving = ref(false)
const running = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string; commit?: string } | null>(null)
const config = ref<DocSyncConfig | null>(null)

const form = reactive({
  gitlabUrl: '',
  branch: 'main',
  subdir: '',
  token: '',
  editable: false,
  enabled: true,
})

const hasToken = computed(() => !!config.value?.hasToken)

/** Webhook 地址：前端站点的 /api 前缀 + 后端接口 */
const webhookUrl = computed(() => `${window.location.origin}/api/docs/sync/webhook/${props.libraryId}`)

const STATUS_TEXT: Record<string, string> = {
  idle: '未同步',
  running: '同步中',
  done: '已同步',
  failed: '同步失败',
}
const statusText = computed(() => STATUS_TEXT[config.value?.status || 'idle'] || '未同步')

function fmt(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function load() {
  loading.value = true
  try {
    const res = await getDocSync(props.libraryId)
    if (!res.success || !res.data) return
    config.value = res.data
    const c = res.data
    form.gitlabUrl = c.configured && c.projectPath ? `${c.gitlabUrl}/${c.projectPath}` : ''
    form.branch = c.branch || 'main'
    form.subdir = c.subdir || ''
    form.token = ''
    form.editable = !!c.editable
    form.enabled = c.configured ? !!c.enabled : true
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void load()
  },
)

/** 先保存表单（校验 + 写入配置）；成功返回 true。保存不会触发同步，同步由调用方在保存成功后发起 */
async function saveForm(): Promise<boolean> {
  if (!form.gitlabUrl.trim() || !form.branch.trim()) {
    message.warning('请填写仓库地址和分支')
    return false
  }
  if (!hasToken.value && !form.token.trim()) {
    message.warning('请填写访问凭证')
    return false
  }
  try {
    const res = await saveDocSync({
      libraryId: props.libraryId,
      gitlabUrl: form.gitlabUrl.trim(),

      branch: form.branch.trim(),
      subdir: form.subdir.trim(),
      token: form.token.trim() || undefined,
      editable: form.editable,
      enabled: form.enabled,
    })
    return !!res.success
  } catch {
    message.error('保存失败')
    return false
  }
}

/** 先保存，保存成功后再发起同步 */
async function syncNow(): Promise<boolean> {
  try {
    const res = await runDocSync(props.libraryId)
    return !!res.success
  } catch {
    message.error('同步启动失败')
    return false
  }
}

/** 「保存」：只保存设置，不同步；保存成功后关闭弹窗 */
async function submit() {
  saving.value = true
  try {
    if (await saveForm()) {
      message.success('设置已保存')
      emit('update:open', false)
    }
  } finally {
    saving.value = false
  }
}

/** 「测试连接」：用表单当前值校验地址、凭证、项目与分支（凭证留空则沿用已保存的），不保存不同步 */
async function testConn() {
  if (!form.gitlabUrl.trim() || !form.branch.trim()) {
    message.warning('请先填写仓库地址和分支')
    return
  }
  testing.value = true
  try {
    const res = await testDocSync({
      libraryId: props.libraryId,
      gitlabUrl: form.gitlabUrl.trim(),

      branch: form.branch.trim(),
      subdir: form.subdir.trim(),
      token: form.token.trim() || undefined,
      editable: form.editable,
      enabled: form.enabled,
    })
    testResult.value = res.data ?? { ok: false, message: '测试失败' }
  } catch {
    testResult.value = { ok: false, message: '测试失败，请检查网络或服务端状态' }
  } finally {
    testing.value = false
  }
}

/** 「立即同步」：先保存当前设置，再同步，弹窗保持打开并刷新同步状态 */
async function runNow() {
  running.value = true
  try {
    if (!(await saveForm())) return
    if (await syncNow()) message.success('已保存并开始同步，稍后刷新查看结果')
    await load()
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.sync-section-title {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}
.sync-form :deep(.ant-form-item) {
  margin-bottom: 14px;
}
.sync-row {
  display: flex;
  gap: 12px;
}
.sync-row-branch {
  width: 160px;
}
.sync-row-subdir {
  flex: 1;
  min-width: 0;
}
.sync-hint {
  margin-left: 10px;
  font-size: 12px;
  color: #8f959e;
}
.sync-status {
  margin-top: 8px;
  padding-top: 14px;
  border-top: 1px solid #ebedf0;
}
.sync-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sync-label {
  font-size: 13px;
  color: #1f2329;
  font-weight: 500;
}
.sync-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f2f3f5;
  color: #646a73;
}
.sync-badge.is-done {
  background: #e8f7ec;
  color: #248a3d;
}
.sync-badge.is-running {
  background: #e8f1ff;
  color: #3370ff;
}
.sync-badge.is-failed {
  background: #fdecec;
  color: #d70015;
}
.sync-meta {
  margin-top: 6px;
  font-size: 12px;
  color: #8f959e;
  word-break: break-all;
}
.sync-meta code {
  color: #1f2329;
}
.sync-error {
  margin-top: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: #d70015;
  background: #fdecec;
  border-radius: 6px;
  word-break: break-all;
}
.sync-webhook {
  margin-top: 14px;
}
.sync-test-result {
  margin: -4px 0 14px;
  padding: 8px 10px;
  font-size: 13px;
  border-radius: 6px;
  word-break: break-all;
}
.sync-test-result.is-ok {
  color: #248a3d;
  background: #e8f7ec;
}
.sync-test-result.is-fail {
  color: #d70015;
  background: #fdecec;
}
.sync-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sync-footer-right {
  display: inline-flex;
  gap: 8px;
}
</style>
