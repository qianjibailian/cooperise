import request from '@/utils/request'
import type { Result } from '@/types/faiz'
import type { DocItem, DocFolder, DocLibrary, DocType, DocPosition, SheetData, MindmapData, FlowData, DocMeta, VoteData, FormData } from '@/types/docs'

/**
 * ==================== 文档系统 API ====================
 *
 * 前端数据模型见 src/types/docs.ts：
 * - DocItem   文档（doc 富文本 / sheet 表格 / mindmap 思维导图 / flow 流程图）
 * - DocFolder 文件夹（知识库）
 *
 * 对后端的约定：
 * 1. 用户身份从登录态解析（token），前端不传 userId；
 * 2. 文档 / 文件夹 id 由后端生成（前端 genDocId 仅本地兜底，切接口后忽略）；
 * 3. content 为富文本 HTML 字符串；data 为表格 / 思维导图 / 流程图的 JSON
 *    （SheetData / MindmapData / FlowData，按 type 存 JSON 字符串或 JSON 列均可，
 *    返回时反序列化为对象）；
 * 4. 时间戳（createdAt / updatedAt / deletedAt）用毫秒数，与前端现有展示逻辑一致；
 * 5. 回收站 = 文档软删除（deletedAt 非空），回收站列表 / 恢复 / 彻底删除 / 清空均基于该标记；
 * 6. 删除文件夹时，文件夹内文档自动移到「未分组」（folderId 置空），不删除文档。
 */

/** 文档创建入参：标题默认「无标题文档」，表格 / 思维导图 / 流程图的初始 data 由前端传入 */
export interface DocCreatePayload {
  title?: string
  type: DocType
  /** 所属知识库 id（空表示个人文档） */
  libraryId?: string
  /** 所属文件夹 id（知识库内），空表示知识库根目录 / 未分组 */
  folderId?: string
  /** 创建位置：home = 主页创建，library = 知识库内创建；后端需持久化并随 DocItem 返回 */
  position: DocPosition
  /** 富文本初始 HTML（上传 / 模板导入时传入） */
  content?: string
  /** 表格 / 思维导图 / 流程图初始数据 */
  data?: SheetData | MindmapData | FlowData | DocMeta | VoteData | FormData
}

/** 文档内容保存入参：整篇覆盖式保存（编辑器 400ms 防抖自动保存） */
export interface DocSavePayload {
  title?: string
  content?: string
  /** 表格 / 思维导图 / 流程图数据；富文本文档为图标 / 封面（DocMeta） */
  data?: SheetData | MindmapData | FlowData | DocMeta | VoteData | FormData
}

/** 回收站文档：文档 + 删除时间 */
export type TrashedDoc = DocItem & { deletedAt?: number }

// ==================== 知识库 ====================

/** 知识库列表（GET /docs/library/list）：当前用户可见的全部知识库，按 createdAt 升序 */
export function listDocLibraries(): Promise<Result<DocLibrary[]>> {
  return request.get(`/docs/library/list`)
}

/** 新建知识库（POST /docs/library/create）：id、createdAt 由后端生成 */
export function createDocLibrary(data: {
  name: string
  desc?: string
  visibility: 'members' | 'all'
}): Promise<Result<DocLibrary>> {
  return request.post(`/docs/library/create`, data)
}

/** 重命名 / 修改简介（POST /docs/library/update） */
export function updateDocLibrary(data: { id: string; name?: string; desc?: string; cover?: string }): Promise<Result<void>> {
  return request.post(`/docs/library/update`, data)
}

/** 知识库置顶 / 取消置顶（POST /docs/library/star） */
export function starDocLibrary(data: { id: string; starred: boolean }): Promise<Result<void>> {
  return request.post(`/docs/library/star`, data)
}

/**
 * 删除知识库（POST /docs/library/delete）
 * 库内文件夹一并删除；库内文档移到「不在知识库内」（libraryId / folderId 置空），不删除文档。
 */
export function deleteDocLibrary(id: string): Promise<Result<void>> {
  return request.post(`/docs/library/delete`, { id })
}

// ==================== 文件夹（归属知识库，可嵌套） ====================

