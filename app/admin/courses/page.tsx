"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Label } from "@/components/ui";
import { CrudPage } from "@/components/console/CrudPage";
import { AssignPicker, type AssignItem } from "@/components/console/AssignPicker";
import { browserSupabase } from "@/lib/supabase";

function CourseDetail({ row, close, refresh }: { row: any; close: () => void; refresh: () => void }) {
  const { t } = useApp();
  const [profs, setProfs] = useState<AssignItem[]>([]);
  const [tas, setTas] = useState<AssignItem[]>([]);
  const [allProfs, setAllProfs] = useState<AssignItem[]>([]);
  const [allTas, setAllTas] = useState<AssignItem[]>([]);
  const [sections, setSections] = useState(row.section ?? "A");
  const [rules, setRules] = useState<any>(row.attendance_rule ?? {});
  const [enrolled, setEnrolled] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const [cp, ct, pp, tp, en] = await Promise.all([
        sb.from("course_professors").select("professor_id").eq("course_id", row.id),
        sb.from("course_tas").select("ta_id").eq("course_id", row.id),
        sb.from("profiles").select("id,email").eq("role", "professor").eq("status", "approved").limit(300),
        sb.from("profiles").select("id,email").eq("custom_role", "ta").limit(300),
        sb.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", row.id)
      ]);
      const pids = new Set(((cp.data ?? []) as any[]).map(r => r.professor_id));
      const tids = new Set(((ct.data ?? []) as any[]).map(r => r.ta_id));
      const plist = (pp.data ?? []) as any[];
      const tlist = (tp.data ?? []) as any[];
      setAllProfs(plist.map(p => ({ value: p.id, label: p.email })));
      setAllTas(tlist.map(p => ({ value: p.id, label: p.email })));
      setProfs(plist.filter(p => pids.has(p.id)).map(p => ({ value: p.id, label: p.email })));
      setTas(tlist.filter(p => tids.has(p.id)).map(p => ({ value: p.id, label: p.email })));
      setEnrolled(en.count ?? 0);
    })();
  }, [row.id]);

  async function saveAssignments() {
    setMsg("");
    const r = await fetch("/api/console/course-staff", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: row.id,
        professor_ids: profs.map(p => p.value),
        ta_ids: tas.map(x => x.value)
      })
    });
    const j = await r.json();
    setMsg(r.ok ? `✓ ${t.createdOk}` : j.error);
  }
  async function saveSectionsRules() {
    setMsg("");
    const r = await fetch("/api/console/course-staff", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: row.id, section: sections, attendance_rule: rules })
    });
    const j = await r.json();
    setMsg(r.ok ? `✓ ${t.createdOk}` : j.error);
    if (r.ok) refresh();
  }

  return (
    <div>
      <h2 className="font-display text-xl font-bold" dir="auto">{row.name_ar}</h2>
      <p className="tnum text-neutral-500">{row.code} · {enrolled} enrolled</p>

      <h3 className="font-display mt-4 font-bold">{t.assignProfessor}</h3>
      <AssignPicker available={allProfs} assigned={profs} onChange={setProfs} />
      <h3 className="font-display mt-3 font-bold">TAs</h3>
      <AssignPicker available={allTas} assigned={tas} onChange={setTas} />
      <Button className="mt-2 w-full" onClick={saveAssignments}>{t.save}</Button>

      <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
        <div><Label>Sections (comma separated)</Label>
          <Input value={sections} onChange={e => setSections(e.target.value)} dir="ltr" placeholder="A,B" />
        </div>
        <h3 className="font-display mt-3 font-bold">{t.attendanceRules}</h3>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t.minPct}</Label>
            <Input type="number" value={rules.min_pct ?? ""} onChange={e => setRules({ ...rules, min_pct: Number(e.target.value) })} placeholder="75" />
          </div>
          <div><Label>{t.lateMin}</Label>
            <Input type="number" value={rules.late_after_min ?? ""} onChange={e => setRules({ ...rules, late_after_min: Number(e.target.value) })} placeholder="20" />
          </div>
        </div>
        <label className="mt-2 flex min-h-[48px] cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={rules.allow_late_scanning !== false} onChange={e => setRules({ ...rules, allow_late_scanning: e.target.checked })} />
          <span className="font-medium">{t.allowLate}</span>
        </label>
        <Button variant="outline" className="mt-2 w-full" onClick={saveSectionsRules}>{t.save}</Button>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
      <Button variant="outline" className="mt-4 w-full" onClick={close}>Close</Button>
    </div>
  );
}

export default function CoursesPage() {
  const { t } = useApp();
  const [tick, setTick] = useState(0);
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.courses}</h1>
      <div className="mt-4">
        <CrudPage
          key={tick}
          resource="courses"
          columns={[
            { key: "code", label: "Code", sortable: true },
            { key: "name_ar", label: "Name (AR)", sortable: true },
            { key: "credit_hours", label: "CH" },
            { key: "section", label: "Section" }
          ]}
          detail={(row, close) => <CourseDetail row={row} close={close} refresh={() => setTick(x => x + 1)} />}
          impactFor={rows => `Delete ${rows.length} course(s)? Sessions, records, enrollments and timetable slots of these courses will be removed by cascade. Type the count (${rows.length}) to confirm.`}
        />
      </div>
    </div>
  );
}
