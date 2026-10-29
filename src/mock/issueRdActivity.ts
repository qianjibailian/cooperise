/**
 * 研发活动 mock 数据（接口未接入前的前端演示数据）
 * 按单号生成，同一单号每次结果一致。
 */

export interface RdDoc {
  id: string
  title: string
  type: 'PRD' | '原型' | '技术方案' | '接口文档'
  author: string
  updatedAt: string
  url: string
}

export interface RdApp {
  id: string
  name: string
  code: string
  owner: string
  envs: string[]
}

export interface RdBranch {
  id: string
  repo: string
  branch: string
  commits: number
  mrStatus: 'OPEN' | 'MERGED' | 'CLOSED'
  author: string
  updatedAt: string
}

export interface RdTestReport {
  id: string
  version: string
  submitter: string
  submittedAt: string
  result: 'PASS' | 'REJECT' | 'TESTING'
  caseTotal: number
  casePassed: number
}

export interface RdTestPlan {
  id: string
  name: string
  owner: string
  passed: number
  failed: number
  total: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
}

export interface RdBug {
  key: string
  title: string
  severity: '致命' | '严重' | '一般' | '提示'
  status: '待修复' | '修复中' | '待验证' | '已关闭'
  assignee: string
}

export interface RdIncident {
  id: string
  title: string
  level: 'P0' | 'P1' | 'P2' | 'P3'
  status: '处理中' | '已恢复' | '已复盘'
  occurredAt: string
  duration: string
}

export interface RdActivityMock {
  doc: RdDoc[]
  app: RdApp[]
  branch: RdBranch[]
  testReport: RdTestReport[]
  testPlan: RdTestPlan[]
  bug: RdBug[]
  incident: RdIncident[]
}

/** 单号 → 稳定的数字种子 */
function seedOf(issueKey: string): number {
  let h = 0
  for (const ch of issueKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

export function mockRdActivity(issueKey: string): RdActivityMock {
  const seed = seedOf(issueKey || 'UG-000000')
  const no = (issueKey.match(/\d+/)?.[0] ?? '000000').replace(/^0+/, '') || '0'
  const pick = <T>(list: T[], offset = 0) => list[(seed + offset) % list.length]
  const people = ['ZhangSan', 'LiSi', 'WangWu', 'ZhaoLiu', 'SunQi']
  const day = (d: number) => `2026-10-${String(Math.max(1, 29 - d)).padStart(2, '0')}`

  return {
    doc: [
      { id: 'd1', title: `【PRD】${issueKey} 需求说明书`, type: 'PRD', author: pick(people), updatedAt: `${day(6)} 14:20`, url: '#' },
      { id: 'd2', title: '交互原型 v1.2（Figma）', type: '原型', author: pick(people, 1), updatedAt: `${day(4)} 10:05`, url: '#' },
      { id: 'd3', title: '技术方案：导出服务拆分与异步化', type: '技术方案', author: pick(people, 2), updatedAt: `${day(2)} 18:40`, url: '#' },
    ],
    app: [
      { id: 'a1', name: 'POS 管理后台', code: 'pos-admin-portal', owner: pick(people, 1), envs: ['DEV', 'TEST', 'PROD'] },
      { id: 'a2', name: '业务数据服务', code: 'biz-data-service', owner: pick(people, 3), envs: ['DEV', 'TEST'] },
    ],
    branch: [
      { id: 'b1', repo: 'pos-admin-portal', branch: `feature/${issueKey.toLowerCase()}-export`, commits: 12 + (seed % 9), mrStatus: 'MERGED', author: pick(people), updatedAt: `${day(3)} 16:12` },
      { id: 'b2', repo: 'biz-data-service', branch: `feature/${issueKey.toLowerCase()}-api`, commits: 5 + (seed % 6), mrStatus: 'OPEN', author: pick(people, 2), updatedAt: `${day(1)} 11:30` },
      { id: 'b3', repo: 'biz-data-service', branch: `hotfix/${issueKey.toLowerCase()}-npe`, commits: 2, mrStatus: 'CLOSED', author: pick(people, 4), updatedAt: `${day(1)} 20:08` },
    ],
    testReport: [
      { id: 'r1', version: 'v1.0.0-rc1', submitter: pick(people), submittedAt: `${day(3)} 17:00`, result: 'REJECT', caseTotal: 48, casePassed: 39 },
      { id: 'r2', version: 'v1.0.0-rc2', submitter: pick(people), submittedAt: `${day(1)} 15:30`, result: 'PASS', caseTotal: 48, casePassed: 48 },
    ],
    testPlan: [
      { id: 'p1', name: '功能测试 - 导出范围与权限', owner: pick(people, 3), passed: 32, failed: 2, total: 36, status: 'IN_PROGRESS' },
      { id: 'p2', name: '回归测试 - Business Data 模块', owner: pick(people, 4), passed: 60, failed: 0, total: 60, status: 'DONE' },
      { id: 'p3', name: '性能测试 - 大数据量导出', owner: pick(people, 1), passed: 0, failed: 0, total: 12, status: 'NOT_STARTED' },
    ],
    bug: [
      { key: `BUG-${no}01`, title: '导出文件时间列时区错误', severity: '严重', status: '待验证', assignee: pick(people, 2) },
      { key: `BUG-${no}02`, title: '筛选条件为空时导出按钮未置灰', severity: '一般', status: '修复中', assignee: pick(people) },
      { key: `BUG-${no}03`, title: '超过 1 万行导出超时', severity: '致命', status: '待修复', assignee: pick(people, 3) },
      { key: `BUG-${no}04`, title: '表头文案错别字', severity: '提示', status: '已关闭', assignee: pick(people, 4) },
    ],
    incident: [
      { id: `INC-2026${no}1`, title: '导出服务内存溢出导致后台 5xx', level: 'P1', status: '已复盘', occurredAt: `${day(9)} 21:14`, duration: '23 分钟' },
      { id: `INC-2026${no}2`, title: '部分门店数据导出为空', level: 'P2', status: '处理中', occurredAt: `${day(0)} 09:42`, duration: '进行中' },
    ],
  }
}
