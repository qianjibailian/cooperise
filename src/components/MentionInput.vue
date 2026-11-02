<template>
  <div ref="wrapRef" class="mention-input">
    <!-- 背景层：与输入框同字体同排版逐字渲染，@成员 高亮；输入框文字透明盖在上面，只露出光标与选区 -->
    <div ref="backdropRef" class="mention-backdrop" aria-hidden="true"><template v-for="(seg, i) in segments" :key="i"><span v-if="seg.mention" class="mention-hl">{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template>{{ '\n' }}</div>
    <a-mentions
      v-bind="$attrs"
      :value="props.value"
      class="mention-field"
      @update:value="(v: string) => emit('update:value', v)"
    >
      <template v-if="$slots.option" #option="opt">
        <slot name="option" v-bind="opt" />
      </template>
    </a-mentions>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 带 @ 高亮的提及输入框：在 a-mentions 下面垫一层同排版的背景，把 @成员 渲染成高亮色
 * 其余属性 / 事件（rows、options、loading、placeholder、@search 等）原样透传给 a-mentions
 */
defineOptions({ inheritAttrs: false })

const props = defineProps<{ value: string }>()
const emit = defineEmits<{ (e: 'update:value', v: string): void }>()

/** @ 后到空白或下一个 @ 为止，与评论展示的高亮规则一致 */
const segments = computed(() => {
  const text = props.value || ''
  const segs: { text: string; mention: boolean }[] = []
  let last = 0
  for (const m of text.matchAll(/@[^\s@]+/g)) {
    const i = m.index ?? 0
    if (i > last) segs.push({ text: text.slice(last, i), mention: false })
    segs.push({ text: m[0], mention: true })
    last = i + m[0].length
  }
  if (last < text.length) segs.push({ text: text.slice(last), mention: false })
  return segs
})

const wrapRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
let textarea: HTMLTextAreaElement | null = null
let resizeObserver: ResizeObserver | null = null

/** 影响排版的样式：从输入框实时复制，保证逐字对齐（换主题 / 字号也不会错位） */
const MIRRORED_STYLES = [
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
  'letterSpacing', 'wordSpacing', 'textIndent', 'tabSize', 'textTransform',
] as const

function syncLayout() {
  const wrap = wrapRef.value
  const back = backdropRef.value
  if (!wrap || !back || !textarea) return
  const cs = getComputedStyle(textarea)
  for (const k of MIRRORED_STYLES) back.style[k] = cs[k]
  const w = wrap.getBoundingClientRect()
  const t = textarea.getBoundingClientRect()
  back.style.top = `${t.top - w.top}px`
  back.style.left = `${t.left - w.left}px`
  // 宽度用 clientWidth：去掉输入框滚动条，换行位置才一致
  back.style.width = `${textarea.clientWidth}px`
  back.style.height = `${textarea.clientHeight}px`
  back.scrollTop = textarea.scrollTop
}

function syncScroll() {
  if (backdropRef.value && textarea) backdropRef.value.scrollTop = textarea.scrollTop
}

onMounted(() => {
  textarea = wrapRef.value?.querySelector('textarea') ?? null
  if (!textarea) return
  textarea.addEventListener('scroll', syncScroll)
  resizeObserver = new ResizeObserver(syncLayout)
  resizeObserver.observe(textarea)
  syncLayout()
})

// 内容变化后输入框可能出现滚动条或滚动位置变化
watch(() => props.value, () => nextTick(syncLayout))

onBeforeUnmount(() => {
  textarea?.removeEventListener('scroll', syncScroll)
  resizeObserver?.disconnect()
})

defineExpose({
  focus: () => textarea?.focus(),
})
</script>

<style scoped>
.mention-input {
  position: relative;
  background: #fff;
  border-radius: 8px;
}

.mention-backdrop {
  position: absolute;
  z-index: 0;
  overflow: hidden;
  color: #1d1d1f;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  pointer-events: none;
}

/* 高亮只改颜色 / 背景，不改字重和内边距，否则字宽变化会和输入框错位 */
.mention-hl {
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 12%, transparent);
  border-radius: 3px;
}

.mention-field {
  position: relative;
  z-index: 1;
  background: transparent;
}

.mention-field :deep(textarea) {
  color: transparent;
  caret-color: #1d1d1f;
  background: transparent;
}

.mention-field :deep(textarea::placeholder) {
  color: #bfbfbf;
}

/* 选中文字：透明字上看不出选中内容，用半透明底色提示选区 */
.mention-field :deep(textarea::selection) {
  color: transparent;
  background: color-mix(in srgb, var(--c-primary) 25%, transparent);
}
</style>
