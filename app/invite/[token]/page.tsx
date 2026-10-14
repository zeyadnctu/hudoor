"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Label } from "@/components/ui";
import { MailCheck, KeyRound } from "lucide-react";

export default function ClaimPage({ params }: { params: { token: string } }) {
  const { t } = useApp();
  const [inv, setInv] = useState<any>(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [linked, setLinked] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/invite/claim?token=${encodeURIComponent(params.token)}`);
      const j = await r.json();
      if (!r.ok) setErr(j.error);
      else setInv(j.invite);
    })();
  }, [params.token]);

  async function claim() {
    setErr("");
    const r = await fetch("/api/invite/claim", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, email, password: pw })
    });
    const j = await r.json();
    if (!r.ok) setErr(j.error);
    else setLinked(j.linked ?? 0);
  }

  if (err && !inv) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">{t.err_closed}</h1>
        <p className="tnum mt-2 text-sm text-neutral-500" dir="auto">{err}</p>
        <a href="/login" className="mt-6 block"><Button className="w-full">{t.login}</Button></a>
      </main>
    );
  }
  if (!inv) return <main className="mx-auto max-w-md px-5 py-16"><div className="skeleton h-8 rounded bg-black/10 dark:bg-white/15" /></main>;

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200">
        <MailCheck size={32} strokeWidth={1.75} />
      </div>
      <h1 className="font-display mt-4 text-center text-2xl font-bold">{t.claimInvite}</h1>
      <p className="mt-1 text-center text-neutral-500" dir="auto">
        {inv.title}. {inv.full_name}
        {inv.programs ? ` · ${inv.programs.code}` : ""}
      </p>
      {linked === null ? (
        <div className="mt-6 grid gap-3">
          <div><Label>{t.email}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" autoComplete="email" /></div>
          <div><Label>{t.password}</Label><Input type="password" value={pw} onChange={e => setPw(e.target.value)} dir="ltr" autoComplete="new-password" /></div>
          <Button className="w-full !min-h-[56px]" disabled={!email || pw.length < 6} onClick={claim}>
            <KeyRound size={18} strokeWidth={2} /> {t.claimInvite}
          </Button>
          {err && <p className="text-center text-sm font-semibold text-brick" role="alert" dir="auto">{err}</p>}
        </div>
      ) : (
        <div className="mt-6 text-center">
          <p className="font-bold">✓ {t.createdOk} ({linked})</p>
          <a href="/login" className="mt-4 block"><Button className="w-full">{t.login}</Button></a>
        </div>
      )}
    </main>
  );
}
