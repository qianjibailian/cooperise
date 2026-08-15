<template>
  <a-modal
    v-model:open="visible"
    title="模板预览"
    width="900px"
    :footer="null"
    destroy-on-close
    class="template-preview-modal"
  >
    <div class="preview-section" v-if="normalizedTemplate">
      <!-- 预览模式切换 -->
      <div class="preview-mode-bar">
        <a-radio-group v-model:value="previewMode" size="small" button-style="solid">
          <a-radio-button value="form">表单</a-radio-button>
          <a-radio-button value="table">表格</a-radio-button>
        </a-radio-group>
      </div>

      <!-- 表单预览 -->
      <template v-if="previewMode === 'form'">
        <a-tabs
          v-if="effectiveFormTabs.length > 1"
          :key="normalizedTemplate.id"
          v-model:activeKey="previewActiveTab"
          type="line"
        >
          <a-tab-pane v-for="tab in effectiveFormTabs" :key="tab.id" :tab="tab.name">
            <div v-if="tab.widgetData.length" class="preview-wrap">
              <native-form-preview :widgets="tab.widgetData" v-model="previewTabData[tab.id]" />
            </div>
            <div v-else class="empty-preview">此表单暂无配置</div>
          </a-tab-pane>
        </a-tabs>
        <div v-else-if="effectiveFormTabs.length === 1" class="preview-wrap">
          <native-form-preview
            v-if="effectiveFormTabs[0].widgetData.length"
            :widgets="effectiveFormTabs[0].widgetData"
            v-model="previewTabData[effectiveFormTabs[0].id]"
          />
          <div v-else class="empty-preview">此表单暂无配置</div>
        </div>
        <div v-else class="empty-preview">模板无表单配置</div>
      </template>

      <!-- 表格预览 -->
      <template v-else>
        <div v-if="previewTableWidgets.length" class="preview-wrap">
          <div class="table-toolbar">
            <a-button size="small" type="primary" @click="addTableRow">
              <PlusOutlined /> 新增数据
            </a-button>
          </div>
          <vxe-table
            :data="tablePreviewData"
            keep-source
            border
            show-overflow
            size="small"
            :empty-text="'暂无数据'"
            :edit-config="{ trigger: 'click', mode: 'cell', showStatus: true, showIcon: false }"
            class="preview-table"
          >
            <vxe-column type="seq" width="50" align="center" title="#" />
            <vxe-column
              v-for="w in previewTableWidgets"
              :key="w.id || w.field"
              :field="w.field"
              :title="w.title || w.field"
              :min-width="160"
              :edit-render="{}"
            >
              <template #edit="{ row }">
                <a-input v-if="widgetEditType(w) === 'text'" v-model:value="row[w.field]" size="small" />
                <a-textarea v-else-if="widgetEditType(w) === 'textarea'" v-model:value="row[w.field]" size="small" :rows="2" />
                <a-input-number v-else-if="widgetEditType(w) === 'number'" v-model:value="row[w.field]" size="small" style="width:100%" />
                <a-date-picker v-else-if="widgetEditType(w) === 'date'" v-model:value="row[w.field]" size="small" style="width:100%" />
                <a-date-picker v-else-if="widgetEditType(w) === 'datetime'" v-model:value="row[w.field]" size="small" style="width:100%" show-time />
                <a-time-picker v-else-if="widgetEditType(w) === 'time'" v-model:value="row[w.field]" size="small" style="width:100%" />
                <a-select
                  v-else-if="widgetEditType(w) === 'select'"
                  v-model:value="row[w.field]"
                  size="small"
                  style="width:100%"
                  allow-clear
                >
                  <a-select-option v-for="o in toSelectOptions(w)" :key="String(o.value)" :value="o.value">{{ o.label }}</a-select-option>
                </a-select>
                <a-select
                  v-else-if="widgetEditType(w) === 'multi-select'"
                  v-model:value="row[w.field]"
                  size="small"
                  mode="multiple"
                  style="width:100%"
                  allow-clear
                >
                  <a-select-option v-for="o in toSelectOptions(w)" :key="String(o.value)" :value="o.value">{{ o.label }}</a-select-option>
                </a-select>
                <a-cascader
                  v-else-if="widgetEditType(w) === 'cascader'"
                  v-model:value="row[w.field]"
                  size="small"
                  style="width:100%"
                  :options="toCascaderOpts(w)"
                  allow-clear
                />
                <a-switch v-else-if="widgetEditType(w) === 'switch'" v-model:checked="row[w.field]" />
                <a-input v-else v-model:value="row[w.field]" size="small" />
              </template>
            </vxe-column>
          </vxe-table>
        </div>
        <div v-else class="empty-preview">此表单暂无配置</div>
      </template>
    </div>
    <div v-else class="empty-preview">模板无表单配置</div>
  </a-modal>
