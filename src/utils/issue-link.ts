import type { Router } from 'vue-router'
import { isDesktop } from '@/utils/desktop'

/** 事项详情路由路径（/jira/browse/{issueKey}） */
export function issuePath(issueKey: string): string {
  return `/jira/browse/${encodeURIComponent(issueKey)}`
}

/** 事项完整链接（域名/jira/browse/{issueKey}） */
export function issueLink(issueKey: string): string {
  return `${window.location.origin}${issuePath(issueKey)}`
}

/**
 * 打开事项链接：浏览器里新开一个浏览器页面；
 * 客户端里通过路由跳转，由 DesktopTabBar 自动新增（或切到已有的）页签。
 */
export function openIssueLink(issueKey: string, router: Router) {
  if (!issueKey) return
  if (isDesktop) router.push(issuePath(issueKey))
  else window.open(issueLink(issueKey), '_blank', 'noopener')
}
