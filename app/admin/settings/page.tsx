"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Select, Label } from "@/components/ui";
import { SettingsField, type SettingSpec } from "@/components/console/SettingsField";
import { PeriodGridEditor } from "@/components/console/PeriodGridEditor";

const GROUPS: { title: string; specs: SettingSpec[] }[] = [
  {
    title: "Attendance",
    specs: [
      { key: "qr_rotation_seconds", label: "QR rotation (sec)", type: "number", min: 5, max: 120 },
      { key: "qr_token_ttl_seconds", label: "Token lifetime (sec)", type: "number", min: 5, max: 120 },
      { key: "present_within_min", label: "Present within (min)", type: "number", min: 0, max: 180 },
      { key: "late_after_min", label: "Late after (min)", type: "number", min: 0, max: 180 },
      { key: "grace_period_min", label: "Grace (min)", type: "number", min: 0, max: 60 },
      { key: "min_pct_per_course", label: "Minimum %", type: "number", min: 0, max: 100 },
      { key: "auto_end_sessions", label: "Auto-end sessions", type: "boolean" },
      { key: "allow_late_scanning", label: "Allow late scanning", type: "boolean" }
    ]
  },
  {
    title: "Anti-cheat",
    specs: [
      { key: "device_binding_on", label: "Device binding", type: "boolean" },
      { key: "devices_per_student", label: "Devices per student", type: "number", min: 1, max: 5 },
      { key: "geofence_default_radius_m", label: "Default radius (m)", type: "number", min: 10, max: 2000 },
      { key: "gps_accuracy_margin_m", label: "GPS margin (m)", type: "number", min: 0, max: 200 },
      { key: "campus_ip_allowlist", label: "Campus IPs", type: "text", hint: "one range per line, empty = off" },
      { key: "rate_limit_per_min", label: "Attempts / minute", type: "number", min: 1, max: 200 }
    ]
  },
  {
    title: "Auth & login",
    specs: [
      { key: "auth_restrict_domain", label: "Restrict to university email", type: "boolean", hint: "applies to password + Google sign-in" },
      { key: "auth_email_domains", label: "Allowed email domains", type: "text", hint: "comma separated, empty = all" }
    ]
  },
  {
    title: "Access & data",
    specs: [
      { key: "self_signup_on", label: "Self signup", type: "boolean" },
      { key: "approval_required", label: "Approval required", type: "boolean" },
      { key: "session_timeout_min", label: "Session timeout (min)", type: "number", min: 5, max: 1440 },
      { key: "trash_retention_days", label: "Trash retention (days)", type: "number", min: 1, max: 365 },
      { key: "university_name", label: "University name", type: "text" },
      { key: "default_language", label: "Default language", type: "select", options: [{ value: "ar", label: "العربية" }, { value: "en", label: "English" }] }
    ]
  }
];

