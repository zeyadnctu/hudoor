/**
 * Lazy session lifecycle tick — calls the /api/cron/sessions endpoint.
 * Fire-and-forget; safe to call on every page load.
 * Vercel Hobby only allows daily cron, so we tick lazily from the client.
 */
export async function tickSessions(): Promise<void> {
  try {
    await fetch("/api/cron/sessions", { method: "GET" });
  } catch {
    // silent — ticking is best-effort
  }
}
