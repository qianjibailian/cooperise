/** AI 写作结果的替换内容：富文本 HTML（优先），或纯文本（按段落转换） */
export interface AiReplacePayload {
  html?: string
  text?: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 纯文本 → 段落 HTML（每行一段，空行保留为空段落） */
export function textToParagraphsHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `<p>${esc(line)}</p>` : '<p><br></p>'))
    .join('')
}

/** 元素的类型名（预览用） */
function labelOf(el: Element): string {
  if (el.classList.contains('docs-callout')) return '高亮块'
  if (el.classList.contains('docs-todo')) return '待办'
  if (el.classList.contains('docs-issue-card')) return '事项卡片'
  switch (el.tagName) {
    case 'H1':
      return '一级标题'
    case 'H2':
      return '二级标题'
    case 'H3':
      return '三级标题'
    case 'UL':
      return '无序列表'
    case 'OL':
      return '有序列表'
    case 'BLOCKQUOTE':
      return '引用'
    case 'PRE':
      return '代码块'
    case 'HR':
      return '分割线'
    case 'TABLE':
      return '表格'
    default:
      return '段落'
  }
}

/**
 * HTML 的顶层元素预览（抽屉里展示用）。用 DOMParser 解析，不执行、不渲染 HTML。
 * 列表 / 待办逐项列出。
 */
export function aiHtmlPreview(html: string): { label: string; text: string }[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const out: { label: string; text: string }[] = []
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim()
      if (t) out.push({ label: '文字', text: t })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const label = labelOf(el)
    let text: string
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      text = Array.from(el.children)
        .map((li, i) => (el.tagName === 'OL' ? `${i + 1}. ` : '• ') + (li.textContent || '').trim())
        .join('\n')
    } else if (el.classList.contains('docs-todo')) {
      text = '☐ ' + (el.querySelector('.docs-todo-text')?.textContent || '').trim()
    } else if (el.classList.contains('docs-issue-card')) {
      text = `${el.getAttribute('data-issue-key') || ''} ${el.querySelector('.docs-issue-title')?.textContent || ''}`.trim()
    } else {
      text = (el.textContent || '').trim()
    }
    if (text || el.tagName === 'HR') out.push({ label, text })
  })
  return out
}

/** 纯文本（用于复制）：每个顶层元素一行 */
export function aiHtmlPlainText(html: string): string {
  return aiHtmlPreview(html)
    .map((p) => p.text)
    .join('\n')
}
