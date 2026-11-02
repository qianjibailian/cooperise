/**
 * 中英文一键切换（运行时词典翻译）
 *
 * 页面文案仍写中文；英文模式下用 MutationObserver 监听 DOM，把命中词典（./en.ts）的中文
 * 文本节点、placeholder / title 等属性替换成英文，并记下原文，切回中文时原样还原。
 * - Vue 重新渲染写回中文时，observer 会再次翻译，因此对页面代码无侵入
 * - 没有词条的文案保持中文；用户输入（输入框、富文本编辑器、评论正文等）不翻译
 * - Ant Design 组件内置文案与 dayjs 日期格式由 App.vue / setLocale 同步切换
 */
import { ref } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import { VxeUI } from 'vxe-pc-ui'
import vxePcUiEnUS from 'vxe-pc-ui/es/language/en-US'
import vxeTableEnUS from 'vxe-table/lib/locale/lang/en-US'
import en from './en'
import enServer from './en-server'

export type Locale = 'zh' | 'en'

const STORAGE_KEY = 'cooperise_locale'
const HAN = /[一-鿿]/
/** 会被翻译的属性 */
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const
/** 不翻译的区域：用户输入 / 用户内容 */
const SKIP_SELECTOR = [
  'script', 'style', 'textarea', 'input',
  '[contenteditable="true"]', '.w-e-text-container',
  '[data-no-i18n]',
  // 评论正文、提及输入框的背景层（用户内容）
  '.ic-content', '.ic-quote-text', '.mention-backdrop',
].join(',')

function readLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

/** 当前语言（响应式：App.vue 据此切换 Ant Design / dayjs 语言） */
export const locale = ref<Locale>(readLocale())

// ---------------- 词典 ----------------
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

