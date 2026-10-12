"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp, Controls } from "@/components/providers";
import { Button, Input, Label, FieldError } from "@/components/ui";
import { GraduationCap, Presentation, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Signup() {
  const { t } = useApp();
  const r = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [err, setErr] = useState(""); const [rateLimited, setRateLimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [needConfirm, setNeedConfirm] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setRateLimited(false); setBusy(true);
    try {
      const sb = browserSupabase();
      const { data, error } = await sb.auth.signUp({
        email, password, options: { data: { role } }
      });
      if (error) {
        if (/rate limit/i.test(error.message)) { setRateLimited(true); setCooldown(60); }
        else setErr(error.message);
        return;
      }
      if (!data.user) { setErr("signup failed"); return; }
      // Email confirmation ON => no session yet: profile row is created on first login.
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) { setNeedConfirm(true); return; }
      const { error: e2 } = await sb.from("profiles").insert({ id: data.user.id, email, role, status: "pending" });
      if (e2) { setErr(e2.message); return; }
      r.push(role === "professor" ? "/professor-request?done=1" : "/onboarding");
    } finally { setBusy(false); }
  }

  if (needConfirm) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md px-5 py-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200">
          <MailCheck size={32} strokeWidth={1.75} />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold">{t.checkEmail}</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">{t.checkEmailHint}</p>
        <a href="/login" className="mt-6 block"><Button className="w-full">{t.goLogin}</Button></a>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
      <div className="flex justify-end"><Controls /></div>
      <h1 className="font-display mt-6 text-3xl font-bold">{t.signup}</h1>
      <form onSubmit={go} className="mt-6 space-y-4" noValidate>
        <div><Label htmlFor="email">{t.email}</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div><Label htmlFor="pw">{t.password}</Label><Input id="pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></div>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-neutral-600 dark:text-neutral-300">{t.iAm}</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.iAm}>
            {([
              { v: "student", icon: <GraduationCap size={20} strokeWidth={2} />, label: t.student },
              { v: "professor", icon: <Presentation size={20} strokeWidth={2} />, label: t.professor }
            ]).map(o => (
              <button
                type="button" key={o.v} role="radio" aria-checked={role === o.v}
                onClick={() => setRole(o.v)}
                className={cn(
                  "flex min-h-[56px] items-center justify-center gap-2 rounded-md2 border-2 font-semibold transition-colors",
                  role === o.v
                    ? "border-register bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200"
                    : "border-black/15 hover:border-register/60 dark:border-white/20"
                )}
              >{o.icon} {o.label}</button>
            ))}
          </div>
          {role === "professor" && <p className="mt-2 rounded-md2 bg-hi-light px-3 py-2 text-sm font-medium text-hi-dark dark:bg-hi/15 dark:text-amber-200">{t.needsApproval}</p>}
        </fieldset>
        {rateLimited && (
          <div className="rounded-md2 border-2 border-brick/40 bg-brick-light/50 p-4 dark:border-brick/50 dark:bg-brick/10" role="alert">
            <p className="font-bold text-brick-dark dark:text-red-200">{t.err_rate_auth}</p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">{t.err_rate_auth_fix}</p>
          </div>
        )}
        <FieldError msg={err} />
        <Button className="w-full !min-h-[56px] !text-lg" disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `${t.tryAgainIn} ${cooldown}` : t.signup}
        </Button>
      </form>
      <p className="mt-6 border-t border-ink/15 pt-4 text-center dark:border-white/15">
        <a className="font-semibold text-register underline-offset-4 hover:underline" href="/login">{t.haveAccount}</a>
      </p>
    </main>
  );
}
