<template>
  <a-modal
    v-model:open="modalOpen"
    :title="isEdit ? '编辑字段' : props.forceCustom ? '新增自定义字段' : '新增字段'"
    width="680px"
    :footer="null"
    destroy-on-close
    class="edit-modal"
  >
    <div v-if="props.forceCustom && !isEdit" class="custom-field-tip">
      将创建为<b>自定义字段</b>，保存后自动加入当前表单，也可在字段管理中维护
    </div>
    <a-form :model="editForm" layout="vertical">
      <a-row :gutter="24">
        <a-col :span="12">
          <a-form-item label="字段名称" required>
            <a-input v-model:value="editForm.fieldName" placeholder="输入字段名称" size="large" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="字段编号">
            <a-input
              v-model:value="editForm.fieldNumId"
              placeholder="字段编号"
              style="width: 100%"
              :disabled="props.disableFieldNum"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="24">
        <a-col :span="12">
          <a-form-item label="字段分组">
            <a-select v-model:value="editForm.fieldGroup" placeholder="选择字段分组" size="large" allow-clear style="width: 100%">
              <a-select-option v-for="g in fieldGroupOptions" :key="g.value" :value="g.value">{{ g.label }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="字段类型">
            <a-select v-model:value="editForm.type" placeholder="选择字段类型" size="large" allow-clear style="width: 100%" @change="onTypePicked">
              <a-select-option v-for="t in fieldTypeOptions" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item v-if="!editForm.isSystem" label="关联问题类型" required>
        <a-select
          v-model:value="editForm.issueTypeCodes"
          mode="multiple"
          :options="issueTypeOptions"
          :loading="issueTypesLoading"
          option-filter-prop="label"
          placeholder="自定义字段必须关联至少一个问题类型"
          style="width: 100%"
        />
      </a-form-item>

      <!-- 选项配置：单选下拉 / 多选下拉 / 级联选择器 -->
      <template v-if="isEnumType">
        <a-form-item :label="isCascaderType ? '级联选项配置 (fieldValue)' : '选项配置 (fieldValue)'">
          <div class="enum-options-editor">
            <div class="enum-options-header">
              <span class="opt-col">选项名称</span>
              <span v-if="isColorableType" class="opt-col opt-color-col">颜色</span>
              <span class="opt-col opt-action-col">操作</span>
            </div>
            <div v-for="(opt, idx) in enumOptions" :key="idx" class="enum-option-row">
              <div class="enum-option-inputs">
                <a-input
                  v-model:value="opt.label"
                  :placeholder="isCascaderType ? '一级选项名称' : '选项名称'"
                  @input="onEnumOptionChange"
                />
                <div
                  v-if="isColorableType"
                  class="enum-option-color-wrap"
                >
                  <a-popover trigger="click" placement="bottom" :overlay-style="{ zIndex: 1100 }">
                    <template #content>
                      <div class="enum-color-grid">
                        <button
                          v-for="c in PRESET_COLORS"
                          :key="c"
                          type="button"
                          :class="['enum-color-swatch', { active: opt.color === c }]"
                          :style="{ background: c }"
                          :aria-label="c"
                          @click="onColorPick(opt, c)"
                        >
                          <CheckOutlined v-if="opt.color === c" />
                        </button>
                      </div>
                    </template>
                    <button type="button" class="enum-color-btn" title="选项颜色">
                      <span class="enum-color-dot" :style="{ background: opt.color || '#c7c7cc' }" />
                    </button>
                  </a-popover>
                  <span
                    v-if="opt.color"
                    class="enum-option-color-clear"
                    title="清除颜色"
                    @click="onColorClear(opt)"
                  >×</span>
                </div>
                <a-button
                  type="text"
                  danger
                  size="small"
                  @click="removeEnumOption(idx)"
                >
                  <MinusCircleOutlined />
                </a-button>
              </div>
              <!-- 级联子选项 -->
              <div v-if="isCascaderType && opt.children && opt.children.length" class="enum-option-children">
                <div v-for="(child, cIdx) in opt.children" :key="cIdx" class="enum-option-row child">
                  <div class="enum-option-inputs">
                    <a-input
                      v-model:value="child.label"
                      placeholder="二级选项名称"
                      @input="onEnumOptionChange"
                    />
                    <a-button
                      type="text"
                      danger
                      size="small"
                      @click="removeCascaderChild(idx, cIdx)"
                    >
                      <MinusCircleOutlined />
                    </a-button>
                  </div>
                </div>
              </div>
              <a-button
                v-if="isCascaderType"
                type="dashed"
                size="small"
                block
                style="margin-top: 4px"
                @click="addCascaderChild(idx)"
              >+ 添加二级选项</a-button>
            </div>
            <a-button type="dashed" block style="margin-top: 8px" @click="addEnumOption">+ 添加选项</a-button>
          </div>
        </a-form-item>
      </template>

      <a-form-item label="支持的操作">
        <a-select
          v-model:value="editForm.supportOperator"
          mode="tags"
          :options="supportOperatorOptions"
          placeholder="选择或输入支持的操作"
          style="width: 100%"
        />
      </a-form-item>
      <a-form-item label="展示场景与必填">
        <a-tabs v-model:active-key="sceneTab" size="small" class="scene-tabs">
          <a-tab-pane v-for="sc in SCENE_OPTIONS" :key="sc.value">
            <template #tab>
              <span class="scene-tab">
                <i :class="['scene-tab-dot', { on: isShownIn(sc.value) }]" />
                {{ sc.label }}
                <span v-if="isRequiredIn(sc.value)" class="scene-tab-required">必填</span>
                <span v-else-if="isShownIn(sc.value) && !isEditableIn(sc.value)" class="scene-tab-readonly">只读</span>
              </span>
            </template>
            <div class="scene-pane">
              <div class="scene-row">
                <div class="scene-row-text">
                  <div class="scene-row-title">在「{{ sc.label }}」中展示</div>
                  <div class="scene-row-desc">{{ props.lockShownScene === sc.value ? props.lockShownHint || SCENE_DESC[sc.value] : SCENE_DESC[sc.value] }}</div>
                </div>
                <a-switch
                  :checked="isShownIn(sc.value)"
                  :disabled="props.lockShownScene === sc.value"
                  @change="(v: unknown) => setShownIn(sc.value, !!v)"
                />
              </div>
              <div class="scene-row">
                <div class="scene-row-text">
                  <div class="scene-row-title">必填</div>
                  <div class="scene-row-desc">{{ requiredDesc(sc.value, sc.label) }}</div>
                </div>
                <a-switch
                  :checked="isRequiredIn(sc.value)"
                  :disabled="!isShownIn(sc.value) || !isEditableIn(sc.value)"
                  @change="(v: unknown) => setRequiredIn(sc.value, !!v)"
                />
              </div>
              <div class="scene-row">
                <div class="scene-row-text">
                  <div class="scene-row-title">支持编辑</div>
                  <div class="scene-row-desc">{{ isShownIn(sc.value) ? (isEditableIn(sc.value) ? `「${sc.label}」中可修改该字段的值` : `「${sc.label}」中只读展示，不可修改`) : '需先在该场景展示，才能设置是否可编辑' }}</div>
                </div>
                <a-switch
                  :checked="isEditableIn(sc.value)"
                  :disabled="!isShownIn(sc.value)"
                  @change="(v: unknown) => setEditableIn(sc.value, !!v)"
                />
              </div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </a-form-item>
      <a-row :gutter="24">
        <a-col v-if="props.showSystemSwitch && !props.forceCustom" :span="6">
          <a-form-item label="系统字段">
            <a-switch v-model:checked="editForm.isSystem" checked-children="是" un-check-children="否" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
    <!-- 预览区 -->
    <div class="preview-section">
      <div class="preview-title">预览</div>
      <div class="preview-body">
        <div class="preview-row">
          <span class="preview-label">
            <span v-if="editForm.requiredScene?.length" class="preview-required-mark">*</span>
            <span v-if="editForm.fieldName" class="preview-label-text">{{ editForm.fieldName }}</span>
            <span v-else class="preview-label-placeholder">字段名称</span>
          </span>
          <div class="preview-control">
            <a-input
              v-if="isType(FIELD_TYPE.TEXT_BOX_SINGLE_LINE)"
              placeholder="请输入"
              :disabled="!editForm.fieldName"
            />
            <a-textarea
              v-else-if="isType(FIELD_TYPE.TEXT_BOX_MULTI_LINE)"
              placeholder="请输入"
              :rows="4"
              :disabled="!editForm.fieldName"
            />
            <a-input-number
              v-else-if="isType(FIELD_TYPE.TEXT_BOX_NUMBER)"
              placeholder="请输入数字"
              :disabled="!editForm.fieldName"
            />
            <a-date-picker
              v-else-if="isType(FIELD_TYPE.DATE_PICKER)"
              :disabled="!editForm.fieldName"
            />
            <a-date-picker
              v-else-if="isType(FIELD_TYPE.TIME_PICKER)"
              show-time
              :disabled="!editForm.fieldName"
            />
            <a-select
              v-else-if="isType(FIELD_TYPE.SELECT_LIST_SINGLE)"
              placeholder="请选择"
              :disabled="!editForm.fieldName"
              allow-clear
            >
              <a-select-option v-for="opt in enumOptions" :key="opt.value" :value="opt.value">
                <span class="preview-option-item">
                  <span v-if="opt.color" class="preview-option-dot" :style="{ background: opt.color }" />
                  <span :style="opt.color ? { color: opt.color } : {}">{{ opt.label }}</span>
                </span>
              </a-select-option>
            </a-select>
            <a-select
              v-else-if="isType(FIELD_TYPE.SELECT_LIST_MULTI)"
              placeholder="请选择"
              :disabled="!editForm.fieldName"
              allow-clear
              mode="multiple"
            >
              <a-select-option v-for="opt in enumOptions" :key="opt.value" :value="opt.value">
                <span class="preview-option-item">
                  <span v-if="opt.color" class="preview-option-dot" :style="{ background: opt.color }" />
                  <span :style="opt.color ? { color: opt.color } : {}">{{ opt.label }}</span>
                </span>
              </a-select-option>
            </a-select>
            <a-cascader
              v-else-if="isType(FIELD_TYPE.CASCADER_SINGLE)"
              placeholder="请选择"
              :disabled="!editForm.fieldName"
              allow-clear
              :options="enumOptions"
              :field-names="{ label: 'label', value: 'value', children: 'children' }"
            />
            <a-select
              v-else-if="isType(FIELD_TYPE.SELECT_USER_SINGLE)"
              placeholder="请选择成员"
              show-search
              :disabled="!editForm.fieldName"
              allow-clear
            />
            <a-select
              v-else-if="isType(FIELD_TYPE.SELECT_USER_MULTI)"
              placeholder="请选择成员"
              show-search
              :disabled="!editForm.fieldName"
              allow-clear
              mode="multiple"
            />
            <a-textarea
              v-else-if="isType(FIELD_TYPE.RICH_TEXT)"
              placeholder="请输入描述"
              :rows="4"
              :disabled="!editForm.fieldName"
            />
            <span
              v-else-if="isType(FIELD_TYPE.LABEL)"
              class="display-text-preview"
            >{{ editForm.fieldName ? '这是只读文本内容' : '只读文本' }}</span>
            <a-input
              v-else
              placeholder="请先选择字段类型"
              disabled
            />
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <a-space>
        <a-button @click="modalOpen = false">取消</a-button>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">保存</a-button>
      </a-space>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { MinusCircleOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { PRESET_COLORS, DEFAULT_PRESET_COLOR } from '@/config/colors'
import { queryIssueTypes, type IssueTypeItem } from '@/api/faiz'
import type { AvailableFieldItem, AvailableFieldSavePayload, EnumOptionItem } from '@/types/faiz'
import {
  FIELD_TYPE, fieldTypeOptions, isEnumFieldType, defaultFieldGroupByType,
} from '@/types/fieldType'
import { FIELD_OPERATORS, fieldOperatorName, type RawFieldOperator } from '@/types/fieldOperator'
import { OPERATORS_BY_KIND, valueKindOf } from '@/utils/issueFilter'
import {
  SCENE_OPTIONS, SCENE_DESC, DEFAULT_DISPLAY_SCENE, sortScenes, requiredScenesOf, editableScenesOf,
  type FieldEditApi, type FieldRow,
} from '@/utils/fieldConfig'

/**
 * 字段新增 / 编辑弹窗：字段管理（可选字段 / 系统字段）与模板编辑「新建字段」共用
 * - record 为空：新增；有值：按 id 拉详情回填后编辑
 * - 保存成功后 emit saved（新增时带接口返回的新建字段，含 fieldId）
 */
const props = withDefaults(defineProps<{
  open: boolean
  /** 编辑的字段行；为空表示新增 */
  record?: FieldRow | null
  /** 详情 / 新增 / 更新接口 */
  api: FieldEditApi
  /** 是否展示「系统字段」开关 */
  showSystemSwitch?: boolean
  /** 「字段编号」是否置灰 */
  disableFieldNum?: boolean
  /** 锁定为必须展示的场景（如模板里新建字段固定在「新建」展示），该场景的展示开关不可关闭 */
  lockShownScene?: string
  /** 锁定场景的说明文案 */
  lockShownHint?: string
  /** 只建自定义字段：isSystem 固定为 false，不展示系统字段开关（模板编辑里新建字段） */
  forceCustom?: boolean
  /** 空间内：问题类型下拉只列本空间的问题类型（已关联的其他类型仍保留回显） */
  spaceCode?: string
  /** 新增时预选的问题类型（如模板编辑里新建字段，预选模板的问题类型） */
  presetIssueTypeCodes?: string[]
}>(), {
  record: null,
  showSystemSwitch: false,
  disableFieldNum: true,
  lockShownScene: '',
  lockShownHint: '',
  forceCustom: false,
  spaceCode: '',
  presetIssueTypeCodes: () => [],
})

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved', payload: { isEdit: boolean; field: FieldRow | null }): void
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const isEdit = computed(() => !!props.record?.id)
const submitting = ref(false)

// ---- 字段分组选项 ----
const fieldGroupOptions = [
  { value: 'PERSON', label: '人员信息' },
  { value: 'DESCRIPTION', label: '描述' },
  { value: 'TIME', label: '时间信息' },
  { value: 'SUBJECT', label: '基础信息' },
  { value: 'TEAM_STANDARD', label: '团队标准字段' },
  { value: 'COMPANY_STANDARD', label: '公司标准字段' },
  { value: 'SUPPLEMENT', label: '补充信息' },
]

/** 历史分组值 → 现行编码：原「自定义字段」在详情里归「团队自定义信息」，即团队标准字段 */
const LEGACY_FIELD_GROUP: Record<string, string> = {
  CUSTOM_FIELD: 'TEAM_STANDARD',
  公司标准信息: 'COMPANY_STANDARD',
}

// ---- 支持的操作枚举（表单按名称选择；系统字段接口提交时再转换为 {id,name,code,identifier}） ----
const supportOperatorOptions = FIELD_OPERATORS.map((o) => ({ value: o.name, label: `${o.name}（${o.identifier}）` }))

/** 回填表单：操作符统一为名称 */
function toOperatorNames(list?: RawFieldOperator[] | null): string[] {
  return (list ?? []).map(fieldOperatorName).filter(Boolean)
}

// ---- 表单 ----
type EditForm = AvailableFieldSavePayload & { supportOperator: string[] }

function emptyForm(): EditForm {
  const shown = [...DEFAULT_DISPLAY_SCENE]
  if (props.lockShownScene && !shown.includes(props.lockShownScene)) shown.push(props.lockShownScene)
  return {
    fieldNumId: '',
    fieldName: '',
    fieldGroup: '',
    type: '',
    supportOperator: [],
    displayScene: sortScenes(shown),
    requiredScene: [],
    editableScene: sortScenes(shown),
    issueTypeCodes: [...props.presetIssueTypeCodes],
    isSystem: false,
    obsolete: false,
    isRequired: false,
    configSchema: '',
    fieldValue: '',
  }
}

/** 字段行 → 表单 */
function formFromRow(d: FieldRow): EditForm {
  return {
    fieldNumId: d.fieldId || '',
    fieldName: d.fieldName || '',
    fieldGroup: (d.fieldGroup && LEGACY_FIELD_GROUP[d.fieldGroup]) || d.fieldGroup || '',
    type: d.type || d.filedType || '',
    supportOperator: toOperatorNames(d.supportOperator),
    displayScene: d.displayScene?.length ? [...d.displayScene] : [...DEFAULT_DISPLAY_SCENE],
    requiredScene: requiredScenesOf(d),
    editableScene: editableScenesOf(d),
    issueTypeCodes: [...(d.issueTypeCodes ?? [])],
    isSystem: d.isSystem ?? false,
    obsolete: d.obsolete ?? false,
    isRequired: d.isRequired ?? false,
    configSchema: d.configSchema || '',
    fieldValue: d.fieldValue || '',
  }
}

const editForm = ref<EditForm>(emptyForm())

// ---- 关联问题类型：全量拉一次（名称回显），下拉按空间过滤 ----
const allIssueTypes = ref<IssueTypeItem[]>([])
const issueTypesLoading = ref(false)
async function loadIssueTypes() {
  if (allIssueTypes.value.length || issueTypesLoading.value) return
  issueTypesLoading.value = true
  try {
    const res = await queryIssueTypes({ page: 1, pageSize: 999 })
    allIssueTypes.value = res?.success ? res.data?.list || [] : []
  } catch {
    allIssueTypes.value = []
  } finally {
    issueTypesLoading.value = false
  }
}
const issueTypeOptions = computed(() => {
  const selected = editForm.value.issueTypeCodes ?? []
  // 指定空间时只允许选择该空间的问题类型（已关联的历史类型仍保留回显）；
  // 字段的「所属空间」就是靠关联该空间的问题类型表达的
  const list = allIssueTypes.value.filter(t => t.issueTypeCode
    && (!props.spaceCode || t.spaceCode === props.spaceCode || selected.includes(t.issueTypeCode)))
  const opts = list.map(t => ({ value: t.issueTypeCode as string, label: t.issueTypeName }))
  // 已关联但查不到的类型（已删除等）也保留，避免显示为空
  for (const code of selected) {
    if (!opts.some(o => o.value === code)) opts.push({ value: code, label: code })
  }
  return opts
})

// ---- 展示场景 tab ----
/** 弹窗当前查看的场景 tab */
const sceneTab = ref('CREATE')

function isShownIn(scene: string) {
  return !!editForm.value.displayScene?.includes(scene)
}
function isRequiredIn(scene: string) {
  return !!editForm.value.requiredScene?.includes(scene)
}
function isEditableIn(scene: string) {
  return !!editForm.value.editableScene?.includes(scene)
}
function setShownIn(scene: string, shown: boolean) {
  const cur = editForm.value.displayScene ?? []
  editForm.value.displayScene = sortScenes(shown ? [...cur, scene] : cur.filter(s => s !== scene))
  // 新展示的场景默认可编辑；不展示的场景不能必填
  if (shown) setEditableIn(scene, true)
  else setRequiredIn(scene, false)
}
function setEditableIn(scene: string, editable: boolean) {
  const cur = editForm.value.editableScene ?? []
  editForm.value.editableScene = sortScenes(editable ? [...cur, scene] : cur.filter(s => s !== scene))
  // 不可编辑的场景不能必填（只读项无法填写，必填会卡住提交）
  if (!editable) setRequiredIn(scene, false)
}
function setRequiredIn(scene: string, required: boolean) {
  const cur = editForm.value.requiredScene ?? []
  editForm.value.requiredScene = sortScenes(required ? [...cur, scene] : cur.filter(s => s !== scene))
}
function requiredDesc(scene: string, label: string) {
  if (!isShownIn(scene)) return '需先在该场景展示，才能设为必填'
  if (!isEditableIn(scene)) return '只读场景不能设为必填'
  return `「${label}」中该字段必须填写`
}

// ---- 类型相关判定（来自 @/types/fieldType 统一维护） ----
const isEnumType = computed(() => isEnumFieldType(editForm.value.type))
const isCascaderType = computed(() => editForm.value.type === FIELD_TYPE.CASCADER_SINGLE)
/** 支持为枚举值配置颜色的类型（单选/多选下拉，级联不配置） */
const isColorableType = computed(
  () => editForm.value.type === FIELD_TYPE.SELECT_LIST_SINGLE || editForm.value.type === FIELD_TYPE.SELECT_LIST_MULTI,
)

function isType(...vals: string[]) {
  return vals.includes(editForm.value.type as string)
}

// ---- 选项配置（单选/多选/级联） ----
const enumOptions = ref<EnumOptionItem[]>([])

let optionValueSeq = 0
/**
 * 生成选项值：用户只填选项名称，值由系统生成。
 * 带时间戳而不是简单递增，避免删除选项后新选项复用旧值，导致历史事项的字段值串到新选项上。
 */
function genOptionValue(): string {
  optionValueSeq = (optionValueSeq + 1) % 1296
  return `opt_${Date.now().toString(36)}${optionValueSeq.toString(36).padStart(2, '0')}`
}

/** 历史数据里选项值可能为空：保存前补全，避免筛选项因空值无法命中 */
function ensureOptionValues() {
  const used = new Set<string>()
  const collect = (opts: EnumOptionItem[]) => {
    for (const o of opts) {
      if (o.value?.trim()) used.add(o.value.trim())
      if (o.children?.length) collect(o.children)
    }
  }
  collect(enumOptions.value)
  const fill = (opts: EnumOptionItem[]) => {
    for (const o of opts) {
      if (!o.value?.trim()) {
        let v = genOptionValue()
        while (used.has(v)) v = genOptionValue()
        o.value = v
        used.add(v)
      }
      if (o.children?.length) fill(o.children)
    }
  }
  fill(enumOptions.value)
}

/** 同级选项名称重复（级联的父子层级分别判断） */
function duplicateNamesInLevel(opts: EnumOptionItem[]): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const o of opts) {
    const name = o.label?.trim()
    if (!name) continue
    if (seen.has(name)) dup.add(name)
    else seen.add(name)
  }
  return [...dup]
}

