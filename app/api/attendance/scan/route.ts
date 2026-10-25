import { NextRequest, NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { scanSchema } from "@/lib/validators";
import { verifyQrToken, isNonceReplay } from "@/lib/qr-token";
import { haversineM, clientIp, ipAllowed } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";
import { effective, asNum, asBool } from "@/lib/settings";
import { localSessionUser, expiringSoon, cookieLookupOf } from "@/lib/jwt-local";

export const dynamic = "force-dynamic";

/**
 * Best-effort idempotency for retries on the same warm instance. The real
 * guarantee is the unique (session_id, student_id) row in attendance_records;
 * this cache only avoids repeating work for a client that retries a request
 * whose response was lost. Entries expire after 90 seconds.
 */
const scanIdempotency = new Map<string, { at: number; body: any; status: number }>();
const IDEMPOTENCY_TTL_MS = 90_000;

function isInAppBrowser(ua: string): boolean {
  return /whatsapp|instagram|fbav|fb_iab|line|wechat|telegram/i.test(ua);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const inApp = isInAppBrowser(ua);
  try {
    const body = await req.json();
    const parsed = scanSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ status: "error", code: "invalid_input", message: "Invalid input" }, { status: 400 });
    const { token, lat, lng, accuracy, mocked, deviceId, idempotencyKey } = parsed.data;

    if (!rateLimit(`scan:user:${deviceId}`, 20, 60_000) || !rateLimit(`scan:ip:${ip}`, 60, 60_000))
      return NextResponse.json({ status: "error", code: "rate_limited", message: "Too many attempts, try later" }, { status: 429 });

    // 1. auth + role + approved
    // Fast path: verify the session JWT locally; fall back to the Auth server
    // only when that fails (also refreshes the session there).
    let user: { id: string } | null | undefined = undefined;
    const localUser = await localSessionUser(cookieLookupOf(req.headers.get("cookie")));
    if (localUser && !expiringSoon(localUser)) user = { id: localUser.id };
    if (user === undefined) {
      // Never let a broken cookie turn into a 500: the stored session may be
      // corrupted, expired, or the Auth server unreachable — all mean
      // "not authenticated here".
      try {
        const sb = serverSupabase();
        const { data: { user: u } } = await sb.auth.getUser();
        user = u;
      } catch { user = null; }
    }
    const svc = serviceSupabase();
    async function flag(sessionId: string | null, reason: string, extra: any = {}) {
      await svc.from("flagged_attempts").insert({
        user_id: user?.id ?? null, session_id: sessionId, reason,
        device_id: deviceId, ip, metadata: { ...extra, mocked: !!mocked, accuracy: accuracy ?? null, ua: ua.slice(0, 200) }
      });
    }
    if (!user) {
      await flag(null, "unauthenticated", {});
      return NextResponse.json({ status: "error", code: "unauthenticated", message: "Please log in first" }, { status: 401 });
    }
    const { data: profile } = await svc.from("profiles").select("role,status").eq("id", user.id).single();
    if (!profile || profile.role !== "student" || profile.status !== "approved") {
      await flag(null, "not_approved_or_not_student", { role: profile?.role, status: profile?.status });
      return NextResponse.json({ status: "error", code: "not_eligible", message: "Account not approved as student" }, { status: 403 });
    }

    // 1b. authenticated rate limit (the pre-auth limit above is per device/IP).
    if (!rateLimit(`scan:acct:${user.id}`, 20, 60_000)) {
      return NextResponse.json({ status: "error", code: "rate_limited", message: "Too many attempts, try later" }, { status: 429 });
    }

    // Idempotent retry: same account + same client key returns the stored reply.
    const idemKey = idempotencyKey ? `${user.id}:${idempotencyKey}` : null;
    const remember = (body: any, status = 200) => {
      if (idemKey) {
        if (scanIdempotency.size > 500) {
          for (const [k, entry] of scanIdempotency) {
            if (Date.now() - entry.at > IDEMPOTENCY_TTL_MS) scanIdempotency.delete(k);
          }
        }
        scanIdempotency.set(idemKey, { at: Date.now(), body, status });
      }
      return NextResponse.json(body, { status });
    };
    if (idemKey) {
      const hit = scanIdempotency.get(idemKey);
      if (hit && Date.now() - hit.at <= IDEMPOTENCY_TTL_MS) return NextResponse.json(hit.body, { status: hit.status });
      if (hit) scanIdempotency.delete(idemKey);
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
      .select("*, courses(code,name_en,name_ar,program_id)").eq("id", unverifiedSid).single();
    if (!session) { await flag(null, "unknown_session", {}); return NextResponse.json({ status: "error", code: "bad_token", message: "Unknown session" }, { status: 400 }); }

    // 2. verify signature + expiry + active (server time)
    let v: { sid: string; nonce: string } | null = null;
    try {
      v = await verifyQrToken(session.secret, token);
      if (v.sid !== session.id) throw new Error("sid_mismatch");
    } catch (e: any) {
      // jose marks an otherwise-valid JWT that passed its exp claim with
      // ERR_JWT_EXPIRED. That is the common race; a bad signature is not.
      const expired = e?.code === "ERR_JWT_EXPIRED" || e?.name === "JWTExpired";
      await flag(session.id, expired ? "token_expired" : "invalid_token", {});
      return NextResponse.json({
        status: "error",
        code: expired ? "token_expired" : "bad_token",
        message: expired ? "Code changed — scan the live QR again" : "Invalid class code"
      }, { status: 400 });
    }
    const now = new Date();
    if (session.status === "paused") {
      await flag(session.id, "session_paused", {});
      return NextResponse.json({ status: "error", code: "session_paused", message: "Session is paused" }, { status: 400 });
    }
    if (session.status !== "active" || new Date(session.ends_at) <= now || new Date(session.starts_at) > now) {
      await flag(session.id, "session_not_active", { status: session.status });
      return NextResponse.json({ status: "error", code: "session_closed", message: "Session is not active" }, { status: 400 });
    }

    // 2b. Device/server time drift (QR TTL is short; extreme skew is only flagged
    // for audit — the JWT expiry check above is the hard gate).
    const driftMs = Math.abs(Date.now() - new Date(session.starts_at).getTime());
    if (driftMs > 5 * 60 * 1000) {
      await flag(session.id, "time_drift", { driftMs: Math.round(driftMs / 1000) });
    }

    // effective anti-cheat + timing settings (session > course > program > global)
    const SET_KEYS = ["present_within_min", "late_after_min", "grace_period_min", "allow_late_scanning",
      "device_binding_on", "campus_ip_allowlist", "gps_accuracy_margin_m", "geofence_default_radius_m"];
    const { data: srows } = await svc.from("app_settings").select("scope_type,scope_id,key,value").in("key", SET_KEYS);
    const courseProgramId = (session as any)?.courses?.program_id ?? null;
    const relevant = ((srows ?? []) as any[]).filter(r =>
      r.scope_type === "global" ||
      (r.scope_type === "program" && r.scope_id === courseProgramId) ||
      (r.scope_type === "course" && r.scope_id === session.course_id) ||
      (r.scope_type === "session" && r.scope_id === session.id));
    const eff = <T,>(key: string, fb: T): T => effective(relevant.filter(r => r.key === key), key, fb);
    const presentWithin = asNum(eff("present_within_min", 10), 10);
    // a per-session late_after_min set by the professor beats the scoped setting
    const lateAfter = asNum(
      session.late_after_min ?? eff("late_after_min", 20), 20
    );
    const grace = asNum(eff("grace_period_min", 5), 5);
    const allowLate = asBool(eff("allow_late_scanning", true), true);
    const deviceOn = asBool(eff("device_binding_on", true), true);
    const gpsMargin = asNum(eff("gps_accuracy_margin_m", 50), 50);
    const defaultRadius = asNum(eff("geofence_default_radius_m", 100), 100);

    // 3. enrolled?
    const { data: enr } = await svc.from("enrollments").select("id").eq("course_id", session.course_id).eq("student_id", user.id).maybeSingle();
    if (!enr) { await flag(session.id, "not_enrolled", {}); return NextResponse.json({ status: "error", code: "not_enrolled", message: "You are not enrolled in this course" }, { status: 403 }); }

    // 4. duplicate (idempotent success)
    const { data: existing } = await svc.from("attendance_records").select("id,scanned_at").eq("session_id", session.id).eq("student_id", user.id).maybeSingle();
    if (existing) {
      return remember({ status: "success", code: "already_marked", message: "Already marked present", course: (session as any).courses, time: existing.scanned_at });
    }

    // 5. device check (skippable by admin setting)
    if (deviceOn) {
    const { data: dev } = await svc.from("devices").select("*").eq("student_id", user.id).maybeSingle();
    if (!dev) {
      // bind on first success: ensure device not bound to someone else
      const { data: clash } = await svc.from("devices").select("student_id").eq("device_id", deviceId).maybeSingle();
      if (clash && clash.student_id !== user.id) { await flag(session.id, "device_conflict", {}); return NextResponse.json({ status: "error", code: "device_conflict", message: "This device is bound to another student" }, { status: 403 }); }
      await svc.from("devices").insert({ student_id: user.id, device_id: deviceId, ua_hint: ua.slice(0, 200) });
    } else if (dev.device_id !== deviceId) {
      await flag(session.id, "wrong_device", { expected: "bound", got: "other" });
      return NextResponse.json({ status: "error", code: "wrong_device", message: "Wrong device — ask admin to reset your device binding" }, { status: 403 });
    }
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
      const margin = Math.min(accuracy ?? 0, gpsMargin);
      const radius = asNum(session.geofence_radius_m ?? null, defaultRadius);
      if (d > radius + margin) {
        await flag(session.id, "outside_geofence", { distance_m: Math.round(d) });
        return NextResponse.json({ status: "error", code: "outside_hall", message: `Outside the hall (${Math.round(d)}m away)` }, { status: 400 });
      }
    }

    // 6b. campus IP allowlist (only enforced when the admin configured ranges)
    const allowRule = eff("campus_ip_allowlist", null);
    if (!ipAllowed(ip, allowRule)) {
      await flag(session.id, "outside_campus_ip", { ip });
      return NextResponse.json({ status: "error", code: "outside_campus", message: "Off-campus network" }, { status: 400 });
    }

    // 6c. timing verdict (server time): present / late / too late
    const mins = (Date.now() - new Date(session.starts_at).getTime()) / 60000;
    let mark: "present" | "late" = "present";
    if (mins > presentWithin + grace) {
      if (allowLate && mins <= lateAfter + grace) mark = "late";
      else {
        await flag(session.id, "late_scan", { mins: Math.round(mins) });
        return NextResponse.json({ status: "error", code: "too_late", message: "Scanning window ended" }, { status: 400 });
      }
    }

    // 7. QR nonce single-use ledger + insert + audit (unique constraints guard races).
    // One student may consume a given rotating code exactly once: this blocks
    // re-marking from a captured screenshot after a professor unmarks them.
    // A double-tap race (concurrent claim seconds old) stays idempotent —
    // only a claim left over from an earlier use is treated as replay.
    const { error: nonceErr } = await svc.from("qr_scans").insert({
      session_id: session.id, student_id: user.id, nonce: v.nonce, device_id: deviceId
    });
    if (nonceErr && nonceErr.code === "23505") {
      const { data: claim } = await svc.from("qr_scans")
        .select("created_at").eq("session_id", session.id)
        .eq("student_id", user.id).eq("nonce", v.nonce).single();
      const ageMs = claim ? Date.now() - new Date(claim.created_at).getTime() : Infinity;
      if (isNonceReplay(ageMs)) {
        await flag(session.id, "qr_nonce_reuse", { nonce_age_s: Math.round(ageMs / 1000) });
        return NextResponse.json({ status: "error", code: "replay_code", message: "Code already used — scan the live QR" }, { status: 400 });
      }
      // fall through: the attendance unique constraint keeps exactly one record
    } else if (nonceErr) {
      // ledger outage must not block attendance — flag and continue
      await flag(session.id, "qr_ledger_error", { msg: nonceErr.message });
    }

    const { data: rec, error: insErr } = await svc.from("attendance_records")
      .insert({ session_id: session.id, student_id: user.id, method: "scan", status: mark })
      .select().single();
    if (insErr) {
      if (insErr.code === "23505") {
        // lost the race to a concurrent identical request — report the winner's real time
        const { data: existing } = await svc.from("attendance_records")
          .select("scanned_at").eq("session_id", session.id).eq("student_id", user.id).maybeSingle();
        return remember({ status: "success", code: "already_marked", message: "Already marked present", course: (session as any).courses, time: existing?.scanned_at ?? new Date().toISOString() });
      }
      throw insErr;
    }
    await svc.from("audit_logs").insert({ actor_id: user.id, action: "scan_present", entity_type: "attendance_session", entity_id: session.id, metadata: { device: deviceId, ip, in_app_browser: inApp, idempotency_key: idempotencyKey ?? null } });

    return remember({ status: "success", code: mark === "late" ? "marked_late" : "marked", message: mark === "late" ? "Marked late" : "Marked present", course: (session as any).courses, time: rec.scanned_at, in_app_browser: inApp });
  } catch (e: any) {
    return NextResponse.json({ status: "error", code: "server_error", message: "Server error, try again" }, { status: 500 });
  }
}
