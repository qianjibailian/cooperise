<script setup lang="ts">
import type { DocType } from '@/types/docs'

/**
 * 文档类型图标：对标飞书云文档的实色文件图标——类型色填充的圆角纸张 + 右上折角 + 白色内容符号；
 * 文件夹为实色文件夹。类型色见 App.vue 的 --docs-type-*。
 */
const props = withDefaults(defineProps<{
  type?: DocType | 'folder'
  /** sm 列表行（22px）/ md 新建面板、宫格卡片（30px） */
  size?: 'sm' | 'md'
  /** 侧栏 / 菜单等紧凑位置：小一号（18px），同样是彩色图标 */
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
    :class="[`is-${props.size}`, `type-${props.type}`, { 'is-compact': props.mono }]"
  >
    <svg class="doc-type-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <!-- 文件夹：后片 + 浅色前片 -->
      <g v-if="props.type === 'folder'">
        <path
          class="dti-fill"
          d="M2.5 6.2a2 2 0 0 1 2-2h4.6a2 2 0 0 1 1.5.68l1.2 1.37h7.7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z"
        />
        <path class="dti-shade" d="M2.5 9.6h19V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" />
      </g>

      <template v-else>
        <!-- 纸张 + 折角 -->
        <path
          class="dti-fill"
          d="M6 2h8.1a2 2 0 0 1 1.42.59l3.9 3.9A2 2 0 0 1 20 7.9V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
        />
        <path class="dti-fold" d="M14.6 2.1c.34.1.66.28.92.54l3.84 3.84c.26.26.44.58.54.92H16.6a2 2 0 0 1-2-2z" />

        <!-- 表格：白色表格 + 类型色表头线 / 列线 -->
        <g v-if="props.type === 'sheet'">
          <rect class="dti-mark" x="7.2" y="10.6" width="9.6" height="8" rx="1.2" />
          <path class="dti-fill" d="M7.2 13.3h9.6v1H7.2zM10.6 10.6h1v8h-1z" />
        </g>
        <!-- 思维导图：根节点 + 三个分支 -->
        <g v-else-if="props.type === 'mindmap'">
          <path class="dti-line" d="M9.6 14.6h2.2M11.8 11.5v6.2M11.8 11.5h1.6M11.8 14.6h1.6M11.8 17.7h1.6" />
          <circle class="dti-mark" cx="8.5" cy="14.6" r="1.5" />
          <rect class="dti-mark" x="13.4" y="10.6" width="3.6" height="1.8" rx="0.9" />
          <rect class="dti-mark" x="13.4" y="13.7" width="3.6" height="1.8" rx="0.9" />
          <rect class="dti-mark" x="13.4" y="16.8" width="3.6" height="1.8" rx="0.9" />
        </g>
        <!-- 流程图：开始 → 判断 -->
        <g v-else-if="props.type === 'flow'">
          <rect class="dti-mark" x="8.8" y="9.9" width="6.4" height="2.6" rx="0.8" />
          <path class="dti-line" d="M12 12.5v1.5" />
          <path class="dti-mark" d="M12 13.7l2.9 2.6-2.9 2.6-2.9-2.6z" />
        </g>
        <!-- 文档（默认）：三行文本 -->
        <g v-else>
          <rect class="dti-mark" x="7.4" y="10.4" width="9.2" height="1.6" rx="0.8" />
          <rect class="dti-mark" x="7.4" y="13.7" width="9.2" height="1.6" rx="0.8" />
          <rect class="dti-mark" x="7.4" y="17" width="5.4" height="1.6" rx="0.8" />
        </g>
      </template>
    </svg>
  </span>
</template>

<style scoped>
/* --type-color 由 type-* 类切换；兜底值即飞书的类型色 */
.doc-type-icon {
  --type-color: var(--docs-type-doc, #3370ff);
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  font-size: 22px;
  line-height: 1;
}
.doc-type-icon.type-sheet {
  --type-color: var(--docs-type-sheet, #34c724);
}
.doc-type-icon.type-mindmap {
  --type-color: var(--docs-type-mindmap, #14c0ff);
}
.doc-type-icon.type-flow {
  --type-color: var(--docs-type-flow, #ff8800);
}
.doc-type-icon.type-folder {
  --type-color: var(--docs-type-folder, #ffc60a);
}
.doc-type-icon.is-md {
  font-size: 30px;
}
.doc-type-icon.is-compact {
  font-size: 18px;
}
.doc-type-glyph {
  display: block;
  width: 1em;
  height: 1em;
}
.dti-fill {
  fill: var(--type-color);
}
/* 折角：在类型色上叠一层半透明白 */
.dti-fold {
  fill: rgba(255, 255, 255, 0.5);
}
/* 文件夹前片：略浅，做出前后两层 */
.dti-shade {
  fill: rgba(255, 255, 255, 0.28);
}
.dti-mark {
  fill: #fff;
}
.dti-line {
  fill: none;
  stroke: #fff;
  stroke-width: 1.1;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
