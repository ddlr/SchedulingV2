import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn('Supabase URL or Anon Key is missing. The application will run in "disconnected" mode. Please check your .env file.');
}

// Minimal dummy builder to prevent crashes during initial load
const dummyBuilder = {
    select: () => dummyBuilder,
    order: () => dummyBuilder,
    eq: () => dummyBuilder,
    ilike: () => dummyBuilder,
    gte: () => dummyBuilder,
    limit: () => dummyBuilder,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
    insert: () => dummyBuilder,
    update: () => dummyBuilder,
    delete: () => dummyBuilder,
    upsert: () => dummyBuilder,
};

const dummyClient = {
    from: () => dummyBuilder,
    channel: () => ({
        on: () => ({
            subscribe: () => ({ unsubscribe: () => {} })
        }),
        subscribe: () => ({ unsubscribe: () => {} })
    }),
    auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    }
};

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : dummyClient as any;