</template>

<script setup lang="ts">
import { defineComponent, h, ref, computed, watch } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { previewTemplateForm, previewTemplateTable } from '@/api/faiz'
import {
  Form as AForm, FormItem as AFormItem,
  Input as AInput, Textarea as ATextarea, InputNumber as AInputNumber,
  DatePicker as ADatePicker, TimePicker as ATimePicker,
  Select as ASelect, SelectOption as ASelectOption,
  RadioGroup as ARadioGroup, Radio as ARadio,
  CheckboxGroup as ACheckboxGroup, Checkbox as ACheckbox,
  Cascader as ACascader, Switch as ASwitch,
  Upload as AUpload, Button as AButton,
} from 'ant-design-vue'

/** 预览模板入参：父组件可以直接传后端原始 record，widgetData 允许是 JSON 字符串或数组 */
interface PreviewTab {
  id: string | number
  name: string
  widgetData: any[] | string
}
interface PreviewTemplate {
  id: string | number
  /** 模板分类（用于拉取事项列表 issuetypeId） */
  category?: string
  tabs?: PreviewTab[]
}

interface Props {
  open: boolean
  template: PreviewTemplate | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const visible = ref(props.open)
watch(() => props.open, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:open', v) })

// ---- 内部状态 ----
const previewMode = ref<'form' | 'table'>('form')
const previewActiveTab = ref<string>('')
const previewTabData = ref<Record<string, any>>({})
/** 表单预览接口返回数据 */
const formPreviewResp = ref<any>(null)
/** 表格预览接口返回数据 */
const tablePreviewResp = ref<any>(null)

/** 把外部传入的 template 归一化：解析 widgetData 字符串、保证 tabs 数组存在 */
const normalizedTemplate = computed(() => {
  const tpl = props.template
  if (!tpl) return null
  const tabs: { id: string; name: string; widgetData: any[] }[] = []
  for (const t of tpl.tabs || []) {
    const wd = typeof t.widgetData === 'string' ? parseWidgetDataSafe(t.widgetData) : (Array.isArray(t.widgetData) ? t.widgetData : [])
    tabs.push({ id: String(t.id), name: t.name || '', widgetData: normalizeWidgets(wd) })
  }
  return { id: String(tpl.id), category: tpl.category, tabs }
})

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
    }
  })
}

/** 表单预览有效 tabs：优先使用 /preview/form 接口返回，回退到本地 widgetData */
const effectiveFormTabs = computed<{ id: string; name: string; widgetData: any[] }[]>(() => {
  const apiTabs = formPreviewResp.value?.tabs
  if (Array.isArray(apiTabs) && apiTabs.length) {
    return apiTabs.map((t: any) => ({
      id: String(t.id),
      name: t.name || '',
      widgetData: normalizeWidgets(typeof t.widgetData === 'string'
        ? parseWidgetDataSafe(t.widgetData)
        : (Array.isArray(t.widgetData) ? t.widgetData : [])),
    }))
  }
  return normalizedTemplate.value?.tabs || []
})

/** 扁平化 widgets（递归 children） */
function extractWidgets(widgets: any[]): any[] {
  const all: any[] = []
  const walk = (ws: any[]) => {
    ws.forEach((w) => {
      if (w.children?.length) walk(w.children)
      else if (w.field) all.push(w)
    })
  }
  walk(widgets)
  return all
}

/** 表格列对应的 widget 列表（带完整字段信息，用于渲染表头与编辑控件） */
const previewTableWidgets = computed<any[]>(() => {
  // 优先使用 /preview/table 接口返回的 widgets
  const apiWidgets = tablePreviewResp.value?.widgets
  if (Array.isArray(apiWidgets) && apiWidgets.length) return normalizeWidgets(apiWidgets)
  // 回退到本地 widgetData
  const tpl = normalizedTemplate.value
  if (!tpl) return []
  const all: any[] = []
  for (const tab of tpl.tabs) {
    if (tab.widgetData.length) all.push(...extractWidgets(tab.widgetData))
  }
  return all
})

/** 表格数据行（支持新增/编辑） */
const tablePreviewData = ref<any[]>([])

