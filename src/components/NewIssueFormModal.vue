<template>
  <a-modal
    v-model:open="visible"
    width="60%"
    centered
    :mask-closable="false"
    :confirm-loading="newFormSubmitting"
    @ok="handleNewFormSubmit"
    @cancel="handleNewFormCancel"
    :ok-text="isEditMode ? '保存' : '提交'"
    cancel-text="取消"
    destroy-on-close
    class="new-form-modal"
  >
    <template #footer>
      <a-button @click="handleNewFormCancel">取消</a-button>
      <a-button v-if="!isEditMode" @click="openSaveTemplateModal">保存为模板</a-button>
      <a-button type="primary" :loading="newFormSubmitting" @click="handleNewFormSubmit">
        {{ isEditMode ? '保存' : '提交' }}
      </a-button>
    </template>
    <template #title>
      <div class="new-form-title-bar">
        <span class="new-form-title-side"></span>
        <span class="new-form-title-text">{{ isEditMode ? '编辑' : '新建' }}</span>
        <div class="new-form-title-side new-form-title-side-right">
          <div v-if="!isEditMode" class="new-form-template-selector">
            <span class="new-form-template-label">选择模板</span>
            <a-select
              v-model:value="selectedTemplate"
              class="new-form-template-select"
              :loading="templateLoading"
              :popup-match-select-width="false"
              placeholder="请选择模板"
              @change="handleTemplateChange"
            >
              <a-select-option
                v-for="tpl in filteredTemplateOptions"
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
        <!-- 上部固定区：空间 + 问题类型（垂直居中于分割线上方） -->
        <div class="new-form-header">
          <a-form layout="horizontal" :label-width="120">
            <a-form-item label="空间">
              <a-select
                v-model:value="newFormSpaceId"
                style="width: 100%"
                :disabled="isEditMode"
                :loading="spaceLoading"
                show-search
                :filter-option="filterSpaceOption"
                placeholder="请选择空间"
              >
                <a-select-option v-for="sp in spaceOptions" :key="sp.id" :value="sp.id" :label="sp.spaceName">
                  <span class="space-option">
                    <span class="space-option-icon" :style="{ background: sp.color || '#0A84FF' }">{{ spaceAvatarText(sp.spaceName) }}</span>
                    <span class="space-option-name">{{ sp.spaceName }}</span>
                  </span>
                </a-select-option>
                <template #notFoundContent>
                  <div class="issue-type-empty">暂无可用空间，请先在「空间」中创建</div>
                </template>
              </a-select>
            </a-form-item>
            <a-form-item label="问题类型">
              <a-select
                v-model:value="newFormIssueTypeId"
                style="width: 100%"
                :disabled="isEditMode"
                :loading="issueTypeLoading"
                placeholder="请选择问题类型"
                @change="onIssueTypeChanged"
              >
                <a-select-option v-for="opt in issueTypeOptions" :key="opt.value" :value="opt.value">
                  <span class="it-option">
                    <span class="it-option-icon" :style="{ background: opt.color || '#8c8c8c' }"><component :is="issueTypeIconOf(opt.iconUri)" /></span>
                    <span class="it-option-name">{{ opt.label }}</span>
                  </span>
                </a-select-option>
                <template #notFoundContent>
                  <div class="issue-type-empty">该空间所属组织暂无可用问题类型，请先在「问题类型」中添加</div>
                </template>
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
              :class="['new-form-tabs', { 'no-tab-bar': newFormTabs.length <= 1 }]"
              :tab-bar-style="{ marginBottom: '16px' }"
            >
              <a-tab-pane v-for="tab in newFormTabs" :key="tab.title" :tab="tab.title">
                <!-- 每个 tab 内部包一层独立滚动容器 -->
                <div class="tab-pane-scroll">
                  <a-form layout="horizontal" :label-width="120" :model="newFormData">
                    <a-form-item
                      v-for="(field, fi) in tab.issueFields"
                      :key="field.id"
                    >
                      <template #label>
                        <span class="field-label-text">{{ field.name }}</span>
                        <span v-if="field.required" class="form-item-required-mark">*</span>
                      </template>
                      <div
                        class="field-row"
                        :class="{
                          'is-dragging': dragFieldIndex === fi && dragTabTitle === tab.title,
                          'is-drop-before': dragOverIndex === fi && dragInsertBefore && dragTabTitle === tab.title,
                          'is-drop-after': dragOverIndex === fi && !dragInsertBefore && dragTabTitle === tab.title,
                        }"
                        @dragover="onFieldDragOver(tab, fi, $event)"
                        @drop="onFieldDrop(tab, fi, $event)"
                      >
                        <div class="form-field-content">
                        <a-input v-if="field.type === FIELD_TYPE.TEXT_BOX_SINGLE_LINE" v-model:value="newFormData[field.id]" :placeholder="field.description || '请输入'" :disabled="!field.editable" style="width: 100%" />
                        <a-textarea v-if="field.type === FIELD_TYPE.TEXT_BOX_MULTI_LINE" v-model:value="newFormData[field.id]" :placeholder="field.description || '请输入'" :disabled="!field.editable" :rows="4" style="width: 100%" />
                        <a-input-number v-if="field.type === FIELD_TYPE.TEXT_BOX_NUMBER" v-model:value="newFormData[field.id]" :placeholder="field.description || '请输入数字'" :disabled="!field.editable" style="width: 100%" />
                        <a-date-picker v-if="field.type === FIELD_TYPE.DATE_PICKER" v-model:value="newFormData[field.id]" :placeholder="field.description || '请选择日期'" :disabled="!field.editable" style="width: 100%" />
                        <a-date-picker v-if="field.type === FIELD_TYPE.TIME_PICKER" v-model:value="newFormData[field.id]" show-time :placeholder="field.description || '请选择日期时间'" :disabled="!field.editable" style="width: 100%" />
                        <a-select v-if="field.type === FIELD_TYPE.SELECT_LIST_SINGLE" v-model:value="newFormData[field.id]" :placeholder="field.description || '请选择'" :disabled="!field.editable" allow-clear style="width: 100%">
                          <a-select-option v-for="opt in getFieldOptions(field)" :key="opt.value" :value="opt.value" :disabled="opt.disabled" :title="opt.name">
                            <span class="enum-opt">
                              <i v-if="opt.color" class="enum-opt-dot" :style="{ background: opt.color }" />
                              <span :style="optionTextStyle(opt.color)">{{ opt.name }}</span>
                            </span>
                          </a-select-option>
                        </a-select>
                        <a-select v-if="field.type === FIELD_TYPE.SELECT_LIST_MULTI" v-model:value="newFormData[field.id]" mode="multiple" :placeholder="field.description || '请选择'" :disabled="!field.editable" allow-clear style="width: 100%">
                          <a-select-option v-for="opt in getFieldOptions(field)" :key="opt.value" :value="opt.value" :disabled="opt.disabled" :title="opt.name">
                            <span class="enum-opt">
                              <i v-if="opt.color" class="enum-opt-dot" :style="{ background: opt.color }" />
                              <span :style="optionTextStyle(opt.color)">{{ opt.name }}</span>
                            </span>
                          </a-select-option>
                          <!-- 多选标签也带枚举颜色 -->
                          <template #tagRender="{ value, closable, onClose }">
                            <span class="enum-tag" :style="enumTagStyle(field, String(value))">
                              <i v-if="enumOptionOf(field, String(value))?.color" class="enum-opt-dot" :style="{ background: enumOptionOf(field, String(value))!.color }" />
                              <span class="enum-tag-text">{{ enumOptionOf(field, String(value))?.name ?? String(value) }}</span>
                              <CloseOutlined v-if="closable" class="enum-tag-close" @click="onClose" />
                            </span>
                          </template>
                        </a-select>
                        <a-cascader v-if="field.type === FIELD_TYPE.CASCADER_SINGLE" v-model:value="newFormData[field.id]" :options="getFieldOptions(field)" :placeholder="field.description || '请选择'" :disabled="!field.editable" :field-names="{ label: 'name', value: 'value', children: 'children' }" allow-clear style="width: 100%" />
                        <a-select
                          v-if="field.type === FIELD_TYPE.SELECT_USER_SINGLE"
                          v-model:value="newFormData[field.id]"
                          show-search
                          :filter="false"
                          :placeholder="field.description || '搜索姓名/拼音/账号'"
                          :disabled="!field.editable"
                          allow-clear
                          style="width: 100%"
                          :loading="memberLoadingMap[field.id] || false"
                          :dropdown-match-select-width="false"
                          popup-class-name="person-select-popup"
                          @search="(kw: string) => handleMemberSearch(field.id, kw)"
                        >
                          <template #selection="{ value }">
                            <span class="user-selection-cell">
                              <a-avatar
                                :src="memberSelectionAvatar(field.id, String(value ?? ''))"
                                :size="18"
                                class="user-option-avatar"
                              >{{ memberSelectionInitial(field.id, String(value ?? '')) }}</a-avatar>
                              <span>{{ memberSelectionLabel(field.id, String(value ?? '')) }}</span>
                            </span>
                          </template>
                          <a-select-option
                            v-for="u in memberOptionsMap[field.id] || []"
                            :key="personKey(u)"
                            :value="personKey(u)"
                            :label="formatMemberLabel(u)"
                          >
                            <span class="user-option-cell">
                              <a-avatar :src="u.avatarUrl || u.userAvatar" :size="18" class="user-option-avatar">
                                {{ memberInitial(u) }}
                              </a-avatar>
                              <span>{{ formatMemberLabel(u) }}</span>
                            </span>
                          </a-select-option>
                        </a-select>
                        <a-select
                          v-if="field.type === FIELD_TYPE.SELECT_USER_MULTI"
                          v-model:value="newFormData[field.id]"
                          show-search
                          :filter="false"
                          mode="multiple"
                          :placeholder="field.description || '搜索姓名/拼音/账号'"
                          :disabled="!field.editable"
                          allow-clear
                          style="width: 100%"
                          :loading="memberLoadingMap[field.id] || false"
                          :dropdown-match-select-width="false"
                          popup-class-name="person-select-popup"
                          @search="(kw: string) => handleMemberSearch(field.id, kw)"
                        >
                          <template #selection="{ value }">
                            <span class="user-selection-cell">
                              <a-avatar
                                :src="memberSelectionAvatar(field.id, String(value ?? ''))"
                                :size="18"
                                class="user-option-avatar"
                              >{{ memberSelectionInitial(field.id, String(value ?? '')) }}</a-avatar>
                              <span>{{ memberSelectionLabel(field.id, String(value ?? '')) }}</span>
                            </span>
                          </template>
                          <a-select-option
                            v-for="u in memberOptionsMap[field.id] || []"
                            :key="personKey(u)"
                            :value="personKey(u)"
                            :label="formatMemberLabel(u)"
                          >
                            <span class="user-option-cell">
                              <a-avatar :src="u.avatarUrl || u.userAvatar" :size="18" class="user-option-avatar">
                                {{ memberInitial(u) }}
                              </a-avatar>
                              <span>{{ formatMemberLabel(u) }}</span>
                            </span>
                          </a-select-option>
                        </a-select>
                        <div v-if="field.type === 'RICH_TEXT'" style="border: 1px solid #d9d9d9; border-radius: 6px; width: 100%; position: relative; z-index: 0">
                          <Toolbar v-if="richEditorInstances[field.id]" :editor="richEditorInstances[field.id]" :default-config="{}" mode="default" />
                          <Editor
                            v-model="newFormData[field.id]"
                            :default-config="richEditorConfig"
                            mode="default"
                            class="new-form-rich-editor"
                            :style="{ height: `${richEditorHeights[field.id] ?? RICH_EDITOR_MIN_HEIGHT}px`, overflowY: 'auto' }"
                            @on-created="(editor: IDomEditor) => handleRichEditorCreated(field.id, editor)"
                          />
                          <!-- 底部拖拽条：上下拖动调整编辑区高度 -->
                          <div class="rich-editor-resize-handle" @pointerdown="startRichEditorResize($event, field.id)" />
                        </div>
                        <span v-if="field.type === FIELD_TYPE.LABEL" class="display-text-value">
                          {{ newFormData[field.id] != null ? String(newFormData[field.id]) : '' }}
                        </span>
                        <a-input v-if="!field.type" v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                        </div>
                        <!-- 「新建」追加的字段：删除图标 → 拖拽手柄（上下拖动排序） -->
                        <DeleteOutlined
                          v-if="field.__added"
                          class="field-act field-act-danger field-delete"
                          title="删除"
                          @click="removeField(tab, fi)"
                        />
                        <span
                          v-if="field.__added"
                          class="field-drag"
                          draggable="true"
                          title="拖动排序"
                          @dragstart="onFieldDragStart(tab, fi, $event)"
                          @dragend="onFieldDragEnd"
                        >
                          <i v-for="n in 6" :key="n" class="field-drag-dot" />
                        </span>
                      </div>
                    </a-form-item>
                  </a-form>
                  <!-- 最后一个字段下方：新建入口 -->
                  <div class="new-form-add-row">
                    <a-dropdown
                      v-model:open="addFieldDropdownOpen"
                      :trigger="['click']"
                      placement="topLeft"
                      overlay-class-name="new-form-add-dropdown"
                      @open-change="handleAddDropdownOpenChange"
                    >
                      <span class="new-form-add-trigger">
                        <PlusOutlined />
                        <span>新建</span>
                      </span>
                      <template #overlay>
                        <div class="add-field-panel" @click.stop>
                          <a-input
                            v-model:value="addFieldKeyword"
                            placeholder="搜索字段"
                            allow-clear
                            size="small"
                            class="add-field-search"
                          />
                          <a-spin :spinning="availableFieldsLoading" size="small">
                            <div class="add-field-list">
                              <div
                                v-for="f in addableFields"
                                :key="f.fieldId"
                                class="add-field-item"
                                @click="handleAddField(f)"
                              >
                                <span class="add-field-name">{{ f.fieldName || f.fieldId }}</span>
                                <span class="add-field-type">{{ formatTypeLabel(f.type) }}</span>
                              </div>
                              <a-empty
                                v-if="!availableFieldsLoading && addableFields.length === 0"
                                :image="Empty.PRESENTED_IMAGE_SIMPLE"
                                description="暂无可添加字段"
                              />
                            </div>
                          </a-spin>
                        </div>
                      </template>
                    </a-dropdown>
                  </div>
                </div>
              </a-tab-pane>
            </a-tabs>
          </template>
          <a-empty v-else description="暂无表单字段" />
        </div>
      </div>
    </a-spin>

    <!-- 保存为模板：把当前表单字段与已填内容保存为新模板 -->
    <a-modal
      v-model:open="saveTplOpen"
      title="保存为模板"
      width="420px"
      :confirm-loading="saveTplSaving"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleSaveTemplate"
      @cancel="saveTplOpen = false"
    >
      <div class="save-tpl-tip">将当前表单的字段与已填内容保存为模板，下次新建时可直接选用。</div>
      <a-input v-model:value="saveTplName" placeholder="请输入模板名称" :maxlength="50" @press-enter="handleSaveTemplate" />
    </a-modal>
  </a-modal>
