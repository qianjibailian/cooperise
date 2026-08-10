<template>
  <div>
    <vxe-form
      vertical
      title-bold
      title-overflow
      span="24"
      :data="safeOptions">
      <vxe-form-item title="控件字段名" :title-prefix="{icon: 'vxe-icon-question-circle-fill', content: '唯一字段名，默认自动生成'}">
        <vxe-input v-model="currWidget.field" placeholder="唯一，默认自动生成"></vxe-input>
      </vxe-form-item>
      <vxe-form-item title="控件名称">
        <vxe-input v-model="currWidget.title"></vxe-input>
      </vxe-form-item>
      <vxe-form-item title="是否必填">
        <vxe-switch v-model="currWidget.required"></vxe-switch>
      </vxe-form-item>
      <vxe-form-item title="空值占位提示">
        <vxe-input v-model="safeOptions.placeholder"></vxe-input>
      </vxe-form-item>
      <vxe-form-item title="显示清除按钮">
        <vxe-switch v-model="safeOptions.clearable"></vxe-switch>
      </vxe-form-item>
      <vxe-form-item title="级联选项 JSON">
        <vxe-textarea
          v-model="optionsJsonText"
          :auto-size="{ minRows: 4, maxRows: 10 }"
          placeholder='[{ "label": "一级", "value": "lv1", "children": [{ "label": "二级", "value": "lv2" }] }]'
          @change="applyOptionsJson">
        </vxe-textarea>
        <div v-if="optionsJsonError" class="json-error-tip">{{ optionsJsonError }}</div>
      </vxe-form-item>
    </vxe-form>
  </div>
</template>

<script lang="ts" setup>
import { computed, PropType, ref, watch } from 'vue'
import { VxeGlobalRendererHandles } from 'vxe-pc-ui'
import { FormDesignWidgetCascaderProps, CascaderOptionItem } from './widget'

const props = defineProps({
  renderOpts: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewOptions>,
    default: () => ({})
  },
  renderParams: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewParams<FormDesignWidgetCascaderProps>>,
    default: () => ({})
  }
})

const currWidget = computed(() => {
  const { renderParams } = props
  return renderParams.widget
})

// 保证 currWidget.value.options 结构完整，避免 undefined 访问异常
function ensureOptions(): Required<FormDesignWidgetCascaderProps> {
  if (!currWidget.value) {
    return { placeholder: '请选择', clearable: true, options: [] }
  }
  if (!currWidget.value.options || typeof currWidget.value.options !== 'object') {
    currWidget.value.options = { placeholder: '请选择', clearable: true, options: [] }
  }
  const opts = currWidget.value.options as Partial<FormDesignWidgetCascaderProps>
  if (typeof opts.placeholder !== 'string') opts.placeholder = '请选择'
  if (typeof opts.clearable !== 'boolean') opts.clearable = true
  if (!Array.isArray(opts.options)) opts.options = []
  return opts as Required<FormDesignWidgetCascaderProps>
}

const safeOptions = computed<Required<FormDesignWidgetCascaderProps>>(() => ensureOptions())

const optionsJsonText = ref('')
const optionsJsonError = ref('')

// 递归规范化 options 树
function cloneOptionsTree(list: CascaderOptionItem[]): CascaderOptionItem[] {
  return list
    .filter(o => o && (o.label || o.value))
    .map(o => {
      const node: CascaderOptionItem = {
        label: String(o.label ?? ''),
        value: String(o.value ?? ''),
      }
      if (Array.isArray(o.children) && o.children.length) {
        const cloned = cloneOptionsTree(o.children)
        if (cloned.length) node.children = cloned
      }
      return node
    })
}

// 初始化时把 currWidget.options.options 转成 JSON 文本
function syncOptionsToText() {
  try {
    const opts = safeOptions.value.options
    if (Array.isArray(opts)) {
      optionsJsonText.value = JSON.stringify(opts, null, 2)
    } else {
      optionsJsonText.value = '[]'
    }
    optionsJsonError.value = ''
  } catch {
    optionsJsonText.value = '[]'
  }
}

syncOptionsToText()

// 当 options 发生变化（比如从接口加载后），同步文本
watch(
  () => safeOptions.value.options,
  () => {
    syncOptionsToText()
  },
  { deep: true }
)

function applyOptionsJson() {
  try {
    const raw = optionsJsonText.value.trim() || '[]'
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      optionsJsonError.value = '必须是数组结构'
      return
    }
    safeOptions.value.options = cloneOptionsTree(parsed as CascaderOptionItem[])
    optionsJsonError.value = ''
  } catch (e: any) {
    optionsJsonError.value = 'JSON 格式不正确：' + (e?.message || String(e))
  }
}
</script>

<style scoped>
.json-error-tip {
  color: #ff4d4f;
  font-size: 12px;
  margin-top: 4px;
}
</style>
