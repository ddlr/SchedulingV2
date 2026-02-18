
// Removed reference to vite/client to resolve type definition error
// /// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly GEMINI_API_KEY?: string
  readonly VITE_SOLVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