</template>

<script setup lang="ts">
import { watch } from 'vue'

import { ref, reactive, computed } from 'vue'
import dayjs from 'dayjs'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import type { IDomEditor, IEditorConfig } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import { PlusOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { Empty, message } from 'ant-design-vue'
import { createIssue, getAvailableFieldOptions, queryUsers, queryTemplates, getTemplate, getIssueCreateMeta, queryEditMeta, patchIssue, queryAvailableFieldList, querySpaceOptions, queryIssueTypes, createTemplate, type SpaceItem } from '@/api/faiz'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'
import { personLabel, personAvatar, personInitial, personKey } from '@/utils/person'
import { FIELD_TYPE, normalizeFieldType, formatTypeLabel } from '@/types/fieldType'
import type {
  CustomFieldOptionReq,
  CustomFieldOptionItem,
  CustomFieldJOption,
  CreateMetaField,
  CreateIssueInputField,
  CreateIssueCascadingValue,
  CreateIssuePayload,
  UserItem,
  IssuePatchField,
  DetailLayoutGroup,
  DetailFieldGroupStructure,
  IssueEditMetaVO,
  AvailableFieldItem,
} from '@/types/faiz'

interface Props {
  open: boolean
  /** 传入 issueKey 时进入编辑模式：调 POST /issue/queryEditMeta 获取表单结构与当前值回填 */
  issueKey?: string
}

const props = defineProps<Props>()

/** 是否为编辑模式（顶部标题「编辑」，保存走 PATCH /issue/{key}） */
const isEditMode = computed(() => !!props.issueKey)

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submitted': []
}>()

const visible = ref(props.open)

// 新建表单弹窗内部状态（需在 watch 之前声明，因 watch immediate 会立即访问）
// 未选择模板用空串表示（下拉不再提供「请选择模板」占位项，仅以 placeholder 提示）
const selectedTemplate = ref<string>('')
const templateOptions = ref<{ value: string; label: string; issueTypeId?: number; issueTypeCode?: string; isDefault?: boolean }[]>([])
const customFieldOptionsMap = ref<Record<string, CustomFieldOptionItem[]>>({})

watch(
  () => props.open,
  async (val) => {
    visible.value = val
    if (val) {
      // 每次打开：清空残留 + 拉取最新启用模板列表
      selectedTemplate.value = ''
      customFieldOptionsMap.value = {}
      if (props.issueKey) {
        // 编辑模式：/issue/queryEditMeta 获取表单结构与字段当前值回填
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        loadEditDetail(props.issueKey)
      } else {
        // 默认表单（queryCreateMeta）和模板列表都需要问题类型编码，
        // 等组织的问题类型加载完成后再查（见 loadIssueTypesByOrg）
      }
    }
  },
  { immediate: true },
)

watch(visible, (val) => {
  emit('update:open', val)
  if (!val) {
    destroyRichEditors()
  } else {
    loadSpaceOptions()
    loadIssueTypesByOrg()
  }
})

// 空间：新建事项时选择所属空间（每次打开刷新，保证与空间管理同步）；
// 问题类型 / 表单元数据 / 提交的组织均取所选空间的所属组织
const LAST_SPACE_KEY = 'cooperise:newIssue:lastSpaceId'
const newFormSpaceId = ref<number | undefined>()
const spaceOptions = ref<SpaceItem[]>([])
const spaceLoading = ref(false)
/** 空间列表加载中的请求：查询表单元数据前需等待，以便取到空间的组织编码 */
let spaceLoadingReq: Promise<void> | null = null
function loadSpaceOptions() {
  spaceLoadingReq = (async () => {
    spaceLoading.value = true
    try {
      const res = await querySpaceOptions()
      if (!res?.success) return
      spaceOptions.value = res.data || []
      // 新建：默认带出上次使用的空间，失效时取第一个
      if (!isEditMode.value && !spaceOptions.value.some(sp => sp.id === newFormSpaceId.value)) {
        let last: number | undefined
        try { last = Number(localStorage.getItem(LAST_SPACE_KEY)) || undefined } catch { /* 存储不可用 */ }
        newFormSpaceId.value = spaceOptions.value.find(sp => sp.id === last)?.id ?? spaceOptions.value[0]?.id
      }
    } catch {
      // 请求层已统一提示
    } finally {
      spaceLoading.value = false
    }
  })()
  return spaceLoadingReq
}
const currentSpace = computed(() => spaceOptions.value.find(sp => sp.id === newFormSpaceId.value))
function spaceAvatarText(name?: string) {
  const t = (name || '').trim()
  return /^[a-zA-Z]/.test(t) ? t.slice(0, 2).toUpperCase() : t.slice(0, 1)
}
/** 按空间名称或编码搜索（label 只放名称，避免选中后回显编码） */
function filterSpaceOption(input: string, option: any) {
  const kw = input.trim().toLowerCase()
  const code = spaceOptions.value.find(sp => sp.id === option?.value)?.spaceCode
  return String(option?.label ?? '').toLowerCase().includes(kw)
    || String(code ?? '').toLowerCase().includes(kw)
}

/** 当前所选空间的所属组织编码（未选择或空间未关联组织时为 undefined） */
async function currentOrgCode(): Promise<string | undefined> {
  if (spaceLoadingReq) await spaceLoadingReq
  return currentSpace.value?.organizationCode || undefined
}

// 新建表单弹窗内部状态
const newFormLoading = ref(false)
const newFormSubmitting = ref(false)
const newFormData = ref<Record<string, any>>({})
const newFormTabs = ref<{ title: string; sequence: number; issueFields: any[] }[]>([])
const newFormActiveTab = ref('')
const newFormIssueTypeId = ref('10002')
const NEW_FORM_DEFAULT_PROJECT_ID = '18701'
/** 接口不可用时的兜底问题类型 */
const DEFAULT_ISSUE_TYPE_OPTIONS = [
  { value: '10001', label: '需求' },
  { value: '10002', label: '任务' },
  { value: '10003', label: '缺陷' },
  { value: '10004', label: '其他' },
]
const issueTypeOptions = ref<{ value: string; label: string; code?: string; color?: string; iconUri?: string | null }[]>([...DEFAULT_ISSUE_TYPE_OPTIONS])
const issueTypeLoading = ref(false)
let issueTypeReqSeq = 0

