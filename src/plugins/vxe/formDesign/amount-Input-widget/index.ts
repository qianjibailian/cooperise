import { h } from 'vue'
import { VxeUI } from 'vxe-pc-ui'
import { getFormDesignWidgetAmountInputConfig } from './widget'
import AmountInputWidgetView from './AmountInputWidgetView.vue'
import AmountInputWidgetProps from './AmountInputWidgetProps.vue'

// 创建表单设计器控件 - 金额输入
VxeUI.renderer.add('AmountInputWidget', {
  // 定义左侧控件
  createFormDesignWidgetConfig: getFormDesignWidgetAmountInputConfig,
  // 渲染控件的表单视图
  renderFormDesignWidgetView (renderOpts, renderParams) {
    return h(AmountInputWidgetView, { renderOpts, renderParams })
  },
  // 渲染控件右侧的属性配置视图
  renderFormDesignWidgetFormView (renderOpts, renderParams) {
    return h(AmountInputWidgetProps, { renderOpts, renderParams })
  }
})
