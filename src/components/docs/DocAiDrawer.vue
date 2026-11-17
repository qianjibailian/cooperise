<template>
  <!-- 问问 AI：把正文中选中的内容交给 AI 处理（润色 / 精简 / 扩写 / 修正 / 自定义），结果可替换回选中处 -->
  <a-drawer
    :open="open"
    title="问问 AI"
    placement="right"
    :width="420"
    :mask="false"
    :body-style="{ display: 'flex', flexDirection: 'column', gap: '16px' }"
    @close="close"
  >
    <section class="ai-section">
      <div class="ai-label">选中的内容</div>
      <div v-if="selectedText && wholeDoc" class="ai-whole">已选中整篇正文，替换将覆盖全文</div>
      <div v-if="selectedText" class="ai-quote">{{ selectedText }}</div>
      <div v-else class="ai-empty">请先在正文中选中一段内容，再点击处理方式。</div>
    </section>

    <section class="ai-section">
      <div class="ai-label">处理方式</div>
      <div class="ai-actions">
        <button
          v-for="a in ACTIONS"
          :key="a.key"
          type="button"
          class="ai-action"
          :class="{ 'is-on': action === a.key }"
          @click="action = a.key"
        >
          {{ a.label }}
        </button>
      </div>
    </section>

    <section class="ai-section">
      <div class="ai-label">语气</div>
      <div class="ai-actions">
        <button
          v-for="t in TONES"
          :key="t.key"
          type="button"
          class="ai-action"
          :class="{ 'is-on': tone === t.key }"
          @click="tone = t.key"
        >
          {{ t.label }}
        </button>
      </div>
    </section>

    <section class="ai-section">
      <div class="ai-label">篇幅</div>
      <div class="ai-actions">
        <button
          v-for="l in LENGTHS"
          :key="l.key"
          type="button"
          class="ai-action"
          :class="{ 'is-on': length === l.key }"
          @click="length = l.key"
        >
          {{ l.label }}
        </button>
      </div>
    </section>

    <section class="ai-section ai-layout">
      <div class="ai-layout-head">
        <span class="ai-label">同时优化排版</span>
        <a-switch v-model:checked="layout" size="small" />
      </div>
      <div class="ai-hint">开启后，AI 会把内容整理成标题、有序 / 无序列表、待办、高亮块、引用等结构。</div>
    </section>

    <section class="ai-section">
      <div class="ai-label">自定义要求{{ action === 'custom' ? '（必填）' : '（选填）' }}</div>
      <a-textarea
        v-model:value="instruction"
        :rows="3"
        :maxlength="500"
        show-count
        :placeholder="action === 'custom' ? '告诉 AI 你希望怎么改，例如：改成给客户看的邮件口吻，并分点列出' : '可以补充要求，例如：保留专业术语，不要改动数字'"
        class="ai-instruction"
      />
    </section>

    <div class="ai-run">
      <a-button type="primary" block :loading="loading" :disabled="!canRun" @click="run">
        {{ hasResult ? '重新生成' : '开始处理' }}
      </a-button>
    </div>

    <section v-if="loading || hasResult || errorText" class="ai-section">
      <div class="ai-label">AI 结果</div>
      <div v-if="loading" class="ai-loading">AI 正在处理中…</div>
      <div v-else-if="errorText" class="ai-error">{{ errorText }}</div>
      <template v-else>
        <!-- 结果预览：按顶层元素列出类型与内容（不直接渲染 HTML）；替换时会以原格式写入正文 -->
        <div class="ai-blocks">
          <div v-for="(p, i) in previewItems" :key="i" class="ai-block">
            <span class="ai-block-tag">{{ p.label }}</span>
            <div class="ai-block-text">{{ p.text }}</div>
          </div>
        </div>
        <div class="ai-result-actions">
          <a-button v-if="canReplace" type="primary" size="small" @click="replace">{{ wholeDoc ? '全文替换' : '替换选中内容' }}</a-button>
          <a-button size="small" @click="copy">复制</a-button>
        </div>
        <div v-if="!canReplace" class="ai-hint">当前为只读模式，切换到编辑后可以替换原文。</div>
      </template>
    </section>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { aiPolishText, type AiAction, type AiLength, type AiTone } from '@/api/ai'
import { aiHtmlPlainText, aiHtmlPreview, textToParagraphsHtml, type AiReplacePayload } from '@/utils/ai-blocks'

const props = defineProps<{
  open: boolean
  /** 正文中选中的纯文本 */
  selectedText: string
  /** 正文中选中内容的富文本 HTML（发给 AI 的内容） */
  selectedHtml: string
  /** 当前是否可替换正文（编辑 / 修订模式） */
  canReplace: boolean
  /** 选中的是否为整篇正文：替换时覆盖全文 */
  wholeDoc?: boolean
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  replace: [payload: AiReplacePayload]
}>()

