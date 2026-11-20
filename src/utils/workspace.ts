import { computed, ref } from 'vue'

const WS_KEY = 'faiz.currentWorkspace'

function readStored(): string {
  try {
    return localStorage.getItem(WS_KEY) || 'personal'
  } catch {
    return 'personal'
  }
}

/** 当前工作空间：'personal'（个人）或企业 id（字符串）。切换后全局同步，供顶栏、一级菜单等共用 */
export const currentWorkspace = ref<string>(readStored())

/** 是否处于企业空间（非个人） */
export const isEnterpriseWorkspace = computed(() => currentWorkspace.value !== 'personal')

export function setCurrentWorkspace(key: string | number) {
  currentWorkspace.value = String(key)
  try {
    localStorage.setItem(WS_KEY, String(key))
  } catch {
    // 隐私模式等无法写入时忽略，本次会话内仍生效
  }
}
