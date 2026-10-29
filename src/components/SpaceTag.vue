<template>
  <a-tooltip v-if="label" :title="code ? `${label}（${code}）` : label" placement="topLeft" :mouse-enter-delay="0.3">
    <span class="space-tag">
      <span class="space-tag-icon" :style="{ background: space?.color || '#0A84FF' }">{{ spaceAvatarText(label) }}</span>
      <span class="space-tag-name">{{ label }}</span>
      <span v-if="code" class="space-tag-code">{{ code }}</span>
    </span>
  </a-tooltip>
  <span v-else-if="code" class="space-tag-code">{{ code }}</span>
  <span v-else class="space-tag-empty">-</span>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSpaces, spaceAvatarText } from '@/utils/space-store'

/** 列表中展示所属空间：名称 + 编码；接口未返回名称时按编码在空间列表中回显 */
const props = defineProps<{ code?: string | null; name?: string | null }>()

const { ensureLoaded, findSpace } = useSpaces()
const space = computed(() => findSpace(props.code))
const label = computed(() => props.name || space.value?.spaceName || '')

onMounted(() => ensureLoaded())
</script>

<style scoped>
.space-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
}

.space-tag-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}

.space-tag-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1d1d1f;
}

.space-tag-code {
  flex-shrink: 0;
  padding: 0 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 18px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 5px;
}

.space-tag-empty {
  color: #aeaeb2;
}
</style>
