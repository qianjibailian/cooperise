<template>
  <!-- 云文档「项目管理」：选择事项后插入到文档中（多选，搜索编号或标题） -->
  <a-modal
    :open="open"
    title="选择事项"
    :width="560"
    :footer="null"
    destroy-on-close
    @cancel="close"
  >
    <a-input
      v-model:value="keyword"
      allow-clear
      placeholder="搜索事项编号或标题"
      class="dip-search"
      @change="onKeywordChange"
    />
    <div class="dip-list">
      <div v-if="loading" class="dip-empty">搜索中…</div>
      <div v-else-if="!list.length" class="dip-empty">没有匹配的事项</div>
      <template v-else>
        <label
          v-for="it in list"
          :key="it.issueKey"
          class="dip-item"
          :class="{ 'is-on': !!selected[it.issueKey] }"
        >
          <input type="checkbox" class="dip-check" :checked="!!selected[it.issueKey]" @change="toggle(it)" />
          <span class="dip-key">{{ it.issueKey }}</span>
          <span class="dip-title">{{ it.summary || '未命名事项' }}</span>
          <span v-if="it.statusName" class="dip-status" :style="it.statusColor ? { color: it.statusColor } : undefined">
            {{ it.statusName }}
          </span>
        </label>
      </template>
    </div>
    <div class="dip-foot">
      <span class="dip-count">已选 {{ selectedCount }} 项</span>
      <a-button @click="close">取消</a-button>
      <a-button type="primary" :disabled="!selectedCount" @click="confirm">插入到文档</a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fuzzyQueryIssues, type FuzzyIssueItem } from '@/api/faiz'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [items: FuzzyIssueItem[]]
}>()

const keyword = ref('')
const list = ref<FuzzyIssueItem[]>([])
const loading = ref(false)
/** 已选事项：issueKey → 事项（跨搜索结果保留选择） */
const selected = ref<Record<string, FuzzyIssueItem>>({})
const selectedCount = computed(() => Object.keys(selected.value).length)

/** 编号形如 ABC-123 时按编号模糊匹配，否则按标题模糊匹配 */
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*-\d*$/
let timer: number | undefined
let seq = 0

async function search() {
  const kw = keyword.value.trim()
  const token = ++seq
  loading.value = true
  try {
    const payload = kw
      ? KEY_PATTERN.test(kw)
        ? { issueKey: kw, pageSize: 10 }
        : { summary: kw, pageSize: 10 }
      : { pageSize: 10 }
    const res = await fuzzyQueryIssues(payload)
    if (token !== seq) return
    list.value = res.success && res.data ? res.data.list || [] : []
  } catch {
    if (token === seq) list.value = []
  } finally {
    if (token === seq) loading.value = false
  }
}

function onKeywordChange() {
  window.clearTimeout(timer)
  timer = window.setTimeout(search, 300)
}

// 每次打开：清空搜索词，加载候选列表（已选项保留，便于多次搜索后一起插入）
watch(
  () => props.open,
  (v) => {
    if (!v) return
    keyword.value = ''
    void search()
  },
)

function toggle(it: FuzzyIssueItem) {
  const next = { ...selected.value }
  if (next[it.issueKey]) delete next[it.issueKey]
  else next[it.issueKey] = it
  selected.value = next
}

function close() {
  emit('update:open', false)
}

function confirm() {
  const items = Object.values(selected.value)
  emit('confirm', items)
  selected.value = {}
  keyword.value = ''
  close()
}

</script>

<style scoped>
.dip-search {
  margin-bottom: 12px;
}
.dip-list {
  height: 340px;
  overflow-y: auto;
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius);
}
.dip-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--docs-text-3);
  font-size: 13px;
}
.dip-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  font-size: 14px;
  cursor: pointer;
}
.dip-item + .dip-item {
  border-top: 1px solid var(--docs-border);
}
.dip-item:hover,
.dip-item.is-on {
  background: var(--docs-hover);
}
.dip-check {
  flex: none;
}
.dip-key {
  flex: none;
  color: var(--c-primary);
  font-weight: 500;
}
.dip-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--docs-text);
}
.dip-status {
  flex: none;
  font-size: 12px;
  color: var(--docs-text-2);
}
.dip-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.dip-count {
  margin-right: auto;
  font-size: 13px;
  color: var(--docs-text-3);
}
</style>
