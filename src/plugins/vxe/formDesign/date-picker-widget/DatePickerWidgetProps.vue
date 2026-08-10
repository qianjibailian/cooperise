<template>
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
    <vxe-form-item title="显示格式">
      <vxe-select v-model="safeOptions.labelFormat" :options="formatOptions"></vxe-select>
    </vxe-form-item>
  </vxe-form>
</template>

<script lang="ts" setup>
import { computed, PropType, ref } from 'vue'
import { VxeGlobalRendererHandles } from 'vxe-pc-ui'
import { FormDesignWidgetDatePickerProps } from './widget'

const props = defineProps({
  renderOpts: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewOptions>,
    default: () => ({})
  },
  renderParams: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewParams<FormDesignWidgetDatePickerProps>>,
    default: () => ({})
  }
})

const currWidget = computed(() => {
  const { renderParams } = props
  return renderParams.widget
})

function ensureOptions(): Required<FormDesignWidgetDatePickerProps> {
  if (!currWidget.value) {
    return { placeholder: '请选择', labelFormat: '', clearable: true }
  }
  if (!currWidget.value.options || typeof currWidget.value.options !== 'object') {
    currWidget.value.options = { placeholder: '请选择', labelFormat: '', clearable: true }
  }
  const o = currWidget.value.options as Partial<FormDesignWidgetDatePickerProps>
  if (typeof o.placeholder !== 'string') o.placeholder = '请选择'
  if (typeof o.labelFormat !== 'string') o.labelFormat = ''
  if (typeof o.clearable !== 'boolean') o.clearable = true
  return o as Required<FormDesignWidgetDatePickerProps>
}

const safeOptions = computed(() => ensureOptions())

const formatOptions = ref([
  { value: 'yyyy-MM-dd HH:mm:ss', label: '年-月-日 时:分:秒' },
  { value: 'yyyy-MM-dd HH:mm', label: '年-月-日 时:分' },
  { value: '', label: '年-月-日' },
  { value: 'yyyy-MM', label: '年-月' }
])
</script>
