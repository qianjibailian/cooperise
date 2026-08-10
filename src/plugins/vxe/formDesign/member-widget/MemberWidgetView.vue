<template>
  <vxe-form-item :field="currWidget.field" :title="currWidget.title">
    <a-select
      v-model:value="widgetModelValue"
      :placeholder="widgetOpts.placeholder"
      :mode="widgetOpts.multiple ? 'multiple' : undefined"
      :allow-clear="widgetOpts.clearable !== false"
      show-search
      :filter="false"
      :options="memberOptions"
      :field-names="{ label: 'userEnName', value: 'userNo' }"
      :loading="memberLoading"
      @search="handleMemberSearch"
      style="width: 100%"
    />
  </vxe-form-item>
</template>

<script lang="ts" setup>
import { PropType, ref, computed } from 'vue'
import { VxeUI, VxeGlobalRendererHandles } from 'vxe-pc-ui'
import { FormDesignWidgetMemberProps } from './widget'
import { queryUsers } from '@/api/faiz'
import type { UserItem } from '@/types/faiz'

const { useWidgetView } = VxeUI.formDesignHandle

const props = defineProps({
  renderOpts: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetViewOptions>,
    default: () => ({})
  },
  renderParams: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetViewParams<FormDesignWidgetMemberProps>>,
    default: () => ({})
  }
})

const { currWidget, widgetModel } = useWidgetView<FormDesignWidgetMemberProps>(props)

// 数据兜底，避免 currWidget.value.options.xxx 直接读 undefined 抛错
const widgetOpts = computed<Required<FormDesignWidgetMemberProps>>(() => {
  const raw = currWidget.value?.options || {}
  return {
    placeholder: raw.placeholder ?? '请搜索并选择成员',
    clearable: raw.clearable !== false,
    multiple: !!raw.multiple,
  }
})

// a-select 多选模式下 value 应该是数组，单选下是 string/undefined
const widgetModelValue = computed({
  get: () => {
    const v = widgetModel.value
    if (widgetOpts.value.multiple) {
      return Array.isArray(v) ? v : (v ? [v] : [])
    }
    return v == null ? undefined : v
  },
  set: (val) => {
    widgetModel.value = val
  }
})

const memberOptions = ref<UserItem[]>([])
const memberLoading = ref(false)
let memberSearchTimer: ReturnType<typeof setTimeout> | null = null

function handleMemberSearch(keyword: string) {
  if (memberSearchTimer) clearTimeout(memberSearchTimer)
  memberSearchTimer = setTimeout(async () => {
    memberLoading.value = true
    try {
      const res = await queryUsers({ keyword: keyword ?? '', isActive: 1, page: 1, pageSize: 20 })
      if (res.success && res.data && Array.isArray(res.data.list)) {
        memberOptions.value = res.data.list
      } else {
        memberOptions.value = []
      }
    } catch {
      memberOptions.value = []
    } finally {
      memberLoading.value = false
    }
  }, 300)
}

// 初始加载一次默认用户列表
handleMemberSearch('')
</script>
