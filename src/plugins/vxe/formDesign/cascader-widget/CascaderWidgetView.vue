<template>
  <vxe-form-item :field="currWidget.field" :title="currWidget.title">
    <a-cascader
      v-model:value="widgetModelValue"
      :options="cascaderOptions"
      :placeholder="widgetOpts.placeholder"
      :allow-clear="widgetOpts.clearable !== false"
      style="width: 100%"
    />
  </vxe-form-item>
</template>

<script lang="ts" setup>
import { PropType, computed } from 'vue'
import { VxeUI, VxeGlobalRendererHandles } from 'vxe-pc-ui'
import { FormDesignWidgetCascaderProps, CascaderOptionItem } from './widget'

const { useWidgetView } = VxeUI.formDesignHandle

const props = defineProps({
  renderOpts: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetViewOptions>,
    default: () => ({})
  },
  renderParams: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetViewParams<FormDesignWidgetCascaderProps>>,
    default: () => ({})
  }
})

const { currWidget, widgetModel } = useWidgetView<FormDesignWidgetCascaderProps>(props)

// 数据兜底：把 currWidget.options 整个结构 normalize 成默认值，避免渲染期读 undefined 抛错
const widgetOpts = computed<Required<FormDesignWidgetCascaderProps>>(() => {
  const raw = currWidget.value?.options || {}
  return {
    placeholder: raw.placeholder ?? '请选择',
    clearable: raw.clearable !== false,
    options: Array.isArray(raw.options) ? raw.options : [],
  }
})

// 递归确保 options 节点 label/value 存在，避免 a-cascader 渲染异常
function normalizeOptions(list: CascaderOptionItem[] | undefined | null): CascaderOptionItem[] {
  if (!Array.isArray(list)) return []
  return list
    .filter(o => o && (typeof o.label === 'string' || typeof o.value === 'string' || typeof o.label === 'number' || typeof o.value === 'number'))
    .map(o => {
      const node: CascaderOptionItem = {
        label: String(o.label ?? o.value ?? ''),
        value: String(o.value ?? o.label ?? ''),
      }
      if (Array.isArray(o.children) && o.children.length > 0) {
        const children = normalizeOptions(o.children)
        if (children.length > 0) node.children = children
      }
      return node
    })
}

const cascaderOptions = computed(() => normalizeOptions(widgetOpts.value.options))

// a-cascader 的 value 期望是 string[]（多选时是 string[][]），需要保证初始值不是 undefined
const widgetModelValue = computed({
  get: () => {
    const v = widgetModel.value
    return v == null ? undefined : v
  },
  set: (val) => {
    widgetModel.value = val
  }
})
</script>
