<template>
  <div class="form-editor">
    <a-segmented v-model:value="tab" :options="TAB_OPTIONS" class="form-tabs" />

    <!-- 编辑：题目 -->
    <div v-if="tab === 'edit'" class="form-panel">
      <a-textarea
        v-model:value="data.description"
        placeholder="表单说明（选填）"
        :rows="2"
        :maxlength="500"
        @change="emitChange"
      />
      <div v-for="(q, qi) in data.questions" :key="q.id" class="question-card">
        <div class="question-head">
          <span class="question-index">{{ qi + 1 }}</span>
          <a-input v-model:value="q.title" :maxlength="200" placeholder="题目" @change="emitChange" />
          <a-select v-model:value="q.type" class="type-select" :options="TYPE_OPTIONS" @change="onTypeChange(q)" />
          <a-button type="text" danger @click="removeQuestion(qi)">删除</a-button>
        </div>
        <div class="question-meta">
          <span>必填</span>
          <a-switch v-model:checked="q.required" size="small" @change="emitChange" />
        </div>
        <div v-if="hasOptions(q)" class="option-list">
          <div v-for="(opt, oi) in q.options" :key="opt.id" class="option-row">
            <span class="option-index">{{ oi + 1 }}</span>
            <a-input v-model:value="opt.text" :maxlength="100" placeholder="选项内容" @change="emitChange" />
            <a-button type="text" danger :disabled="(q.options || []).length <= 2" @click="removeOption(q, oi)">删除</a-button>
          </div>
          <a-button type="dashed" size="small" :disabled="(q.options || []).length >= 20" @click="addOption(q)">+ 添加选项</a-button>
        </div>
      </div>
      <a-button type="dashed" block @click="addQuestion">+ 添加题目</a-button>
    </div>

    <!-- 填写：提交我的答案 -->
    <div v-else-if="tab === 'fill'" class="form-panel">
      <p v-if="data.description" class="form-desc">{{ data.description }}</p>
      <div v-for="(q, qi) in data.questions" :key="q.id" class="fill-item">
        <div class="fill-title">
          <span>{{ qi + 1 }}. {{ q.title || '未命名题目' }}</span>
          <span v-if="q.required" class="required">*</span>
        </div>
        <a-radio-group v-if="q.type === 'single'" v-model:value="answers[q.id]">
          <a-radio v-for="opt in q.options || []" :key="opt.id" :value="opt.id">{{ opt.text }}</a-radio>
        </a-radio-group>
        <a-checkbox-group v-else-if="q.type === 'multi'" v-model:value="answers[q.id]">
          <a-checkbox v-for="opt in q.options || []" :key="opt.id" :value="opt.id">{{ opt.text }}</a-checkbox>
        </a-checkbox-group>
        <a-rate v-else-if="q.type === 'rating'" v-model:value="answers[q.id]" :count="5" />
        <a-input-number v-else-if="q.type === 'number'" v-model:value="answers[q.id]" class="number-input" />
        <a-textarea v-else v-model:value="answers[q.id]" :rows="2" :maxlength="2000" />
      </div>
      <div class="submit-row">
        <span class="hint">{{ myAnswered ? '你已提交，重新提交将覆盖之前的答案' : '尚未提交' }}</span>
        <a-button type="primary" :loading="submitting" @click="submit">提交</a-button>
      </div>
    </div>

    <!-- 统计 -->
    <div v-else class="form-panel">
      <div class="stat-total">共 {{ stats?.total ?? 0 }} 份提交</div>
      <div v-for="(q, qi) in stats?.questions || []" :key="q.id" class="stat-card">
        <div class="fill-title">{{ qi + 1 }}. {{ q.title }} <span class="muted">（{{ q.answered }} 人作答）</span></div>
        <template v-if="q.options">
          <div v-for="opt in q.options" :key="opt.id" class="stat-row">
            <div class="stat-label">
              <span>{{ opt.text }}</span>
              <span class="muted">{{ opt.count }} · {{ percent(opt.count, q.answered) }}%</span>
            </div>
            <div class="bar"><span class="bar-fill" :style="{ width: percent(opt.count, q.answered) + '%' }" /></div>
          </div>
        </template>
        <template v-else-if="q.type === 'rating' || q.type === 'number'">
          <div class="muted">平均值：{{ q.average == null ? '-' : Number(q.average).toFixed(2) }}</div>
          <div class="value-list">{{ (q.values || []).join('、') || '暂无' }}</div>
        </template>
        <template v-else>
          <ul class="text-values">
            <li v-for="(v, vi) in q.values || []" :key="vi">{{ v }}</li>
            <li v-if="!(q.values || []).length" class="muted">暂无</li>
          </ul>
        </template>
      </div>
      <a-button size="small" class="refresh-btn" @click="loadStats">刷新</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { getDocStats, getMyDocResponse, submitDocResponse } from '@/api/docs'
