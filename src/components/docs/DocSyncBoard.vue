<template>
  <!-- 同步进度看板：阶段、进度条、各类计数、当前文件、最近错误；打开期间轮询刷新 -->
  <div class="sync-board">
    <div class="sync-board-head">
      <span class="sync-board-title">同步进度</span>
      <span :class="['sync-board-status', `is-${p?.status || 'none'}`]">{{ statusText }}</span>
    </div>

    <div v-if="!p || p.status === 'none'" class="sync-board-empty">尚未同步过，保存设置后点击「立即同步」</div>

    <template v-else>
      <div class="sync-board-phase">
        {{ p.phase }}
        <span v-if="p.current" class="sync-board-current" :title="p.current">· {{ p.current }}</span>
      </div>

      <div class="sync-board-bar">
        <div
          :class="['sync-board-bar-fill', `is-${p.status}`]"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <div class="sync-board-count">{{ p.processed }} / {{ p.total }} 个文件 · {{ percent }}%</div>

      <div class="sync-board-stats">
        <div class="sync-stat"><span class="sync-stat-num is-created">{{ p.created }}</span><span>新增</span></div>
        <div class="sync-stat"><span class="sync-stat-num is-updated">{{ p.updated }}</span><span>更新</span></div>
        <div class="sync-stat"><span class="sync-stat-num">{{ p.skipped }}</span><span>未变化</span></div>
        <div class="sync-stat"><span class="sync-stat-num is-conflict">{{ p.conflicts }}</span><span>冲突</span></div>
        <div class="sync-stat"><span class="sync-stat-num is-removed">{{ p.removed }}</span><span>删除</span></div>
        <div class="sync-stat"><span class="sync-stat-num is-failed">{{ p.failed }}</span><span>失败</span></div>
      </div>

      <div class="sync-board-time">
        开始 {{ fmt(p.startedAt) }}
        <template v-if="p.finishedAt"> · 结束 {{ fmt(p.finishedAt) }} · 耗时 {{ duration }}</template>
        <template v-else-if="p.status === 'running'"> · 已进行 {{ elapsed }}</template>
      </div>

      <div v-if="p.message" class="sync-board-message">{{ p.message }}</div>

      <div v-if="p.errors && p.errors.length" class="sync-board-errors">
        <div class="sync-board-errors-title">最近错误（{{ p.errors.length }}）</div>
        <div v-for="(e, i) in p.errors" :key="i" class="sync-board-error">{{ e }}</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getDocSyncProgress, type DocSyncProgress } from '@/api/docs'

const props = defineProps<{ libraryId: string; active: boolean }>()

const p = ref<DocSyncProgress | null>(null)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

const STATUS_TEXT: Record<string, string> = {
  none: '未同步',
  running: '同步中',
  done: '已完成',
  failed: '失败',
}
const statusText = computed(() => STATUS_TEXT[p.value?.status || 'none'] || '未同步')

const percent = computed(() => {
  const v = p.value
  if (!v || !v.total) return v?.status === 'done' ? 100 : 0
  return Math.min(100, Math.round((v.processed / v.total) * 100))
})

function fmt(ts?: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const q = (n: number) => String(n).padStart(2, '0')
  return `${q(d.getHours())}:${q(d.getMinutes())}:${q(d.getSeconds())}`
}

function durationOf(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`
}

const duration = computed(() => (p.value?.startedAt && p.value?.finishedAt ? durationOf(p.value.finishedAt - p.value.startedAt) : '—'))
const elapsed = computed(() => (p.value?.startedAt ? durationOf(now.value - p.value.startedAt) : '—'))

async function poll() {
  if (!props.libraryId) return
  try {
    const res = await getDocSyncProgress(props.libraryId)
    if (res.success && res.data) p.value = res.data
  } catch {
    // 轮询失败静默忽略，下次再试
  }
  now.value = Date.now()
}

function start() {
  stop()
  void poll()
  timer = setInterval(poll, 1500)
}

function stop() {
  if (timer) clearInterval(timer)
  timer = undefined
}

watch(
  () => props.active,
  (active) => (active ? start() : stop()),
  { immediate: true },
)

onBeforeUnmount(stop)
</script>

<style scoped>
.sync-board {
  margin-top: 14px;
  padding: 12px 14px;
  background: #f7f8fa;
  border-radius: 10px;
}
.sync-board-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sync-board-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}
.sync-board-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #eceef1;
  color: #646a73;
}
.sync-board-status.is-running {
  background: #e8f1ff;
  color: #3370ff;
}
.sync-board-status.is-done {
  background: #e8f7ec;
  color: #248a3d;
}
.sync-board-status.is-failed {
  background: #fdecec;
  color: #d70015;
}
.sync-board-empty {
  margin-top: 8px;
  font-size: 12px;
  color: #8f959e;
}
.sync-board-phase {
  margin-top: 10px;
  font-size: 13px;
  color: #1f2329;
  word-break: break-all;
}
.sync-board-current {
  color: #8f959e;
}
.sync-board-bar {
  margin-top: 8px;
  height: 6px;
  background: #e5e6eb;
  border-radius: 3px;
  overflow: hidden;
}
.sync-board-bar-fill {
  height: 100%;
  background: #3370ff;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.sync-board-bar-fill.is-done {
  background: #34c724;
}
.sync-board-bar-fill.is-failed {
  background: #f54a45;
}
.sync-board-count {
  margin-top: 6px;
  font-size: 12px;
  color: #8f959e;
}
.sync-board-stats {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}
.sync-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
  background: #fff;
  border-radius: 8px;
  font-size: 12px;
  color: #8f959e;
}
.sync-stat-num {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}
.sync-stat-num.is-created {
  color: #248a3d;
}
.sync-stat-num.is-updated {
  color: #3370ff;
}
.sync-stat-num.is-conflict {
  color: #b25000;
}
.sync-stat-num.is-removed {
  color: #8f959e;
}
.sync-stat-num.is-failed {
  color: #d70015;
}
.sync-board-time {
  margin-top: 10px;
  font-size: 12px;
  color: #8f959e;
}
.sync-board-message {
  margin-top: 6px;
  font-size: 12px;
  color: #d70015;
  word-break: break-all;
}
.sync-board-errors {
  margin-top: 10px;
}
.sync-board-errors-title {
  font-size: 12px;
  color: #646a73;
}
.sync-board-error {
  margin-top: 4px;
  padding: 6px 8px;
  font-size: 12px;
  color: #d70015;
  background: #fff;
  border-radius: 6px;
  word-break: break-all;
}
</style>
