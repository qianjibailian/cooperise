<template>
  <a-modal
    :open="open"
    title="客户端设置"
    :width="480"
    ok-text="保存并重新加载"
    cancel-text="取消"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !dirty }"
    @ok="save"
    @cancel="emit('update:open', false)"
  >
    <div class="ds-body">
      <div class="ds-field">
        <div class="ds-label">后端地址</div>
        <a-input v-model:value="apiTarget" placeholder="http://localhost:8080" allow-clear @press-enter="save" />
        <div class="ds-hint">
          客户端的接口请求都会转发到这个地址。
          <a v-if="info && apiTarget !== info.defaultApiTarget" @click="apiTarget = info.defaultApiTarget">恢复默认（{{ info.defaultApiTarget }}）</a>
        </div>
      </div>

      <div class="ds-meta">
        <div class="ds-row">
          <span>开机自启动</span>
          <a-tooltip :title="autoStart.supported ? (isMacDesktop ? '登录 macOS 后自动打开客户端（最小化到 Dock）' : '登录 Windows 后自动打开客户端（最小化到任务栏）') : '仅安装版客户端支持'">
            <a-switch
              size="small"
              :checked="autoStart.enabled"
              :disabled="!autoStart.supported"
              :loading="autoStartSaving"
              @change="onAutoStartChange"
            />
          </a-tooltip>
        </div>
      </div>

      <div class="ds-meta">
        <div class="ds-row"><span>版本</span><span>v{{ info?.version }}</span></div>
        <div class="ds-row"><span>配置文件</span><a @click="desktop?.openConfigDir()">{{ isMacDesktop ? '在访达中显示' : '打开所在目录' }}</a></div>
        <div class="ds-row"><span>开发者工具</span><a @click="desktop?.toggleDevTools()">打开 / 关闭（{{ isMacDesktop ? '⌥⌘I' : 'F12' }}）</a></div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { desktop, isMacDesktop, type DesktopInfo } from '@/utils/desktop'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const info = ref<DesktopInfo | null>(null)
const apiTarget = ref('')
const saving = ref(false)
const dirty = computed(() => !!info.value && apiTarget.value.trim() !== info.value.apiTarget)

// ---------- 开机自启动：开关即时生效，无需点保存 ----------
const autoStart = ref({ supported: false, enabled: false })
const autoStartSaving = ref(false)

watch(
  () => props.open,
  async (v) => {
    if (!v || !desktop) return
    info.value = await desktop.getInfo()
    apiTarget.value = info.value.apiTarget
    autoStart.value = await desktop.getAutoStart()
  },
  { immediate: true },
)

async function onAutoStartChange(checked: boolean | string | number) {
  if (!desktop) return
  autoStartSaving.value = true
  try {
    const res = await desktop.setAutoStart(!!checked)
    if (!res.ok) {
      message.error(res.message || '设置失败')
      return
    }
    autoStart.value = { ...autoStart.value, enabled: !!res.enabled }
    message.success(res.enabled ? '已开启开机自启动' : '已关闭开机自启动')
  } finally {
    autoStartSaving.value = false
  }
}

async function save() {
  if (!desktop || !dirty.value) return
  saving.value = true
  try {
    const res = await desktop.setApiTarget(apiTarget.value)
    if (!res.ok) {
      message.error(res.message || '保存失败')
      return
    }
    message.success('已保存，正在重新加载')
    setTimeout(() => window.location.reload(), 300)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ds-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 4px;
}
.ds-label {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
  margin-bottom: 8px;
}
.ds-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #86868b;
}
.ds-hint a {
  margin-left: 4px;
}
.ds-meta {
  border-radius: 10px;
  background: #f5f5f7;
  padding: 4px 14px;
}
.ds-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 38px;
  font-size: 13px;
  color: #6e6e73;
}
.ds-row + .ds-row {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.ds-row > span:first-child {
  color: #1d1d1f;
}
</style>
