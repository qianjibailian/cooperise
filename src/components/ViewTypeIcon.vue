<template>
  <!-- 带 anticon 类名：复用 antd 菜单图标间距及侧边栏折叠态「只保留首个 .anticon」的规则 -->
  <span class="anticon view-type-icon" role="img" :aria-label="label">
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      <rect width="16" height="16" rx="4" :fill="color" />
      <!-- 列表 -->
      <g v-if="kind === 'list'" fill="#fff" stroke="#fff" stroke-linecap="round">
        <circle cx="4.6" cy="5" r="0.95" stroke="none" />
        <circle cx="4.6" cy="8" r="0.95" stroke="none" />
        <circle cx="4.6" cy="11" r="0.95" stroke="none" />
        <path d="M7 5h4.6M7 8h4.6M7 11h4.6" stroke-width="1.4" fill="none" />
      </g>
      <!-- 看板：三列高低不同的卡片 -->
      <g v-else-if="kind === 'kanban'" fill="#fff">
        <rect x="3.4" y="3.6" width="2.6" height="8.8" rx="0.9" />
        <rect x="6.7" y="3.6" width="2.6" height="5.6" rx="0.9" />
        <rect x="10" y="3.6" width="2.6" height="7.2" rx="0.9" />
      </g>
      <!-- 甘特：错落的进度条 -->
      <g v-else-if="kind === 'gantt'" fill="#fff">
        <rect x="3.3" y="4" width="5.4" height="1.9" rx="0.95" />
        <rect x="5.4" y="7.05" width="6.2" height="1.9" rx="0.95" />
        <rect x="8.2" y="10.1" width="4.5" height="1.9" rx="0.95" />
      </g>
      <!-- 日历 -->
      <g v-else-if="kind === 'calendar'">
        <rect x="3.5" y="4.4" width="9" height="8.1" rx="1.6" fill="none" stroke="#fff" stroke-width="1.3" />
        <path d="M3.5 7.3h9" stroke="#fff" stroke-width="1.3" />
        <path d="M6 3.3v2.1M10 3.3v2.1" stroke="#fff" stroke-width="1.3" stroke-linecap="round" />
        <rect x="9" y="8.9" width="2" height="2" rx="0.5" fill="#fff" />
      </g>
      <!-- 上线清单：勾选清单 -->
      <g v-else-if="kind === 'release'" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3.6 5.1l1 1 1.7-1.9M3.6 9.6l1 1 1.7-1.9" stroke-width="1.3" />
        <path d="M8 5.3h4.4M8 9.8h4.4" stroke-width="1.4" />
      </g>
      <!-- 其他：四宫格 -->
      <g v-else fill="#fff">
        <rect x="3.6" y="3.6" width="3.6" height="3.6" rx="1" />
        <rect x="8.8" y="3.6" width="3.6" height="3.6" rx="1" />
        <rect x="3.6" y="8.8" width="3.6" height="3.6" rx="1" />
        <rect x="8.8" y="8.8" width="3.6" height="3.6" rx="1" />
      </g>
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** 视图类型：list / KAN_BAN / gantt / CALENDAR_VIEW / RELEASE_LIST，其余按「其他」展示 */
  type?: string | null
}>()

/** viewType → 图形 / 主色 / 无障碍名称（配色取 Apple 系统色） */
const VIEW_TYPE_META: Record<string, { kind: string; color: string; label: string }> = {
  list: { kind: 'list', color: '#0A84FF', label: '列表' },
  KAN_BAN: { kind: 'kanban', color: '#AF52DE', label: '看板' },
  gantt: { kind: 'gantt', color: '#FF9500', label: '甘特' },
  CALENDAR_VIEW: { kind: 'calendar', color: '#FF3B30', label: '日历' },
  RELEASE_LIST: { kind: 'release', color: '#34C759', label: '上线清单' },
}
const FALLBACK = { kind: 'other', color: '#8E8E93', label: '视图' }

const meta = computed(() => VIEW_TYPE_META[props.type ?? ''] ?? FALLBACK)
const kind = computed(() => meta.value.kind)
const color = computed(() => meta.value.color)
const label = computed(() => meta.value.label)
</script>

<style scoped>
.view-type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}

.view-type-icon svg {
  display: block;
}
</style>