const exact = new Map<string, string>()
const patterns: { re: RegExp; tpl: string }[] = []
// 后端提示在前、前端文案在后：同一原文以前端词条为准
for (const [zh, text] of Object.entries({ ...enServer, ...en })) {
  const key = norm(zh)
  if (/\{\d+\}/.test(key)) {
    const source = key
      .split(/(\{\d+\})/)
      .map(part => (/^\{\d+\}$/.test(part) ? '([\\s\\S]+?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('')
    patterns.push({ re: new RegExp(`^${source}$`), tpl: text })
  } else {
    exact.set(key, text)
  }
}
// 固定文字越多越具体，优先匹配
patterns.sort((a, b) => b.re.source.length - a.re.source.length)

const cache = new Map<string, string | null>()

/** 翻译一段文字；没有词条返回 null。前后空白保留，模板占位里的中文再递归翻译一次 */
export function translate(text: string): string | null {
  if (!HAN.test(text)) return null
  if (cache.has(text)) return cache.get(text) ?? null
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) as RegExpExecArray
  const core = norm(m[2])
  // Ant Design 会在两个汉字的按钮文字中间插空格（查询 → 查 询），按去掉空格后的原文查
  const lookup = /^[一-鿿](?: [一-鿿])+$/.test(core) ? core.replace(/ /g, '') : core
  let out: string | null = exact.get(lookup) ?? null
  if (out == null) {
    for (const p of patterns) {
      const hit = p.re.exec(core)
      if (!hit) continue
      out = p.tpl.replace(/\{(\d+)\}/g, (_s, i) => {
        const part = hit[Number(i) + 1] ?? ''
        return exact.get(norm(part)) ?? part
      })
      break
    }
  }
  // 用「 · 」拼起来的说明（如 需求、任务 · 我经办的 · 未结束）：逐段翻译，有一段命中即可。
  // 只认「 · 」：单独用「、」的多半是用户写的内容（如事项概要），不拆
  if (out == null && core.includes(' · ')) out = translateSegments(core)
  const result = out == null ? null : m[1] + out + m[3]
  if (result == null) recordMissing(core)
  if (cache.size > 5000) cache.clear()
  cache.set(text, result)
  return result
}

/** 分段翻译：先按「 · 」再按「、」拆开，没命中的段保持原文；一段都没命中返回 null */
function translateSegments(core: string): string | null {
  let hit = false
  const one = (s: string) => {
    const t = exact.get(norm(s))
    if (t != null) hit = true
    return t ?? s
  }
  const out = core.split(' · ').map(seg => (seg.includes('、') ? seg.split('、').map(one).join(', ') : one(seg))).join(' · ')
  return hit ? out : null
}

/** 「日」：日历表头里是周日，甘特视图切换里是「按日」 */
function translateDay(node: Text): string {
  const row = node.parentElement?.parentElement
  const weekday = row && Array.from(row.children).some(el => ['一', '六', 'Mon', 'Sat'].includes((el.textContent || '').trim()))
  return weekday ? 'Sun' : 'Day'
}

/**
 * 本地开发时记录英文模式下没翻译到的中文，控制台执行 [...window.__i18nMissing] 查看，补到 en.ts / en-server.ts。
 * 用户数据（姓名、概要等）也会出现在这里，按需挑界面文案补
 */
function recordMissing(text: string) {
  if (!import.meta.env.DEV) return
  const w = window as unknown as { __i18nMissing?: Set<string> }
  ;(w.__i18nMissing ??= new Set()).add(text)
}

// ---------------- 第三方组件语言（vxe 表格 / 甘特） ----------------
let vxeEnRegistered = false
function applyVxe(l: Locale) {
  if (l === 'en' && !vxeEnRegistered) {
    VxeUI.setI18n('en-US', { ...vxePcUiEnUS, ...vxeTableEnUS, vxe: { ...vxePcUiEnUS.vxe, ...vxeTableEnUS.vxe } })
    vxeEnRegistered = true
  }
  VxeUI.setLanguage(l === 'en' ? 'en-US' : 'zh-CN')
}

// ---------------- DOM 替换 ----------------
/** 文本节点：原文 / 写入的译文 */
const textOrigin = new WeakMap<Text, { zh: string; en: string }>()
/** 属性：元素 → 属性名 → 原文 / 译文 */
const attrOrigin = new WeakMap<Element, Map<string, { zh: string; en: string }>>()

function skipped(el: Element | null): boolean {
  return !!el && !!el.closest(SKIP_SELECTOR)
}

function translateTextNode(node: Text) {
  const cur = node.data
  const rec = textOrigin.get(node)
  if (rec && cur === rec.en) return // 自己写入的译文
  if (!HAN.test(cur) || skipped(node.parentElement)) return
  const out = cur.trim() === '日' ? cur.replace('日', translateDay(node)) : translate(cur)
  if (out == null || out === cur) return
  textOrigin.set(node, { zh: cur, en: out })
  node.data = out
}

function translateAttrs(el: Element) {
  if (skipped(el) && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  for (const name of ATTRS) {
    const cur = el.getAttribute(name)
    if (!cur) continue
    let map = attrOrigin.get(el)
    const rec = map?.get(name)
    if (rec && cur === rec.en) continue
    if (!HAN.test(cur)) continue
    const out = translate(cur)
    if (out == null || out === cur) continue
    if (!map) attrOrigin.set(el, (map = new Map()))
    map.set(name, { zh: cur, en: out })
    el.setAttribute(name, out)
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  translateAttrs(el)
  el.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(translateAttrs)
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) translateTextNode(n as Text)
}

/** 切回中文：把记录过的译文还原成原文（已被 Vue 改写成别的内容的不动） */
function restoreTree(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    const rec = textOrigin.get(node)
    if (rec && node.data === rec.en) node.data = rec.zh
    textOrigin.delete(node)
  }
  root.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach((el) => {
    const map = attrOrigin.get(el)
    if (!map) return
    map.forEach((rec, name) => {
      if (el.getAttribute(name) === rec.en) el.setAttribute(name, rec.zh)
    })
    attrOrigin.delete(el)
  })
}

let observer: MutationObserver | null = null
let titleZh = ''

function syncTitle() {
  if (locale.value !== 'en') return
  const out = translate(document.title)
  if (out != null && out !== document.title) {
    titleZh = document.title
    document.title = out
  }
}

function startObserver() {
  if (observer) return
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') translateTextNode(m.target as Text)
      else if (m.type === 'attributes') translateAttrs(m.target as Element)
      else m.addedNodes.forEach(translateTree)
    }
    syncTitle()
  })
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  })
}

function stopObserver() {
  observer?.disconnect()
  observer = null
}

function applyDayjs(l: Locale) {
  dayjs.locale(l === 'en' ? 'en' : 'zh-cn')
}

/** 切换语言并记住选择 */
export function setLocale(l: Locale) {
  if (l === locale.value) return
  locale.value = l
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {
    // 隐私模式等不可写时只在本次会话生效
  }
  applyDayjs(l)
  applyVxe(l)
  document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN'
  if (l === 'en') {
    translateTree(document.body)
    syncTitle()
    startObserver()
  } else {
    stopObserver()
    restoreTree(document.body)
    if (titleZh && translate(titleZh) === document.title) document.title = titleZh
  }
}

/** 应用启动时调用：恢复上次选择的语言 */
export function initLocale() {
  applyDayjs(locale.value)
  applyVxe(locale.value)
  document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN'
  if (locale.value === 'en') {
    startObserver()
    translateTree(document.body)
  }
}

export function useLocale() {
  return { locale, setLocale }
}
