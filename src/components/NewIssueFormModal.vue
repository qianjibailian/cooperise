<template>
  <a-modal
    v-model:open="visible"
    width="60%"
    centered
    :mask-closable="false"
    :confirm-loading="newFormSubmitting"
    @ok="handleNewFormSubmit"
    @cancel="handleNewFormCancel"
    ok-text="提交"
    cancel-text="取消"
    destroy-on-close
    class="new-form-modal"
  >
    <template #title>
      <div class="new-form-title-bar">
        <span class="new-form-title-side"></span>
        <span class="new-form-title-text">新建</span>
        <div class="new-form-title-side new-form-title-side-right">
          <div class="new-form-template-selector">
            <span class="new-form-template-label">选择模板</span>
            <a-select
              v-model:value="selectedTemplate"
              class="new-form-template-select"
              :popup-match-select-width="false"
              @change="handleTemplateChange"
            >
              <a-select-option
                v-for="tpl in templateOptions"
                :key="tpl.value"
                :value="tpl.value"
              >{{ tpl.label }}</a-select-option>
            </a-select>
          </div>
        </div>
      </div>
    </template>
    <a-spin :spinning="newFormLoading" class="new-form-spin">
      <div class="new-form-inner">
        <!-- 上部固定区：事项类型（垂直居中于分割线上方） -->
        <div class="new-form-header">
          <a-form layout="horizontal" :label-width="120">
            <a-form-item label="事项类型">
              <a-select
                v-model:value="newFormIssueTypeId"
                style="width: 100%"
                @change="loadCreateMeta"
              >
                <a-select-option v-for="opt in issueTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-form>
        </div>
        <!-- 分割线：放在 header 与 tabs 之间 -->
        <a-divider class="new-form-divider" />
        <!-- 下部固定容器：承载 Tabs + 内容区 -->
        <div class="new-form-tabs-area">
          <template v-if="newFormTabs.length > 0">
            <a-tabs
              v-model:activeKey="newFormActiveTab"
              class="new-form-tabs"
              :tab-bar-style="{ marginBottom: '16px' }"
            >
              <a-tab-pane v-for="tab in newFormTabs" :key="tab.title" :tab="tab.title">
                <!-- 每个 tab 内部包一层独立滚动容器 -->
                <div class="tab-pane-scroll">
                  <a-form layout="horizontal" :label-width="120" :model="newFormData">
                    <a-form-item
                      v-for="field in tab.issueFields"
                      :key="field.id"
                    >
                      <template #label>
                        <span>{{ field.name }}</span>
                        <span v-if="field.required" class="form-item-required-mark">*</span>
                      </template>
                      <template v-if="field.type === 'TEXT_BOX_SINGLE_LINE'">
                        <a-input v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                      </template>
                      <template v-else-if="field.type === 'RICH_TEXT' || field.type === 'TEXT_BOX_MULTILINE'">
                        <a-textarea v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :rows="4" :disabled="!field.editable" style="width: 100%" />
                      </template>
                      <template v-else-if="field.type === 'NUMERIC_FIELD'">
                        <a-input-number v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                      </template>
                      <template v-else-if="field.type === 'DATE_PICKER'">
                        <a-date-picker v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                      </template>
                      <template v-else-if="field.type === 'SELECT_LIST_SINGLE' || field.type === 'SELECT_USER_SINGLE' || field.type === 'SPRINT_FIELD'">
                        <a-select v-model:value="newFormData[field.id]" :placeholder="field.description || '请选择'" :disabled="!field.editable" allow-clear style="width: 100%">
                          <a-select-option v-for="opt in getFieldOptions(field)" :key="opt.value" :value="opt.value" :disabled="opt.disabled">{{ opt.name }}</a-select-option>
                        </a-select>
                      </template>
                      <template v-else-if="field.type === 'SELECT_LIST_CASCADING'">
                        <a-cascader v-model:value="newFormData[field.id]" :options="getFieldOptions(field)" :placeholder="field.description || '请选择'" :disabled="!field.editable" :field-names="{ label: 'name', value: 'value', children: 'children' }" allow-clear style="width: 100%" />
                      </template>
                      <template v-else-if="field.type === 'CHECKBOX'">
                        <a-checkbox-group v-model:value="newFormData[field.id]" :disabled="!field.editable">
                          <a-checkbox v-for="opt in getFieldOptions(field)" :key="opt.value" :value="opt.value" :disabled="opt.disabled" style="margin-right: 16px; margin-bottom: 8px">{{ opt.name }}</a-checkbox>
                        </a-checkbox-group>
                      </template>
                      <template v-else-if="field.type === 'SELECT_LIST_MULTIPLE' || field.type === 'MULTI_SELECT'">
                        <a-select v-model:value="newFormData[field.id]" :placeholder="field.description || '请选择'" :disabled="!field.editable" mode="multiple" allow-clear style="width: 100%">
                          <a-select-option v-for="opt in getFieldOptions(field)" :key="opt.value" :value="opt.value" :disabled="opt.disabled">{{ opt.name }}</a-select-option>
                        </a-select>
                      </template>
                      <template v-else-if="field.type === 'RADIO'">
                        <a-radio-group v-model:value="newFormData[field.id]" :disabled="!field.editable">
                          <a-radio v-for="opt in getFieldOptions(field)" :key="opt.value" :value="opt.value" :disabled="opt.disabled">{{ opt.name }}</a-radio>
                        </a-radio-group>
                      </template>
                      <template v-else-if="field.type === 'ATTACHMENT_FIELD'">
                        <a-upload :disabled="!field.editable">
                          <a-button>点击上传</a-button>
                        </a-upload>
                      </template>
                      <template v-else-if="field.type === 'LINKS_FIELD'">
                        <a-input v-model:value="newFormData[field.id]" placeholder="输入关联事项编号" :disabled="!field.editable" style="width: 100%" />
                      </template>
                      <template v-else>
                        <a-input v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                      </template>
                    </a-form-item>
                  </a-form>
                </div>
              </a-tab-pane>
            </a-tabs>
          </template>
          <a-empty v-else description="暂无表单字段" />
        </div>
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { getIssueCreateMeta, createIssue, getCustomFieldOptions } from '@/api/faiz'
import type {
  CustomFieldOptionReq,
  CustomFieldOptionItem,
  CustomFieldOptionResponseItem,
  CustomFieldJOption,
  CreateMetaField,
  CreateIssueInputField,
  CreateIssueCascadingValue,
  CreateIssuePayload,
} from '@/types/faiz'

interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submitted': []
}>()

const visible = ref(props.open)
watch(
  () => props.open,
  (val) => {
    visible.value = val
    if (val) {
      // 每次打开清空上一次残留
      selectedTemplate.value = DEFAULT_TEMPLATE
      customFieldOptionsMap.value = {}
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      loadCreateMeta()
    }
  },
  { immediate: true },
)

watch(visible, (val) => {
  emit('update:open', val)
})

// 新建表单弹窗内部状态
const newFormLoading = ref(false)
const newFormSubmitting = ref(false)
const newFormData = ref<Record<string, any>>({})
const newFormTabs = ref<{ title: string; sequence: number; issueFields: any[] }[]>([])
const newFormActiveTab = ref('')
const newFormIssueTypeId = ref('10002')
const NEW_FORM_DEFAULT_PROJECT_ID = '18701'
const issueTypeOptions = [
  { value: '10001', label: '需求' },
  { value: '10002', label: '任务' },
  { value: '10003', label: '缺陷' },
  { value: '10004', label: '其他' },
]

/**
 * customId -> options（下拉/单选/多选/复选框/级联）
 * 批量接口返回后写入此处，渲染时按 customId 查找
 */
const customFieldOptionsMap = ref<Record<string, CustomFieldOptionItem[]>>({})

/** 根据表单元数据里的字段 type 判断是否需要走自定义字段选项接口 */
const CUSTOM_FIELD_TYPE_SET = new Set([
  'SELECT_LIST_SINGLE',
  'SELECT_LIST_MULTIPLE',
  'SELECT_LIST_CASCADING',
  'RADIO',
  'CHECKBOX',
  'MULTI_SELECT',
])

/**
 * 将接口 joptions.list 的单条数据转为前端通用的 CustomFieldOptionItem 结构
 * 递归处理 childJOptions（级联选择器需要 children 字段）
 */
function mapJOptionToItem(jopt: CustomFieldJOption): CustomFieldOptionItem {
  const children =
    Array.isArray(jopt.childJOptions) && jopt.childJOptions.length
      ? jopt.childJOptions.map(mapJOptionToItem)
      : undefined
  return {
    id: String(jopt.optionId),
    name: String(jopt.optionName ?? ''),
    value: String(jopt.optionId),
    disabled: !!jopt.obsolete,
    children,
  }
}

