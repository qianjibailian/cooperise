<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { RollbackOutlined } from '@ant-design/icons-vue'
import { getWorkflowNextNodes, changeWorkflowTaskStatus, type WorkflowNextNode } from '@/api/faiz'
import { getLoginUsername } from '@/utils/auth'

const props = defineProps<{
  open: boolean
  issueKey: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'submit', payload: { nodeId: string; nodeName: string; statusId: string }): void
}>()

/** 数据加载完成后再显示弹窗：避免先渲染 loading 空壳，数据回来后一次性呈现 */
const visible = ref(false)

const modalOpen = computed({
  get: () => props.open && visible.value,
  set: (v: boolean) => {
    if (!v) {
      visible.value = false
      emit('update:open', false)
    }
  },
})

/** 当前操作人账号：取登录用户，兼容本地调试写入的 wf_current_user */
const operator = getLoginUsername() || localStorage.getItem('wf_current_user') || '10284941'

const loading = ref(false)
const saving = ref(false)
const currentNodeName = ref('')
const rawNextNodes = ref<WorkflowNextNode[]>([])
/** 无下一节点时后端给出的说明（无匹配流程 / 当前已是末节点等） */
const emptyReason = ref('')

/** 当前节点：接口返回的 currentNodeName */
const currentNode = computed<{ nodeName: string } | null>(() => {
  const name = currentNodeName.value.trim()
  return name ? { nodeName: name } : null
})

/** 下一步节点：接口返回的 nextNodes（正向后续节点 + 回退节点） */
const nextNodes = computed<WorkflowNextNode[]>(() => rawNextNodes.value)

