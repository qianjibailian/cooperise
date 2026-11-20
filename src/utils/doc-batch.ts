import { Modal, message } from 'ant-design-vue'
import { deleteDocFolder, trashDoc } from '@/api/docs'

/** 多选的一项：文档或文件夹 */
export interface BatchItem {
  kind: 'folder' | 'doc'
  id: string
}

export interface BatchHooks {
  /** 文档已移入回收站：页面更新本地数据 */
  onDocRemoved(id: string): void
  /** 文件夹已删除（内容移到上一级）：页面更新本地数据 */
  onFolderRemoved(id: string): void
}

/**
 * 批量删除（文档移入回收站，文件夹删除后内容移到上一级）。
 * 先弹确认框；逐个调用接口，单项失败不影响其它项，最后汇总结果。
 */
export function batchDelete(items: BatchItem[], hooks: BatchHooks): void {
  if (!items.length) return
  const docCount = items.filter((i) => i.kind === 'doc').length
  const folderCount = items.length - docCount
  const parts = [docCount ? `${docCount} 个文档` : '', folderCount ? `${folderCount} 个文件夹` : '']
    .filter(Boolean)
    .join('、')
  Modal.confirm({
    title: '删除',
    content: `确定删除选中的 ${parts}？文档会移入回收站，文件夹内的内容会移到上一级。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      let ok = 0
      let fail = 0
      for (const it of items) {
        try {
          if (it.kind === 'doc') {
            const res = await trashDoc(it.id)
            if (!res.success) throw new Error('删除失败')
            hooks.onDocRemoved(it.id)
          } else {
            const res = await deleteDocFolder(it.id)
            if (!res.success) throw new Error('删除失败')
            hooks.onFolderRemoved(it.id)
          }
          ok++
        } catch {
          fail++
        }
      }
      if (fail) message.warning(`已删除 ${ok} 项，${fail} 项失败`)
      else message.success(`已删除 ${ok} 项`)
    },
  })
}
