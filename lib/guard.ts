import { NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { can, ownsCourse, COURSE_SCOPED, type Action, type Grant } from "@/lib/permissions";
import { clientIp } from "@/lib/geo";

export type Ctx = {
  svc: ReturnType<typeof serviceSupabase>;
  profile: { id: string; role: string; custom_role: string | null; status: string };
  ip: string;
  deviceId: string | null;
};

async function loadGrants(svc: Ctx["svc"], customRole: string | null): Promise<Grant[]> {
  if (!customRole) return [];
  const { data } = await svc.from("role_permissions").select("resource,action").eq("role", customRole);
  return (data ?? []) as Grant[];
}

async function courseScope(svc: Ctx["svc"], userId: string) {
  const [cp, tas] = await Promise.all([
    svc.from("course_professors").select("course_id").eq("professor_id", userId),
    svc.from("course_tas").select("course_id").eq("ta_id", userId)
  ]);
  return {
    taught: ((cp.data ?? []) as any[]).map(r => r.course_id),
    assisted: ((tas.data ?? []) as any[]).map(r => r.course_id)
  };
}

/**
 * Server-side permission gate for admin/console/instructor APIs.
 * - resolves system + custom-role grants, checks (resource, action)
 * - for COURSE_SCOPED resources, non-admins must own the course (opts.courseId)
 *   or own the session (opts.sessionId -> session's course)
 * Returns 403 JSON on denial (never trust UI button-hiding).
 */
export async function requirePerm(
  req: Request,
  resource: string,
  action: Action,
  opts: { courseId?: string | null; sessionId?: string | null } = {}
): Promise<{ ok: true; ctx: Ctx } | { ok: false; res: NextResponse }> {
  const deny = (code: string, status = 403) =>
    ({ ok: false as const, res: NextResponse.json({ error: code }, { status }) });
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return deny("unauth", 401);
  const svc = serviceSupabase();
  const { data: p } = await svc.from("profiles")
    .select("id,role,custom_role,status,is_active").eq("id", user.id).single();
  if (!p || p.status !== "approved") return deny("not_approved");
  const extra = await loadGrants(svc, p.custom_role);
  if (!can(p as any, resource, action, extra)) return deny("forbidden");

  if (COURSE_SCOPED.includes(resource as any) && p.role !== "admin") {
    let courseId = opts.courseId ?? null;
    if (!courseId && opts.sessionId) {
      const { data: s } = await svc.from("attendance_sessions").select("course_id").eq("id", opts.sessionId).single();
      courseId = (s as any)?.course_id ?? null;
    }
    if (!courseId) return deny("course_required");
    const scope = await courseScope(svc, user.id);
    if (!ownsCourse(p as any, courseId, scope)) return deny("not_your_course");
  }

  const ip = clientIp(req);
  let deviceId: string | null = null;
  try {
    const m = req.headers.get("cookie")?.match(/(?:^|; )hudoor_did=([^;]+)/);
    deviceId = m ? decodeURIComponent(m[1]) : null;
  } catch {}
  return { ok: true, ctx: { svc, profile: p as any, ip, deviceId } };
}

/** Audit with before/after diff + network context. */
export async function auditDiff(
  svc: Ctx["svc"], actorId: string, action: string,
  entity: string, entityId: string | null,
  before: unknown, after: unknown, meta: Record<string, unknown>, ctx: Ctx
) {
  try {
    await svc.from("audit_logs").insert({
      actor_id: actorId, action, entity_type: entity, entity_id: entityId,
      before_data: before ?? null, after_data: after ?? null,
      metadata: meta ?? {}, ip: ctx.ip, device_id: ctx.deviceId
    });
  } catch {}
}
