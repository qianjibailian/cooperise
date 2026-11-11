<script setup lang="ts">
import type { DocType } from '@/types/docs'

/**
 * 文档类型图标：科技风线稿（直线 + 切角 + 线路走线 + 节点方块）。
 * 彩色块为类型色渐变底并带切角；单色模式只保留线稿（菜单 / 侧栏使用）。
 */
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
</script>

<template>
  <span
    class="doc-type-icon"
    :class="[`is-${props.size}`, `type-${props.type}`, { 'is-mono': props.mono }]"
  >
    <svg
      class="doc-type-glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="miter"
      stroke-linecap="square"
      aria-hidden="true"
    >
      <!-- 表格：切角表格 + 网格 + 高亮单元格 -->
      <g v-if="props.type === 'sheet'">
        <path d="M4 3h16v12l-5 6H4z" />
        <path d="M4 9h16M10 9v12" />
        <rect x="10" y="9" width="6" height="6" fill="currentColor" fill-opacity="0.35" stroke="none" />
      </g>
      <!-- 思维导图：根节点 + 直角走线 + 三个分支节点 -->
      <g v-else-if="props.type === 'mindmap'">
        <rect x="2.5" y="9.5" width="5" height="5" fill="currentColor" stroke="none" />
        <path d="M7.5 12h4V6h4M11.5 12h4M11.5 12v6h4" />
        <rect x="15.5" y="4" width="5" height="4" />
        <rect x="15.5" y="10" width="5" height="4" />
        <rect x="15.5" y="16" width="5" height="4" />
      </g>
      <!-- 流程图：开始 → 判断 → 结束 -->
      <g v-else-if="props.type === 'flow'">
        <rect x="6" y="2.5" width="12" height="4" />
        <path d="M12 6.5V8M12 16v1.5" />
        <path d="M12 8l5.5 4-5.5 4-5.5-4z" />
        <rect x="6" y="17.5" width="12" height="4" />
      </g>
      <!-- 文档（默认）：切角页面 + 折角 + 文本线 + 节点方块 -->
      <g v-else>
        <path d="M4 3h11l5 5v13H4z" />
        <path d="M15 3v5h5" />
        <path d="M8 12.5h8M8 16h5" />
        <rect x="15.5" y="15.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  </span>
</template>

<style scoped>
/* 彩色块：类型色渐变底；右上、左下切角（HUD 式角标）；--type-color 由 type-* 类切换 */
.doc-type-icon {
  --type-color: var(--docs-type-doc);
  --chamfer: 5px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--type-color);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--type-color) 26%, transparent),
    color-mix(in srgb, var(--type-color) 8%, transparent)
  );
  clip-path: polygon(
    0 0,
    calc(100% - var(--chamfer)) 0,
    100% var(--chamfer),
    100% 100%,
    var(--chamfer) 100%,
    0 calc(100% - var(--chamfer))
  );
}
.doc-type-icon.type-doc {
  --type-color: var(--docs-type-doc);
}
.doc-type-icon.type-sheet {
  --type-color: var(--docs-type-sheet);
}
.doc-type-icon.type-mindmap {
  --type-color: var(--docs-type-mindmap);
}
.doc-type-icon.type-flow {
  --type-color: var(--docs-type-flow);
}
.doc-type-icon.is-sm {
  width: 22px;
  height: 22px;
  font-size: 13px;
}
.doc-type-icon.is-md {
  width: 32px;
  height: 32px;
  font-size: 17px;
  --chamfer: 8px;
}
.doc-type-glyph {
  display: block;
  width: 1em;
  height: 1em;
}
/* 菜单 / 侧栏：单色线稿，无彩色底、无切角 */
.doc-type-icon.is-mono {
  width: 22px;
  height: 22px;
  font-size: 14px;
  color: var(--docs-text-3);
  background: none;
  clip-path: none;
}
</style>
