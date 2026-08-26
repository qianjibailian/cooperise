<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import type { WorkflowInstance, WorkflowDefinition, WorkflowNode } from '@/types/faiz'
import { listWorkflowInstances, getWorkflowInstance, listWorkflowDefinitions } from '@/api/faiz'
import { normalizeLegacyNodes } from '@/components/workflow-flow-layout'

const props = defineProps<{
  open: boolean
  issueKey: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const loading = ref(false)
const instances = ref<WorkflowInstance[]>([])
const activeId = ref<number | undefined>(undefined)
const detail = ref<Record<string, any> | null>(null)
const defNodes = ref<WorkflowNode[]>([])
const tabKey = ref<string | undefined>(undefined)

/** 当前激活的实例（默认最新一次发起） */
const activeInstance = computed<WorkflowInstance | null>(() => {
  const list = instances.value
  if (!list.length) return null
  return list.find((i) => i.id === activeId.value) ?? list[0]
})

/** 流程状态 → 文案/颜色 */
function wfStatusOf(status?: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    RUNNING: { label: '运行中', color: 'processing' },
    END: { label: '已结束', color: 'success' },
    CANCELED: { label: '已撤销', color: 'default' },
  }
  return map[status || ''] ?? { label: status || '未知', color: 'default' }
}

/** 处理结果 → 文案 */
function wfActionLabel(a?: string): string {
  const map: Record<string, string> = { APPROVE: '通过', REJECT: '驳回', TRANSFER: '转办' }
  return a ? map[a] ?? a : '待处理'
}

/** 当前节点名称：列表字段优先，其次从详情 currentNodeId 在节点树中解析 */
const currentNodeLabel = computed(() => {
  const inst = activeInstance.value
  if (inst?.currentNodeName || inst?.currentNode) return inst.currentNodeName || inst.currentNode
  const d = detail.value
  const curId = String(d?.currentNodeId ?? d?.currentNode ?? '')
  if (!curId) return ''
  return flattenNodes(defNodes.value).find((n) => n.nodeId === curId)?.nodeName || curId
})

/** 详情中的审批记录（真实字段 histories，兼容不同返回字段） */
const records = computed<Array<Record<string, any>>>(() => {
  const d = detail.value
  if (!d) return []
  const arr =
    d.histories ??
    d.records ??
    d.approvalRecords ??
    d.approvals ??
    d.auditRecords ??
    d.approveRecords ??
    d.taskList ??
    d.tasks ??
    d.nodeLogs ??
    d.approvalList ??
    []
  return Array.isArray(arr) ? arr : []
})

interface TimelineNode extends WorkflowNode {
  level: number
  runState: 'done' | 'current' | 'pending'
  finishTime?: string
  endTime?: string
  assignee?: string
}

/** 把流程定义节点树深度优先前序遍历铺平（含分支缩进层级） */
function flattenNodes(list: WorkflowNode[], level = 0): TimelineNode[] {
  const out: TimelineNode[] = []
  for (const n of list) {
    out.push({ ...n, level, runState: 'pending' })
    if (n.nextNodes?.length) out.push(...flattenNodes(n.nextNodes, level + 1))
  }
  return out
}

/** 从实例详情提取各节点运行状态（真实字段：nodeTraces + currentNodeId + histories，兼容常见字段名） */
function extractRunStates(d: Record<string, any>): Map<string, 'done' | 'current' | 'pending'> {
  const map = new Map<string, 'done' | 'current' | 'pending'>()
  const traj =
    d.nodeTraces ??
    d.nodeStatusList ??
    d.nodeStatuses ??
    d.nodeTrajectory ??
    d.trajectory ??
    d.nodes ??
    d.nodeList ??
    []
  if (Array.isArray(traj)) {
    for (const n of traj) {
      const id = String(n.nodeId ?? n.nodeKey ?? n.name ?? '')
      if (!id || id === 'undefined') continue
      const st = String(n.status ?? n.nodeStatus ?? '').toUpperCase()
      const finished = n.finishTime || n.endTime || n.completedTime || n.finishedTime
      if (finished || ['DONE', 'COMPLETED', 'FINISHED', 'SUCCESS', 'APPROVED', 'PASSED', 'REJECTED', 'REJECT', 'END'].includes(st)) {
        map.set(id, 'done')
      } else if (['RUNNING', 'ACTIVE', 'PROCESSING', 'HANDLING', 'IN_PROGRESS', 'TODO', 'CURRENT'].includes(st)) {
        map.set(id, 'current')
      } else {
        map.set(id, 'pending')
      }
    }
  }
  const historyRecords =
    d.histories ??
    d.records ??
    d.approvalRecords ??
    d.approvals ??
    d.auditRecords ??
    d.approveRecords ??
    d.taskList ??
    d.tasks ??
    d.nodeLogs ??
    d.approvalList ??
    []
  if (Array.isArray(historyRecords)) {
    for (const r of historyRecords) {
      const id = String(r.nodeId ?? r.nodeKey ?? r.taskNodeId ?? '')
      if (id && id !== 'undefined') map.set(id, 'done')
    }
  }
  const cur = d.currentNodeId ?? d.currentNode ?? d.currentNodeKey ?? ''
  if (cur) map.set(String(cur), 'current')
  return map
}

