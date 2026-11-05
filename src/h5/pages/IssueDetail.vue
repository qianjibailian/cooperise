<template>
  <div class="h5-page h5-detail">
    <van-nav-bar :title="issueKey" left-arrow fixed placeholder @click-left="goBack">
      <template #right>
        <van-icon name="share-o" size="20" @click="copyLink" />
      </template>
    </van-nav-bar>

    <van-skeleton v-if="loading && !detail" :row="8" class="dt-skeleton" />

    <van-empty v-else-if="!detail" image="error" description="事项不存在或无权查看">
      <van-button round type="primary" size="small" @click="load">重新加载</van-button>
    </van-empty>

    <template v-else>
      <!-- 头部：类型 + 单号 / 概要 / 状态 -->
      <section class="dt-hero">
        <div class="dt-hero-top">
          <span v-if="typeName" class="dt-type">
            <i class="dt-type-dot" :style="{ background: typeColor }" />{{ typeName }}
          </span>
          <span class="dt-space h5-ellipsis" data-no-i18n>{{ detail.baseInfo?.spaceName }}</span>
        </div>
        <h1 class="dt-summary" data-no-i18n @click="editSummary">{{ summary || '未填写概要，点击填写' }}</h1>
        <div class="dt-status-row">
          <span class="h5-status dt-status" :style="{ background: statusColor }" @click="openTransition">
            {{ statusName || '无状态' }}<van-icon name="arrow-down" />
          </span>
          <span v-if="detail.workflowName" class="h5-muted dt-wf h5-ellipsis">{{ detail.workflowName }}</span>
        </div>
      </section>

      <!-- 描述 -->
      <section v-if="descField" class="h5-card dt-desc">
        <div class="dt-block-head">
          <span>{{ descField.name || '描述' }}</span>
          <span v-if="descField.editable !== false" class="dt-edit" @click="openEdit(descField)">编辑</span>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="descHtml" class="dt-rich" data-no-i18n v-html="descHtml" />
        <div v-else class="h5-muted dt-empty-text">暂无描述</div>
      </section>

      <!-- 字段分组 -->
      <template v-for="g in fieldGroups" :key="g.title">
        <div class="h5-section-title">{{ g.title }}</div>
        <van-cell-group inset>
          <van-cell
            v-for="f in g.fields"
            :key="f.id"
            :title="f.name"
            :is-link="canEdit(f)"
            :clickable="canEdit(f)"
            @click="canEdit(f) && openEdit(f)"
          >
            <template #value>
              <span class="dt-value" :class="{ 'h5-muted': !textOf(f) }" data-no-i18n>{{ textOf(f) || '—' }}</span>
            </template>
          </van-cell>
        </van-cell-group>
      </template>

      <!-- 评论 / 动态 -->
      <van-tabs v-model:active="bottomTab" class="dt-tabs" background="transparent" shrink line-width="20px">
        <van-tab name="comments" :title="`评论${comments.length ? ` ${comments.length}` : ''}`">
          <van-empty v-if="!comments.length" image-size="72" description="还没有评论" />
          <van-swipe-cell v-for="c in comments" :key="c.id" :disabled="!c.mine">
            <div class="dt-comment">
              <UserAvatar :user="c.author" :size="30" />
              <div class="dt-comment-main">
                <div class="dt-comment-head">
                  <span class="dt-comment-author" data-no-i18n>{{ authorName(c.author) }}</span>
                  <span class="h5-muted">{{ formatRelative(c.createTime) }}<template v-if="c.edited"> · 已编辑</template></span>
                </div>
                <div v-if="c.quote" class="dt-quote" data-no-i18n>
                  {{ c.quote.deleted ? '原评论已删除' : `${authorName(c.quote.author)}：${c.quote.content}` }}
                </div>
                <div class="dt-comment-text" data-no-i18n>{{ c.content }}</div>
              </div>
            </div>
            <template #right>
              <van-button square type="danger" class="dt-swipe-btn" text="删除" @click="removeComment(c)" />
            </template>
          </van-swipe-cell>
        </van-tab>
        <van-tab name="logs" title="动态">
          <van-empty v-if="!logs.length" image-size="72" description="暂无动态" />
          <van-steps v-else direction="vertical" :active="-1" class="dt-logs">
            <van-step v-for="l in logs" :key="l.id">
              <div class="dt-log-head">
                <span data-no-i18n>{{ authorName(l.operator) }}</span>
                <span class="h5-muted">{{ formatRelative(l.changeTime) }}</span>
              </div>
              <div v-if="l.changeType === 'CREATE'" class="dt-log-text">创建了事项</div>
              <div v-else class="dt-log-text">
                修改了 <b>{{ l.fieldName || l.fieldId }}</b>
                <div class="dt-log-diff" data-no-i18n>
                  <span class="dt-log-old">{{ plain(l.oldValue) || '空' }}</span>
                  <van-icon name="arrow" />
                  <span>{{ plain(l.newValue) || '空' }}</span>
                </div>
              </div>
            </van-step>
          </van-steps>
        </van-tab>
      </van-tabs>

      <div class="h5-action-bar-placeholder" />
      <div class="h5-action-bar">
        <van-button class="dt-comment-btn" round block icon="chat-o" @click="commentOpen = true">写评论</van-button>
        <van-button type="primary" round block icon="exchange" :loading="transitionLoading" @click="openTransition">流转状态</van-button>
      </div>
    </template>

    <!-- 编辑字段 -->
    <van-popup v-model:show="editOpen" position="bottom" round closeable safe-area-inset-bottom class="dt-edit-sheet">
      <div class="dt-edit-title">编辑{{ editingField?.name }}</div>
      <FieldInput
        v-if="editingField"
        v-model="editValue"
        :field="editingField"
        :ctx="{ issueKey }"
      />
      <div class="dt-edit-foot">
        <van-button type="primary" block round :loading="saving" @click="saveEdit">保存</van-button>
      </div>
    </van-popup>

    <!-- 流转：下一步节点 -->
    <van-action-sheet
      v-model:show="transitionOpen"
      :title="transitionTitle"
      :actions="transitionActions"
      cancel-text="取消"
      close-on-click-action
      @select="onTransition"
    />

    <!-- 写评论 -->
    <van-popup v-model:show="commentOpen" position="bottom" round safe-area-inset-bottom class="dt-comment-sheet">
      <van-field
        v-model="commentText"
        type="textarea"
        :autosize="{ minHeight: 88, maxHeight: 200 }"
        placeholder="写下你的评论…"
        maxlength="2000"
        show-word-limit
      />
      <div class="dt-edit-foot">
        <van-button type="primary" block round :disabled="!commentText.trim()" :loading="posting" @click="postComment">发送</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showSuccessToast, showToast } from 'vant'
