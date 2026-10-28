import { ref, watch, onBeforeUnmount } from 'vue'

/** 事项创建计数：顶部新建弹窗提交成功后自增，列表页监听后刷新 */
const issueCreatedTick = ref(0)

/** 通知：有新事项创建成功 */
export function notifyIssueCreated() {
  issueCreatedTick.value++
}

/** 监听新事项创建成功（组件卸载时自动取消监听） */
export function onIssueCreated(cb: () => void) {
  const stop = watch(issueCreatedTick, () => cb())
  onBeforeUnmount(stop)
}
