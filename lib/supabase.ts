import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety Mode: If env vars are missing, we use placeholder values to prevent the app from crashing.
// This allows the app to load and show mock data or handle missing connections gracefully.
const isMissingEnv = !supabaseUrl || !supabaseAnonKey;

if (isMissingEnv) {
  console.warn('Supabase environment variables are missing. Using mock client.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
