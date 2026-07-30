/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_DOMAIN: string
  readonly VITE_API_PREFIX: string
  readonly VITE_ACCOUNT_URL: string
  readonly VITE_COOPERISE_URL: string
  readonly VITE_QIANJISAN_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
