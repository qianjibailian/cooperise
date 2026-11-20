/**
 * 事项操作按钮（/issue-button/issue）的执行逻辑
 * 详情抽屉、详情页、事项列表「···」下拉共用
 */
import { h } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { changeWorkflowTaskStatus, copyIssue, type IssueButtonItem } from '@/api/faiz'
import { getLoginUsername } from '@/utils/auth'

/** 状态流转 / 回退：走工作流 change-status */
export function isWorkflowButton(btn: IssueButtonItem): boolean {
  return btn.actionType === 'TRANSITION' || btn.actionType === 'ROLLBACK'
}

export interface IssueButtonHandlers {
  /** EDIT：打开编辑弹窗 */
  onEdit?: () => void
  /** ASSIGN：打开分配经办人弹窗（分配成功由弹窗的提交事件刷新） */
  onAssign?: () => void
  /** SPLIT：打开拆分任务弹窗（拆分成功由弹窗的提交事件刷新） */
  onSplit?: () => void
}

/**
 * 执行按钮动作；返回 true 表示事项数据已变化（调用方需刷新详情 / 列表 / 按钮）
 * - TRANSITION / ROLLBACK：确认后以 targetNodeId 调 /workflow/task/change-status
 * - COPY：确认后调 /issue/copy 复制出新事项
 * - EDIT / ASSIGN / SPLIT：交给调用方打开编辑 / 分配 / 拆分弹窗（保存后由弹窗的提交事件刷新）
 * - 其余动作暂未实现，给出提示
 */
export function runIssueButton(btn: IssueButtonItem, issueKey: string, handlers: IssueButtonHandlers = {}): Promise<boolean> {
  if (isWorkflowButton(btn)) return confirmTransition(btn, issueKey)
  if (btn.actionType === 'COPY') return confirmCopy(btn, issueKey)
  if (btn.actionType === 'EDIT' && handlers.onEdit) {
    handlers.onEdit()
    return Promise.resolve(false)
  }
  if (btn.actionType === 'ASSIGN' && handlers.onAssign) {
    handlers.onAssign()
    return Promise.resolve(false)
  }
  if (btn.actionType === 'SPLIT' && handlers.onSplit) {
    handlers.onSplit()
    return Promise.resolve(false)
  }
  message.info(`「${btn.buttonName}」功能暂未开放`)
  return Promise.resolve(false)
}

function confirmTransition(btn: IssueButtonItem, issueKey: string): Promise<boolean> {
  if (!btn.targetNodeId) {
    message.warning('未找到可流转的目标节点')
    return Promise.resolve(false)
  }
  const target = btn.targetStatusName || btn.targetStatusCode
  return new Promise((resolve) => {
    Modal.confirm({
      title: `确认「${btn.buttonName}」？`,
      content: target ? h('span', ['事项 ', h('b', issueKey), ' 将变更为「', h('b', target), '」']) : `事项 ${issueKey} 将按流程流转到下一节点`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: btn.buttonStyle === 'danger' ? { danger: true } : undefined,
      centered: true,
      async onOk() {
        try {
          const res = await changeWorkflowTaskStatus({
            issueKey,
            targetStatus: btn.targetNodeId as string,
            ...(btn.targetStatusCode ? { statusId: btn.targetStatusCode } : {}),
            operator: getLoginUsername() || localStorage.getItem('wf_current_user') || '',
          })
          if (res?.success) {
            resolve(true)
            return
          }
        } catch {
          // 请求层已统一提示
        }
        resolve(false)
      },
      onCancel() {
        resolve(false)
      },
    })
  })
}

function confirmCopy(btn: IssueButtonItem, issueKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: `确认「${btn.buttonName}」？`,
      content: h('span', ['将以事项 ', h('b', issueKey), ' 为模板新建一个事项：沿用字段值，概要加「【复制】」前缀，状态从流程起点开始']),
      okText: '复制',
      cancelText: '取消',
      centered: true,
      async onOk() {
        try {
          const res = await copyIssue({ issueKey })
          if (res?.success) {
            message.success(res.data ? `已复制为 ${res.data}` : '复制成功')
            resolve(true)
            return
          }
        } catch {
          // 请求层已统一提示
        }
        resolve(false)
      },
      onCancel() {
        resolve(false)
      },
    })
  })
}