/** 文件夹列表（GET /docs/folder/list）：当前用户全部知识库内的文件夹，按 createdAt 升序 */
export function listDocFolders(): Promise<Result<DocFolder[]>> {
  return request.get(`/docs/folder/list`)
}

/**
 * 新建文件夹（POST /docs/folder/create）：id、createdAt 由后端生成。
 * libraryId 必填；parentId 为空表示挂在知识库根目录下。
 */
export function createDocFolder(data: { name: string; libraryId: string; parentId?: string }): Promise<Result<DocFolder>> {
  return request.post(`/docs/folder/create`, data)
}

/** 重命名文件夹（POST /docs/folder/rename） */
export function renameDocFolder(data: { id: string; name: string }): Promise<Result<void>> {
  return request.post(`/docs/folder/rename`, data)
}

/** 文件夹置顶 / 取消置顶（POST /docs/folder/star） */
export function starDocFolder(data: { id: string; starred: boolean }): Promise<Result<void>> {
  return request.post(`/docs/folder/star`, data)
}

/**
 * 删除文件夹（POST /docs/folder/delete）
 * 文件夹内文档与子文件夹上移一级（folderId / parentId 改为被删文件夹的 parentId，为空则到知识库根目录），不删除文档。
 */
export function deleteDocFolder(id: string): Promise<Result<void>> {
  return request.post(`/docs/folder/delete`, { id })
}

// ==================== 文档 ====================

/** 文档查询入参（POST /docs/list）：全部可选，不传 = 当前用户的全部未删除文档 */
export interface DocListQuery {
  /** 按文件夹过滤；'none' 表示未分组（folderId 为空）的文档 */
  folderId?: string | 'none'
  /** 按类型过滤 */
  type?: DocType
  /** 标题模糊搜索 */
  keyword?: string
  /** 只看收藏 */
  starred?: boolean
}

/**
 * 文档列表（POST /docs/list）：当前用户可见的未删除文档，按 updatedAt 倒序。
 * 返回完整 DocItem（含 content / data）；列表体积成为瓶颈时可改为列表只返回
 * 摘要（不含 content / data），详情用 getDocDetail 拉取，前端已预留该接口。
 */
export function listDocs(data?: DocListQuery): Promise<Result<DocItem[]>> {
  return request.post(`/docs/list`, data)
}

/** 文档详情（GET /docs/{id}）：含 content / data，供打开文档时按需拉取 */
export function getDocDetail(id: string): Promise<Result<DocItem>> {
  return request.get(`/docs/${id}`)
}

/** 新建文档（POST /docs/create）：id / createdAt / updatedAt / author 由后端生成 */
export function createDoc(data: DocCreatePayload): Promise<Result<DocItem>> {
  return request.post(`/docs/create`, data)
}

/**
 * 保存文档内容（PUT /docs/{id}/content）：整篇覆盖，编辑器 400ms 防抖自动保存调用。
 * 只更新传入的字段；updatedAt 由后端刷新并随 DocItem 返回（前端刷新列表时间显示）。
 * 注意：前端全局拦截器会 toast Result.message，本接口请返回空 message（或「保存成功」以外的空文案），
 * 避免连续输入时每次自动保存都弹全局提示。
 */
export function saveDocContent(id: string, data: DocSavePayload): Promise<Result<DocItem>> {
  return request.put(`/docs/${id}/content`, data)
}

/** 重命名文档（POST /docs/rename），同时刷新 updatedAt */
export function renameDoc(data: { id: string; title: string }): Promise<Result<DocItem>> {
  return request.post(`/docs/rename`, data)
}

/** 移动文档到文件夹（POST /docs/move）：folderId 传空 / null 表示移到「未分组」 */
export function moveDoc(data: { id: string; libraryId?: string | null; folderId?: string | null }): Promise<Result<DocItem>> {
  return request.post(`/docs/move`, data)
}

/** 文档收藏 / 取消收藏（POST /docs/star） */
export function starDoc(data: { id: string; starred: boolean }): Promise<Result<DocItem>> {
  return request.post(`/docs/star`, data)
}

// ==================== 回收站 ====================

/** 回收站列表（GET /docs/trash/list）：deletedAt 倒序 */
export function listTrashDocs(): Promise<Result<TrashedDoc[]>> {
  return request.get(`/docs/trash/list`)
}

