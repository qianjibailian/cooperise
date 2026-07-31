<template>
  <div class="tab-widget-view">
    <div class="tab-header">
      <div
        v-for="tab in currWidget.options.tabs"
        :key="tab.key"
        :class="['tab-item', { active: activeTabKey === tab.key }]"
        @click="activeTabKey = tab.key"
      >
        <span class="tab-name">{{ tab.name }}</span>
      </div>
    </div>
    <div class="tab-content">
      <template v-for="tab in currWidget.options.tabs" :key="tab.key">
        <div v-show="activeTabKey === tab.key" class="tab-pane">
          <template v-for="child in getTabChildren(tab.key)" :key="child.id">
            <component
              :is="getChildRenderer(child)"
              :render-opts="child"
              :render-params="getChildRenderParams(child)"
              class="tab-child-widget"
            />
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { PropType, ref, watch, h, type Component } from 'vue'
import { VxeUI, VxeGlobalRendererHandles } from 'vxe-pc-ui'
import { FormDesignWidgetTabProps } from './widget'

const { useWidgetView } = VxeUI.formDesignHandle

const props = defineProps({
  renderOpts: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetViewOptions>,
    default: () => ({})
  },
  renderParams: {
    type: Object as PropType<VxeGlobalRendererHandles.RenderFormDesignWidgetViewParams<FormDesignWidgetTabProps>>,
    default: () => ({})
  }
})

const { currWidget } = useWidgetView<FormDesignWidgetTabProps>(props)

const activeTabKey = ref<string>(currWidget.value.options?.tabs?.[0]?.key || '')

watch(
  () => currWidget.value.options.activeKey,
  (v) => {
    if (v) activeTabKey.value = v
  },
  { immediate: true }
)

function getTabChildren(tabKey: string) {
  const list = (currWidget.value.children as any[]) || []
  return list.filter((c: any) => (c.options?._tabKey || currWidget.value.options.activeKey) === tabKey)
}

// 构造子控件的 renderParams
// 预览模式下，数据通过 $xeFormView.getItemValue/setItemValue 绑定，
// 内置控件（row/input/select 等）通过 renderParams.widget 读取控件对象，
// 因此必须传 widget，并设置 isEditMode=false / isViewMode=true。
function getChildRenderParams(child: any) {
  const $formView = (props.renderParams as any).$formView
  return {
    ...(props.renderParams as any),
    widget: child,
    currWidget: child,
    widgetModel: {
      get value() {
        return $formView ? $formView.getItemValue(child) : null
      },
      set value(v: any) {
        if ($formView) $formView.setItemValue(child, v)
      }
    },
    widgetField: child.field,
    formConfig: (props.renderParams as any).formConfig,
    $formView: $formView,
    $formDesign: null,
    isEditMode: false,
    isViewMode: true,
    readonly: false,
    disabled: false
  }
}

// 子控件的渲染用一个包装组件，复用设计视图的逻辑
const _rendererCache = new Map<string, Component>()
function getChildRenderer(child: any): Component {
  const widgetName = child.name
  if (_rendererCache.has(widgetName)) return _rendererCache.get(widgetName)!

  const renderer = VxeUI.renderer.get(widgetName) || VxeUI.renderer.get((widgetName || '').toLowerCase())
  // 优先使用 preview，否则使用默认 view
  const previewFn = renderer?.renderFormDesignWidgetPreview || renderer?.renderFormDesignWidgetView

  const Comp: Component = {
    name: `TabPreviewChildWrap_${widgetName}`,
    props: {
      renderOpts: { type: Object, default: () => ({}) },
      renderParams: { type: Object, default: () => ({}) },
    },
    setup(compProps: any) {
      return () => {
        if (previewFn) {
          const vnodes = previewFn(compProps.renderOpts, compProps.renderParams)
          if (Array.isArray(vnodes)) return h('div', { class: 'tab-preview-child-wrap' }, vnodes)
          return vnodes || h('div')
        }
        return h(
          'div',
          { class: 'tab-preview-child-fallback' },
          `${child.title || child.name}（${child.field || ''}）`
        )
      }
    },
  }
  _rendererCache.set(widgetName, Comp)
  return Comp
}
</script>

<style scoped>
.tab-widget-view {
  width: 100%;
  margin-bottom: 12px;
}

.tab-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #eef0f4;
  margin-bottom: 0;
  gap: 0;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 14px;
  color: #595959;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  user-select: none;
}

.tab-item:hover {
  color: #1677ff;
}

.tab-item.active {
  color: #1677ff;
  font-weight: 500;
  border-bottom-color: #1677ff;
}

.tab-content {
  padding: 12px 0 0 0;
}

.tab-pane {
  width: 100%;
}

.tab-child-widget {
  display: block;
  width: 100%;
}

/* 布局控件（如 row 一行多列）在页签内全宽显示 */
.tab-child-widget :deep(.vxe-row),
.tab-child-widget :deep(.vxe-form--item-row),
.tab-child-widget :deep(.vxe-form--group) {
  width: 100%;
}
</style>
