/// <reference types="vite/client" />
/// <reference types="element-plus/global" />

interface ImportMetaEnv {
  readonly VITE_CS_USE_DIFY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}
