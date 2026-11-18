<template>
  <!-- 主题色：antd 组件取 antdTheme，自定义样式取 --c-primary 等 CSS 变量（见 @/utils/theme） -->
  <a-config-provider :theme="antdTheme" :locale="antdLocale">
    <!-- 客户端：顶部页签栏（全局，不属于任何模块布局） -->
    <DesktopTabBar v-if="isDesktop && !route.meta.public" />
    <router-view />

    <!-- 全局加载遮罩：文档路由切换 / 文档详情加载时显示（见 @/utils/global-loading） -->
    <div v-if="globalLoading" class="global-loading" role="status" aria-live="polite" aria-label="加载中">
      <a-spin size="large" />
    </div>

    <!-- 全局弹窗与悬浮组件：各模块布局共用，不随模块切换重复挂载 -->
    <template v-if="!route.meta.public">
      <NewIssueFormModal v-model:open="newIssueModalOpen" @submitted="notifyIssueCreated" />
      <ReleaseNotice />
      <FloatingModuleNav />
    </template>
    <!-- 文件上传进度小窗（右下角）：上传任务全局共享，切换页面不中断 -->
    <UploadPanel v-if="!route.meta.public" />
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
import DesktopTabBar from '@/components/DesktopTabBar.vue'
import FloatingModuleNav from '@/components/FloatingModuleNav.vue'
import NewIssueFormModal from '@/components/NewIssueFormModal.vue'
import ReleaseNotice from '@/components/ReleaseNotice.vue'
import { newIssueModalOpen } from '@/utils/new-issue-modal'
import { notifyIssueCreated } from '@/utils/issue-events'
import { DOC_UNTITLED, docsActiveDoc } from '@/utils/docs-layout'
import { globalLoading } from '@/utils/global-loading'
import UploadPanel from '@/components/docs/UploadPanel.vue'

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

/**
 * 浏览器标签页标题：文档页只展示文档标题（标题实时跟随改名，不带文档自己的 emoji 图标），
 * 页签上的图标只保留系统 logo（favicon）；其余页面跟随路由 meta.title，都没有时回退到应用名。
 */
const tabTitle = computed(() => {
  const isDocsRoute = route.path.startsWith('/docs') || route.path.startsWith('/wiki/')
  const doc = isDocsRoute ? docsActiveDoc.value : null
  if (doc) return doc.title?.trim() || DOC_UNTITLED
  return (route.meta.title as string | undefined) || ''
})
/** 文档详情页（/docs/wiki/:docId、知识库内 /docs/library/wiki/:docId，旧地址 /wiki/:docId）：标签标题只显示文档名，不带应用名后缀 */
const isDocDetailRoute = computed(() => /^\/(docs\/wiki|docs\/library\/wiki|wiki)\/[^/]+/.test(route.path))
watch(
  [tabTitle, isDocDetailRoute],
  ([title, detail]) => {
    if (detail && title) document.title = title
    else document.title = title ? `${title} · Cooperise` : 'Cooperise'
  },
  { immediate: true },
)
</script>