/** 移到回收站（POST /docs/trash）：软删除，记录 deletedAt */
export function trashDoc(id: string): Promise<Result<void>> {
  return request.post(`/docs/trash`, { id })
}

/** 从回收站恢复（POST /docs/restore）：清掉 deletedAt，回到文档列表 */
export function restoreDoc(id: string): Promise<Result<void>> {
  return request.post(`/docs/restore`, { id })
}

/** 彻底删除（POST /docs/delete）：物理删除，不可恢复 */
export function purgeDoc(id: string): Promise<Result<void>> {
  return request.post(`/docs/delete`, { id })
}

/** 清空回收站（POST /docs/trash/empty）：物理删除当前用户回收站的全部文档 */
export function emptyTrash(): Promise<Result<void>> {
  return request.post(`/docs/trash/empty`)
}

// ==================== 分享（协作者与链接分享同时生效） ====================

/** 链接分享范围：OFF-未开启（仅协作者可访问）/ ORG-组织内可访问 / ALL-所有人可访问（拿到链接即可查看） */
export type DocLinkScope = 'OFF' | 'ORG' | 'ALL'

/** 协作者权限：MANAGE 可管理（可设置分享与协作者）/ EDIT 可编辑 / READ 可阅读（默认） */
export type DocPermission = 'MANAGE' | 'EDIT' | 'READ'

/** 协作者：姓名、工号、头像由后端按 memberId 补全；permission 缺省按 READ 处理 */
export interface DocShareMember {
  memberId: string
  realName?: string
  coAccount?: string
  avatarUrl?: string | null
  permission?: DocPermission
}

/** 分享信息：owner 表示当前用户是否为创建人（仅创建人可修改） */
export interface DocShareInfo {
  owner: boolean
  collaborators: DocShareMember[]
  linkScope: DocLinkScope
}

/** 文档分享信息（POST /docs/share/info）：创建人与被分享人可读 */
export function getDocShareInfo(id: string): Promise<Result<DocShareInfo>> {
  return request.post(`/docs/share/info`, { id })
}

/**
 * 设置协作者（POST /docs/share/collaborators，仅创建人）：collaborators 为完整列表，整体覆盖。
 * 每个协作者带权限：MANAGE / EDIT / READ；后端需按权限做访问控制。
 */
export function setDocCollaborators(data: {
  id: string
  collaborators: { memberId: string; permission: DocPermission }[]
}): Promise<Result<void>> {
  return request.post(`/docs/share/collaborators`, data)
}

/** 设置链接分享范围（POST /docs/share/link，仅创建人） */
export function setDocLinkScope(data: { id: string; scope: DocLinkScope }): Promise<Result<void>> {
  return request.post(`/docs/share/link`, data)
}

/** 共享给我的文档（POST /docs/shared）：「共享」导航页数据源，按 updatedAt 倒序 */
export function listSharedDocs(): Promise<Result<DocItem[]>> {
  return request.post(`/docs/shared`)
}

// ==================== 事项关联文档（事项详情「相关文档」模块） ====================

/** 事项关联的文档摘要（不含 content / data） */
export interface IssueDocItem {
  id: string
  title: string
  type: DocType
  /** 创建人 */
  author?: string
  updatedAt?: number
}

/** 事项的相关文档（POST /docs/issue/list）：按关联时间倒序，已进回收站 / 已删除的文档不返回 */
export function listIssueDocs(issueKey: string): Promise<Result<IssueDocItem[]>> {
  return request.post(`/docs/issue/list`, { issueKey })
}

/** 关联文档到事项（POST /docs/issue/link）：docIds 为本次新增的文档，已关联的忽略（幂等） */
export function linkIssueDocs(data: { issueKey: string; docIds: string[] }): Promise<Result<void>> {
  return request.post(`/docs/issue/link`, data)
}

/** 取消事项与文档的关联（POST /docs/issue/unlink）：只解除关联，不删除文档 */
export function unlinkIssueDoc(data: { issueKey: string; docId: string }): Promise<Result<void>> {
  return request.post(`/docs/issue/unlink`, data)
}

// ==================== 附件上传（预留：富文本「视频或文件」块） ====================

