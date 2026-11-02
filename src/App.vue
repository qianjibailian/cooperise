<template>
  <!-- 主题色：antd 组件取 antdTheme，自定义样式取 --c-primary 等 CSS 变量（见 @/utils/theme） -->
  <a-config-provider :theme="antdTheme" :locale="antdLocale">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/utils/auth'
import { useTheme } from '@/utils/theme'
// 组件语言：日期 / 时间选择器、分页、空状态、弹窗按钮等随中英文切换（见 @/i18n）
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import { locale } from '@/i18n'

const route = useRoute()
const router = useRouter()
const { isLoggedIn } = useAuth()
const { antdTheme } = useTheme()
const antdLocale = computed(() => (locale.value === 'en' ? enUS : zhCN))

// 登录态失效（接口 401 / 主动退出）时跳转登录页
watch(isLoggedIn, (loggedIn) => {
  if (!loggedIn && !route.meta.public) {
    router.replace({ name: 'Login', query: { redirect: route.fullPath } })
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
}

/* 主题色变量默认值（苹果蓝），运行时由 @/utils/theme 覆盖 */
:root {
  --c-primary: #0a84ff;
  --c-primary-hover: #3399ff;
  --c-primary-active: #0071e3;
  --c-primary-bg: #e8f1ff;
  --c-primary-bg-hover: #dbe9ff;
  --c-primary-border: #a8ccff;
}

html, body {
  /* 字体栈（参考 Apple 官网中文站）：苹方 → 微软雅黑 → 思源黑体，西文用系统字体 */
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue',
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  /* 移动端横竖屏切换时不自动放大字号 */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  /* 去掉移动端点击时的灰色高亮 */
  -webkit-tap-highlight-color: transparent;
}

/* 人员下拉弹层（挂在 body，全局生效）：不随输入框 / 单元格变窄，完整展示 头像 + realName（coAccount） */
.person-select-popup {
  min-width: 280px !important;
  max-width: min(440px, calc(100vw - 32px));
}
.person-select-popup .ant-select-item-option-content {
  overflow: visible;
}
.person-select-popup .ant-select-item-option-content > span {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.person-select-popup .ant-select-item-option-content > span > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 键盘操作可见的焦点环（鼠标点击不显示），颜色跟随主题色 */
:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}

/* 系统开启「减弱动态效果」时关闭动画与过渡 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ========== 弹窗 / 抽屉窄屏兼容：不随视口压缩，放不下时出现滚动条 ========== */
/* 弹窗：去掉 antd 默认的 max-width: calc(100vw - 32px)，超宽时由 .ant-modal-wrap 横向滚动 */
.ant-modal {
  max-width: none;
}
.ant-modal-wrap {
  overflow: auto;
}
/* 抽屉：宽度最多占满视口，内容保持 --drawer-min-width，不够时抽屉内横向滚动 */
.ant-drawer-content-wrapper {
  max-width: 100vw;
  overflow-x: auto;
  overflow-y: hidden;
}
.ant-drawer-content {
  min-width: var(--drawer-min-width, 0px);
}

:root {
  /* 系统最小宽度：窗口更窄时不再压缩布局，改为出现横向滚动条 */
  --app-min-width: 1280px;
  /* 页面横向滚动距离（由 layout 同步），供 fixed 定位的顶栏 / 侧栏跟随滚动 */
  --app-scroll-x: 0px;
  --ant-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>