/** 按所选空间拉取启用的问题类型（按 spaceCode 查询）；未选空间时拉取全部 */
async function loadIssueTypesByOrg() {
  if (isEditMode.value) return
  const seq = ++issueTypeReqSeq
  issueTypeLoading.value = true
  try {
    if (spaceLoadingReq) await spaceLoadingReq
    if (seq !== issueTypeReqSeq) return
    const res = await queryIssueTypes({
      page: 1,
      pageSize: 999,
      status: 1,
      spaceCode: currentSpace.value?.spaceCode,
    })
    if (seq !== issueTypeReqSeq || !res?.success) return
    issueTypeOptions.value = (res.data?.list || []).map(t => ({ value: String(t.id), label: t.issueTypeName, code: t.issueTypeCode, color: t.color, iconUri: t.iconUri }))
  } catch {
    if (seq !== issueTypeReqSeq) return
    issueTypeOptions.value = [...DEFAULT_ISSUE_TYPE_OPTIONS]
  } finally {
    if (seq === issueTypeReqSeq) issueTypeLoading.value = false
  }
  // 当前问题类型不属于该组织：切到第一个可选类型并重新渲染表单；无可选类型则清空
  if (seq !== issueTypeReqSeq) return
  const cur = newFormIssueTypeId.value
  if (cur && issueTypeOptions.value.some(o => o.value === cur)) {
    // 问题类型未变（不会触发切换监听）：按当前组织 + 类型编码查询模板；有默认模板则用模板内容，否则渲染默认表单
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadTemplatesAndApply()
    return
  }
  const first = issueTypeOptions.value[0]?.value
  newFormIssueTypeId.value = first ?? ''
  if (first) onIssueTypeChanged(first)
}

/**
 * 模板下拉按「组织 + 问题类型」筛选：
 * 模板只关联问题类型，问题类型下拉已按组织过滤，因此只展示属于当前问题类型的模板；
 * 未关联问题类型的模板视为通用模板，始终展示
 */
const filteredTemplateOptions = computed(() => {
  const cur = issueTypeOptions.value.find(o => o.value === newFormIssueTypeId.value)
  return templateOptions.value.filter(t => {
    if (t.issueTypeId == null && !t.issueTypeCode) return true
    if (!cur) return false
    if (t.issueTypeCode) return t.issueTypeCode === cur.code
    // 模板里存的是问题类型 ID（如 10001），兼容按编码（TYPE10001）匹配
    return String(t.issueTypeId) === cur.value || (!!cur.code && cur.code === `TYPE${t.issueTypeId}`)
  })
})

// 已选模板不在筛选结果中（切换了组织 / 问题类型）：重置为未选择
watch(filteredTemplateOptions, (opts) => {
  // 已选模板不在筛选结果中（切换了组织 / 问题类型）：重新按当前类型选默认模板（无默认则选第一个），保证选中项不为空
  if (selectedTemplate.value && !opts.some(o => o.value === selectedTemplate.value)) {
    selectedTemplate.value = ''
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadTemplatesAndApply()
  }
})

// 切换问题类型：重新查询该类型下的模板列表，并应用该类型的默认模板（无则渲染默认表单）
watch(newFormIssueTypeId, (val, old) => {
  if (visible.value && !isEditMode.value && val && val !== old) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadTemplatesAndApply()
  }
})

/** 当前问题类型编码（如 TYPE10002）；兜底选项无编码时退回 ID */
function currentIssueTypeCode(): string {
  return issueTypeOptions.value.find(o => o.value === newFormIssueTypeId.value)?.code || newFormIssueTypeId.value
}

watch(newFormSpaceId, (val) => {
  if (val != null && !isEditMode.value) {
    try { localStorage.setItem(LAST_SPACE_KEY, String(val)) } catch { /* 存储不可用 */ }
  }
  if (visible.value) loadIssueTypesByOrg()
})

/** 模板下拉：本地缓存已启用模板详情（含解析后的 widgetData），供选中后直接使用 */
const templateCache = reactive<Record<string, { issue_type_id?: number; issue_type_code?: string; tabs: { name: string; sequence: number; widgetData: any[] }[] }>>({})

/** 将后端 Tab.widgetData 的每个 widget 映射为 NewIssueFormModal 需要的 issueField（CreateMetaField 风格）
 * value 取模板里保存的默认值（defaultValue）：用「保存为模板」保存的已填内容会在下次选用该模板时回填 */
function widgetToIssueField(w: any, sequence: number): CreateMetaField & { configSchema?: unknown } {
  const fieldId = String(w.field ?? w.fieldId ?? w.id)
  const title = String(w.title ?? fieldId)
  const required = !!w.required
  const rawOpts = Array.isArray(w.options?.options) ? w.options.options : []
  const configSchema = rawOpts
  return {
    id: fieldId,
    name: title,
    type: String(w.type ?? FIELD_TYPE.TEXT_BOX_SINGLE_LINE),
    jiraType: null,
    value: w.defaultValue ?? w.value ?? null,
    editable: true,
    required,
    standard: false,
    sequence,
    frontPage: true,
    description: w.options?.placeholder ?? '',
    defaultvalue: null,
    exportValue: rawOpts,
    issueTemplateValue: null,
    configSchema,
  }
}

/** 把单个 Tab 的 widgetData 扁平展开为 issueFields（递归容器 children） */
function flattenWidgets(widgets: any[]): any[] {
  const out: any[] = []
  const walk = (arr: any[]) => {
    arr.forEach(w => {
      if (!w) return
      if (Array.isArray(w.children) && w.children.length) walk(w.children)
      else if (w.field || w.fieldId) out.push(w)
    })
  }
  walk(widgets)
  return out
}

/** 根据模板详情构建 newFormTabs + newFormData */
function applyTemplateToForm(tplId: string | number) {
  const tpl = templateCache[String(tplId)]
  if (!tpl) return
  if (tpl.issue_type_code || tpl.issue_type_id) {
    // 模板问题类型对应到当前下拉中的选项：优先按编码匹配，兼容历史 ID（TYPE{id}）
    const id = tpl.issue_type_id != null ? String(tpl.issue_type_id) : ''
    const opt = issueTypeOptions.value.find(o =>
      (tpl.issue_type_code && o.code === tpl.issue_type_code) || (id && (o.value === id || o.code === `TYPE${id}`)))
    if (opt) newFormIssueTypeId.value = opt.value
    else if (id) newFormIssueTypeId.value = id
  }
  const tabs: { title: string; sequence: number; issueFields: any[] }[] = []
  const form: Record<string, unknown> = {}
  tpl.tabs.forEach((t, idx) => {
    const flat = flattenWidgets(t.widgetData)
    const issueFields = flat.map((w, i) => widgetToIssueField(w, i))
    tabs.push({ title: t.name || `表单${idx + 1}`, sequence: t.sequence ?? idx, issueFields })
    issueFields.forEach(f => {
      if (f.type === 'RICH_TEXT') {
        form[f.id] = ''
      } else if ((f.type === FIELD_TYPE.DATE_PICKER || f.type === FIELD_TYPE.TIME_PICKER) && f.value && typeof f.value === 'string') {
        form[f.id] = dayjs(f.value)
      } else if (f.type === FIELD_TYPE.SELECT_LIST_SINGLE) {
        // 与编辑回填一致：默认值可能是 { optionId, optionName } 对象，统一取 optionId，
        // 提交时才能匹配到枚举项并带上 color
        form[f.id] = f.value == null ? null : enumValueOf(f.value) || null
      } else if (f.type === FIELD_TYPE.SELECT_LIST_MULTI) {
        const arr = Array.isArray(f.value) ? f.value : f.value == null ? [] : [f.value]
        form[f.id] = arr.map((v: unknown) => enumValueOf(v)).filter(Boolean)
      } else {
        form[f.id] = f.value ?? null
      }
    })
  })
  newFormTabs.value = tabs
  newFormActiveTab.value = tabs[0]?.title ?? ''
  newFormData.value = form
}

/**
 * customId -> options（下拉/单选/多选/复选框/级联）
 * 批量接口返回后写入此处，渲染时按 customId 查找
 */

