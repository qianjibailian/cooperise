import type { VxeGlobalRendererHandles } from 'vxe-pc-ui'

export interface FormDesignWidgetMemberProps {
  placeholder: string
  clearable: boolean
  multiple: boolean
}

export const getFormDesignWidgetMemberConfig = (): VxeGlobalRendererHandles.CreateFormDesignWidgetConfigObj<FormDesignWidgetMemberProps> => {
  return {
    // 控件名称
    title: '成员选择',
    // 控件图标
    icon: 'vxe-icon-user',
    // 控件参数，用于在右侧配置
    options: {
      placeholder: '请搜索并选择成员',
      clearable: true,
      multiple: true,
    }
  }
}
