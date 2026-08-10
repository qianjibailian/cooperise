<template>
  <div class="form-design-page">
    <div v-if="widgetsLoading" class="widgets-loading">
      <a-skeleton active :paragraph="{ rows: 8 }" />
    </div>
    <vxe-form-design
      v-else
      ref="formDesignRef"
      :widgets="formDesignWidgets"
      :form-render="{name: 'MyDesignForm'}"
      height="100%"
      @widget-add="handleWidgetAdd"
    >
      <template #extra>
        <a-button danger @click="clearEvent">清空</a-button>
        <a-button type="primary" @click="saveEvent">保存</a-button>
        <a-button @click="previewEvent">预览</a-button>
        <a-button type="primary" @click="addRecordEvent">新增</a-button>
      </template>
    </vxe-form-design>

    <!-- 预览弹窗 -->
    <a-modal v-model:open="previewVisible" title="表单预览" width="800px" :footer="null" destroy-on-close>
      <div class="preview-container">
        <vxe-form-view v-if="previewFormConfig" :config="previewFormConfig" v-model="previewFormData" />
        <div v-else class="empty-preview">暂无表单配置，请先在左侧设计表单</div>
      </div>
    </a-modal>

    <!-- 新增弹窗 -->
    <a-modal v-model:open="addVisible" title="新增记录" width="600px" @ok="handleAddOk" @cancel="handleAddCancel" destroy-on-close>
      <div class="add-container">
        <div v-if="widgetList.length > 0" class="add-form-preview">
          <div v-for="item in widgetList" :key="item.field" class="preview-field">
              <span class="preview-field-label">
                <span v-if="item.required" class="required-star">*</span>
                {{ item.title }}
              </span>
              <div class="preview-field-control">
                <a-input v-if="getWidgetKind(item.name) === 'input'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" size="small" />
                <a-textarea v-else-if="getWidgetKind(item.name) === 'textarea'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" :rows="item.options?.minRows || 2" />
                <a-input-number v-else-if="getWidgetKind(item.name) === 'input_number' || getWidgetKind(item.name) === 'amount'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" :min="item.options?.min" :max="item.options?.max" :step="item.options?.step" style="width: 100%" size="small" />
                <a-select v-else-if="getWidgetKind(item.name) === 'select_single'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" size="small" style="width: 100%">
                  <a-select-option v-for="opt in item.options?.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
                </a-select>
                <a-select v-else-if="getWidgetKind(item.name) === 'select_multiple'" v-model:value="addFormData[item.field]" mode="multiple" :placeholder="item.options?.placeholder" size="small" style="width: 100%">
                  <a-select-option v-for="opt in item.options?.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
                </a-select>
                <a-radio-group v-else-if="getWidgetKind(item.name) === 'radio_group'" v-model:value="addFormData[item.field]" :options="(item.options?.options || []).map((o: any) => ({ label: o.label, value: o.value }))" />
                <a-checkbox-group v-else-if="getWidgetKind(item.name) === 'checkbox_group'" v-model:value="addFormData[item.field]" :options="(item.options?.options || []).map((o: any) => ({ label: o.label, value: o.value }))" />
                <a-date-picker v-else-if="getWidgetKind(item.name) === 'date_picker'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" size="small" style="width: 100%" />
                <a-date-picker v-else-if="getWidgetKind(item.name) === 'datetime_picker'" v-model:value="addFormData[item.field]" show-time size="small" style="width: 100%" :placeholder="item.options?.placeholder" />
                <a-time-picker v-else-if="getWidgetKind(item.name) === 'time'" v-model:value="addFormData[item.field]" size="small" style="width: 100%" :placeholder="item.options?.placeholder" />
                <div v-else-if="getWidgetKind(item.name) === 'upload_image'" class="preview-image-preview-wrap">
                  <a-upload :file-list="addFormData[item.field]" list-type="picture-card" :before-upload="() => false" :multiple="item.options?.multiple" :max-count="item.options?.limitCount || 9">
                    <div>
                      <PlusOutlined />
                      <div style="margin-top: 8px">上传图片</div>
                    </div>
                  </a-upload>
                </div>
                <a-upload v-else-if="getWidgetKind(item.name) === 'upload_file'" :file-list="addFormData[item.field]" :before-upload="() => false" :multiple="item.options?.multiple" :max-count="item.options?.limitCount || 9">
                  <a-button size="small"><UploadOutlined /> 点击上传</a-button>
                </a-upload>
                <a-input v-else-if="getWidgetKind(item.name) === 'location'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" size="small" readonly>
                  <template #prefix><EnvironmentOutlined /></template>
                </a-input>
                <a-select
                  v-else-if="getWidgetKind(item.name) === 'member'"
                  v-model:value="addFormData[item.field]"
                  :mode="item.options?.multiple ? 'multiple' : undefined"
                  :placeholder="item.options?.placeholder"
                  :allow-clear="item.options?.clearable !== false"
                  size="small"
                  show-search
                  :filter="false"
                  :options="memberOptionsMap[item.field] || []"
                  :field-names="{ label: 'userEnName', value: 'userNo' }"
                  :loading="memberLoadingMap[item.field] || false"
                  @search="(kw: string) => handleMemberSearch(item.field, kw)"
                  style="width: 100%"
                />
                <a-input v-else-if="getWidgetKind(item.name) === 'link'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" size="small">
                  <template #prefix><LinkOutlined /></template>
                </a-input>
                <template v-else-if="getWidgetKind(item.name) === 'rich_text'">
                  <div style="border: 1px solid #d9d9d9; border-radius: 4px; width: 100%">
                    <Toolbar :editor="richEditorInstances[item.field]" :default-config="{}" mode="default" />
                    <Editor
                      v-model="addFormData[item.field]"
                      :default-config="richEditorConfig"
                      mode="default"
                      style="height: 380px; overflow-y: auto"
                      @on-created="(editor: IDomEditor) => handleRichEditorCreated(item.field, editor)"
                    />
                  </div>
                </template>
                <a-cascader
                  v-else-if="getWidgetKind(item.name) === 'cascader'"
                  v-model:value="addFormData[item.field]"
                  :options="item.options?.options || []"
                  :placeholder="item.options?.placeholder"
                  size="small"
                  style="width: 100%"
                />
                <a-input v-else v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" size="small" />
              </div>
            </div>
        </div>
        <div v-else class="empty-preview">暂无表单配置，请先在左侧设计表单</div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, h } from 'vue'
