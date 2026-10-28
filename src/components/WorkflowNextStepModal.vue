<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { WorkflowNode } from '@/types/faiz'
import { getWorkflowNextNodes, changeWorkflowTaskStatus } from '@/api/faiz'

const props = defineProps<{
  open: boolean
  issueKey: string
  /** 当前事项的问题类型编码（如 TYPE10001），用于匹配工作流 */
  issueTypeCode?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'submit', payload: { nodeId: string; nodeName: string; statusId: string }): void
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

/** 当前操作人账号（与工作流页面一致的取值约定） */
const operator = localStorage.getItem('wf_current_user') || '10284941'

const loading = ref(false)
const saving = ref(false)
const currentNodeName = ref('')
const rawNextNodes = ref<WorkflowNode[]>([])
const taskId = ref<number | undefined>(undefined)

/** 当前节点：接口返回的 currentNodeName */
const currentNode = computed<{ nodeName: string } | null>(() => {
  const name = currentNodeName.value.trim()
  return name ? { nodeName: name } : null
})

/** 下一步节点：接口直接返回的 nextNodes */
const nextNodes = computed<WorkflowNode[]>(() => rawNextNodes.value)

/** 每个下一步节点的表单数据（按节点 id 隔离：评论（富文本） / 原因） */
interface NextForm {
  comment: string
  reason: string
}
const formMap = reactive<Record<string, NextForm>>({})
const activeNodeId = ref('')

/** 确保节点有独立的表单数据槽，并默认激活第一个节点 */
function ensureForms() {
  const nodes = nextNodes.value
  if (!nodes.length) {
    activeNodeId.value = ''
    return
  }
  for (const n of nodes) {
    if (!formMap[n.nodeId]) formMap[n.nodeId] = { comment: '', reason: '' }
  }
  if (!nodes.some((n) => n.nodeId === activeNodeId.value)) {
    activeNodeId.value = nodes[0].nodeId
  }
}

watch(nextNodes, ensureForms, { immediate: true })

/** 富文本去标签转纯文本（用于提交 comment） */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/** 提交当前 tab：调状态变更接口，targetStatus 传 nodeId，评论/原因一并带上 */
async function handleSave() {
  const node = nextNodes.value.find((n) => n.nodeId === activeNodeId.value)
  if (!node) return
  const form = formMap[activeNodeId.value]
  const comment = stripHtml(form?.comment ?? '')
  const reason = (form?.reason ?? '').trim()
  saving.value = true
  try {
    const res = await changeWorkflowTaskStatus({
      issueKey: props.issueKey,
      ...(taskId.value != null ? { taskId: taskId.value } : {}),
      targetStatus: node.nodeId,
      ...(node.statusId ? { statusId: node.statusId } : {}),
      ...(reason ? { reason } : {}),
      ...(comment ? { comment } : {}),
      operator,
    })
    if (res?.success) {
      emit('submit', {
        nodeId: node.nodeId,
        nodeName: node.nodeName || node.nodeId,
        statusId: node.statusId || node.nodeId,
      })
      modalOpen.value = false
    } else {
      message.error('提交失败')
    }
  } catch {
    message.error('提交失败')
  } finally {
    saving.value = false
  }
}

/** 富文本编辑命令（加粗 / 斜体 / 下划线 / 无序列表），作用于指定节点编辑器 */
function execCmd(cmd: string, nodeId: string) {
  const editor = document.querySelector<HTMLElement>(`.nn-rt-editor[data-rt="${nodeId}"]`)
  editor?.focus()
  document.execCommand(cmd)
}

/** 富文本输入回写对应节点数据（data-rt 标记节点 id） */
function onRtInput(e: Event) {
  const el = e.target as HTMLElement
  const id = el.dataset?.rt
  if (!id || !formMap[id]) return
  formMap[id].comment = el.innerHTML
}

/** 编辑器挂载后回填已有内容（tab 懒渲染时首次创建需要初始化） */
function onRtMounted(vnode: any, nodeId: string) {
  const el = vnode?.el as HTMLElement | null
  if (!el || el.innerHTML) return
  if (formMap[nodeId]?.comment) el.innerHTML = formMap[nodeId].comment
}

async function load() {
  if (!props.issueKey) return
  loading.value = true
  currentNodeName.value = ''
  rawNextNodes.value = []
  taskId.value = undefined
  activeNodeId.value = ''
  try {
    // 仅调下一节点接口：currentNodeName / nextNodes / taskId 均来自其返回
    const res = await getWorkflowNextNodes(props.issueKey, props.issueTypeCode)
    const data = res?.data ?? null
    currentNodeName.value = String(data?.currentNodeName ?? '')
    rawNextNodes.value = Array.isArray(data?.nextNodes) ? (data.nextNodes as WorkflowNode[]) : []
    taskId.value = data?.taskId != null ? Number(data.taskId) : undefined
  } catch {
    // 忽略：加载失败仅展示空态
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.issueKey, props.issueTypeCode] as const,
  ([open, issueKey]) => {
    if (open && issueKey) load()
  }
)
</script>

