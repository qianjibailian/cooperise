<script setup lang="ts">
import { computed } from 'vue'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons-vue'
import type { MindNode } from '@/types/docs'

/**
 * 思维导图编辑器（大纲树）
 * 直接修改传入的 root 节点，变更时 emit change；可导出 FreeMind .mm 供 XMind 导入。
 */
const props = defineProps<{
  root: MindNode
}>()

const emit = defineEmits<{
  (e: 'change'): void
}>()

interface FlatNode {
  node: MindNode
  depth: number
  parent: MindNode | null
}

const flat = computed<FlatNode[]>(() => {
  const out: FlatNode[] = []
  const walk = (node: MindNode, depth: number, parent: MindNode | null) => {
    out.push({ node, depth, parent })
    node.children.forEach((child) => walk(child, depth + 1, node))
  }
  walk(props.root, 0, null)
  return out
})

function genId(): string {
  return `mind_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`
}

function addChild(parent: MindNode) {
  parent.children.push({ id: genId(), text: '新节点', children: [] })
  emit('change')
}

function removeNode(item: FlatNode) {
  if (!item.parent) return
  item.parent.children = item.parent.children.filter((c) => c.id !== item.node.id)
  emit('change')
}

function onInput() {
  emit('change')
}
</script>

<template>
  <div class="mind-editor">
    <div
      v-for="item in flat"
      :key="item.node.id"
      class="mind-row"
      :class="{ 'is-root': item.depth === 0 }"
      :style="{ paddingLeft: `${item.depth * 30}px` }"
    >
      <span v-if="item.depth > 0" class="mind-branch" />
      <span v-if="item.depth === 0" class="mind-root-dot" />
      <input
        v-model="item.node.text"
        class="mind-input"
        :class="{ 'is-root': item.depth === 0 }"
        :placeholder="item.depth === 0 ? '中心主题' : '节点内容'"
        @input="onInput"
      />
      <span class="mind-actions">
        <button type="button" class="mind-act" title="添加子节点" @click="addChild(item.node)"><PlusOutlined /></button>
        <button v-if="item.parent" type="button" class="mind-act danger" title="删除节点" @click="removeNode(item)"><CloseOutlined /></button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.mind-editor {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--docs-space-3);
  font-family: var(--docs-font);
  background: var(--docs-paper);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
}
.mind-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--docs-space-2);
  min-height: 34px;
  border-radius: var(--docs-radius);
  transition: background-color var(--docs-dur) var(--docs-ease);
}
.mind-row:hover {
  background: var(--docs-hover);
}
/* 连线（横向分支 + 纵向主干）：--docs-text-3 */
.mind-branch {
  position: relative;
  flex: none;
  width: 14px;
  height: 1px;
  background: var(--docs-text-3);
}
.mind-branch::before {
  content: '';
  position: absolute;
  left: 0;
  top: -18px;
  width: 1px;
  height: 36px;
  background: var(--docs-text-3);
}
.mind-root-dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-left: 2px;
  background: var(--c-primary);
  border-radius: 50%;
}
/* 节点：画布底 + 1px 强描边 + 圆角；聚焦即选中，描边 2px 主题色 */
.mind-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 var(--docs-space-2);
  font-family: inherit;
  font-size: var(--docs-fs-control);
  line-height: var(--docs-lh-ui);
  color: var(--docs-text);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius);
  outline: none;
  transition: border-color var(--docs-dur) var(--docs-ease), background-color var(--docs-dur) var(--docs-ease), box-shadow var(--docs-dur) var(--docs-ease);
}
.mind-input::placeholder {
  color: var(--docs-text-3);
}
.mind-input:hover {
  border-color: var(--c-primary-border);
}
.mind-input:focus {
  border-color: var(--c-primary);
  box-shadow: inset 0 0 0 1px var(--c-primary), var(--docs-focus);
}
.mind-input.is-root {
  font-size: var(--docs-fs-subtitle);
  font-weight: 600;
}
.mind-actions {
  flex: none;
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--docs-dur) var(--docs-ease);
}
.mind-row:hover .mind-actions,
.mind-row:focus-within .mind-actions {
  opacity: 1;
}
/* 图标按钮：幽灵样式，悬停 --docs-hover */
.mind-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: var(--docs-fs-caption);
  color: var(--docs-text-3);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius-sm);
  cursor: pointer;
  transition: background-color var(--docs-dur) var(--docs-ease), color var(--docs-dur) var(--docs-ease), box-shadow var(--docs-dur) var(--docs-ease);
}
.mind-act:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}
.mind-act:active {
  box-shadow: var(--docs-shadow-control);
}
.mind-act:focus-visible {
  outline: none;
  box-shadow: var(--docs-focus);
}
.mind-act.danger:hover {
  color: var(--docs-danger);
  background: color-mix(in srgb, var(--docs-danger) 8%, transparent);
}
</style>