<style>
/* 全局加载遮罩：铺满视口，盖住页面操作，居中显示加载图标 */
.global-loading {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.6);
}

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
html.is-desktop body:has(.ant-modal-wrap:not([style*='display: none']), .ant-drawer-open:not(.issue-detail-drawer), .ant-image-preview-wrap, .ant-dropdown:not(.ant-dropdown-hidden)) :is(.app-header, .desktop-drag-strip, .desktop-tabbar) {
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

/*
 * mac 客户端：工作台主内容区去掉左侧留白，与侧栏无缝衔接（网页 / iOS 不受影响）
 * 逐层清零：content(8px) → workbench-panel(0.5vh) → 页面(padding-left 24px)
 */
html.is-desktop.is-mac .content {
  padding-left: 8px;
}

html.is-desktop.is-mac .workbench-panel {
  padding-left: 0;
}

html.is-desktop.is-mac .my-board {
  padding-left: 0;
}

/*
 * mac 客户端：所有页面根容器左侧统一留 10px（内容区与侧栏之间保留一点呼吸感）
 * 特异性 (0,3,1) 高于各页面 scoped 的根类 (0,2,0)，无需逐页枚举；
 * 只作用于 .content 的直接子元素，页面内部的树形缩进等不受影响。
 * 注：不写在 html.is-mac 上 —— html 加 padding 会让整页宽出 10px 产生横向滚动
 */
html.is-desktop.is-mac .content > * {
  padding-left: 8px;
}

/* mac 客户端：文档主页（主页 / 知识库 / 回收站）左侧留 40px */
html.is-desktop.is-mac .docs-home {
  padding-left: 40px;
}

/* mac 客户端：文档左侧导航（云文档 / 搜索 / 文件树）左侧留 22px */
html.is-desktop.is-mac .docs-side {
  padding-left: 22px;
}

/*
 * mac 客户端：文档侧栏内层全部贴左
 * （标题 8px、导航项/分组/文件夹 8~10px）
 */
html.is-desktop.is-mac .docs-side-head,
html.is-desktop.is-mac .docs-group-title,
html.is-desktop.is-mac .docs-nav-item,
html.is-desktop.is-mac .docs-trash-entry,
html.is-desktop.is-mac .docs-folder,
html.is-desktop.is-mac .docs-item {
  padding-left: 0;
}

/* 文件夹内子文档保留层级缩进（原 30px，跟随基础项一起左移 8px） */
html.is-desktop.is-mac .docs-item.grouped {
  padding-left: 22px;
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

/* 云文档设计 token（规范：参考苹果人机界面指南的数值体系）。
   文档页与顶栏的文档部分共用；品牌色始终引用 --c-primary，切换主题预设时跟着变。
   取值约定：8pt 网格间距、字号阶梯、圆角三级（控件 / 面板 / 浮层）、细线 0.5px 视感（rgba 线）、
   毛玻璃材质仅用于顶栏与侧栏、动效统一 200ms 标准缓动 */
:root {
  /* 画布与面（苹果中性灰） */
  --docs-canvas: #ffffff;
  --docs-paper: #fbfbfd;
  --docs-side-bg: #f7f6f3;
  /* 评论区底色：低饱和度的白（比纯白略带冷灰），用于评论栏、评论卡片与评论输入区；
     系统其它背景仍是纯白 */
  --comment-surface: #ffffff;
  /* 文档左侧菜单底色：比 --docs-side-bg 更浅，只用于 .docs-side（工作台侧栏仍用 --docs-side-bg） */
  --docs-nav-bg: #f7f8fa;
  --docs-hover: rgba(55, 53, 47, 0.08);
  /* 选中态（菜单 / 文档 / 工具栏）：飞书、钉钉文档式的浅蓝底 + 蓝字 */
  --docs-selected: #e6efff;
  --docs-selected-fg: #1456f0;
  /* 细线：苹果分隔线用不透明度控制，不用实色 */
  --docs-border: rgba(55, 53, 47, 0.09);
  --docs-border-strong: rgba(55, 53, 47, 0.16);
  /* 文字（Notion 三级文字色：深灰正文 / 次级灰 / 弱化灰） */
  --docs-text: #37352f;
  --docs-text-2: #787774;
  --docs-text-3: #9b9a97;
  /* 状态（文字用深一档保证对比度） */
  --docs-danger: #d70015;
  --docs-warn: #b25000;
  --docs-success: #248a3d;
  /* 文档类型色（类型图标 / 插入菜单等），对标飞书云文档：文档蓝 / 表格绿 / 思维导图青 / 流程图橙 / 文件夹黄 */
  --docs-type-doc: #3370ff;
  --docs-type-sheet: #34c724;
  --docs-type-mindmap: #14c0ff;
  --docs-type-flow: #ff8800;
  --docs-type-folder: #ffc60a;
  /* 圆角三级：控件 6/8px，面板与卡片 12px，浮层 10px（菜单）/ 14px（大面板） */
  --docs-radius-xs: 4px;
  --docs-radius-sm: 6px;
  --docs-radius: 8px;
  --docs-radius-lg: 12px;
  --docs-radius-xl: 14px;
  /* 阴影：分层柔和阴影 + 0.5px 描边，只给浮层与按钮按下态使用 */
  --docs-shadow-control: 0 1px 2px rgba(0, 0, 0, 0.06);
  --docs-shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
  --docs-shadow-float: 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.05), 0 12px 32px rgba(0, 0, 0, 0.14);
  /* 材质：顶栏与侧栏毛玻璃（苹果的 saturate + blur） */
  --docs-material: rgba(255, 255, 255, 0.72);
  --docs-material-blur: saturate(180%) blur(20px);
  /* 焦点环：主题色 35% 透明度外环，键盘可见 */
  --docs-focus: 0 0 0 3px color-mix(in srgb, var(--c-primary) 35%, transparent);
  /* 动效：统一 200ms 标准缓动 */
  --docs-ease: cubic-bezier(0.25, 0.1, 0.25, 1);
  --docs-dur: 200ms;
  /* 间距阶梯（8pt 网格，含 4px 半步） */
  --docs-space-1: 4px;
  --docs-space-2: 8px;
  --docs-space-3: 12px;
  --docs-space-4: 16px;
  --docs-space-5: 20px;
  --docs-space-6: 24px;
  --docs-space-8: 32px;
  --docs-space-10: 40px;
  --docs-space-12: 48px;
  /* 字号阶梯（苹果：说明 11 / 辅助 12 / 控件 13 / 正文 15 / 小标题 17 / 标题 22 / 大标题 28 / 展示 34） */
  --docs-fs-caption: 11px;
  --docs-fs-meta: 12px;
  --docs-fs-control: 13px;
  --docs-fs-body: 15px;
  --docs-fs-subtitle: 17px;
  --docs-fs-title-sm: 22px;
  --docs-fs-title: 28px;
  --docs-fs-display: 34px;
  --docs-lh-body: 1.7;
  --docs-lh-ui: 1.4;
  --docs-tracking-title: -0.02em;
  /* 字体：苹方优先（中文），SF 为西文 */
  --docs-font: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Helvetica Neue', 'Segoe UI', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif;
}

html, body {
  /* 字体栈（参考 Apple 官网中文站）：苹方 → 微软雅黑 → 思源黑体，西文用系统字体 */
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
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

/* iOS：工作台面板撑满内容区，但底部要让出 Tab 栏（即上面 main-layout 的 padding-bottom） */
html.is-ios .workbench-panel {
  height: calc(100dvh - var(--app-header-height, 56px) - 56px - env(safe-area-inset-bottom, 0px));
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