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
    <vxe-form-item title="显示操作按钮">
      <vxe-switch v-model="safeOptions.controlConfig.showButton"></vxe-switch>
    </vxe-form-item>
    <vxe-form-item v-if="safeOptions.controlConfig.showButton" title="按钮布局">
      <vxe-radio-group v-model="safeOptions.controlConfig.layout">
        <vxe-radio checked-value="left" content="左侧"></vxe-radio>
        <vxe-radio checked-value="default" content="两侧"></vxe-radio>
        <vxe-radio checked-value="right" content="右侧"></vxe-radio>
      </vxe-radio-group>
    </vxe-form-item>
    <vxe-form-item v-if="safeOptions.controlConfig.showButton" title="按钮步数">
      <vxe-number-input v-model="safeOptions.step"></vxe-number-input>
    </vxe-form-item>
    <vxe-form-item title="类型">
      <vxe-radio-group v-model="safeOptions.type">
        <vxe-radio checked-value="number" content="数值"></vxe-radio>
        <vxe-radio checked-value="integer" content="整数"></vxe-radio>
        <vxe-radio checked-value="float" content="小数"></vxe-radio>
      </vxe-radio-group>
    </vxe-form-item>
    <vxe-form-item v-if="['number', 'float'].includes(safeOptions.type)" title="小数位数">
      <vxe-number-input v-model="safeOptions.digits" :min="1" :max="9"></vxe-number-input>
    </vxe-form-item>
    <vxe-form-item title="最小值">
      <vxe-number-input v-model="safeOptions.min"></vxe-number-input>
    </vxe-form-item>
    <vxe-form-item title="最大值">
      <vxe-number-input v-model="safeOptions.max"></vxe-number-input>
    </vxe-form-item>
    <vxe-form-item title="对齐方式">
      <vxe-radio-group v-model="safeOptions.align">
        <vxe-radio checked-value="" content="居左"></vxe-radio>
        <vxe-radio checked-value="center" content="居中"></vxe-radio>
        <vxe-radio checked-value="right" content="居右"></vxe-radio>
      </vxe-radio-group>
    </vxe-form-item>
  </vxe-form>
</template>

<script lang="ts" setup>
import { computed, PropType } from 'vue'
import { VxeGlobalRendererHandles } from 'vxe-pc-ui'
import { FormDesignWidgetNumberInputProps } from './widget'

const props = defineProps({
  renderOpts: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewOptions>,
    default: () => ({})
  },
  renderParams: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewParams<FormDesignWidgetNumberInputProps>>,
    default: () => ({})
  }
})

const currWidget = computed(() => {
  const { renderParams } = props
  return renderParams.widget
})

function ensureOptions(): Required<FormDesignWidgetNumberInputProps> {
  if (!currWidget.value) {
    return {
      placeholder: '请输入', clearable: true, type: 'number',
      controlConfig: { showButton: true, layout: 'right' },
      digits: 2, min: null, max: null, step: null, align: '',
    }
  }
  if (!currWidget.value.options || typeof currWidget.value.options !== 'object') {
    currWidget.value.options = {
      placeholder: '请输入', clearable: true, type: 'number',
      controlConfig: { showButton: true, layout: 'right' },
      digits: 2, min: null, max: null, step: null, align: '',
    }
  }
  const o = currWidget.value.options as Partial<FormDesignWidgetNumberInputProps>
  if (typeof o.placeholder !== 'string') o.placeholder = '请输入'
  if (typeof o.clearable !== 'boolean') o.clearable = true
  if (!['number', 'integer', 'float'].includes(o.type as any)) o.type = 'number'
  if (!o.controlConfig || typeof o.controlConfig !== 'object') {
    o.controlConfig = { showButton: true, layout: 'right' }
  }
  if (typeof o.digits !== 'number') o.digits = 2
  if (!('min' in o)) o.min = null
  if (!('max' in o)) o.max = null
  if (!('step' in o)) o.step = null
  if (typeof o.align !== 'string') o.align = ''
  return o as Required<FormDesignWidgetNumberInputProps>
}

const safeOptions = computed(() => ensureOptions())
</script>
