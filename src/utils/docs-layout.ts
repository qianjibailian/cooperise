import { ref } from 'vue'
import type { DocItem } from '@/types/docs'

/**
 * 文档页左侧菜单折叠状态
 * 文档页自身折叠侧栏，布局层（layout/index.vue）据此前移顶栏偏移
 */
export const docsSideCollapsed = ref(false)

/** 详情页编辑 / 预览模式（顶栏"编辑"下拉切换，文档页与顶栏共享） */
export const docsEditMode = ref(true)

/** 当前打开的文档（顶栏"分享 / 编辑"按钮使用；离开文档页时置空） */
export const docsActiveDoc = ref<DocItem | null>(null)
