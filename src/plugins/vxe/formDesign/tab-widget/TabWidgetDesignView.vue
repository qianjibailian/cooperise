<template>
  <div class="tab-widget-design">
    <div class="tab-header-bar">
      <div class="tab-list">
        <div
          v-for="tab in currWidget.options.tabs"
          :key="tab.key"
          :class="['tab-item', { active: currWidget.options.activeKey === tab.key }]"
          @click="selectTab(tab.key)"
        >
          <input
            v-if="editingKey === tab.key"
            v-model="tab._editingName"
            class="tab-name-input"
            @click.stop
            @blur="commitRename(tab)"
            @keyup.enter="commitRename(tab)"
            @keyup.esc="cancelRename(tab)"
            ref="nameInputRef"
          />
          <span v-else class="tab-name" @dblclick.stop="startRename(tab)">
            {{ tab.name }}
          </span>
          <button
            v-if="currWidget.options.tabs.length > 1"
            type="button"
            class="tab-close"
            @click.stop="removeTab(tab.key)"
            title="关闭页签"
          >
            ×
          </button>
        </div>
        <button type="button" class="tab-add" @click.stop="addTab" title="新增页签">
          +
        </button>
      </div>
    </div>
    <div class="tab-content-body">
      <template v-for="tab in currWidget.options.tabs" :key="tab.key">
        <div
          v-show="currWidget.options.activeKey === tab.key"
          class="tab-pane"
          @dragover.prevent="handleDragover($event, tab.key)"
          @dragenter.prevent.stop="handleDragenter($event, tab.key)"
          @drop.prevent.stop="handleDrop($event, tab.key)"
        >
          <div class="tab-pane-inner">
            <template v-for="child in getTabChildren(tab.key)" :key="child.id">
              <div
                class="tab-child-wrap"
                :data-widget-id="child.id"
                draggable="true"
                @dragstart.stop="handleChildDragstart($event, child)"
                @dragend="handleChildDragend"
                @dragenter.prevent.stop="handleChildDragenter($event, child, tab.key)"
                @click.stop="handleChildClick($event, child)"
              >
                <component
                  :is="getChildRenderer(child)"
                  :render-opts="getRenderOpts()"
                  :render-params="getChildRenderParams(child)"
                  class="tab-child-widget"
                />
              </div>
            </template>
            <div
              v-if="getTabChildren(tab.key).length === 0"
              class="tab-empty"
            >
              <span>从左侧拖入控件到此处</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { PropType, ref, watch, nextTick, inject, h, type Component } from 'vue'
import { VxeUI, VxeGlobalRendererHandles } from 'vxe-pc-ui'
import XEUtils from 'xe-utils'
import { FormDesignWidgetTabProps, randomTabKey } from './widget'

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

// inject $xeFormDesign 获取表单设计器实例
const $xeFormDesign = inject<any>('$xeFormDesign', null)

const editingKey = ref<string | null>(null)
const nameInputRef = ref<HTMLInputElement[]>([])

// 把新加进来的 child 自动分配到当前激活的 tab 上
watch(
  () => (currWidget.value.children as any[])?.slice(),
  (children) => {
    if (!children) return
    const activeKey = currWidget.value.options.activeKey
    children.forEach((c: any) => {
      if (!c.options) c.options = {}
      if (!c.options._tabKey) c.options._tabKey = activeKey
    })
  },
  { deep: true, immediate: true }
)

function getTabChildren(tabKey: string) {
  const list = (currWidget.value.children as any[]) || []
  return list.filter((c: any) => (c.options?._tabKey || currWidget.value.options.activeKey) === tabKey)
}

function selectTab(key: string) {
  currWidget.value.options.activeKey = key
}

function addTab() {
  const k = randomTabKey()
  const idx = currWidget.value.options.tabs.length + 1
  currWidget.value.options.tabs.push({ key: k, name: `页签${idx}` })
  currWidget.value.options.activeKey = k
}

function removeTab(key: string) {
  const tabs = currWidget.value.options.tabs
  if (tabs.length <= 1) return
  const idx = tabs.findIndex(t => t.key === key)
  tabs.splice(idx, 1)
  // 移除该 tab 的 children
  currWidget.value.children = ((currWidget.value.children as any[]) || []).filter(
    (c: any) => (c.options?._tabKey || currWidget.value.options.activeKey) !== key
  )
  if (currWidget.value.options.activeKey === key) {
    currWidget.value.options.activeKey = tabs[Math.max(0, idx - 1)].key
  }
}

