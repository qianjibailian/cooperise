/**
 * 新建事项弹窗的全局开关：顶栏「新建」按钮触发，弹窗统一挂在 App.vue，
 * 这样各模块布局（工作台 / 云文档 / 空间 / 管理后台）都能共用同一个弹窗，不重复挂载。
 */
import { ref } from 'vue'

export const newIssueModalOpen = ref(false)

export function openNewIssueModal() {
  newIssueModalOpen.value = true
}
