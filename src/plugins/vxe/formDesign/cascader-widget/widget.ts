import type { VxeGlobalRendererHandles } from 'vxe-pc-ui'

export interface CascaderOptionItem {
  label: string
  value: string
  children?: CascaderOptionItem[]
}

export interface FormDesignWidgetCascaderProps {
  placeholder: string
  clearable: boolean
  options: CascaderOptionItem[]
}

export const getFormDesignWidgetCascaderConfig = (): VxeGlobalRendererHandles.CreateFormDesignWidgetConfigObj<FormDesignWidgetCascaderProps> => {
  return {
    // 控件名称
    title: '级联选择',
    // 控件图标
    icon: 'vxe-icon-apartment',
    // 控件参数，用于在右侧配置
    options: {
      placeholder: '请选择',
      clearable: true,
      options: [
        {
          label: '示例一级',
          value: 'level1_1',
          children: [
            { label: '示例二级', value: 'level2_1' }
          ]
        }
      ]
    }
  }
}
