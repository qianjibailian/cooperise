/** 直接移除的标签（连同内容） */
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'FRAME', 'FRAMESET'])
/** 可能携带 URL 的属性：禁止 javascript: / vbscript: / data:（图片的 data:image 除外） */
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster'])

function isUnsafeUrl(name: string, value: string, tag: string): boolean {
  const v = value.replace(/[\u0000- ]/g, '').toLowerCase()
  if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return true
  if (v.startsWith('data:')) return !(tag === 'IMG' && name === 'src' && v.startsWith('data:image/'))
  return false
}

/**
 * 富文本 HTML 过滤（v-html 渲染前使用）：
 * 移除脚本类标签、on* 事件属性、危险协议链接；外链统一加 rel="noopener noreferrer"。
 */
export function sanitizeHtml(html?: string | null): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (DROP_TAGS.has(child.tagName)) {
        child.remove()
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on') || name === 'srcdoc' || (URL_ATTRS.has(name) && isUnsafeUrl(name, attr.value, child.tagName))) {
          child.removeAttribute(attr.name)
        }
      }
      if (child.tagName === 'A' && child.getAttribute('target') === '_blank') {
        child.setAttribute('rel', 'noopener noreferrer')
      }
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}
