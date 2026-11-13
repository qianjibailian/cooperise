<template>
  <div class="h5-page">
    <van-nav-bar title="新建事项" left-text="取消" fixed placeholder @click-left="goBack" />

    <van-cell-group inset class="ci-group">
      <van-field
        :model-value="space?.spaceName || ''"
        label="空间"
        label-align="top"
        placeholder="请选择空间"
        required
        readonly
        is-link
        @click="spaceOpen = true"
      />
      <van-field
        :model-value="issueType?.issueTypeName || ''"
        label="问题类型"
        label-align="top"
        placeholder="请选择问题类型"
        required
        readonly
        is-link
        :disabled="!space"
        @click="space && (typeOpen = true)"
      />
    </van-cell-group>

    <van-loading v-if="metaLoading" class="ci-loading" size="24" vertical>加载表单…</van-loading>

    <template v-else-if="issueType">
      <van-empty v-if="!fields.length" image-size="72" description="该问题类型没有可填写的字段" />
      <template v-else>
        <div class="h5-section-title">必填信息</div>
        <van-cell-group inset class="ci-group">
          <FieldInput
            v-for="f in requiredFields"
            :key="f.id"
            v-model="values[f.id]"
            :field="f"
            :ctx="ctx"
          />
        </van-cell-group>

        <template v-if="optionalFields.length">
          <div class="ci-more" @click="showMore = !showMore">
            {{ showMore ? '收起更多字段' : `更多字段（${optionalFields.length}）` }}
            <van-icon :name="showMore ? 'arrow-up' : 'arrow-down'" />
          </div>
          <van-cell-group v-show="showMore" inset class="ci-group">
            <FieldInput
              v-for="f in optionalFields"
              :key="f.id"
              v-model="values[f.id]"
              :field="f"
              :ctx="ctx"
            />
          </van-cell-group>
        </template>
      </template>
    </template>

    <div class="h5-action-bar-placeholder" />
    <div class="h5-action-bar">
      <van-button type="primary" block round :disabled="!issueType || metaLoading" :loading="submitting" @click="submit">提交</van-button>
    </div>

    <van-action-sheet
      v-model:show="spaceOpen"
      title="选择空间"
      :actions="spaceActions"
      cancel-text="取消"
      close-on-click-action
      @select="onSpaceSelect"
    />
    <van-action-sheet
      v-model:show="typeOpen"
      title="选择问题类型"
      :actions="typeActions"
      cancel-text="取消"
      close-on-click-action
      @select="onTypeSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  createIssue, getIssueCreateMeta, queryIssueTypes, querySpaceOptions,
  type IssueTypeItem, type SpaceItem,
} from '@/api/faiz'
import type { CreateMetaField } from '@/types/faiz'
import { normalizeFieldType } from '@/types/fieldType'
import { notifyIssueCreated } from '@/utils/issue-events'
import FieldInput from '../components/FieldInput.vue'
import { editValueOf, isEmptyValue } from '../utils'

const router = useRouter()

/** 空间 / 问题类型单独选择，这些字段不在表单里重复出现；后端生成的字段也不填 */
const SKIP_FIELDS = new Set(['space', 'project', 'organization', 'issuetype', 'issuekey', 'status', 'creator', 'createtime', 'created', 'updated'])
const LAST_SPACE_KEY = 'cooperise:newIssue:lastSpaceId'

// ---------------- 空间 ----------------
const spaces = ref<SpaceItem[]>([])
const space = ref<SpaceItem | null>(null)
const spaceOpen = ref(false)
const spaceActions = computed(() => spaces.value.map((s) => ({ name: s.spaceName, space: s })))

async function loadSpaces() {
  try {
    const res = await querySpaceOptions()
    spaces.value = res?.success ? res.data || [] : []
  } catch {
    spaces.value = []
  }
  let lastId = ''
  try { lastId = localStorage.getItem(LAST_SPACE_KEY) || '' } catch { /* 存储不可用 */ }
  const def = spaces.value.find((s) => String(s.id) === lastId) || spaces.value[0]
  if (def) await pickSpace(def)
}

async function pickSpace(s: SpaceItem) {
  if (space.value?.spaceCode === s.spaceCode && issueTypes.value.length) return
  space.value = s
  try { localStorage.setItem(LAST_SPACE_KEY, String(s.id)) } catch { /* 存储不可用 */ }
  issueType.value = null
  fields.value = []
  await loadTypes()
}

