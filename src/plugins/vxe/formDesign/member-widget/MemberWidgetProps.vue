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
      <vxe-form-item title="允许多选">
        <vxe-switch v-model="safeOptions.multiple"></vxe-switch>
      </vxe-form-item>
    </vxe-form>
  </div>
</template>

<script lang="ts" setup>
import { computed, PropType } from 'vue'
import { VxeGlobalRendererHandles } from 'vxe-pc-ui'
import { FormDesignWidgetMemberProps } from './widget'

const props = defineProps({
  renderOpts: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewOptions>,
    default: () => ({})
  },
  renderParams: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewParams<FormDesignWidgetMemberProps>>,
    default: () => ({})
  }
})

const currWidget = computed(() => {
  const { renderParams } = props
  return renderParams.widget
})

// 保证 options 结构完整，避免直接读 undefined 抛错
function ensureOptions(): Required<FormDesignWidgetMemberProps> {
  if (!currWidget.value) {
    return { placeholder: '请搜索并选择成员', clearable: true, multiple: true }
  }
  if (!currWidget.value.options || typeof currWidget.value.options !== 'object') {
    currWidget.value.options = { placeholder: '请搜索并选择成员', clearable: true, multiple: true }
  }
  const opts = currWidget.value.options as Partial<FormDesignWidgetMemberProps>
  if (typeof opts.placeholder !== 'string') opts.placeholder = '请搜索并选择成员'
  if (typeof opts.clearable !== 'boolean') opts.clearable = true
  if (typeof opts.multiple !== 'boolean') opts.multiple = true
  return opts as Required<FormDesignWidgetMemberProps>
}

const safeOptions = computed<Required<FormDesignWidgetMemberProps>>(() => ensureOptions())
</script>