/** 根据表单元数据里的字段 type 判断是否需要走自定义字段选项接口 */
/** 需要拉取枚举选项的组件 key（小写，与 queryCreateMeta 返回的 type 对应） */
const OPTION_WIDGET_TYPE_SET = new Set<string>([
  FIELD_TYPE.CASCADER_SINGLE,
  FIELD_TYPE.SELECT_LIST_SINGLE,
  FIELD_TYPE.SELECT_LIST_MULTI,
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
  const raw = jopt as CustomFieldJOption & { color?: string; ext?: { color?: string } | null }
  const color = String(raw.color ?? raw.ext?.color ?? '').trim()
  return {
    id: String(jopt.optionId),
    name: String(jopt.optionName ?? ''),
    value: String(jopt.optionId),
    disabled: !!jopt.obsolete,
    children,
    ...(color ? { color } : {}),
  }
}

/**
 * 将 label/value/children 结构（如 options.options 中的项）递归转为 CustomFieldOptionItem
 * 兼容子级字段名为 children 或 childJOptions（后端旧 joptions 风格）
 */
function mapLabelValueToOption(
  raw: any,
  idx: number,
): CustomFieldOptionItem {
  const base = raw ?? {}
  const label = String(base.label ?? base.name ?? base.optionName ?? base.text ?? base.title ?? `选项${idx + 1}`)
  const value = String(base.value ?? base.id ?? base.optionId ?? base.key ?? '')
  const childArr = Array.isArray(base.children)
    ? base.children
    : Array.isArray(base.childJOptions)
      ? base.childJOptions
      : null
  const children = childArr
    ? childArr.map((c: any, i: number) => mapLabelValueToOption(c, i))
    : undefined
  const color = String(base.color ?? base.colour ?? base.ext?.color ?? '').trim()
  return {
    id: value,
    name: label,
    value,
    disabled: !!base.disabled || !!base.obsolete,
    children,
    ...(color ? { color } : {}),
  }
}

/**
 * 将响应 data 转为 { fieldId: CustomFieldOptionItem[] } map
 * 兼容两种格式：
 *   1) 新格式：{ fieldId, options: { options: [{label,value,children?}], ... } }
 *   2) 旧格式：{ customFieldId, joptions: { list: CustomFieldJOption[] } }
 */
function buildOptionMapFromResponse(
  list: any[],
): Record<string, CustomFieldOptionItem[]> {
  const result: Record<string, CustomFieldOptionItem[]> = {}
  if (!Array.isArray(list)) return result
  for (const bucket of list) {
    const fieldId = String(bucket.fieldId ?? bucket.customFieldId ?? bucket.customId ?? '')
    if (!fieldId) continue
    // 新格式：fieldId + options 直接为选项数组（label/value/children）
    if (Array.isArray(bucket?.options) && bucket.options.length) {
      result[fieldId] = bucket.options
        .filter((x: any) => x != null)
        .map((x: any, i: number) => mapLabelValueToOption(x, i))
      continue
    }
    // 新格式：fieldId + options.options（options 为 { options: [...] } 包裹）
    const innerOpts = bucket?.options?.options
    if (Array.isArray(innerOpts) && innerOpts.length) {
      result[fieldId] = innerOpts
        .filter((x: any) => x != null)
        .map((x: any, i: number) => mapLabelValueToOption(x, i))
      continue
    }
    // 旧格式：joptions.list
    const jList = bucket?.joptions?.list
    if (Array.isArray(jList) && jList.length) {
      result[fieldId] = jList
        .filter((x: CustomFieldJOption) => x != null)
        .map(mapJOptionToItem)
    }
  }
  return result
}

/**
 * 批量拉取自定义字段选项，并写入 customFieldOptionsMap
 */
async function loadCustomFieldOptions(
  projectId: string,
  issueTypeCode: string,
  tabs: { issueFields: any[] }[],
) {
  const reqs: CustomFieldOptionReq[] = []
  for (const tab of tabs) {
    for (const f of tab.issueFields) {
      const widgetType = String(f.type ?? '').toUpperCase()
      if (!OPTION_WIDGET_TYPE_SET.has(widgetType)) continue
      const customId = String(f.id ?? f.fieldId ?? '')
      if (!customId) continue
      reqs.push({
        fieldId: customId,
        type: widgetType,
        projectId,
        issueTypeCode,
        // 参数传全：编辑场景带上事项 key（服务端按事项上下文返回）；
        // pageSize 取大值，避免枚举较多时只回一页导致下拉缺项
        ...(isEditMode.value && props.issueKey ? { issueKey: props.issueKey } : {}),
        pageSize: 999,
      })
    }
  }
  if (!reqs.length) return
  try {
    const res = await getAvailableFieldOptions(reqs)
    if (res && res.success && res.data) {
      const nextMap = buildOptionMapFromResponse(res.data)
      customFieldOptionsMap.value = { ...customFieldOptionsMap.value, ...nextMap }
    }
  } catch {
    // 拉取失败不阻塞页面，仍可使用 queryCreateMeta 返回的 options 兜底
  }
}

// 选择模板（标题栏右侧下拉）

const templateLoading = ref(false)
let templateReqSeq = 0

let templateApplySeq = 0

/**
 * 拉取模板列表 + 选中模板：
 * 优先选中默认模板（isDefault=1），没有默认模板则选中第一个，保证下拉选中项不为空；
 * 该问题类型无任何模板时才走 queryCreateMeta 默认表单。
 * seq 保证并发（打开弹窗 / 切换问题类型）时只有最后一次生效。
 */
async function loadTemplatesAndApply() {
  const seq = ++templateApplySeq
  const { defaultId, firstId } = await loadTemplateOptions()
  if (seq !== templateApplySeq) return
  // 用户已手动选过模板时不覆盖其选择
  if (selectedTemplate.value) return
  const target = defaultId || firstId
  if (target) {
    selectedTemplate.value = target
    await handleTemplateChange(target)
    return
  }
  await loadCreateMeta()
}

/** 按当前问题类型拉取「已启用」模板填充下拉（打开弹窗、切换问题类型时触发；大 pageSize 尽量取全）
 * 返回默认模板 id（isDefault=1）与首个模板 id，均没有则返回空串 */
async function loadTemplateOptions(): Promise<{ defaultId: string; firstId: string }> {
  const seq = ++templateReqSeq
  const cur = issueTypeOptions.value.find(o => o.value === newFormIssueTypeId.value)
  templateLoading.value = true
  try {
    const res = await queryTemplates({
      page: 1,
      pageSize: 200,
      status: 1,
      // 按问题类型编码（如 TYPE10002）查询
      issueTypeCode: cur?.code,
    })
    if (seq !== templateReqSeq) return { defaultId: '', firstId: '' }
    if (res?.success && res.data) {
      const list: any[] = res.data.list || []
      const opts: { value: string; label: string; issueTypeId?: number; issueTypeCode?: string; isDefault?: boolean }[] = []
      let defaultId = ''
      let firstId = ''
      for (const t of list) {
        const id = String(t.id)
        const issueTypeId: number | undefined = t.issueTypeId ?? t.issue_type?.issue_type_id
        const tabs: any[] = Array.isArray(t.tabs) ? t.tabs : []
        // 默认模板标记：后端返回数字 1 / 字符串 '1' / 布尔
        const isDefault = t.isDefault === 1 || t.isDefault === '1' || t.isDefault === true
        if (isDefault && !defaultId) defaultId = id
        if (!firstId) firstId = id
        templateCache[id] = {
          issue_type_id: issueTypeId,
          issue_type_code: t.issueTypeCode,
          tabs: tabs.map((tab: any, idx: number) => ({
            name: tab.name ?? tab.tabName ?? `表单${idx + 1}`,
            sequence: tab.tabOrder ?? tab.sequence ?? idx,
            widgetData: normalizeWidgets(
              typeof tab.widgetData === 'string'
                ? parseWidgetDataSafe(tab.widgetData)
                : Array.isArray(tab.widgetData) ? tab.widgetData : [],
            ),
          })),
        }
        // 选项文案只展示模板名：带「（默认）」后缀会一并显示在下拉选中框里
        opts.push({
          value: id,
          label: t.templateName ?? `模板 ${id}`,
          issueTypeId,
          issueTypeCode: t.issueTypeCode,
          isDefault,
        })
      }
      templateOptions.value = opts
      return { defaultId, firstId }
    }
  } catch {
  } finally {
    if (seq === templateReqSeq) templateLoading.value = false
  }
  return { defaultId: '', firstId: '' }
}

function parseWidgetDataSafe(s: string): any[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}

/** 规范化 widget：确保 field/title 存在（兼容新格式 fieldId/name 与旧格式 field/title） */
function normalizeWidgets(ws: any[]): any[] {
  if (!Array.isArray(ws)) return []
  return ws.map((w: any) => {
    if (!w || typeof w !== 'object') return w
    const isCompName = typeof w.name === 'string' && w.name.startsWith('Comp_')
    return {
      ...w,
      field: w.fieldId ?? w.field,
      title: isCompName ? (w.title ?? w.name) : (w.name ?? w.title),
      // 兼容历史数据中的旧版类型值（INPUT_TEXT / CASCADER / USER_SINGLE_SELECT 等）
      type: normalizeFieldType(w.type ?? w.filedType ?? w.fieldType),
    }
  })
}

const handleTemplateChange = async (val: string) => {
  // 1) 未选择模板（清空选择）：重新拉取 queryCreateMeta 渲染默认表单
  if (!val) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    await loadCreateMeta()
    return
  }
  // 2) 缓存命中：直接按 widgetData 渲染
  if (templateCache[val]) {
    newFormLoading.value = true
    applyTemplateToForm(val)
    postLoadAfterBuildTabs()
    newFormLoading.value = false
    return
  }
  // 3) 缓存未命中（理论上不会，loadTemplateOptions 已做了全量预取）：兜底拉详情
  newFormLoading.value = true
  try {
    const res = await getTemplate(Number(val))
    if (res?.success && res.data) {
      const t: any = res.data
      const issueTypeId: number | undefined = t.issueTypeId ?? t.issue_type?.issue_type_id
      const tabs: any[] = Array.isArray(t.tabs) ? t.tabs : []
      templateCache[val] = {
        issue_type_id: issueTypeId,
        issue_type_code: t.issueTypeCode,
        tabs: tabs.map((tab: any, idx: number) => ({
          name: tab.name ?? tab.tabName ?? `表单${idx + 1}`,
          sequence: tab.tabOrder ?? tab.sequence ?? idx,
          widgetData: normalizeWidgets(
            typeof tab.widgetData === 'string'
              ? parseWidgetDataSafe(tab.widgetData)
              : Array.isArray(tab.widgetData) ? tab.widgetData : [],
          ),
        })),
      }
      applyTemplateToForm(val)
      postLoadAfterBuildTabs()
    } else {
      newFormTabs.value = []
    }
  } catch {
    newFormTabs.value = []
  } finally {
    newFormLoading.value = false
  }
}

/** 模板字段构建完 Tabs + newFormData 后，补做成员选项预取和自定义字段接口拉取 */
function postLoadAfterBuildTabs() {
  // projectId 用当前空间的编码（服务端枚举按空间取），没有空间时才退回默认值
  const projectId = currentSpace.value?.spaceCode || NEW_FORM_DEFAULT_PROJECT_ID
  const issueTypeCode = currentIssueTypeCode()
  // member 字段：SELECT_USER_SINGLE / SELECT_USER_MULTI 一律预取用户数据（/user/query），
  // 保证新建弹窗打开时人员下拉即有可选数据（无需输入关键词搜索）
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    const needPrefetch: string[] = []
    for (const tab of newFormTabs.value) {
      for (const f of tab.issueFields) {
        if (f.type === FIELD_TYPE.SELECT_USER_SINGLE || f.type === FIELD_TYPE.SELECT_USER_MULTI) {
          if (!needPrefetch.includes(f.id)) needPrefetch.push(f.id)
        }
      }
    }
    if (!needPrefetch.length) return
    try {
      const res = await queryUsers({ keyword: '', isActive: 1, page: 1, pageSize: 50 })
      if (res.success && res.data) {
        const list = res.data.list || []
        for (const fid of needPrefetch) {
          if (!(fid in memberOptionsMap)) memberOptionsMap[fid] = []
          // 与编辑回填预置的用户合并去重，避免重复选项/丢失当前选中
          const merged = [...(memberOptionsMap[fid] || [])]
          for (const u of list) {
            if (!merged.some(m => personKey(m) === personKey(u))) merged.push(u)
          }
          memberOptionsMap[fid] = merged
        }
      }
    } catch { /* ignore */ }
  })()
  // 自定义字段选项（服务端枚举/级联，widget.options.options 若已填会先被用作兜底）
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  loadCustomFieldOptions(projectId, issueTypeCode, newFormTabs.value)
}

// 手动切问题类型：解除模板关联，避免不一致（除非对应模板下已就该 issue_type）
function onIssueTypeChanged(_v: string) {
  // 切换问题类型：重置模板选择，重新拉取 queryCreateMeta 渲染默认表单
  if (selectedTemplate.value) {
    const tpl = templateCache[selectedTemplate.value]
    const code = issueTypeOptions.value.find(o => o.value === _v)?.code
    const mismatch = tpl?.issue_type_code
      ? tpl.issue_type_code !== code
      : !!tpl?.issue_type_id && String(tpl.issue_type_id) !== String(_v) && `TYPE${tpl.issue_type_id}` !== code
    if (mismatch) {
      selectedTemplate.value = ''
    }
  }
  // 有默认模板则应用模板内容，否则渲染默认表单（queryCreateMeta）
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  loadTemplatesAndApply()
}

