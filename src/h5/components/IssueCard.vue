<template>
  <!-- 事项卡片：列表 / 看板 / 视图共用。第一行 单号 + 状态，第二行概要，第三行 类型 · 经办人 · 更新时间 -->
  <div class="issue-card" @click="open">
    <div class="ic-top">
      <span class="ic-key" data-no-i18n>{{ issue.key }}</span>
      <span v-if="issue.statusName" class="h5-status" :style="{ background: issue.statusColor }">{{ issue.statusName }}</span>
    </div>
    <div class="ic-summary" data-no-i18n>{{ issue.summary }}</div>
    <div class="ic-meta">
      <span v-if="issue.typeName" class="ic-type">
        <i class="ic-type-dot" :style="{ background: issue.typeColor }" />{{ issue.typeName }}
      </span>
      <span v-if="issue.assignee" class="ic-assignee">
        <UserAvatar :user="issue.assignee" :size="18" />
        <span class="h5-ellipsis" data-no-i18n>{{ personName(issue.assignee) }}</span>
      </span>
      <span v-if="issue.updated" class="ic-time">{{ issue.updated }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { personName } from '@/utils/person'
import UserAvatar from './UserAvatar.vue'
import type { IssueBrief } from '../utils'

const props = defineProps<{ issue: Pick<IssueBrief, 'key' | 'summary' | 'statusName' | 'statusColor' | 'typeName' | 'typeColor' | 'updated'> & { assignee?: Record<string, unknown> | null } }>()

const router = useRouter()
function open() {
  if (props.issue.key) router.push(`/jira/browse/${encodeURIComponent(props.issue.key)}`)
}
</script>

<style scoped>
.issue-card {
  margin: 10px var(--h5-gutter) 0;
  padding: 12px 14px;
  border-radius: var(--h5-radius);
  background: var(--h5-card);
  transition: transform 0.1s, background 0.1s;
}

.issue-card:active {
  transform: scale(0.99);
  background: #fafbfc;
}

.ic-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ic-key {
  font-size: 12px;
  color: var(--h5-text-3);
  font-variant-numeric: tabular-nums;
}

.ic-summary {
  margin-top: 6px;
  font-size: 15px;
  line-height: 1.45;
  font-weight: 500;
  color: var(--h5-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.ic-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  font-size: 12px;
  color: var(--h5-text-2);
}

.ic-type,
.ic-assignee {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.ic-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.ic-time {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--h5-text-3);
}
</style>
