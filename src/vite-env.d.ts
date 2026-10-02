/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TMDB_READ_ACCESS_TOKEN?: string;
  readonly VITE_WATCHMODE_API_KEY?: string;
  readonly VITE_STREAMING_REGION?: string;
  readonly VITE_AMAZON_LWA_CLIENT_ID?: string;
  readonly VITE_PROVIDER_BRIDGE_EXTENSION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
