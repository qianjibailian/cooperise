<template>
  <a-tree-select
    :value="modelValue"
    :tree-data="treeData"
    :field-names="{ label: 'organizationName', value: 'id', children: 'children' }"
    tree-default-expand-all
    show-search
    allow-clear
    tree-node-filter-prop="organizationName"
    :placeholder="placeholder"
    popup-class-name="org-select-popup"
    :list-height="320"
    class="org-select"
    @update:value="(v: number | string | undefined) => emit('update:modelValue', v)"
  >
    <template #suffixIcon><ApartmentOutlined /></template>
    <template #title="node">
      <span class="org-option">
        <span class="org-option-avatar" :style="{ background: levelColor(node.id) }">
          <BankOutlined v-if="levelOf(node.id) === 1" />
          <template v-else>{{ (node.organizationName || '组').slice(0, 1) }}</template>
        </span>
        <span class="org-option-name">{{ node.organizationName }}</span>
        <span v-if="levelOf(node.id) === 1" class="org-option-tag">公司</span>
      </span>
    </template>
    <template #notFoundContent>
      <div class="org-option-empty">暂无组织，请先在「组织管理」中添加</div>
    </template>
  </a-tree-select>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ApartmentOutlined, BankOutlined } from '@ant-design/icons-vue'
import type { OrganizationNode } from '@/api/faiz'

/** 组织树下拉：公司显示大楼图标，各层级配色与组织管理页一致 */
const props = withDefaults(defineProps<{
  modelValue?: number | string
  treeData: OrganizationNode[]
  placeholder?: string
}>(), {
  modelValue: undefined,
  placeholder: '选择所属组织',
})
const emit = defineEmits<{ 'update:modelValue': [value: number | string | undefined] }>()

/** 组织层级（公司 = 1） */
const levelMap = computed(() => {
  const map = new Map<number, number>()
  const visit = (nodes: OrganizationNode[], level: number) => nodes.forEach((n) => {
    map.set(n.id, level)
    if (n.children?.length) visit(n.children, level + 1)
  })
  visit(props.treeData, 1)
  return map
})
const LEVEL_COLORS = ['#0A84FF', '#5E5CE6', '#30B0C7', '#34C759']
function levelOf(id: number) {
  return levelMap.value.get(id) ?? 1
}
function levelColor(id: number) {
  return LEVEL_COLORS[(levelOf(id) - 1) % LEVEL_COLORS.length]
}
</script>

<style>
/* 组织下拉：弹层挂在 body 下，需非 scoped */
.org-select-popup {
  padding: 6px !important;
  border-radius: 12px !important;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06) !important;
}

.org-select-popup .ant-select-tree .ant-select-tree-treenode {
  width: 100%;
  padding: 0 0 2px;
}

.org-select-popup .ant-select-tree .ant-select-tree-node-content-wrapper {
  flex: 1;
  min-width: 0;
  min-height: 34px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  border-radius: 8px;
  transition: background 0.15s;
}

.org-select-popup .ant-select-tree .ant-select-tree-node-content-wrapper:hover {
  background: #f5f5f7;
}

.org-select-popup .ant-select-tree .ant-select-tree-node-content-wrapper.ant-select-tree-node-selected {
  background: var(--c-primary-bg);
}

.org-select-popup .ant-select-tree .ant-select-tree-node-selected .org-option-name {
  font-weight: 600;
  color: var(--c-primary);
}

.org-select-popup .ant-select-tree .ant-select-tree-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  line-height: 34px;
  color: #8e8e93;
}

.org-select-popup .ant-select-tree .ant-select-tree-switcher-noop {
  visibility: hidden;
}

.org-select-popup .ant-select-tree .ant-select-tree-title {
  display: block;
  min-width: 0;
}

.org-select-popup .ant-select-tree .ant-select-tree-treenode-disabled .org-option {
  opacity: 0.45;
}

.org-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.org-option-avatar {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}

.org-option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #1d1d1f;
}

.org-option-tag {
  flex-shrink: 0;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  color: var(--c-primary);
  background: var(--c-primary-bg);
  border-radius: 999px;
}

.org-option-empty {
  padding: 16px 8px;
  font-size: 13px;
  text-align: center;
  color: #86868b;
}

/* 选择框内回显：与弹层选项一致的紧凑样式 */
.org-select .ant-select-selection-item .org-option-tag {
  display: none;
}

.org-select .ant-select-selection-item .org-option {
  height: 100%;
}
</style>