/**
 * 调用 /issue/queryCreateMeta 获取默认表单元数据并渲染
 * 入参：organizationCode（所选组织编码）+ issueTypeCode
 */
async function loadCreateMeta() {
  newFormLoading.value = true
  try {
    const res = await getIssueCreateMeta({
      organizationCode: await currentOrgCode(),
      issueTypeCode: currentIssueTypeCode(),
    })
    const meta = res?.success ? res.data : null
    const metaData = meta?.data
    let tabs: any[] = []
    if (meta?.type === 'FORM') {
      // type=FORM 时无 tab 分组，fromItems 直接包装为单 tab
      const items = metaData?.fromItems || []
      if (items.length) tabs = [{ title: '', sequence: 0, issueFields: items }]
    } else {
      tabs = metaData?.tabItems || []
    }
    if (tabs.length) {
      newFormTabs.value = tabs
      newFormActiveTab.value = tabs[0]?.title ?? ''
      // 初始化 newFormData（日期类转 dayjs，富文本初始化为空串）
      const form: Record<string, any> = {}
      for (const tab of tabs) {
        for (const f of tab.issueFields) {
          if (f.type === 'RICH_TEXT') {
            form[f.id] = ''
          } else if ((f.type === FIELD_TYPE.DATE_PICKER || f.type === FIELD_TYPE.TIME_PICKER) && f.value && typeof f.value === 'string') {
            form[f.id] = dayjs(f.value)
          } else {
            form[f.id] = f.value ?? null
          }
        }
      }
      newFormData.value = form
      // 复用模板流程的成员预取 + 自定义字段选项拉取
      postLoadAfterBuildTabs()
    } else {
      newFormTabs.value = []
      newFormData.value = {}
    }
  } catch {
    newFormTabs.value = []
    newFormData.value = {}
  } finally {
    newFormLoading.value = false
  }
}

/**
 * 编辑模式：调用 POST /issue/queryEditMeta（scene=EDIT）拿到「表单结构 + 字段当前值」，转 tabs 并回填
 */
/** 编辑场景取值：与后端 queryEditMeta 的 scene 一致 */
const EDIT_SCENE = 'EDIT'

/** 把 queryEditMeta 的返回值转成表单 tab 结构：type + data(tabItems)，复用详情的 tab 转换逻辑 */
function buildTabsFromEditMeta(meta: IssueEditMetaVO): any[] {
  const structure = meta?.data
  if (structure) {
    // 返回的 type（TAB_CONTAINER/COMMON_LIST）在顶层，data 是对应的 tabItems / 字段数组
    return buildTabsFromDetail([
      {
        type: 'CUSTOM_FIELD',
        fieldGroupStructure: {
          type: meta?.type || (Array.isArray(structure) ? 'COMMON_LIST' : 'TAB_CONTAINER'),
          data: structure as unknown as DetailFieldGroupStructure['data'],
        } as DetailFieldGroupStructure,
      },
    ])
  }
  return []
}

/**
 * 取枚举字段的「值」：queryEditMeta 会把选中项返回成对象（{ optionId, optionName }），
 * 而下拉 option 的 value 是枚举值本身（如 'p3'），所以对象要还原成 optionId。
 */
function enumValueOf(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const v = o.optionId ?? o.value ?? o.id ?? o.optionValue
    return v == null ? '' : String(v)
  }
  return String(raw)
}

/**
 * 编辑模式：把 queryEditMeta 返回的空间 / 问题类型回显到顶部两个下拉。
 * 两者都可能在当前下拉选项里查不到（编辑态不重拉类型列表、空间可能不在列表内），
 * 这时用接口返回的编码与名称临时补一条，保证不是空白。
 */
function applyEditHeaderMeta(meta: IssueEditMetaVO) {
  const spaceCode = String(meta.spaceCode ?? '').trim()
  if (spaceCode) {
    let sp = spaceOptions.value.find(s => String(s.spaceCode) === spaceCode)
    if (!sp) {
      sp = { id: -1, spaceCode, spaceName: meta.spaceName || spaceCode } as unknown as SpaceItem
      spaceOptions.value = [sp, ...spaceOptions.value]
    }
    newFormSpaceId.value = sp.id
  }
  const issueTypeCode = String(meta.issueTypeCode ?? '').trim()
  if (issueTypeCode) {
    let opt = issueTypeOptions.value.find(
      o => o.code === issueTypeCode || `TYPE${o.value}` === issueTypeCode || o.value === issueTypeCode,
    )
    if (!opt) {
      opt = {
        value: issueTypeCode.replace(/^TYPE/, ''),
        label: meta.issueTypeName || issueTypeCode,
        code: issueTypeCode,
      }
      issueTypeOptions.value = [opt, ...issueTypeOptions.value]
    }
    newFormIssueTypeId.value = opt.value
  }
}

async function loadEditDetail(issueKey: string) {
  newFormLoading.value = true
  try {
    // 空间下拉正在加载时先等它，保证能按 spaceCode 找到对应选项
    if (spaceLoadingReq) await spaceLoadingReq
    const res = await queryEditMeta({ issueKey, scene: EDIT_SCENE })
    if (res?.success && res.data) {
      // 新接口直接返回编辑弹窗的表单结构（TAB_CONTAINER / COMMON_LIST），与详情 layoutGroup 结构一致
      const tabs = buildTabsFromEditMeta(res.data)
      if (tabs.length) {
        newFormTabs.value = tabs
        newFormActiveTab.value = tabs[0]?.title ?? ''
        // 回填字段值：日期转 dayjs，富文本取原文，其余取 value
        const form: Record<string, any> = {}
        for (const tab of tabs) {
          for (const f of tab.issueFields) {
            const fid = String(f.id ?? '')
            if (!fid) continue
            if (f.type === 'RICH_TEXT') {
              form[fid] = typeof f.value === 'string' ? f.value : ''
            } else if ((f.type === FIELD_TYPE.DATE_PICKER || f.type === FIELD_TYPE.TIME_PICKER) && f.value && typeof f.value === 'string') {
              form[fid] = dayjs(f.value)
            } else if (f.type === FIELD_TYPE.SELECT_USER_SINGLE || f.type === FIELD_TYPE.SELECT_USER_MULTI) {
              // 用户字段：form 值规范为人员唯一键 memberId（a-select option value 同为 personKey），
              // 并预填充当前已选用户对象，避免选项异步加载前 a-select 只显示原始值
              const rawVal = f.value
              if (f.type === FIELD_TYPE.SELECT_USER_MULTI) {
                const arr = Array.isArray(rawVal) ? rawVal : rawVal == null ? [] : [rawVal]
                form[fid] = arr
                  .map(v => personKey(v))
                  .filter(Boolean)
              } else if (rawVal != null && typeof rawVal === 'object') {
                form[fid] = personKey(rawVal)
              } else {
                form[fid] = rawVal ?? null
              }
              const rawUser = f.exportValue ?? f.value
              const userObjs = (f.type === FIELD_TYPE.SELECT_USER_MULTI
                ? (Array.isArray(rawUser) ? rawUser : rawUser == null ? [] : [rawUser])
                : rawUser == null ? [] : [rawUser]
              ).filter((v: unknown) => v != null && typeof v === 'object')
              if (userObjs.length) {
                memberOptionsMap[fid] = userObjs.map(o => ({ ...(o as UserItem) }))
              }
            } else if (f.type === FIELD_TYPE.SELECT_LIST_SINGLE || f.type === FIELD_TYPE.CASCADER_SINGLE) {
              // 单选枚举：queryEditMeta 返回的可能是一个对象，如 { optionId: 'p3', optionName: 'P3-较低' }，
              // 下拉的 option value 是枚举值本身，这里取 optionId，否则下拉匹配不到、显示为空
              form[fid] = enumValueOf(f.value)
            } else if (f.type === FIELD_TYPE.SELECT_LIST_MULTI) {
              // 多选枚举：可能是数组，数组元素同样可能是对象
              const arr = Array.isArray(f.value) ? f.value : f.value == null ? [] : [f.value]
              form[fid] = arr.map((v: unknown) => enumValueOf(v)).filter(Boolean)
            } else {
              form[fid] = f.value ?? null
            }
            // 问题类型仅用于展示（编辑模式下下拉禁用）
            if (fid === 'issuetype' && f.value != null) {
              newFormIssueTypeId.value =
                typeof f.value === 'object'
                  ? String((f.value as any).id ?? '')
                  : String(f.value)
            }
          }
        }
        newFormData.value = form
        // 顶部「空间」「问题类型」按接口返回值回显（编辑模式下两个下拉均禁用，仅展示）
        applyEditHeaderMeta(res.data)
        // 成员选项预取 + 自定义字段选项拉取（保证人员下拉/级联可选）
        postLoadAfterBuildTabs()
      } else {
        newFormTabs.value = []
        newFormData.value = {}
      }
    }
  } catch {
  } finally {
    newFormLoading.value = false
  }
}

/**
 * 将 queryDetail 的 layoutGroup 转为表单 tab 结构（与详情页一致）：
 * COMMON_LIST 生成单 tab；TAB_CONTAINER 每个 tabItem 一个 tab；同标题合并
 */
function buildTabsFromDetail(layoutGroup: DetailLayoutGroup[]): any[] {
  const tabs: any[] = []
  const idxByTitle = new Map<string, number>()
  const appendTab = (title: string, sequence: number, fields: any[]) => {
    if (!fields || !fields.length) return
    const idx = idxByTitle.get(title)
    if (idx != null) {
      tabs[idx].issueFields.push(...fields)
    } else {
      idxByTitle.set(title, tabs.length)
      tabs.push({ title, sequence, issueFields: [...fields] })
    }
  }
  for (const g of layoutGroup || []) {
    const s = g?.fieldGroupStructure
    if (!s) continue
    if (s.type === 'TAB_CONTAINER') {
      const items = (s.data as any)?.tabItems || []
      for (const it of items) {
        if (it.title === 'C端专用字段') continue
        // Tab 名直接取接口返回的 tabItems.title（如「必填」「选填」），不再本地映射
        appendTab(it.title, it.sequence ?? 0, it.issueFields)
      }
    } else if (s.type === 'COMMON_LIST') {
      const fields = Array.isArray(s.data) ? s.data : Array.isArray(s.issueFields) ? s.issueFields : []
      const title = g.type === 'SUMMARY' ? '基本信息' : g.type === 'DESCRIPTION' ? '描述' : '自定义信息'
      appendTab(title, g.sequence ?? tabs.length, fields)
    }
  }
  return tabs
}

/**
 * 解析某字段的可用选项（下拉/单选/复选框/级联）
 * 优先使用批量接口返回的 options；否则回落到 createMeta 返回的 exportValue
 */
