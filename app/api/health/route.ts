import { NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    const svc = serviceSupabase();
    // cheap ping: count admins (RLS-bypass via service role) — just ensures DB reachable
    const { count, error } = await svc
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({
      status: "ok",
      db: "reachable",
      profiles: count ?? 0,
      latencyMs: Date.now() - start,
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        status: "degraded",
        error: e?.message ?? "unknown",
        latencyMs: Date.now() - start,
        ts: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
