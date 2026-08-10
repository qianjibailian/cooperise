import { h } from 'vue'
import { VxeUI } from 'vxe-pc-ui'
import { getFormDesignWidgetMemberConfig } from './widget'
import MemberWidgetView from './MemberWidgetView.vue'
import MemberWidgetProps from './MemberWidgetProps.vue'

// 创建表单设计器控件 - 成员选择
VxeUI.renderer.add('MemberWidget', {
  // 定义左侧控件
  createFormDesignWidgetConfig: getFormDesignWidgetMemberConfig,
  // 渲染控件的表单视图
  renderFormDesignWidgetView (renderOpts, renderParams) {
    return h(MemberWidgetView, { renderOpts, renderParams })
  },
  // 渲染控件右侧的属性配置视图
  renderFormDesignWidgetFormView (renderOpts, renderParams) {
    return h(MemberWidgetProps, { renderOpts, renderParams })
  }
})
