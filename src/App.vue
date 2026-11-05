<template>
  <!-- 主题色：antd 组件取 antdTheme，自定义样式取 --c-primary 等 CSS 变量（见 @/utils/theme） -->
  <a-config-provider :theme="antdTheme" :locale="antdLocale">
    <router-view />
  </a-config-provider>
  <!-- 客户端：登录页等没有顶栏的页面，顶部留一条可拖动窗口的区域 -->
  <div v-if="isDesktop && route.meta.public" class="desktop-drag-strip" />
  <!-- Windows 客户端：自绘的最小化 / 最大化 / 关闭按钮（与页签栏同高同色） -->
  <WindowControls v-if="isDesktop && !isMacDesktop" />

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
import { isDesktop, isMacDesktop } from '@/utils/desktop'
import WindowControls from '@/components/WindowControls.vue'

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
/* ===== Windows 客户端标题栏（参考 Apifox）=====
 * 原生标题栏已隐藏，应用顶栏兼作标题栏：空白处可拖动窗口，右侧给系统窗口按钮（最小化 / 最大化 / 关闭）留位。
 * Electron 的拖动区域不看层级，盖在顶栏上的弹窗 / 抽屉打开时需关闭拖动，否则这块区域点不动。 */
html.is-desktop {
  /* 顶部页签栏（DesktopTabBar）高度：系统窗口按钮在这一行，顶栏整体下移；--app-header-height 为整个顶部区域 */
  --desktop-tabbar-height: 42px;
  --app-header-height: calc(56px + var(--desktop-tabbar-height));
  /* 窗口按钮（WindowControls，3×46px）占用的宽度 */
  --desktop-controls-width: 138px;
}
html.is-desktop .app-header {
  -webkit-app-region: drag;
  user-select: none;
}
/* macOS：红绿灯在左侧（约 52px 宽 + 左边距 18px，位于页签栏），右侧无系统按钮 */
html.is-desktop.is-mac {
  --desktop-controls-width: 0px;
}
html.is-desktop .app-header :is(.header-left > *, .header-left-right > *, .header-space, .header-right > *, a, button, input) {
  -webkit-app-region: no-drag;
}
html.is-desktop .desktop-drag-strip {
  position: fixed;
  top: 0;
  left: 0;
  right: var(--desktop-controls-width);
  height: 40px;
  z-index: 2000;
  -webkit-app-region: drag;
}
/* 事项详情抽屉在客户端里放在页签栏下方，不盖住页签栏，所以它打开时页签栏仍可拖动 */
html.is-desktop body:has(.ant-modal-wrap:not([style*='display: none']), .ant-drawer-open:not(.issue-detail-drawer), .ant-image-preview-wrap) :is(.app-header, .desktop-drag-strip, .desktop-tabbar) {
  -webkit-app-region: no-drag;
}
/* 事项详情抽屉会盖住顶栏（菜单栏），打开时顶栏不再拖动，否则抽屉顶部那块点不动 */
html.is-desktop body:has(.issue-detail-drawer.ant-drawer-open) .app-header {
  -webkit-app-region: no-drag;
}
/* 客户端：事项详情抽屉（含透明遮罩）从页签栏下沿开始，与顶栏（菜单栏）顶部对齐；网页版仍与页面顶部对齐 */
html.is-desktop .issue-detail-drawer {
  top: var(--desktop-tabbar-height, 0px);
}
html.is-desktop .issue-detail-drawer :is(.ant-drawer-body, .drawer-inner) {
  height: calc(100vh - var(--desktop-tabbar-height, 0px)) !important;
  height: calc(100dvh - var(--desktop-tabbar-height, 0px)) !important;
}

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

/* ========== 全局弹窗样式（网页版 + 客户端，参考「新建事项」弹窗）==========
 * - 所有弹窗垂直居中，最高 90vh：标题 / 底部按钮固定，内容区内部滚动，不再超出屏幕
 * - 大圆角、柔和阴影与遮罩、按钮样式与新建事项一致
 * 优先级：antd 的样式是 :where(.css-hash).ant-modal .xxx（0,2,0）且插在 head 最前，这里同优先级、靠后加载即可覆盖；
 * 组件里的自定义弹窗样式（如 .new-form-modal .ant-modal-content）同优先级且更晚加载，仍然优先。
 * 「排除确认框」用 :where(:not(...)) 包裹，不额外增加优先级。 */
