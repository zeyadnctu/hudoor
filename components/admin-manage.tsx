"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { UserPlus, Building2, Layers, CalendarDays, BookPlus, Link2, UserCheck } from "lucide-react";

async function post(url: string, body: any) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `http_${r.status}`);
  return j;
}

export function AdminManage() {
  const { t } = useApp();
  const [facs, setFacs] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [sems, setSems] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const [user, setUser] = useState({ email: "", password: "", role: "student" });
  const [fac, setFac] = useState({ name_ar: "", name_en: "" });
  const [dep, setDep] = useState({ faculty_id: "", name_ar: "", name_en: "" });
  const [sem, setSem] = useState({ name: "", starts_at: "", ends_at: "", is_current: false });
  const [crs, setCrs] = useState({ code: "", name_ar: "", name_en: "", faculty_id: "", department_id: "", semester_id: "", section: "A" });
  const [asg, setAsg] = useState({ course_id: "", professor_id: "" });
  const [enr, setEnr] = useState({ course_id: "", student_ref: "", csv: "" });

  async function refresh() {
    const sb = browserSupabase();
    const [f, d, s, c, p] = await Promise.all([
      sb.from("faculties").select("*").order("name_ar"),
      sb.from("departments").select("*, faculties(name_ar)").order("name_ar"),
      sb.from("semesters").select("*").order("starts_at", { ascending: false }),
      sb.from("courses").select("id,code,name_ar").order("code"),
      sb.from("profiles").select("id,email").eq("role", "professor").eq("status", "approved").order("email").limit(100)
    ]);
    setFacs(f.data ?? []); setDeps(d.data ?? []); setSems(s.data ?? []); setCourses(c.data ?? []); setProfs(p.data ?? []);
  }
  useEffect(() => { refresh(); }, []);

  async function run(key: string, fn: () => Promise<any>) {
    setBusy(key); setMsg("");
    try { await fn(); setMsg(`✓ ${t.createdOk}`); await refresh(); }
    catch (e: any) { setMsg(`✗ ${e.message}`); }
    finally { setBusy(""); }
  }

  const box = "rounded-md2 border border-black/10 p-4 dark:border-white/15";
  const h3 = "font-display flex items-center gap-2 text-lg font-bold";

  return (
    <section aria-label={t.manage} className="mt-8">
      <h2 className="font-display text-xl font-bold">{t.manage}</h2>
      {msg && <p className="mt-2 rounded-md2 border border-black/15 px-3 py-2 text-sm font-semibold dark:border-white/20" role="status">{msg}</p>}
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className={box}>
          <h3 className={h3}><UserPlus size={19} strokeWidth={2} /> {t.createAccount}</h3>
          <div className="mt-2 grid gap-2">
            <div><Label>{t.email}</Label><Input value={user.email} onChange={e => setUser({ ...user, email: e.target.value })} dir="ltr" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t.password}</Label><Input type="password" value={user.password} onChange={e => setUser({ ...user, password: e.target.value })} dir="ltr" /></div>
              <div><Label>{t.status}</Label>
                <Select value={user.role} onChange={e => setUser({ ...user, role: e.target.value })}>
                  <option value="student">{t.student}</option>
                  <option value="professor">{t.professor}</option>
                  <option value="admin">{t.admin}</option>
                </Select>
              </div>
            </div>
            <Button disabled={busy === "u"} onClick={() => run("u", () => post("/api/admin/users", user).then(() => setUser({ email: "", password: "", role: "student" })))}>{t.createAccount}</Button>
          </div>
        </div>

        <div className={box}>
          <h3 className={h3}><BookPlus size={19} strokeWidth={2} /> {t.newCourse}</h3>
          <div className="mt-2 grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Code</Label><Input value={crs.code} onChange={e => setCrs({ ...crs, code: e.target.value })} dir="ltr" placeholder="CE201" /></div>
              <div><Label>{t.section}</Label><Input value={crs.section} onChange={e => setCrs({ ...crs, section: e.target.value })} /></div>
            </div>
            <div><Label>{t.fullNameAr}</Label><Input value={crs.name_ar} onChange={e => setCrs({ ...crs, name_ar: e.target.value })} /></div>
            <div><Label>{t.fullNameEn}</Label><Input value={crs.name_en} onChange={e => setCrs({ ...crs, name_en: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>{t.faculty}</Label>
                <Select value={crs.faculty_id} onChange={e => setCrs({ ...crs, faculty_id: e.target.value, department_id: "" })}>
                  <option value="">—</option>{facs.map(f => <option key={f.id} value={f.id}>{f.name_ar}</option>)}
                </Select>
              </div>
              <div><Label>{t.department}</Label>
                <Select value={crs.department_id} onChange={e => setCrs({ ...crs, department_id: e.target.value })}>
                  <option value="">—</option>{deps.filter(d => !crs.faculty_id || d.faculty_id === crs.faculty_id).map(d => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
                </Select>
              </div>
              <div><Label>Semester</Label>
                <Select value={crs.semester_id} onChange={e => setCrs({ ...crs, semester_id: e.target.value })}>
                  <option value="">—</option>{sems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            </div>
            <Button disabled={busy === "c"} onClick={() => run("c", () => post("/api/admin/catalog", { kind: "course", ...crs, faculty_id: crs.faculty_id || null, department_id: crs.department_id || null, semester_id: crs.semester_id || null }))}>{t.newCourse}</Button>
          </div>
        </div>

        <div className={box}>
          <h3 className={h3}><Building2 size={19} strokeWidth={2} /> {t.newFaculty} / {t.newDepartment}</h3>
          <div className="mt-2 grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t.fullNameAr}</Label><Input value={fac.name_ar} onChange={e => setFac({ ...fac, name_ar: e.target.value })} /></div>
              <div><Label>{t.fullNameEn}</Label><Input value={fac.name_en} onChange={e => setFac({ ...fac, name_en: e.target.value })} /></div>
            </div>
            <Button variant="outline" disabled={busy === "f"} onClick={() => run("f", () => post("/api/admin/catalog", { kind: "faculty", ...fac }).then(() => setFac({ name_ar: "", name_en: "" })))}>{t.newFaculty}</Button>
            <div className="grid grid-cols-2 gap-2 border-t border-black/10 pt-2 dark:border-white/10">
              <div className="col-span-2"><Label>{t.faculty}</Label>
                <Select value={dep.faculty_id} onChange={e => setDep({ ...dep, faculty_id: e.target.value })}>
                  <option value="">—</option>{facs.map(f => <option key={f.id} value={f.id}>{f.name_ar}</option>)}
                </Select>
              </div>
              <div><Label>{t.fullNameAr}</Label><Input value={dep.name_ar} onChange={e => setDep({ ...dep, name_ar: e.target.value })} /></div>
              <div><Label>{t.fullNameEn}</Label><Input value={dep.name_en} onChange={e => setDep({ ...dep, name_en: e.target.value })} /></div>
            </div>
            <Button variant="outline" disabled={busy === "d"} onClick={() => run("d", () => post("/api/admin/catalog", { kind: "department", ...dep }))}>{t.newDepartment}</Button>
          </div>
        </div>

        <div className={box}>
          <h3 className={h3}><CalendarDays size={19} strokeWidth={2} /> {t.newSemester}</h3>
          <div className="mt-2 grid gap-2">
            <div><Label>Name</Label><Input value={sem.name} onChange={e => setSem({ ...sem, name: e.target.value })} placeholder="2026 Fall" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t.from}</Label><Input type="date" value={sem.starts_at} onChange={e => setSem({ ...sem, starts_at: e.target.value })} /></div>
              <div><Label>{t.to}</Label><Input type="date" value={sem.ends_at} onChange={e => setSem({ ...sem, ends_at: e.target.value })} /></div>
            </div>
            <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={sem.is_current} onChange={e => setSem({ ...sem, is_current: e.target.checked })} />
              <span className="font-medium">Current / الحالي</span>
            </label>
            <Button variant="outline" disabled={busy === "s"} onClick={() => run("s", () => post("/api/admin/catalog", { kind: "semester", ...sem }))}>{t.newSemester}</Button>
          </div>
        </div>

        <div className={box}>
          <h3 className={h3}><Link2 size={19} strokeWidth={2} /> {t.assignProfessor}</h3>
          <div className="mt-2 grid gap-2">
            <div><Label>{t.course}</Label>
              <Select value={asg.course_id} onChange={e => setAsg({ ...asg, course_id: e.target.value })}>
                <option value="">—</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
              </Select>
            </div>
            <div><Label>{t.professor}</Label>
              <Select value={asg.professor_id} onChange={e => setAsg({ ...asg, professor_id: e.target.value })}>
                <option value="">—</option>{profs.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
              </Select>
            </div>
            <Button disabled={busy === "a"} onClick={() => run("a", () => post("/api/admin/assign", { action: "assign_professor", ...asg }))}>{t.assignProfessor}</Button>
          </div>
        </div>

        <div className={box}>
          <h3 className={h3}><UserCheck size={19} strokeWidth={2} /> {t.enrollStudents}</h3>
          <div className="mt-2 grid gap-2">
            <div><Label>{t.course}</Label>
              <Select value={enr.course_id} onChange={e => setEnr({ ...enr, course_id: e.target.value })}>
                <option value="">—</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
              </Select>
            </div>
            <div><Label>{t.universityId} / Email</Label><Input value={enr.student_ref} onChange={e => setEnr({ ...enr, student_ref: e.target.value })} dir="auto" /></div>
            <div><Label>CSV</Label><textarea value={enr.csv} onChange={e => setEnr({ ...enr, csv: e.target.value })} rows={3} dir="auto"
              placeholder={t.csvHint}
              className="min-h-[80px] w-full rounded-md2 border-2 border-black/15 bg-paper px-4 py-2 text-base outline-none focus:border-register dark:border-white/20 dark:bg-white/5" /></div>
            <div className="flex gap-2">
              <Button disabled={busy === "e1"} onClick={() => run("e1", () => post("/api/admin/assign", { action: "enroll_student", course_id: enr.course_id, student_ref: enr.student_ref }))}>{t.enroll}</Button>
              <Button variant="outline" disabled={busy === "e2"} onClick={() => run("e2", () => post("/api/admin/assign", { action: "enroll_csv", course_id: enr.course_id, csv: enr.csv }))}>{t.enrollStudents} (CSV)</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-display flex items-center gap-2 text-lg font-bold"><Layers size={19} strokeWidth={2} /> {t.department}</h3>
        <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {deps.map(d => (
            <div key={d.id} className="flex justify-between px-4 py-2 text-[15px]">
              <span className="font-medium">{d.name_ar} <span className="text-neutral-500">{d.name_en}</span></span>
              <span className="text-sm text-neutral-500">{d.faculties?.name_ar}</span>
            </div>
          ))}
          {deps.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        </div>
      </div>
    </section>
  );
}