import {
  changeWorkflowTaskStatus, createIssueComment, deleteIssueComment, getWorkflowNextNodes, patchIssue,
  queryChangeLogs, queryDetail, queryIssueComments,
  type WorkflowNextNode,
} from '@/api/faiz'
import type { DetailData, DetailField, IssueChangeLog, IssueComment, IssueFieldItem } from '@/types/faiz'
import { normalizeFieldType } from '@/types/fieldType'
import { getLoginUsername } from '@/utils/auth'
import { hexOr, objOf } from '@/utils/issue-view'
import { personName } from '@/utils/person'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import FieldInput from '../components/FieldInput.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { displayOf, editValueOf, fieldText, flattenGroupFields, formatRelative, htmlToText } from '../utils'

const route = useRoute()
const router = useRouter()
const issueKey = computed(() => String(route.params.issueKey || ''))

const loading = ref(false)
const detail = ref<DetailData | null>(null)

// ---------------- 数据 ----------------
const allFields = computed<DetailField[]>(() => (detail.value?.layoutGroup || []).flatMap((g) => flattenGroupFields(g)))
const fieldById = (id: string) => allFields.value.find((f) => f.id === id)

const summary = computed(() => {
  const f = fieldById('summary')
  return String(f?.exportValue || f?.value || '')
})
const statusObj = computed(() => objOf(fieldById('status')?.value))
const statusName = computed(() => String(statusObj.value?.name ?? statusObj.value?.statusName ?? ''))
const statusColor = computed(() => hexOr(statusObj.value?.statusColor ?? statusObj.value?.color, '#8a919c'))
const typeObj = computed(() => objOf(fieldById('issuetype')?.value))
const typeName = computed(() => String(typeObj.value?.name ?? typeObj.value?.issueTypeName ?? ''))
const typeColor = computed(() => hexOr(typeObj.value?.issueTypeColor ?? typeObj.value?.color, '#8b6fc0'))

/** 头部已展示、不在字段列表里重复的字段 */
const HEADER_FIELDS = new Set(['summary', 'status', 'issuetype', 'issuekey', 'project', 'space'])
const GROUP_TITLES: Record<string, string> = {
  SUBJECT: '基础信息', PERSON: '人员', TIME: '时间', CUSTOM_FIELD: '自定义信息', SUPPLEMENT: '补充信息',
}

