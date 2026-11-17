import request from '@/utils/request'
import type { Result } from '@/types/faiz'

/**
 * ==================== AI 写作助手 API ====================
 *
 * 对后端的约定（后端负责调用 DeepSeek，密钥只存在后端，前端不接触）：
 * POST /ai/polish
 *   入参：
 *     - html：用户选中内容的富文本 HTML（与文档保存的格式一致：p / h1-h3 / ul / ol / li / blockquote /
 *       div.docs-callout / div.docs-todo / pre / strong / span 等；事项卡片为 div.docs-issue-card）。
 *       整篇正文被选中时为整篇正文的 HTML
 *     - text：同一内容的纯文本（备用，便于后端做字数统计等）
 *     - action：润色 / 精简 / 扩写 / 修正错别字与语病 / 仅按自定义指令处理
 *     - tone：语气（可选）：formal 正式 / casual 口语 / professional 专业 / friendly 亲切；不传表示保持原语气
 *     - length：篇幅（可选）：shorter 更简洁 / longer 更详细；不传表示保持原篇幅
 *     - instruction：自定义要求（可选，对所有处理方式生效；action 为 custom 时必填）
 *     - layout：是否同时优化排版（可选）：为 true 时可以调整结构（列表、标题、高亮块、引用等）
 *   出参：{ success, data: { html } }
 *     - html：改写后的富文本 HTML，格式与入参 html 相同，可直接放进文档。
 *       只允许使用上面列出的标签和类名；事项卡片保留 data-issue-key，不要改动它的编号。
 *     - 若只返回 data.text（纯文本），前端会按段落转换为 HTML。
 */
export type AiAction = 'polish' | 'shorten' | 'expand' | 'fix' | 'custom'
export type AiTone = 'formal' | 'casual' | 'professional' | 'friendly'
export type AiLength = 'shorter' | 'longer'

export interface AiPolishPayload {
  html: string
  text: string
  action: AiAction
  tone?: AiTone
  length?: AiLength
  instruction?: string
  layout?: boolean
}

export interface AiPolishResult {
  html?: string
  text?: string
}

export function aiPolishText(data: AiPolishPayload): Promise<Result<AiPolishResult>> {
  return request.post(`/ai/polish`, data)
}
