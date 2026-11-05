<template>
  <!--
    手机端通用字段编辑器：新建事项、详情页编辑共用
    v-model 的值即提交格式（与网页版 FieldValueEditor / 新建表单一致）：
    - 文本 / 多行：string；数字：number | null；富文本：HTML（手机端用多行文本编辑，提交时转成 <p> 段落）
    - 日期：'YYYY-MM-DD'；时间：'YYYY-MM-DD HH:mm:ss'
    - 单选：{optionId, optionName, color?}；多选：数组
    - 人员单选：用户对象；人员多选：用户对象数组
    - 级联：{optionId, optionName, childJOptions:[...]}
  -->
  <div class="field-input">
    <!-- 文本 / 数字 / 富文本：直接输入 -->
    <van-field
      v-if="kind === 'text' || kind === 'textarea' || kind === 'number' || kind === 'rich'"
      :model-value="textValue"
      :label="field.name"
      :required="required"
      :type="kind === 'number' ? 'number' : kind === 'text' ? 'text' : 'textarea'"
      :rows="kind === 'text' || kind === 'number' ? undefined : 3"
      :autosize="kind === 'textarea' || kind === 'rich' ? { minHeight: 72, maxHeight: 220 } : undefined"
      :placeholder="placeholder || `请输入${field.name}`"
      :disabled="readonly"
      label-align="top"
      clearable
      @update:model-value="onText"
    />

    <!-- 只读 -->
    <van-field
      v-else-if="kind === 'label'"
      :model-value="display"
      :label="field.name"
      label-align="top"
      readonly
    />

    <!-- 其余：点开底部弹层选择 -->
    <van-field
      v-else
      :model-value="display"
      :label="field.name"
      :required="required"
      :placeholder="placeholder || `请选择${field.name}`"
      :disabled="readonly"
      label-align="top"
      readonly
      is-link
      @click="openPicker"
    />

    <!-- 日期 -->
    <van-popup v-model:show="pickerOpen.date" position="bottom" round safe-area-inset-bottom>
      <van-date-picker
        v-model="dateParts"
        :title="field.name"
        :min-date="MIN_DATE"
        :max-date="MAX_DATE"
        @confirm="confirmDate"
        @cancel="pickerOpen.date = false"
      />
      <div v-if="!required && modelValue" class="fi-clear" @click="clearAndClose('date')">清空</div>
    </van-popup>

    <!-- 日期 + 时间 -->
    <van-popup v-model:show="pickerOpen.time" position="bottom" round safe-area-inset-bottom>
      <van-picker-group :title="field.name" :tabs="['日期', '时间']" @confirm="confirmDateTime" @cancel="pickerOpen.time = false">
        <van-date-picker v-model="dateParts" :min-date="MIN_DATE" :max-date="MAX_DATE" />
        <van-time-picker v-model="timeParts" :columns-type="['hour', 'minute', 'second']" />
      </van-picker-group>
      <div v-if="!required && modelValue" class="fi-clear" @click="clearAndClose('time')">清空</div>
    </van-popup>

    <!-- 单选 / 多选 -->
    <van-popup v-model:show="pickerOpen.option" position="bottom" round closeable safe-area-inset-bottom class="fi-sheet">
      <div class="fi-sheet-title">{{ field.name }}</div>
      <van-search v-if="options.length > 8" v-model="optionKeyword" placeholder="搜索选项" shape="round" />
      <div class="fi-sheet-body">
        <van-loading v-if="optionLoading" class="fi-loading" size="20" />
        <van-empty v-else-if="!filteredOptions.length" image-size="64" description="暂无选项" />
        <van-cell
          v-for="o in filteredOptions"
          v-else
          :key="o.value"
          clickable
          @click="toggleOption(o)"
        >
          <template #title>
            <span class="fi-option">
              <i v-if="o.color" class="fi-dot" :style="{ background: o.color }" />
              {{ o.text }}
            </span>
          </template>
          <template #right-icon>
            <van-icon v-if="isOptionChecked(o)" name="success" class="fi-check" />
          </template>
        </van-cell>
      </div>
      <div class="fi-sheet-foot">
        <van-button v-if="!required" plain block round @click="clearAndClose('option')">清空</van-button>
        <van-button v-if="kind === 'multi'" type="primary" block round @click="confirmMulti">确定</van-button>
      </div>
    </van-popup>

    <!-- 人员 -->
    <van-popup v-model:show="pickerOpen.user" position="bottom" round closeable safe-area-inset-bottom class="fi-sheet">
      <div class="fi-sheet-title">{{ field.name }}</div>
      <van-search v-model="userKeyword" placeholder="搜索姓名 / 工号" shape="round" @update:model-value="onUserSearch" />
      <div class="fi-sheet-body">
        <van-loading v-if="userLoading" class="fi-loading" size="20" />
        <van-empty v-else-if="!users.length" image-size="64" description="没有找到人员" />
        <van-cell v-for="u in users" v-else :key="personKey(u)" clickable @click="toggleUser(u)">
          <template #icon>
            <span class="fi-avatar">
              <img v-if="personAvatar(u)" :src="personAvatar(u)" alt="" />
              <template v-else>{{ personInitial(u) }}</template>
            </span>
          </template>
          <template #title>{{ personLabel(u) }}</template>
          <template #right-icon>
            <van-icon v-if="isUserChecked(u)" name="success" class="fi-check" />
          </template>
        </van-cell>
      </div>
      <div class="fi-sheet-foot">
        <van-button v-if="!required" plain block round @click="clearAndClose('user')">清空</van-button>
        <van-button v-if="kind === 'userMulti'" type="primary" block round @click="confirmUsers">确定</van-button>
      </div>
    </van-popup>

    <!-- 级联 -->
    <van-popup v-model:show="pickerOpen.cascader" position="bottom" round safe-area-inset-bottom>
      <van-cascader
        :title="field.name"
        :options="options"
        :field-names="{ text: 'text', value: 'value', children: 'children' }"
        @close="pickerOpen.cascader = false"
        @finish="confirmCascader"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { normalizeFieldType } from '@/types/fieldType'