function findDuplicateOptionNames(opts: EnumOptionItem[]): string[] {
  const dup = new Set(duplicateNamesInLevel(opts))
  for (const o of opts) {
    if (o.children?.length) duplicateNamesInLevel(o.children).forEach(n => dup.add(n))
  }
  return [...dup]
}

function parseFieldValue(schema: string | null | undefined): EnumOptionItem[] {
  if (!schema) return []
  try {
    const parsed = JSON.parse(schema)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch { return [] }
}

function syncFieldValue() {
  if (isEnumType.value) {
    const cleaned = enumOptions.value.filter(o => o.label?.trim() || o.value?.trim())
    editForm.value.fieldValue = JSON.stringify(cleaned)
  } else {
    editForm.value.fieldValue = ''
  }
}

function addEnumOption() {
  // 选项值在保存时由系统生成，用户只填名称
  enumOptions.value.push({ label: '', value: '', color: DEFAULT_PRESET_COLOR })
  syncFieldValue()
}

/** 选择预设颜色：写入 hex 色值并同步到 fieldValue */
function onColorPick(opt: EnumOptionItem, color: string) {
  opt.color = color
  syncFieldValue()
}

/** 清除颜色：选项变为无颜色，展示端回落到默认文字色 */
function onColorClear(opt: EnumOptionItem) {
  opt.color = ''
  syncFieldValue()
}

function removeEnumOption(index: number) {
  enumOptions.value.splice(index, 1)
  syncFieldValue()
}

function addCascaderChild(parentIndex: number) {
  const parent = enumOptions.value[parentIndex]
  if (!parent.children) parent.children = []
  // 选项值在保存时由系统生成，用户只填名称
  parent.children.push({ label: '', value: '' })
  syncFieldValue()
}

function removeCascaderChild(parentIndex: number, childIndex: number) {
  const parent = enumOptions.value[parentIndex]
  parent.children?.splice(childIndex, 1)
  syncFieldValue()
}

function onEnumOptionChange() {
  syncFieldValue()
}

watch(isEnumType, (val) => {
  if (!val) {
    enumOptions.value = []
  }
  syncFieldValue()
})

// ---- 字段类型 → 默认分组映射（选择类型时自动带出分组） ----
watch(() => editForm.value.type, (val) => {
  const group = defaultFieldGroupByType(val)
  if (group) {
    editForm.value.fieldGroup = group
  }
})

// ---- 字段类型 → 默认支持的操作（与全局筛选按值类型的兜底一致） ----
/** 该字段类型默认支持的操作（名称），如 日期 → 等于 / 大于 / 小于 / 为空 / 不为空 */
function defaultOperatorNames(type?: string | null): string[] {
  if (!type) return []
  return OPERATORS_BY_KIND[valueKindOf('', type)]
    .map((code) => FIELD_OPERATORS.find((o) => o.code === code)?.name)
    .filter((n): n is string => !!n)
}
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * 用户在下拉里切换字段类型时自动填充「支持的操作」：
 * 仅当当前为空、或仍是上一个类型的默认值（没手动改过）时覆盖，手动调整过的保留。
 * 只挂在下拉 change 上，打开编辑回填时不会改动已保存的配置。
 */
/** 切换前的字段类型（v-model 在 change 前已更新，需单独记录；打开 / 回填表单时同步） */
let lastPickedType = ''
function onTypePicked(type: unknown) {
  const next = String(type ?? '')
  const current = editForm.value.supportOperator ?? []
  const untouched = !current.length || sameSet(current, defaultOperatorNames(lastPickedType))
  if (untouched) editForm.value.supportOperator = defaultOperatorNames(next)
  lastPickedType = next
}

// ---- 打开：新增重置表单；编辑拉详情回填（失败用列表行兜底） ----
watch(() => props.open, async (open) => {
  if (!open) return
  loadIssueTypes()
  sceneTab.value = 'CREATE'
  const record = props.record
  if (!record?.id) {
    editForm.value = emptyForm()
    lastPickedType = ''
    enumOptions.value = []
    return
  }
  editForm.value = formFromRow(record)
  lastPickedType = editForm.value.type || ''
  enumOptions.value = parseFieldValue(record.fieldValue)
  try {
    const res = await props.api.getDetail(record.id)
    if (res.success && res.data && props.record?.id === record.id) {
      const d = res.data as unknown as AvailableFieldItem
      editForm.value = formFromRow(d)
      lastPickedType = editForm.value.type || ''
      enumOptions.value = parseFieldValue(d.fieldValue)
    }
  } catch {
    // 失败则保留列表行数据
  }
}, { immediate: true })

async function handleSubmit() {
  if (!editForm.value.fieldName?.trim()) {
    return
  }
  if (isEnumType.value) {
    const dup = findDuplicateOptionNames(enumOptions.value)
    if (dup.length) {
      message.warning(`选项名称不能重复：${dup.join('、')}`)
      return
    }
    // 选项值由系统生成（用户只填名称）；历史数据里缺失的值在这里补全
    ensureOptionValues()
    syncFieldValue()
  }
  const isCustom = props.forceCustom || !editForm.value.isSystem
  if (isCustom && !(editForm.value.issueTypeCodes ?? []).length) {
    message.warning('自定义字段必须关联至少一个问题类型')
    return
  }
  submitting.value = true
  try {
    const editableScene = (editForm.value.editableScene ?? []).filter(s => isShownIn(s))
    const requiredScene = (editForm.value.requiredScene ?? []).filter(s => isShownIn(s) && editableScene.includes(s))
    const payload: AvailableFieldSavePayload = {
      ...editForm.value,
      editableScene,
      requiredScene,
      isRequired: requiredScene.length > 0,
      // 系统字段不关联问题类型
      issueTypeCodes: isCustom ? editForm.value.issueTypeCodes : [],
      ...(props.forceCustom ? { isSystem: false } : {}),
    }
    let field: FieldRow | null = null
    if (isEdit.value && props.record?.id) {
      const res = await props.api.update(props.record.id, payload)
      if (!res?.success) return
    } else {
      const res = await props.api.create(payload)
      if (!res?.success) return
      field = (res.data as FieldRow | null | undefined) ?? null
    }
    modalOpen.value = false
    emit('saved', { isEdit: isEdit.value, field })
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.custom-field-tip {
  margin-bottom: 16px; padding: 8px 12px; font-size: 13px; color: #3a3a3c;
  background: color-mix(in srgb, var(--c-primary) 6%, #fff); border-radius: 10px;
}
.custom-field-tip b { color: var(--c-primary); font-weight: 600; }
/* ---- 展示场景 tab ---- */
.scene-tabs :deep(.ant-tabs-nav) { margin-bottom: 0; }
.scene-tab { display: inline-flex; align-items: center; gap: 6px; }
.scene-tab-dot { width: 6px; height: 6px; border-radius: 50%; background: #d1d1d6; }
.scene-tab-dot.on { background: #34c759; }
.scene-tab-required { padding: 0 5px; font-size: 11px; line-height: 16px; color: #ff3b30; background: rgba(255, 59, 48, 0.08); border-radius: 4px; }
.scene-tab-readonly { padding: 0 5px; font-size: 11px; line-height: 16px; color: #8e8e93; background: #f2f2f7; border-radius: 4px; }
.scene-pane { display: flex; flex-direction: column; border: 1px solid #f0f0f0; border-top: none; border-radius: 0 0 10px 10px; }
.scene-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; }
.scene-row + .scene-row { border-top: 1px solid #f5f5f5; }
.scene-row-text { min-width: 0; }
.scene-row-title { font-size: 13px; font-weight: 500; color: #1d1d1f; }
.scene-row-desc { margin-top: 2px; font-size: 12px; color: #86868b; }

/* ---- edit modal ---- */
.edit-modal :deep(.ant-modal-content) { border-radius: 20px; }
.edit-modal :deep(.ant-modal-header) { padding: 24px 28px 0; border-bottom: none; }
.edit-modal :deep(.ant-modal-title) { font-size: 18px; font-weight: 700; color: #1d1d1f; }
.edit-modal :deep(.ant-modal-body) { padding: 20px 28px 28px; }
.edit-modal :deep(.ant-form-item) { margin-bottom: 16px; }
.edit-modal :deep(.ant-input),
.edit-modal :deep(.ant-select-selector),
.edit-modal :deep(.ant-input-number) { border-radius: 10px; }
.modal-footer { display: flex; justify-content: flex-end; padding-top: 24px; margin-top: 8px; border-top: 1px solid #f5f5f7; }
.preview-section { margin-top: 20px; padding: 16px; background: #f9f9fb; border: 1px dashed #d9d9d9; border-radius: 12px; }
.preview-title { font-size: 13px; font-weight: 600; color: #86868b; margin-bottom: 12px; letter-spacing: 0.5px; }
.preview-body { background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #f0f0f0; }
.preview-row { display: flex; align-items: flex-start; width: 100%; }
.preview-label { flex: 0 0 100px; width: 100px; padding-right: 12px; display: flex; align-items: center; height: 34px; font-size: 13px; color: #1d1d1f; font-weight: 500; }
.preview-label-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-label-placeholder { color: #bfbfbf; }
.preview-required-mark { color: #ff4d4f; font-weight: 600; margin-right: 2px; }
.preview-control { flex: 1 1 auto; min-width: 0; width: 100%; }
.preview-control :deep(.ant-input),
.preview-control :deep(.ant-select),
.preview-control :deep(.ant-select-selector),
.preview-control :deep(.ant-input-number),
.preview-control :deep(.ant-picker),
.preview-control :deep(.ant-cascader),
.preview-control :deep(.ant-input-affix-wrapper) { width: 100% !important; }
.preview-control :deep(.ant-input-number-input) { width: 100%; }
.preview-control :deep(textarea.ant-input) { width: 100%; height: auto; min-height: 80px; }
.preview-control :deep(.ant-switch) { margin-top: 4px; }
.display-text-preview { display: inline-block; padding: 4px 0; color: #262626; font-size: 14px; line-height: 1.5; }

/* 选项编辑器样式 */
.enum-options-editor { width: 100%; }
.enum-options-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.enum-options-header .opt-col { flex: 1; font-size: 12px; color: #86868b; font-weight: 600; }
.enum-options-header .opt-color-col { flex: 0 0 64px; }
.enum-options-header .opt-action-col { flex: 0 0 40px; }
.enum-option-color-wrap { flex: 0 0 64px; display: flex; align-items: center; gap: 4px; }
.enum-color-btn {
  width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center;
  padding: 0; background: #fff; border: 1px solid #d9d9d9; border-radius: 50%; cursor: pointer; flex: none;
  transition: border-color 0.15s;
}
.enum-color-btn:hover { border-color: #c7c7cc; }
.enum-color-dot {
  width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
/* 预设颜色面板：与问题状态色板一致，20 个色块，每行 5 个 */
.enum-color-grid { display: grid; grid-template-columns: repeat(5, 24px); gap: 8px; }
.enum-color-swatch {
  width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
  padding: 0; font-size: 11px; color: #fff; border: none; border-radius: 50%; cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06); transition: transform 0.15s, box-shadow 0.15s;
}
.enum-color-swatch:hover { transform: scale(1.1); }
.enum-color-swatch.active { box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(15, 23, 42, 0.18); }
.enum-option-color-clear {
  flex: none; width: 16px; height: 16px; line-height: 14px; text-align: center;
  border-radius: 50%; color: #86868b; cursor: pointer; font-size: 14px; user-select: none;
}
.enum-option-color-clear:hover { color: #ff4d4f; background: #fff1f0; }
.preview-option-item { display: inline-flex; align-items: center; gap: 6px; }
.preview-option-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex: none; }
.enum-option-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.enum-option-row.child { margin-bottom: 6px; padding-left: 24px; border-left: 2px solid #e8e8e8; }
.enum-option-inputs { display: flex; gap: 8px; align-items: center; }
.enum-option-inputs .ant-input { flex: 1; min-width: 0; }
.enum-option-inputs .ant-btn { flex: 0 0 auto; }
.enum-option-children { margin-top: 4px; }
</style>