function startRename(tab: any) {
  editingKey.value = tab.key
  tab._editingName = tab.name
  nextTick(() => {
    const el = (nameInputRef.value as any)[0] || (nameInputRef.value as any)
    if (el) el.focus && el.focus()
  })
}

function commitRename(tab: any) {
  if (editingKey.value === tab.key) {
    const v = (tab._editingName || '').trim()
    if (v) tab.name = v
    delete tab._editingName
    editingKey.value = null
  }
}

function cancelRename(tab: any) {
  delete tab._editingName
  editingKey.value = null
}

// ====== 拖拽接收逻辑 ======

let lastDragTime = 0

function getReactData() {
  if (!$xeFormDesign) return null
  return $xeFormDesign.reactData
}

// 把拖入的控件添加到指定 tab
function addWidgetToTab(widget: any, tabKey: string) {
  if (!widget) return false
  const children = (currWidget.value.children as any[]) || []
  if (children.some((c: any) => c.id === widget.id)) return false
  // 从原位置移除
  const reactData = getReactData()
  if (reactData) {
    const widgetObjList = reactData.widgetObjList
    const rest = XEUtils.findTree(widgetObjList, (item: any) => item && item.id === widget.id, { children: 'children' })
    if (rest) {
      const { parent, items, index } = rest
      if (parent && parent.name === 'row') {
        items[index] = $xeFormDesign.createEmptyWidget()
      } else {
        items.splice(index, 1)
      }
    }
  }
  if (!widget.options) widget.options = {}
  widget.options._tabKey = tabKey
  if (!currWidget.value.children) currWidget.value.children = []
  currWidget.value.children.push(widget)
  return true
}

// tab-pane 接收拖入的控件
function handleDragenter(_evnt: DragEvent, tabKey: string) {
  if (!$xeFormDesign) return
  const reactData = getReactData()
  if (!reactData) return

  // 节流，防止频繁触发
  if (lastDragTime > Date.now() - 200) {
    return
  }

  const { dragWidget, sortWidget } = reactData

  // 切换到目标 tab
  currWidget.value.options.activeKey = tabKey

  let added = false

  // 情况1：从左侧拖入的新控件
  if (dragWidget) {
    added = addWidgetToTab(dragWidget, tabKey)
    if (added) {
      reactData.sortWidget = dragWidget
      lastDragTime = Date.now()
    }
    return
  }

  // 情况2：已有控件排序（从其他位置拖入）
  if (sortWidget) {
    // 不能把自己拖入自己
    if (sortWidget.id === currWidget.value.id) return
    added = addWidgetToTab(sortWidget, tabKey)
    if (added) {
      lastDragTime = Date.now()
    }
  }
}

function handleDragover(_evnt: DragEvent, _tabKey: string) {
  // .prevent 修饰符已调用 preventDefault，允许 drop
}

function handleDrop(_evnt: DragEvent, tabKey: string) {
  if (!$xeFormDesign) return
  const reactData = getReactData()
  if (!reactData) return
  const { dragWidget, sortWidget } = reactData
  if (dragWidget) {
    addWidgetToTab(dragWidget, tabKey)
  } else if (sortWidget) {
    addWidgetToTab(sortWidget, tabKey)
  }
  // 清除拖拽状态
  reactData.dragWidget = null
  reactData.sortWidget = null
}

// 子控件拖拽排序
function handleChildDragstart(evnt: DragEvent, child: any) {
  if (!$xeFormDesign) return
  const reactData = getReactData()
  if (!reactData) return
  const dataTransfer = evnt.dataTransfer
  if (dataTransfer) {
    dataTransfer.setData('text/plain', String(child.id))
  }
  reactData.sortWidget = child
  reactData.dragWidget = null
}

function handleChildDragend() {
  if (!$xeFormDesign) return
  const reactData = getReactData()
  if (!reactData) return
  // 不清除 sortWidget，让 dragendEvent 处理
}

// 子控件之间排序
function handleChildDragenter(_evnt: DragEvent, targetChild: any, _tabKey: string) {
  if (!$xeFormDesign) return
  const reactData = getReactData()
  if (!reactData) return
  const { sortWidget } = reactData

  if (lastDragTime > Date.now() - 200) {
    return
  }

  if (!sortWidget || sortWidget.id === targetChild.id) return

  const children = (currWidget.value.children as any[]) || []
  const fromIdx = children.findIndex((c: any) => c.id === sortWidget.id)
  const targetIdx = children.findIndex((c: any) => c.id === targetChild.id)

  if (fromIdx >= 0 && targetIdx >= 0 && fromIdx !== targetIdx) {
    // 在同一 tab 内排序
    const [moved] = children.splice(fromIdx, 1)
    children.splice(targetIdx, 0, moved)
    lastDragTime = Date.now()
  }
}