import { VxeUI } from 'vxe-pc-ui'
import {
  PlusOutlined, UploadOutlined, EnvironmentOutlined, LinkOutlined,
} from '@ant-design/icons-vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import type { IDomEditor, IEditorConfig } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import { getTemplate, updateTemplate, listComponents, queryUsers } from '@/api/faiz'
import type { VxeFormDesignInstance, VxeFormDesignPropTypes } from 'vxe-design'
import type { ComponentItem, UserItem } from '@/types/faiz'
// 引入各 widget 的 view/props，用于动态注册"每一条后端组件"为独立 renderer 别名
import CascaderWidgetView from '@/plugins/vxe/formDesign/cascader-widget/CascaderWidgetView.vue'
import CascaderWidgetProps from '@/plugins/vxe/formDesign/cascader-widget/CascaderWidgetProps.vue'
import MemberWidgetView from '@/plugins/vxe/formDesign/member-widget/MemberWidgetView.vue'
import MemberWidgetProps from '@/plugins/vxe/formDesign/member-widget/MemberWidgetProps.vue'
import type { VxeFormDesignDefines } from 'vxe-pc-ui/types/components/form-design'
// 导入各内置 widget 的默认配置工厂，确保别名 renderer 的 options 结构完整（避免 Props 面板读空字段）
import { getFormDesignWidgetInputConfig } from '@/plugins/vxe/formDesign/input-widget/widget'
import { getFormDesignWidgetTextareaConfig } from '@/plugins/vxe/formDesign/textarea-widget/widget'
import { getFormDesignWidgetNumberInputConfig } from '@/plugins/vxe/formDesign/number-input-widget/widget'
import { getFormDesignWidgetSelectConfig } from '@/plugins/vxe/formDesign/select-widget/widget'
import { getFormDesignWidgetDatePickerConfig } from '@/plugins/vxe/formDesign/date-picker-widget/widget'
import { getFormDesignWidgetUploadFileConfig } from '@/plugins/vxe/formDesign/upload-file-widget/widget'
import { getFormDesignWidgetUploadImageConfig } from '@/plugins/vxe/formDesign/upload-image-widget/widget'
import type { FormDesignWidgetCascaderProps } from '@/plugins/vxe/formDesign/cascader-widget/widget'
import type { FormDesignWidgetMemberProps } from '@/plugins/vxe/formDesign/member-widget/widget'

const formDesignRef = ref<VxeFormDesignInstance>()

const previewVisible = ref(false)
const addVisible = ref(false)

const previewFormConfig = ref<any>(null)
const addFormData = reactive<Record<string, any>>({})

const LAYOUT_WIDGETS = ['title', 'row', 'subtable', 'TabWidget']
const SYSTEM_WIDGETS = ['CreateByWidget', 'UpdateByWidget', 'CreateTimeWidget', 'UpdateTimeWidget']

// componentKey → vxe-form-design widget name 的映射关系
// 注意：select_single / select_multiple 共用同一个 SelectWidget（通过 multiple 选项区分）
const COMPONENT_KEY_TO_WIDGET: Record<string, string> = {
  input_text: 'InputWidget',
  textarea: 'TextareaWidget',
  input_number: 'NumberInputWidget',
  select_single: 'SelectWidget',
  select_multiple: 'SelectWidget',
  date_picker: 'DateDatePickerWidget',
  rich_text: 'WangEditorWidget',
  upload: 'UploadFileWidget',
  image: 'UploadImageWidget',
  member: 'MemberWidget',
  cascader: 'CascaderWidget',
}

// 已动态注册的 renderer name 集合（避免重复注册）
const registeredRenderers = new Set<string>()
// componentId → 后端原始 ComponentItem 映射（widget-add 时二次校验兜底用）
const componentMapById = new Map<number, ComponentItem>()

