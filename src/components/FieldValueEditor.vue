<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { personLabel, personKey } from '@/utils/person'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { FIELD_TYPE, normalizeFieldType } from '@/types/fieldType'
import { patchIssue, getAvailableFieldOptions, queryUsers } from '@/api/faiz'
import type { DetailField, CustomFieldOptionItem, UserItem } from '@/types/faiz'

const props = defineProps<{ field: DetailField; issueKey: string }>()
const emit = defineEmits<{
  (e: 'saved', payload: { value: unknown; exportValue: unknown }): void
  (e: 'cancel'): void
}>()

const normType = computed(() => normalizeFieldType(props.field.type))

// ======================= 类型判断 =======================
const isPlainText = computed(() =>
  normType.value === FIELD_TYPE.TEXT_BOX_SINGLE_LINE ||
  normType.value === FIELD_TYPE.LABEL,
)
const isMultiLine = computed(() => normType.value === FIELD_TYPE.TEXT_BOX_MULTI_LINE)
const isNumberType = computed(() => normType.value === FIELD_TYPE.TEXT_BOX_NUMBER)
const isDateType = computed(() => normType.value === FIELD_TYPE.DATE_PICKER)
const isTimeType = computed(() => normType.value === FIELD_TYPE.TIME_PICKER)
const isSingleSelect = computed(() => normType.value === FIELD_TYPE.SELECT_LIST_SINGLE)
const isMultiSelect = computed(() => normType.value === FIELD_TYPE.SELECT_LIST_MULTI)
const isUserSingleType = computed(() => normType.value === FIELD_TYPE.SELECT_USER_SINGLE)
const isUserMultiType = computed(() => normType.value === FIELD_TYPE.SELECT_USER_MULTI)
const isCascaderType = computed(() => normType.value === FIELD_TYPE.CASCADER_SINGLE)

// ======================= 编辑值 =======================
const editValue = ref<string | number | null>('')
const editMultiValue = ref<string[]>([])
const editDateValue = ref<Dayjs | null>(null)
const editCascaderValue = ref<string[]>([])
const editUserValue = ref<string | null>(null)
const editUserMultiValue = ref<string[]>([])

// ======================= 选项 / 用户 =======================
const selectOptions = ref<CustomFieldOptionItem[]>([])
const rawOptions = ref<unknown[]>([])
const optionLoading = ref(false)
const memberOptions = ref<UserItem[]>([])
const memberLoading = ref(false)
let memberSearchTimer: ReturnType<typeof setTimeout> | null = null

// ======================= 选项转换 =======================
function toOptionItem(raw: unknown, idx: number): CustomFieldOptionItem {
  const base = (raw ?? {}) as Record<string, unknown>
  const label = String(base.label ?? base.name ?? base.optionName ?? base.text ?? base.title ?? `选项${idx + 1}`)
  const value = String(base.value ?? base.id ?? base.optionId ?? base.key ?? '')
  const childArr = Array.isArray(base.children)
    ? base.children
    : Array.isArray(base.childJOptions)
      ? base.childJOptions
      : null
  const children = childArr ? childArr.map((c: unknown, i: number) => toOptionItem(c, i)) : undefined
  const ext = base.ext && typeof base.ext === 'object'
    ? (base.ext as Record<string, unknown>)
    : undefined
  const color = typeof base.color === 'string'
    ? base.color
    : typeof ext?.color === 'string'
      ? ext.color
      : undefined
  return {
    id: value,
    name: label,
    value,
    disabled: !!base.disabled || !!base.obsolete,
    color: color || undefined,
    children,
  }
}

// ======================= 选项加载 =======================
async function loadOptions() {
  optionLoading.value = true
  try {
    const res = await getAvailableFieldOptions([
      {
        fieldId: props.field.id,
        type: normType.value,
        projectId: '',
        issueTypeCode: '',
        issueKey: props.issueKey,
        page: 1,
        pageSize: 100,
      },
    ])
    if (res?.success && Array.isArray(res.data)) {
      const bucket = res.data.find(
        (b: { fieldId?: string; customFieldId?: string; customId?: string }) =>
          String(b.fieldId ?? b.customFieldId ?? b.customId ?? '') === props.field.id,
      )
      const bucketRec = bucket as Record<string, unknown> | undefined
      const jOptionsRaw = bucketRec?.joptions
      const jList = jOptionsRaw && typeof jOptionsRaw === 'object'
        ? (jOptionsRaw as { list?: unknown }).list
        : undefined
      const rawOpts = bucketRec?.options
      let innerOpts: unknown[] | null = null
      if (Array.isArray(rawOpts)) {
        innerOpts = rawOpts
      } else if (rawOpts && typeof rawOpts === 'object' && Array.isArray((rawOpts as Record<string, unknown>).options)) {
        innerOpts = (rawOpts as Record<string, unknown>).options as unknown[]
      }
      let list: unknown[] | null = null
      if (Array.isArray(jList) && jList.length) list = jList.filter((x: unknown) => x != null)
      else if (innerOpts && innerOpts.length) list = innerOpts.filter((x: unknown) => x != null)
      if (list) {
        rawOptions.value = list
        selectOptions.value = list.map((x: unknown, i: number) => toOptionItem(x, i))
      }
    }
  } catch {
    rawOptions.value = []
    selectOptions.value = []
  } finally {
    optionLoading.value = false
  }
}