const descField = computed(() => {
  const g = detail.value?.layoutGroup.find((x) => x.type === 'DESCRIPTION')
  return flattenGroupFields(g).find((f) => normalizeFieldType(f.type) === 'RICH_TEXT') || null
})
const descHtml = computed(() => sanitizeHtml(String(descField.value?.value || '')))

const fieldGroups = computed(() => (detail.value?.layoutGroup || [])
  .filter((g) => g.type !== 'DESCRIPTION')
  .map((g) => ({
    title: GROUP_TITLES[g.type] || g.type,
    fields: flattenGroupFields(g).filter((f) => !HEADER_FIELDS.has(f.id) && normalizeFieldType(f.type) !== 'RICH_TEXT'),
  }))
  .filter((g) => g.fields.length))

function textOf(f: DetailField): string {
  return displayOf(f.type, editValueOf(f)) || fieldText(f as IssueFieldItem)
}
function canEdit(f: DetailField) {
  return f.editable !== false && normalizeFieldType(f.type) !== 'LABEL'
}
const authorName = (u: unknown) => (objOf(u) ? personName(objOf(u)!) : '') || '未知用户'
const plain = (v?: string | null) => (v ? htmlToText(v) : '')

async function load() {
  loading.value = true
  try {
    const res = await queryDetail({ key: issueKey.value })
    detail.value = res?.success ? res.data : null
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
  if (detail.value) {
    void loadComments()
    void loadLogs()
  }
}

// ---------------- 编辑字段 ----------------
const editOpen = ref(false)
const editingField = ref<DetailField | null>(null)
const editValue = ref<unknown>(null)
const saving = ref(false)

function openEdit(f: DetailField) {
  editingField.value = f
  editValue.value = editValueOf(f)
  editOpen.value = true
}

function editSummary() {
  const f = fieldById('summary')
  if (f && f.editable !== false) openEdit({ ...f, type: 'TEXT_BOX_MULTI_LINE' })
}

async function saveEdit() {
  const f = editingField.value
  if (!f) return
  if (f.required && (editValue.value == null || editValue.value === '' || (Array.isArray(editValue.value) && !editValue.value.length))) {
    showToast(`${f.name}不能为空`)
    return
  }
  saving.value = true
  try {
    const res = await patchIssue(issueKey.value, [{ fieldId: f.id, fieldValue: editValue.value }])
    if (res?.success) {
      editOpen.value = false
      await load()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---------------- 流转状态 ----------------
const transitionOpen = ref(false)
const transitionLoading = ref(false)
const nextNodes = ref<WorkflowNextNode[]>([])
const transitionTitle = ref('流转到')
const transitionActions = computed(() => nextNodes.value.map((n) => ({
  name: n.nodeName,
  subname: n.isBack ? '回退' : n.branchName || undefined,
  color: n.isBack ? '#ee0a24' : undefined,
  node: n,
})))

async function openTransition() {
  transitionLoading.value = true
  try {
    const res = await getWorkflowNextNodes(issueKey.value)
    if (!res?.success) return
    nextNodes.value = res.data?.nextNodes || []
    if (!nextNodes.value.length) {
      showToast((res.data as Record<string, unknown> | undefined)?.reason as string || '当前状态没有可流转的下一步')
      return
    }
    transitionTitle.value = `当前：${res.data?.currentNodeName || statusName.value}`
    transitionOpen.value = true
  } catch {
    // 请求层已统一提示
  } finally {
    transitionLoading.value = false
  }
}

async function onTransition(a: { node: WorkflowNextNode }) {
  const n = a.node
  try {
    await showConfirmDialog({ title: '流转状态', message: `确定流转到「${n.nodeName}」？` })
  } catch {
    return
  }
  try {
    const res = await changeWorkflowTaskStatus({
      issueKey: issueKey.value,
      targetStatus: n.nodeId,
      statusId: n.statusCode,
      operator: getLoginUsername(),
    })
    if (res?.success) await load()
  } catch {
    // 请求层已统一提示
  }
}

// ---------------- 评论 ----------------
const bottomTab = ref('comments')
const comments = ref<IssueComment[]>([])
const commentOpen = ref(false)
const commentText = ref('')
const posting = ref(false)

async function loadComments() {
  try {
    const res = await queryIssueComments({ key: issueKey.value })
    if (res?.success) comments.value = res.data || []
  } catch {
    // 请求层已统一提示
  }
}

async function postComment() {
  const content = commentText.value.trim()
  if (!content) return
  posting.value = true
  try {
    const res = await createIssueComment({ issueKey: issueKey.value, content })
    if (res?.success) {
      commentText.value = ''
      commentOpen.value = false
      bottomTab.value = 'comments'
      await loadComments()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    posting.value = false
  }
}

async function removeComment(c: IssueComment) {
  try {
    await showConfirmDialog({ title: '删除评论', message: '删除后不可恢复' })
  } catch {
    return
  }
  try {
    const res = await deleteIssueComment(c.id)
    if (res?.success) comments.value = comments.value.filter((x) => x.id !== c.id)
  } catch {
    // 请求层已统一提示
  }
}

// ---------------- 动态 ----------------
const logs = ref<IssueChangeLog[]>([])
async function loadLogs() {
  try {
    const res = await queryChangeLogs({ key: issueKey.value })
    if (res?.success) logs.value = res.data || []
  } catch {
    // 请求层已统一提示
  }
}

// ---------------- 其他 ----------------
function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/issues')
}

/** 复制网页版链接（电脑打开是网页版，手机打开会自动跳到 H5） */
async function copyLink() {
  const link = `${location.origin}/jira/browse/${issueKey.value}`
  try {
    await navigator.clipboard.writeText(link)
    showSuccessToast('链接已复制')
  } catch {
    showToast(link)
  }
}

onMounted(load)
</script>

<style scoped>
.dt-skeleton {
  padding-top: 16px;
}

.dt-hero {
  padding: 14px var(--h5-gutter) 18px;
  background: var(--h5-card);
}

.dt-hero-top {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--h5-text-2);
}

.dt-type {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.dt-type-dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}

.dt-space {
  min-width: 0;
  color: var(--h5-text-3);
}

.dt-summary {
  margin: 10px 0 12px;
  font-size: 20px;
  line-height: 1.4;
  font-weight: 600;
  word-break: break-word;
}

.dt-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dt-status {
  height: 26px;
  gap: 4px;
  padding: 0 10px;
  font-size: 13px;
}

.dt-wf {
  min-width: 0;
  font-size: 12px;
}

.dt-block-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--h5-text-3);
}

.dt-edit {
  color: var(--van-primary-color);
}

.dt-rich {
  font-size: 15px;
  line-height: 1.65;
  word-break: break-word;
  overflow-x: auto;
}

.dt-rich :deep(img) {
  max-width: 100%;
  height: auto;
}

.dt-rich :deep(p) {
  margin: 0 0 6px;
}

.dt-rich :deep(table) {
  border-collapse: collapse;
}

.dt-rich :deep(td),
.dt-rich :deep(th) {
  border: 1px solid var(--h5-border);
  padding: 4px 6px;
}

.dt-empty-text {
  font-size: 14px;
}

.dt-value {
  color: var(--h5-text);
  word-break: break-word;
}

/* 字段行：标签列固定宽度，值占剩余空间（人员「姓名（工号）」一行放得下） */
.h5-detail :deep(.van-cell-group--inset .van-cell__title) {
  flex: 0 0 96px;
  color: var(--h5-text-2);
}

.h5-detail :deep(.van-cell-group--inset .van-cell__value) {
  flex: 1;
  min-width: 0;
}

.dt-tabs {
  margin-top: 20px;
}

.dt-tabs :deep(.van-tabs__content) {
  margin: 8px var(--h5-gutter) 0;
  border-radius: var(--h5-radius);
  overflow: hidden;
  background: var(--h5-card);
}

.dt-comment {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  background: var(--h5-card);
  border-bottom: 1px solid var(--h5-border);
}

.dt-comment-main {
  flex: 1;
  min-width: 0;
}

.dt-comment-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.dt-comment-author {
  font-weight: 600;
  font-size: 13px;
}

.dt-quote {
  margin-top: 6px;
  padding: 6px 8px;
  border-left: 3px solid var(--h5-border);
  background: #f7f8fa;
  font-size: 12px;
  color: var(--h5-text-2);
}

.dt-comment-text {
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.dt-swipe-btn {
  height: 100%;
}

.dt-logs {
  padding-top: 8px;
}

.dt-log-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--h5-text);
}

.dt-log-text {
  margin-top: 4px;
  font-size: 13px;
  color: var(--h5-text-2);
}

.dt-log-diff {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  word-break: break-all;
}

.dt-log-old {
  color: var(--h5-text-3);
  text-decoration: line-through;
}

.dt-comment-btn {
  flex: 0 0 40%;
}

.dt-edit-sheet,
.dt-comment-sheet {
  padding-top: 8px;
}

.dt-edit-title {
  padding: 10px 48px 4px 16px;
  font-size: 16px;
  font-weight: 600;
}

.dt-edit-foot {
  padding: 12px 16px;
}
</style>
