<template>
  <!-- 组织选择：组织树展开成「路径」列表（全球运营中心 / C端产品部），可搜索；手机上比多级树更好点 -->
  <van-popup :show="show" position="bottom" round closeable safe-area-inset-bottom class="op-sheet" @update:show="onShowChange">
    <div class="op-title">{{ title || '选择组织' }}</div>
    <van-search v-model="keyword" placeholder="搜索组织" shape="round" />
    <div class="op-body">
      <van-cell v-if="allowAll" title="全部组织" clickable @click="pick(undefined)">
        <template #right-icon><van-icon v-if="modelValue == null" name="success" class="op-check" /></template>
      </van-cell>
      <van-empty v-if="!shown.length" image-size="64" description="没有匹配的组织" />
      <van-cell v-for="o in shown" :key="o.id" clickable @click="pick(o.id)">
        <template #title>
          <div class="op-name" data-no-i18n :style="{ paddingLeft: keyword ? 0 : `${(o.level - 1) * 14}px` }">{{ o.name }}</div>
          <div v-if="keyword && o.path !== o.name" class="op-path h5-ellipsis" data-no-i18n>{{ o.path }}</div>
        </template>
        <template #right-icon><van-icon v-if="modelValue === o.id" name="success" class="op-check" /></template>
      </van-cell>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OrganizationNode } from '@/api/faiz'

const props = defineProps<{
  show: boolean
  tree: OrganizationNode[]
  modelValue?: number
  title?: string
  /** 筛选用：多一项「全部组织」 */
  allowAll?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'update:modelValue', v: number | undefined): void
}>()

const keyword = ref('')

/** 深度优先展开，保留层级（缩进）与完整路径（搜索时显示） */
const flat = computed(() => {
  const out: { id: number; name: string; path: string; level: number }[] = []
  const walk = (nodes: OrganizationNode[], parents: string[], level: number) => {
    for (const n of nodes) {
      const path = [...parents, n.organizationName]
      out.push({ id: n.id, name: n.organizationName, path: n.pathName || path.join(' / '), level })
      if (n.children?.length) walk(n.children, path, level + 1)
    }
  }
  walk(props.tree, [], 1)
  return out
})

const shown = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return kw ? flat.value.filter((o) => o.path.toLowerCase().includes(kw)) : flat.value
})

/** 组织 id → 完整路径（表单 / 筛选里回显） */
function labelOf(id?: number) {
  return flat.value.find((o) => o.id === id)?.path || ''
}
defineExpose({ labelOf })

function pick(id: number | undefined) {
  emit('update:modelValue', id)
  emit('update:show', false)
}

function onShowChange(v: boolean) {
  if (v) keyword.value = ''
  emit('update:show', v)
}
</script>

<style scoped>
.op-sheet {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.op-title {
  flex-shrink: 0;
  padding: 16px 48px 8px 16px;
  font-size: 16px;
  font-weight: 600;
}

.op-body {
  flex: 1;
  min-height: 160px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.op-name {
  font-size: 15px;
}

.op-path {
  margin-top: 2px;
  font-size: 12px;
  color: var(--h5-text-3);
}

.op-check {
  color: var(--van-primary-color);
  font-size: 18px;
  align-self: center;
}
</style>
