export type Role = "admin" | "professor" | "student";

export async function getProfile(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { user, profile };
}

export async function audit(supabase: any, actorId: string | null, action: string, entity: string, entityId: string | null, meta: any = {}) {
  try {
    await supabase.from("audit_logs").insert({
      actor_id: actorId, action, entity_type: entity, entity_id: entityId, metadata: meta
    });
  } catch {}
}