const ACTIONS: { key: AiAction; label: string }[] = [
  { key: 'polish', label: '润色' },
  { key: 'shorten', label: '精简' },
  { key: 'expand', label: '扩写' },
  { key: 'fix', label: '修正' },
  { key: 'custom', label: '自定义' },
]

/** 语气：keep 表示保持原语气（不传给后端） */
const TONES: { key: AiTone | 'keep'; label: string }[] = [
  { key: 'keep', label: '保持' },
  { key: 'formal', label: '正式' },
  { key: 'casual', label: '口语' },
  { key: 'professional', label: '专业' },
  { key: 'friendly', label: '亲切' },
]
/** 篇幅：keep 表示保持原篇幅（不传给后端） */
const LENGTHS: { key: AiLength | 'keep'; label: string }[] = [
  { key: 'keep', label: '保持' },
  { key: 'shorter', label: '更简洁' },
  { key: 'longer', label: '更详细' },
]

const action = ref<AiAction>('polish')
const tone = ref<AiTone | 'keep'>('keep')
const length = ref<AiLength | 'keep'>('keep')
const instruction = ref('')
/** 同时优化排版：返回结构化块（列表、标题、高亮块等），而不只是改文字 */
const layout = ref(false)
const loading = ref(false)
/** AI 结果：富文本 HTML（与文档格式一致；只返回纯文本时会转为段落） */
const resultHtml = ref('')
const errorText = ref('')

const hasResult = computed(() => !!resultHtml.value)
const previewItems = computed(() => aiHtmlPreview(resultHtml.value))

const canRun = computed(() => {
  if (!props.selectedText.trim() || loading.value) return false
  return action.value !== 'custom' || instruction.value.trim().length > 0
})

function clearResult() {
  resultHtml.value = ''
  errorText.value = ''
}

// 选中内容变化：之前的结果不再对应，清空
watch(
  () => props.selectedText,
  () => clearResult(),
)

async function run() {
  if (!canRun.value) return
  loading.value = true
  clearResult()
  try {
    const html = props.selectedHtml || textToParagraphsHtml(props.selectedText)
    const res = await aiPolishText({
      html,
      text: props.selectedText,
      action: action.value,
      tone: tone.value === 'keep' ? undefined : tone.value,
      length: length.value === 'keep' ? undefined : length.value,
      instruction: instruction.value.trim() || undefined,
      layout: layout.value || undefined,
    })
    const out = res.data?.html?.trim() || (res.data?.text?.trim() ? textToParagraphsHtml(res.data.text.trim()) : '')
    if (res.success && out) resultHtml.value = out
    else errorText.value = res.message || 'AI 没有返回结果，请稍后重试'
  } catch {
    errorText.value = 'AI 服务暂不可用，请稍后重试'
  } finally {
    loading.value = false
  }
}

function replace() {
  if (resultHtml.value) emit('replace', { html: resultHtml.value })
}

async function copy() {
  try {
    await navigator.clipboard.writeText(aiHtmlPlainText(resultHtml.value))
    message.success('已复制')
  } catch {
    message.warning('复制失败，请手动复制')
  }
}

function close() {
  emit('update:open', false)
}
</script>

<style scoped>
.ai-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-label {
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
  letter-spacing: 0.2px;
}
.ai-quote {
  max-height: 160px;
  overflow-y: auto;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  white-space: pre-wrap;
  background: #f5f6f8;
  border-left: 3px solid var(--c-primary);
  border-radius: 6px;
}
.ai-whole {
  font-size: 12px;
  font-weight: 500;
  color: var(--c-primary);
}
.ai-empty,
.ai-hint {
  font-size: 13px;
  color: #8c8c8c;
}
.ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ai-action {
  height: 30px;
  padding: 0 14px;
  font-size: 13px;
  color: #374151;
  background: #f3f4f6;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
}
.ai-action:hover {
  background: #e5e7eb;
}
.ai-action.is-on {
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border-color: var(--c-primary);
}
.ai-layout-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ai-blocks {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.ai-block {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.ai-block-tag {
  flex: none;
  padding: 1px 6px;
  font-size: 11px;
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border-radius: 4px;
  line-height: 18px;
}
.ai-block-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #1f2937;
  white-space: pre-wrap;
}
.ai-block-text.is-h1,
.ai-block-text.is-h2,
.ai-block-text.is-h3 {
  font-weight: 650;
}
.ai-block-text.is-callout {
  padding: 6px 10px;
  background: #fff8e6;
  border-left: 3px solid #ffc60a;
  border-radius: 6px;
}
.ai-block-text.is-quote {
  color: #6b7280;
  padding-left: 10px;
  border-left: 3px solid #d1d5db;
}
.ai-result {
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.75;
  color: #1f2937;
  white-space: pre-wrap;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.ai-result-actions {
  display: flex;
  gap: 8px;
}
.ai-loading {
  font-size: 13px;
  color: var(--c-primary);
}
.ai-error {
  font-size: 13px;
  color: #d4380d;
}
</style>
