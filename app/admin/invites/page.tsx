"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";
import { Copy, Link2, Ban } from "lucide-react";

export default function InvitesPage() {
  const { t } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [progs, setProgs] = useState<any[]>([]);
  const [form, setForm] = useState({ full_name: "", title: "Dr", program_id: "" });
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [del, setDel] = useState<any>(null);

  async function load() {
    const [a, p] = await Promise.all([
      fetch("/api/console/invites").then(r => r.json()).catch(() => ({ rows: [] })),
      fetch("/api/console/programs?perPage=200").then(r => r.json()).catch(() => ({ rows: [] }))
    ]);
    setRows(a.rows ?? []);
    setProgs((p.rows ?? []).filter((x: any) => !x.archived));
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setMsg(""); setLink("");
    if (!form.full_name.trim()) { setMsg(t.fullName); return; }
    const r = await fetch("/api/console/invites", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, program_id: form.program_id || null })
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    setForm({ full_name: "", title: "Dr", program_id: "" });
    load();
  }
  async function genLink(id: string) {
    setMsg(""); setLink("");
    const r = await fetch("/api/console/invites", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", id })
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    setLink(j.link);
    load();
  }
  async function revoke(id: string) {
    await fetch("/api/console/invites", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id })
    });
    load();
  }
  async function remove() {
    if (!del) return;
    await fetch("/api/console/invites", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: del.id })
    });
    setDel(null);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.newInvite}</h1>
      <div className="mt-3 grid gap-2 rounded-md2 border border-black/10 p-4 sm:grid-cols-4 dark:border-white/15">
        <div><Label>{t.fullName}</Label>
          <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} dir="auto" placeholder="Sara Medhat" />
        </div>
        <div><Label>{t.sessionType}</Label>
          <Select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}>
            <option value="Dr">{t.lecturer}</option>
            <option value="Eng">Eng</option>
          </Select>
        </div>
        <div><Label>{t.programs}</Label>
          <Select value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value })}>
            <option value="">—</option>
            {progs.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </Select>
        </div>
        <div className="flex items-end"><Button className="w-full" onClick={create}>{t.createNew}</Button></div>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status" dir="auto">{msg}</p>}
      {link && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md2 border-2 border-stamp/50 bg-stamp-light/40 p-3 dark:bg-stamp/10" role="status">
          <Link2 size={17} strokeWidth={2} className="shrink-0" />
          <code className="tnum min-w-0 flex-1 break-all text-sm" dir="ltr">{link}</code>
          <Button variant="outline" className="!min-h-[44px]" onClick={() => navigator.clipboard.writeText(link)}>
            <Copy size={16} strokeWidth={2} /> {t.copyLink}
          </Button>
        </div>
      )}

      <div className="mt-4 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
        {rows.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        {rows.map((r: any) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-bold" dir="auto">{r.title}. {r.full_name}</p>
              <p className="tnum text-xs text-neutral-500">
                {r.state === "claimed" ? t.claimed : r.state === "expired" ? t.expired : "pending"}
                {r.program_id ? ` · ${progs.find(p => p.id === r.program_id)?.code ?? ""}` : ""}
              </p>
            </div>
            <div className="flex gap-1.5">
              {r.state !== "claimed" && (
                <Button variant="outline" className="!min-h-[44px]" onClick={() => genLink(r.id)}>{t.inviteLink}</Button>
              )}
              {r.state === "pending" && (
                <Button variant="ghost" className="!min-h-[44px]" onClick={() => revoke(r.id)}><Ban size={16} strokeWidth={2} /></Button>
              )}
              <Button variant="ghost" className="!min-h-[44px] !text-brick" onClick={() => setDel(r)}>Del</Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!del}
        title={`Delete invite for ${del?.full_name}?`}
        impact="The invite link stops working. Already-claimed accounts are unaffected."
        confirmLabel="Delete"
        onCancel={() => setDel(null)}
        onConfirm={remove}
      />
    </div>
  );
}