function getFieldOptions(field: any): CustomFieldOptionItem[] {
  const fid = String(field.id ?? field.fieldId ?? '')
  // 1) 优先：接口返回的枚举（已存入 map）
  const fromApi = fid ? customFieldOptionsMap.value?.[fid] : undefined
  if (fromApi && Array.isArray(fromApi) && fromApi.length) return fromApi
  // 2) 回退：configSchema / options.options（模板/自定义字段配置中自带）
  const cfgRaw = field?.configSchema ?? field?.options?.options ?? field?.widgetOptions?.options
  if (cfgRaw) {
    let arr: any[] = []
    if (Array.isArray(cfgRaw)) arr = cfgRaw
    else if (typeof cfgRaw === 'string') { try { arr = JSON.parse(cfgRaw) } catch { /* ignore */ } }
    if (Array.isArray(arr) && arr.length) {
      return arr
        .filter((x: any) => x != null)
        .map((x: any, i: number) => mapLabelValueToOption(x, i))
    }
  }
  // 3) 回退：exportValue 数组（递归处理 children / childJOptions，保证级联二级枚举不丢）
  const ev = field?.exportValue
  if (Array.isArray(ev) && ev.length) {
    const normalized: CustomFieldOptionItem[] = []
    for (const raw of ev) {
      if (raw == null) continue
      if (typeof raw === 'object' && ('value' in raw || 'id' in raw || 'optionId' in raw)) {
        normalized.push(mapLabelValueToOption(raw, normalized.length))
      } else {
        const str = String(raw)
        normalized.push({ id: str, name: str, value: str })
      }
    }
    if (normalized.length) return normalized
  }
  return []
}

// ---- 枚举选项颜色：下拉选项与选中值都按后端返回的 color 渲染 ----
/** 按 value 找到该字段的枚举项 */
function enumOptionOf(field: any, value: string): CustomFieldOptionItem | undefined {
  return getFieldOptions(field).find((o: CustomFieldOptionItem) => String(o.value) === value)
}

/** 选项文字色：混入深色保证浅色枚举仍可读；无颜色时返回 undefined（用默认色） */
function optionTextStyle(color?: string): { color: string } | undefined {
  const c = String(color ?? '').trim()
  return c ? { color: `color-mix(in srgb, ${c} 78%, #1d1d1f)` } : undefined
}

/** 多选标签样式：同色浅底 + 加深的同色文字 + 描边 */
function enumTagStyle(field: any, value: string): Record<string, string> | undefined {
  const c = String(enumOptionOf(field, value)?.color ?? '').trim()
  if (!c) return undefined
  return {
    background: `color-mix(in srgb, ${c} 12%, #fff)`,
    color: `color-mix(in srgb, ${c} 78%, #1d1d1f)`,
    borderColor: `color-mix(in srgb, ${c} 35%, #fff)`,
  }
}

// ---- member 类型：远程搜索用户（按 field id 独立状态） ----
const memberOptionsMap = reactive<Record<string, UserItem[]>>({})
const memberLoadingMap = reactive<Record<string, boolean>>({})
const memberSearchTimers = reactive<Record<string, ReturnType<typeof setTimeout> | null>>({})

function handleMemberSearch(fieldId: string, keyword: string) {
  if (memberSearchTimers[fieldId]) clearTimeout(memberSearchTimers[fieldId]!)
  memberSearchTimers[fieldId] = setTimeout(async () => {
    memberLoadingMap[fieldId] = true
    try {
      const res = await queryUsers({ keyword, isActive: 1, page: 1, pageSize: 20 })
      const list = res.success && res.data ? res.data.list || [] : []
      // 合并当前已选用户（编辑回填预置/已选标签），保证选中值始终有匹配选项
      const merged = [...list]
      const curVal = newFormData.value[fieldId]
      const curNos = Array.isArray(curVal)
        ? curVal.map((v: unknown) => String(v ?? '')).filter(Boolean)
        : curVal != null && curVal !== ''
          ? [String(curVal)]
          : []
      for (const no of curNos) {
        if (!merged.some(u => personKey(u) === no)) {
          const pre = (memberOptionsMap[fieldId] || []).find(u => personKey(u) === no)
          merged.unshift(pre ? { ...pre } : ({ memberId: no } as UserItem))
        }
      }
      memberOptionsMap[fieldId] = merged
    } catch {
      memberOptionsMap[fieldId] = []
    } finally {
      memberLoadingMap[fieldId] = false
    }
  }, 300)
}

/** 用户下拉选项文字：realName（coAccount），如 王芳（wangfang） */
function formatMemberLabel(u: UserItem): string {
  return personLabel(u as unknown as Record<string, unknown>)
}

/** 无头像时显示的占位字（姓名首字，无姓名取账号首字） */
function memberInitial(u: UserItem): string {
  return personInitial(u as unknown as Record<string, unknown>)
}

/** 根据人员唯一键（memberId）从字段选项列表中查找用户对象 */
function findMemberByNo(fieldId: string, no: string): UserItem | undefined {
  return (memberOptionsMap[fieldId] || []).find(u => personKey(u) === no)
}

/** 选中标签文字：realName（coAccount），选项未加载时兜底显示原始值 */
function memberSelectionLabel(fieldId: string, no: string): string {
  if (!no) return ''
  const u = findMemberByNo(fieldId, no)
  return u ? formatMemberLabel(u) : no
}

/** 选中标签头像：avatarUrl（旧接口 userAvatar），无头像返回空串显示首字母 */
function memberSelectionAvatar(fieldId: string, no: string): string {
  if (!no) return ''
  const u = findMemberByNo(fieldId, no)
  return u ? personAvatar(u as unknown as Record<string, unknown>) : ''
}

/** 选中标签无头像时的首字母 */
function memberSelectionInitial(fieldId: string, no: string): string {
  if (!no) return ''
  const u = findMemberByNo(fieldId, no)
  if (!u) return ''
  return memberInitial(u)
}

// ---- 富文本编辑器（wangeditor）实例管理 ----
const richEditorInstances = reactive<Record<string, IDomEditor | null>>({})

const richEditorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入富文本内容',
  scroll: false,
  MENU_CONF: {},
}

function handleRichEditorCreated(fieldId: string, editor: IDomEditor) {
  richEditorInstances[fieldId] = editor
}

// 编辑区默认约 4 行高，可通过底部拖拽条调整
const RICH_EDITOR_MIN_HEIGHT = 120
const RICH_EDITOR_MAX_HEIGHT = 800
const richEditorHeights = reactive<Record<string, number>>({})

function startRichEditorResize(e: PointerEvent, fieldId: string) {
  const handle = e.currentTarget as HTMLElement
  const startY = e.clientY
  const startHeight = richEditorHeights[fieldId] ?? RICH_EDITOR_MIN_HEIGHT
  handle.setPointerCapture(e.pointerId)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ns-resize'
  e.preventDefault()

  const onMove = (ev: PointerEvent) => {
    const next = startHeight + ev.clientY - startY
    richEditorHeights[fieldId] = Math.min(RICH_EDITOR_MAX_HEIGHT, Math.max(RICH_EDITOR_MIN_HEIGHT, next))
  }
  const onUp = (ev: PointerEvent) => {
    handle.releasePointerCapture(ev.pointerId)
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onUp)
    handle.removeEventListener('pointercancel', onUp)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onUp)
  handle.addEventListener('pointercancel', onUp)
}

function destroyRichEditors() {
  Object.entries(richEditorInstances).forEach(([key, inst]) => {
    if (inst && typeof inst.destroy === 'function') {
      try { inst.destroy() } catch {}
    }
    delete richEditorInstances[key]
  })
  Object.keys(richEditorHeights).forEach((key) => delete richEditorHeights[key])
}

// 注：旧流程（getIssueCreateMeta）已替换为「选中模板 → 解析 widgetData → 渲染表单」，详见 handleTemplateChange

function handleNewFormCancel() {
  selectedTemplate.value = ''
  customFieldOptionsMap.value = {}
  visible.value = false
}

// ---- 表单末尾「新建」：下拉选择可用字段追加到当前 Tab ----
/** 展示位置：新建事项只取 CREATE 场景的字段（与后端 displayScene 取值一致） */
const DISPLAY_SCENE_CREATE = 'CREATE'
const addFieldDropdownOpen = ref(false)
const addFieldKeyword = ref('')
const availableFieldsLoading = ref(false)
const availableFieldsList = ref<AvailableFieldItem[]>([])

/** 可添加字段：后端返回的字段（已按关键词搜索）中排除表单里已存在的 */
const addableFields = computed(() => {
  const existing = new Set(collectAllFields().map(f => String(f.id)))
  return availableFieldsList.value.filter(f => !existing.has(String(f.fieldId)))
})

let availableFieldsSeq = 0
/** 拉取可用字段（/availableField/list，后端按关键词搜索）：每次展开都重新获取，保证与字段配置同步；过滤已废弃字段 */
async function loadAvailableFields(keyword = '') {
  const seq = ++availableFieldsSeq
  availableFieldsLoading.value = true
  try {
    // 展示位置限定为「新建」场景（后端按 displayScene 过滤）
    const res = await queryAvailableFieldList({
      page: 1,
      pageSize: 999,
      searchKey: keyword.trim(),
      displayScene: DISPLAY_SCENE_CREATE,
    })
    if (seq !== availableFieldsSeq) return
    availableFieldsList.value = (res?.data?.list || [])
      .filter(f => !f.obsolete)
      .map(f => ({ ...f, type: normalizeFieldType(f.type || f.filedType) }))
  } catch {
    if (seq === availableFieldsSeq) availableFieldsList.value = []
  } finally {
    if (seq === availableFieldsSeq) availableFieldsLoading.value = false
  }
}

function handleAddDropdownOpenChange(open: boolean) {
  if (!open) return
  addFieldKeyword.value = ''
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  loadAvailableFields()
}

// 搜索：防抖后按关键词请求后端
let addFieldSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(addFieldKeyword, (kw) => {
  if (!addFieldDropdownOpen.value) return
  clearTimeout(addFieldSearchTimer)
  addFieldSearchTimer = setTimeout(() => loadAvailableFields(kw), 300)
})

