<template>
  <div ref="containerRef" class="side-drawer-react-mount"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef, nextTick } from 'vue'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import * as antd from 'antd'
import { useRoute } from 'vue-router'
import { SideDrawer } from 'qianjisan-global'
import 'qianjisan-global/dist/qianjisan-global.css'

interface SideDrawerProps {
  open: boolean
  menuPath?: string
  menuKey?: string
  forceOpen?: boolean
  getContainer?: boolean | HTMLElement
}

const props = withDefaults(defineProps<SideDrawerProps>(), {
  menuPath: '/dashboard',
  menuKey: 'home',
  forceOpen: false,
  getContainer: false,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'menuClick', key: string): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const root = shallowRef<Root | null>(null)

const route = useRoute()

const handleMenuClick = (key: string) => {
  emit('menuClick', key)
  emit('close')
}

const handleClose = () => {
  emit('close')
}

const renderReact = () => {
  if (!root.value) return
  const selectedKey = route.path.split('/').slice(0, 2).join('/') || '/dashboard'
  root.value.render(
    createElement(antd.ConfigProvider, {
      theme: {
        token: {
          colorPrimary: '#1677ff',
        },
      },
    }, createElement(SideDrawer, {
      open: props.open,
      onClose: handleClose,
      selectedKey,
      onMenuClick: handleMenuClick,
      menuPath: props.menuPath,
      menuKey: props.menuKey,
      forceOpen: props.forceOpen,
      getContainer: props.getContainer,
    }))
  )
}

const init = () => {
  if (containerRef.value) {
    root.value = createRoot(containerRef.value)
    renderReact()
  }
}

watch(() => props.open, renderReact)
watch(() => route.path, renderReact)
watch(() => props.menuPath, renderReact)
watch(() => props.menuKey, renderReact)
watch(() => props.forceOpen, renderReact)
watch(() => props.getContainer, renderReact)

onMounted(() => {
  nextTick(() => {
    init()
  })
})

onBeforeUnmount(() => {
  root.value?.unmount()
  root.value = null
})
</script>

<style scoped>
.side-drawer-react-mount {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2000;
  pointer-events: none;
}

.side-drawer-react-mount > * {
  pointer-events: auto;
}
</style>