// ======================= 用户搜索 =======================
function handleMemberSearch(keyword: string) {
  if (memberSearchTimer) clearTimeout(memberSearchTimer)
  memberSearchTimer = setTimeout(async () => {
    memberLoading.value = true
    try {
      // 只列拥有该事项所属空间的用户
      const res = await queryUsers({ keyword, isActive: 1, issueKey: props.issueKey || undefined, page: 1, pageSize: 20 })
      if (res?.success) {
        const list = Array.isArray(res.data?.list) ? res.data.list : []
        const cur = editUserValue.value
        if (cur && !list.some((u: UserItem) => personKey(u) === String(cur))) {
          const existing = memberOptions.value.find((u) => personKey(u) === String(cur))
          memberOptions.value = [existing ?? ({ memberId: cur } as UserItem), ...list]
        } else {
          memberOptions.value = list
        }
      } else {
        memberOptions.value = []
      }
    } catch {
      memberOptions.value = []
    } finally {
      memberLoading.value = false
    }
  }, 300)
}

// ======================= 级联值转换 =======================
function cascadingValueToPath(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean)
  if (typeof raw === 'object') {
    const path: string[] = []
    let cur = raw as Record<string, unknown> | null
    let guard = 0
    while (cur && guard++ < 20) {
      const id = cur.value ?? cur.id ?? cur.optionId ?? cur.key
      if (id == null || String(id).trim() === '') break
      path.push(String(id))
      const children = Array.isArray(cur.children)
        ? cur.children
        : Array.isArray(cur.childJOptions)
          ? cur.childJOptions
          : []
      cur = children.length ? (children[0] as Record<string, unknown>) : null
    }
    return path
  }
  return [String(raw)]
}

function cascadingPathToObject(path: string[], rawOpts: unknown[]): Record<string, unknown> | null {
  const ids = (path ?? [])
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter((x) => x !== '')
  if (!ids.length || !Array.isArray(rawOpts) || !rawOpts.length) return null

  const nodeVal = (n: Record<string, unknown>): string =>
    String(n.value ?? n.id ?? n.optionId ?? n.key ?? '')
  const childOf = (n: Record<string, unknown>): unknown[] =>
    Array.isArray(n.children) ? n.children : Array.isArray(n.childJOptions) ? n.childJOptions : []

  const nodes: Record<string, unknown>[] = []
  let level: unknown[] = rawOpts
  for (const id of ids) {
    const found = level.find((x: unknown) => nodeVal((x ?? {}) as Record<string, unknown>) === id)
    if (!found) break
    const node = (found ?? {}) as Record<string, unknown>
    nodes.push(node)
    level = childOf(node)
  }
  if (!nodes.length) return null

  let nested: Record<string, unknown> | null = null
  for (let i = nodes.length - 1; i >= 0; i--) {
    const cur: Record<string, unknown> = { ...nodes[i] }
    if (nested) {
      if (Array.isArray(cur.children)) cur.children = [nested]
      else if (Array.isArray(cur.childJOptions)) cur.childJOptions = [nested]
      else cur.children = [nested]
    }
    nested = cur
  }
  return nested
}

// ======================= 用户文字 =======================
/** 人员文字：realName（coAccount） */
function formatUserText(u: Record<string, unknown>): string {
  return personLabel(u)
}

