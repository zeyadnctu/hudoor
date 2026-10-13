"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { Plus, Upload, CalendarPlus } from "lucide-react";
import { detectClashes } from "@/lib/timetable";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default function TimetablePage() {
  const { t } = useApp();
  const [sems, setSems] = useState<any[]>([]);
  const [sem, setSem] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [view, setView] = useState<"week" | "list">("week");
  const [modal, setModal] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [gen, setGen] = useState({ from: "", to: "", course_id: "", open: false });
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<any>({ day: 1, starts_at: "09:00", ends_at: "10:00", course_id: "", professor_id: "", room_id: "", section: "A", group_name: "" });

  async function load() {
    const s = await fetch("/api/console/semesters?perPage=100").then(r => r.json());
    setSems(s.rows ?? []);
    const cur = (s.rows ?? []).find((x: any) => x.is_current) ?? (s.rows ?? [])[0];
    if (cur && !sem) setSem(cur.id);
    const [c, r2, p] = await Promise.all([
      fetch("/api/console/courses?perPage=500").then(r => r.json()),
      fetch("/api/console/rooms?perPage=500").then(r => r.json()),
      fetch("/api/console/users-manage?role=professor&perPage=300").then(r => r.json()).catch(() => ({ rows: [] }))
    ]);
    setCourses(c.rows ?? []); setRooms(r2.rows ?? []); setProfs(p.rows ?? []);
  }
  async function loadSlots(id: string) {
    if (!id) return;
    const r = await fetch(`/api/console/timetable?semester_id=${id}`);
    const j = await r.json();
    setSlots(j.rows ?? []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { loadSlots(sem); }, [sem]);

  const clashes = detectClashes(slots.map(s => ({
    day: s.day, starts_at: s.starts_at.slice(0, 5), ends_at: s.ends_at.slice(0, 5),
    room_id: s.room_id, professor_id: s.professor_id, section: s.section, course_id: s.course_id
  })));
  const clashIds = new Set(clashes.flatMap(c => [(c.slotA as any).course_id, (c.slotB as any).course_id]));

  async function saveSlot() {
    const r = await fetch("/api/console/timetable", {
      method: modal?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(modal?.id ? { id: modal.id } : {}), semester_id: sem, ...form })
    });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else {
      setModal(null);
      setMsg(j.clashes?.length ? `${t.clash}: ${j.clashes.length}` : `✓ ${t.createdOk}`);
      loadSlots(sem);
    }
  }
  async function moveSlot(slot: any, day: number) {
    await fetch("/api/console/timetable", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: slot.id, day })
    });
    loadSlots(sem);
  }
  async function delSlot(id: string) {
    if (!confirm("Delete this slot?")) return;
    await fetch("/api/console/timetable", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] })
    });
    loadSlots(sem);
  }
  async function generate() {
    const r = await fetch("/api/console/timetable", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semester_id: sem, from: gen.from, to: gen.to, course_id: gen.course_id || undefined })
    });
    const j = await r.json();
    setMsg(r.ok ? `✓ ${t.createdOk}: ${j.created}` : j.error);
    setGen({ ...gen, open: false });
  }

  const codeOf = (id: string) => courses.find(c => c.id === id)?.code ?? id?.slice(0, 8);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t.timetable}</h1>
        <div className="flex flex-wrap gap-2">
          <Select value={sem} onChange={e => setSem(e.target.value)} aria-label="Semester">
            {sems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <div className="flex rounded-md2 border border-black/15 dark:border-white/20">
            <button onClick={() => setView("week")} className={`min-h-[48px] px-4 text-sm font-bold ${view === "week" ? "bg-register text-white" : ""}`}>{t.weeklyView}</button>
            <button onClick={() => setView("list")} className={`min-h-[48px] px-4 text-sm font-bold ${view === "list" ? "bg-register text-white" : ""}`}>{t.listView}</button>
          </div>
          <Button variant="outline" onClick={() => { setForm({ day: 1, starts_at: "09:00", ends_at: "10:00", course_id: "", professor_id: "", room_id: "", section: "A", group_name: "" }); setModal({}); }}>
            <Plus size={18} strokeWidth={2} /> {t.addSlot}
          </Button>
          <Link href="/admin/timetable/import"><Button variant="outline"><Upload size={18} strokeWidth={2} /> {t.importPdf}</Button></Link>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
      {clashes.length > 0 && <p className="mt-2 rounded-md2 bg-hi-light px-3 py-2 text-sm font-bold text-hi-dark dark:bg-hi/15 dark:text-amber-200">{t.clash}: {clashes.length} — highlighted rows share a room, professor or section</p>}

      {view === "week" ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {DAYS.map((d, di) => (
            <div
              key={d} className="min-h-[140px] rounded-md2 border border-black/10 p-2 dark:border-white/15"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { const id = e.dataTransfer.getData("text/slot"); const s = slots.find(x => x.id === id); if (s && s.day !== di) moveSlot(s, di); }}
            >
              <p className="font-display px-1 py-1 text-sm font-bold">{(t as any)[d]}</p>
              {slots.filter(s => s.day === di).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(s => (
                <div
                  key={s.id} draggable
                  onDragStart={e => e.dataTransfer.setData("text/slot", s.id)}
                  className={`mb-1.5 cursor-grab rounded-md2 border p-2 text-sm active:cursor-grabbing ${clashIds.has(s.course_id) ? "border-hi bg-hi-light/50 dark:bg-hi/10" : "border-black/10 bg-paper dark:border-white/10 dark:bg-white/5"}`}
                >
                  <p className="tnum font-bold">{s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)} · {codeOf(s.course_id)}</p>
                  <p className="text-xs text-neutral-500">{s.rooms?.name_ar ?? ""} · {s.section}{s.group_name ? ` · ${s.group_name}` : ""}</p>
                  <div className="mt-1 flex gap-1">
                    <button onClick={() => { setForm({ day: s.day, starts_at: s.starts_at.slice(0, 5), ends_at: s.ends_at.slice(0, 5), course_id: s.course_id, professor_id: s.professor_id ?? "", room_id: s.room_id ?? "", section: s.section, group_name: s.group_name }); setModal(s); }} className="min-h-[36px] rounded px-2 text-xs font-bold text-register hover:bg-register-light">Edit</button>
                    <button onClick={() => delSlot(s.id)} className="min-h-[36px] rounded px-2 text-xs font-bold text-brick hover:bg-brick-light">Del</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
          <table className="w-full border-collapse text-start text-[15px]">
            <thead className="sticky top-0 bg-chalk dark:bg-ink">
              <tr className="border-b-2 border-black/15 dark:border-white/20">
                <th className="px-4 py-3 text-start font-display text-sm font-semibold">Day</th>
                <th className="px-4 py-3 text-start font-display text-sm font-semibold">Time</th>
                <th className="px-4 py-3 text-start font-display text-sm font-semibold">Course</th>
                <th className="px-4 py-3 text-start font-display text-sm font-semibold">Room</th>
                <th className="px-4 py-3 text-start font-display text-sm font-semibold">Section</th>
                <th className="px-4 py-3"><span className="sr-only">ops</span></th>
              </tr>
            </thead>
            <tbody>
              {slots.map(s => (
                <tr key={s.id} className={`border-b border-black/10 last:border-0 dark:border-white/10 ${clashIds.has(s.course_id) ? "bg-hi-light/40 dark:bg-hi/10" : ""}`}>
                  <td className="px-4 py-2.5">{(t as any)[DAYS[s.day]]}</td>
                  <td className="tnum px-4 py-2.5">{s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)}</td>
                  <td className="tnum px-4 py-2.5 font-semibold">{codeOf(s.course_id)}</td>
                  <td className="px-4 py-2.5">{s.rooms?.name_ar ?? "—"}</td>
                  <td className="px-4 py-2.5">{s.section}{s.group_name ? `/${s.group_name}` : ""}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end">
                    <button onClick={() => { setForm({ day: s.day, starts_at: s.starts_at.slice(0, 5), ends_at: s.ends_at.slice(0, 5), course_id: s.course_id, professor_id: s.professor_id ?? "", room_id: s.room_id ?? "", section: s.section, group_name: s.group_name }); setModal(s); }} className="min-h-[40px] px-2 text-sm font-semibold text-register hover:underline">Edit</button>
                    <button onClick={() => delSlot(s.id)} className="min-h-[40px] px-2 text-sm font-semibold text-brick hover:underline">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <Button variant="outline" onClick={() => setGen({ ...gen, open: !gen.open })}>
          <CalendarPlus size={18} strokeWidth={2} /> {t.generateSessions}
        </Button>
        {gen.open && (
          <div className="mt-2 grid gap-2 rounded-md2 border border-black/10 p-3 sm:grid-cols-4 dark:border-white/15">
            <div><Label>{t.from}</Label><Input type="date" value={gen.from} onChange={e => setGen({ ...gen, from: e.target.value })} /></div>
            <div><Label>{t.to}</Label><Input type="date" value={gen.to} onChange={e => setGen({ ...gen, to: e.target.value })} /></div>
            <div><Label>{t.course}</Label>
              <Select value={gen.course_id} onChange={e => setGen({ ...gen, course_id: e.target.value })}>
                <option value="">All</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </Select>
            </div>
            <div className="flex items-end"><Button className="w-full" onClick={generate}>{t.generateSessions}</Button></div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-md rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold">{modal.id ? "Edit slot" : t.addSlot}</h2>
            <div className="mt-3 grid gap-2">
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Day</Label>
                  <Select value={form.day} onChange={e => setForm({ ...form, day: Number(e.target.value) })}>
                    {DAYS.map((d, i) => <option key={d} value={i}>{(t as any)[d]}</option>)}
                  </Select>
                </div>
                <div><Label>Start</Label><Input type="time" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>End</Label><Input type="time" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
              <div><Label>{t.course}</Label>
                <Select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}>
                  <option value="">—</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t.professor}</Label>
                  <Select value={form.professor_id} onChange={e => setForm({ ...form, professor_id: e.target.value })}>
                    <option value="">—</option>{profs.map((p: any) => <option key={p.id} value={p.id}>{p.email}</option>)}
                  </Select>
                </div>
                <div><Label>{t.rooms}</Label>
                  <Select value={form.room_id} onChange={e => setForm({ ...form, room_id: e.target.value })}>
                    <option value="">—</option>{rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                  </Select>
                </div>
                <div><Label>{t.section}</Label><Input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} /></div>
                <div><Label>Group</Label><Input value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} /></div>
              </div>
              <Button onClick={saveSlot}>{t.save}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