/** 解析组件的 configSchema（JSON 字符串）为对象 */
function parseConfigSchema(raw: string | null | undefined): unknown {
  if (!raw || typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * 根据后端 ComponentItem，构造 vxe renderer 的 createFormDesignWidgetConfig 返回值：
 * - title 取 name（如"计划开始日期"、"经办人"…）
 * - required 取 required 字段
 * - options 根据 componentKey 注入 configSchema 解析出的枚举值
 */
function buildWidgetConfigFromComponent(item: ComponentItem) {
  return (): any => {
    const k = item.componentKey
    // 1. 先从对应 widget 的默认配置工厂拿完整 options（结构齐全）
    let baseCfg: any
    switch (k) {
      case 'input_text':
        baseCfg = getFormDesignWidgetInputConfig()
        break
      case 'textarea':
        baseCfg = getFormDesignWidgetTextareaConfig()
        break
      case 'input_number':
        baseCfg = getFormDesignWidgetNumberInputConfig()
        break
      case 'select_single':
      case 'select_multiple':
        baseCfg = getFormDesignWidgetSelectConfig()
        break
      case 'date_picker':
      case 'datetime_picker':
        baseCfg = getFormDesignWidgetDatePickerConfig()
        break
      case 'upload':
        baseCfg = getFormDesignWidgetUploadFileConfig()
        break
      case 'image':
        baseCfg = getFormDesignWidgetUploadImageConfig()
        break
      case 'member': {
        const opt: Required<FormDesignWidgetMemberProps> = {
          placeholder: '请搜索并选择成员', clearable: true, multiple: true,
        }
        baseCfg = { options: opt }
        break
      }
      case 'cascader': {
        const opt: Required<FormDesignWidgetCascaderProps> & { options: any[] } = {
          placeholder: '请选择', clearable: true, options: [],
        }
        baseCfg = { options: opt }
        break
      }
      case 'rich_text':
      default:
        baseCfg = { options: { placeholder: '请输入内容' } }
        break
    }

    const schema = parseConfigSchema(item.configSchema)
    const opts: any = { ...(baseCfg.options || {}) }

    // 2. 再用后端组件数据中的业务字段覆盖/补充
    switch (k) {
      case 'member':
        opts.placeholder = `请选择${item.name}`
        break
      case 'cascader':
        opts.placeholder = `请选择${item.name}`
        opts.options = Array.isArray(schema) ? schema : opts.options
        break
      case 'select_single':
      case 'select_multiple':
        opts.placeholder = `请选择${item.name}`
        opts.multiple = k === 'select_multiple'
        if (Array.isArray(schema) && schema.length > 0) {
          // 兼容 {label,value} 和只有 value 的格式
          opts.options = schema.map((s: any) => ({
            value: String(s.value ?? s.label ?? ''),
            label: String(s.label ?? s.value ?? ''),
          }))
        }
        break
      case 'rich_text':
        opts.placeholder = item.description || `请输入${item.name}`
        break
      case 'input_text':
      case 'textarea':
      case 'input_number':
        opts.placeholder = `请输入${item.name}`
        break
      case 'date_picker':
      case 'datetime_picker':
        opts.placeholder = `请选择${item.name}`
        break
      default:
        opts.placeholder = opts.placeholder || item.description || `请选择/输入${item.name}`
        break
    }

    const base: any = {
      title: item.name || item.componentKey,
      field: () => `component_${item.id}_${item.componentKey}`,
      // 保留基础 widget 原有的 icon
      icon: baseCfg.icon,
      options: opts,
    }
    return base
  }
}

/**
 * 为一条后端组件注册一个独立的 renderer 别名
 * - 对于 MemberWidget / CascaderWidget：直接复用对应的 View / Props 组件
 * - 对于 InputWidget / SelectWidget 等内置 renderer：直接挂字符串别名（vxe 内部会通过 name 查找原始 renderer）
 */
function registerRendererForComponent(item: ComponentItem): string {
  const rendererName = `Comp_${item.id}_${item.componentKey}`
  if (registeredRenderers.has(rendererName)) return rendererName

  const baseWidgetName = COMPONENT_KEY_TO_WIDGET[item.componentKey]
  const createConfig = buildWidgetConfigFromComponent(item)

  if (item.componentKey === 'cascader') {
    VxeUI.renderer.add(rendererName, {
      createFormDesignWidgetConfig: createConfig,
      renderFormDesignWidgetView(renderOpts, renderParams) {
        return h(CascaderWidgetView, { renderOpts, renderParams })
      },
      renderFormDesignWidgetFormView(renderOpts, renderParams) {
        return h(CascaderWidgetProps, { renderOpts, renderParams })
      },
    })
  } else if (item.componentKey === 'member') {
    VxeUI.renderer.add(rendererName, {
      createFormDesignWidgetConfig: createConfig,
      renderFormDesignWidgetView(renderOpts, renderParams) {
        return h(MemberWidgetView, { renderOpts, renderParams })
      },
      renderFormDesignWidgetFormView(renderOpts, renderParams) {
        return h(MemberWidgetProps, { renderOpts, renderParams })
      },
    })
  } else if (baseWidgetName) {
    // 内置 renderer：拿基础 renderer 的 options 复用，只覆盖 config 工厂
    const baseRenderer = VxeUI.renderer.get(baseWidgetName) || {}
    VxeUI.renderer.add(rendererName, {
      ...baseRenderer,
      createFormDesignWidgetConfig: createConfig,
    } as any)
  }

  registeredRenderers.add(rendererName)
  componentMapById.set(item.id, item)
  return rendererName
}

const collectWidgetFields = (widgets: any[], result: any[]) => {
  widgets.forEach((w: any) => {
    if (LAYOUT_WIDGETS.includes(w.name)) {
      if (w.children) {
        collectWidgetFields(w.children, result)
      }
    } else if (SYSTEM_WIDGETS.includes(w.name)) {
      // skip system widgets
    } else if (w.field) {
      result.push(w)
    }
  })
}

const widgetList = computed(() => {
  if (previewFormConfig.value && previewFormConfig.value.widgetData) {
    const result: any[] = []
    collectWidgetFields(previewFormConfig.value.widgetData, result)
    // 只在 widgetList 结构（field 集合）变化时打一次"完整映射表"日志，避免每次 re-render 刷屏
    const signature = result.map(r => `${r.field}|${r.name}|${r.title}`).join('||')
    if (!__debugLastWidgetListSnapshot.has(signature)) {
      __debugLastWidgetListSnapshot.clear()
      __debugLastWidgetListSnapshot.add(signature)
      __resetRenderHitCache() // 结构重算时清空分支命中缓存，让每个分支再打一次首次命中日志
      __log('group', `🚀 widgetList 重算 (共 ${result.length} 个) — 映射关系总表`)
      if (result.length > 0) {
        try {
          __log('table', result.map(flattenWidgetRow))
        } catch {
          // fallback：老浏览器不支持 console.table
          __log('debug', `widgetList items:`, result.map(flattenWidgetRow))
        }
      }
      const unknowns = result.filter(r => getWidgetKind(r.name) === 'unknown')
      if (unknowns.length > 0) {
        __log('warn', `⚠️ 有 ${unknowns.length} 个 widget 无法识别 kind（会走 fallback a-input）`, unknowns.map((u: any) => ({ name: u.name, title: u.title, field: u.field })))
      } else {
        __log('debug', `✅ 所有 widget 均识别到 kind（无 unknown 回落）`)
      }
      __log('groupEnd', '')
    }
    return result
  }
  // 配置清空时同步清空缓存快照
  if (__debugLastWidgetListSnapshot.size > 0) {
    __debugLastWidgetListSnapshot.clear()
    __log('debug', `widgetList → 清空（previewFormConfig 为空或 widgetData 不存在）`)
  }
  return []
})

const previewFormData = ref<Record<string, any>>({})

// ---- 新增弹窗中 MemberWidget 的远程搜索（按 field 维度独立状态，支持同时多个成员字段）
const memberOptionsMap = reactive<Record<string, UserItem[]>>({})
const memberLoadingMap = reactive<Record<string, boolean>>({})
const memberSearchTimers = reactive<Record<string, ReturnType<typeof setTimeout> | null>>({})
function handleMemberSearch(field: string, keyword: string) {
  __log('log', `Member 搜索触发 | field=${field} | keyword="${keyword}" | 防抖 300ms 开始`)
  if (memberSearchTimers[field]) clearTimeout(memberSearchTimers[field]!)
  memberSearchTimers[field] = setTimeout(async () => {
    memberLoadingMap[field] = true
    __log('debug', `Member 搜索请求 | field=${field} payload=`, { keyword, isActive: 1, page: 1, pageSize: 20 })
    try {
      const t0 = performance.now()
      const res = await queryUsers({ keyword, isActive: 1, page: 1, pageSize: 20 })
      const cost = Math.round(performance.now() - t0)
      if (res.success && res.data) {
        const list = res.data.list || []
        memberOptionsMap[field] = list
        __log('log', `Member 搜索成功 | field=${field} | cost=${cost}ms | 返回条数=${list.length} | 前5条userEnName=`, list.slice(0, 5).map((u: any) => u.userEnName))
      } else {
        memberOptionsMap[field] = []
        __log('warn', `Member 搜索返回失败 | field=${field} | cost=${cost}ms`, { message: res.message, success: res.success })
      }
    } catch (e: any) {
      memberOptionsMap[field] = []
      __log('error', `Member 搜索异常 | field=${field}`, e?.message || e)
    } finally {
      memberLoadingMap[field] = false
    }
  }, 300)
}

const widgetsLoading = ref(true)

// 控件分组（children 根据后端返回的组件列表动态注册独立 renderer）
const controlGroup = ref<VxeFormDesignPropTypes.Widgets[number]>({
  customGroup: '控件',
  children: [] as string[],
})

const formDesignWidgets = computed<VxeFormDesignPropTypes.Widgets>(() => [
  controlGroup.value,
])

/**
 * 把 widget.name 归一化为统一的"类型 kind"字符串，用于预览/新增弹窗的模板渲染。
 * 支持两种命名：
 *   - 基础 renderer 名：InputWidget / NumberInputWidget / SelectWidget / ...
 *   - 别名 renderer 名：Comp_{id}_{componentKey}（componentKey 与映射表里 key 相同）
 */
type WidgetKind = 'input' | 'textarea' | 'input_number' | 'amount'
  | 'date_picker' | 'datetime_picker' | 'time'
  | 'select_single' | 'select_multiple' | 'radio_group' | 'checkbox_group'
  | 'upload_file' | 'upload_image'
  | 'rich_text' | 'member' | 'cascader'
  | 'location' | 'link'
  | 'unknown'

// renderer 基础名 → kind
const BASE_NAME_TO_KIND: Record<string, WidgetKind> = {
  InputWidget: 'input',
  TextareaWidget: 'textarea',
  NumberInputWidget: 'input_number',
  AmountInputWidget: 'amount',
  DateDatePickerWidget: 'date_picker',
  SelectWidget: 'select_single',
  UploadFileWidget: 'upload_file',
  UploadImageWidget: 'upload_image',
  WangEditorWidget: 'rich_text',
  MemberWidget: 'member',
  CascaderWidget: 'cascader',
}

// componentKey → kind（别名 renderer 里的 componentKey）
const COMPONENT_KEY_TO_KIND: Record<string, WidgetKind> = {
  input_text: 'input',
  textarea: 'textarea',
  input_number: 'input_number',
  select_single: 'select_single',
  select_multiple: 'select_multiple',
  radio_group: 'radio_group',
  checkbox_group: 'checkbox_group',
  date_picker: 'date_picker',
  datetime_picker: 'datetime_picker',
  time: 'time',
  upload: 'upload_file',
  image: 'upload_image',
  rich_text: 'rich_text',
  member: 'member',
  cascader: 'cascader',
  location: 'location',
  link: 'link',
}

function getWidgetKind(name: string | undefined | null): WidgetKind {
  if (!name) return 'unknown'
  if (BASE_NAME_TO_KIND[name]) return BASE_NAME_TO_KIND[name]
  const m = /^Comp_\d+_([a-zA-Z0-9_]+)$/.exec(name)
  if (m && COMPONENT_KEY_TO_KIND[m[1]]) return COMPONENT_KEY_TO_KIND[m[1]]
  __log('warn', `getWidgetKind 无法识别 widget.name → fallback unknown`, { name })
  return 'unknown'
}
// ---- 富文本编辑器实例管理 ----
const richEditorInstances = reactive<Record<string, IDomEditor | null>>({})

const richEditorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入富文本内容',
  scroll: false,
  MENU_CONF: {},
}

function handleRichEditorCreated(fieldId: string, editor: IDomEditor) {
  richEditorInstances[fieldId] = editor
}

function destroyRichEditors() {
  Object.entries(richEditorInstances).forEach(([key, inst]) => {
    if (inst && typeof inst.destroy === 'function') {
      try { inst.destroy() } catch {}
    }
    delete richEditorInstances[key]
  })
}

const __DEBUG_FORM_ADD__ = true // 关闭后所有新增记录弹窗相关日志不再输出
const __DEBUG_TAG__ = '[FormAdd] '
const __debugLastWidgetListSnapshot = new Set<string>() // 用于只在 widgetList 变化时输出差异

/** 打日志（受开关控制） */
function __log(level: 'log' | 'warn' | 'error' | 'debug' | 'table' | 'group' | 'groupEnd', ...args: any[]) {
  if (!__DEBUG_FORM_ADD__) return
  if (level === 'table') {
    console.debug(`${__DEBUG_TAG__}--------------------- console.table ---------------------`)
    ;(console as any).table(args[0])
    return
  }
  if (level === 'group' || level === 'groupEnd') {
    ;(console as any)[level](__DEBUG_TAG__ + (args[0] || ''))
    return
  }
  ;(console as any)[level](__DEBUG_TAG__, ...args)
}

/** 生成 options 的"可读摘要"，避免 console.log 把整棵级联树/枚举数组刷屏 */
function summarizeOptions(options: any, kind: WidgetKind): Record<string, any> {
  if (!options || typeof options !== 'object') return { raw: options }
  const out: Record<string, any> = {}
  for (const k of Object.keys(options)) {
    const v = (options as any)[k]
    if (k === 'options' && Array.isArray(v)) {
      // 级联：展示第一层节点数 + 层级；下拉：展示 {label,value} 条目数
      if (kind === 'cascader') {
        out['options.length'] = v.length
        const level2 = v.reduce((acc: number, node: any) => acc + (Array.isArray(node.children) ? node.children.length : 0), 0)
        const level3 = v.reduce((acc: number, n1: any) => {
          if (!Array.isArray(n1.children)) return acc
          return acc + n1.children.reduce((a: number, n2: any) => a + (Array.isArray(n2.children) ? n2.children.length : 0), 0)
        }, 0)
        out['options.treeDepth'] = level3 > 0 ? 3 : level2 > 0 ? 2 : 1
        out['options.level1Sample'] = v.slice(0, 5).map((n: any) => n.label ?? n.value)
      } else if (kind === 'select_single' || kind === 'select_multiple') {
        out['options.length'] = v.length
        out['options.sample'] = v.slice(0, 10).map((o: any) => ({ label: o.label, value: o.value }))
      } else {
        out['options.length'] = v.length
      }
    } else if (typeof v === 'object' && v !== null) {
      // 其他 object（如 controlConfig）浅展开摘要
      out[k] = { ...v }
    } else {
      out[k] = v
    }
  }
  return out
}

/** 把一个 widget item 拍平成一行，用于 console.table 的行 */
function flattenWidgetRow(item: any) {
  const kind = getWidgetKind(item.name)
  return {
    field: item.field,
    title: item.title,
    widgetName: item.name,
    componentKey: (() => {
      const m = /^Comp_\d+_([a-zA-Z0-9_]+)$/.exec(item.name || '')
      return m ? m[1] : '—'
    })(),
    kind,
    required: !!item.required,
    visible: item.visible !== false,
    placeholder: item.options?.placeholder ?? '—',
    optionsSummary: JSON.stringify(summarizeOptions(item.options, kind)),
  }
}

// 记录每个 field 最后一次命中分支时的 kind（避免每次 re-render 刷屏，仅 kind 变化或首次才打）
const __debugLastHitKind = new Map<string, WidgetKind>()

/** 在模板每次 v-for 渲染某个 widget 分支时被调用：记录命中了哪种 kind，仅在有变化时输出日志 */
function traceRenderHit(item: any): any {
  const field = item?.field
  const kind = getWidgetKind(item?.name)
  if (!field) return item
  const last = __debugLastHitKind.get(field)
  if (last !== kind) {
    if (last === undefined) {
      // 首次命中
      __log('log', `🎯 渲染分支首次命中 → field=${field} title="${item.title}" kind=${kind} widgetName=${item.name}`)
    } else {
      __log('warn', `⚠️ kind 发生变化（可能有问题）→ field=${field} title="${item.title}" 上一次kind=${last} 当前kind=${kind} widgetName=${item.name}`)
    }
    __debugLastHitKind.set(field, kind)
  }
  return item
}

// 清空 trace 缓存（在 widgetList 结构整体重算时触发一次）
function __resetRenderHitCache() {
  __debugLastHitKind.clear()
}

/**
 * widget 新增事件：将后端 required 字段同步到 widget.required（因为 createFormDesignWidgetConfig
 * 返回值没有直接的 required 字段，required 是 WidgetObjItem 级别的属性），作为保险兜底。
 */
function handleWidgetAdd(params: VxeFormDesignDefines.WidgetAddEventParams) {
  const newWidget = params.newWidget as any
  // Comp_31_member → 31
  const m = /^Comp_(\d+)_/.exec(newWidget.name || '')
  if (m) {
    const compId = Number(m[1])
    const comp = componentMapById.get(compId)
    if (comp) {
      newWidget.required = comp.required === 1
      // 再次保证 options 存在（极端情况下如果 createFormDesignWidgetConfig 未执行）
      if (!newWidget.options || typeof newWidget.options !== 'object') {
        const createCfg = buildWidgetConfigFromComponent(comp)()
        newWidget.options = createCfg.options || {}
      }
    }
  }
}

// 调用不分页接口 /component/list 获取组件列表
async function loadEnabledComponents() {
  widgetsLoading.value = true
  try {
    const res = await listComponents({
      keyword: '',
      status: 1,
    })
    const list: ComponentItem[] = (res.success && res.data) || []
    // 方式 A：每条后端组件都注册为独立 renderer → 左侧展示 8 个独立控件（推荐，用户要求"组件列表数据展示出来"）
    if (list.length > 0) {
      const children: string[] = []
      list.forEach((item) => {
        const rendererName = registerRendererForComponent(item)
        children.push(rendererName)
      })
      controlGroup.value.children = children
    } else {
      // 方式 B（fallback）：按 componentKey 聚合去重 → 显示控件类型
      const widgetSet = new Set<string>()
      list.forEach((item) => {
        const wName = COMPONENT_KEY_TO_WIDGET[item.componentKey]
        if (wName) widgetSet.add(wName)
      })
      controlGroup.value.children = Array.from(widgetSet)
    }
  } catch (e) {
    console.error('加载启用组件列表失败：', e)
    controlGroup.value.children = []
  } finally {
    widgetsLoading.value = false
  }
}

onMounted(async () => {
  await loadEnabledComponents()
  // 等待 vxe-form-design 组件渲染完成
  await nextTick()
  const $formDesign = formDesignRef.value
  if ($formDesign) {
    const defData = localStorage.getItem('DATA_FormDesignEdit')
    let defJson = { formConfig: { title: '', pcVisible: true, pcVertical: true, pcTitleBold: true, pcTitleColon: false, pcTitleAlign: '', pcTitleWidth: '', pcTitleWidthUnit: '', mobileVisible: false, mobileVertical: true, mobileTitleBold: true, mobileTitleColon: false, mobileTitleAlign: '', mobileTitleWidth: '', mobileTitleWidthUnit: '' }, widgetData: [] }
    if (defData) {
      try {
        defJson = JSON.parse(defData)
      } catch (e) {
        console.error(e)
      }
    }
    $formDesign.loadConfig(defJson)
  }
})

const clearEvent = () => {
  const $formDesign = formDesignRef.value
  if ($formDesign) {
    $formDesign.clearConfig()
  }
  localStorage.removeItem('DATA_FormDesignEdit')
}

const countWidgets = (widgets: any[]): number => {
  let count = 0
  widgets.forEach((w: any) => {
    count++
    if (w.children && w.children.length > 0) {
      count += countWidgets(w.children)
    }
  })
  return count
}

const generateId = (): string => {
  return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)
}

