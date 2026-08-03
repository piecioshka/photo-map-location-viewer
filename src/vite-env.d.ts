/// <reference types="vite/client" />

/** App version, injected from package.json at build time. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_SENTRY_DSN?: string;
  /** Feature flag defaults, see src/services/feature-flags.ts */
  readonly VITE_FF_GOOGLE_DRIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
