import { locale } from '@/i18n'

/**
 * 日期 / 时间格式，跟随当前语言：
 * - English：Nov 17, 2026 / Nov 17, 2026, 3:05 PM / 5 min ago
 * - 中文：2026年11月17日 / 2026年11月17日 15:05 / 5 分钟前
 * 读取 locale 是响应式的，模板里调用切换语言后会自动刷新。
 */
function isEn(): boolean {
  return locale.value === 'en'
}

/** 日期：Nov 17, 2026 */
export function formatUsDate(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (!isEn()) return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** 日期 + 时间：Nov 17, 2026, 3:05 PM */
export function formatUsDateTime(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (!isEn()) {
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
  }
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** 相对时间：just now / 5 min ago / 2 hr ago / 3 days ago；一周以上显示日期 */
export function formatUsRelative(ts: number): string {
  const diff = Date.now() - ts
  if (isEn()) {
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
    if (diff < 7 * 86_400_000) {
      const days = Math.floor(diff / 86_400_000)
      return `${days} ${days === 1 ? 'day' : 'days'} ago`
    }
  } else {
    if (diff < 60_000) return '刚刚'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  }
  return formatUsDate(ts)
}

/** 数字的本地化格式（千分位与小数点）：英文 en-US，中文 zh-CN */
export function numberLocale(): string {
  return isEn() ? 'en-US' : 'zh-CN'
}