const formatNow = (): string => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

// ---- 本地存储工具函数 ----
const STORAGE_KEY = 'TEMPLATE_LIST'

const syncLocalTemplateList = (flag: { templateId: string | number; tabId: string | number; tabIdx: number }, config: any) => {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY)
    const templateList = existingData ? JSON.parse(existingData) : []
    const now = formatNow()
    if (flag.templateId && flag.templateId !== 'NEW') {
      const tpl = templateList.find((t: any) => t.id === flag.templateId)
      if (tpl) {
        const tab = tpl.tabs?.find((tb: any) => tb.id === flag.tabId)
        if (tab) {
          tab.formConfig = config.formConfig
          tab.widgetData = config.widgetData
          tab.name = tab.name || config.formConfig?.title || `表单 ${flag.tabIdx + 1}`
          tpl.updatedAt = now
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templateList))
      }
    }
  } catch (e) {
    console.error('同步 localStorage 失败:', e)
  }
}

const syncNewTemplateToLocal = (config: any) => {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY)
    const templateList = existingData ? JSON.parse(existingData) : []
    const now = formatNow()
    const tabId = generateId()
    templateList.push({
      id: generateId(),
      templateName: config.formConfig?.title || '未命名模板',
      description: '',
      category: 'other',
      status: true,
      tabs: [{ id: tabId, name: config.formConfig?.title || '未命名表单', formConfig: config.formConfig, widgetData: config.widgetData }],
      createdAt: now,
      updatedAt: now,
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templateList))
  } catch (e) {
    console.error('创建本地模板失败:', e)
  }
}