import {
  displayOf, htmlToText, loadFieldOptions, personAvatar, personInitial, personKey, personLabel, searchUsers, textToHtml,
  type OptionNode,
} from '../utils'

const props = defineProps<{
  field: { id: string; name: string; type?: string; required?: boolean; editable?: boolean }
  modelValue: unknown
  /** 选项 / 人员查询范围：详情页传 issueKey，新建页传 spaceCode + issueTypeCode */
  ctx?: { issueKey?: string; spaceCode?: string; issueTypeCode?: string }
  placeholder?: string
  readonly?: boolean
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: unknown): void }>()

const MIN_DATE = new Date(2015, 0, 1)
const MAX_DATE = new Date(2040, 11, 31)

const type = computed(() => normalizeFieldType(props.field.type))
const kind = computed(() => {
  switch (type.value) {
    case 'TEXT_BOX_MULTI_LINE': return 'textarea'
    case 'TEXT_BOX_NUMBER': return 'number'
    case 'RICH_TEXT': return 'rich'
    case 'LABEL': return 'label'
    case 'DATE_PICKER': return 'date'
    case 'TIME_PICKER': return 'time'
    case 'SELECT_LIST_SINGLE': return 'single'
    case 'SELECT_LIST_MULTI': return 'multi'
    case 'SELECT_USER_SINGLE': return 'user'
    case 'SELECT_USER_MULTI': return 'userMulti'
    case 'CASCADER_SINGLE': return 'cascader'
    default: return 'text'
  }
})
const required = computed(() => !!props.field.required && kind.value !== 'label')
const display = computed(() => displayOf(type.value, props.modelValue))

// ---- 文本 / 数字 / 富文本 ----
const textValue = computed(() => {
  const v = props.modelValue
  if (v == null) return ''
  if (kind.value === 'rich') return htmlToText(String(v))
  return String(v)
})
function onText(v: string) {
  if (kind.value === 'number') emit('update:modelValue', v === '' ? null : Number(v))
  else if (kind.value === 'rich') emit('update:modelValue', v ? textToHtml(v) : '')
  else emit('update:modelValue', v)
}

// ---- 弹层 ----
const pickerOpen = reactive({ date: false, time: false, option: false, user: false, cascader: false })

function openPicker() {
  if (props.readonly) return
  if (kind.value === 'date' || kind.value === 'time') {
    const d = props.modelValue ? dayjs(String(props.modelValue)) : dayjs()
    dateParts.value = [d.format('YYYY'), d.format('MM'), d.format('DD')]
    timeParts.value = [d.format('HH'), d.format('mm'), d.format('ss')]
    pickerOpen[kind.value] = true
  } else if (kind.value === 'single' || kind.value === 'multi') {
    multiDraft.value = Array.isArray(props.modelValue) ? [...(props.modelValue as Opt[])] : []
    pickerOpen.option = true
    void ensureOptions()
  } else if (kind.value === 'cascader') {
    pickerOpen.cascader = true
    void ensureOptions()
  } else if (kind.value === 'user' || kind.value === 'userMulti') {
    userDraft.value = Array.isArray(props.modelValue) ? [...(props.modelValue as Record<string, unknown>[])] : []
    pickerOpen.user = true
    if (!users.value.length) void runUserSearch('')
  }
}

function clearAndClose(which: keyof typeof pickerOpen) {
  emit('update:modelValue', kind.value === 'multi' || kind.value === 'userMulti' ? [] : null)
  pickerOpen[which] = false
}

