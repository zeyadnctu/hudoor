import { NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/export
 * A machine-readable copy of the signed-in student's own data. No secrets,
 * no other students, no staff notes. Sent as a download; never cached.
 */
export async function GET() {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const svc = serviceSupabase();
  const safe = async (p: PromiseLike<{ data: unknown; error: unknown }>) => {
    try {
      const r = await p;
      return r.error ? null : r.data;
    } catch {
      return null;
    }
  };

  const [profile, details, enrollments, records, excuses, disputes, requests, devices, passkeys, prefs, consents] =
    await Promise.all([
      safe(svc.from("profiles").select("id,email,role,status,custom_role,created_at").eq("id", user.id).maybeSingle()),
      safe(svc.from("student_details").select("*").eq("user_id", user.id).maybeSingle()),
      safe(svc.from("enrollments").select("id,created_at,courses(code,name_ar,name_en,credit_hours)").eq("student_id", user.id)),
      safe(
        svc
          .from("attendance_records")
          .select("id,status,method,scanned_at,attendance_sessions(starts_at,ends_at,courses(code,name_ar,name_en))")
          .eq("student_id", user.id)
          .order("scanned_at", { ascending: false })
      ),
      safe(svc.from("excuse_requests").select("id,course_id,session_id,reason,status,comment,created_at,decided_at").eq("student_id", user.id)),
      safe(svc.from("disputes").select("id,record_id,reason,status,comment,created_at").eq("student_id", user.id)),
      safe(svc.from("service_requests").select("id,type,status,payload,created_at").eq("student_id", user.id)),
      safe(svc.from("devices").select("device_id,ua_hint,bound_at").eq("student_id", user.id)),
      safe(svc.from("passkeys").select("name,created_at,last_used_at").eq("user_id", user.id)),
      safe(svc.from("notification_prefs").select("*").eq("user_id", user.id).maybeSingle()),
      safe(svc.from("consents").select("kind,version,accepted_at").eq("user_id", user.id))
    ]);

  const body = {
    product: "Hudoor",
    exported_at: new Date().toISOString(),
    subject: user.id,
    profile,
    student_details: details,
    enrollments,
    attendance_records: records,
    excuse_requests: excuses,
    disputes,
    service_requests: requests,
    devices,
    passkeys,
    notification_prefs: prefs,
    consents
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hudoor-export-${stamp}.json"`,
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