import type { DocStats, FormData, FormQuestion, FormQuestionType } from '@/types/docs'
import { genDocId } from '@/utils/docs-id'

const props = defineProps<{
  docId: string
  data: FormData
}>()

const emit = defineEmits<{ (e: 'change'): void }>()

const TAB_OPTIONS = [
  { label: '编辑', value: 'edit' },
  { label: '填写', value: 'fill' },
  { label: '统计', value: 'stats' },
]
const TYPE_OPTIONS: { label: string; value: FormQuestionType }[] = [
  { label: '单选', value: 'single' },
  { label: '多选', value: 'multi' },
  { label: '评分（1-5）', value: 'rating' },
  { label: '数字', value: 'number' },
  { label: '文本', value: 'text' },
]

const tab = ref<'edit' | 'fill' | 'stats'>('edit')
const answers = ref<Record<string, any>>({})
const myAnswered = ref(false)
const submitting = ref(false)
const stats = ref<DocStats | null>(null)

function emitChange() {
  emit('change')
}

function hasOptions(q: FormQuestion) {
  return q.type === 'single' || q.type === 'multi'
}

function newOption(i: number) {
  return { id: genDocId('opt'), text: `选项 ${i}` }
}

function addQuestion() {
  props.data.questions.push({
    id: genDocId('q'),
    title: `题目 ${props.data.questions.length + 1}`,
    type: 'text',
    required: false,
  })
  emitChange()
}

function removeQuestion(i: number) {
  props.data.questions.splice(i, 1)
  emitChange()
}

function onTypeChange(q: FormQuestion) {
  if (hasOptions(q) && !q.options?.length) {
    q.options = [newOption(1), newOption(2)]
  }
  emitChange()
}

function addOption(q: FormQuestion) {
  q.options = [...(q.options || []), newOption((q.options || []).length + 1)]
  emitChange()
}

function removeOption(q: FormQuestion, i: number) {
  q.options?.splice(i, 1)
  emitChange()
}

async function loadMine() {
  try {
    const res = await getMyDocResponse(props.docId)
    const saved = (res?.data?.answer?.answers as Record<string, any> | undefined) || {}
    myAnswered.value = !!res?.data?.answer
    answers.value = { ...saved }
  } catch {
    // 请求层已统一提示
  }
}

async function submit() {
  for (const q of props.data.questions) {
    const v = answers.value[q.id]
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    if (q.required && empty) {
      message.warning(`请填写：${q.title}`)
      return
    }
  }
  submitting.value = true
  try {
    const res = await submitDocResponse(props.docId, { answers: answers.value })
    if (res?.success) {
      message.success('提交成功')
      myAnswered.value = true
    }
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false
  }
}

async function loadStats() {
  try {
    const res = await getDocStats(props.docId)
    if (res?.success && res.data) stats.value = res.data
  } catch {
    // 请求层已统一提示
  }
}

function percent(count: number, base: number) {
  return base ? Math.round((count / base) * 100) : 0
}

watch(tab, (t) => {
  if (t === 'fill') loadMine()
  if (t === 'stats') loadStats()
})

onMounted(() => {
  if (!props.data.questions) props.data.questions = []
})
</script>

<style scoped>
.form-editor {
  max-width: 720px;
  margin: 24px auto;
  padding: 0 16px;
}

.form-tabs {
  margin-bottom: 16px;
}

.form-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.question-card,
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: #fff;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
}

.question-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.question-index,
.option-index {
  width: 22px;
  color: #86868b;
  text-align: center;
}

.type-select {
  width: 130px;
  flex-shrink: 0;
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6e6e73;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fill-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f3;
}

.fill-title {
  font-size: 14px;
  color: #1d1d1f;
}

.required {
  margin-left: 4px;
  color: #ff3b30;
}

.number-input {
  width: 200px;
}

.form-desc {
  margin: 0;
  color: #6e6e73;
}

.submit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hint,
.muted {
  font-size: 12px;
  color: #86868b;
}

.stat-total {
  font-size: 14px;
  color: #1d1d1f;
}

.stat-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.bar {
  height: 8px;
  background: #f0f0f3;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  background: #0052cc;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.value-list,
.text-values {
  margin: 0;
  font-size: 13px;
  color: #1d1d1f;
}

.refresh-btn {
  align-self: flex-start;
}
</style>