function onSpaceSelect(a: { space: SpaceItem }) {
  void pickSpace(a.space)
}

// ---------------- 问题类型 ----------------
const issueTypes = ref<IssueTypeItem[]>([])
const issueType = ref<IssueTypeItem | null>(null)
const typeOpen = ref(false)
const typeActions = computed(() => issueTypes.value.map((t) => ({ name: t.issueTypeName, type: t })))

async function loadTypes() {
  if (!space.value) return
  try {
    const res = await queryIssueTypes({ page: 1, pageSize: 999, status: 1, spaceCode: space.value.spaceCode })
    issueTypes.value = res?.success ? res.data?.list || [] : []
  } catch {
    issueTypes.value = []
  }
  if (issueTypes.value.length === 1) await pickType(issueTypes.value[0])
}

async function pickType(t: IssueTypeItem) {
  issueType.value = t
  await loadMeta()
}

function onTypeSelect(a: { type: IssueTypeItem }) {
  void pickType(a.type)
}

// ---------------- 表单字段 ----------------
const fields = ref<CreateMetaField[]>([])
const values = reactive<Record<string, unknown>>({})
const metaLoading = ref(false)
const showMore = ref(false)

const ctx = computed(() => ({ spaceCode: space.value?.spaceCode, issueTypeCode: issueType.value?.issueTypeCode }))
const isRequired = (f: CreateMetaField) => !!f.required && normalizeFieldType(f.type) !== 'LABEL'
// 概要永远放第一个
const requiredFields = computed(() => {
  const list = fields.value.filter((f) => isRequired(f) || f.id === 'summary')
  return [...list].sort((a, b) => (a.id === 'summary' ? -1 : b.id === 'summary' ? 1 : 0))
})
const optionalFields = computed(() => fields.value.filter((f) => !isRequired(f) && f.id !== 'summary'))

async function loadMeta() {
  if (!space.value || !issueType.value?.issueTypeCode) return
  metaLoading.value = true
  fields.value = []
  Object.keys(values).forEach((k) => delete values[k])
  try {
    const res = await getIssueCreateMeta({ organizationCode: space.value.organizationCode, issueTypeCode: issueType.value.issueTypeCode })
    if (res?.success) {
      const data = res.data?.data
      const list = res.data?.type === 'FORM'
        ? data?.fromItems || []
        : (data?.tabItems || []).flatMap((t) => t.issueFields || [])
      const seen = new Set<string>()
      fields.value = list.filter((f) => {
        if (!f?.id || SKIP_FIELDS.has(f.id) || seen.has(f.id) || f.editable === false) return false
        seen.add(f.id)
        return true
      })
      for (const f of fields.value) values[f.id] = editValueOf({ type: f.type, value: f.value ?? f.defaultvalue })
    }
  } catch {
    // 请求层已统一提示
  } finally {
    metaLoading.value = false
  }
}

// ---------------- 提交 ----------------
const submitting = ref(false)

async function submit() {
  if (!space.value || !issueType.value?.issueTypeCode) return
  const missing = requiredFields.value.find((f) => isEmptyValue(values[f.id]))
  if (missing) {
    showToast(`请填写${missing.name}`)
    return
  }
  submitting.value = true
  try {
    const res = await createIssue({
      inputFields: [
        { id: 'space', type: 'SELECT_LIST_SINGLE_SPACE', value: space.value.spaceCode },
        { id: 'issuetype', type: 'SELECT_LIST_SINGLE_ISSUETYPE', value: issueType.value.issueTypeCode },
        ...fields.value.map((f) => {
          const v = values[f.id]
          const empty = isEmptyValue(v)
          return { id: f.id, type: f.type, value: empty ? (normalizeFieldType(f.type) === 'TEXT_BOX_NUMBER' ? null : undefined) : v }
        }),
      ],
    })
    if (!res?.success) return
    notifyIssueCreated()
    const data = (res.data || {}) as Record<string, unknown>
    const key = String(data.issueKey ?? data.key ?? '')
    if (key) router.replace(`/jira/browse/${encodeURIComponent(key)}`)
    else router.replace('/issues')
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/issues')
}

onMounted(loadSpaces)
</script>

<style scoped>
.ci-group {
  margin-top: 12px;
}

.ci-group :deep(.van-field__label) {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--h5-text-2);
}

.ci-loading {
  padding: 40px 0;
}

.ci-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 16px 0 4px;
  font-size: 14px;
  color: var(--van-primary-color);
}
</style>
