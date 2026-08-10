<template>
  <div class="cascader-node">
    <div class="enum-row">
      <a-button
        v-if="depth > 1"
        size="small"
        class="add-sibling-btn"
        title="添加同级"
        @click="$emit('addSibling')"
      >
        <PlusOutlined />
      </a-button>
      <a-input v-model:value="node.label" placeholder="显示名称" size="small" />
      <a-input v-model:value="node.value" placeholder="存储值" size="small" />
      <a-button v-if="depth < maxDepth" size="small" title="添加子级" @click="addChild"><PlusOutlined /> 子级</a-button>
      <span v-else class="depth-limit-tip">已达最大层级</span>
      <a-button size="small" danger title="删除" @click="$emit('remove')"><DeleteOutlined /></a-button>
    </div>
    <div v-if="hasChildren" class="cascader-children">
      <CascaderNodeEditor
        v-for="(child, idx) in node.children"
        :key="idx"
        :node="child"
        :depth="depth + 1"
        :max-depth="maxDepth"
        @addSibling="addSibling(idx)"
        @remove="removeChild(idx)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'

export interface CascaderOption {
  label: string
  value: string
  children?: CascaderOption[]
}

defineOptions({ name: 'CascaderNodeEditor' })

const props = withDefaults(defineProps<{
  node: CascaderOption
  depth?: number
  maxDepth?: number
}>(), {
  depth: 1,
  maxDepth: 3,
})
defineEmits<{ (e: 'remove'): void; (e: 'addSibling'): void }>()

const hasChildren = computed(() => !!props.node.children && props.node.children.length > 0)

function addChild() {
  if (!props.node.children) props.node.children = []
  props.node.children.push({ label: '', value: '' })
}

function addSibling(idx: number) {
  if (!props.node.children) props.node.children = []
  props.node.children.splice(idx + 1, 0, { label: '', value: '' })
}

function removeChild(idx: number) {
  props.node.children?.splice(idx, 1)
}
</script>

<style scoped>
.cascader-node { display: flex; flex-direction: column; gap: 8px; }
.enum-row { display: flex; gap: 8px; align-items: center; }
.enum-row :deep(.ant-input) { flex: 1; }
.cascader-children { display: flex; flex-direction: column; gap: 8px; padding-left: 24px; margin-left: 4px; border-left: 2px solid #e5e5ea; }
.depth-limit-tip { font-size: 12px; color: #bfbfbf; white-space: nowrap; }
.add-sibling-btn { flex-shrink: 0; }
.add-sibling-btn :deep(.anticon) { font-size: 14px; }
</style>
