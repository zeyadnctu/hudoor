import { createBrowserClient } from "@supabase/ssr";

// Browser-only. Never import next/headers here — client components use this file.
export function browserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
