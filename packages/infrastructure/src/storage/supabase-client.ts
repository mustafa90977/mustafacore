export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export function createSupabaseClient(_config: SupabaseConfig) {
  // Dynamic import to avoid hard dependency
  // In production: import { createClient } from '@supabase/supabase-js';
  // For now, return a typed interface that matches Supabase client API
  return {
    storage: {
      from: (_bucket: string) => ({
        upload: async (_path: string, _file: Buffer, _options?: { contentType?: string }) => {
          throw new Error('Supabase client not configured. Install @supabase/supabase-js.');
        },
        download: async (_path: string) => {
          throw new Error('Supabase client not configured. Install @supabase/supabase-js.');
        },
        remove: async (_paths: string[]) => {
          throw new Error('Supabase client not configured. Install @supabase/supabase-js.');
        },
        getSignedUrl: async (_path: string, _expiresIn?: number) => {
          throw new Error('Supabase client not configured. Install @supabase/supabase-js.');
        },
        list: async (_prefix?: string) => {
          throw new Error('Supabase client not configured. Install @supabase/supabase-js.');
        },
      }),
    },
  };
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
