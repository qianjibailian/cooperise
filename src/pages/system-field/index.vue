<script setup lang="ts">
// 系统字段：功能与「可选字段」一致，但走 SystemFieldController 接口
import {
  querySystemFields, createSystemField, updateSystemField,
  batchDeleteSystemFields, getSystemFieldDetail,
} from '@/api/faiz'
import type { AvailableFieldSavePayload, SystemFieldSavePayload } from '@/types/faiz'
import { toFieldOperator, type FieldOperator } from '@/types/fieldOperator'
import AvailableField from '../available-field/index.vue'

/**
 * 表单 → SystemFieldSaveRequest：type 映射为 filedType；
 * 支持的操作由名称转换为对象数组 [{id, name, code, identifier}]（如 大于 → {code: GREATER_THAN, identifier: '>'}）
 */
function mapPayload(data: AvailableFieldSavePayload): SystemFieldSavePayload {
  const supportOperator = (data.supportOperator ?? [])
    .map(toFieldOperator)
    .filter((o): o is FieldOperator => !!o)
  return { ...data, filedType: data.type, supportOperator }
}

// 系统字段接口集合（单个删除后端未提供，复用批量删除）
const systemFieldApi = {
  query: querySystemFields,
  getDetail: getSystemFieldDetail,
  create: (data: AvailableFieldSavePayload) => createSystemField(mapPayload(data)),
  update: (id: string | number, data: AvailableFieldSavePayload) => updateSystemField(id, mapPayload(data)),
  delete: (id: string | number) => batchDeleteSystemFields([Number(id)]),
  batchDelete: batchDeleteSystemFields,
}
</script>

<template>
  <AvailableField
    :field-api="systemFieldApi"
    :show-system-column="false"
    :show-system-switch="false"
    :show-meta-columns="true"
    :disable-field-num="false"
  />
</template>
