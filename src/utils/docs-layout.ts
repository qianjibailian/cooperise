import { ref } from 'vue'
import type { DocItem } from '@/types/docs'

/**
 * 文档页左侧菜单折叠状态
 * 文档页自身折叠侧栏，云文档布局（layout/DocsLayout.vue）据此前移顶栏偏移
 */
export const docsSideCollapsed = ref(false)

/** 新建文档的默认标题：列表里照常显示；标题输入框里视为"还没起标题"，留空并提示「请输入标题」 */
export const DOC_UNTITLED = '无标题文档'

/** 标题输入框里显示的值：默认标题显示为空（露出占位提示） */
export function docTitleInputValue(title?: string): string {
  return !title || title === DOC_UNTITLED ? '' : title
}

/** 详情页编辑 / 预览模式（顶栏"编辑"下拉切换，文档页与顶栏共享） */
export const docsEditMode = ref(true)

/** 当前打开的文档（顶栏"分享 / 编辑"按钮使用；离开文档页时置空） */
export const docsActiveDoc = ref<DocItem | null>(null)

/**
 * 顶栏文件名改名计数：顶栏输入框每次输入 +1，
 * 文档页 watch 后触发防抖保存（onDocChanged 在页面内，顶栏只发信号）
 */
export const docsTitleRev = ref(0)

/**
 * 详情页保存状态（顶栏分享按钮左侧轻提示，文档页与顶栏共享）：
 * saved-已保存到云端 / saving-保存中 / unsaved-保存失败待重试
 */
export type DocsSaveState = 'saved' | 'saving' | 'unsaved'
export const docsSaveState = ref<DocsSaveState>('saved')
