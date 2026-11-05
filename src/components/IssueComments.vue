<template>
  <div class="issue-comments">
    <!-- 评论列表 -->
    <a-spin :spinning="loading">
      <div v-if="comments.length" class="ic-list">
        <div
          v-for="c in pagedComments"
          :id="`ic-${c.id}`"
          :key="c.id"
          :class="['ic-item', { 'ic-item-flash': flashId === c.id }]"
        >
          <a-avatar :size="28" :src="authorAvatar(c) || undefined" class="ic-avatar">{{ authorInitial(c) }}</a-avatar>
          <div class="ic-main">
            <div class="ic-meta">
              <span class="ic-name">{{ authorName(c) }}</span>
              <span class="ic-time">{{ formatTime(c.createTime) }}</span>
              <span v-if="c.edited" class="ic-edited" :title="`编辑于 ${formatTime(c.updateTime)}`">（已编辑）</span>
              <span v-if="editingId !== c.id" class="ic-actions">
                <a class="ic-action" @click="startQuote(c)">引用</a>
                <template v-if="c.mine">
                  <a class="ic-action" @click="startEdit(c)">编辑</a>
                  <a-popconfirm title="确定删除这条评论？" ok-text="删除" cancel-text="取消" :ok-button-props="{ danger: true }" @confirm="remove(c)">
                    <a class="ic-action ic-action-danger">删除</a>
                  </a-popconfirm>
                </template>
              </span>
            </div>
            <!-- 引用块：点击跳到原评论 -->
            <div
              v-if="c.quote"
              :class="['ic-quote', { 'ic-quote-deleted': c.quote.deleted }]"
              :title="c.quote.deleted ? '' : '点击定位到原评论'"
              @click="!c.quote.deleted && jumpTo(c.quote.id)"
            >
              <template v-if="c.quote.deleted">原评论已删除</template>
              <template v-else>
                <span class="ic-quote-author">{{ quoteAuthorName(c.quote) }}：</span>
                <span class="ic-quote-text">{{ c.quote.content }}</span>
              </template>
            </div>
            <template v-if="editingId === c.id">
              <div @keydown.enter.ctrl.prevent="saveEdit(c)" @keydown.enter.meta.prevent="saveEdit(c)">
                <MentionInput
                  v-model:value="editDraft"
                  :rows="3"
                  :maxlength="MAX_LENGTH"
                  :options="mentionOptions"
                  :loading="mentionLoading"
                  :filter-option="false"
                  class="ic-input"
                  @search="onMentionSearch"
                >
                  <template #option="opt">
                    <span class="ic-mention-option">
                      <a-avatar :size="20" :src="opt.avatar || undefined" class="ic-mention-avatar">{{ opt.initial }}</a-avatar>
                      <span class="ic-mention-name">{{ opt.label }}</span>
                    </span>
                  </template>
                </MentionInput>
              </div>
              <div class="ic-edit-footer">
                <a-button size="small" @click="editingId = null">取消</a-button>
                <a-button type="primary" size="small" :loading="savingEdit" :disabled="!editDraft.trim()" @click="saveEdit(c)">保存</a-button>
              </div>
            </template>
            <div v-else class="ic-content"><template v-for="(seg, i) in splitMentions(c.content)" :key="i"><span v-if="seg.mention" class="ic-mention">{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></div>
          </div>
        </div>
      </div>
      <div v-else-if="!loading" class="ic-empty">暂无评论，来写第一条吧</div>
      <a-pagination
        v-if="comments.length > PAGE_SIZE"
        v-model:current="page"
        :page-size="PAGE_SIZE"
        :total="comments.length"
        size="small"
        :show-size-changer="false"
        :show-total="(t: number) => `共 ${t} 条`"
        class="ic-pager"
      />
    </a-spin>

    <!-- 发表评论：放在列表下方，按时间正序阅读后直接接着写 -->
    <div class="ic-composer">
      <div v-if="quoting" class="ic-quoting">
        <span class="ic-quoting-label">引用</span>
        <span class="ic-quote-author">{{ authorName(quoting) }}：</span>
        <span class="ic-quote-text">{{ quoting.content }}</span>
        <CloseOutlined class="ic-quoting-close" title="取消引用" @click="quoting = null" />
      </div>
      <!-- Ctrl + Enter 挂在外层：a-mentions 内部的 keydown 会覆盖直接绑在组件上的监听 -->
      <div @keydown.enter.ctrl.prevent="submit" @keydown.enter.meta.prevent="submit">
        <MentionInput
          ref="composerRef"
          v-model:value="draft"
          :rows="3"
          :maxlength="MAX_LENGTH"
          :options="mentionOptions"
          :loading="mentionLoading"
          :filter-option="false"
          placement="top"
          placeholder="写下评论，输入 @ 提及成员，Ctrl + Enter 发送"
          class="ic-input"
          @search="onMentionSearch"
        >
          <template #option="opt">
            <span class="ic-mention-option">
              <a-avatar :size="20" :src="opt.avatar || undefined" class="ic-mention-avatar">{{ opt.initial }}</a-avatar>
              <span class="ic-mention-name">{{ opt.label }}</span>
            </span>
          </template>
        </MentionInput>
      </div>
      <div class="ic-composer-footer">
        <span class="ic-count">{{ draft.length }} / {{ MAX_LENGTH }}</span>
        <a-button type="primary" size="small" :loading="submitting" :disabled="!draft.trim()" @click="submit">发表评论</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { CloseOutlined } from '@ant-design/icons-vue'
import MentionInput from '@/components/MentionInput.vue'
import {
  queryIssueComments, createIssueComment, updateIssueComment, deleteIssueComment, queryUsers,
} from '@/api/faiz'
import type { IssueComment, IssueCommentQuote } from '@/types/faiz'
import { personAccount, personAvatar, personInitial, personLabel, personName } from '@/utils/person'

/**
 * 事项评论：详情抽屉 / 详情页「活动日志 → 评论」共用
 * 列表按时间正序展示、输入框在下方；自己的评论可编辑 / 删除（后端按 mine 控制）
 */
const props = defineProps<{ issueKey: string }>()

const emit = defineEmits<{
  /** 评论数变化（用于 tab 标题计数） */
  (e: 'count', n: number): void
}>()

/** 与后端 IssueCommentSaveRequest 的长度限制一致 */
const MAX_LENGTH = 5000

const comments = ref<IssueComment[]>([])
const loading = ref(false)

let loadSeq = 0
async function load() {
  const key = props.issueKey
  if (!key) return
  const seq = ++loadSeq
  loading.value = true
  try {
    const res = await queryIssueComments({ key })
    if (seq !== loadSeq) return
    comments.value = res?.success && Array.isArray(res.data) ? res.data : []
    page.value = lastPage.value
  } catch {
    // 请求层已统一提示，保留已有评论
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}


watch(() => comments.value.length, n => emit('count', n), { immediate: true })

/** 接口按时间倒序返回；输入框在列表下方，展示改为正序，最新评论贴近输入框 */
const orderedComments = computed(() => [...comments.value].reverse())

/** 前端分页：每页 10 条，时间正序，默认看最后一页（最新评论） */
const PAGE_SIZE = 10
const page = ref(1)
const lastPage = computed(() => Math.max(1, Math.ceil(comments.value.length / PAGE_SIZE)))
const pagedComments = computed(() => orderedComments.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
/** 删除后页数变少时不留在空页 */
watch(lastPage, (n) => { if (page.value > n) page.value = n })

// ---- @ 提及：输入 @ 后按关键字搜索在职成员，选中插入「@姓名 」 ----
interface MentionOption { value: string; label: string; key: string; avatar: string; initial: string }
const mentionOptions = ref<MentionOption[]>([])
const mentionLoading = ref(false)
let mentionSeq = 0
let mentionTimer: ReturnType<typeof setTimeout> | undefined
function onMentionSearch(keyword: string) {
  clearTimeout(mentionTimer)
  mentionLoading.value = true
  mentionTimer = setTimeout(async () => {
    const seq = ++mentionSeq
    try {
      const res = await queryUsers({ keyword: keyword.trim(), isActive: 1, issueKey: props.issueKey || undefined, page: 1, pageSize: 20 })
      if (seq !== mentionSeq) return
      const seen = new Set<string>()
      mentionOptions.value = (res?.data?.list || []).flatMap((u) => {
        const person = u as unknown as Record<string, unknown>
        // 插入文本用姓名（无空格，便于高亮识别）；同名时下拉里靠账号区分
        const name = (personName(person) || personAccount(person) || '').replace(/\s+/g, '')
        const key = String(u.memberId || u.userNo || name)
        if (!name || seen.has(key)) return []
        seen.add(key)
        return [{ value: name, key, label: personLabel(person) || name, avatar: personAvatar(person), initial: personInitial(person) }]
      })
    } catch {
      if (seq === mentionSeq) mentionOptions.value = []
    } finally {
      if (seq === mentionSeq) mentionLoading.value = false
    }
  }, 200)
}

/** 评论内容拆段：@xxx 高亮（@ 后到空白或下一个 @ 为止） */
function splitMentions(text: string): { text: string; mention: boolean }[] {
  const segs: { text: string; mention: boolean }[] = []
  let last = 0
  for (const m of text.matchAll(/@[^\s@]+/g)) {
    const i = m.index ?? 0
    if (i > last) segs.push({ text: text.slice(last, i), mention: false })
    segs.push({ text: m[0], mention: true })
    last = i + m[0].length
  }
  if (last < text.length) segs.push({ text: text.slice(last), mention: false })
  return segs
}

// ---- 引用 ----
/** 正在引用的评论（发表时带上 quoteId） */
const quoting = ref<IssueComment | null>(null)
const composerRef = ref<{ focus: () => void } | null>(null)
function startQuote(c: IssueComment) {
  quoting.value = c
  nextTick(() => composerRef.value?.focus())
}

/** 高亮中的评论（点击引用块跳转后短暂高亮） */
const flashId = ref<number | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
async function jumpTo(id: number) {
  const idx = orderedComments.value.findIndex(x => x.id === id)
  if (idx < 0) return
  const target = Math.floor(idx / PAGE_SIZE) + 1
  if (target !== page.value) {
    page.value = target
    await nextTick()
  }
  const el = document.getElementById(`ic-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashId.value = id
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flashId.value = null }, 1600)
}

function quoteAuthorName(q: IssueCommentQuote) {
  return (q.author && personLabel(q.author)) || q.authorId || '未知用户'
}

// ---- 发表 ----
const draft = ref('')
const submitting = ref(false)
async function submit() {
  const content = draft.value.trim()
  if (!content || submitting.value) return
  submitting.value = true
  try {
    const quoteId = quoting.value?.id
    const res = await createIssueComment({ issueKey: props.issueKey, content, ...(quoteId ? { quoteId } : {}) })
    if (res?.success) {
      draft.value = ''
      quoting.value = null
      // 接口返回新评论时直接插到最前，否则重新拉取
      if (res.data?.id) {
        comments.value = [res.data, ...comments.value]
        page.value = lastPage.value
      } else {
        load()
      }
    }
  } catch {
    // 请求层已统一提示，保留草稿
  } finally {
    submitting.value = false
  }
}

// ---- 编辑 ----
const editingId = ref<number | null>(null)
const editDraft = ref('')
const savingEdit = ref(false)
function startEdit(c: IssueComment) {
  editingId.value = c.id
  editDraft.value = c.content
}
async function saveEdit(c: IssueComment) {
  const content = editDraft.value.trim()
  if (!content || savingEdit.value) return
  if (content === c.content) {
    editingId.value = null
    return
  }
  savingEdit.value = true
  try {
    const res = await updateIssueComment({ id: c.id, content })
    if (res?.success) {
      const idx = comments.value.findIndex(x => x.id === c.id)
      if (idx >= 0) comments.value[idx] = res.data?.id ? res.data : { ...c, content, edited: true }
      editingId.value = null
    }
  } catch {
    // 请求层已统一提示
  } finally {
    savingEdit.value = false
  }
}

// ---- 删除 ----
async function remove(c: IssueComment) {
  try {
    const res = await deleteIssueComment(c.id)
    if (res?.success) {
      comments.value = comments.value
        .filter(x => x.id !== c.id)
        .map(x => (x.quote?.id === c.id ? { ...x, quote: { id: c.id, deleted: true } } : x))
      if (quoting.value?.id === c.id) quoting.value = null
    }
  } catch {
    // 请求层已统一提示
  }
}

// ---- 切换事项：清空并重新拉取（放在所有状态声明之后：immediate 会在 setup 时立即执行，
// 提前引用 draft / editingId 会因暂时性死区报错，导致整个组件不渲染、也不发请求） ----
watch(() => props.issueKey, (key, old) => {
  if (key !== old) {
    comments.value = []
    draft.value = ''
    editingId.value = null
    quoting.value = null
  }
  load()
}, { immediate: true })

// ---- 展示 ----
function authorName(c: IssueComment) {
  return (c.author && personLabel(c.author)) || c.authorId || '未知用户'
}
function authorAvatar(c: IssueComment) {
  return c.author ? personAvatar(c.author) : ''
}
function authorInitial(c: IssueComment) {
  return c.author ? personInitial(c.author) : (c.authorId || '?').charAt(0)
}
function formatTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : ''
}

defineExpose({ reload: load })
</script>

<style scoped>
.issue-comments {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ic-composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid #f2f2f5;
}

.ic-input {
  border-radius: 8px;
}

.ic-composer-footer,
.ic-edit-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.ic-edit-footer {
  margin-top: 6px;
}

.ic-count {
  margin-right: auto;
  font-size: 12px;
  color: #aeaeb2;
}

.ic-list {
  display: flex;
  flex-direction: column;
}

.ic-item {
  display: flex;
  gap: 10px;
  padding: 12px 0;
}

.ic-item + .ic-item {
  border-top: 1px solid #f2f2f5;
}

.ic-avatar {
  flex-shrink: 0;
  font-size: 12px;
  background: var(--c-primary);
}

.ic-main {
  flex: 1;
  min-width: 0;
}

.ic-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.ic-name {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}

.ic-time,
.ic-edited {
  color: #8e8e93;
}

.ic-actions {
  display: inline-flex;
  gap: 10px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s;
}

.ic-item:hover .ic-actions,
.ic-actions:focus-within {
  opacity: 1;
}

.ic-action {
  color: #6e6e73;
}

.ic-action:hover {
  color: var(--c-primary);
}

.ic-action-danger:hover {
  color: #ff3b30;
}

.ic-quote {
  display: -webkit-box;
  margin: 2px 0 6px;
  padding: 4px 10px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
  background: #f5f5f7;
  border-left: 3px solid #d1d1d6;
  border-radius: 0 6px 6px 0;
  cursor: pointer;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: pre-wrap;
  word-break: break-word;
}

.ic-quote:hover {
  border-left-color: var(--c-primary);
}

.ic-quote-deleted {
  font-style: italic;
  color: #aeaeb2;
  cursor: default;
}

.ic-quote-deleted:hover {
  border-left-color: #d1d1d6;
}

.ic-quote-author {
  font-weight: 500;
  color: #3a3a3c;
}

.ic-quoting {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
  background: #f5f5f7;
  border-left: 3px solid var(--c-primary);
  border-radius: 0 6px 6px 0;
}

.ic-quoting .ic-quote-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ic-quoting-label {
  flex-shrink: 0;
  color: var(--c-primary);
}

.ic-quoting-close {
  flex-shrink: 0;
  margin-top: 4px;
  font-size: 11px;
  color: #8e8e93;
  cursor: pointer;
}

.ic-quoting-close:hover {
  color: #1d1d1f;
}

.ic-item-flash {
  animation: ic-flash 1.6s ease;
}

@keyframes ic-flash {
  0%, 40% { background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
  100% { background: transparent; }
}

.ic-mention-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}

.ic-mention-avatar {
  flex-shrink: 0;
  font-size: 11px;
  background: var(--c-primary);
}

.ic-mention-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ic-mention {
  padding: 0 2px;
  font-weight: 500;
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
  border-radius: 4px;
}

.ic-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.ic-content {
  font-size: 13px;
  line-height: 1.6;
  color: #1d1d1f;
  white-space: pre-wrap;
  word-break: break-word;
}

.ic-empty {
  padding: 24px 0;
  font-size: 13px;
  color: #aeaeb2;
  text-align: center;
}

/* 触屏没有 hover：操作一直显示 */
@media (hover: none) {
  .ic-actions {
    opacity: 1;
  }
}
</style>