// ---- 保存 ----
const saveEvent = async () => {
  const $formDesign = formDesignRef.value
  if (!$formDesign) return

  const config = $formDesign.getConfig()
  console.log('【保存模板】请求体:', JSON.stringify(config, null, 2))
  localStorage.setItem('DATA_FormDesignEdit', JSON.stringify(config))

  const flagData = localStorage.getItem('TEMPLATE_EDIT_FLAG')

  if (flagData) {
    const flag = JSON.parse(flagData)

    if (flag.templateId && flag.templateId !== 'NEW') {
      // 已有模板：调用后端接口更新
      try {
        const res = await getTemplate(flag.templateId)
        if (!res.success || !res.data) {
          VxeUI.modal.message({ content: res.message || '获取模板信息失败', status: 'error' })
          return
        }

        const template = res.data
        // 优先用 tabIdx 索引匹配，再用 tabId 兜底
        const tab = template.tabs?.[flag.tabIdx] ?? template.tabs?.find((tb: any) => String(tb.id) === String(flag.tabId))
        if (!tab) {
          console.error('Tab not found:', { templateId: flag.templateId, tabId: flag.tabId, tabIdx: flag.tabIdx, tabs: template.tabs })
          VxeUI.modal.message({ content: '未找到对应的表单 Tab', status: 'error' })
          return
        }

        // 更新当前 Tab 的配置
        tab.formConfig = JSON.stringify(config.formConfig)
        tab.widgetData = JSON.stringify(config.widgetData)
        if (config.formConfig?.title) {
          tab.name = config.formConfig.title
        }

        // 构造更新数据（与 template-list serializeTemplatePayload 格式一致）
        const data = {
          templateName: template.templateName,
          description: template.description,
          category: template.category,
          status: template.status,
          tabs: template.tabs.map((t: any, idx: number) => ({
            name: t.name,
            tabOrder: t.tabOrder ?? idx + 1,
            formConfig: typeof t.formConfig === 'string' ? t.formConfig : JSON.stringify(t.formConfig || {}),
            widgetData: typeof t.widgetData === 'string' ? t.widgetData : JSON.stringify(t.widgetData || []),
          })),
        }

        const updateRes = await updateTemplate(flag.templateId, data)
        if (updateRes.success) {
          VxeUI.modal.message({ content: '保存成功', status: 'success' })
        } else {
          VxeUI.modal.message({ content: updateRes.message || '保存失败', status: 'error' })
          return
        }
      } catch (e: any) {
        console.error('保存模板失败:', e)
        VxeUI.modal.message({ content: e?.message || '保存失败，请重试', status: 'error' })
        return
      }

      // 同步更新 localStorage
      syncLocalTemplateList(flag, config)
      localStorage.removeItem('TEMPLATE_EDIT_FLAG')
      return
    }

    // NEW 模板：暂存到 localStorage，等模板列表保存时提交后端
    syncLocalTemplateList(flag, config)
    localStorage.removeItem('TEMPLATE_EDIT_FLAG')
    VxeUI.modal.message({ content: '保存成功（请回到模板列表提交保存）', status: 'success' })
  } else {
    // 无 flag：新建模板到 localStorage
    syncNewTemplateToLocal(config)
    VxeUI.modal.message({ content: '保存成功（新建模板）', status: 'success' })
  }
}

