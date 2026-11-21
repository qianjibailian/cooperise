import type { Directive } from 'vue'
import { hasPermission } from '@/utils/auth'

/**
 * 按钮级权限指令：v-permission="'admin:space:delete'" 或 v-permission="['a', 'b']"（任一满足即可）。
 * 无权限时在挂载阶段直接移除元素（按钮隐藏，对应后端接口也有 @RequirePermission 兜底）。
 */
export const vPermission: Directive = {
  mounted(el: HTMLElement, binding) {
    const codes = Array.isArray(binding.value) ? binding.value : [binding.value]
    if (!codes.length || hasPermission(...codes)) return
    el.parentNode?.removeChild(el)
  },
}
