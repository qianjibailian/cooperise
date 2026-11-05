/**
 * 富文本字段（type = RICH_TEXT）通用工具：值 → HTML、HTML → 纯文本、是否有内容。
 * 详情抽屉 / 详情页的 RichTextField 与上线清单单元格共用。
 */

/** 含真正的 HTML 标签才按 HTML 处理（SQL 里的 `<>`、`a < b` 等仍算纯文本） */
const HTML_TAG = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/i

export function isRichTextType(type: unknown): boolean {
  return String(type ?? '').toUpperCase() === 'RICH_TEXT'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 字段值 → HTML：纯文本转义后保留换行与缩进 */
export function toRichHtml(v: unknown): string {
  if (v == null) return ''
  const s = String(v).replace(/\s+$/, '')
  if (!s.trim()) return ''
  if (HTML_TAG.test(s)) return s.trim()
  const body = escapeHtml(s)
    .replace(/^( +)/gm, (sp) => '&nbsp;'.repeat(sp.length))
    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
    .replace(/\n/g, '<br/>')
  return `<p style="margin:0">${body}</p>`
}

/** 字段的展示值：value 为空时取 exportValue */
export function richValueOf(f: { value?: unknown; exportValue?: unknown } | null | undefined): unknown {
  const blank = (x: unknown) => x == null || (typeof x === 'string' && !x.trim())
  return blank(f?.value) ? f?.exportValue : f?.value
}

/** 空段落 / 纯空白视为无内容，图片算有内容 */
export function richHasContent(html: string): boolean {
  if (!html) return false
  if (/<img\b/i.test(html)) return true
  return richToText(html) !== ''
}

/** HTML → 纯文本（块级元素换行），用于复制、必填判断、title 提示 */
export function richToText(html: string): string {
  if (!html) return ''
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  return (doc.body.textContent || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
