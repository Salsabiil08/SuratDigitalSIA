import {assertSupabaseTarget} from '@/domain/deployment-target';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  assertSupabaseTarget(supabaseUrl,process.env.NEXT_PUBLIC_SIADOCS_ENV);
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

