<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PlusOutlined, DeleteOutlined, BranchesOutlined, RightOutlined } from '@ant-design/icons-vue'
import type { WorkflowNode } from '@/types/faiz'
import { genNodeId, splitAssigneeIds, joinAssigneeIds } from './workflow-flow-layout'
// 递归组件：显式导入自身（官方推荐写法），避免依赖隐式文件名自引用导致 "Failed to resolve component"
import WorkflowNodeEditor from './WorkflowNodeEditor.vue'

defineOptions({ name: 'WorkflowNodeEditor' })

const props = defineProps<{
  node: WorkflowNode
  depth: number
  statusOptions: { value: string; label: string }[]
  positionOptions: { value: string; label: string }[]
  /** 一键展开 / 收起信号：seq 变化时所有层级同步为 open；新挂载的子节点按当前 open 初始化 */
  expandSignal?: { open: boolean; seq: number }
}>()
const emit = defineEmits<{ remove: []; insertAfter: [] }>()

const expanded = ref(props.expandSignal?.open ?? false)
watch(
  () => props.expandSignal?.seq,
  () => {
    expanded.value = props.expandSignal?.open ?? false
  },
)
const nextList = computed(() => props.node.nextNodes ?? [])
const isEmpty = computed(() => !props.node.statusId)

function addNext() {
  if (!props.node.nextNodes) props.node.nextNodes = []
  props.node.nextNodes.push({ nodeId: genNodeId(), nodeName: '', assigneeType: 'CREATOR', assigneeValue: null, statusId: null })
  expanded.value = true
}

/** 选择状态：节点名称直接取状态名称 */
function handleStatusChange(v?: string) {
  props.node.statusId = v ?? null
  props.node.nodeName = props.statusOptions.find((o) => o.value === v)?.label ?? ''
}

function removeNext(i: number) {
  props.node.nextNodes?.splice(i, 1)
}

/** 在第 i 个后续节点之后插入同级后续节点 */
function insertNextAfter(i: number) {
  props.node.nextNodes?.splice(i + 1, 0, { nodeId: genNodeId(), nodeName: '', assigneeType: 'CREATOR', assigneeValue: null, statusId: null })
}
</script>

<template>
  <div class="wne-wrap" :class="{ 'is-child': depth > 0 }">
    <div class="wne-card" :class="{ 'is-empty': isEmpty }">
      <!-- 展开 / 收起后续节点；无后续节点时占位保持对齐 -->
      <span
        class="wne-toggle"
        :class="{ 'is-open': expanded, 'is-disabled': !nextList.length }"
        @click="nextList.length && (expanded = !expanded)"
      >
        <RightOutlined v-if="nextList.length" />
      </span>
      <span v-if="node.branchName" class="wne-branch">{{ node.branchName }}</span>

      <div class="wne-fields">
        <a-select
          :value="node.statusId || undefined"
          :options="statusOptions"
          placeholder="选择状态"
          show-search
          option-filter-prop="label"
          class="wne-status"
          @change="handleStatusChange"
        />
        <span class="wne-sep">经办人</span>
        <a-select v-model:value="node.assigneeType" class="wne-type" @change="node.assigneeValue = null">
          <a-select-option value="CREATOR">发起人</a-select-option>
          <a-select-option value="POSITION">指定岗位</a-select-option>
        </a-select>
        <a-select
          v-if="node.assigneeType === 'POSITION'"
          :value="splitAssigneeIds(node.assigneeValue)"
          mode="multiple"
          :max-tag-count="2"
          :options="positionOptions"
          placeholder="选择岗位（可多选）"
          show-search
          option-filter-prop="label"
          class="wne-position"
          @change="(v: unknown) => (node.assigneeValue = joinAssigneeIds(v))"
        />
      </div>

      <span v-if="nextList.length" class="wne-count" @click="expanded = !expanded">{{ nextList.length }} 个后续</span>
      <div class="wne-actions">
        <a-tooltip title="在此节点后添加节点">
          <a-button type="text" size="small" @click="emit('insertAfter')"><PlusOutlined /></a-button>
        </a-tooltip>
        <a-tooltip title="添加后续节点">
          <a-button type="text" size="small" @click="addNext"><BranchesOutlined /></a-button>
        </a-tooltip>
        <a-tooltip title="删除节点">
          <a-button type="text" size="small" danger @click="emit('remove')"><DeleteOutlined /></a-button>
        </a-tooltip>
      </div>
    </div>

    <!-- 后续节点：缩进 + 左侧引导线，树形支持任意层级 -->
    <div v-if="expanded && nextList.length" class="wne-children">
      <WorkflowNodeEditor
        v-for="(nn, i) in nextList"
        :key="i"
        :node="nn"
        :depth="depth + 1"
        :status-options="statusOptions"
        :position-options="positionOptions"
        :expand-signal="expandSignal"
        @remove="removeNext(i)"
        @insert-after="insertNextAfter(i)"
      />
    </div>
  </div>
</template>

<style scoped>
.wne-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 节点卡片：左侧色条区分已配置（紫）/ 待配置（黄），与画板一致 */
.wne-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 10px 8px 8px;
  background: #fff;
  border: 1px solid #ececf2;
  border-left: 3px solid #722ed1;
  border-radius: 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.wne-card:hover {
  border-color: #d3adf7;
  border-left-color: #722ed1;
  box-shadow: 0 2px 8px rgba(114, 46, 209, 0.08);
}
.wne-card.is-empty {
  background: #fffbe6;
  border-style: dashed;
  border-color: #ffd666;
  border-left: 3px solid #faad14;
}
.wne-toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 11px;
  color: #8c8c8c;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s, background 0.15s;
}
.wne-toggle:hover {
  background: #f4f0fb;
  color: #722ed1;
}
.wne-toggle.is-open {
  transform: rotate(90deg);
  color: #722ed1;
}
.wne-toggle.is-disabled {
  cursor: default;
  background: none;
}
.wne-branch {
  flex-shrink: 0;
  max-width: 96px;
  padding: 0 8px;
  overflow: hidden;
  font-size: 12px;
  line-height: 22px;
  color: #722ed1;
  white-space: nowrap;
  text-overflow: ellipsis;
  background: #f4f0fb;
  border-radius: 11px;
}
.wne-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.wne-status {
  width: 180px;
}
.wne-sep {
  flex-shrink: 0;
  font-size: 12px;
  color: #8c8c8c;
}
.wne-type {
  width: 108px;
}
.wne-position {
  flex: 1;
  min-width: 180px;
  max-width: 360px;
}
.wne-count {
  flex-shrink: 0;
  font-size: 12px;
  color: #8c8c8c;
  cursor: pointer;
}
.wne-count:hover {
  color: #722ed1;
}
/* 操作按钮默认弱化，悬停卡片时再突出，减少视觉噪音 */
.wne-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  opacity: 0.45;
  transition: opacity 0.15s;
}
.wne-card:hover .wne-actions {
  opacity: 1;
}
.wne-actions :deep(.ant-btn:not(.ant-btn-dangerous)) {
  color: #722ed1;
}
.wne-children {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 18px;
  padding-left: 22px;
}
/* 竖向引导线 */
.wne-children::before {
  content: '';
  position: absolute;
  top: -8px;
  bottom: 24px;
  left: 0;
  border-left: 1px dashed #d3adf7;
}
/* 每个子节点的横向连接线 */
.wne-wrap.is-child::before {
  content: '';
  position: absolute;
  top: 24px;
  left: -22px;
  width: 18px;
  border-top: 1px dashed #d3adf7;
}
</style>
