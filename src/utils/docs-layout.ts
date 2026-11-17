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

/**
 * 详情页编辑模式（文档页与顶栏共享）：默认只读；顶栏"编辑"进入编辑，"更新"退出编辑。
 * 切换到其他文档时回到只读。
 */
export const docsEditMode = ref(false)

/**
 * 修订模式：文档可编辑（docsEditMode 为 true），但修改以"修订"的形式呈现，
 * 与修订基准比对，逐段接受 / 拒绝（只在修订模式下生效）
 */
export const docsSuggestMode = ref(false)

/** 当前打开的文档（顶栏"分享 / 编辑"按钮使用；离开文档页时置空） */
export const docsActiveDoc = ref<DocItem | null>(null)

/**
 * 顶栏文件名改名计数：顶栏输入框每次输入 +1，
 * 文档页 watch 后触发防抖保存（onDocChanged 在页面内，顶栏只发信号）
 */
export const docsTitleRev = ref(0)

/**
 * 顶栏"+"新建请求：类型 + 序号。顶栏每点一次 seq +1，文档页监听序号后按类型新建文档。
 */
export const docsCreateRequest = ref<{ type: string; seq: number }>({ type: '', seq: 0 })
export function requestDocCreate(type: string) {
  docsCreateRequest.value = { type, seq: docsCreateRequest.value.seq + 1 }
}

/**
 * 详情页保存状态（顶栏分享按钮左侧轻提示，文档页与顶栏共享）：
 * saved-已保存到云端 / saving-保存中 / unsaved-保存失败待重试
 */
export type DocsSaveState = 'saved' | 'saving' | 'unsaved'
export const docsSaveState = ref<DocsSaveState>('saved')
