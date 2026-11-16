<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { LoadingOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { uploadDocAttachment } from '@/api/docs'
import { DOC_COVER_ILLUSTRATIONS, DOC_COVER_PRESETS, docCoverBackground } from '@/utils/doc-cover'

/**
 * 文档封面选择面板：预设渐变 + 上传图片。
 * 选中后 emit('select', value)：预设为 `preset:<序号>`，上传图片为图片地址。
 */
withDefaults(defineProps<{
  /** 当前封面值（高亮选中的预设） */
  value?: string
  /** 是否显示「移除」入口（已有封面时） */
  removable?: boolean
}>(), {
  value: '',
  removable: false,
})

const emit = defineEmits<{
  (e: 'select', cover: string): void
  (e: 'remove'): void
}>()

/** 封面图片大小上限 */
const MAX_SIZE = 20 * 1024 * 1024

const fileRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件')
    return
  }
  if (file.size > MAX_SIZE) {
    message.warning('图片不能超过 20MB')
    return
  }
  uploading.value = true
  try {
    const res = await uploadDocAttachment(file)
    if (res?.success && res.data?.url) emit('select', res.data.url)
  } catch {
    // 请求层已统一提示
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="dcp">
    <div class="dcp-head">
      <span class="dcp-title">选择封面</span>
      <button v-if="removable" type="button" class="dcp-remove" @click="emit('remove')">移除</button>
    </div>
    <div class="dcp-section">插画</div>
    <div class="dcp-grid">
      <button
        v-for="(it, i) in DOC_COVER_ILLUSTRATIONS"
        :key="`illustration-${i}`"
        type="button"
        class="dcp-cell is-art"
        :class="{ 'is-active': value === `illustration:${i}` }"
        :style="{ background: it.background }"
        :aria-label="it.label"
        :title="it.label"
        @click="emit('select', `illustration:${i}`)"
      />
    </div>
    <div class="dcp-section">纯色渐变</div>
    <div class="dcp-grid">
      <button
        v-for="(_, i) in DOC_COVER_PRESETS"
        :key="i"
        type="button"
        class="dcp-cell"
        :class="{ 'is-active': value === `preset:${i}` }"
        :style="{ background: docCoverBackground(`preset:${i}`) }"
        :aria-label="`预设封面 ${i + 1}`"
        @click="emit('select', `preset:${i}`)"
      />
    </div>
    <button type="button" class="dcp-upload" :disabled="uploading" @click="fileRef?.click()">
      <LoadingOutlined v-if="uploading" /><UploadOutlined v-else />
      <span>{{ uploading ? '上传中…' : '上传图片' }}</span>
    </button>
    <p class="dcp-hint">支持 JPG / PNG / WebP 等图片，最大 20MB</p>
    <input ref="fileRef" type="file" accept="image/*" class="dcp-file" @change="onFilePicked" />
  </div>
</template>

<style scoped>
.dcp {
  width: 304px;
}
.dcp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  margin-bottom: 8px;
}
.dcp-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--docs-text, #1d1d1f);
}
.dcp-remove {
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
.dcp-remove:hover {
  color: var(--docs-danger, #d70015);
  background: var(--docs-hover, rgba(0, 0, 0, 0.05));
}
.dcp-section {
  margin: 12px 0 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--docs-text-3, #86868b);
}
.dcp-section:first-of-type {
  margin-top: 0;
}
.dcp-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.dcp-cell {
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.12s, box-shadow 0.12s;
}
/* 插画格：稍高一些，方便看清画面 */
.dcp-cell.is-art {
  height: 52px;
}
.dcp-cell:hover {
  transform: translateY(-1px);
}
.dcp-cell.is-active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--c-primary, #0a84ff);
}
.dcp-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  margin-top: 12px;
  font: inherit;
  font-size: 13px;
  color: var(--docs-text, #1d1d1f);
  background: transparent;
  border: 1px dashed var(--docs-border-strong, rgba(0, 0, 0, 0.14));
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.dcp-upload:hover:not(:disabled) {
  color: var(--c-primary, #0a84ff);
  border-color: var(--c-primary, #0a84ff);
  background: color-mix(in srgb, var(--c-primary, #0a84ff) 4%, transparent);
}
.dcp-upload:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.dcp-file {
  display: none;
}
.dcp-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--docs-text-3, #86868b);
  text-align: center;
}
.dcp-cell:focus-visible,
.dcp-upload:focus-visible,
.dcp-remove:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--c-primary, #0a84ff) 60%, transparent);
  outline-offset: 2px;
}
</style>