.ant-modal-root .ant-modal-wrap {
  display: flex;
  padding: 16px;
}
.ant-modal-root .ant-modal-centered::before {
  display: none;
}
/* margin: auto 在 flex 容器里居中；比视口还高时贴顶并由 wrap 滚动，不会被裁掉 */
.ant-modal-root .ant-modal {
  top: 0;
  margin: auto;
  padding-bottom: 0;
}
.ant-modal-root .ant-modal-mask {
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.ant-modal .ant-modal-content {
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow:
    0 1px 2px 0 rgba(15, 23, 42, 0.04),
    0 8px 24px -4px rgba(15, 23, 42, 0.08),
    0 24px 64px -12px rgba(15, 23, 42, 0.18);
}
/* 普通弹窗（确认框 Modal.confirm 结构不同，不改布局）：标题 / 内容 / 底部三段式 */
.ant-modal:where(:not(.ant-modal-confirm)) .ant-modal-content {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  max-height: 90dvh;
  padding: 0;
  overflow: hidden;
}
.ant-modal:where(:not(.ant-modal-confirm)) .ant-modal-header {
  flex-shrink: 0;
  margin: 0;
  padding: 18px 56px 12px 24px;
  background: transparent;
}
.ant-modal:where(:not(.ant-modal-confirm)) .ant-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}
.ant-modal:where(:not(.ant-modal-confirm)) .ant-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 24px 16px;
}
.ant-modal:where(:not(.ant-modal-confirm)) .ant-modal-footer {
  flex-shrink: 0;
  margin: 0;
  padding: 10px 24px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}
