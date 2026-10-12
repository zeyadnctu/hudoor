import { NextRequest, NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { scanSchema } from "@/lib/validators";
import { verifyQrToken } from "@/lib/qr-token";
import { haversineM, clientIp } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  try {
    const body = await req.json();
    const parsed = scanSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ status: "error", code: "invalid_input", message: "Invalid input" }, { status: 400 });
    const { token, lat, lng, accuracy, mocked, deviceId } = parsed.data;

    if (!rateLimit(`scan:user:${deviceId}`, 20, 60_000) || !rateLimit(`scan:ip:${ip}`, 60, 60_000))
      return NextResponse.json({ status: "error", code: "rate_limited", message: "Too many attempts, try later" }, { status: 429 });

    // 1. auth + role + approved
    const sb = serverSupabase();
    const { data: { user } } = await sb.auth.getUser();
    const svc = serviceSupabase();
    async function flag(sessionId: string | null, reason: string, extra: any = {}) {
      await svc.from("flagged_attempts").insert({
        user_id: user?.id ?? null, session_id: sessionId, reason,
        device_id: deviceId, ip, metadata: { ...extra, mocked: !!mocked, accuracy: accuracy ?? null }
      });
    }
    if (!user) { return NextResponse.json({ status: "error", code: "unauthenticated", message: "Please log in first" }, { status: 401 }); }
    const { data: profile } = await svc.from("profiles").select("role,status").eq("id", user.id).single();
    if (!profile || profile.role !== "student" || profile.status !== "approved") {
      await flag(null, "not_approved_or_not_student", { role: profile?.role, status: profile?.status });
      return NextResponse.json({ status: "error", code: "not_eligible", message: "Account not approved as student" }, { status: 403 });
    }

    // Decode sid without verifying to load secret (verify right after)
    let unverifiedSid: string | null = null;
    try {
      const parts = token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      unverifiedSid = payload.sid;
    } catch {}
    if (!unverifiedSid) { await flag(null, "malformed_token", {}); return NextResponse.json({ status: "error", code: "bad_token", message: "Invalid code" }, { status: 400 }); }

    const { data: session } = await svc.from("attendance_sessions")
      .select("*, courses(code,name_en,name_ar)").eq("id", unverifiedSid).single();
    if (!session) { await flag(null, "unknown_session", {}); return NextResponse.json({ status: "error", code: "bad_token", message: "Unknown session" }, { status: 400 }); }

    // 2. verify signature + expiry + active (server time)
    try {
      const v = await verifyQrToken(session.secret, token);
      if (v.sid !== session.id) throw new Error("sid_mismatch");
    } catch {
      await flag(session.id, "expired_or_invalid_token", {});
      return NextResponse.json({ status: "error", code: "expired_code", message: "Code expired — scan the live QR again" }, { status: 400 });
    }
    const now = new Date();
    if (session.status !== "active" || new Date(session.ends_at) <= now || new Date(session.starts_at) > now) {
      await flag(session.id, "session_not_active", { status: session.status });
      return NextResponse.json({ status: "error", code: "session_closed", message: "Session is not active" }, { status: 400 });
    }

    // 3. enrolled?
    const { data: enr } = await svc.from("enrollments").select("id").eq("course_id", session.course_id).eq("student_id", user.id).maybeSingle();
    if (!enr) { await flag(session.id, "not_enrolled", {}); return NextResponse.json({ status: "error", code: "not_enrolled", message: "You are not enrolled in this course" }, { status: 403 }); }

    // 4. duplicate (idempotent success)
    const { data: existing } = await svc.from("attendance_records").select("id,scanned_at").eq("session_id", session.id).eq("student_id", user.id).maybeSingle();
    if (existing) {
      return NextResponse.json({ status: "success", code: "already_marked", message: "Already marked present", course: (session as any).courses, time: existing.scanned_at });
    }

    // 5. device check
    const { data: dev } = await svc.from("devices").select("*").eq("student_id", user.id).maybeSingle();
    if (!dev) {
      // bind on first success: ensure device not bound to someone else
      const { data: clash } = await svc.from("devices").select("student_id").eq("device_id", deviceId).maybeSingle();
      if (clash && clash.student_id !== user.id) { await flag(session.id, "device_conflict", {}); return NextResponse.json({ status: "error", code: "device_conflict", message: "This device is bound to another student" }, { status: 403 }); }
      await svc.from("devices").insert({ student_id: user.id, device_id: deviceId, ua_hint: req.headers.get("user-agent")?.slice(0, 200) ?? "" });
    } else if (dev.device_id !== deviceId) {
      await flag(session.id, "wrong_device", { expected: "bound", got: "other" });
      return NextResponse.json({ status: "error", code: "wrong_device", message: "Wrong device — ask admin to reset your device binding" }, { status: 403 });
    }

    // 6. geofence (soft signal; skippable per session)
    if (session.geofence_enabled) {
      if (mocked) { await flag(session.id, "mock_location", {}); return NextResponse.json({ status: "error", code: "mock_location", message: "Mock location detected" }, { status: 400 }); }
      if (accuracy != null && accuracy > 100) { await flag(session.id, "low_accuracy", { accuracy }); return NextResponse.json({ status: "error", code: "low_accuracy", message: "Weak GPS signal — move closer / enable GPS" }, { status: 400 }); }
      if (lat == null || lng == null || session.geofence_lat == null || session.geofence_lng == null) {
        await flag(session.id, "no_location", {});
        return NextResponse.json({ status: "error", code: "no_location", message: "Location required — allow GPS and retry" }, { status: 400 });
      }
      const d = haversineM(lat, lng, session.geofence_lat, session.geofence_lng);
      const margin = Math.min(accuracy ?? 0, 50);
      if (d > session.geofence_radius_m + margin) {
        await flag(session.id, "outside_geofence", { distance_m: Math.round(d) });
        return NextResponse.json({ status: "error", code: "outside_hall", message: `Outside the hall (${Math.round(d)}m away)` }, { status: 400 });
      }
    }

    // 7. insert + audit (unique constraint guards races)
    const { data: rec, error: insErr } = await svc.from("attendance_records")
      .insert({ session_id: session.id, student_id: user.id, method: "scan", status: "present" })
      .select().single();
    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ status: "success", code: "already_marked", message: "Already marked present", course: (session as any).courses, time: new Date().toISOString() });
      }
      throw insErr;
    }
    await svc.from("audit_logs").insert({ actor_id: user.id, action: "scan_present", entity_type: "attendance_session", entity_id: session.id, metadata: { device: deviceId, ip } });

    return NextResponse.json({ status: "success", code: "marked", message: "Marked present", course: (session as any).courses, time: rec.scanned_at });
  } catch (e: any) {
    return NextResponse.json({ status: "error", code: "server_error", message: "Server error, try again" }, { status: 500 });
  }
}