/** 选中字段：追加到当前激活 Tab 末尾，初始化值并补拉选项/成员数据 */
function handleAddField(f: AvailableFieldItem) {
  const field = {
    /** 由「新建」追加的字段：可删除、可调整顺序（说明文本等原生字段不支持） */
    __added: true,
    id: String(f.fieldId),
    name: f.fieldName || String(f.fieldId),
    type: f.type || FIELD_TYPE.TEXT_BOX_SINGLE_LINE,
    jiraType: null,
    value: null,
    editable: true,
    required: false,
    standard: !!f.isSystem,
    sequence: 0,
    frontPage: true,
    description: '',
    defaultvalue: null,
    exportValue: null,
    issueTemplateValue: null,
    configSchema: f.configSchema ?? f.fieldValue ?? undefined,
  }
  if (!newFormTabs.value.length) {
    newFormTabs.value = [{ title: '', sequence: 0, issueFields: [] }]
    newFormActiveTab.value = ''
  }
  const tab = newFormTabs.value.find(t => t.title === newFormActiveTab.value) ?? newFormTabs.value[0]
  field.sequence = tab.issueFields.length
  tab.issueFields.push(field)
  newFormData.value[field.id] = field.type === FIELD_TYPE.RICH_TEXT ? '' : null
  addFieldDropdownOpen.value = false

  if (OPTION_WIDGET_TYPE_SET.has(field.type)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadCustomFieldOptions(currentSpace.value?.spaceCode || NEW_FORM_DEFAULT_PROJECT_ID, currentIssueTypeCode(), [{ issueFields: [field] }])
  }
  if (field.type === FIELD_TYPE.SELECT_USER_SINGLE || field.type === FIELD_TYPE.SELECT_USER_MULTI) {
    handleMemberSearch(field.id, '')
  }
}

type TabFields = { title: string; sequence: number; issueFields: any[] }

// ---------- 追加字段拖动排序（拖动经过目标行时即时插入） ----------
const dragFieldIndex = ref(-1)
const dragTabTitle = ref('')
/** 拖拽经过的行 + 插入方向（true 插在该行之前） */
const dragOverIndex = ref(-1)
const dragInsertBefore = ref(false)

function onFieldDragStart(tab: TabFields, index: number, e: DragEvent) {
  dragTabTitle.value = tab.title
  dragFieldIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // 部分浏览器不写 data 不会触发拖拽
    e.dataTransfer.setData('text/plain', String(index))
  }
}

/**
 * 经过某个字段：只记录落点与插入方向（上半插入该行之前，下半插入之后）。
 * 注意：这里不能去改 issueFields —— 拖动中重排会让被拖的行在 DOM 里被销毁，
 * 浏览器会当成拖拽源消失而立刻触发 dragend，排序就永远落不下去。真正的移动放在 drop 里做。
 */