/**
 * 将响应 data（按 customFieldId 分桶的 list）转为 { customId: CustomFieldOptionItem[] } map
 */
function buildOptionMapFromResponse(
  list: CustomFieldOptionResponseItem[],
): Record<string, CustomFieldOptionItem[]> {
  const result: Record<string, CustomFieldOptionItem[]> = {}
  if (!Array.isArray(list)) return result
  for (const bucket of list) {
    const customId = String(bucket.customFieldId)
    const jList = bucket?.joptions?.list
    if (!customId || !Array.isArray(jList) || !jList.length) continue
    result[customId] = jList
      .filter((x: CustomFieldJOption) => x != null)
      .map(mapJOptionToItem)
  }
  return result
}

/**
 * 批量拉取自定义字段选项，并写入 customFieldOptionsMap
 */
async function loadCustomFieldOptions(
  projectId: string,
  issueTypeId: string,
  tabs: { issueFields: any[] }[],
) {
  const reqs: CustomFieldOptionReq[] = []
  for (const tab of tabs) {
    for (const f of tab.issueFields) {
      const type = (f.type ?? '').toString().toUpperCase()
      if (!CUSTOM_FIELD_TYPE_SET.has(type)) continue
      const customId = String(f.id)
      if (!/^\d+$/.test(customId)) continue
      reqs.push({
        customId,
        type: type as CustomFieldOptionReq['type'],
        projectId,
        issueTypeId,
        perPage: 20,
        page: 1,
      })
    }
  }
  if (!reqs.length) return
  try {
    const res = await getCustomFieldOptions(reqs)
    if (res && res.success && res.data) {
      const nextMap = buildOptionMapFromResponse(res.data)
      customFieldOptionsMap.value = { ...customFieldOptionsMap.value, ...nextMap }
    }
  } catch {
    // 拉取失败不阻塞页面，仍可使用 queryCreateMeta 返回的 options 兜底
  }
}

// 选择模板（标题栏右侧下拉）
const DEFAULT_TEMPLATE = 'default'
const selectedTemplate = ref<string>(DEFAULT_TEMPLATE)
const templateOptions = [
  { value: 'default', label: '默认模板' },
]

/**
 * 解析某字段的可用选项（下拉/单选/复选框/级联）
 * 优先使用批量接口返回的 options；否则回落到 createMeta 返回的 exportValue
 */
function getFieldOptions(field: any): CustomFieldOptionItem[] {
  const customId = String(field.id)
  const fromApi = customFieldOptionsMap.value?.[customId]
  if (fromApi && Array.isArray(fromApi) && fromApi.length) return fromApi
  const ev = field?.exportValue
  if (Array.isArray(ev) && ev.length) {
    const normalized: CustomFieldOptionItem[] = []
    for (const raw of ev) {
      if (raw == null) continue
      if (typeof raw === 'object' && ('value' in raw || 'id' in raw)) {
        normalized.push({
          id: String(raw.id ?? raw.value ?? ''),
          name: String(raw.name ?? raw.label ?? raw.value ?? raw.id ?? ''),
          value: String(raw.value ?? raw.id ?? ''),
          disabled: !!raw.disabled,
        })
      } else {
        const str = String(raw)
        normalized.push({ id: str, name: str, value: str })
      }
    }
    if (normalized.length) return normalized
  }
  return []
}

const handleTemplateChange = (_val: string) => {
  // TODO: 根据不同模板预填表单/切换字段配置
  // 目前仅记录选择，保持现有新建流程不变
}

// 加载创建表单元数据
async function loadCreateMeta() {
  newFormLoading.value = true
  const projectId = NEW_FORM_DEFAULT_PROJECT_ID
  const issueTypeId = newFormIssueTypeId.value
  try {
    const res = await getIssueCreateMeta({ projectId, issueTypeId })
    const info = res?.data
    if (info?.data?.tabItems?.length) {
      newFormTabs.value = info.data.tabItems
      newFormActiveTab.value = info.data.tabItems[0].title
    } else if (info?.issueFields?.length) {
      newFormTabs.value = [{ title: '表单', sequence: 0, issueFields: info.issueFields }]
      newFormActiveTab.value = '表单'
    } else {
      newFormTabs.value = []
    }
    const form: Record<string, unknown> = {}
    for (const tab of newFormTabs.value) {
      for (const f of tab.issueFields) {
        form[f.id] = f.value ?? null
      }
    }
    newFormData.value = form
    // 拉取自定义字段选项（与元数据并行，失败不阻塞）
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadCustomFieldOptions(projectId, issueTypeId, newFormTabs.value)
  } catch {
    message.error('获取表单元数据失败')
    newFormTabs.value = []
  } finally {
    newFormLoading.value = false
  }
}