// ---- 日期 / 时间 ----
const dateParts = ref<string[]>([])
const timeParts = ref<string[]>([])
function confirmDate() {
  emit('update:modelValue', dateParts.value.join('-'))
  pickerOpen.date = false
}
function confirmDateTime() {
  emit('update:modelValue', `${dateParts.value.join('-')} ${timeParts.value.join(':')}`)
  pickerOpen.time = false
}

// ---- 单选 / 多选 / 级联选项 ----
type Opt = { optionId: string; optionName: string; color?: string }
const options = ref<OptionNode[]>([])
const optionLoading = ref(false)
const optionKeyword = ref('')
let optionsLoaded = false
async function ensureOptions() {
  if (optionsLoaded) return
  optionLoading.value = true
  try {
    options.value = await loadFieldOptions(props.field, props.ctx || {})
    optionsLoaded = true
  } catch {
    // 请求层已统一提示
  } finally {
    optionLoading.value = false
  }
}
const filteredOptions = computed(() => {
  const kw = optionKeyword.value.trim().toLowerCase()
  return kw ? options.value.filter((o) => o.text.toLowerCase().includes(kw)) : options.value
})
const toOpt = (o: OptionNode): Opt => (o.color ? { optionId: o.value, optionName: o.text, color: o.color } : { optionId: o.value, optionName: o.text })
const multiDraft = ref<Opt[]>([])

function isOptionChecked(o: OptionNode) {
  if (kind.value === 'multi') return multiDraft.value.some((x) => x.optionId === o.value)
  return (props.modelValue as Opt | null)?.optionId === o.value
}
function toggleOption(o: OptionNode) {
  if (kind.value === 'multi') {
    const i = multiDraft.value.findIndex((x) => x.optionId === o.value)
    if (i >= 0) multiDraft.value.splice(i, 1)
    else multiDraft.value.push(toOpt(o))
    return
  }
  emit('update:modelValue', toOpt(o))
  pickerOpen.option = false
}
function confirmMulti() {
  emit('update:modelValue', [...multiDraft.value])
  pickerOpen.option = false
}

/** 级联：选中路径 → {optionId, optionName, childJOptions:[下一级]} */
function confirmCascader({ selectedOptions }: { selectedOptions: OptionNode[] }) {
  let node: Record<string, unknown> | null = null
  for (let i = selectedOptions.length - 1; i >= 0; i--) {
    const o = selectedOptions[i]
    node = { optionId: o.value, optionName: o.text, ...(node ? { childJOptions: [node] } : {}) }
  }
  emit('update:modelValue', node)
  pickerOpen.cascader = false
}

// ---- 人员 ----
const users = ref<Record<string, unknown>[]>([])
const userKeyword = ref('')
const userLoading = ref(false)
const userDraft = ref<Record<string, unknown>[]>([])
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0

async function runUserSearch(kw: string) {
  const seq = ++searchSeq
  userLoading.value = true
  try {
    const list = await searchUsers(kw.trim(), props.ctx || {})
    if (seq === searchSeq) users.value = list
  } catch {
    // 请求层已统一提示
  } finally {
    if (seq === searchSeq) userLoading.value = false
  }
}
function onUserSearch(kw: string) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => runUserSearch(kw), 300)
}
const sameUser = (a: Record<string, unknown>, b: Record<string, unknown>) => personKey(a) === personKey(b)
function isUserChecked(u: Record<string, unknown>) {
  if (kind.value === 'userMulti') return userDraft.value.some((x) => sameUser(x, u))
  const cur = props.modelValue as Record<string, unknown> | null
  return !!cur && sameUser(cur, u)
}
function toggleUser(u: Record<string, unknown>) {
  if (kind.value === 'userMulti') {
    const i = userDraft.value.findIndex((x) => sameUser(x, u))
    if (i >= 0) userDraft.value.splice(i, 1)
    else userDraft.value.push(u)
    return
  }
  emit('update:modelValue', u)
  pickerOpen.user = false
}
function confirmUsers() {
  emit('update:modelValue', [...userDraft.value])
  pickerOpen.user = false
}
</script>

<style scoped>
.fi-sheet {
  display: flex;
  flex-direction: column;
  max-height: 75vh;
}

.fi-sheet-title {
  flex-shrink: 0;
  padding: 16px 48px 8px 16px;
  font-size: 16px;
  font-weight: 600;
}

.fi-sheet-body {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.fi-sheet-foot {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  padding: 10px 16px 12px;
}

.fi-sheet-foot:empty {
  display: none;
}

.fi-loading {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}

.fi-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.fi-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.fi-check {
  color: var(--van-primary-color);
  font-size: 18px;
}

.fi-avatar {
  width: 28px;
  height: 28px;
  margin-right: 10px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--van-primary-color);
  color: #fff;
  font-size: 12px;
}

.fi-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fi-clear {
  padding: 12px 0 4px;
  text-align: center;
  color: var(--h5-text-3);
  font-size: 14px;
}
</style>
