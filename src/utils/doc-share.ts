import { ref } from 'vue'

/** 文档分享面板是否展开：顶栏「分享」按钮与文档页菜单共用同一个开关 */
export const docSharePanelOpen = ref(false)

/** 打开文档分享面板（文档页菜单「分享」等入口调用） */
export function openDocSharePanel() {
  docSharePanelOpen.value = true
}
