<script setup lang="ts">
// 系统字段：功能与「可选字段」一致，但走 SystemFieldController 接口
import { querySystemFields, batchDeleteSystemFields } from '@/api/faiz'
import { systemFieldEditApi } from '@/utils/fieldConfig'
import AvailableField from '../available-field/index.vue'

/** 空间「字段管理」嵌入时传入：只管理关联本空间问题类型的自定义字段 */
const props = defineProps<{ spaceCode?: string; customOnly?: boolean }>()

// 系统字段接口集合：详情 / 新增 / 更新与模板编辑「新建字段」共用（单个删除后端未提供，复用批量删除）
const systemFieldApi = {
  query: querySystemFields,
  ...systemFieldEditApi,
  delete: (id: string | number) => batchDeleteSystemFields([Number(id)]),
  batchDelete: batchDeleteSystemFields,
}
</script>

<template>
  <AvailableField
    :field-api="systemFieldApi"
    :show-system-column="true"
    :show-system-switch="true"
    :show-filters="true"
    :show-meta-columns="true"
    :disable-field-num="false"
    :custom-only="props.customOnly"
    :space-code="props.spaceCode"
  />
</template>