/** 选项辅助函数（兼容 {label,value} / {name,id} 两种后端风格） */
function optLabel(o: any): string { return String(o?.label ?? o?.name ?? o?.value ?? o?.id ?? '') }
function optValue(o: any): any { return o?.value ?? o?.id ?? o?.label ?? o?.name }
function toSelectOptions(w: any): { label: string; value: any }[] {
  const opts = (w?.options?.options as any[]) || []
  return opts.filter(Boolean).map((o) => ({ label: optLabel(o), value: optValue(o) }))
}
function toCascaderOpts(w: any): any[] {
  const opts = (w?.options?.options as any[]) || []
  const walk = (list: any[]): any[] => list.filter(Boolean).map((o) => {
    const c = o?.children ?? o?.childJOptions
    return {
      label: optLabel(o),
      value: optValue(o),
      children: Array.isArray(c) && c.length ? walk(c) : undefined,
    }
  })
  return walk(opts)
}

/** 根据 componentKey 返回编辑控件类型 */
function widgetEditType(w: any): string {
  const k = String(w?.componentKey ?? w?.type ?? '').toLowerCase()
  if (['input_number', 'numeric_field'].includes(k)) return 'number'
  if (['datetime_picker', 'date_time_picker'].includes(k)) return 'datetime'
  if (['date_picker', 'date'].includes(k)) return 'date'
  if (['time', 'time_picker'].includes(k)) return 'time'
  if (['cascader', 'select_list_cascading'].includes(k)) return 'cascader'
  if (['select_multiple', 'select_list_multiple', 'multi_select', 'checkbox_group', 'checkbox'].includes(k)) return 'multi-select'
  if (['select_single', 'select_list_single', 'sprint_field', 'radio_group', 'radio', 'member', 'select_user_single', 'select_user_multiple'].includes(k)) return 'select'
  if (['switch', 'boolean'].includes(k)) return 'switch'
  if (['textarea', 'rich_text', 'text_box_multiline'].includes(k)) return 'textarea'
  return 'text'
}

/** 新增一行空数据 */
function addTableRow() {
  const row: Record<string, any> = {}
  previewTableWidgets.value.forEach((w: any) => {
    if (w.field) row[w.field] = null
  })
  tablePreviewData.value.push(row)
}

// ---- 打开时初始化表单数据（按 widget.field 预置 null，避免 v-model 缺字段） ----
// 同时监听 open 和 template，确保两者都就绪后才初始化
watch(
  () => [props.open, props.template] as [boolean, PreviewTemplate | null],
  async ([open, tpl]) => {
    if (!open || !tpl) return
    const normalized = normalizedTemplate.value
    if (!normalized) return
    // 重置接口缓存
    formPreviewResp.value = null
    tablePreviewResp.value = null
    // 基于本地 widgetData 预置表单数据（作为接口未返回时的回退）
    const tabData: Record<string, any> = {}
    normalized.tabs.forEach((tab) => {
      const data: Record<string, any> = {}
      const init = (ws: any[], o: Record<string, any>) =>
        ws.forEach((w: any) => {
          if (w.children?.length) init(w.children, o)
          else if (w.field) o[w.field] = null
        })
      tab.widgetData.length && init(tab.widgetData, data)
      tabData[tab.id] = data
    })
    previewTabData.value = tabData
    previewActiveTab.value = normalized.tabs[0]?.id || ''
    previewMode.value = 'form'
    // 触发表单预览接口
    try {
      const res = await previewTemplateForm(tpl.id)
      // res 即响应体 { message, success, data }，data 为模板对象
      formPreviewResp.value = res?.data || null
      // 接口返回 tabs 后，按接口 tabs 重新初始化表单数据
      const apiTabs = formPreviewResp.value?.tabs
      if (Array.isArray(apiTabs) && apiTabs.length) {
        const newTabData: Record<string, any> = {}
        apiTabs.forEach((t: any) => {
          const wd = typeof t.widgetData === 'string'
            ? parseWidgetDataSafe(t.widgetData)
            : (Array.isArray(t.widgetData) ? t.widgetData : [])
          const data: Record<string, any> = {}
          const init = (ws: any[], o: Record<string, any>) =>
            ws.forEach((w: any) => {
              if (w.children?.length) init(w.children, o)
              else if (w.field) o[w.field] = null
            })
          wd.length && init(wd, data)
          newTabData[String(t.id)] = data
        })
        previewTabData.value = newTabData
        previewActiveTab.value = String(apiTabs[0]?.id || '')
      }
    } catch {
      formPreviewResp.value = null
    }
  },
)

