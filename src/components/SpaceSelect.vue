<template>
  <a-select
    :value="modelValue || undefined"
    :placeholder="placeholder"
    :disabled="disabled"
    :loading="loading"
    :size="size"
    show-search
    allow-clear
    :filter-option="filterOption"
    style="width: 100%"
    @update:value="onChange"
  >
    <a-select-option v-for="sp in options" :key="sp.spaceCode" :value="sp.spaceCode" :label="sp.spaceName">
      <span class="space-select-option">
        <span class="space-select-icon" :style="{ background: sp.color || '#0A84FF' }">{{ spaceAvatarText(sp.spaceName) }}</span>
        <span class="space-select-name">{{ sp.spaceName }}</span>
        <span v-if="sp.status === 0" class="space-select-off">已停用</span>
      </span>
    </a-select-option>
    <template #notFoundContent>
      <div class="space-select-empty">暂无可用空间，请先在「空间」中创建</div>
    </template>
  </a-select>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { SpaceItem } from '@/api/faiz'
import { useSpaces, spaceAvatarText } from '@/utils/space-store'

const props = withDefaults(defineProps<{
  /** 所选空间编码 */
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  size?: 'large' | 'middle' | 'small'
}>(), {
  modelValue: undefined,
  placeholder: '选择所属空间',
  disabled: false,
  size: 'large',
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | undefined): void
  /** 选中空间变化，附带空间对象（清空时为 undefined） */
  (e: 'change', space: SpaceItem | undefined): void
}>()

const { spaces, loading, ensureLoaded, findSpace } = useSpaces()

/** 只展示启用空间；当前已选的停用空间保留，保证回显 */
const options = computed(() => spaces.value.filter(s => s.status === 1 || s.spaceCode === props.modelValue))

/** 按空间名称或编码搜索（label 只放名称，避免选中后回显编码） */
function filterOption(input: string, option: any) {
  const kw = input.trim().toLowerCase()
  return String(option?.label ?? '').toLowerCase().includes(kw)
    || String(option?.value ?? '').toLowerCase().includes(kw)
}

function onChange(v?: string) {
  emit('update:modelValue', v || undefined)
  emit('change', findSpace(v))
}

// 每次挂载刷新，保证与空间管理同步
onMounted(() => ensureLoaded(true))
</script>

<style>
/* 下拉弹层挂在 body，需非 scoped */
.space-select-option { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; vertical-align: middle; }
.space-select-icon { width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 11px; font-weight: 600; color: #fff; }
.space-select-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.space-select-off { flex-shrink: 0; font-size: 11px; color: #aeaeb2; }
.space-select-empty { padding: 8px 4px; font-size: 12px; color: #8e8e93; text-align: center; }
</style>