const initFormData = (widgets: any[], data: Record<string, any>) => {
  widgets.forEach((w: any) => {
    if (w.children) {
      initFormData(w.children, data)
    } else if (w.field) {
      data[w.field] = null
    }
  })
}

const previewEvent = () => {
  const $formDesign = formDesignRef.value
  if ($formDesign) {
    const config = $formDesign.getConfig()
    if (config.widgetData && config.widgetData.length > 0) {
      previewFormConfig.value = config
      const data: Record<string, any> = {}
      initFormData(config.widgetData, data)
      previewFormData.value = data
      previewVisible.value = true
    } else {
      VxeUI.modal.message({
        content: '请先设计表单',
        status: 'warning'
      })
    }
  }
}

const addRecordEvent = () => {
  __log('group', `🟢 打开「新增记录」弹窗 addRecordEvent() 触发`)
  const $formDesign = formDesignRef.value
  if (!$formDesign) {
    __log('warn', `formDesignRef.value is falsy，中止打开弹窗`)
    __log('groupEnd', '')
    return
  }
  const config = $formDesign.getConfig()
  __log('debug', `读取 vxe-form-design getConfig() → widgetData 个数=${config.widgetData?.length ?? 0}`)
  if (config.widgetData && config.widgetData.length > 0) {
    previewFormConfig.value = config
    Object.keys(addFormData).forEach(key => delete addFormData[key])
    const data: Record<string, any> = {}
    initFormData(config.widgetData, data)
    Object.assign(addFormData, data)
    // 顺便 dump 初始化默认值（每个 field 初始值是什么）
    __log('debug', `新增记录 addFormData 初始化字段数=${Object.keys(data).length}，内容快照：`, Object.fromEntries(
      Object.entries(data).map(([k, v]) => {
        if (Array.isArray(v)) return [k, `Array[${v.length}]`]
        if (v && typeof v === 'object') return [k, `Object(${JSON.stringify(v).slice(0, 80)})`]
        return [k, v]
      })
    ))
    addVisible.value = true
    __log('log', `✅ 新增记录弹窗已打开 (字段数=${widgetList.value.length})`)
  } else {
    __log('warn', `⚠️ widgetData 为空 → 提示"请先设计表单"`)
    VxeUI.modal.message({
      content: '请先设计表单',
      status: 'warning'
    })
  }
  __log('groupEnd', '')
}

