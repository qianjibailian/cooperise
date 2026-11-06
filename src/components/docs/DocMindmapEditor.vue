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
  padding: 6px 0;
}
.mind-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border-radius: 8px;
  transition: background 0.15s;
}
.mind-row:hover {
  background: #f7f8fa;
}
.mind-branch {
  position: relative;
  flex: none;
  width: 14px;
  height: 1px;
  background: #dee0e3;
}
.mind-branch::before {
  content: '';
  position: absolute;
  left: 0;
  top: -18px;
  width: 1px;
  height: 36px;
  background: #eff0f2;
}
.mind-root-dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-left: 2px;
  background: var(--c-primary);
  border-radius: 50%;
}
.mind-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  font-size: 14px;
  color: #1f2329;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.mind-input:hover {
  border-color: #e3e5e8;
}
.mind-input:focus {
  background: #fff;
  border-color: var(--c-primary);
}
.mind-input.is-root {
  font-size: 18px;
  font-weight: 600;
}
.mind-actions {
  flex: none;
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.mind-row:hover .mind-actions {
  opacity: 1;
}
.mind-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 11px;
  color: #8f959e;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.mind-act:hover {
  color: #1f2329;
  background: #eef0f2;
}
.mind-act.danger:hover {
  color: #f54a45;
  background: #fff1f0;
}
</style>
