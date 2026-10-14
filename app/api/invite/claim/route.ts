import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-server";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const norm = (s: string) =>
  (s ?? "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/\b(dr|eng|م|د|أ\.د)\b\.?/gi, " ").replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .trim().replace(/\s+/g, " ");

/** GET public invite info (no token leak: only name/program/validity). */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{32,128}$/i.test(token)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const svc = serviceSupabase();
  const { data: inv } = await svc.from("instructor_invites")
    .select("id,full_name,title,role,program_id,expires_at,claimed_by,programs(code,name_ar)").eq("token_hash", hash(token)).maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((inv as any).claimed_by) return NextResponse.json({ error: "claimed" }, { status: 400 });
  if (new Date((inv as any).expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 400 });
  const { token_hash: _drop, ...safe } = inv as any;
  return NextResponse.json({ ok: true, invite: safe });
}

/** POST claim: creates the auth user + profile, links matching slots, marks claimed. */
export async function POST(req: NextRequest) {
  const svc = serviceSupabase();
  const body = await req.json().catch(() => ({} as any));
  const { token, email, password } = body;
  if (!token || !email || !String(password ?? "").length || String(password).length < 6)
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!/^[0-9a-f]{32,128}$/i.test(token)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: inv } = await svc.from("instructor_invites").select("*").eq("token_hash", hash(token)).maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((inv as any).claimed_by) return NextResponse.json({ error: "claimed" }, { status: 400 });
  if (new Date((inv as any).expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 400 });

  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email: String(email).trim(), password: String(password),
    email_confirm: true, user_metadata: { role: (inv as any).role, invite_id: (inv as any).id }
  });
  if (cErr || !created?.user) return NextResponse.json({ error: cErr?.message ?? "create_failed" }, { status: 400 });
  const uid = created.user.id;
  const { error: pErr } = await svc.from("profiles").upsert(
    { id: uid, email: String(email).trim(), role: (inv as any).role, status: "approved" },
    { onConflict: "id" }
  );
  if (pErr) {
    await svc.auth.admin.deleteUser(uid).catch(() => {});
    return NextResponse.json({ error: pErr.message }, { status: 400 });
  }

  // link timetable slots whose raw instructor name matches this person
  const want = new Set([norm((inv as any).full_name), norm(`${(inv as any).title}. ${(inv as any).full_name}`)]);
  let q = svc.from("timetable_slots").select("id,course_id,instructor_name,program_id").is("instructor_id", null).not("instructor_name", "is", null);
  if ((inv as any).program_id) q = q.eq("program_id", (inv as any).program_id);
  const { data: slots } = await q.limit(500);
  let linked = 0;
  const courseIds = new Set<string>();
  for (const s of (slots ?? []) as any[]) {
    if (!want.has(norm(s.instructor_name))) continue;
    await svc.from("timetable_slots").update({ instructor_id: uid }).eq("id", s.id);
    courseIds.add(s.course_id);
    linked++;
  }
  for (const cid of courseIds) {
    await svc.from("course_professors").upsert({ course_id: cid, professor_id: uid }, { onConflict: "course_id,professor_id" });
  }
  await svc.from("instructor_invites").update({ claimed_by: uid, claimed_at: new Date().toISOString(), token_hash: null }).eq("id", (inv as any).id);
  await svc.from("audit_logs").insert({
    actor_id: uid, action: "invite.claim", entity_type: "instructor_invites",
    entity_id: (inv as any).id, metadata: { linked }
  }).then(() => {}, () => {});
  return NextResponse.json({ ok: true, linked });
}
