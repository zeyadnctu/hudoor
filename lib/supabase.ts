import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-only. Never import next/headers here — client components use this file.

// Singleton: one client per tab means ONE autoRefreshToken timer instead of a
// racing crowd of clients (a new client per call used to multiply refresh
// timers — extra auth-server calls and occasional cookie write races that
// looked like random logouts).
let client: SupabaseClient | null = null;

export function browserSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
