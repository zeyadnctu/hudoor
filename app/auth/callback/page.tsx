"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { fetchAuthConfig, domainAllowed, landingFor } from "@/lib/auth-flow";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

/**
 * OAuth Callback page — handles Supabase Auth OAuth callbacks (?code, ?error, ...).
 * Exchanges the auth code for a session, enforces the university-domain rule,
 * bootstraps the profile row, then routes by role.
 */
function AuthCallbackInner() {
  const { t } = useApp();
  const r = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      const code = sp.get("code");
      const error = sp.get("error");
      const errorDescription = sp.get("error_description");
      const next = sp.get("next") || "";

      if (error) {
        setStatus("error");
        setMessage(errorDescription || error);
        return;
      }
      if (!code) {
        setStatus("error");
        setMessage((t.err_invalid_input as string | undefined) || "No auth code provided");
        return;
      }

      try {
        const sb = browserSupabase();
        const { error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;

        const { data: { user } } = await sb.auth.getUser();
        if (!user) throw new Error(t.err_login || "Sign-in failed");

        // University-domain rule applies to Google users too (GOOGLE_AUTH_SETUP §5).
        const cfg = await fetchAuthConfig();
        if (!domainAllowed(user.email, cfg)) {
          await sb.auth.signOut();
          setStatus("error");
          setMessage(t.err_domain);
          return;
        }

        // First Google login: create the profile as a student, pending approval.
        // OAuth metadata can never upgrade a role.
        let { data: p } = await sb.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
        if (!p) {
          const { error: insErr } = await sb.from("profiles").insert({
            id: user.id, email: user.email, role: "student", status: "pending"
          });
          if (insErr) throw insErr;
          p = { role: "student", status: "pending" } as any;
        }

        setStatus("success");
        setMessage(t.login || "Signed in");
        await new Promise((res) => setTimeout(res, 600));
        r.push(landingFor((p as any)?.role, next));
      } catch (e: any) {
        setStatus("error");
        setMessage((e?.message ?? "") || "Sign-in failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = status === "success" ? CheckCircle : status === "error" ? AlertCircle : Loader2;
  const tone = status === "success" ? "text-green-600 dark:text-green-400" : status === "error" ? "text-destructive" : "text-primary";

  return (
    <main className="dot-grid mx-auto min-h-screen w-full max-w-md px-5 py-16 flex flex-col items-center justify-center text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 ${tone}`}>
        <Icon size={32} strokeWidth={2} className={status === "loading" ? "animate-spin" : ""} />
      </div>
      <h1 className="font-display mt-4 text-2xl font-bold">{status === "success" ? t.login || "تم تسجيل الدخول" : status === "error" ? "فشل تسجيل الدخول" : "جاري إتمام تسجيل الدخول…"}</h1>
      {message && (
        <p className={`mt-1 text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`} dir="auto">{message}</p>
      )}
      {status === "error" && (
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={() => r.push("/login")}>{t.goLogin || "الذهاب لتسجيل الدخول"}</Button>
          <Button variant="outline" className="w-full" onClick={() => r.push("/signup")}>{t.noAccount || "ليس عندك حساب؟ أنشئ حساب"}</Button>
        </div>
      )}
    </main>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div className="dot-grid mx-auto min-h-screen w-full max-w-md px-5 py-16 flex flex-col items-center justify-center text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary"><Loader2 size={32} strokeWidth={2} className="animate-spin" /></div><h1 className="font-display mt-4 text-2xl font-bold">جاري إتمام تسجيل الدخول…</h1></div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