.ant-modal:where(:not(.ant-modal-confirm)) .ant-modal-close {
  top: 16px;
  right: 20px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #94a3b8;
}
.ant-modal .ant-modal-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}
/* 底部按钮：与新建事项一致（危险按钮保持 antd 红色） */
.ant-modal-footer .ant-btn {
  height: 34px;
  padding: 0 20px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
}
.ant-modal-footer .ant-btn-default:where(:not(.ant-btn-dangerous)) {
  border-color: #cbd5e1;
  color: #0f172a;
}
.ant-modal-footer .ant-btn-default:not(.ant-btn-dangerous):not(:disabled):hover {
  background: #f8fafc;
  border-color: #94a3b8;
  color: #0f172a;
}
.ant-modal-footer .ant-btn-primary:where(:not(.ant-btn-dangerous):not(:disabled)) {
  background: linear-gradient(180deg, var(--c-primary) 0%, #2563eb 100%);
  border: none;
  box-shadow:
    0 1px 2px 0 rgba(37, 99, 235, 0.18),
    0 4px 12px -2px rgba(37, 99, 235, 0.35);
}
.ant-modal-footer .ant-btn-primary:not(.ant-btn-dangerous):not(:disabled):hover {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
}

/* ========== 横向表单弹窗（class="modal-landscape"，宽 880）==========
 * 新增用户 / 新建空间等增删改弹窗：做成扁的横长方形，表单字段三列排布。
 * 原来的 a-row / a-col 栅格被展开（display: contents），每个字段占一格；
 * 文本域、多选组、颜色 / 图标选择等宽内容，以及表单里的提示、按钮区等非字段内容占满整行。 */
.modal-landscape .ant-modal-body .ant-form-vertical {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 20px;
  align-items: start;
}
.modal-landscape .ant-form-vertical > .ant-row {
  display: contents;
}
.modal-landscape .ant-form-vertical > .ant-row > .ant-col {
  flex: none;
  max-width: none;
  min-width: 0;
  padding: 0 !important;
}
.modal-landscape .ant-form-vertical > :not(.ant-form-item):not(.ant-row):not(.ant-col),
.modal-landscape .ant-form-vertical > .ant-row > :not(.ant-col),
.modal-landscape .ant-form-vertical :is(.ant-form-item, .ant-col):has(textarea, .ant-checkbox-group, .ant-radio-group, .space-form-item) {
  grid-column: 1 / -1;
}
/* 颜色 / 图标选择占两格，和旁边一个字段同一行 */
.modal-landscape .ant-form-vertical :is(.ant-form-item, .ant-col):has(.color-swatches, .icon-options) {
  grid-column: span 2;
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
  /* 顶栏高度（含 iOS 刘海安全区），侧栏 / 内容区据此避让 */
  --app-header-height: 56px;
  /* 页面横向滚动距离（由 layout 同步），供 fixed 定位的顶栏 / 侧栏跟随滚动 */
  --app-scroll-x: 0px;
  --ant-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/*
 * iOS 原生壳（Capacitor）：
 * - 顶栏高度加上刘海 / 底部安全区，避免内容被系统区域遮挡
 * - 去掉 1280px 的强制最小宽度，手机上不再出现整页横向滚动条（布局按屏幕宽度自适应收缩）
 */
/* 桌面客户端（Electron）：参考 Apifox 允许更小的窗口，最小宽度放宽到 960（与 electron/main.cjs 的 MIN_WINDOW_WIDTH 一致） */
html.is-desktop {
  --app-min-width: 960px;
}

html.is-ios {
  --app-header-height: calc(56px + env(safe-area-inset-top, 0px));
  --app-min-width: 0px;
}

html.is-ios .app-header {
  padding-top: env(safe-area-inset-top, 0px);
}

/*
 * iOS App：左侧一级菜单（图标栏）改为底部 Tab 栏
 * 只作用于 App（html.is-ios），网页 / Electron 客户端布局不变
 */
html.is-ios .icon-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: auto;
  min-width: 0;
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  flex-direction: row;
  align-items: stretch;
  padding: 0 4px env(safe-area-inset-bottom, 0px);
  border-right: none;
  border-top: 1px solid #e8e8e8;
  box-sizing: border-box;
  z-index: 200;
}

html.is-ios .icon-bar-item {
  flex: 1;
  width: auto;
  height: 100%;
  margin-bottom: 0;
  border-radius: 0;
}

html.is-ios .icon-bar-icon {
  margin-bottom: 2px;
}

/* 侧栏让出底部 Tab 的高度（Tab 栏由 Teleport 移到 body，不再受侧栏 transform 影响） */
html.is-ios .sider {
  height: calc(100dvh - var(--app-header-height, 56px) - 56px - env(safe-area-inset-bottom, 0px));
  padding-bottom: 0;
}

html.is-ios .sider-inner {
  height: 100%;
}

/* 详情等非工作台页没有二级菜单：侧栏整体隐藏，图标栏已固定在底部 */
html.is-ios .sider.sider-detail {
  display: none;
}

html.is-ios .main-layout-full {
  margin-left: 0;
}

/* 内容区底部留白，避免最后一行被 Tab 栏压住；min-height 相应扣减，不额外产生滚动 */
html.is-ios .main-layout {
  padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  min-height: calc(100dvh - 112px - env(safe-area-inset-bottom, 0px));
}

/* 登录 / 注册等鉴权页：避开刘海与底部手势条 */
html.is-ios .auth-page {
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* ==========================================================================
   手机端（H5 / iOS App）
   基准机型：iPhone 17（402 × 874pt）、iPhone 17 Pro Max（440 × 956pt）
   断点 767px 覆盖到 iPhone 横屏（956 宽时走桌面布局）
   ========================================================================== */
@media (max-width: 767px) {
  :root {
    /* 手机不强制 1280 最小宽，否则整页出现横向滚动条 */
    --app-min-width: 0px;
  }

  html,
  body {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  /* iOS 聚焦输入框会自动放大页面，字号 >= 16px 可禁用该行为 */
  html.is-ios input,
  html.is-ios textarea,
  html.is-ios select {
    font-size: 16px !important;
  }
}
</style>