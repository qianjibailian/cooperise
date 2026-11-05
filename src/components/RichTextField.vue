<template>
  <!-- 富文本字段（type = RICH_TEXT）：只读渲染 HTML，可编辑时用 WangEditor 编辑（与「描述」一致） -->
  <div class="rtf" :class="{ 'is-editing': editing }">
    <div v-if="editable" class="rtf-actions">
      <a-tooltip v-if="!editing" title="编辑">
        <a-button type="text" size="small" class="rtf-btn" @click="startEdit"><EditOutlined /></a-button>
      </a-tooltip>
      <template v-else>
        <a-tooltip title="取消">
          <a-button type="text" size="small" class="rtf-btn" :disabled="saving" @click="cancelEdit"><CloseOutlined /></a-button>
        </a-tooltip>
        <a-tooltip title="保存">
          <a-button type="text" size="small" class="rtf-btn is-save" :loading="saving" @click="save">
            <CheckOutlined v-if="!saving" />
          </a-button>
        </a-tooltip>
      </template>
    </div>

    <template v-if="editing">
      <Toolbar :editor="editorRef" :default-config="toolbarConfig" mode="default" class="rtf-toolbar" />
      <Editor v-model="html" :default-config="editorConfig" mode="default" class="rtf-editor" @onCreated="onCreated" />
    </template>
    <div v-else class="rtf-view" @dblclick="editable && startEdit()">
      <div v-if="hasContent" class="rtf-html" v-html="sanitizeHtml(html)" />
      <span v-else class="rtf-empty">—</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { message } from 'ant-design-vue'
import { EditOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons-vue'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import { patchIssue } from '@/api/faiz'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import type { DetailField } from '@/types/faiz'
import { toRichHtml, richValueOf, richHasContent } from '@/utils/richText'

const props = defineProps<{
  field: DetailField
  issueKey: string
  /** 挂载即进入编辑态（如上线清单的编辑弹窗）；取消 / 未改动保存时抛出 cancel */
  autoEdit?: boolean
}>()

const emit = defineEmits<{
  (e: 'saved', payload: { value: unknown; exportValue: unknown }): void
  (e: 'cancel'): void
}>()

const editable = computed(() => !!props.field.editable)
// 编辑态需在下方 immediate watch 之前声明（watch 首次同步执行时会读取它）
const editing = ref(!!props.autoEdit)
const saving = ref(false)
const editorRef = shallowRef<IDomEditor | null>(null)
const html = ref('')
/** 上次保存的内容：判断是否有改动 / 取消时恢复 */
let baseline = ''
let initialized = false
watch(
  () => richValueOf(props.field),
  (v) => {
    // 编辑中不覆盖输入；首次（含 autoEdit 一挂载就是编辑态）必须灌入初始值
    if (editing.value && initialized) return
    initialized = true
    html.value = toRichHtml(v)
    baseline = html.value
  },
  { immediate: true },
)

const hasContent = computed(() => richHasContent(html.value))

// ---------- 编辑 ----------
const toolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: [
    'headerSelect', 'blockquote', '|',
    'bold', 'underline', 'italic', 'through', 'code', '|',
    'color', 'bgColor', '|',
    'bulletedList', 'numberedList', '|',
    'insertLink', 'insertImage', '|',
    'undo', 'redo',
  ],
}
const editorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入内容…',
  scroll: false,
  MENU_CONF: {},
}

function onCreated(editor: IDomEditor) {
  editorRef.value = editor
}

function destroyEditor() {
  editorRef.value?.destroy()
  editorRef.value = null
}

function startEdit() {
  editing.value = true
}

function stopEdit() {
  destroyEditor()
  editing.value = false
}

function cancelEdit() {
  html.value = baseline
  stopEdit()
  if (props.autoEdit) emit('cancel')
}

async function save() {
  if (saving.value) return
  const value = html.value.trim()
  if (value === baseline.trim()) return cancelEdit()
  saving.value = true
  try {
    const res = await patchIssue(props.issueKey, [{ fieldId: props.field.id, fieldValue: value }])
    if (res?.success) {
      baseline = value
      stopEdit()
      message.success(`${props.field.name || '字段'}已保存`)
      emit('saved', { value, exportValue: value })
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(destroyEditor)
</script>

<style scoped>
.rtf {
  position: relative;
  width: 100%;
  min-width: 0;
}
.rtf-actions {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.rtf:hover .rtf-actions,
.rtf.is-editing .rtf-actions {
  opacity: 1;
}
.rtf.is-editing .rtf-actions {
  position: static;
  justify-content: flex-end;
  margin-bottom: 4px;
}
.rtf-btn {
  color: #8c8c8c;
}
.rtf-btn.is-save {
  color: var(--c-primary, #1677ff);
}
.rtf-view {
  min-width: 0;
  padding-right: 28px;
  font-size: 13px;
  line-height: 1.7;
  color: #1f2329;
  word-break: break-word;
}
.rtf-empty {
  color: #bfbfbf;
}
.rtf-html :deep(p) { margin: 0 0 6px; }
.rtf-html :deep(p:last-child) { margin-bottom: 0; }
.rtf-html :deep(img) { max-width: 100%; height: auto; border-radius: 4px; }
.rtf-html :deep(a) { color: var(--c-primary, #1677ff); }
.rtf-html :deep(ul),
.rtf-html :deep(ol) { padding-left: 20px; margin: 0 0 6px; }
.rtf-html :deep(h1),
.rtf-html :deep(h2),
.rtf-html :deep(h3) { margin: 6px 0; font-weight: 600; }
.rtf-html :deep(code) {
  padding: 1px 4px;
  border-radius: 4px;
  background: #f2f3f5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.rtf-html :deep(pre) {
  padding: 8px 10px;
  border-radius: 6px;
  background: #f7f8fa;
  overflow-x: auto;
}
.rtf-html :deep(blockquote) {
  margin: 0 0 6px;
  padding-left: 10px;
  border-left: 3px solid #e5e6eb;
  color: #646a73;
}
.rtf-toolbar {
  border: 1px solid #e5e6eb;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
}
.rtf-editor {
  min-height: 160px;
  border: 1px solid #e5e6eb;
  border-radius: 0 0 6px 6px;
  overflow: hidden;
}
.rtf-editor :deep(.w-e-text-container) {
  min-height: 160px;
}
</style>