// ======================= 初始化编辑 =======================
function initEdit() {
  const raw = props.field.value

  if (isDateType.value || isTimeType.value) {
    const text =
      raw == null
        ? ''
        : typeof raw === 'object' && typeof (raw as { format?: unknown }).format === 'function'
          ? (raw as { format: (f: string) => string }).format('YYYY-MM-DD HH:mm:ss')
          : String(raw)
    const d = text ? dayjs(text) : null
    editDateValue.value = d && d.isValid() ? d : null
  } else if (isNumberType.value) {
    if (raw == null || raw === '') {
      editValue.value = null
    } else {
      const n = Number(raw)
      editValue.value = Number.isFinite(n) ? n : null
    }
  } else if (isCascaderType.value) {
    editCascaderValue.value = cascadingValueToPath(raw)
    void loadOptions()
  } else if (isUserSingleType.value) {
    const uv =
      typeof raw === 'object' && raw != null
        ? personKey(raw)
        : raw == null
          ? ''
          : String(raw)
    editUserValue.value = uv || null
    if (uv) {
      memberOptions.value = [{
        ...(typeof raw === 'object' && raw != null ? (raw as Record<string, unknown>) : {}),
        memberId: uv,
      } as UserItem]
    }
    handleMemberSearch('')
  } else if (isUserMultiType.value) {
    const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
    editUserMultiValue.value = arr.map((v: unknown) =>
      personKey(v),
    )
    if (editUserMultiValue.value.length) {
      memberOptions.value = editUserMultiValue.value.map((no, i) => ({
        ...(arr[i] && typeof arr[i] === 'object' ? (arr[i] as Record<string, unknown>) : {}),
        memberId: no,
      } as UserItem))
    }
    handleMemberSearch('')
  } else if (isSingleSelect.value) {
    const sv =
      raw != null && typeof raw === 'object'
        ? String((raw as Record<string, unknown>).optionId ?? '')
        : raw == null
          ? ''
          : String(raw)
    editValue.value = sv || null
    void loadOptions()
  } else if (isMultiSelect.value) {
    const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
    editMultiValue.value = arr.map((v: unknown) => {
      const o = v as Record<string, unknown> | null
      return String(o?.optionId ?? o?.id ?? o?.value ?? '')
    })
    void loadOptions()
  } else {
    editValue.value = raw == null ? '' : String(raw)
  }
}

// ======================= 保存 =======================
async function confirmEdit() {
  let fieldValue: unknown
  if (isDateType.value) {
    fieldValue = editDateValue.value ? editDateValue.value.format('YYYY-MM-DD') : null
  } else if (isTimeType.value) {
    fieldValue = editDateValue.value ? editDateValue.value.format('YYYY-MM-DD HH:mm:ss') : null
  } else if (isCascaderType.value) {
    fieldValue = cascadingPathToObject(editCascaderValue.value, rawOptions.value)
  } else if (isUserSingleType.value) {
    const uv = editUserValue.value
    if (uv == null || String(uv).trim() === '') {
      fieldValue = null
    } else {
      const found = memberOptions.value.find((u) => personKey(u) === String(uv))
      fieldValue = found ? { ...found } : { memberId: String(uv) }
    }
  } else if (isUserMultiType.value) {
    const arr = Array.isArray(editUserMultiValue.value) ? editUserMultiValue.value : []
    fieldValue = arr.map((uv) => {
      const found = memberOptions.value.find((u) => personKey(u) === String(uv))
      return found ? { ...found } : { memberId: String(uv) }
    })
  } else if (isSingleSelect.value) {
    const sv = editValue.value == null ? '' : String(editValue.value).trim()
    if (sv === '') {
      fieldValue = null
    } else {
      const found = selectOptions.value.find((o) => String(o.value) === sv)
      fieldValue = found
        ? { optionId: found.value, optionName: found.name, ...(found.color ? { color: found.color } : {}) }
        : { optionId: sv, optionName: sv }
    }
  } else if (isMultiSelect.value) {
    const arr = Array.isArray(editMultiValue.value) ? editMultiValue.value : []
    fieldValue = arr.map((v) => {
      const sv = String(v)
      const found = selectOptions.value.find((o) => String(o.value) === sv)
      return found ? { optionId: found.value, optionName: found.name } : { optionId: sv, optionName: sv }
    })
  } else if (isNumberType.value) {
    fieldValue = editValue.value == null || editValue.value === '' ? null : Number(editValue.value)
  } else {
    fieldValue = editValue.value == null ? null : String(editValue.value)
  }

  try {
    const res = await patchIssue(props.issueKey, [{ fieldId: props.field.id, fieldValue }])
    if (res?.success) {
      emit('saved', { value: fieldValue, exportValue: fieldValue })
    } else {
      message.error('保存失败')
    }
  } catch {
    message.error('保存失败')
  }
}

