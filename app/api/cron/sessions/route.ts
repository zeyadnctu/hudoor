import { NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sessions — session lifecycle tick.
 * Scheduled → active when start time reached; active → ended when end time passed.
 * Designed for Vercel Cron (vercel.json) but callable manually too.
 */
export async function GET() {
  const svc = serviceSupabase();
  const now = new Date().toISOString();

  // 1. Activate scheduled sessions whose start time has arrived
  const { data: toActivate, error: e1 } = await svc.from("attendance_sessions")
    .update({ status: "active", activated_at: now })
    .eq("status", "scheduled")
    .lte("starts_at", now)
    .select("id");

  // 2. End active sessions whose end time has passed
  const { data: toEnd, error: e2 } = await svc.from("attendance_sessions")
    .update({ status: "ended", ended_at: now })
    .eq("status", "active")
    .lte("ends_at", now)
    .select("id");

  const activated = (toActivate ?? []).length;
  const ended = (toEnd ?? []).length;

  return NextResponse.json({
    ok: true,
    activated,
    ended,
    errors: [e1?.message, e2?.message].filter(Boolean),
    now,
  });
}
