<template>
  <a-modal
    v-model:open="modalOpen"
    :title="`拆分任务 · ${props.issueKey}`"
    :width="620"
    centered
    destroy-on-close
    ok-text="拆分"
    cancel-text="取消"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !validCount }"
    @ok="handleSubmit"
  >
    <div class="split-hint">子任务沿用当前事项的空间与问题类型，父级工单为 {{ props.issueKey }}，状态从流程起点开始。</div>
    <div class="split-rows">
      <div v-for="(row, idx) in rows" :key="row.key" class="split-row">
        <span class="split-index">{{ idx + 1 }}</span>
        <a-input
          v-model:value="row.summary"
          placeholder="子任务概要"
          :maxlength="255"
          class="split-summary"
          @press-enter="onRowEnter(idx)"
        />
        <a-select
          v-model:value="row.assignee"
          show-search
          allow-clear
          :filter-option="false"
          :loading="searching"
          placeholder="经办人（选填）"
          class="split-assignee"
          @search="onSearch"
          @focus="onAssigneeFocus"
        >
          <a-select-option v-for="u in users" :key="personKey(u)" :value="personKey(u)" :title="personLabel(u)">
            <span class="split-user">
              <a-avatar :src="personAvatar(u) || undefined" :size="18">{{ personInitial(u) }}</a-avatar>
              <span class="split-user-name">{{ personLabel(u) }}</span>
            </span>
          </a-select-option>
        </a-select>
        <button type="button" class="split-remove" :disabled="rows.length <= 1" aria-label="删除" @click="removeRow(idx)">
          <DeleteOutlined />
        </button>
      </div>
    </div>
    <button type="button" class="split-add" :disabled="rows.length >= MAX_ROWS" @click="addRow()">
      <PlusOutlined /> 添加子任务
    </button>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { queryUsers, splitIssue } from '@/api/faiz'
import type { UserItem } from '@/types/faiz'
import { personAvatar, personInitial, personKey, personLabel } from '@/utils/person'

/** 拆分任务：逐行填写子任务概要（经办人选填），提交 /issue/split 批量创建 */
const props = defineProps<{
  open: boolean
  issueKey: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'submitted'): void
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

/** 与后端一次最多拆分的条数一致 */
const MAX_ROWS = 50

interface SplitRow { key: number; summary: string; assignee?: string }
let rowSeq = 0
const rows = ref<SplitRow[]>([])
function addRow() {
  if (rows.value.length >= MAX_ROWS) return
  rows.value.push({ key: ++rowSeq, summary: '' })
}
function removeRow(idx: number) {
  rows.value.splice(idx, 1)
}
/** 最后一行回车：追加新行并聚焦 */
async function onRowEnter(idx: number) {
  if (idx !== rows.value.length - 1 || !rows.value[idx].summary.trim()) return
  addRow()
  await nextTick()
  const inputs = document.querySelectorAll<HTMLInputElement>('.split-summary input, input.split-summary')
  inputs[inputs.length - 1]?.focus()
}

const validCount = computed(() => rows.value.filter(r => r.summary.trim()).length)

// ---- 经办人搜索（所有行共用一份候选） ----
const users = ref<UserItem[]>([])
const searching = ref(false)
let searchSeq = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
async function search(keyword: string) {
  const seq = ++searchSeq
  searching.value = true
  try {
    const res = await queryUsers({ keyword, isActive: 1, issueKey: props.issueKey || undefined, page: 1, pageSize: 50 })
    if (seq !== searchSeq) return
    const list = res?.success ? res.data?.list || [] : []
    // 保留各行已选用户，避免搜索后已选项显示为原始 memberId
    const picked = new Set(rows.value.map(r => r.assignee).filter(Boolean))
    const kept = users.value.filter(u => picked.has(personKey(u)) && !list.some(x => personKey(x) === personKey(u)))
    users.value = [...kept, ...list]
  } catch {
    // 请求层已统一提示
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}
function onSearch(keyword: string) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => search(keyword.trim()), 300)
}
/** 聚焦时恢复完整候选（上一行搜索后列表可能被过滤） */
function onAssigneeFocus() {
  search('')
}

watch(() => props.open, (open) => {
  if (!open) return
  rows.value = []
  addRow()
  users.value = []
  search('')
})

const saving = ref(false)
async function handleSubmit() {
  const items = rows.value
    .filter(r => r.summary.trim())
    .map(r => ({ summary: r.summary.trim(), ...(r.assignee ? { assigneeMemberId: r.assignee } : {}) }))
  if (!items.length) return
  saving.value = true
  try {
    const res = await splitIssue({ issueKey: props.issueKey, items })
    if (res?.success) {
      message.success(`已拆分 ${res.data?.length ?? items.length} 个子任务${res.data?.length ? `：${res.data.join('、')}` : ''}`)
      modalOpen.value = false
      emit('submitted')
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.split-hint {
  margin-bottom: 12px;
  font-size: 12px;
  color: #86868b;
}

.split-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 52vh;
  overflow-y: auto;
}

.split-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.split-index {
  width: 20px;
  flex-shrink: 0;
  font-size: 12px;
  color: #aeaeb2;
  text-align: right;
}

.split-summary {
  flex: 1;
  min-width: 0;
}

.split-assignee {
  width: 180px;
  flex-shrink: 0;
}

.split-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.split-user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.split-remove {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.split-remove:hover:not(:disabled) {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.08);
}

.split-remove:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.split-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 4px 8px 4px 28px;
  font-size: 13px;
  color: var(--c-primary);
  background: transparent;
  border: none;
  cursor: pointer;
}

.split-add:disabled {
  color: #bfbfbf;
  cursor: not-allowed;
}

@media (max-width: 560px) {
  .split-row {
    flex-wrap: wrap;
  }

  .split-assignee {
    width: calc(100% - 64px);
    margin-left: 28px;
  }
}
</style>