// ---- 切换到表格预览时加载表格数据 ----
watch(previewMode, async (mode) => {
  if (mode !== 'table') return
  const tpl = normalizedTemplate.value
  if (!tpl) return
  // 切换到表格模式时重置数据行
  tablePreviewData.value = []
  // 已缓存则不重复请求
  if (tablePreviewResp.value) return
  try {
    const res = await previewTemplateTable(tpl.id)
    // res 即响应体 { message, success, data }
    tablePreviewResp.value = res?.data || null
  } catch {
    tablePreviewResp.value = null
  }
})

// ============================================================
// NativeFormPreview：基于 widgetData 真实字段渲染 Ant Design 表单控件
//  - 类型判断以 componentKey 为准（与新建弹窗 field.type 分支保持一致）
//  - 选项读取 options.options（级联则递归 children）
//  - 必填直接用 widget.required
// ============================================================
const NativeFormPreview = defineComponent({
  name: 'NativeFormPreview',
  props: {
    widgets: { type: Array as () => any[], required: true },
    modelValue: { type: Object as () => Record<string, any>, required: true },
  },
  emits: ['update:modelValue'],
  setup(p, { emit }) {
    function update(field: string, val: any) {
      emit('update:modelValue', { ...p.modelValue, [field]: val })
    }

    /** 从枚举选项中取出 label/value（兼容 {value,label} / {id,name} 两种后端风格） */
    function optLabel(o: any): string { return String(o?.label ?? o?.name ?? o?.value ?? o?.id ?? '') }
    function optValue(o: any): any { return o?.value ?? o?.id ?? o?.label ?? o?.name }
    function optChildren(o: any): any[] | undefined {
      const c = o?.children ?? o?.childJOptions
      return Array.isArray(c) && c.length ? c : undefined
    }
    function toCascaderOptions(opts: any[]): any[] {
      return opts.filter(Boolean).map((o) => ({
        label: optLabel(o),
        value: optValue(o),
        disabled: !!o.disabled || !!o.obsolete,
        children: optChildren(o) ? toCascaderOptions(optChildren(o)!) : undefined,
      }))
    }

    function renderWidget(w: any): any {
      if (!w || !w.field) return null
      // 容器型控件递归 children（row / group / tabwidget / subtable 等）
      if (w.children?.length) {
        return h('div', { class: 'native-row-group', key: w.id || w.field },
          w.children.map((c: any) => renderWidget(c)).filter(Boolean),
        )
      }
      const field = String(w.field)
      const componentKey = (w.componentKey ?? w.type ?? '').toString()
      const val = p.modelValue?.[field]
      const title = w.title ?? field
      const required = !!w.required
      const placeholder = w.options?.placeholder ?? (
        /select|radio|checkbox|cascader|member|upload|image|switch|date|time/.test(componentKey)
          ? `请选择${title}`
          : `请输入${title}`
      )
      const rawOpts = (w.options?.options as any[]) || []
      const multiple = !!w.options?.multiple

      let ctrl: any
      switch (componentKey) {
        case 'textarea':
        case 'RICH_TEXT':
        case 'TEXT_BOX_MULTILINE':
          ctrl = h(ATextarea, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, rows: 4, style: { width: '100%' } })
          break
        case 'input_number':
        case 'NUMERIC_FIELD':
          ctrl = h(AInputNumber, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, style: { width: '100%' } })
          break
        case 'date_picker':
        case 'DATE_PICKER':
          ctrl = h(ADatePicker, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, style: { width: '100%' } })
          break
        case 'datetime_picker':
        case 'DATE_TIME_PICKER':
          ctrl = h(ADatePicker, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, showTime: true, style: { width: '100%' } })
          break
        case 'time':
          ctrl = h(ATimePicker, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, style: { width: '100%' } })
          break
        case 'select_single':
        case 'SELECT_LIST_SINGLE':
        case 'SPRINT_FIELD':
        case 'radio_group':
        case 'RADIO': {
          const options = rawOpts.filter(Boolean).map((o) => ({ label: optLabel(o), value: optValue(o), disabled: !!o.disabled || !!o.obsolete }))
          if (componentKey === 'RADIO' || componentKey === 'radio_group') {
            ctrl = h(ARadioGroup, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v) }, {
              default: () => options.map((o) => h(ARadio, { key: String(o.value), value: o.value, disabled: o.disabled }, () => o.label)),
            })
          } else {
            ctrl = h(ASelect, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, allowClear: true, style: { width: '100%' } }, {
              default: () => options.map((o) => h(ASelectOption, { key: String(o.value), value: o.value, disabled: o.disabled }, () => o.label)),
            })
          }
          break
        }
        case 'select_multiple':
        case 'SELECT_LIST_MULTIPLE':
        case 'MULTI_SELECT':
        case 'checkbox_group':
        case 'CHECKBOX': {
          const options = rawOpts.filter(Boolean).map((o) => ({ label: optLabel(o), value: optValue(o), disabled: !!o.disabled || !!o.obsolete }))
          if (componentKey === 'CHECKBOX' || componentKey === 'checkbox_group') {
            ctrl = h(ACheckboxGroup, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v) }, {
              default: () => options.map((o) => h(ACheckbox, { key: String(o.value), value: o.value, disabled: o.disabled, style: { marginRight: '16px', marginBottom: '8px' } }, () => o.label)),
            })
          } else {
            ctrl = h(ASelect, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, allowClear: true, mode: 'multiple', style: { width: '100%' } }, {
              default: () => options.map((o) => h(ASelectOption, { key: String(o.value), value: o.value, disabled: o.disabled }, () => o.label)),
            })
          }
          break
        }
        case 'cascader':
        case 'SELECT_LIST_CASCADING': {
          ctrl = h(ACascader, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, options: toCascaderOptions(rawOpts), style: { width: '100%' }, allowClear: true })
          break
        }
        case 'member':
        case 'SELECT_USER_SINGLE':
          ctrl = h(ASelect, {
            value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v),
            placeholder, allowClear: true, mode: multiple ? 'multiple' : undefined, style: { width: '100%' },
          }, {
            default: () => rawOpts.filter(Boolean).map((o) => h(ASelectOption, { key: String(optValue(o)), value: optValue(o) }, () => optLabel(o))),
          })
          break
        case 'switch':
        case 'BOOLEAN':
          ctrl = h(ASwitch, { checked: !!val, 'onUpdate:checked': (v: any) => update(field, v) })
          break
        case 'rich_text':
          ctrl = h(ATextarea, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, rows: 5, style: { width: '100%' } })
          break
        case 'upload':
        case 'ATTACHMENT_FIELD':
          ctrl = h(AUpload, { 'before-upload': () => false }, () => h(AButton, {}, () => '上传附件'))
          break
        case 'image':
          ctrl = h(AUpload, { accept: 'image/*', 'before-upload': () => false, listType: 'picture-card' }, () => h(AButton, {}, () => '上传图片'))
          break
        case 'location':
          ctrl = h(AInput, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, readonly: true, style: { width: '100%' } })
          break
        case 'link':
        case 'LINKS_FIELD':
          ctrl = h(AInput, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, style: { width: '100%' } })
          break
        case 'input_text':
        case 'TEXT_BOX_SINGLE_LINE':
        case 'STRING':
        default:
          ctrl = h(AInput, { value: val ?? undefined, 'onUpdate:value': (v: any) => update(field, v), placeholder, style: { width: '100%' } })
      }
      return h(AFormItem, { key: w.id || field, label: title, required, style: { marginBottom: '12px' } }, () => ctrl)
    }

    return () => h(AForm, { layout: 'vertical', style: { width: '100%' } }, () =>
      p.widgets.map((w) => renderWidget(w)).filter(Boolean),
    )
  },
})
</script>

<style scoped>
.template-preview-modal :deep(.ant-modal-content) { border-radius: 20px; }
.template-preview-modal :deep(.ant-modal-header) { padding: 28px 28px 0; border-bottom: none; }
.template-preview-modal :deep(.ant-modal-title) { font-size: 20px; font-weight: 700; color: #1d1d1f; }
.template-preview-modal :deep(.ant-modal-body) { padding: 20px 28px 28px; }

/* ---- preview ---- */
.preview-section :deep(.ant-tabs-nav) { margin-bottom: 16px; }
.preview-section :deep(.ant-tabs-tab) { font-size: 15px; font-weight: 500; }
.preview-wrap { max-height: 60vh; overflow-y: auto; }
.empty-preview { text-align: center; color: #aeaeb2; padding: 40px 0; }
.preview-mode-bar { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.preview-mode-bar :deep(.ant-radio-button-wrapper) { font-size: 13px; }
.table-toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
</style>
