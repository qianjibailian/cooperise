import type { Component } from 'vue'
import {
  TagsOutlined,
  BulbOutlined,
  BugOutlined,
  CheckSquareOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  ToolOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  StarOutlined,
  FlagOutlined,
  ExperimentOutlined,
  SafetyOutlined,
  CodeOutlined,
  ProfileOutlined,
  AlertOutlined,
} from '@ant-design/icons-vue'

/** 问题类型可选图标：iconUri 保存 key（如 bug），前端按 key 渲染对应图标 */
export const ISSUE_TYPE_ICONS: { key: string; label: string; icon: Component }[] = [
  { key: 'tags', label: '标签', icon: TagsOutlined },
  { key: 'bulb', label: '需求', icon: BulbOutlined },
  { key: 'check-square', label: '任务', icon: CheckSquareOutlined },
  { key: 'bug', label: '缺陷', icon: BugOutlined },
  { key: 'thunderbolt', label: '优化', icon: ThunderboltOutlined },
  { key: 'rocket', label: '发布', icon: RocketOutlined },
  { key: 'tool', label: '运维', icon: ToolOutlined },
  { key: 'code', label: '开发', icon: CodeOutlined },
  { key: 'experiment', label: '测试', icon: ExperimentOutlined },
  { key: 'file-text', label: '文档', icon: FileTextOutlined },
  { key: 'profile', label: '故事', icon: ProfileOutlined },
  { key: 'question-circle', label: '咨询', icon: QuestionCircleOutlined },
  { key: 'alert', label: '事故', icon: AlertOutlined },
  { key: 'safety', label: '安全', icon: SafetyOutlined },
  { key: 'flag', label: '里程碑', icon: FlagOutlined },
  { key: 'star', label: '其他', icon: StarOutlined },
]

export const DEFAULT_ISSUE_TYPE_ICON = 'tags'

/** iconUri → 图标组件；未设置或未知 key 时用默认图标 */
export function issueTypeIconOf(iconUri?: string | null): Component {
  return (ISSUE_TYPE_ICONS.find((i) => i.key === iconUri) ?? ISSUE_TYPE_ICONS[0]).icon
}
