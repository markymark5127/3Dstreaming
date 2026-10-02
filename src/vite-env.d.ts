/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TMDB_READ_ACCESS_TOKEN?: string;
  readonly VITE_STREAMING_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
