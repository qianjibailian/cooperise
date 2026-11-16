<script setup lang="ts">
/**
 * 文档图标选择面板：常用 emoji 网格；已有图标时可移除。
 * 放在 a-popover 的内容里使用（标题上方「添加图标」、点击已有图标更换）。
 */
withDefaults(defineProps<{
  /** 是否显示「移除」入口（已有图标时） */
  removable?: boolean
}>(), {
  removable: false,
})

const emit = defineEmits<{
  (e: 'select', emoji: string): void
  (e: 'remove'): void
}>()

const GROUPS: { label: string; items: string[] }[] = [
  {
    label: '常用',
    items: ['📄', '📝', '📌', '📎', '📚', '📖', '🗂️', '📁', '📊', '📈', '📅', '🗓️', '✅', '⭐', '🔥', '💡'],
  },
  {
    label: '工作',
    items: ['🎯', '🚀', '🛠️', '⚙️', '🔧', '🧩', '🧪', '🐞', '🔒', '🔑', '💻', '🖥️', '📱', '🌐', '📦', '🏷️'],
  },
  {
    label: '表情与符号',
    items: ['😀', '😄', '🤔', '😎', '🥳', '👍', '👏', '🙌', '🤝', '💪', '❤️', '🎉', '🏆', '⚠️', '❓', '❗'],
  },
  {
    label: '自然与生活',
    items: ['🌱', '🌳', '🌸', '🌈', '☀️', '🌙', '⚡', '❄️', '🍀', '🍎', '☕', '🏠', '✈️', '🚗', '🎨', '🎵'],
  },
]
</script>

<template>
  <div class="dep">
    <div class="dep-head">
      <span class="dep-title">选择图标</span>
      <button v-if="removable" type="button" class="dep-remove" @click="emit('remove')">移除</button>
    </div>
    <div class="dep-body">
      <template v-for="g in GROUPS" :key="g.label">
        <div class="dep-label">{{ g.label }}</div>
        <div class="dep-grid">
          <button
            v-for="it in g.items"
            :key="it"
            type="button"
            class="dep-cell"
            :aria-label="`图标 ${it}`"
            @click="emit('select', it)"
          >
            {{ it }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dep {
  width: 304px;
}
.dep-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  margin-bottom: 4px;
}
.dep-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--docs-text, #1d1d1f);
}
.dep-remove {
  height: 26px;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  color: var(--docs-text-2, #6e6e73);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.dep-remove:hover {
  color: var(--docs-danger, #d70015);
  background: var(--docs-hover, rgba(0, 0, 0, 0.05));
}
.dep-body {
  max-height: 300px;
  overflow-y: auto;
}
.dep-label {
  padding: 8px 0 4px;
  font-size: 12px;
  color: var(--docs-text-3, #86868b);
}
.dep-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}
.dep-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.dep-cell:hover {
  background: var(--docs-hover, rgba(0, 0, 0, 0.05));
}
.dep-cell:focus-visible,
.dep-remove:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--c-primary, #0a84ff) 60%, transparent);
  outline-offset: -2px;
}
</style>