<template>
  <a-modal
    v-model:open="modalOpen"
    :title="`状态变更 · ${props.issueKey}`"
    width="620px"
    :footer="null"
    class="wf-next-modal"
  >
    <a-spin :spinning="loading">
      <template v-if="currentNode">
        <div class="nn-cur">
          <span class="nn-cur-label">当前节点</span>
          <a-badge status="processing" :text="currentNode.nodeName" class="nn-cur-name" />
        </div>

        <div class="nn-arrow">↓</div>

        <template v-if="nextNodes.length">
          <a-tabs
            v-model:active-key="activeNodeId"
            tab-position="left"
            size="small"
            class="nn-tabs"
          >
            <a-tab-pane
              v-for="n in nextNodes"
              :key="n.nodeId"
              :tab="n.nodeName || n.nodeId"
            >
              <div class="nn-form">
                <div class="nn-form-head">
                  <span class="nn-form-node">{{ n.nodeName || n.nodeId }}</span>
                  <a-tag v-if="n.branchName" size="small" color="blue">{{ n.branchName }}</a-tag>
                </div>

                <div class="nn-form-item">
                  <label class="nn-form-label">评论</label>
                  <div class="nn-rt">
                    <div class="nn-rt-toolbar">
                      <button type="button" class="nn-rt-btn" title="加粗" @mousedown.prevent @click="execCmd('bold', n.nodeId)"><b>B</b></button>
                      <button type="button" class="nn-rt-btn" title="斜体" @mousedown.prevent @click="execCmd('italic', n.nodeId)"><i>I</i></button>
                      <button type="button" class="nn-rt-btn" title="下划线" @mousedown.prevent @click="execCmd('underline', n.nodeId)"><u>U</u></button>
                      <button type="button" class="nn-rt-btn" title="无序列表" @mousedown.prevent @click="execCmd('insertUnorderedList', n.nodeId)">•≡</button>
                    </div>
                    <div
                      class="nn-rt-editor"
                      contenteditable="true"
                      :data-rt="n.nodeId"
                      @input="onRtInput"
                      @vue:mounted="(v: any) => onRtMounted(v, n.nodeId)"
                    ></div>
                  </div>
                </div>

                <div class="nn-form-item">
                  <label class="nn-form-label">原因</label>
                  <a-textarea
                    v-model:value="formMap[n.nodeId].reason"
                    :rows="2"
                    placeholder="请输入原因"
                    class="nn-textarea"
                  />
                </div>

                <div class="nn-form-footer">
                  <a-button size="small" @click="modalOpen = false">取消</a-button>
                  <a-button size="small" type="primary" :loading="saving" @click="handleSave">提交</a-button>
                </div>
              </div>
            </a-tab-pane>
          </a-tabs>
        </template>
        <a-empty v-else description="当前节点暂无下一步节点" style="padding: 24px 0" />
      </template>
      <a-empty v-else-if="!loading" description="该单号暂无运行中的流程" style="padding: 32px 0" />
    </a-spin>
  </a-modal>
</template>

<style scoped>
.nn-cur {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #e6f4ff;
  border: 1px solid #91caff;
  border-radius: 8px;
}
.nn-cur-label {
  font-size: 12px;
  color: #1677ff;
  background: #fff;
  border: 1px solid #91caff;
  border-radius: 10px;
  padding: 0 8px;
  line-height: 20px;
  flex-shrink: 0;
}
.nn-cur-name :deep(.ant-badge-status-text) {
  font-size: 15px;
  font-weight: 600;
  color: #0958d9;
}
.nn-arrow {
  text-align: center;
  font-size: 18px;
  color: #1677ff;
  line-height: 1;
  padding: 10px 0 4px;
}
.nn-tabs {
  margin-top: 4px;
}
.nn-tabs :deep(.ant-tabs-nav) {
  min-width: 110px;
}
.nn-tabs :deep(.ant-tabs-tab) {
  font-size: 13px;
  padding: 6px 4px;
}
.nn-tabs :deep(.ant-tabs-tab-active) {
  font-weight: 600;
}
.nn-form {
  padding: 2px 4px 0 8px;
}
.nn-form-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.nn-form-node {
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}
.nn-form-item {
  margin-bottom: 12px;
}
.nn-form-label {
  display: block;
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 6px;
  font-weight: 500;
}
.nn-textarea {
  font-size: 13px;
}
.nn-rt {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;
}
.nn-rt-toolbar {
  display: flex;
  gap: 4px;
  padding: 4px 6px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}
.nn-rt-btn {
  min-width: 26px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 4px;
  font-size: 13px;
  color: #595959;
  cursor: pointer;
  line-height: 1;
}
.nn-rt-btn:hover {
  background: #e6f4ff;
  color: #1677ff;
  border-color: #91caff;
}
.nn-rt-editor {
  min-height: 90px;
  max-height: 180px;
  overflow-y: auto;
  padding: 8px 10px;
  font-size: 13px;
  color: #262626;
  outline: none;
}
.nn-rt-editor:empty::before {
  content: '请输入内容…';
  color: #bfbfbf;
}
.nn-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