function handleChildClick(evnt: Event, child: any) {
  if ($xeFormDesign) {
    $xeFormDesign.handleClickWidget(evnt, child)
  }
}

function getRenderOpts() {
  return props.renderOpts
}

// 构造子控件的 renderParams
function getChildRenderParams(child: any) {
  return {
    ...(props.renderParams as any),
    currWidget: child,
    widgetModel: {
      get value() {
        return child.model?.value ?? null
      },
      set value(v: any) {
        if (child.model) child.model.value = v
      }
    },
    widgetField: child.field,
    formConfig: (props.renderParams as any).formConfig,
    $formDesign: $xeFormDesign,
    $formView: (props.renderParams as any).$formView,
  }
}

// 子控件的渲染用一个包装组件，内部调用 useWidgetView 对应的 View 组件
const _rendererCache = new Map<string, Component>()
function getChildRenderer(child: any): Component {
  const widgetName = child.name
  if (_rendererCache.has(widgetName)) return _rendererCache.get(widgetName)!

  // 尝试多种名称匹配
  const renderer =
    VxeUI.renderer.get(widgetName) ||
    VxeUI.renderer.get(widgetName?.toLowerCase()) ||
    VxeUI.renderer.get(widgetName?.charAt(0).toUpperCase() + widgetName?.slice(1))
  const designView = renderer?.renderFormDesignWidgetEdit || renderer?.renderFormDesignWidgetView

  const Comp: Component = {
    name: `TabChildWrap_${widgetName}`,
    props: {
      renderOpts: { type: Object, default: () => ({}) },
      renderParams: { type: Object, default: () => ({}) },
    },
    setup(compProps: any) {
      return () => {
        if (designView) {
          const vnodes = designView(compProps.renderOpts, compProps.renderParams)
          if (Array.isArray(vnodes)) return h('div', { class: 'tab-child-widget-inner' }, vnodes)
          return vnodes || h('div')
        }
        // fallback: 显示字段名
        return h(
          'div',
          { class: 'tab-child-fallback' },
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
.tab-widget-design {
  border: 1px dashed #c5cee0;
  border-radius: 8px;
  padding: 12px;
  background: #fafbfd;
}

.tab-header-bar {
  margin-bottom: 10px;
  border-bottom: 1px solid #eef0f4;
  padding-bottom: 8px;
}

.tab-list {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px 6px 0 0;
  font-size: 14px;
  color: #595959;
  background: #f2f3f5;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  border-bottom: none;
  user-select: none;
  position: relative;
}

.tab-item:hover {
  background: #e6eaf2;
}

.tab-item.active {
  background: #fff;
  color: #1677ff;
  border-color: #d9e2f0;
  font-weight: 500;
  box-shadow: 0 -1px 0 #1677ff inset;
}

.tab-name {
  display: inline-block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-name-input {
  width: 120px;
  padding: 2px 6px;
  border: 1px solid #1677ff;
  border-radius: 3px;
  outline: none;
  font-size: 14px;
}

.tab-close {
  width: 20px;
  height: 20px;
  line-height: 18px;
  text-align: center;
  padding: 0;
  border: none;
  background: transparent;
  color: #8c8c8c;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
}

.tab-close:hover {
  background: #ffccc7;
  color: #cf1322;
}

.tab-add {
  width: 28px;
  height: 28px;
  line-height: 26px;
  text-align: center;
  padding: 0;
  border: 1px dashed #c5cee0;
  background: #fff;
  color: #595959;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
}

.tab-add:hover {
  background: #1677ff;
  color: #fff;
  border-color: #1677ff;
}

.tab-content-body {
  background: #fff;
  border-radius: 4px;
  min-height: 160px;
}

.tab-pane {
  padding: 12px;
}

.tab-pane-inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 136px;
}

.tab-child-wrap {
  display: block;
  position: relative;
  border: 1px dashed transparent;
  border-radius: 4px;
  transition: border-color 0.15s;
}

.tab-child-wrap:hover {
  border-color: #b7d8ff;
}

.tab-child-wrap[draggable="true"] {
  cursor: move;
}

.tab-child-widget {
  display: block;
}

.tab-child-widget-inner {
  display: block;
}

.tab-empty {
  padding: 32px 12px;
  text-align: center;
  color: #bfbfbf;
  font-size: 13px;
  border: 1px dashed #e6eaf2;
  border-radius: 4px;
  background: #fafbfd;
}
</style>
