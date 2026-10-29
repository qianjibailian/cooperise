<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WorkflowNode } from '@/types/faiz'
import { getIssueWorkflow, queryPositions, type IssueWorkflow } from '@/api/faiz'
import WorkflowFlowViewer from './WorkflowFlowViewer.vue'
import { normalizeLegacyNodes } from './workflow-flow-layout'
import type { WfFlowNodeState } from './workflow-flow-layout'

const props = defineProps<{
  open: boolean
  issueKey: string
}>()

const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const modalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const loading = ref(false)
const workflow = ref<IssueWorkflow | null>(null)
const nodes = ref<WorkflowNode[]>([])

/** 当前节点高亮：currentNodeId → current */
const nodeStates = computed<Record<string, WfFlowNodeState>>(() => {
  const id = workflow.value?.currentNodeId
  return id ? { [id]: 'current' } : {}
})

/** 岗位 ID → 名称：悬停节点时展示经办岗位，只加载一次 */
const positionNames = ref<Record<string, string>>({})
async function loadPositionNames() {
  if (Object.keys(positionNames.value).length) return
  try {
    const res = await queryPositions({ page: 1, pageSize: 999 })
    if (res?.success) positionNames.value = Object.fromEntries((res.data?.list || []).map((p) => [String(p.id), p.positionName]))
  } catch {
    // 岗位名称仅用于展示，失败时显示岗位 ID
  }
}

/** 事项关联的工作流（事项创建时绑定的流程快照 + 当前节点） */
async function load() {
  loading.value = true
  workflow.value = null
  nodes.value = []
  try {
    const res = await getIssueWorkflow(props.issueKey)
    const data = res?.data ?? null
    if (!data) return
    workflow.value = data
    nodes.value = normalizeLegacyNodes(data.nodes ?? [])
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open && props.issueKey) {
      load()
      loadPositionNames()
    }
  },
)
</script>

<template>
  <a-modal v-model:open="modalOpen" :title="`工作流 · ${issueKey}`" width="clamp(960px, 92vw, 1080px)" :footer="null" destroy-on-close class="wf-view-modal">
    <a-spin :spinning="loading">
      <template v-if="workflow">
        <div class="wv-head">
          <span v-if="workflow.currentNodeName" class="wv-current">当前：{{ workflow.currentNodeName }}</span>
          <a-tag v-if="workflow.finished" color="green" :bordered="false">已结束</a-tag>
          <span class="wv-legend">
            <span class="wv-legend-item"><i class="wv-dot is-current" />当前状态</span>
            <span class="wv-legend-item"><i class="wv-line" />流转</span>
            <span class="wv-legend-item"><i class="wv-line is-back" />回退</span>
          </span>
        </div>
        <WorkflowFlowViewer v-if="nodes.length" :nodes="nodes" :node-states="nodeStates" :position-names="positionNames" height="520px" />
        <a-empty v-else description="该工作流暂无节点" style="padding: 40px 0" />
      </template>
      <a-empty v-else-if="!loading" description="该事项暂未关联工作流" style="padding: 40px 0" />
    </a-spin>
  </a-modal>
</template>

<style scoped>
.wv-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.wv-current {
  padding: 1px 10px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: #fa8c16;
  border-radius: 10px;
}
.wv-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
  font-size: 12px;
  color: #595959;
}
.wv-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.wv-dot {
  width: 14px;
  height: 10px;
  border: 1px solid #d46b08;
  border-radius: 3px;
  background: #fa8c16;
  box-shadow: 0 0 0 3px rgba(250, 140, 22, 0.25);
}
.wv-line {
  width: 18px;
  border-top: 1.5px solid #a8adbd;
}
.wv-line.is-back {
  border-top: 1.5px dashed #fa8c16;
}
</style>
