<script setup lang="ts">
// 系统字段：功能与「可选字段」一致，但走 SystemFieldController 接口
import {
  querySystemFields, createSystemField, updateSystemField,
  batchDeleteSystemFields, getSystemFieldDetail,
} from '@/api/faiz'
import type { SystemFieldSavePayload } from '@/types/faiz'
import AvailableField from '../available-field/index.vue'

/** 后端 SystemFieldSaveRequest 用 filedType 接收类型，前端表单字段为 type，做映射 */
function mapPayload(data: SystemFieldSavePayload): SystemFieldSavePayload {
  return { ...data, filedType: data.type }
}

// 系统字段接口集合（单个删除后端未提供，复用批量删除）
const systemFieldApi = {
  query: querySystemFields,
  getDetail: getSystemFieldDetail,
  create: (data: SystemFieldSavePayload) => createSystemField(mapPayload(data)),
  update: (id: string | number, data: SystemFieldSavePayload) => updateSystemField(id, mapPayload(data)),
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
  />
</template>
