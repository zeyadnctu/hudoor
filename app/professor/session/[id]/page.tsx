"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, Input, Label, QrFrame, StatusPill, SkeletonRows, DataTable, EmptyState } from "@/components/ui";
import { Square, Projector, Users, ScanLine } from "lucide-react";

export default function SessionLive({ params }: { params: { id: string } }) {
  const id = params.id;
  const { t } = useApp();
  const [url, setUrl] = useState("");
  const [ttl, setTtl] = useState(10);
  const [countdown, setCountdown] = useState(10);
  const [present, setPresent] = useState<any[]>([]);
  const [course, setCourse] = useState<any>(null);
  const [ended, setEnded] = useState(false);
  const [projector, setProjector] = useState(false);
  const [manual, setManual] = useState({ student_id: "", reason: "" });
  const [loading, setLoading] = useState(true);

  async function fetchToken() {
    const r = await fetch(`/api/sessions/${id}/qr-token`);
    const j = await r.json();
    if (j.url) { setUrl(j.url); setTtl(j.expiresIn ?? 10); setCountdown(j.expiresIn ?? 10); }
    else if (j.error === "ended") setEnded(true);
  }
  useEffect(() => {
    fetchToken();
    const tk = setInterval(fetchToken, 10_000);
    const c = setInterval(() => setCountdown(v => (v <= 1 ? v : v - 1)), 1000);
    return () => { clearInterval(tk); clearInterval(c); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sb = browserSupabase();
    (async () => {
      const { data: s } = await sb.from("attendance_sessions").select("status,course_id,courses(code,name_ar,name_en)").eq("id", id).maybeSingle();
      if ((s as any)?.status === "ended") setEnded(true);
      setCourse((s as any)?.courses ?? null);
      const { data } = await sb.from("attendance_records").select("id,student_id,scanned_at,method").eq("session_id", id).order("scanned_at", { ascending: false }).limit(200);
      const recs = data ?? [];
      const ids = [...new Set(recs.map((x: any) => x.student_id))];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: dets } = await sb.from("student_details").select("user_id,full_name_ar,full_name_en,university_id").in("user_id", ids);
        (dets ?? []).forEach((d: any) => { names[d.user_id] = `${d.full_name_ar} — ${d.university_id}`; });
      }
      setPresent(recs.map((x: any) => ({ ...x, label: names[x.student_id] ?? x.student_id.slice(0, 8) })));
      setLoading(false);
    })();
    const ch = sb.channel("live-" + id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_records", filter: `session_id=eq.${id}` }, async (payload) => {
        const sid = (payload.new as any).student_id;
        const { data } = await sb.from("student_details").select("full_name_ar,university_id").eq("user_id", sid).maybeSingle();
        setPresent(p => [{ ...(payload.new as any), label: data ? `${(data as any).full_name_ar} — ${(data as any).university_id}` : sid.slice(0, 8) }, ...p]);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [id]);

  async function end() {
    if (!confirm(t.endSession + "?")) return;
    await fetch(`/api/sessions?id=${id}`, { method: "PATCH" });
    setEnded(true);
  }
  async function markManual() {
    if (!manual.student_id || !manual.reason) return;
    const r = await fetch("/api/attendance/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: id, student_id: manual.student_id, reason: manual.reason, status: "present" }) });
    if (r.ok) setManual({ student_id: "", reason: "" });
  }

  const fraction = countdown / Math.max(1, ttl);
  const qrSize = projector ? 560 : 320;

  return (
    <main className="min-h-screen bg-paper text-ink dark:bg-inkdeep dark:text-neutral-100">
      {/* session header: hairline rule, course + one big number */}
      <header className="border-b-2 border-ink/15 dark:border-white/20">
        <div className={`mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 ${projector ? "py-8" : "py-5"}`}>
          <div>
            <p className="tnum font-display text-sm font-semibold text-register">{course?.code ?? ""}</p>
            <h1 className={`font-display font-bold leading-tight ${projector ? "text-5xl" : "text-3xl"}`}>
              {course ? (course.name_ar || course.name_en) : ""}
            </h1>
            <div className="mt-1"><StatusPill status={ended ? "ended" : "active"} /></div>
          </div>
          <div className="flex items-end gap-8">
            <div>
              <div className={`font-display tnum font-bold leading-none ${projector ? "text-8xl" : "text-6xl"}`} aria-live="polite">
                {present.length}
              </div>
              <div className="mt-1 text-base font-medium text-neutral-500">{t.presentCount}</div>
            </div>
            <div className="flex gap-2 pb-1">
              <Button variant="outline" onClick={() => setProjector(p => !p)}>
                <Projector size={18} strokeWidth={2} /> {projector ? t.exitProjector : t.projectorMode}
              </Button>
              {!ended && (
                <Button variant="brick" onClick={end}>
                  <Square size={18} strokeWidth={2} /> {t.endSession}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className={`mx-auto grid max-w-6xl gap-8 px-5 py-6 ${projector ? "lg:grid-cols-1" : "lg:grid-cols-[auto_1fr]"}`}>
        {/* QR in draining frame */}
        <section aria-label="QR" className={projector ? "text-center" : ""}>
          {!ended ? (
            <>
              <QrFrame fraction={fraction} size={qrSize}>
                {url ? <QRCodeSVG value={url} size={qrSize} /> : <div className="skeleton bg-black/10 dark:bg-white/10" style={{ width: qrSize, height: qrSize }} />}
              </QrFrame>
              <p className="tnum mt-3 font-display text-lg font-semibold">
                {t.newCodeIn} <span className="text-register">{countdown}</span>
              </p>
            </>
          ) : (
            <p className="rounded-md2 border-2 border-black/15 p-8 text-center font-display text-2xl font-bold dark:border-white/20">
              {t.sessionEnded}
            </p>
          )}
        </section>

        {/* arrivals */}
        {!projector && (
          <section aria-label={t.presentCount}>
            <h2 className="font-display flex items-center gap-2 text-xl font-bold">
              <Users size={20} strokeWidth={2} /> {t.presentCount}
            </h2>
            {loading ? (
              <DataTable><tbody><SkeletonRows rows={6} cols={2} /></tbody></DataTable>
            ) : present.length === 0 ? (
              <div className="mt-3 rounded-md2 border border-black/10 dark:border-white/15">
                <EmptyState icon={<ScanLine size={28} strokeWidth={1.75} />} title={t.nothingYet} hint={t.noSessionsHint} />
              </div>
            ) : (
              <div className="mt-3 max-h-[46vh] overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
                <table className="w-full border-collapse text-start text-[15px]">
                  <tbody>
                    {present.map((p: any, i: number) => (
                      <tr key={p.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                        <td className="tnum px-4 py-2.5 text-neutral-500">{present.length - i}</td>
                        <td className="px-4 py-2.5 font-medium">{p.label}</td>
                        <td className="tnum px-4 py-2.5 text-end text-neutral-500">
                          {new Date(p.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!ended && (
              <form
                className="mt-5 border-t-2 border-black/15 pt-4 dark:border-white/20"
                onSubmit={e => { e.preventDefault(); markManual(); }}
              >
                <h3 className="font-display text-lg font-bold">{t.manualMark}</h3>
                <div className="mt-2 grid gap-2">
                  <div><Label>Student ID</Label><Input placeholder="uuid" value={manual.student_id} onChange={e => setManual({ ...manual, student_id: e.target.value })} /></div>
                  <div><Label>{t.manualReason}</Label><Input placeholder={t.manualHint} value={manual.reason} onChange={e => setManual({ ...manual, reason: e.target.value })} /></div>
                  <Button type="submit" disabled={!manual.student_id || !manual.reason}>{t.manualMark}</Button>
                </div>
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
