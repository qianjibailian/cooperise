/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_DOMAIN: string
  readonly VITE_COOPERISE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@wangeditor/editor-for-vue' {
  import type { DefineComponent } from 'vue'
  import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'

  interface EditorProps {
    modelValue?: string
    defaultHtml?: string
    defaultConfig?: Partial<IEditorConfig>
    mode?: string
  }
  interface EditorEmits {
    (e: 'update:modelValue', value: string): void
    (e: 'onCreated', editor: IDomEditor): void
    (e: 'onChange', editor: IDomEditor): void
    (e: 'onFocus', editor: IDomEditor): void
    (e: 'onBlur', editor: IDomEditor): void
  }
  const Editor: DefineComponent<EditorProps, EditorEmits>

  interface ToolbarProps {
    editor: IDomEditor | null
    defaultConfig?: Partial<IToolbarConfig>
    mode?: string
  }
  const Toolbar: DefineComponent<ToolbarProps>

  export { Editor, Toolbar }
}
