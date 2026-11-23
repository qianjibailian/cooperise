<template>
  <div class="vote-editor">
    <a-segmented v-model:value="tab" :options="TAB_OPTIONS" class="vote-tabs" />

    <!-- 编辑：标题说明 / 选项 / 规则 -->
    <div v-if="tab === 'edit'" class="vote-panel">
      <a-textarea
        v-model:value="data.description"
        placeholder="投票说明（选填）"
        :rows="2"
        :maxlength="500"
        @change="emitChange"
      />
      <div class="option-list">
        <div v-for="(opt, i) in data.options" :key="opt.id" class="option-row">
          <span class="option-index">{{ i + 1 }}</span>
          <a-input v-model:value="opt.text" :maxlength="100" placeholder="选项内容" @change="emitChange" />
          <a-button type="text" danger :disabled="data.options.length <= 2" @click="removeOption(i)">
            删除
          </a-button>
        </div>
        <a-button type="dashed" block :disabled="data.options.length >= 20" @click="addOption">+ 添加选项</a-button>
      </div>
      <div class="rule-row">
        <span>允许多选</span>
        <a-switch v-model:checked="data.multiple" @change="emitChange" />
        <span>匿名投票</span>
        <a-switch v-model:checked="data.anonymous" @change="emitChange" />
      </div>
    </div>

    <!-- 填写：我的投票 -->
    <div v-else-if="tab === 'fill'" class="vote-panel">
      <p v-if="data.description" class="vote-desc">{{ data.description }}</p>
      <a-checkbox-group v-if="data.multiple" v-model:value="picked" class="choice-group">
        <a-checkbox v-for="opt in data.options" :key="opt.id" :value="opt.id">{{ opt.text }}</a-checkbox>
      </a-checkbox-group>
      <a-radio-group v-else v-model:value="pickedOne" class="choice-group">
        <a-radio v-for="opt in data.options" :key="opt.id" :value="opt.id">{{ opt.text }}</a-radio>
      </a-radio-group>
      <div class="submit-row">
        <span class="hint">{{ myAnswered ? '你已投票，重新提交将覆盖之前的选择' : '尚未投票' }}</span>
        <a-button type="primary" :loading="submitting" @click="submit">提交投票</a-button>
      </div>
    </div>

    <!-- 统计 -->
    <div v-else class="vote-panel">
      <div class="stat-total">共 {{ stats?.total ?? 0 }} 人参与</div>
      <div v-for="opt in stats?.options || []" :key="opt.id" class="stat-row">
        <div class="stat-label">
          <span>{{ opt.text }}</span>
          <span class="muted">{{ opt.count }} 票 · {{ percent(opt.count) }}%</span>
        </div>
        <div class="bar"><span class="bar-fill" :style="{ width: percent(opt.count) + '%' }" /></div>
      </div>
      <a-button size="small" class="refresh-btn" @click="loadStats">刷新</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { getDocStats, getMyDocResponse, submitDocResponse } from '@/api/docs'
import type { DocStats, VoteData, VoteOption } from '@/types/docs'
import { genDocId } from '@/utils/docs-id'

const props = defineProps<{
  docId: string
  data: VoteData
}>()

const emit = defineEmits<{ (e: 'change'): void }>()

const TAB_OPTIONS = [
  { label: '编辑', value: 'edit' },
  { label: '投票', value: 'fill' },
  { label: '统计', value: 'stats' },
]
const tab = ref<'edit' | 'fill' | 'stats'>('edit')

const picked = ref<string[]>([])
const pickedOne = ref<string | undefined>()
const myAnswered = ref(false)
const submitting = ref(false)
const stats = ref<DocStats | null>(null)

function emitChange() {
  emit('change')
}

function addOption() {
  const opt: VoteOption = { id: genDocId('opt'), text: `选项 ${props.data.options.length + 1}` }
  props.data.options.push(opt)
  emitChange()
}

function removeOption(i: number) {
  props.data.options.splice(i, 1)
  emitChange()
}

async function loadMine() {
  try {
    const res = await getMyDocResponse(props.docId)
    const ids = ((res?.data?.answer?.optionIds as string[] | undefined) || [])
    myAnswered.value = !!res?.data?.answer
    picked.value = [...ids]
    pickedOne.value = ids[0]
  } catch {
    // 请求层已统一提示
  }
}

async function submit() {
  const optionIds = props.data.multiple ? picked.value : (pickedOne.value ? [pickedOne.value] : [])
  if (!optionIds.length) {
    message.warning('请选择选项')
    return
  }
  submitting.value = true
  try {
    const res = await submitDocResponse(props.docId, { optionIds })
    if (res?.success) {
      message.success('投票成功')
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

function percent(count: number) {
  const total = stats.value?.total || 0
  return total ? Math.round((count / total) * 100) : 0
}

watch(tab, (t) => {
  if (t === 'fill') loadMine()
  if (t === 'stats') loadStats()
})

onMounted(() => {
  if (!props.data.options?.length) {
    props.data.options = [
      { id: genDocId('opt'), text: '选项 1' },
      { id: genDocId('opt'), text: '选项 2' },
    ]
  }
  props.data.multiple = !!props.data.multiple
  props.data.anonymous = !!props.data.anonymous
})

</script>

<style scoped>
.vote-editor {
  max-width: 720px;
  margin: 24px auto;
  padding: 0 16px;
}

.vote-tabs {
  margin-bottom: 16px;
}

.vote-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.option-index {
  width: 22px;
  color: #86868b;
  text-align: center;
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1d1d1f;
}

.vote-desc {
  margin: 0;
  color: #6e6e73;
}

.choice-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.refresh-btn {
  align-self: flex-start;
}
</style>
