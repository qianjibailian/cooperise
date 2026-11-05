<template>
  <a-modal
    v-model:open="modalOpen"
    :title="`分配经办人 · ${props.issueKey}`"
    :width="440"
    centered
    destroy-on-close
    ok-text="分配"
    cancel-text="取消"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !selected }"
    @ok="handleSubmit"
  >
    <a-select
      v-model:value="selected"
      show-search
      :filter-option="false"
      :loading="searching"
      placeholder="搜索姓名 / 账号"
      :not-found-content="searching ? undefined : '无匹配用户'"
      style="width: 100%"
      @search="onSearch"
    >
      <a-select-option v-for="u in users" :key="personKey(u)" :value="personKey(u)" :title="personLabel(u)">
        <span class="assign-user">
          <a-avatar :src="personAvatar(u) || undefined" :size="20">{{ personInitial(u) }}</a-avatar>
          <span class="assign-user-name">{{ personLabel(u) }}</span>
        </span>
      </a-select-option>
    </a-select>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { assignIssue, queryUsers } from '@/api/faiz'
import type { UserItem } from '@/types/faiz'
import { personAvatar, personInitial, personKey, personLabel } from '@/utils/person'

/** 分配经办人：搜索在职用户，提交 /issue/assign */
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

const users = ref<UserItem[]>([])
const selected = ref<string | undefined>()
const searching = ref(false)
const saving = ref(false)

let searchSeq = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
async function search(keyword: string) {
  const seq = ++searchSeq
  searching.value = true
  try {
    const res = await queryUsers({ keyword, isActive: 1, issueKey: props.issueKey || undefined, page: 1, pageSize: 50 })
    if (seq !== searchSeq) return
    const list = res?.success ? res.data?.list || [] : []
    // 保留已选中的用户，避免搜索后选中项显示为原始 memberId
    const current = users.value.find(u => personKey(u) === selected.value)
    users.value = current && !list.some(u => personKey(u) === selected.value) ? [current, ...list] : list
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

watch(() => props.open, (open) => {
  if (!open) return
  selected.value = undefined
  users.value = []
  search('')
})

async function handleSubmit() {
  if (!selected.value) return
  saving.value = true
  try {
    const res = await assignIssue({ issueKey: props.issueKey, assigneeMemberId: selected.value })
    if (res?.success) {
      const u = users.value.find(x => personKey(x) === selected.value)
      message.success(`已分配给 ${u ? personLabel(u) : selected.value}`)
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
.assign-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}

.assign-user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