const handleAddOk = () => {
  __log('group', `🟦 用户点击新增记录弹窗「确定」handleAddOk()`)
  __log('log', `提交的 addFormData（共 ${Object.keys(addFormData).length} 个字段）：`, JSON.parse(JSON.stringify(addFormData)))
  // 校验必填项（简单版：required && value 为空即 warn）
  const missing = widgetList.value.filter((w: any) => {
    if (!w.required) return false
    const v = addFormData[w.field]
    if (Array.isArray(v)) return v.length === 0
    return v == null || v === ''
  })
  if (missing.length > 0) {
    __log('warn', `以下必填字段为空 → 注意业务后端校验：`, missing.map(m => ({ field: m.field, title: m.title, kind: getWidgetKind(m.name) })))
  } else {
    __log('debug', `✅ 所有必填字段均有值`)
  }
  console.log('表单数据：', addFormData)
  VxeUI.modal.message({
    content: '提交成功',
    status: 'success'
  })
  addVisible.value = false
  __log('groupEnd', '')
}

const handleAddCancel = () => {
  __log('log', `用户取消新增记录弹窗 handleAddCancel() → 当前已填字段=${Object.keys(addFormData).filter(k => {
    const v = addFormData[k]; return !(v == null || v === '' || (Array.isArray(v) && v.length === 0))
  }).length} 个`)
  destroyRichEditors()
  addVisible.value = false
}
</script>

<style scoped>
.form-design-page {
  width: 100%;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.widgets-loading {
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.preview-container,
.add-container {
  max-height: 60vh;
  overflow-y: auto;
}

.empty-preview {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

/* 新增记录弹窗：预览/表单对齐组件列表预览结构 */
.add-form-preview { display: flex; flex-direction: column; gap: 16px; padding: 4px 4px 4px 0; }
.preview-field { display: flex; align-items: flex-start; gap: 12px; }
.preview-field-label { font-size: 13px; color: #1d1d1f; font-weight: 500; line-height: 28px; flex-shrink: 0; width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; align-items: center; gap: 2px; }
.required-star { color: #ff4d4f; font-weight: 600; }
.preview-field-control { flex: 1; min-width: 0; }
.preview-field-control :deep(.ant-checkbox-wrapper),
.preview-field-control :deep(.ant-radio-wrapper) { font-size: 13px; }
.preview-image-preview-wrap { display: inline-block; }
.preview-rich { border: 1px solid #e5e5ea; border-radius: 6px; overflow: hidden; }
.preview-rich :deep(.vxe-wang-editor--toolbar) { border-bottom: 1px solid #e5e5ea; }
</style>
