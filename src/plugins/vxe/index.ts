import { VxeUI } from 'vxe-pc-ui'
import VxeUIPluginRenderAntd from '@vxe-ui/plugin-render-antd'
import VxeUIPluginRenderWangEditor from '@vxe-ui/plugin-render-wangeditor'
import '@vxe-ui/plugin-render-wangeditor/dist/style.css'
import '@wangeditor/editor/dist/css/style.css'
import * as wangEditor from '@wangeditor/editor'

VxeUI.use(VxeUIPluginRenderAntd)
VxeUI.use(VxeUIPluginRenderWangEditor, { wangEditor })

import './formDesign'
