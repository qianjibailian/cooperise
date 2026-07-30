import type { VxeGlobalRendererHandles } from 'vxe-pc-ui'

export interface TabItem {
  key: string
  name: string
  _editingName?: string
}

export interface FormDesignWidgetTabProps {
  tabs: TabItem[]
  activeKey: string
}

const randomTabKey = () => 'tab_' + Math.random().toString(36).slice(2, 8)

export const getFormDesignWidgetTabConfig = (): VxeGlobalRendererHandles.CreateFormDesignWidgetConfigObj<FormDesignWidgetTabProps> => {
  const k1 = randomTabKey()
  const k2 = randomTabKey()
  return {
    title: '页签',
    icon: 'vxe-icon-tabs',
    options: {
      tabs: [
        { key: k1, name: '页签1' },
        { key: k2, name: '页签2' },
      ],
      activeKey: k1,
    },
  }
}

export { randomTabKey }
