/** 文档内部元素 id（选项、题目等），与云文档页面的 genDocId 规则一致 */
export function genDocId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}