export default function SettingsPage() {
  const { t } = useApp();
  const [tab, setTab] = useState<"values" | "roles" | "flags" | "history" | "timetable">("values");
  const [rows, setRows] = useState<any[]>([]);
  const [effective, setEffective] = useState<Record<string, any>>({});
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [scope, setScope] = useState("global");
  const [scopeId, setScopeId] = useState("");
  const [targets, setTargets] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any>({ roles: [], grants: [], resources: [], actions: [] });
  const [flags, setFlags] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const s = await fetch("/api/console/settings").then(r => r.json());
    setRows(s.rows ?? []); setEffective(s.effective ?? {}); setHistory(s.history ?? []);
    const m = await fetch("/api/console/roles").then(r => r.json()).catch(() => null);
    if (m) setMatrix(m);
    const f = await fetch("/api/console/feature_flags").then(r => r.json()).catch(() => ({ rows: [] }));
    setFlags(f.rows ?? []);
  }
  useEffect(() => { load(); }, []);

  async function loadTargets() {
    if (scope === "global") { setTargets([]); return; }
    const map: Record<string, string> = { faculty: "faculties", department: "departments", course: "courses", session: "attendance_sessions", program: "programs" };
    const r = await fetch(`/api/console/${map[scope]}?perPage=300`).then(x => x.json()).catch(() => ({ rows: [] }));
    setTargets(r.rows ?? []);
    setScopeId("");
  }
  useEffect(() => { loadTargets(); /* eslint-disable-next-line */ }, [scope]);

  const own = rows.filter(r => r.scope_type === scope && (scope === "global" ? true : r.scope_id === scopeId));
  const ownMap: Record<string, any> = {};
  for (const r of own) ownMap[r.key] = r.value;

  async function saveKey(key: string, value: any) {
    const r = await fetch("/api/console/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope_type: scope, scope_id: scopeId || null, key, value })
    });
    if (!r.ok) setMsg("save failed");
    else { setDrafts(d => { const n = { ...d }; delete n[`${scope}:${scopeId}:${key}`]; return n; }); load(); }
  }
  async function resetKey(key: string) {
    const q = new URLSearchParams({ scope_type: scope, key });
    if (scopeId) q.set("scope_id", scopeId);
    await fetch(`/api/console/settings?${q}`, { method: "DELETE" });
    load();
  }
  async function toggleGrant(role: string, resource: string, action: string, has: boolean) {
    await fetch("/api/console/roles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, resource, action, allow: !has })
    });
    load();
  }
  async function toggleFlag(key: string, enabled: boolean) {
    await fetch("/api/console/feature_flags", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: key, enabled: !enabled })
    });
    load();
  }

  const dk = (k: string) => `${scope}:${scopeId}:${k}`;
  const valOf = (k: string) => (dk(k) in drafts ? drafts[dk(k)] : ownMap[k]);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.settings}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["values", "timetable", "roles", "flags", "history"] as const).map(k => (
          <button key={k} onClick={() => setTab(k)}
            className={`min-h-[48px] rounded-md2 px-4 font-bold ${tab === k ? "bg-ink text-chalk dark:bg-chalk dark:text-ink" : "border border-black/15 dark:border-white/20"}`}>
            {k === "values" ? t.settings : k === "timetable" ? t.timetable : k === "roles" ? t.rolesMatrix : k === "flags" ? t.featureFlagsList : t.history}
          </button>
        ))}
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}

      {tab === "values" && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div><Label>Scope</Label>
              <Select value={scope} onChange={e => setScope(e.target.value)}>
                <option value="global">{t.scopeGlobal}</option>
                <option value="program">{t.programs}</option>
                <option value="faculty">{t.faculties}</option>
                <option value="department">{t.department}</option>
                <option value="course">{t.course}</option>
                <option value="session">Session</option>
              </Select>
            </div>
            {scope !== "global" && (
              <div><Label>Target</Label>
                <Select value={scopeId} onChange={e => setScopeId(e.target.value)}>
                  <option value="">—</option>
                  {targets.map((x: any) => <option key={x.id} value={x.id}>{x.name_ar ?? x.name ?? x.code ?? x.id.slice(0, 8)}</option>)}
                </Select>
              </div>
            )}
          </div>
          {(scope === "global" || scopeId) ? GROUPS.map(g => (
            <section key={g.title} className="mt-4">
              <h2 className="font-display text-xl font-bold">{g.title}</h2>
              <div className="rounded-md2 border border-black/10 px-4 dark:border-white/15">
                {g.specs.map(s => (
                  <SettingsField
                    key={s.key} spec={s}
                    value={valOf(s.key)}
                    inherited={ownMap[s.key] === undefined ? { value: effective[s.key] ?? "—", from: t.scopeGlobal } : null}
                    scopeLabel={scope === "global" ? t.scopeGlobal : `${scope}`}
                    onChange={v => setDrafts(d => ({ ...d, [dk(s.key)]: v }))}
                    onReset={() => resetKey(s.key)}
                  />
                ))}
              </div>
              <Button
                className="mt-2"
                onClick={async () => {
                  for (const s of g.specs) {
                    if (dk(s.key) in drafts) {
                      await fetch("/api/console/settings", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ scope_type: scope, scope_id: scopeId || null, key: s.key, value: drafts[dk(s.key)] })
                      });
                    }
                  }
                  setDrafts({});
                  load();
                }}
              >{t.save} {g.title}</Button>
            </section>
          )) : <p className="mt-4 text-neutral-500">Pick a target to override {scope} settings.</p>}
        </>
      )}

      {tab === "timetable" && (
        <PeriodGridEditor scope={scope} scopeId={scopeId} />
      )}

      {tab === "roles" && (
        <div className="mt-3 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
          <table className="w-full min-w-[700px] border-collapse text-start text-sm">
            <thead className="sticky top-0 bg-chalk dark:bg-ink">
              <tr className="border-b-2 border-black/15 dark:border-white/20">
                <th className="px-3 py-2 text-start">role ↓ · resource →</th>
                {matrix.resources.map((r: string) => <th key={r} className="px-2 py-2 text-start font-mono text-xs">{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {(matrix.roles ?? []).map((role: any) => (
                <tr key={role.name} className="border-b border-black/10 last:border-0 dark:border-white/10">
                  <td className="px-3 py-2 font-bold" dir="ltr">{role.name}{role.is_system ? " *" : ""}</td>
                  {matrix.resources.map((r: string) => {
                    const acts = (matrix.grants ?? []).filter((g: any) => g.role === role.name && g.resource === r).map((g: any) => g.action);
                    const all = (matrix.actions ?? []).every((a: string) => acts.includes(a) || acts.includes("manage") || acts.includes("*"));
                    return (
                      <td key={r} className="px-2 py-2">
                        <button
                          onClick={() => toggleGrant(role.name, r, "manage", all)}
                          aria-pressed={all}
                          title={acts.join(", ") || "none"}
                          className={`tnum min-h-[40px] min-w-[40px] rounded px-1 font-bold ${all ? "bg-stamp text-white" : acts.length ? "bg-hi-light text-hi-dark dark:bg-hi/20 dark:text-amber-300" : "bg-black/10 text-neutral-500 dark:bg-white/10"}`}
                        >{all ? "✓" : acts.length || "–"}</button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-neutral-500">* system roles keep base grants from code; the matrix adds grants. manage = all actions.</p>
        </div>
      )}

      {tab === "flags" && (
        <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {flags.map((f: any) => (
            <label key={f.key} className="flex min-h-[56px] cursor-pointer items-center justify-between gap-2 px-4 py-2">
              <span><bdi className="font-mono font-bold" dir="ltr">{f.key}</bdi><span className="ms-2 text-sm text-neutral-500">{f.description}</span></span>
              <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={!!f.enabled} onChange={() => toggleFlag(f.key, !!f.enabled)} />
            </label>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {(history ?? []).map((h: any) => (
            <div key={h.id} className="px-4 py-2.5 text-sm">
              <p dir="auto"><b>{h.key}</b> <span className="text-neutral-500">[{h.scope_type}{h.scope_id ? `/${h.scope_id.slice(0, 8)}` : ""}]</span></p>
              <p className="tnum text-xs text-neutral-500" dir="auto">
                {JSON.stringify(h.old_value)} → {JSON.stringify(h.new_value)} · {h.email ?? ""} · {new Date(h.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {history.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        </div>
      )}
    </div>
  );
}
