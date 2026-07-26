<template>
  <div ref="containerRef" class="header-react-mount"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef, nextTick } from 'vue'
import { createRoot, type Root } from 'react-dom/client'
import { createElement, Component } from 'react'
import * as antd from 'antd'
import { Header } from 'qianjisan-global'
import 'qianjisan-global/dist/qianjisan-global.css'

interface HeaderProps {
  onMenuClick: () => void
  drawerOpen?: boolean
}

const props = defineProps<HeaderProps>()

const containerRef = ref<HTMLElement | null>(null)
const root = shallowRef<Root | null>(null)
const onMenuClickRef = shallowRef(props.onMenuClick)

// 保持回调引用稳定，避免每次渲染都触发 React 重渲染
const stableOnMenuClick = () => {
  onMenuClickRef.value()
}

class ErrorBoundary extends Component<{ children: any }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ErrorBoundary] Header 组件渲染错误:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return createElement('div', {
        style: { padding: '20px', color: 'red', fontSize: '12px' },
      }, 'Header 渲染错误: ' + (this.state.error?.message || String(this.state.error)))
    }
    return this.props.children
  }
}

const renderReact = () => {
  if (!root.value) return
  root.value.render(
    createElement(antd.ConfigProvider, {
      theme: {
        token: {
          colorPrimary: '#1677ff',
        },
      },
    }, createElement(ErrorBoundary, null, createElement(Header, {
      onMenuClick: stableOnMenuClick,
      drawerOpen: props.drawerOpen,
    })))
  )
}

const init = () => {
  if (containerRef.value) {
    root.value = createRoot(containerRef.value)
    renderReact()
  }
}

watch(() => props.drawerOpen, renderReact)
watch(() => props.onMenuClick, (newVal) => {
  onMenuClickRef.value = newVal
})

onMounted(() => {
  nextTick(() => { init() })
})

onBeforeUnmount(() => {
  root.value?.unmount()
  root.value = null
})
</script>

<style scoped>
.header-react-mount {
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}
</style>
