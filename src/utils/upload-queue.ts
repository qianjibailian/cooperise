import { reactive, ref } from 'vue'

/**
 * 文件上传队列（全局）：页面切换后上传仍在进行，右下角进度小窗统一展示。
 * - 最多同时上传 MAX_CONCURRENCY 个文件；
 * - 每个文件一行，显示名称、状态与进度；
 * - 全部完成后 uploadDoneSeq 递增，页面据此刷新文档 / 文件夹列表。
 */

export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: number
  name: string
  /** 0-100 */
  progress: number
  /** 当前阶段说明（如「解析中」），有值时替换百分比显示 */
  stage?: string
  status: UploadStatus
  error?: string
}

export interface UploadContext {
  progress: (percent: number) => void
  stage: (text: string) => void
}

export interface UploadJob {
  name: string
  /** 执行上传：通过 ctx 汇报进度（0-100）与阶段说明 */
  run: (ctx: UploadContext) => Promise<void>
}

const MAX_CONCURRENCY = 3

/** 所有上传任务（含已完成，直到用户清除） */
export const uploadItems = reactive<UploadItem[]>([])
/** 小窗是否收起 */
export const uploadPanelCollapsed = ref(false)
/** 一批上传全部结束时递增 */
export const uploadDoneSeq = ref(0)

let seq = 0
let running = 0
const pending: { id: number; job: UploadJob }[] = []

/** 加入上传队列；返回的 id 可用于定位任务 */
export function enqueueUploads(jobs: UploadJob[]): void {
  if (!jobs.length) return
  for (const job of jobs) {
    const id = ++seq
    uploadItems.push({ id, name: job.name, progress: 0, status: 'waiting' })
    pending.push({ id, job })
  }
  uploadPanelCollapsed.value = false
  pump()
}

function findItem(id: number): UploadItem | undefined {
  return uploadItems.find((it) => it.id === id)
}

function pump(): void {
  while (running < MAX_CONCURRENCY && pending.length) {
    const next = pending.shift()
    if (!next) break
    running++
    void runOne(next.id, next.job)
  }
}

async function runOne(id: number, job: UploadJob): Promise<void> {
  const item = findItem(id)
  if (item) item.status = 'uploading'
  try {
    await job.run({
      progress: (percent) => {
        const it = findItem(id)
        if (it) it.progress = Math.max(0, Math.min(100, percent))
      },
      stage: (text) => {
        const it = findItem(id)
        if (it) it.stage = text || undefined
      },
    })
    const it = findItem(id)
    if (it) {
      it.progress = 100
      it.status = 'done'
    }
  } catch (e: any) {
    const it = findItem(id)
    if (it) {
      it.status = 'error'
      it.error = e?.message || '上传失败'
    }
  } finally {
    running--
    // 队列全部结束才通知页面刷新，避免每个文件都刷新一次
    if (running === 0 && pending.length === 0) uploadDoneSeq.value++
    pump()
  }
}

/** 清除已完成 / 失败的任务（进行中的保留） */
export function clearFinishedUploads(): void {
  for (let i = uploadItems.length - 1; i >= 0; i--) {
    const s = uploadItems[i].status
    if (s === 'done' || s === 'error') uploadItems.splice(i, 1)
  }
}
