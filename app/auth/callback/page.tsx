"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

/**
 * OAuth Callback page — handles Supabase Auth OAuth callbacks (?code, ?error, ...).
 * Exchanges the auth code for a session, then redirects to the intended page.
 */
function AuthCallbackInner() {
  const { t } = useApp();
  const r = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const code = sp.get("code");
      const error = sp.get("error");
      const errorDescription = sp.get("error_description");
      const next = sp.get("next") || "/student";

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

        // Determine where to go: check profile existence + role via server-side is not
        // available here; just go to /student (middleware will redirect to onboarding if needed).
        setStatus("success");
        setMessage(t.login || "Signed in");
        // Small delay so the user sees the success message
        await new Promise((res) => setTimeout(res, 800));
        if (!cancelled) r.push(next);
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setMessage((e.message ?? t.login) || "Sign-in failed");
        }
      }
      return () => { cancelled = true; };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = status === "success" ? CheckCircle : status === "error" ? AlertCircle : Loader2;
  const tone = status === "success" ? "text-green-600 dark:text-green-400" : status === "error" ? "text-destructive" : "text-primary";

  return (
    <main className="dot-grid mx-auto min-h-screen w-full max-w-md px-5 py-16 flex flex-col items-center justify-center text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 ${tone}`}>
        <Icon size={32} strokeWidth={2} />
      </div>
      <h1 className="font-display mt-4 text-2xl font-bold">{status === "success" ? t.login || "تم تسجيل الدخول" : status === "error" ? "فشل تسجيل الدخول" : "جاري إتمام تسجيل الدخول…"}</h1>
      {message && (
        <p className={`mt-1 text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>
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
    <Suspense fallback={<div className="dot-grid mx-auto min-h-screen w-full max-w-md px-5 py-16 flex flex-col items-center justify-center text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary"><Loader2 size={32} strokeWidth={2} /></div><h1 className="font-display mt-4 text-2xl font-bold">جاري إتمام تسجيل الدخول…</h1></div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
