<script setup lang="ts">
import { computed } from 'vue'
import {
  FileTextOutlined,
  TableOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons-vue'
import type { DocType } from '@/types/docs'

/** 文档类型图标：彩色圆角色块 + 类型图标 */
const props = withDefaults(defineProps<{
  type?: DocType
  size?: 'sm' | 'md'
  /** 菜单 / 侧栏使用：不显示彩色块，改为单色图标 */
  mono?: boolean
}>(), {
  type: 'doc',
  size: 'sm',
  mono: false,
})

const META = {
  doc: { icon: FileTextOutlined, color: '#ffffff', bg: '#3370ff' },
  sheet: { icon: TableOutlined, color: '#ffffff', bg: '#00b96b' },
  mindmap: { icon: ApartmentOutlined, color: '#ffffff', bg: '#7c3aed' },
  flow: { icon: NodeIndexOutlined, color: '#ffffff', bg: '#f59e0b' },
} as const

const meta = computed(() => META[props.type] || META.doc)
</script>

<template>
  <span
    class="doc-type-icon"
    :class="[`is-${props.size}`, { 'is-mono': props.mono }]"
    :style="props.mono ? undefined : { color: meta.color, background: meta.bg }"
  >
    <component :is="meta.icon" />
  </span>
</template>

<style scoped>
.doc-type-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
}
.doc-type-icon.is-sm {
  width: 22px;
  height: 22px;
  font-size: 12px;
  border-radius: 6px;
}
.doc-type-icon.is-md {
  width: 32px;
  height: 32px;
  font-size: 15px;
  border-radius: 8px;
}
/* 菜单 / 侧栏：单色图标，无彩色底 */
.doc-type-icon.is-mono {
  width: 22px;
  height: 22px;
  font-size: 14px;
  color: #8f959e;
  background: transparent;
  border-radius: 0;
}
</style>
