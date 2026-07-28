// main.js

import { h } from 'vue'
import { VxeUI } from 'vxe-pc-ui'
import { getFormDesignWidgetUploadImageConfig } from './widget'
import UploadImageWidgetView from './UploadImageWidgetView.vue'
import UploadImageWidgetProps from './UploadImageWidgetProps.vue'

// 创建表单设计器控件 - 上传图片
VxeUI.renderer.add('UploadImageWidget', {
  // 定义左侧控件
  createFormDesignWidgetConfig: getFormDesignWidgetUploadImageConfig,
  // 渲染控件的表单视图
  renderFormDesignWidgetView (renderOpts, renderParams) {
    return h(UploadImageWidgetView, { renderOpts, renderParams })
  },
  // 渲染控件右侧的属性配置视图
  renderFormDesignWidgetFormView (renderOpts, renderParams) {
    return h(UploadImageWidgetProps, { renderOpts, renderParams })
  }
})
