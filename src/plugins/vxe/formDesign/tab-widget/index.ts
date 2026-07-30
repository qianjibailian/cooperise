import { h } from 'vue'
import { VxeUI } from 'vxe-pc-ui'
import { getFormDesignWidgetTabConfig } from './widget'
import TabWidgetDesignView from './TabWidgetDesignView.vue'
import TabWidgetView from './TabWidgetView.vue'
import TabWidgetProps from './TabWidgetProps.vue'

VxeUI.renderer.add('TabWidget', {
  createFormDesignWidgetConfig: getFormDesignWidgetTabConfig,
  // 设计时编辑视图
  renderFormDesignWidgetEdit (renderOpts, renderParams) {
    return h(TabWidgetDesignView, { renderOpts, renderParams })
  },
  // 表单设计器 - 预览时 - 电脑端
  renderFormDesignWidgetPreview (renderOpts, renderParams) {
    return h(TabWidgetView, { renderOpts, renderParams })
  },
  // 默认视图（兜底）
  renderFormDesignWidgetView (renderOpts, renderParams) {
    // 通过 $formView 是否存在来判断是预览还是设计时
    const $formView = (renderParams as any).$formView
    if ($formView) {
      return h(TabWidgetView, { renderOpts, renderParams })
    }
    return h(TabWidgetDesignView, { renderOpts, renderParams })
  },
  // 渲染控件右侧的属性配置视图
  renderFormDesignWidgetFormView (renderOpts, renderParams) {
    return h(TabWidgetProps, { renderOpts, renderParams })
  }
})
