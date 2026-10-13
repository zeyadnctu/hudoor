"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Select, Label } from "@/components/ui";
import { CrudPage } from "@/components/console/CrudPage";
import { browserSupabase } from "@/lib/supabase";

function FacultyDetail({ row, close }: { row: any; close: () => void }) {
  const { t } = useApp();
  const [counts, setCounts] = useState<any>(null);
  const [profs, setProfs] = useState<any[]>([]);
  const [head, setHead] = useState(row.head_id ?? "");
  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const [deps, courses, students] = await Promise.all([
        sb.from("departments").select("id", { count: "exact", head: true }).eq("faculty_id", row.id),
        sb.from("courses").select("id", { count: "exact", head: true }).eq("faculty_id", row.id),
        sb.from("student_details").select("user_id", { count: "exact", head: true }).eq("faculty_id", row.id)
      ]);
      const { data: cps } = await sb.from("courses").select("id").eq("faculty_id", row.id);
      let pcount = 0;
      if ((cps ?? []).length) {
        const { count } = await sb.from("course_professors").select("professor_id", { count: "exact", head: true }).in("course_id", (cps as any[]).map(c => c.id));
        pcount = count ?? 0;
      }
      const { data: plist } = await sb.from("profiles").select("id,email").eq("role", "professor").eq("status", "approved").limit(200);
      setProfs(plist ?? []);
      setCounts({ departments: deps.count ?? 0, courses: courses.count ?? 0, students: students.count ?? 0, professors: pcount });
    })();
  }, [row.id]);
  return (
    <div>
      <h2 className="font-display text-xl font-bold" dir="auto">{row.name_ar}</h2>
      <p className="text-neutral-500" dir="auto">{row.name_en}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        {(["departments", "courses", "students", "professors"] as const).map(k => (
          <div key={k} className="rounded-md2 border border-black/10 p-3 dark:border-white/15">
            <div className="tnum font-display text-2xl font-bold">{counts?.[k] ?? "…"}</div>
            <div className="text-xs text-neutral-500">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Label>Head of faculty (professor)</Label>
        <div className="flex gap-2">
          <Select value={head} onChange={e => setHead(e.target.value)}>
            <option value="">—</option>
            {profs.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
          </Select>
          <Button onClick={async () => {
            await fetch("/api/console/faculties", {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: row.id, head_id: head || null })
            });
          }}>{t.save}</Button>
        </div>
      </div>
      <Button variant="outline" className="mt-4 w-full" onClick={close}>Close</Button>
    </div>
  );
}

export default function FacultiesPage() {
  const { t } = useApp();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.faculties}</h1>
      <div className="mt-4">
        <CrudPage
          resource="faculties"
          columns={[
            { key: "name_ar", label: "Name (AR)", sortable: true },
            { key: "name_en", label: "Name (EN)", sortable: true }
          ]}
          detail={(row, close) => <FacultyDetail row={row} close={close} />}
          impactFor={rows => `Delete ${rows.length} facultie(s)? Their departments, courses and programs will be unassigned or removed by cascade.`}
        />
      </div>
    </div>
  );
}
