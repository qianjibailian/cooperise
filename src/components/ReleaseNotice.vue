<template>
  <Transition name="release-notice">
    <section v-if="mode" class="release-notice" role="status" aria-live="polite">
      <header class="rn-header">
        <span class="rn-badge"><RocketOutlined /></span>
        <div class="rn-heading">
          <div class="rn-title">{{ mode === 'available' ? '发现新版本' : '系统已更新' }}</div>
          <div v-if="release" class="rn-meta">
            v{{ release.version }}<template v-if="release.date"> · {{ release.date }}</template>
          </div>
        </div>
        <button type="button" class="rn-close" aria-label="关闭" @click="handleLater"><CloseOutlined /></button>
      </header>

      <p class="rn-desc">
        {{ mode === 'available' ? '新版本已发布，刷新页面即可使用最新功能。' : '本次更新内容：' }}
      </p>

      <ul v-if="visibleItems.length" class="rn-list">
        <li v-for="(item, i) in visibleItems" :key="i">{{ item }}</li>
      </ul>
      <button v-if="hiddenCount > 0" type="button" class="rn-more" @click="expanded = true">
        展开其余 {{ hiddenCount }} 项
      </button>

      <footer class="rn-footer">
        <template v-if="mode === 'available'">
          <a-button size="small" class="rn-btn" @click="handleLater">稍后</a-button>
          <a-button size="small" type="primary" class="rn-btn" @click="handleRefresh">立即刷新</a-button>
        </template>
        <a-button v-else size="small" type="primary" class="rn-btn" @click="handleAck">知道了</a-button>
      </footer>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CloseOutlined, RocketOutlined } from '@ant-design/icons-vue'

/**
 * 发版更新通知（右下角）
 * - available：@plugin-web-update-notification 轮询到新构建（vite.config 已隐藏插件自带弹窗），提示刷新
 * - updated：刷新后首次进入新版本，展示本次更新内容
 * 更新内容维护在 public/release-notes.json（数组，最新版本在前），每次发版追加一条
 */
interface ReleaseNote {
  version: string
  date?: string
  items?: string[]
}

/** 插件挂在 window 上的方法（稍后：记住忽略该版本） */
interface PluginWebUpdateNotice {
  dismissUpdate?: () => void
}

/** 已读的更新说明版本（本地记录，避免重复弹出） */
const SEEN_KEY = 'cooperise_release_seen'
/** 默认展示条数，其余折叠 */
const PREVIEW_COUNT = 5

const mode = ref<'available' | 'updated' | null>(null)
const release = ref<ReleaseNote | null>(null)
const expanded = ref(false)

const items = computed(() => release.value?.items ?? [])
const visibleItems = computed(() => (expanded.value ? items.value : items.value.slice(0, PREVIEW_COUNT)))
const hiddenCount = computed(() => items.value.length - visibleItems.value.length)

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function writeSeen(version: string) {
  try {
    localStorage.setItem(SEEN_KEY, version)
  } catch {
    // 隐私模式等不可写时忽略：最多重复提示一次
  }
}

/** 拉取最新更新说明：带时间戳绕过缓存，保证拿到新部署的文件 */
async function fetchLatestRelease(): Promise<ReleaseNote | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}release-notes.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const list = (await res.json()) as ReleaseNote[]
    const latest = Array.isArray(list) ? list[0] : null
    return latest?.version ? latest : null
  } catch {
    return null
  }
}

/** 检测到新构建：展示新版本的更新说明 + 刷新按钮 */
async function onUpdateAvailable() {
  if (mode.value === 'available') return
  release.value = await fetchLatestRelease()
  expanded.value = false
  mode.value = 'available'
}

function handleRefresh() {
  // 刷新后进入新版本时，本版说明在这里已看过，不再重复弹出
  if (release.value) writeSeen(release.value.version)
  window.location.reload()
}

function handleLater() {
  if (mode.value === 'available') {
    // 交给插件记住忽略该构建版本，本次会话不再提示
    ;(window as unknown as { pluginWebUpdateNotice_?: PluginWebUpdateNotice }).pluginWebUpdateNotice_?.dismissUpdate?.()
  } else if (release.value) {
    writeSeen(release.value.version)
  }
  mode.value = null
}

function handleAck() {
  if (release.value) writeSeen(release.value.version)
  mode.value = null
}

/** 进入页面：当前部署的更新说明还没看过时展示一次（首次访问只记录，不打扰） */
async function checkUpdatedOnLoad() {
  const latest = await fetchLatestRelease()
  if (!latest || mode.value) return
  const seen = readSeen()
  if (seen === null) {
    writeSeen(latest.version)
    return
  }
  if (seen !== latest.version) {
    release.value = latest
    expanded.value = false
    mode.value = 'updated'
  }
}

const onNotice = () => { void onUpdateAvailable() }

onMounted(() => {
  document.body.addEventListener('plugin_web_update_notice', onNotice)
  void checkUpdatedOnLoad()
})

onBeforeUnmount(() => {
  document.body.removeEventListener('plugin_web_update_notice', onNotice)
})
</script>

<style scoped>
.release-notice {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1010;
  width: 340px;
  max-width: calc(100vw - 32px);
  padding: 16px 16px 14px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06);
  color: #1d1d1f;
}

.rn-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.rn-badge {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-hover) 100%);
  border-radius: 9px;
}

.rn-heading {
  flex: 1;
  min-width: 0;
}

.rn-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.rn-meta {
  font-size: 12px;
  color: #86868b;
}

.rn-close {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 12px;
  color: #aeaeb2;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.rn-close:hover {
  color: #1d1d1f;
  background: #f2f2f5;
}

.rn-desc {
  margin: 10px 0 6px;
  font-size: 13px;
  color: #3a3a3c;
}

.rn-list {
  max-height: 200px;
  margin: 0;
  padding: 0 0 0 18px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 20px;
  color: #6e6e73;
}

.rn-list li + li {
  margin-top: 2px;
}

.rn-more {
  margin-top: 4px;
  padding: 0;
  font-size: 12px;
  color: var(--c-primary);
  background: transparent;
  border: none;
  cursor: pointer;
}

.rn-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.rn-btn {
  border-radius: 8px;
}

.release-notice-enter-active,
.release-notice-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.release-notice-enter-from,
.release-notice-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 480px) {
  .release-notice {
    right: 16px;
    bottom: 16px;
  }
}
</style>