function cancelEdit() {
  if (memberSearchTimer) clearTimeout(memberSearchTimer)
  emit('cancel')
}

onMounted(initEdit)
</script>

<template>
  <div class="fve">
    <a-input
      v-if="isPlainText"
      v-model:value="editValue"
      size="small"
      class="fve-ctrl"
      @pressEnter="confirmEdit"
    />
    <a-textarea
      v-else-if="isMultiLine"
      v-model:value="editValue"
      size="small"
      class="fve-ctrl"
      :rows="2"
    />
    <a-input-number
      v-else-if="isNumberType"
      v-model:value="editValue"
      size="small"
      class="fve-ctrl"
    />
    <a-date-picker
      v-else-if="isDateType || isTimeType"
      v-model:value="editDateValue"
      size="small"
      class="fve-ctrl"
      :show-time="isTimeType"
      :format="isTimeType ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
    />
    <a-select
      v-else-if="isSingleSelect"
      v-model:value="editValue"
      size="small"
      class="fve-ctrl"
      :loading="optionLoading"
      placeholder="请选择"
    >
      <a-select-option v-for="o in selectOptions" :key="o.value" :value="o.value">{{ o.name }}</a-select-option>
    </a-select>
    <a-select
      v-else-if="isMultiSelect"
      v-model:value="editMultiValue"
      mode="multiple"
      size="small"
      class="fve-ctrl"
      :loading="optionLoading"
      placeholder="请选择"
    >
      <a-select-option v-for="o in selectOptions" :key="o.value" :value="o.value">{{ o.name }}</a-select-option>
    </a-select>
    <a-select
      v-else-if="isUserSingleType"
      v-model:value="editUserValue"
      size="small"
      class="fve-ctrl"
      show-search
      :filter-option="false"
      :loading="memberLoading"
      placeholder="搜索用户"
      :dropdown-match-select-width="false"
      popup-class-name="person-select-popup"
      @search="handleMemberSearch"
    >
      <a-select-option
        v-for="u in memberOptions"
        :key="personKey(u)"
        :value="personKey(u)"
      >
        <div class="fve-user-option">
          <img
            v-if="(u as unknown as Record<string, unknown>).avatarUrl"
            :src="String((u as unknown as Record<string, unknown>).avatarUrl)"
            class="fve-user-avatar"
            alt=""
          />
          <span v-else class="fve-user-avatar fve-user-avatar-letter">{{ (formatUserText(u as unknown as Record<string, unknown>) || '?').trim().charAt(0) }}</span>
          <span class="fve-user-label">{{ formatUserText(u as unknown as Record<string, unknown>) }}</span>
        </div>
      </a-select-option>
    </a-select>
    <a-select
      v-else-if="isUserMultiType"
      v-model:value="editUserMultiValue"
      mode="multiple"
      size="small"
      class="fve-ctrl"
      show-search
      :filter-option="false"
      :loading="memberLoading"
      placeholder="搜索用户"
      :dropdown-match-select-width="false"
      popup-class-name="person-select-popup"
      @search="handleMemberSearch"
    >
      <a-select-option
        v-for="u in memberOptions"
        :key="personKey(u)"
        :value="personKey(u)"
      >
        <div class="fve-user-option">
          <img
            v-if="(u as unknown as Record<string, unknown>).avatarUrl"
            :src="String((u as unknown as Record<string, unknown>).avatarUrl)"
            class="fve-user-avatar"
            alt=""
          />
          <span v-else class="fve-user-avatar fve-user-avatar-letter">{{ (formatUserText(u as unknown as Record<string, unknown>) || '?').trim().charAt(0) }}</span>
          <span class="fve-user-label">{{ formatUserText(u as unknown as Record<string, unknown>) }}</span>
        </div>
      </a-select-option>
    </a-select>
    <a-cascader
      v-else-if="isCascaderType"
      v-model:value="editCascaderValue"
      :options="selectOptions"
      size="small"
      class="fve-ctrl"
      :loading="optionLoading"
      placeholder="请选择"
    />
    <div class="fve-actions">
      <a-button size="small" type="primary" class="fve-act" @click="confirmEdit">
        <template #icon><CheckOutlined /></template>
      </a-button>
      <a-button size="small" class="fve-act" @click="cancelEdit">
        <template #icon><CloseOutlined /></template>
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.fve {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.fve-ctrl {
  flex: 1;
  min-width: 0;
}
.fve-actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}
.fve-act {
  min-width: 24px;
}
.fve-user-option {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fve-user-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.fve-user-avatar-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #d9d9d9;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}
.fve-user-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
