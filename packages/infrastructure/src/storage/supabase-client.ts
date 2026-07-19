import { createClient, SupabaseClient as SupabaseJSClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

let supabaseInstance: SupabaseJSClient | null = null;
let supabaseAdminInstance: SupabaseJSClient | null = null;

export function createSupabaseClient(config: SupabaseConfig): SupabaseJSClient {
  return createClient(config.url, config.anonKey);
}

export function createSupabaseAdminClient(config: SupabaseConfig): SupabaseJSClient {
  if (!config.serviceRoleKey) {
    throw new Error('Supabase service role key is required for admin client');
  }
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseClient(): SupabaseJSClient {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    });
  }
  return supabaseInstance;
}

export function getSupabaseAdminClient(): SupabaseJSClient {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createSupabaseAdminClient({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    });
  }
  return supabaseAdminInstance;
}

export type SupabaseClient = SupabaseJSClient;
