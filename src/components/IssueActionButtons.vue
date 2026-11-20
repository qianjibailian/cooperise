<template>
  <div class="issue-action-buttons">
    <template v-if="loading && !buttons.length">
      <a-skeleton-button v-for="i in 3" :key="i" active size="small" class="action-skeleton" />
    </template>
    <template v-else>
      <a-button
        v-for="b in shownPlain"
        :key="b.id"
        size="small"
        :danger="b.buttonStyle === 'danger'"
        :class="['action-btn', { 'action-primary': b.buttonStyle === 'primary' }]"
        :type="b.buttonStyle === 'primary' ? 'primary' : 'default'"
        @click="handleClick(b)"
      >
        {{ b.buttonName }}
      </a-button>
      <div v-if="plainButtons.length && workflowButtons.length" class="action-divider" />
      <a-button
        v-for="b in shownWorkflow"
        :key="b.id"
        size="small"
        :danger="b.buttonStyle === 'danger'"
        :class="['action-btn', { 'action-primary': b.buttonStyle === 'primary' }]"
        :type="b.buttonStyle === 'primary' ? 'primary' : 'default'"
        @click="handleClick(b)"
      >
        {{ b.buttonName }}
      </a-button>
      <a-dropdown v-if="props.mode === 'workflow' && workflowButtons.length" trigger="click" placement="bottomLeft">
        <a-button size="small" class="action-btn action-flow">
          状态流转
          <DownOutlined />
        </a-button>
        <template #overlay>
          <a-menu @click="onFlowMenu">
            <a-menu-item v-for="b in workflowButtons" :key="String(b.id)">{{ b.buttonName }}</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <span v-if="!buttons.length && loaded" class="action-empty">暂无可用操作</span>
    </template>

    <!-- EDIT 按钮：编辑弹窗（复用新建弹窗组件） -->
    <NewIssueFormModal v-model:open="editOpen" :issue-key="props.issueKey" @submitted="handleChanged" />
    <!-- ASSIGN 按钮：分配经办人 -->
    <AssignIssueModal v-model:open="assignOpen" :issue-key="props.issueKey" @submitted="handleChanged" />
    <!-- SPLIT 按钮：拆分任务 -->
    <SplitIssueModal v-model:open="splitOpen" :issue-key="props.issueKey" @submitted="handleChanged" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'
import { queryIssueButtonsForIssue, type IssueButtonItem } from '@/api/faiz'
import { isWorkflowButton, runIssueButton } from '@/utils/issueButtons'
import NewIssueFormModal from '@/components/NewIssueFormModal.vue'
import AssignIssueModal from '@/components/AssignIssueModal.vue'
import SplitIssueModal from '@/components/SplitIssueModal.vue'

/**
 * 事项详情的操作按钮：按事项的问题类型 + 当前状态从 /issue-button/issue 拉取，
 * 动作执行后（流转 / 编辑保存）重新拉取按钮并通知父组件刷新详情
 */
const props = withDefaults(defineProps<{
  issueKey: string
  /** 为 false 时不拉取（如抽屉未打开） */
  active?: boolean
  /** 显示范围：all 全部（默认）；plain 只显示普通操作；workflow 只显示流转按钮（收进「状态流转」下拉） */
  mode?: 'all' | 'plain' | 'workflow'
}>(), { active: true, mode: 'all' })

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const loading = ref(false)
const loaded = ref(false)
const buttons = ref<IssueButtonItem[]>([])

/** 普通按钮在左、流转 / 回退按钮在分隔线右侧 */
const plainButtons = computed(() => buttons.value.filter(b => !isWorkflowButton(b)))
const workflowButtons = computed(() => buttons.value.filter(b => isWorkflowButton(b)))
const shownPlain = computed(() => (props.mode === 'workflow' ? [] : plainButtons.value))
const shownWorkflow = computed(() => (props.mode === 'workflow' || props.mode === 'plain' ? [] : workflowButtons.value))
/** 流转下拉：点击菜单项执行对应流转按钮 */
function onFlowMenu({ key }: { key: string | number }) {
  const b = buttons.value.find((x) => String(x.id) === String(key))
  if (b) void handleClick(b)
}

let reqSeq = 0
async function load() {
  const key = props.issueKey
  if (!key) return
  const seq = ++reqSeq
  loading.value = true
  try {
    const res = await queryIssueButtonsForIssue(key)
    if (seq !== reqSeq) return
    buttons.value = res?.success ? res.data || [] : []
  } catch {
    if (seq === reqSeq) buttons.value = []
  } finally {
    if (seq === reqSeq) {
      loading.value = false
      loaded.value = true
    }
  }
}

watch(
  () => [props.issueKey, props.active] as const,
  ([key, active], old) => {
    if (old && old[0] !== key) {
      buttons.value = []
      loaded.value = false
    }
    if (key && active !== false) load()
  },
  { immediate: true },
)

const editOpen = ref(false)
const assignOpen = ref(false)
const splitOpen = ref(false)

async function handleClick(b: IssueButtonItem) {
  const changed = await runIssueButton(b, props.issueKey, {
    onEdit: () => { editOpen.value = true },
    onAssign: () => { assignOpen.value = true },
    onSplit: () => { splitOpen.value = true },
  })
  if (changed) handleChanged()
}

function handleChanged() {
  load()
  emit('changed')
}

defineExpose({ reload: load })
</script>

<style scoped>
.issue-action-buttons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.action-btn {
  height: 32px !important;
  padding: 0 14px !important;
  font-size: 14px !important;
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  border-radius: 6px !important;
  border: none !important;
  background: #f5f5f5 !important;
  font-weight: 500;
  transition: all 0.18s cubic-bezier(.4,0,.2,1) !important;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn.ant-btn-dangerous {
  color: #ff4d4f !important;
}

.action-primary {
  height: 28px !important;
  font-weight: 600 !important;
  color: #fff !important;
  background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-hover) 100%) !important;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--c-primary) 28%, transparent) !important;
  border-color: transparent !important;
}

.action-primary:hover {
  box-shadow: 0 3px 10px color-mix(in srgb, var(--c-primary) 38%, transparent) !important;
}

.action-divider {
  width: 1px;
  height: 16px;
  background: #e8e8e8;
  margin: 0 6px;
}

.action-skeleton {
  width: 64px !important;
  min-width: 64px !important;
}

.action-skeleton :deep(.ant-skeleton-button) {
  width: 64px !important;
  min-width: 64px !important;
  height: 28px !important;
  border-radius: 6px !important;
}

.action-empty {
  font-size: 13px;
  color: #bfbfbf;
}
</style>
