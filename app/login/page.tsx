"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp, Controls } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAuthConfig, landingFor, domainAllowed, type AuthConfig } from "@/lib/auth-flow";
import { ScanLine, Fingerprint, Loader2 } from "lucide-react";

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
  const [cfg, setCfg] = useState<AuthConfig | null>(null);

  const next = sp.get("next") || "";

  // Auth config (domain restriction + Google toggle) — must work signed-out,
  // so it comes from the public API, not from app_settings RLS.
  useEffect(() => { fetchAuthConfig().then(setCfg).catch(() => setCfg(null)); }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setDomainErr(""); setBusy(true);
    try {
      const sb = browserSupabase();
      // signInWithPassword already returns the user — no extra auth round trip.
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { setErr(error.message); return; }
      await afterSignIn(sb, data.user);
    } finally { setBusy(false); }
  }

  async function afterSignIn(sb: ReturnType<typeof browserSupabase>, user: import("@supabase/supabase-js").User | null) {
    if (!user) { setErr("login failed"); return; }

    const conf = cfg ?? await fetchAuthConfig();
    if (!domainAllowed(user.email, conf)) {
      await sb.auth.signOut();
      setDomainErr(t.err_domain);
      return;
    }

    let { data: p } = await sb.from("profiles").select("role,status").eq("id", user!.id).maybeSingle();
    if (!p) {
      // Password users may carry a role hint from signup metadata; Google users
      // always start as students (never upgraded by OAuth metadata).
      const metaRole = (user!.user_metadata as any)?.role;
      const fallback = metaRole === "professor" || metaRole === "admin" ? metaRole : "student";
      const { error: insErr } = await sb.from("profiles").insert({ id: user!.id, email: user!.email, role: fallback, status: "pending" });
      if (insErr) { setErr(insErr.message); return; }
      p = { role: fallback, status: "pending" } as any;
    }

    // Signup consent is captured in auth metadata before the session exists
    // (email-confirmation flow). Copy it into the consent ledger once, if the
    // table from migration 014 is present; never block login on this.
    const consentVersion = (user!.user_metadata as any)?.consent_version;
    if (typeof consentVersion === "string" && consentVersion) {
      try {
        await sb.from("consents").upsert([
          { user_id: user!.id, kind: "privacy", version: consentVersion },
          { user_id: user!.id, kind: "terms", version: consentVersion }
        ], { onConflict: "user_id,kind,version", ignoreDuplicates: true });
      } catch {}
    }
    // Role-aware landing: `next` is honored only when this role may open it,
    // otherwise middleware would bounce us straight back here (ping-pong).
    r.push(landingFor((p as any)?.role, next));
  }

  async function google() {
    setErr(""); setDomainErr(""); setGoogleBusy(true);
    try {
      const sb = browserSupabase();
      // location is browser-only: never touch it at render time (prerender would crash).
      const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next || landingFor("student"))}` }
      });
      if (error) { setErr(error.message); setGoogleBusy(false); }
      // On success the browser navigates away to Google.
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

  const googleOff = cfg !== null && !cfg.googleEnabled;

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
        {googleOff ? (
          <p className="rounded-base border border-border px-3 py-3 text-center text-sm font-semibold text-muted-foreground">
            {t.googleDisabled}
          </p>
        ) : (
          <Button variant="outline" className="w-full" disabled={googleBusy || cfg === null} onClick={google}>
            {googleBusy ? <><Loader2 size={16} className="animate-spin" /> جاري...</> : t.continueGoogle}
          </Button>
        )}
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