/** Timeline 用的全部节点（流程定义铺平 + 实例状态叠加） */
const timelineNodes = computed<TimelineNode[]>(() => {
  const list = defNodes.value.length ? defNodes.value : []
  const flat = flattenNodes(list)
  if (!flat.length) return []
  const d = detail.value ?? {}
  const stateMap = extractRunStates(d)
  const hasTraces = !!(d.nodeTraces ?? d.nodeStatusList ?? d.nodeStatuses ?? d.nodeTrajectory ?? d.trajectory)
  const currentId = String(d.currentNodeId ?? d.currentNode ?? '')
  let passedCurrent = false
  return flat.map((n) => {
    const id = n.nodeId || ''
    let runState: 'done' | 'current' | 'pending' = stateMap.get(id) || 'pending'
    if (!hasTraces && currentId && runState === 'pending') {
      if (id === currentId) {
        runState = 'current'
        passedCurrent = true
      } else {
        runState = passedCurrent ? 'pending' : 'done'
      }
    }
    return { ...n, runState }
  })
})

/** Timeline 节点描述：处理人 / 结果 / 时间 / 分支入口 */
function nodeDesc(n: TimelineNode): string {
  const parts: string[] = []
  if (n.branchName) parts.push(`入口：${n.branchName}`)
  const assignee = (n as any).assigneeValue || n.assignee || ''
  if (assignee) parts.push(`处理人：${assignee}`)
  const t = n.finishTime || n.endTime || ''
  if (t) parts.push(`时间：${t}`)
  return parts.join('　')
}

/** 流程定义列表缓存，避免切换实例时重复请求 */
let defCache: WorkflowDefinition[] | null = null

/** 根据 processKey 加载全部流程节点（含回退/分支） */
async function loadDefNodes(processKey: string) {
  try {
    if (!defCache) {
      const res = await listWorkflowDefinitions()
      defCache = Array.isArray(res.data) ? res.data : null
    }
    const def = (defCache ?? []).find((x) => x.processKey === processKey)
    const list = def?.nodes ?? []
    defNodes.value = list.length ? normalizeLegacyNodes(list) : []
  } catch {
    defNodes.value = []
  }
}

/** 切换实例并加载其详情（节点轨迹 / 审批记录） */
async function switchInstance(id?: number) {
  const inst = instances.value.find((i) => i.id === id) ?? instances.value[0]
  if (!inst) return
  activeId.value = inst.id
  tabKey.value = String(inst.id)
  detail.value = null
  loading.value = true
  try {
    const proKey = String(inst.processKey || '')
    if (proKey) await loadDefNodes(proKey)
    if (inst.id != null) {
      const d = await getWorkflowInstance(inst.id)
      detail.value = d.data ?? null
      if (!defNodes.value.length && Array.isArray(detail.value?.nodes) && detail.value.nodes.length) {
        defNodes.value = normalizeLegacyNodes(detail.value.nodes).map((n) => ({ ...n }))
      }
    }
  } catch {
    // 忽略：该实例详情加载失败，仅展示基本信息
  } finally {
    loading.value = false
  }
}

/** 按单号加载全部流程实例并切换到最新一次 */
async function loadByIssueKey(issueKey: string) {
  if (!issueKey) return
  loading.value = true
  instances.value = []
  activeId.value = undefined
  detail.value = null
  defNodes.value = []
  tabKey.value = undefined
  try {
    const res = await listWorkflowInstances({ issueKey, pageNum: 1, pageSize: 50 })
    const list = res.data?.list ?? []
    list.sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))
    instances.value = list
    await switchInstance(list[0]?.id)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) loadByIssueKey(props.issueKey)
  },
  { immediate: true }
)

watch(
  () => props.issueKey,
  (v) => {
    if (props.open && v) loadByIssueKey(v)
  }
)
</script>

