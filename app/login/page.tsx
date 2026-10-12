"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp, Controls } from "@/components/providers";
import { Button, Input, Label, FieldError } from "@/components/ui";

export default function Login() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { t } = useApp();
  const r = useRouter(); const sp = useSearchParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const sb = browserSupabase();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { setErr(error.message); return; }
      const { data: { user } } = await sb.auth.getUser();
      // Confirm-email flow creates no profile row at signup: create it on first login.
      let { data: p } = await sb.from("profiles").select("role").eq("id", user!.id).single();
      if (!p) {
        const metaRole = (user!.user_metadata as any)?.role;
        const fallback = metaRole === "professor" || metaRole === "admin" ? metaRole : "student";
        const { error: insErr } = await sb.from("profiles").insert({ id: user!.id, email: user!.email, role: fallback, status: "pending" });
        if (insErr) { setErr(insErr.message); return; }
        p = { role: fallback };
      }
      const next = sp.get("next");
      if (next) { r.push(next); return; }
      r.push(p?.role === "admin" ? "/admin" : p?.role === "professor" ? "/professor" : "/student");
    } finally { setBusy(false); }
  }
  async function google() {
    const sb = browserSupabase();
    await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/student` } });
  }
  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
      <div className="flex justify-end"><Controls /></div>
      <h1 className="font-display mt-6 text-3xl font-bold">{t.login}</h1>
      <form onSubmit={go} className="mt-6 space-y-4" noValidate>
        <div><Label htmlFor="email">{t.email}</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div><Label htmlFor="pw">{t.password}</Label><Input id="pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></div>
        <FieldError msg={err} />
        <Button className="w-full !min-h-[56px] !text-lg" disabled={busy}>{t.login}</Button>
      </form>
      <Button variant="outline" className="mt-3 w-full" onClick={google}>{t.continueGoogle}</Button>
      <p className="mt-6 border-t border-ink/15 pt-4 text-center dark:border-white/15">
        <a className="font-semibold text-register underline-offset-4 hover:underline" href="/signup">{t.noAccount}</a>
      </p>
    </main>
  );
}
