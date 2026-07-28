// main.js

import { h } from 'vue'
import { VxeUI } from 'vxe-pc-ui'
import { getFormDesignWidgetDatePickerConfig } from './widget'
import DatePickerWidgetView from './DatePickerWidgetView.vue'
import DatePickerWidgetProps from './DatePickerWidgetProps.vue'

// 创建表单设计器控件 - 日期选择器
VxeUI.renderer.add('DateDatePickerWidget', {
  // 定义左侧控件
  createFormDesignWidgetConfig: getFormDesignWidgetDatePickerConfig,
  // 渲染控件的表单视图
  renderFormDesignWidgetView (renderOpts, renderParams) {
    return h(DatePickerWidgetView, { renderOpts, renderParams })
  },
  // 渲染控件右侧的属性配置视图
  renderFormDesignWidgetFormView (renderOpts, renderParams) {
    return h(DatePickerWidgetProps, { renderOpts, renderParams })
  }
})
