import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";

// Returns service client + admin id, or null when the caller is not an approved admin.
export async function requireAdmin() {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = serviceSupabase();
  const { data: p } = await svc.from("profiles").select("role,status").eq("id", user.id).single();
  if (!p || p.role !== "admin" || p.status !== "approved") return null;
  return { svc, adminId: user.id };
}
