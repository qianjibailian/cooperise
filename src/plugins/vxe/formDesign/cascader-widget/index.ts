import { h } from 'vue'
import { VxeUI } from 'vxe-pc-ui'
import { getFormDesignWidgetCascaderConfig } from './widget'
import CascaderWidgetView from './CascaderWidgetView.vue'
import CascaderWidgetProps from './CascaderWidgetProps.vue'

// 创建表单设计器控件 - 级联选择器
VxeUI.renderer.add('CascaderWidget', {
  // 定义左侧控件
  createFormDesignWidgetConfig: getFormDesignWidgetCascaderConfig,
  // 渲染控件的表单视图
  renderFormDesignWidgetView (renderOpts, renderParams) {
    return h(CascaderWidgetView, { renderOpts, renderParams })
  },
  // 渲染控件右侧的属性配置视图
  renderFormDesignWidgetFormView (renderOpts, renderParams) {
    return h(CascaderWidgetProps, { renderOpts, renderParams })
  }
})