function onFieldDragOver(tab: TabFields, index: number, e: DragEvent) {
  if (dragFieldIndex.value < 0 || tab.title !== dragTabTitle.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const row = e.currentTarget
  const rect = row instanceof HTMLElement ? row.getBoundingClientRect() : null
  dragOverIndex.value = index
  dragInsertBefore.value = !!rect && e.clientY < rect.top + rect.height / 2
}

/** 松开：把字段移到落点位置 */
function onFieldDrop(tab: TabFields, index: number, e: DragEvent) {
  e.preventDefault()
  const from = dragFieldIndex.value
  if (from < 0 || tab.title !== dragTabTitle.value) return onFieldDragEnd()
  let target = dragInsertBefore.value ? index : index + 1
  if (from < target) target -= 1
  if (from !== target) {
    const list = tab.issueFields
    const [moved] = list.splice(from, 1)
    list.splice(target, 0, moved)
    list.forEach((f: any, i: number) => {
      f.sequence = i
    })
  }
  onFieldDragEnd()
}

function onFieldDragEnd() {
  dragFieldIndex.value = -1
  dragTabTitle.value = ''
  dragOverIndex.value = -1
  dragInsertBefore.value = false
}

/** 删除：从当前 Tab 移除该字段并清掉已填的值（删除后可在「新建」里重新添加） */
function removeField(tab: TabFields, index: number) {
  const field = tab.issueFields[index]
  if (!field?.__added) return
  tab.issueFields.splice(index, 1)
  delete newFormData.value[String(field.id)]
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
 * 空间 / 问题类型的标准字段 type 约定（与后端 POST /issue/create 示例一致）
 */
const ISSUETYPE_FIELD_TYPE = 'SELECT_LIST_SINGLE_ISSUETYPE'
const SPACE_FIELD_TYPE = 'SELECT_LIST_SINGLE_SPACE'

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
 * 枚举值 → { optionId, optionName, color }：表单值可能是 optionId 字符串，也可能是带 optionId 的对象；
 * 优先按枚举项补全名称与颜色，查不到时保留原对象里已有的 optionName / color
 */
function buildEnumOptionValue(opts: CustomFieldOptionItem[], raw: unknown) {
  const id = enumValueOf(raw)
  const found = opts.find(o => String(o.value) === id)
  if (found) {
    return { optionId: found.value, optionName: found.name, ...(found.color ? { color: found.color } : {}) }
  }
  const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const name = String(obj.optionName ?? obj.name ?? obj.label ?? id)
  const color = String(obj.color ?? '').trim()
  return { optionId: id, optionName: name, ...(color ? { color } : {}) }
}

/**
 * 将表单值按 field.type 转为 POST /issue/create 期望的 value 结构
 * SELECT_LIST_SINGLE / SELECT_LIST_MULTI / SELECT_USER_SINGLE / SELECT_USER_MULTI 传整个选项对象
 */
function buildFieldValue(field: CreateMetaField, raw: unknown): unknown {
  const type = String(field.type ?? '')
  if (isEmptyValue(raw)) {
    return type === FIELD_TYPE.TEXT_BOX_NUMBER ? null : undefined
  }
  // 级联字段：特殊结构嵌套 optionId + childJOptions
  if (type === FIELD_TYPE.CASCADER_SINGLE) {
    return buildCascadingValue(raw)
  }
  // 数字字段：保持 number 类型
  if (type === FIELD_TYPE.TEXT_BOX_NUMBER) {
    if (typeof raw === 'number') return raw
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  // 单选下拉：传 { optionId, optionName, color }（新建与编辑入参一致，color 有值才带）
  if (type === FIELD_TYPE.SELECT_LIST_SINGLE) {
    return buildEnumOptionValue(getFieldOptions(field), raw)
  }
  // 多选下拉：传 [{ optionId, optionName, color }, ...]
  if (type === FIELD_TYPE.SELECT_LIST_MULTI) {
    const opts = getFieldOptions(field)
    const arr = Array.isArray(raw) ? raw : [raw]
    return arr.map((v: unknown) => buildEnumOptionValue(opts, v))
  }
  // 用户单选：传整个 UserItem
  if (type === FIELD_TYPE.SELECT_USER_SINGLE) {
    const opts = memberOptionsMap[String(field.id)] || []
    const found = opts.find(u => personKey(u) === String(raw))
    return found || { memberId: String(raw) }
  }
  // 用户多选：传 UserItem 数组
  if (type === FIELD_TYPE.SELECT_USER_MULTI) {
    const opts = memberOptionsMap[String(field.id)] || []
    const arr = Array.isArray(raw) ? raw : [raw]
    return arr.map((v: unknown) => {
      const found = opts.find(u => personKey(u) === String(v))
      return found || { memberId: String(v) }
    })
  }
  // 文本/日期/富文本等：保持原值
  return raw
}

/**
 * 构造 POST /issue/create 的 { inputFields: [...] }
 * 顺序：space -> issuetype -> meta 中的自定义/标准字段（按 tab 顺序，空值也带 id/type 以防服务端默认值缺失）
 */
function buildCreateIssuePayload(): CreateIssuePayload {
  const allFields = collectAllFields()
  const inputFields: CreateIssueInputField[] = []

  // 1) 空间：提交所选空间的编码 spaceCode（不再提交 organization）
  const spaceCode = currentSpace.value?.spaceCode
  if (spaceCode) {
    inputFields.push({
      id: 'space',
      type: SPACE_FIELD_TYPE,
      value: spaceCode,
    })
  }
  // 2) 问题类型
  // 问题类型提交编码（如 TYPE10001）；兜底选项无编码时退回提交 ID
  inputFields.push({
    id: 'issuetype',
    type: ISSUETYPE_FIELD_TYPE,
    value: currentIssueTypeCode(),
  })

  // 3) 其余字段（按 tab.sequence + tab 内顺序；project 不提交）
  const seenIds = new Set<string>(['project', 'space', 'organization', 'issuetype'])
  for (const field of allFields) {
    const id = String(field.id ?? '').trim()
    if (!id || seenIds.has(id)) continue
    seenIds.add(id)
    const raw = newFormData.value[id]
    const value = buildFieldValue(field, raw)
    inputFields.push({
      id,
      type: String(field.type ?? ''),
      value,
    })
  }

  return { inputFields }
}

// ---------- 保存为模板：把当前表单字段 + 已填内容存成新模板 ----------
const saveTplOpen = ref(false)
const saveTplName = ref('')
const saveTplSaving = ref(false)

function openSaveTemplateModal() {
  const hasField = newFormTabs.value.some(t => (t.issueFields?.length ?? 0) > 0)
  if (!hasField) {
    message.warning('当前表单没有可保存的字段')
    return
  }
  saveTplName.value = ''
  saveTplOpen.value = true
}

/** 表单值 → 模板默认值：dayjs 转字符串，其余尽量保持可 JSON 序列化 */
function serializeTemplateValue(v: unknown): unknown {
  if (v == null) return null
  if (Array.isArray(v)) return v.map(serializeTemplateValue)
  if (dayjs.isDayjs(v)) return v.format('YYYY-MM-DD HH:mm:ss')
  if (typeof v === 'object') {
    try { return JSON.parse(JSON.stringify(v)) } catch { return null }
  }
  return v
}

/** 提交保存：构造与模板管理一致的 payload（tabs[].widgetData 为 JSON 字符串），调 POST /template */
async function handleSaveTemplate() {
  const name = saveTplName.value.trim()
  if (!name) {
    message.warning('请输入模板名称')
    return
  }
  saveTplSaving.value = true
  try {
    const isTab = newFormTabs.value.length > 1
    const tabs = newFormTabs.value.map((t, idx) => ({
      name: t.title || `表单${idx + 1}`,
      is_tab: isTab,
      tabOrder: idx + 1,
      widgetData: JSON.stringify(
        (t.issueFields ?? []).map((f: any) => ({
          id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: f.name || f.id,
          type: f.type,
          fieldId: String(f.id),
          options: { title: f.name || f.id, required: !!f.required, placeholder: f.description || '' },
          required: !!f.required,
          // 当前填写的内容作为该字段的默认值
          defaultValue: serializeTemplateValue(newFormData.value[String(f.id)]),
        })),
      ),
    }))
    const res = await createTemplate({
      templateName: name,
      description: '',
      organizationCode: currentSpace.value?.organizationCode || undefined,
      spaceCode: currentSpace.value?.spaceCode || undefined,
      spaceName: currentSpace.value?.spaceName || undefined,
      issueTypeCode: currentIssueTypeCode(),
      issueTypeName: issueTypeOptions.value.find(o => o.value === newFormIssueTypeId.value)?.label,
      status: 1,
      isDefault: 0,
      // 从新建事项弹窗保存的属于用户自定义模板，仅自己可见
      isCustom: 1,
      tabs,
    })
    if (res?.success) {
      message.success('已保存为模板')
      saveTplOpen.value = false
      // 刷新模板下拉（不改变当前选中项）
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      loadTemplateOptions()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saveTplSaving.value = false
  }
}

async function handleNewFormSubmit() {
  if (!isEditMode.value && !newFormIssueTypeId.value) {
    message.warning('请选择问题类型')
    return
  }
  for (const tab of newFormTabs.value) {
    for (const f of tab.issueFields) {
      // 展示文本不参与必填校验
      if (f.type === FIELD_TYPE.LABEL) continue
      if (f.required) {
        const val = newFormData.value[f.id]
        if (isEmptyValue(val)) {
          newFormActiveTab.value = tab.title
          return
        }
      }
    }
  }
  newFormSubmitting.value = true
  try {
    if (isEditMode.value) {
      await saveEditForm()
    } else {
      const payload = buildCreateIssuePayload()
      await createIssue(payload)
    }
    visible.value = false
    emit('submitted')
  } catch {
  } finally {
    newFormSubmitting.value = false
  }
}

/**
 * 编辑模式保存：构造 PATCH /issue/{key} 数组请求体 [{ fieldId, fieldValue }]
 * 仅提交可编辑字段，跳过只读/系统字段（project、issuetype、issuekey、creator、created、updated）
 */
async function saveEditForm() {
  const allFields = collectAllFields()
  const fields: IssuePatchField[] = []
  const seenIds = new Set<string>()
  for (const field of allFields) {
    const fid = String(field.id ?? field.fieldId ?? '').trim()
    if (!fid || seenIds.has(fid)) continue
    if (fid === 'project' || fid === 'issuetype' || fid === 'issuekey' || fid === 'creator' || fid === 'created' || fid === 'updated') continue
    if (field.editable === false || field.readOnly) continue
    seenIds.add(fid)
    const raw = newFormData.value[fid]
    const value = buildFieldValue(field, raw)
    fields.push({ fieldId: fid, fieldValue: value === undefined ? null : value })
  }
  await patchIssue(String(props.issueKey), fields)
}
</script>

<style>
/* 空间下拉：颜色头像 + 名称 + 标识 */
.space-option { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; vertical-align: middle; }
.space-option-icon { width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 11px; font-weight: 600; color: #fff; }
.space-option-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 问题类型下拉：颜色图标 + 名称 */
.it-option { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; vertical-align: middle; }
.it-option-icon { width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; color: #fff; }
.it-option-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  /* 窄屏不再压缩：最小 880px，超出视口时弹窗层横向滚动 */
  min-width: 880px;
  max-width: 1280px;
  margin: 0 auto;
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
  height: auto;
  min-height: min(420px, 90vh);
  max-height: 90vh;
  max-height: 90dvh;
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
  border-color: var(--c-primary) !important;
  box-shadow: 0 0 0 3px transparent !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 12%, transparent) !important;
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

/* 保存为模板弹窗提示 */
.save-tpl-tip {
  font-size: 13px;
  color: #8c8c8c;
  margin-bottom: 10px;
}

/* ========== Footer：按钮区 + 细分隔线 ========== */
.new-form-modal .ant-modal-footer {
  flex-shrink: 0;
  padding: 10px 24px 10px;
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
  background: linear-gradient(180deg, var(--c-primary) 0%, #2563eb 100%);
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
  background: linear-gradient(180deg, var(--c-primary) 0%, #2563eb 100%);
  border: none;
  opacity: 0.85;
}

/* body 占满 content 剩余高度（= 75vh - header - footer），交给内部 flex 分区 */
.new-form-modal .ant-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 6px 24px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.new-form-spin,
.new-form-spin .ant-spin-container {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.new-form-inner {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

/* ===== 第一段固定区：问题类型容器 ===== */
.new-form-header {
  flex-shrink: 0;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  padding-top: 12px;
  padding-bottom: 16px;
}

.new-form-header .ant-form,
.new-form-header .ant-form-item {
  margin-bottom: 0;
}

.new-form-header .ant-form-item + .ant-form-item {
  margin-top: 12px;
}

.issue-type-empty {
  padding: 8px 4px;
  font-size: 12px;
  color: #8e8e93;
  text-align: center;
}

.new-form-divider.ant-divider {
  flex-shrink: 0;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  margin: 0 0 24px;
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
  flex: 1 1 auto;
  min-height: 0;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-nav {
  flex-shrink: 0;
  margin-bottom: 12px;
  background: #ffffff;
  padding: 0;
  border-radius: 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}
.new-form-tabs-area .new-form-tabs.no-tab-bar .ant-tabs-nav {
  display: none;
}
.new-form-tabs-area .new-form-tabs.no-tab-bar .ant-tabs-content-holder {
  margin-top: 0;
  box-shadow: none;
}
.new-form-tabs-area .new-form-tabs.no-tab-bar {
  padding-top: 16px;
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

.new-form-tabs-area .new-form-tabs .ant-tabs-content-holder {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-content {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tabpane.ant-tabs-tabpane-active {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

/* ===== 滚动区：max-height 限制，超出滚动；内容少时跟随内容高度 ===== */
.tab-pane-scroll {
  max-height: calc(85vh - 260px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;
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

/* 表单末尾「新建」入口：靠最左侧 */
/* ---- 枚举颜色：下拉选项 / 选中值 ---- */
.enum-opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.enum-opt-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.enum-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  margin: 2px 4px 2px 0;
  padding: 0 4px 0 6px;
  border: 1px solid #e5e5ea;
  border-radius: 6px;
  background: #fafafa;
  font-size: 12px;
  line-height: 18px;
}

.enum-tag-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enum-tag-close {
  margin-left: 2px;
  font-size: 10px;
  color: #8c8c8c;
  cursor: pointer;
}

.enum-tag-close:hover {
  color: #ff4d4f;
}

/* 「新建」追加字段：最前拖拽手柄 + 字段本体 + 末尾删除图标，同一行 */
.field-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

/* 字段本体占满剩余宽度 */
.form-field-content {
  flex: 1;
  min-width: 0;
}

/* 拖拽手柄：2 列 × 3 行 = 六个点 */
.field-drag {
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, 3px);
  grid-template-rows: repeat(3, 3px);
  gap: 2px;
  padding: 3px 2px;
  cursor: grab;
  opacity: 0.45;
  transition: opacity 0.15s ease;
}

.field-drag:hover {
  opacity: 1;
}

.field-drag:active {
  cursor: grabbing;
}

.field-drag-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #8c8c8c;
}

/* 拖动中的行置灰 */
.field-row.is-dragging {
  opacity: 0.45;
}

/* 松手后的插入位置指示线：行上方 / 下方一条蓝线 */
.field-row.is-drop-before::before,
.field-row.is-drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--c-primary, #3370ff);
  pointer-events: none;
}

.field-row.is-drop-before::before {
  top: -6px;
}

.field-row.is-drop-after::after {
  bottom: -6px;
}

/* 删除图标：悬停该字段时出现在最右侧 */
.field-delete {
  flex: none;
  font-size: 14px;
  color: #bfbfbf;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.ant-form-item:hover .field-delete {
  opacity: 1;
}

.field-act {
  font-size: 13px;
  color: #8c8c8c;
  cursor: pointer;
  transition: color 0.15s ease;
}

.field-act-danger:hover {
  color: #ff4d4f;
}

.new-form-add-row {
  padding: 4px 0;
}

.new-form-add-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  margin-left: -10px;
  border-radius: 8px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.new-form-add-trigger:hover {
  background: #eff6ff;
}

/* 「新建」下拉：字段选择面板（Teleport 到 body） */
.add-field-panel {
  width: 280px;
  max-width: calc(100vw - 32px);
  padding: 8px;
  background: #ffffff;
  border-radius: 10px;
  box-shadow:
    0 6px 16px 0 rgba(15, 23, 42, 0.08),
    0 3px 6px -4px rgba(15, 23, 42, 0.12),
    0 9px 28px 8px rgba(15, 23, 42, 0.05);
}

.add-field-search {
  margin-bottom: 6px;
}

.add-field-list {
  max-height: 280px;
  overflow-y: auto;
}

.add-field-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #0f172a;
  cursor: pointer;
  transition: background 0.15s ease;
}

.add-field-item:hover {
  background: #f1f5f9;
}

.add-field-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-field-type {
  flex-shrink: 0;
  font-size: 12px;
  color: #94a3b8;
}

/* ====== 新建弹窗 - 水平表单布局样式 ====== */
.form-item-required-mark {
  color: #ef4444;
  margin-left: 2px;
  font-family: -apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-weight: 600;
}
.display-text-value {
  display: inline-block;
  padding: 4px 0;
  color: #262626;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

/* 人员下拉选项（头像 + 账号（工号）） */
.user-option-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.user-option-avatar {
  flex-shrink: 0;
  background: var(--c-primary);
  font-size: 11px;
}

/* a-select 选中标签（头像 + 账号（工号）） */
.user-selection-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.user-selection-cell > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  height: 34px;
  white-space: nowrap;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

/* 字段名过长时省略，拖拽手柄与必填星号不参与压缩 */
.field-label-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
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
.new-form-modal .ant-input:not(textarea),
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
  /* 默认 4 行（:rows="4"），可垂直拖动调整 */
  min-height: 98px;
  padding: 8px 10px;
  line-height: 1.5;
  font-size: 13px;
  resize: vertical;
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
  border-color: var(--c-primary) !important;
  box-shadow: 0 0 0 3px transparent !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 10%, transparent) !important;
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

/* ========== 响应式适配：随视口宽度调整弹窗宽度（最小 880px，更窄时不再压缩布局） ========== */
@media (max-width: 1440px) {
  .new-form-modal .ant-modal {
    width: 72% !important;
  }
}

@media (max-width: 1200px) {
  .new-form-modal .ant-modal {
    width: 85% !important;
  }
}

/* 富文本底部拖拽条：上下拖动调整高度 */
.rich-editor-resize-handle {
  position: relative;
  height: 10px;
  border-top: 1px solid #f0f0f0;
  border-radius: 0 0 6px 6px;
  background: #fafafa;
  cursor: ns-resize;
  touch-action: none;
}

.rich-editor-resize-handle::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 32px;
  height: 3px;
  border-radius: 2px;
  background: #cbd5e1;
  transform: translate(-50%, -50%);
  transition: background 0.15s ease;
}

.rich-editor-resize-handle:hover::after {
  background: #1677ff;
}

/* 矮屏（如笔记本 768px 高）：压缩滚动区以避免整体溢出 */
@media (max-height: 720px) {
  .tab-pane-scroll {
    max-height: calc(90vh - 230px);
    max-height: calc(90dvh - 230px);
  }
}
</style>