<template>
  <a-modal
    v-model:open="modalOpen"
    :title="`工作流 · ${activeInstance?.issueKey || ''}`"
    width="640px"
    :footer="null"
    class="wf-modal"
    destroy-on-close
  >
    <a-spin :spinning="loading">
      <template v-if="activeInstance">
        <!-- 同一单号多次发起流程时可切换查看 -->
        <a-tabs
          v-if="instances.length > 1"
          v-model:active-key="tabKey"
          size="small"
          class="wf-instance-tabs"
          @change="(k: string) => switchInstance(Number(k))"
        >
          <a-tab-pane
            v-for="(inst, i) in instances"
            :key="String(inst.id)"
            :tab="`${i + 1}. ${inst.processName || '流程'} · ${wfStatusOf(inst.status).label}`"
          />
        </a-tabs>

        <div class="wf-detail-card">
          <div class="wf-basic">
            <span class="wf-process-name">{{ activeInstance.processName || '-' }}</span>
            <a-tag :color="wfStatusOf(activeInstance.status).color">{{ wfStatusOf(activeInstance.status).label }}</a-tag>
          </div>
          <div class="wf-meta">
            <span>发起人：{{ activeInstance.initiator || '-' }}</span>
            <span>发起时间：{{ activeInstance.createTime || '-' }}</span>
            <span v-if="activeInstance.status === 'RUNNING'" class="wf-current-node">
              当前节点：<b>{{ currentNodeLabel || '-' }}</b>
            </span>
          </div>
        </div>

        <a-divider style="margin: 12px 0 4px">节点轨迹</a-divider>
        <a-timeline v-if="timelineNodes.length" class="wf-timeline" style="margin-top: 8px">
          <a-timeline-item
            v-for="(n, i) in timelineNodes"
            :key="i"
            :color="n.runState === 'done' ? 'green' : n.runState === 'current' ? 'blue' : 'gray'"
            :class="['wf-timeline-item', `wf-timeline-${n.runState}`]"
            :style="{ paddingLeft: `${n.level * 16}px` }"
          >
            <div class="wf-timeline-node">
              <div class="wf-timeline-title">
                <a-badge
                  :status="n.runState === 'done' ? 'success' : n.runState === 'current' ? 'processing' : 'default'"
                  :text="n.nodeName || '未命名'"
                  class="wf-timeline-name"
                />
                <a-tag v-if="n.runState === 'done'" size="small" color="success" class="wf-timeline-tag">已完成</a-tag>
                <a-tag v-else-if="n.runState === 'current'" size="small" color="processing" class="wf-timeline-tag">当前节点</a-tag>
                <a-tag v-else size="small" class="wf-timeline-tag">未开始</a-tag>
              </div>
              <div v-if="nodeDesc(n)" class="wf-timeline-desc">{{ nodeDesc(n) }}</div>
            </div>
          </a-timeline-item>
        </a-timeline>
        <a-empty v-else-if="!loading" description="暂无节点轨迹" style="padding: 16px 0" />

        <template v-if="records.length">
          <a-divider style="margin: 12px 0 4px">审批记录</a-divider>
          <a-timeline style="margin-top: 8px">
            <a-timeline-item v-for="(r, i) in records" :key="i" color="blue">
              <div class="wf-record-head">
                <b>{{ r.operator || r.userNo || '-' }}</b>
                <a-tag color="blue">{{ wfActionLabel(r.action) }}</a-tag>
                <span class="wf-record-time">{{ r.createTime || r.finishTime || '' }}</span>
              </div>
              <div v-if="r.comment" class="wf-record-comment">{{ r.comment }}</div>
            </a-timeline-item>
          </a-timeline>
        </template>
      </template>
      <a-empty v-else-if="!loading" description="该单号暂无工作流流程" style="padding: 32px 0" />
    </a-spin>
  </a-modal>
</template>

<style scoped>
.wf-instance-tabs {
  margin-bottom: 4px;
}
.wf-detail-card {
  padding: 4px 2px;
}
.wf-basic {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wf-process-name {
  font-size: 16px;
  font-weight: 600;
}
.wf-meta {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: #595959;
}
.wf-current-node b {
  color: #1890ff;
}
.wf-record-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wf-record-time {
  margin-left: auto;
  font-size: 12px;
  color: #8c8c8c;
}
.wf-record-comment {
  margin-top: 4px;
  font-size: 13px;
  color: #595959;
}
.wf-timeline {
  padding: 4px 0 12px;
}
.wf-timeline :deep(.ant-timeline-item-content) {
  margin-left: 22px;
  padding-bottom: 8px;
}
.wf-timeline-node {
  display: inline-block;
  width: 100%;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}
.wf-timeline-current .wf-timeline-node {
  background: #e6f7ff;
}
.wf-timeline-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  line-height: 1.4;
}
.wf-timeline-name :deep(.ant-badge-status-text) {
  font-weight: 600;
  font-size: 14px;
}
.wf-timeline-current .wf-timeline-name :deep(.ant-badge-status-text) {
  color: #1890ff;
}
.wf-timeline-done .wf-timeline-name :deep(.ant-badge-status-text) {
  color: #52c41a;
}
.wf-timeline-pending .wf-timeline-name :deep(.ant-badge-status-text) {
  color: #8c8c8c;
}
.wf-timeline-tag {
  margin-inline-end: 0 !important;
}
.wf-timeline-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
}
</style>