function handleNewFormCancel() {
  selectedTemplate.value = DEFAULT_TEMPLATE
  customFieldOptionsMap.value = {}
  visible.value = false
}

/**
 * 根据 meta 收集所有字段（平铺到数组，保持 tab 内顺序）
 */
function collectAllFields(): CreateMetaField[] {
  const result: CreateMetaField[] = []
  for (const tab of newFormTabs.value) {
    if (Array.isArray(tab.issueFields)) result.push(...tab.issueFields)
  }
  return result
}

/**
 * 项目/事项类型的标准字段 type 约定（与后端 POST /issue/create 示例一致）
 */
const PROJECT_FIELD_TYPE = 'SELECT_LIST_SINGLE_PROJECT'
const ISSUETYPE_FIELD_TYPE = 'SELECT_LIST_SINGLE_ISSUETYPE'

/**
 * 判断字段是否为空（空字符串/空数组/null/undefined 视为空）
 */
function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

/**
 * 级联选择器输出通常是 string[]（如 ["父optionId", "子optionId", ...]）
 * 需要转换为 {optionId, childJOptions:[{optionId, childJOptions:[...]}]} 这样的嵌套结构
 * 兼容 value 已经是对象（用户从详情回填等情况）时直接返回
 */
function buildCascadingValue(raw: unknown): CreateIssueCascadingValue | undefined {
  if (raw == null) return undefined
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    // 已经是 object，尽量原样返回（兼容已为 CreateIssueCascadingValue 结构）
    const obj = raw as Record<string, unknown>
    const optionId = obj.optionId
    if (optionId == null || String(optionId).trim() === '') return undefined
    const value: CreateIssueCascadingValue = { optionId: String(optionId) }
    if (Array.isArray(obj.childJOptions) && obj.childJOptions.length) {
      value.childJOptions = obj.childJOptions as CreateIssueCascadingValue[]
    }
    return value
  }
  if (Array.isArray(raw)) {
    const ids = raw
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter((x) => x !== '')
    if (!ids.length) return undefined
    // 从最内层节点向外构建：最后一层没有 childJOptions
    let nested: CreateIssueCascadingValue | undefined
    for (let i = ids.length - 1; i >= 0; i--) {
      const current: CreateIssueCascadingValue = { optionId: ids[i] }
      if (nested) current.childJOptions = [nested]
      nested = current
    }
    return nested
  }
  // 非数组/非对象，尝试作为单级字符串 optionId
  const str = String(raw).trim()
  if (!str) return undefined
  return { optionId: str }
}

/**
 * 将表单值按 field.type 转为 POST /issue/create 期望的 value 结构
 */
