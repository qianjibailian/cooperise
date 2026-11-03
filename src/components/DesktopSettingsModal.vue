<template>
  <a-modal
    :open="open"
    title="客户端设置"
    :width="560"
    @cancel="emit('update:open', false)"
  >
    <template #footer>
      <a-button @click="emit('update:open', false)">关闭</a-button>
    </template>
    <div class="ds-body">
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

      <div class="ds-field">
        <div class="ds-label ds-label-row">
          <span>MCP 服务</span>
          <a-switch size="small" :checked="mcp?.enabled" :loading="mcpSaving" @change="onMcpChange" />
        </div>
        <div class="ds-hint">
          让 Claude Code、Cursor 等 AI 工具查询事项：搜索、详情、评论、变更记录、关联工单，以及发表评论。
          以当前登录用户身份调用，数据权限与网页端一致；仅本机可访问。
        </div>
        <template v-if="mcp?.enabled">
          <div class="mcp-status">
            <template v-if="mcp.running">
              <a-badge status="success" />运行中
              <span v-if="!mcp.loggedIn" class="mcp-warn">· 客户端未登录，AI 调用会提示先登录</span>
            </template>
            <template v-else><a-badge status="error" /><span class="mcp-warn">未启动：{{ mcp.error || '未知原因' }}</span></template>
          </div>
          <a-segmented v-model:value="mcpClient" :options="MCP_CLIENTS" size="small" />
          <div class="mcp-snippet">
            <pre>{{ mcpSnippet }}</pre>
            <a-button size="small" class="mcp-copy" @click="copy(mcpSnippet)">复制</a-button>
          </div>
          <div class="ds-hint">
            {{ mcpClient === 'claude' ? '在终端执行上面的命令（加 --scope user 对所有项目生效）。' : '加到 AI 工具的 MCP 配置文件中（Cursor：~/.cursor/mcp.json）。' }}
            访问密钥泄露时可
            <a-popconfirm title="重置后，已配置的 AI 工具需要更新密钥" ok-text="重置" cancel-text="取消" @confirm="resetMcpKey">
              <a>重置密钥</a>
            </a-popconfirm>
          </div>
        </template>
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
import { desktop, isMacDesktop, type DesktopInfo, type McpStatus } from '@/utils/desktop'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const info = ref<DesktopInfo | null>(null)

// ---------- 开机自启动：开关即时生效，无需点保存 ----------
const autoStart = ref({ supported: false, enabled: false })
const autoStartSaving = ref(false)

// ---------- MCP 服务：开关即时生效 ----------
const mcp = ref<McpStatus | null>(null)
const mcpSaving = ref(false)
const MCP_CLIENTS = [
  { label: 'Claude Code', value: 'claude' },
  { label: 'Cursor / 其他（JSON）', value: 'json' },
]
const mcpClient = ref<'claude' | 'json'>('claude')
const mcpSnippet = computed(() => {
  const m = mcp.value
  if (!m) return ''
  if (mcpClient.value === 'claude') {
    return `claude mcp add --transport http cooperise ${m.url} --header "Authorization: Bearer ${m.accessKey}"`
  }
  return JSON.stringify(
    { mcpServers: { cooperise: { type: 'http', url: m.url, headers: { Authorization: `Bearer ${m.accessKey}` } } } },
    null,
    2,
  )
})

watch(
  () => props.open,
  async (v) => {
    if (!v || !desktop) return
    info.value = await desktop.getInfo()
    autoStart.value = await desktop.getAutoStart()
    mcp.value = await desktop.getMcpStatus()
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

async function onMcpChange(checked: boolean | string | number) {
  if (!desktop) return
  mcpSaving.value = true
  try {
    mcp.value = await desktop.setMcpEnabled(!!checked)
    if (mcp.value.enabled && !mcp.value.running) message.error(`MCP 服务启动失败：${mcp.value.error}`)
  } finally {
    mcpSaving.value = false
  }
}

async function resetMcpKey() {
  if (!desktop) return
  mcp.value = await desktop.resetMcpKey()
  message.success('已重置，请把新配置更新到 AI 工具中')
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch {
    message.error('复制失败，请手动选择复制')
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
.ds-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mcp-status {
  margin: 10px 0 8px;
  font-size: 12px;
  color: #1d1d1f;
}
.mcp-warn {
  color: #b25000;
}
.mcp-snippet {
  position: relative;
  margin-top: 8px;
  border-radius: 8px;
  background: #f5f5f7;
}
.mcp-snippet pre {
  margin: 0;
  padding: 10px 64px 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #1d1d1f;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow: auto;
  user-select: text;
}
.mcp-copy {
  position: absolute;
  top: 6px;
  right: 6px;
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
