<script setup lang="ts">
import { computed, ref } from 'vue'
import { PlusOutlined, ForkOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import type { WorkflowNode } from '@/types/faiz'
// 递归组件：显式导入自身（官方推荐写法），避免依赖隐式文件名自引用导致 "Failed to resolve component"
import WorkflowNodeEditor from './WorkflowNodeEditor.vue'

defineOptions({ name: 'WorkflowNodeEditor' })

const props = defineProps<{ node: WorkflowNode; depth: number }>()
const emit = defineEmits<{ remove: [] }>()

const expanded = ref(false)
const nextList = computed(() => props.node.nextNodes ?? [])
const isEmpty = computed(() => !props.node.nodeId && !props.node.nodeName)

function addNext() {
  if (!props.node.nextNodes) props.node.nextNodes = []
  props.node.nextNodes.push({ nodeId: '', nodeName: '', assigneeType: 'CREATOR', assigneeValue: null, statusId: null })
  expanded.value = true
}

function removeNext(i: number) {
  props.node.nextNodes?.splice(i, 1)
}
</script>

<template>
  <div class="wne-wrap">
    <div class="node-row child-node-row" :class="{ 'is-empty-node': isEmpty }" :style="{ marginLeft: depth ? `${depth * 24}px` : '0' }">
      <a-input v-model:value="node.nodeId" placeholder="节点标识" class="node-item node-key" />
      <a-input v-model:value="node.nodeName" placeholder="节点名称" class="node-item node-name" />
      <a-select v-model:value="node.assigneeType" class="node-item node-type" placeholder="办理人">
        <a-select-option value="CREATOR">发起人</a-select-option>
        <a-select-option value="USER">指定用户</a-select-option>
      </a-select>
      <a-input v-if="node.assigneeType === 'USER'" v-model:value="node.assigneeValue" placeholder="用户账号" class="node-item node-value" />
      <a-input v-model:value="node.statusId" placeholder="状态ID" class="node-item node-status" />
      <a-button type="text" :class="['node-branch-btn', { 'is-active': expanded }]" @click="expanded = !expanded">
        <ForkOutlined /> 后续{{ nextList.length ? `(${nextList.length})` : '' }}
      </a-button>
      <a-button type="text" danger class="node-del" @click="emit('remove')"><DeleteOutlined /></a-button>
    </div>

    <!-- 后续节点展开区：该节点完成后可分发到多个后续节点（树形，支持任意层级） -->
    <div v-if="expanded" class="wne-children">
      <WorkflowNodeEditor
        v-for="(nn, i) in nextList"
        :key="i"
        :node="nn"
        :depth="depth + 1"
        @remove="removeNext(i)"
      />
      <a-button type="dashed" block class="node-add" @click="addNext"><PlusOutlined /> 添加后续节点</a-button>
    </div>
  </div>
</template>

<style scoped>
.wne-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.child-node-row {
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 8px;
}
.child-node-row:hover {
  border-color: #efdbff;
  background: #faf7ff;
}
.child-node-row.is-empty-node {
  border-color: #ffccc7;
  background: #fff2f0;
}
.node-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.node-item {
  border-radius: 8px;
}
.node-key {
  width: 130px;
}
.node-name {
  width: 130px;
}
.node-type {
  width: 110px;
}
.node-value {
  width: 130px;
}
.node-status {
  width: 110px;
}
.node-del {
  flex-shrink: 0;
}
.node-add {
  border-radius: 10px;
}
.node-branch-btn {
  flex-shrink: 0;
  color: #722ed1;
}
.node-branch-btn.is-active {
  color: #fff;
  background: #722ed1;
  border-radius: 8px;
}
.wne-children {
  margin: 2px 0 6px 20px;
  padding: 8px 10px;
  background: #faf7ff;
  border: 1px solid #efdbff;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
