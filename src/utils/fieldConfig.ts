/**
 * 字段配置共用：展示场景（展示 / 必填 / 可编辑）规则、字段编辑弹窗的接口约定
 * 字段管理列表、字段编辑弹窗（FieldEditModal）、模板编辑里新建字段共用
 */
import { createSystemField, getSystemFieldDetail, updateSystemField } from '@/api/faiz'
import type { AvailableFieldSavePayload, SystemFieldSavePayload } from '@/types/faiz'
import { toFieldOperator, type FieldOperator, type RawFieldOperator } from '@/types/fieldOperator'

// ---- 展示场景 ----
export const SCENE_OPTIONS = [
  { value: 'CREATE', label: '新建' },
  { value: 'EDIT', label: '编辑' },
  { value: 'DETAIL', label: '详情' },
  { value: 'LIST', label: '列表' },
]

export const SCENE_DESC: Record<string, string> = {
  CREATE: '新建事项弹窗中的表单项',
  EDIT: '编辑事项弹窗中的表单项',
  DETAIL: '事项详情页 / 详情抽屉中的字段',
  LIST: '事项列表中可展示的列',
}

/** 新字段默认展示的场景 */
export const DEFAULT_DISPLAY_SCENE = ['CREATE', 'EDIT', 'DETAIL']

export function sceneLabel(scene: string) {
  return SCENE_OPTIONS.find(o => o.value === scene)?.label ?? scene
}

/** 按场景枚举顺序排列，避免提交 / 展示顺序随点击变化 */
export function sortScenes(list: string[]) {
  return SCENE_OPTIONS.map(o => o.value).filter(v => list.includes(v))
}

/** 必填场景：老接口未返回 requiredScene 时，必填字段视为在其展示场景都必填 */
export function requiredScenesOf(r: { requiredScene?: string[] | null; isRequired?: boolean; displayScene?: string[] | null }): string[] {
  if (Array.isArray(r.requiredScene)) return r.requiredScene
  if (!r.isRequired) return []
  return r.displayScene?.length ? [...r.displayScene] : ['CREATE', 'EDIT']
}

/** 可编辑场景：未配置时为全部展示场景（即所有场景可编辑） */
export function editableScenesOf(r: { editableScene?: string[] | null; displayScene?: string[] | null }): string[] {
  if (Array.isArray(r.editableScene)) return [...r.editableScene]
  return r.displayScene?.length ? [...r.displayScene] : SCENE_OPTIONS.map(o => o.value)
}

// ---- 字段行 / 编辑弹窗接口 ----
/** 通用字段行结构（兼容 AvailableFieldItem 与 SystemFieldItem） */
export interface FieldRow {
  id?: string
  fieldId?: string
  fieldName?: string
  type?: string
  /** 后端返回的原始类型字段（系统字段 VO 为 filedType，可选字段两者都有） */
  filedType?: string
  fieldGroup?: string
  isRequired?: boolean
  obsolete?: boolean
  isSystem?: boolean
  /** 系统字段为对象数组 {id,name,code,identifier}，自定义字段为名称字符串 */
  supportOperator?: RawFieldOperator[] | null
  configSchema?: string | null
  fieldValue?: string | null
  /** 展示场景：CREATE（新建）/ EDIT（编辑）/ DETAIL（详情）/ LIST（列表） */
  displayScene?: string[]
  requiredScene?: string[]
  editableScene?: string[]
  /** 关联的问题类型编码（自定义字段至少一个） */
  issueTypeCodes?: string[]
  /** 系统字段特有：启用状态、创建人/更新人、创建/更新时间 */
  status?: boolean
  creator?: string | null
  updater?: string | null
  createTime?: string | null
  updateTime?: string | null
}

/** 字段编辑弹窗用到的接口：详情回填、新增（返回新建字段）、更新 */
export interface FieldEditApi {
  getDetail: (id: string | number) => Promise<{ success?: boolean; data?: FieldRow | null }>
  create: (data: AvailableFieldSavePayload) => Promise<{ success?: boolean; data?: FieldRow | null | void }>
  update: (id: string | number, data: AvailableFieldSavePayload) => Promise<{ success?: boolean }>
}

/**
 * 表单 → SystemFieldSaveRequest：type 映射为 filedType；
 * 支持的操作由名称转换为对象数组 [{id, name, code, identifier}]（如 大于 → {code: GREATER_THAN, identifier: '>'}）
 */
export function toSystemFieldPayload(data: AvailableFieldSavePayload): SystemFieldSavePayload {
  const supportOperator = (data.supportOperator ?? [])
    .map(toFieldOperator)
    .filter((o): o is FieldOperator => !!o)
  return { ...data, filedType: data.type, supportOperator }
}

/** 字段表（custom_field）接口：系统字段页与模板编辑「新建字段」共用 */
export const systemFieldEditApi: FieldEditApi = {
  getDetail: getSystemFieldDetail,
  create: (data) => createSystemField(toSystemFieldPayload(data)),
  update: (id, data) => updateSystemField(id, toSystemFieldPayload(data)),
}
