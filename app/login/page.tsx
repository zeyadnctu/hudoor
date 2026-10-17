"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp, Controls } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine, Fingerprint } from "lucide-react";

export default function Login() {
  return (
    <Suspense fallback={<div className="dot-grid mx-auto min-h-screen w-full max-w-md px-5 py-8" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { t } = useApp();
  const r = useRouter(); const sp = useSearchParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [domainErr, setDomainErr] = useState("");

  const next = sp.get("next") || "/student";

  // Load app settings (email domain restriction) on mount
  useEffect(() => {
    (async () => {
      try {
        const sb = browserSupabase();
        const { data } = await sb.from("app_settings")
          .select("key,value")
          .in("key", ["auth_email_domains", "auth_restrict_domain"]);
        const rows = (data ?? []) as any[];
        const restrict = rows.find(r => r.key === "auth_restrict_domain")?.value === true;
        const domainsRaw = rows.find(r => r.key === "auth_email_domains")?.value;
        const domains = domainsRaw ? String(domainsRaw).split(/[\n,;]+/).map(s => s.trim()).filter(Boolean) : [];
        (window as any).__hudoor_auth_settings = { restrict, domains };
      } catch { /* settings optional */ }
    })();
  }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setDomainErr(""); setBusy(true);
    try {
      const sb = browserSupabase();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { setErr(error.message); return; }
      await afterSignIn(sb);
    } finally { setBusy(false); }
  }

  async function afterSignIn(sb: ReturnType<typeof browserSupabase>) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setErr("login failed"); return; }

    const settings = (window as any).__hudoor_auth_settings || {};
    if (settings.restrict && settings.domains?.length) {
      const emailDomain = (user.email ?? "").split("@").pop()?.toLowerCase();
      if (!emailDomain || !settings.domains.includes(emailDomain)) {
        await sb.auth.signOut();
        setDomainErr(t.err_domain || "هذا البريد غير مسموح به. استخدم البريد الجامعي.");
        return;
      }
    }

    let { data: p } = await sb.from("profiles").select("role,status").eq("id", user!.id).single();
    if (!p) {
      const metaRole = (user!.user_metadata as any)?.role;
      const fallback = metaRole === "professor" || metaRole === "admin" ? metaRole : "student";
      const { error: insErr } = await sb.from("profiles").insert({ id: user!.id, email: user!.email, role: fallback, status: "pending" });
      if (insErr) { setErr(insErr.message); return; }
      p = { role: fallback, status: "pending" } as any;
    }
    const router = r;
    if (next) { router.push(next); return; }
    router.push(p?.role === "admin" ? "/admin" : p?.role === "professor" ? "/professor" : "/student");
  }

  async function google() {
    setErr(""); setDomainErr(""); setGoogleBusy(true);
    try {
      const sb = browserSupabase();
      await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` }
      });
    } catch (e: any) {
      setErr(e.message ?? "Google sign-in failed");
      setGoogleBusy(false);
    }
  }

  async function passkeyStart() {
    setErr(""); setPasskeyBusy(true);
    try {
      const resp = await fetch("/api/auth/passkey/authenticate/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!resp.ok) { setErr("لا يوجد مفتاح مرور مسجل لهذا البريد"); setPasskeyBusy(false); return; }
      const opts = await resp.json();
      // options.challenge is base64url; simplewebauthn expects ArrayBuffer
      const publicKey = {
        ...opts,
        challenge: Uint8Array.from(atob(opts.challenge), c => c.charCodeAt(0)),
        allowCredentials: opts.allowCredentials?.map((c: any) => ({
          ...c,
          id: Uint8Array.from(atob(c.id), x => x.charCodeAt(0))
        }))
      } as any;
      const cred = await (navigator.credentials as any).get({ publicKey });
      const finish = await fetch("/api/auth/passkey/authenticate/finish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cred.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))),
          type: cred.type,
          response: {
            authenticatorData: btoa(String.fromCharCode(...new Uint8Array(cred.response.authenticatorData))),
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))),
            signature: btoa(String.fromCharCode(...new Uint8Array(cred.response.signature))),
          }
        })
      });
      const j = await finish.json();
      if (!j.ok) { setErr(j.error || "فشل التحقق من البصمة"); setPasskeyBusy(false); return; }
      // Complete Supabase session via email OTP (passwordless): sends a magic link
      const sb = browserSupabase();
      const { error: otpErr } = await sb.auth.signInWithOtp({ email: j.user.email });
      if (otpErr) { setErr(otpErr.message); setPasskeyBusy(false); return; }
      setErr("");
      r.push(`/login?next=${encodeURIComponent(next)}&otp_sent=1`);
    } catch (e: any) {
      setErr(e.message ?? "فشل الدخول بالبصمة");
      setPasskeyBusy(false);
    }
  }

  return (
    <main className="dot-grid mx-auto min-h-screen w-full max-w-md px-5 py-8">
      <div className="flex justify-end"><Controls /></div>
      <div className="mt-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-pill bg-primary text-primary-foreground">
          <ScanLine size={26} strokeWidth={2} />
        </span>
        <h1 className="font-display mt-4 text-3xl font-bold">{t.app}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">{t.tagline}</p>
      </div>
      <form onSubmit={go} className="mt-8 space-y-4" noValidate>
        <div><Label htmlFor="email">{t.email}</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div><Label htmlFor="pw">{t.password}</Label><Input id="pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></div>
        {domainErr && (
          <p role="alert" className="rounded-base bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {domainErr}
          </p>
        )}
        {err && (
          <p role="alert" className="rounded-base bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {err}
          </p>
        )}
        <Button className="w-full !min-h-[56px] !text-lg" disabled={busy}>{t.login}</Button>
      </form>
      <div className="mt-3 space-y-2">
        <Button variant="outline" className="w-full" disabled={googleBusy} onClick={google}>
          {googleBusy ? "جاري..." : t.continueGoogle}
        </Button>
        <Button variant="outline" className="w-full" disabled={passkeyBusy} onClick={passkeyStart}>
          {passkeyBusy ? "جاري..." : <><Fingerprint size={16} strokeWidth={2} /> {t.signInPasskey || "تسجيل الدخول ببصمة الإصبع"}</>}
        </Button>
      </div>
      <p className="mt-6 border-t border-border pt-4 text-center">
        <a className="font-semibold text-primary underline underline-offset-4" href="/signup">{t.noAccount}</a>
      </p>
    </main>
  );
}