/** 是否回退节点：后端 isBack 标记 */
function isBackNode(n: WorkflowNextNode): boolean {
  return !!n.isBack
}

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
      targetStatus: node.nodeId,
      ...(node.statusCode ? { statusId: node.statusCode } : {}),
      ...(reason ? { reason } : {}),
      ...(comment ? { comment } : {}),
      operator,
    })
    if (res?.success) {
      emit('submit', {
        nodeId: node.nodeId,
        nodeName: node.nodeName || node.nodeId,
        statusId: node.statusCode || node.nodeId,
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
  const seq = ++loadSeq
  loading.value = true
  currentNodeName.value = ''
  rawNextNodes.value = []
  emptyReason.value = ''
  activeNodeId.value = ''
  try {
    // 后端按单号匹配问题类型、流程与当前节点，返回正向后续节点 + 回退节点
    const res = await getWorkflowNextNodes(props.issueKey)
    if (seq !== loadSeq) return
    const data = res?.data ?? null
    currentNodeName.value = String(data?.currentNodeName || data?.currentStatusName || '')
    rawNextNodes.value = Array.isArray(data?.nextNodes) ? data.nextNodes : []
    emptyReason.value = String(data?.reason ?? '')
  } catch {
    // 忽略：加载失败仅展示空态
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

let loadSeq = 0

watch(
  () => [props.open, props.issueKey] as const,
  async ([open, issueKey]) => {
    if (!open || !issueKey) {
      visible.value = false
      return
    }
    // 先请求，数据回来后再打开弹窗
    visible.value = false
    await load()
    if (props.open && props.issueKey === issueKey) visible.value = true
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
    <!-- 数据加载中：先占位，加载完成后一次性渲染内容，避免先出现空壳/高度跳动 -->
    <div v-if="loading" class="nn-loading">
      <a-skeleton active :title="false" :paragraph="{ rows: 6 }" />
    </div>
    <template v-else-if="currentNode">
        <div class="nn-cur">
          <span class="nn-cur-label">当前节点</span>
          <span class="nn-cur-name">
            <span class="nn-cur-dot" aria-hidden="true" />
            {{ currentNode.nodeName }}
          </span>
        </div>

        <div class="nn-arrow" aria-hidden="true">
          <span class="nn-arrow-line" />
          <span class="nn-arrow-icon">↓</span>
        </div>

        <template v-if="nextNodes.length">
          <a-tabs
            v-model:active-key="activeNodeId"
            tab-position="left"
            size="small"
            class="nn-tabs"
          >
            <a-tab-pane v-for="n in nextNodes" :key="n.nodeId">
              <template #tab>
                <span class="nn-tab">
                  {{ n.nodeName || n.nodeId }}
                  <span v-if="isBackNode(n)" class="nn-back-tag"><RollbackOutlined /> 回退</span>
                </span>
              </template>
              <div class="nn-form">
                <div class="nn-form-head">
                  <span class="nn-form-node">{{ n.nodeName || n.nodeId }}</span>
                  <a-tag v-if="isBackNode(n)" color="orange"><RollbackOutlined /> 回退</a-tag>
                  <a-tag v-else-if="n.branchName" color="blue">{{ n.branchName }}</a-tag>
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
                  <a-button @click="modalOpen = false">取消</a-button>
                  <a-button type="primary" :loading="saving" @click="handleSave">提交</a-button>
                </div>
              </div>
            </a-tab-pane>
          </a-tabs>
        </template>
        <a-empty v-else :description="emptyReason || '当前节点暂无下一步节点'" style="padding: 24px 0" />
      </template>
      <a-empty v-else :description="emptyReason || '该单号暂无关联的工作流'" style="padding: 32px 0" />
  </a-modal>
</template>

<style scoped>
/* ---- 弹窗容器：内容区自管内边距，标题栏与表单区分开 ---- */
:global(.wf-next-modal .ant-modal-content) {
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
}
:global(.wf-next-modal .ant-modal-header) {
  margin: 0;
  padding: 20px 24px 14px;
  border-bottom: 1px solid #f0f2f5;
}
:global(.wf-next-modal .ant-modal-title) {
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
}
:global(.wf-next-modal .ant-modal-body) {
  padding: 18px 24px 22px;
}
:global(.wf-next-modal .ant-modal-close) {
  top: 16px;
  inset-inline-end: 18px;
}

/* 数据加载中：固定高度骨架，数据回来后整块替换 */
.nn-loading {
  min-height: 360px;
  padding: 4px 2px;
}

/* ---- 当前节点 ---- */
.nn-cur {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  background: linear-gradient(135deg, #f4f9ff 0%, #eaf3ff 100%);
  border: 1px solid #d8e8ff;
  border-radius: 12px;
}
.nn-cur-label {
  flex-shrink: 0;
  padding: 0 10px;
  font-size: 12px;
  line-height: 22px;
  color: #4a76b8;
  background: #fff;
  border: 1px solid #d8e8ff;
  border-radius: 999px;
}
.nn-cur-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #0b57d0;
}
.nn-cur-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-primary);
  animation: nn-pulse 1.8s ease-out infinite;
}
@keyframes nn-pulse {
  0% { box-shadow: 0 0 0 0 rgba(10, 132, 255, 0.35); }
  70% { box-shadow: 0 0 0 7px rgba(10, 132, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(10, 132, 255, 0); }
}

/* ---- 当前节点 → 目标节点 ---- */
.nn-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 5px 0 3px;
  color: #a9c4ea;
}
.nn-arrow-line {
  width: 1px;
  height: 9px;
  background: linear-gradient(180deg, #d8e8ff, #a9c4ea);
}
.nn-arrow-icon {
  font-size: 13px;
  line-height: 1;
}
/* ---- 左侧节点列表 ---- */
.nn-tabs {
  margin-top: 0;
}
.nn-tabs :deep(.ant-tabs-nav) {
  min-width: 126px;
  padding-right: 16px;
}
.nn-tabs :deep(.ant-tabs-nav::before) {
  border-right: 1px solid #f0f2f5;
}
.nn-tabs :deep(.ant-tabs-tab) {
  margin: 0 0 4px !important;
  padding: 9px 12px !important;
  border-radius: 10px;
  transition: background 0.15s;
}
.nn-tabs :deep(.ant-tabs-tab:hover) {
  background: #f5f7fa;
}
.nn-tabs :deep(.ant-tabs-tab-active) {
  background: var(--c-primary-bg);
}
.nn-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: var(--c-primary) !important;
  font-weight: 600;
}
.nn-tabs :deep(.ant-tabs-ink-bar) {
  display: none;
}
.nn-tabs :deep(.ant-tabs-content-holder) {
  padding-left: 20px;
}
.nn-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.nn-back-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 400;
  line-height: 18px;
  color: #d46b08;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 4px;
}
/* ---- 右侧表单 ---- */
.nn-form {
  padding: 0;
}
.nn-form-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  margin-bottom: 16px;
}
.nn-form-node {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
}
.nn-form-item {
  margin-bottom: 16px;
}
.nn-form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #595959;
}
.nn-textarea.ant-input {
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.nn-textarea.ant-input:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.1);
}
.nn-rt {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e3e6eb;
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.nn-rt:focus-within {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.1);
}
.nn-rt-toolbar {
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  background: #fafbfc;
  border-bottom: 1px solid #f0f2f5;
}
.nn-rt-btn {
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  font-size: 13px;
  line-height: 1;
  color: #6b7280;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.nn-rt-btn:hover {
  color: var(--c-primary);
  background: #eef4ff;
}
.nn-rt-editor {
  min-height: 108px;
  max-height: 180px;
  padding: 10px 12px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
  color: #1f1f1f;
  outline: none;
}
.nn-rt-editor:empty::before {
  content: '请输入内容…';
  color: #b0b3b8;
}
/* ---- 底部操作区 ---- */
.nn-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f2f5;
}
.nn-form-footer :deep(.ant-btn) {
  min-width: 76px;
  border-radius: 8px;
}
</style>
