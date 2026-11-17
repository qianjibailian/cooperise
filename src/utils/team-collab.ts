import type { Component } from 'vue'
import {
  ApartmentOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ProjectOutlined,
  RocketOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'

/** 管理弹窗的数据来源：事项（可按类型名过滤）/ 用户 / 部门 */
export interface TeamManageSpec {
  kind: 'issue' | 'users' | 'dept'
  /** 事项类型名称（需求 / 任务）；为空表示全部事项 */
  typeName?: string
  /** 在云文档正文里打开时，可把选中的事项插入到文档 */
  insertable?: boolean
}

/**
 * 团队协作入口（新建菜单 / 文档插入菜单共用）：点击后在弹窗中管理，不跳转页面。
 */
export interface TeamCollabItem {
  key: string
  label: string
  icon: Component
  color: string
  manage: TeamManageSpec
}

export const TEAM_COLLAB_ITEMS: TeamCollabItem[] = [
  { key: 'requirements', label: '需求管理', icon: SolutionOutlined, color: '#3370ff', manage: { kind: 'issue', typeName: '需求', insertable: true } },
  { key: 'tasks', label: '任务管理', icon: CheckSquareOutlined, color: '#34c724', manage: { kind: 'issue', typeName: '任务' } },
  { key: 'gantt', label: '排期看板', icon: CalendarOutlined, color: '#ff8800', manage: { kind: 'issue' } },
  { key: 'kanban', label: '看板', icon: ProjectOutlined, color: '#7b61ff', manage: { kind: 'issue' } },
  { key: 'release', label: '上线清单', icon: RocketOutlined, color: '#14c0ff', manage: { kind: 'issue' } },
  { key: 'users', label: '人员', icon: TeamOutlined, color: '#faad14', manage: { kind: 'users' } },
  { key: 'departments', label: '部门', icon: ApartmentOutlined, color: '#5c6370', manage: { kind: 'dept' } },
]
