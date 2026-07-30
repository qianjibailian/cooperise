<template>
  <vxe-form
    vertical
    title-bold
    title-overflow
    span="24"
    :data="currWidget.options">
    <vxe-form-item title="控件名称">
      <vxe-input v-model="currWidget.title"></vxe-input>
    </vxe-form-item>
    <vxe-form-item title="页签列表">
      <div class="tabs-edit-list">
        <div
          v-for="(tab, idx) in currWidget.options.tabs"
          :key="tab.key"
          class="tabs-edit-item"
        >
          <span class="tabs-edit-idx">{{ idx + 1 }}.</span>
          <vxe-input
            v-model="tab.name"
            placeholder="页签名称"
            :clearable="false"
          ></vxe-input>
          <button
            v-if="currWidget.options.tabs.length > 1"
            type="button"
            class="tabs-edit-del"
            @click="removeTab(idx)"
            title="删除页签"
          >
            ×
          </button>
        </div>
        <button
          type="button"
          class="tabs-edit-add"
          @click="addTab"
        >
          + 新增页签
        </button>
      </div>
    </vxe-form-item>
    <vxe-form-item title="默认激活页签">
      <vxe-select v-model="currWidget.options.activeKey" placeholder="请选择页签">
        <vxe-option
          v-for="tab in currWidget.options.tabs"
          :key="tab.key"
          :value="tab.key"
          :label="tab.name"
        ></vxe-option>
      </vxe-select>
    </vxe-form-item>
  </vxe-form>
</template>

<script lang="ts" setup>
import { computed, PropType } from 'vue'
import { VxeGlobalRendererHandles } from 'vxe-pc-ui'
import { FormDesignWidgetTabProps, randomTabKey } from './widget'

const props = defineProps({
  renderOpts: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewOptions>,
    default: () => ({})
  },
  renderParams: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetFormViewParams<FormDesignWidgetTabProps>>,
    default: () => ({})
  }
})

const currWidget = computed(() => {
  const { renderParams } = props
  return renderParams.widget
})

function addTab() {
  const k = randomTabKey()
  const idx = currWidget.value.options.tabs.length + 1
  currWidget.value.options.tabs.push({ key: k, name: `页签${idx}` })
}

function removeTab(idx: number) {
  const tabs = currWidget.value.options.tabs
  if (tabs.length <= 1) return
  const removed = tabs[idx]
  tabs.splice(idx, 1)
  if (currWidget.value.options.activeKey === removed.key) {
    currWidget.value.options.activeKey = tabs[Math.max(0, idx - 1)].key
  }
}
</script>

<style scoped>
.tabs-edit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tabs-edit-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tabs-edit-idx {
  width: 22px;
  color: #8c8c8c;
  font-size: 12px;
  flex-shrink: 0;
}

.tabs-edit-del {
  width: 24px;
  height: 24px;
  line-height: 22px;
  text-align: center;
  padding: 0;
  border: 1px solid #ffccc7;
  background: #fff1f0;
  color: #cf1322;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.tabs-edit-del:hover {
  background: #cf1322;
  color: #fff;
  border-color: #cf1322;
}

.tabs-edit-add {
  align-self: flex-start;
  padding: 4px 10px;
  border: 1px dashed #1677ff;
  background: #fff;
  color: #1677ff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 2px;
}

.tabs-edit-add:hover {
  background: #1677ff;
  color: #fff;
}
</style>
