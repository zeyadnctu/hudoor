"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, StatusPill, DataTable, THead, Th, Td, SkeletonRows } from "@/components/ui";
import { FileDown } from "lucide-react";

export default function ProfReports() {
  const { t } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data } = await sb.from("attendance_records").select("id,scanned_at,method,status,student_id,attendance_sessions(course_id,courses(code))").order("scanned_at", { ascending: false }).limit(500);
      const recs = (data ?? []) as any[];
      const ids = [...new Set(recs.map(x => x.student_id))];
      let byUser: Record<string, string> = {};
      if (ids.length) {
        const { data: dets } = await sb.from("student_details").select("user_id,full_name_ar,university_id").in("user_id", ids);
        (dets ?? []).forEach((d: any) => { byUser[d.user_id] = `${d.full_name_ar} — ${d.university_id}`; });
      }
      setRows(recs.map(x => ({ ...x, who: byUser[x.student_id] ?? x.student_id.slice(0, 8), code: x.attendance_sessions?.courses?.code ?? "" })));
      setLoading(false);
    })();
  }, []);
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">{t.reports}</h1>
        <a href="/api/reports/export"><Button variant="outline"><FileDown size={18} strokeWidth={2} /> {t.exportCsv}</Button></a>
      </div>
      <div className="mt-4">
        <DataTable>
          <THead><Th>{t.name}</Th><Th>{t.course}</Th><Th>{t.time}</Th><Th>{t.status}</Th></THead>
          <tbody>
            {loading && <SkeletonRows rows={8} cols={4} />}
            {rows.map(r => (
              <tr key={r.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                <Td className="font-medium">{r.who}</Td>
                <Td className="tnum font-semibold">{r.code}</Td>
                <Td className="tnum whitespace-nowrap">{new Date(r.scanned_at).toLocaleString()}</Td>
                <Td><StatusPill status={r.status} /></Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </main>
  );
}