/**
 * 附件上传（POST /docs/upload，multipart/form-data）
 * 入参：file；onProgress 为上传进度（0-100）；返回可直接放进富文本的访问地址 url。
 */
export function uploadDocAttachment(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Result<{ url: string; name: string; size: number }>> {
  const form = new FormData()
  form.append('file', file)
  return request.post(`/docs/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
    },
  })
}

/** 提交文件解析（POST /docs/parse，异步）：解析已上传附件的文本，追加到文档正文 */
export function submitDocParse(docId: string, fileName: string): Promise<Result<void>> {
  return request.post(`/docs/parse`, { docId, fileName })
}

/** 文件解析状态（GET /docs/parse/{docId}）：none / pending / done / failed */
export function getDocParseStatus(docId: string): Promise<Result<{ state: string; message?: string }>> {
  return request.get(`/docs/parse/${docId}`)
}

/** 知识库仓库同步配置（凭证不回显） */
export interface DocSyncConfig {
  libraryId: string
  configured: boolean
  gitlabUrl?: string
  projectPath?: string
  branch?: string
  subdir?: string
  hasToken: boolean
  editable: boolean
  enabled: boolean
  webhookSecret?: string
  status?: string
  lastSyncedAt?: number
  lastCommit?: string
  lastError?: string
}

export function getDocSync(libraryId: string): Promise<Result<DocSyncConfig>> {
  return request.get(`/docs/sync/${libraryId}`)
}

export function saveDocSync(data: {
  libraryId: string
  gitlabUrl: string

  branch: string
  subdir?: string
  token?: string
  editable: boolean
  enabled: boolean
}): Promise<Result<void>> {
  return request.post(`/docs/sync/save`, data)
}

export function runDocSync(libraryId: string): Promise<Result<void>> {
  return request.post(`/docs/sync/${libraryId}/run`)
}

/** 暂停进行中的同步：已同步部分保留，下次「立即同步」自动从断点继续（按 sha 跳过已完成文件） */
export function pauseDocSync(libraryId: string): Promise<Result<void>> {
  return request.post(`/docs/sync/${libraryId}/pause`)
}

/** 取消进行中的同步：中止本轮并丢弃未落库的结果，状态记为已取消 */
export function cancelDocSync(libraryId: string): Promise<Result<void>> {
  return request.post(`/docs/sync/${libraryId}/cancel`)
}

/** 测试仓库连接（不保存、不同步）：凭证留空则沿用已保存的凭证 */
export interface DocSyncTestResult {
  ok: boolean
  message: string
  commit?: string
  docFiles?: number
}

export function testDocSync(data: {
  libraryId: string
  gitlabUrl: string

  branch: string
  subdir?: string
  token?: string
  editable: boolean
  enabled: boolean
}): Promise<Result<DocSyncTestResult>> {
  return request.post(`/docs/sync/test`, data)
}

/** 同步进度看板（GET /docs/sync/{libraryId}/progress）：status 为 none 表示尚未同步过 */
export interface DocSyncProgress {
  libraryId: string
  status: 'none' | 'running' | 'done' | 'failed' | 'paused' | 'cancelled'
  phase: string
  current?: string
  total: number
  processed: number
  created: number
  updated: number
  skipped: number
  conflicts: number
  removed: number
  failed: number
  startedAt?: number
  finishedAt?: number
  message?: string
  errors: string[]
}

export function getDocSyncProgress(libraryId: string): Promise<Result<DocSyncProgress>> {
  return request.get(`/docs/sync/${libraryId}/progress`)
}

// ==================== 投票 / 表单：答题与统计 ====================

/** 我的答题（GET /docs/{id}/response/me） */
export function getMyDocResponse(docId: string): Promise<Result<{ answer: Record<string, unknown> | null }>> {
  return request.get(`/docs/${docId}/response/me`)
}

/** 提交答题（POST /docs/response/submit，重复提交覆盖） */
export function submitDocResponse(docId: string, answer: Record<string, unknown>): Promise<Result<null>> {
  return request.post(`/docs/response/submit`, { docId, answer })
}

/** 统计结果（GET /docs/{id}/stats） */
export function getDocStats(docId: string): Promise<Result<import('@/types/docs').DocStats>> {
  return request.get(`/docs/${docId}/stats`)
}