function buildFieldValue(field: CreateMetaField, raw: unknown): unknown {
  const type = (field.type ?? '').toString().toUpperCase()
  if (isEmptyValue(raw)) {
    return type === 'NUMERIC_FIELD' ? null : undefined
  }
  // 级联字段：特殊结构嵌套 optionId + childJOptions
  if (type === 'SELECT_LIST_CASCADING') {
    return buildCascadingValue(raw)
  }
  // 数字字段：保持 number 类型
  if (type === 'NUMERIC_FIELD') {
    if (typeof raw === 'number') return raw
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  // 多选/复选框：一般已经是 string[]，直接返回
  if (
    type === 'SELECT_LIST_MULTIPLE' ||
    type === 'CHECKBOX' ||
    type === 'MULTI_SELECT'
  ) {
    return raw
  }
  // 单选/用户单选/日期/文本等：保持原值（日期组件返回 Dayjs；后端如要求字符串可在此做 format）
  return raw
}

/**
 * 构造 POST /issue/create 的 { inputFields: [...] }
 * 顺序：project -> issuetype -> meta 中的自定义/标准字段（按 tab 顺序，空值也带 id/type 以防服务端默认值缺失）
 */
function buildCreateIssuePayload(): CreateIssuePayload {
  const allFields = collectAllFields()
  const inputFields: CreateIssueInputField[] = []

  // 1) 项目
  inputFields.push({
    id: 'project',
    type: PROJECT_FIELD_TYPE,
    value: NEW_FORM_DEFAULT_PROJECT_ID,
  })
  // 2) 事项类型
  inputFields.push({
    id: 'issuetype',
    type: ISSUETYPE_FIELD_TYPE,
    value: newFormIssueTypeId.value,
  })

  // 3) 其余字段（按 tab.sequence + tab 内顺序）
  const seenIds = new Set<string>(['project', 'issuetype'])
  for (const field of allFields) {
    const id = String(field.id ?? '').trim()
    if (!id || seenIds.has(id)) continue
    seenIds.add(id)
    const raw = newFormData.value[id]
    const value = buildFieldValue(field, raw)
    inputFields.push({
      id,
      type: (field.type ?? '').toString(),
      value,
    })
  }

  return { inputFields }
}

async function handleNewFormSubmit() {
  for (const tab of newFormTabs.value) {
    for (const f of tab.issueFields) {
      if (f.required) {
        const val = newFormData.value[f.id]
        if (isEmptyValue(val)) {
          message.warning(`请填写${f.name}`)
          newFormActiveTab.value = tab.title
          return
        }
      }
    }
  }
  newFormSubmitting.value = true
  try {
    const payload = buildCreateIssuePayload()
    await createIssue(payload)
    message.success('提交成功')
    visible.value = false
    emit('submitted')
  } catch (err: any) {
    message.error(err?.response?.data?.message || '提交失败，请稍后重试')
  } finally {
    newFormSubmitting.value = false
  }
}
</script>

<style>
/* Modal 样式需要写在非 scoped 块中，因为 Ant Design Modal 通过 Teleport 渲染到 body */

/* ========== 苹果 × Google 融合主题色 ========== */

.new-form-modal .ant-modal-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.new-form-modal .ant-modal {
  top: 0;
  padding-bottom: 0;
  box-shadow:
    0 1px 2px 0 rgba(15, 23, 42, 0.04),
    0 8px 24px -4px rgba(15, 23, 42, 0.08),
    0 24px 64px -12px rgba(15, 23, 42, 0.18);
}

.new-form-modal .ant-modal-mask {
  background: transparent;
}

/* ========== 弹窗整体容器：大圆角 + 背景 ========== */
.new-form-modal .ant-modal-content {
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  min-height: 0;
  border-radius: 20px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

/* ========== Header：居中标题 + 右侧「选择模板」下拉 ========== */
.new-form-modal .ant-modal-header {
  flex-shrink: 0;
  padding: 14px 24px 10px;
  border-bottom: none;
  background: transparent;
  border-radius: 0;
  display: block;
}

.new-form-modal .ant-modal-title {
  width: 100%;
  margin: 0;
}

.new-form-title-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  column-gap: 0;
}

.new-form-title-side {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.new-form-title-text {
  grid-column: 2 / 3;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #0f172a;
  white-space: nowrap;
  min-width: 0;
}

.new-form-title-side-right {
  justify-content: flex-end;
  overflow: visible;
}

.new-form-template-selector {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  width: auto;
  margin-right: 24px;
}

.new-form-template-label {
  font-size: 13px;
  color: #475569;
  font-weight: 500;
  white-space: nowrap;
}

.new-form-template-select.ant-select {
  width: 160px;
  min-width: 0;
}

.new-form-template-select .ant-select-selector {
  height: 32px !important;
  line-height: 30px !important;
  padding: 0 12px !important;
  border-radius: 8px !important;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  font-size: 13px;
  color: #0f172a;
  transition: all 0.15s ease;
}

.new-form-template-select:hover .ant-select-selector {
  border-color: #cbd5e1 !important;
}

.new-form-template-select.ant-select-focused .ant-select-selector {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12) !important;
}

.new-form-template-select.ant-select-single .ant-select-selector .ant-select-selection-item,
.new-form-template-select.ant-select-single .ant-select-selector .ant-select-selection-placeholder,
.new-form-template-select.ant-select-single .ant-select-selector .ant-select-selection-search-input {
  height: 30px !important;
  line-height: 30px;
}

.new-form-modal .ant-modal-close {
  top: 20px;
  right: 24px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 0.15s ease;
}

.new-form-modal .ant-modal-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.new-form-modal .ant-modal-close-x {
  width: auto;
  height: auto;
  font-size: 16px;
  line-height: 1;
}

/* ========== Footer：按钮区 + 细分隔线 ========== */
.new-form-modal .ant-modal-footer {
  flex-shrink: 0;
  padding: 12px 24px 16px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  background: transparent;
  text-align: right;
  border-radius: 0;
}

.new-form-modal .ant-modal-footer .ant-btn {
  height: 34px;
  padding: 0 20px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.new-form-modal .ant-modal-footer .ant-btn-default {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #0f172a;
}

.new-form-modal .ant-modal-footer .ant-btn-default:hover {
  background: #f8fafc;
  border-color: #94a3b8;
  color: #0f172a;
}

.new-form-modal .ant-modal-footer .ant-btn-primary {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  color: #ffffff;
  box-shadow:
    0 1px 2px 0 rgba(37, 99, 235, 0.18),
    0 4px 12px -2px rgba(37, 99, 235, 0.35);
}

.new-form-modal .ant-modal-footer .ant-btn-primary:hover {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow:
    0 1px 2px 0 rgba(29, 78, 216, 0.20),
    0 6px 16px -2px rgba(29, 78, 216, 0.40);
  transform: translateY(-0.5px);
}

.new-form-modal .ant-modal-footer .ant-btn-primary:active {
  transform: translateY(0);
  box-shadow:
    0 1px 2px 0 rgba(29, 78, 216, 0.25),
    inset 0 1px 2px 0 rgba(0, 0, 0, 0.08);
}

.new-form-modal .ant-modal-footer .ant-btn-primary.ant-btn-loading {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  opacity: 0.85;
}

/* body 占满 content 剩余高度（= 75vh - header - footer），交给内部 flex 分区 */
.new-form-modal .ant-modal-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 6px 24px 16px;
  box-sizing: border-box;
}

.new-form-spin,
.new-form-spin .ant-spin-container {
  height: 100%;
  min-height: 0;
}

.new-form-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ===== 第一段固定区：事项类型容器 ===== */
.new-form-header {
  flex-shrink: 0;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  padding-top: 12px;
}

.new-form-header .ant-form,
.new-form-header .ant-form-item {
  margin-bottom: 0;
}

.new-form-divider.ant-divider {
  flex-shrink: 0;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  margin: 0 0 12px;
}

/* ===== 第二段承载区：Tabs 外壳（不滚，传高度给 Tabs） ===== */
.new-form-tabs-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.new-form-tabs-area .ant-empty {
  margin: auto;
  color: #64748b;
}

.new-form-tabs-area .ant-empty-description {
  color: #64748b;
}

/* ===== Tabs：白底风格 ===== */
.new-form-tabs-area .new-form-tabs,
.new-form-tabs-area .new-form-tabs > .ant-tabs {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-nav {
  flex-shrink: 0;
  margin-bottom: 12px;
  background: #ffffff;
  padding: 0;
  border-radius: 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: none;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-nav::before {
  display: none;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tab {
  padding: 8px 18px;
  margin: 0 6px 0 0 !important;
  border-radius: 0;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  height: 34px;
  line-height: 18px;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tab:last-child {
  margin-right: 0 !important;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tab:hover {
  color: #0f172a;
  background: #f8fafc;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tab.ant-tabs-tab-active {
  color: #2563eb;
  background: #ffffff;
  border-bottom-color: #2563eb;
  font-weight: 600;
  box-shadow: none;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-ink-bar {
  display: none !important;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-content-holder,
.new-form-tabs-area .new-form-tabs .ant-tabs-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tabpane {
  height: 100%;
  min-height: 0;
}

/* ===== 真正的滚动区：Tab 内容（表单字段） ===== */
.tab-pane-scroll {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;
  max-height: calc(75vh - 260px);
}

/* ===== 滚动条：Apple 细条 + Material 圆角 ===== */
.tab-pane-scroll::-webkit-scrollbar,
.new-form-modal ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tab-pane-scroll::-webkit-scrollbar-thumb,
.new-form-modal ::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.tab-pane-scroll::-webkit-scrollbar-thumb:hover,
.new-form-modal ::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
  background-clip: padding-box;
  border: 2px solid transparent;
}

.tab-pane-scroll::-webkit-scrollbar-track,
.new-form-modal ::-webkit-scrollbar-track {
  background: transparent;
}

/* ====== 新建弹窗 - 水平表单布局样式 ====== */
.form-item-required-mark {
  color: #ef4444;
  margin-left: 2px;
  font-family: -apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-weight: 600;
}

.new-form-modal .ant-form-item {
  margin-bottom: 14px;
}

.new-form-modal .ant-form-item:last-child {
  margin-bottom: 0;
}

.new-form-modal .ant-form-item .ant-form-item-label {
  width: 120px;
  flex: 0 0 120px;
  padding-right: 12px;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.new-form-modal .ant-form-item .ant-form-item-label > label {
  height: 34px;
  align-items: center;
  white-space: nowrap;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

.new-form-modal .ant-form-item-label > label::after {
  display: none;
}

.new-form-modal .ant-form-item .ant-form-item-control {
  flex: 1;
  min-width: 0;
  min-height: 34px;
}

/* ========== 输入控件：Material Filled × Apple Rounded（更紧凑尺寸） ========== */
.new-form-modal .ant-input,
.new-form-modal .ant-input-number,
.new-form-modal .ant-picker,
.new-form-modal .ant-select-selector {
  height: 34px !important;
  line-height: 32px;
  border-radius: 8px !important;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  font-size: 13px;
  color: #0f172a;
  padding: 0 12px;
  transition: all 0.15s ease;
}

.new-form-modal .ant-input {
  padding: 0 10px;
}

.new-form-modal .ant-input-affix-wrapper,
.new-form-modal textarea.ant-input {
  border-radius: 8px !important;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  transition: all 0.15s ease;
}

.new-form-modal textarea.ant-input {
  padding: 8px 10px;
  line-height: 1.5;
  font-size: 13px;
}

.new-form-modal .ant-input:hover,
.new-form-modal .ant-input-number:hover,
.new-form-modal .ant-picker:hover,
.new-form-modal .ant-select:not(.ant-select-disabled):hover .ant-select-selector,
.new-form-modal .ant-input-affix-wrapper:hover,
.new-form-modal textarea.ant-input:hover {
  border-color: #cbd5e1 !important;
  background: #ffffff;
}

.new-form-modal .ant-input:focus,
.new-form-modal .ant-input-focused,
.new-form-modal .ant-input-number:focus,
.new-form-modal .ant-input-number-focused,
.new-form-modal .ant-picker:focus,
.new-form-modal .ant-picker-focused,
.new-form-modal .ant-select-focused .ant-select-selector,
.new-form-modal .ant-input-affix-wrapper:focus,
.new-form-modal .ant-input-affix-wrapper-focused,
.new-form-modal textarea.ant-input:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.10) !important;
  outline: none;
  background: #ffffff !important;
}

.new-form-modal .ant-input[disabled],
.new-form-modal .ant-input-number.ant-input-number-disabled,
.new-form-modal .ant-picker.ant-picker-disabled,
.new-form-modal .ant-select-disabled .ant-select-selector {
  background: #f8fafc !important;
  border-color: #e2e8f0 !important;
  color: #94a3b8 !important;
  cursor: not-allowed;
}

.new-form-modal .ant-select .ant-select-selector {
  padding: 0 10px !important;
  height: 34px !important;
}

.new-form-modal .ant-select-single .ant-select-selector .ant-select-selection-search-input {
  height: 32px !important;
  line-height: 32px;
}

.new-form-modal .ant-select-single .ant-select-selector .ant-select-selection-item,
.new-form-modal .ant-select-single .ant-select-selector .ant-select-selection-placeholder {
  line-height: 32px;
  font-size: 13px;
}

.new-form-modal .ant-input-number-input-wrap {
  height: 32px;
}

.new-form-modal .ant-input-number-input {
  height: 32px;
  line-height: 32px;
  padding: 0 10px !important;
  font-size: 13px;
}

.new-form-modal .ant-picker .ant-picker-input {
  height: 32px;
  line-height: 32px;
}

.new-form-modal .ant-picker .ant-picker-input > input {
  height: 32px;
  line-height: 32px;
  font-size: 13px;
}

.new-form-modal .ant-divider {
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  margin: 0;
}
</style>
