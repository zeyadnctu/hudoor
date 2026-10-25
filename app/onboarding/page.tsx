"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema } from "@/lib/validators";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LazyStepper, LazyBlurText } from "@/components/hudoor/bits";
import { EmptyState } from "@/components/hudoor/empty-state";
import { School, Loader2, AlertCircle } from "lucide-react";

const DRAFT_KEY = "hudoor_onboarding_draft";

/** Auto-detect admin approval while the waiting screen is up: the student's
 *  dashboard opens by itself the moment they are approved (no manual reload,
 *  no stale screen). Polls at 5s then every 10s; silent on failure. */
function ApprovalPoller({ onApproved }: { onApproved: () => void }) {
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sb = browserSupabase();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      const uid = session?.user?.id;
      if (!uid || !alive) return;
      let delayMs = 5_000;
      const check = async () => {
        if (!alive) return;
        try {
          const { data: prof } = await sb.from("profiles").select("status").eq("id", uid).maybeSingle();
          if ((prof as any)?.status === "approved") { onApproved(); return; }
        } catch { /* next tick retries */ }
        if (alive) {
          delayMs = 10_000;
          timer = setTimeout(check, delayMs);
        }
      };
      timer = setTimeout(check, delayMs);
    })();
    return () => { alive = false; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/* Onboarding flow:
   - no details yet            → wizard (3 steps)
   - details + approved        → straight to /student (1 hop, no loop)
   - details + NOT approved    → waiting screen (previously this case ping-ponged
     forever between /onboarding and /student: the page pushed /student, the
     approval gate bounced it back)
   Speed: auth comes from getSession() (local cookie read, no network call);
   profile row + programs load in ONE parallel batch. */

export default function Onboarding() {
  const { t } = useApp();
  const r = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [progs, setProgs] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  // Shown when "next/save" is blocked by validation: says WHY nothing happened
  // and points at the highlighted field instead of silently ignoring the tap.
  const [gateMsg, setGateMsg] = useState(false);
  const { register, handleSubmit, watch, trigger, setFocus, getFieldState, formState: { errors } } = useForm({
    resolver: zodResolver(onboardingSchema) as any,
    // onTouched + onChange re-validation: the red message disappears the moment
    // the user fixes that field (default onSubmit mode left stale errors up).
    mode: "onTouched",
    reValidateMode: "onChange",
    // Untouched text inputs start as "" (not undefined) so validation always
    // returns a field-specific message, never zod's raw "Required".
    defaultValues: {
      full_name_ar: "", full_name_en: "", university_id: "", phone: "",
      program_id: "", level_id: "", section_id: "",
      ...(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { return {}; } })()
    }
  });
  const values = watch();
  const progId = values.program_id as string | undefined;
  const levelId = values.level_id as string | undefined;

  // autosave draft
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  // Dismiss the gate banner as soon as this step's fields are all valid.
  useEffect(() => {
    if (!gateMsg) return;
    const fields = step === 0
      ? ["full_name_ar", "full_name_en"]
      : step === 1
        ? ["university_id", "phone"]
        : ["program_id", "level_id", "section_id"];
    if (fields.every(f => !(errors as any)[f])) setGateMsg(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors, gateMsg, step]);

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      // Local cookie read for the user id — no auth-server round trip.
      const { data: { session } } = await sb.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) { r.push("/login"); return; }
      // Single parallel batch: details + status, and the program list.
      const [detRes, profRes, progRes] = await Promise.all([
        sb.from("student_details").select("id").eq("user_id", uid).maybeSingle(),
        sb.from("profiles").select("status").eq("id", uid).maybeSingle(),
        sb.from("programs").select("*").eq("archived", false).order("code")
      ]);
      const hasDetails = !!(detRes.data as any)?.id;
      let status = (profRes.data as any)?.status;
      // Self-repair: login/signup normally create the profile row, but if that
      // insert failed the user used to be caught in a middleware redirect loop
      // here. Insert it under the "self insert profile" RLS policy and continue.
      if (status == null) {
        const { error: insProfErr } = await sb.from("profiles").insert({
          id: uid, email: session?.user?.email ?? "", role: "student", status: "pending"
        });
        const race = insProfErr && (insProfErr.code === "23505" || insProfErr.message?.includes("duplicate key"));
        if (!insProfErr || race) {
          const { data: p2 } = await sb.from("profiles").select("status").eq("id", uid).maybeSingle();
          status = (p2 as any)?.status ?? "pending";
        } else {
          // could not create or read a profile — surface instead of looping
          setFormError(insProfErr.message);
          setLoading(false);
          return;
        }
      }
      // partner programs first, then the rest by code
      const rows = (progRes.data ?? []) as any[];
      rows.sort((a, b) => (a.type === b.type ? a.code.localeCompare(b.code) : a.type === "partner" ? -1 : 1));
      setProgs(rows);
      if (hasDetails) {
        if (status === "approved") { r.replace("/student"); return; }
        // details exist but not approved yet: stay put and explain (no loop)
        setWaiting(true);
        setLoading(false);
        return;
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setLevels([]); setGroups([]);
    if (!progId) return;
    (async () => {
      const sb = browserSupabase();
      const { data } = await sb.from("levels").select("*").eq("program_id", progId).order("position");
      setLevels((data ?? []) as any[]);
    })();
  }, [progId]);
  useEffect(() => {
    setGroups([]);
    if (!levelId) return;
    (async () => {
      const sb = browserSupabase();
      const { data } = await sb.from("section_groups").select("*").eq("level_id", levelId).order("name");
      setGroups((data ?? []) as any[]);
    })();
  }, [levelId]);

  /* Gate: only advance / submit when the step's fields are valid. On failure
     we surface a clear banner and jump focus to the first offending input, so
     "the button does nothing" can never happen silently. */
  async function gate(fields: string[]): Promise<boolean> {
    const ok = await trigger(fields as any);
    if (ok) { setGateMsg(false); return true; }
    setGateMsg(true);
    const first = fields.find(f => getFieldState(f as any).error);
    if (first) { try { setFocus(first as any); } catch {} }
    return false;
  }

  async function handleStepChange(next: number) {
    if (next > step) {
      const fields = step === 0
        ? ["full_name_ar", "full_name_en"]
        : ["university_id", "phone"];
      if (!(await gate(fields))) return;
    }
    setGateMsg(false);
    setStep(next);
  }

  async function submit(v: any) {
    if (!(await gate(["program_id", "level_id", "section_id"]))) return;
    setFormError(""); setSaving(true);
    try {
      const sb = browserSupabase();
      const { data: { session } } = await sb.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) { r.push("/login"); return; }
      const level = levels.find(l => l.id === v.level_id);
      const group = groups.find(g => g.id === v.section_id);
      // merge on the user_id unique column: repeated submits UPDATE, never 409
      const { error } = await sb.from("student_details").upsert({
        user_id: uid, ...v,
        level_year: Number(level?.position ?? 1),
        section_group: group?.name ?? "sec1"
      }, { onConflict: "user_id" });
      if (error) {
        if (error.code === "23505") {
          setFormError(`${t.err_university_id_taken} — ${t.err_university_id_taken_fix}`);
        } else {
          setFormError(error.message);
        }
        return;
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      // approved ahead of time? go straight in; otherwise show the waiting screen
      const { data: prof } = await sb.from("profiles").select("status").eq("id", uid).maybeSingle();
      if ((prof as any)?.status === "approved") {
        r.replace("/student");
        return;
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="dot-grid mx-auto w-full max-w-md px-4 py-16 text-center">
        <Loader2 size={26} className="mx-auto animate-spin text-muted-foreground" />
      </main>
    );
  }

  // Completed profile, admin approval still pending.
  if (waiting || done) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <ApprovalPoller onApproved={() => r.replace("/student")} />
        <EmptyState
          icon={<School size={28} strokeWidth={2} />}
          title={t.onboardingDone}
          hint={done ? String(t.awaiting_approval ?? "") : String(t.onboardingDone ?? "")}
          withGrid
          action={
            <Button
              className="w-full"
              onClick={async () => {
                const sb = browserSupabase();
                const { data: { session } } = await sb.auth.getSession();
                const uid = session?.user?.id;
                if (!uid) { r.push("/login"); return; }
                const { data: prof } = await sb.from("profiles").select("status").eq("id", uid).maybeSingle();
                if ((prof as any)?.status === "approved") r.replace("/student");
                else location.reload();
              }}
            >
              {t.refreshSession ?? "تحديث"}
            </Button>
          }
        />
      </main>
    );
  }

  // surface the actual schema message (bilingual) instead of a bare "required"
  const errText = (e: any) => (e ? e.message ?? "أكمل هذا الحقل / complete this field" : undefined);

  return (
    <main className="dot-grid mx-auto w-full max-w-md px-4 py-8">
      <h1 className="font-display text-3xl font-bold">
        <LazyBlurText text={t.completeProfile} />
      </h1>
      <p className="mt-1 text-muted-foreground">{t.askOnlyNeeded}</p>

      {gateMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 flex items-start gap-2 rounded-base border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{String(t.fillHighlighted ?? "")}</span>
        </div>
      )}

      {formError && (
        <p role="alert" className="mt-4 rounded-base bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit(submit)} className="mt-6">
        <LazyStepper
          step={step}
          onStepChange={handleStepChange}
          onCompleted={handleSubmit(submit) as () => void}
          labels={{ back: t.back, next: t.next, complete: saving ? "..." : t.save }}
          steps={[
            {
              title: t.fullName,
              content: (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="full_name_ar">{t.fullNameAr}</Label>
                    <Input id="full_name_ar" {...register("full_name_ar")} autoComplete="name" aria-invalid={!!errors.full_name_ar} aria-describedby={errors.full_name_ar ? "err_full_name_ar" : undefined} />
                    {errors.full_name_ar && <p id="err_full_name_ar" className="mt-1 text-sm font-medium text-destructive">{errText(errors.full_name_ar)}</p>}
                  </div>
                  <div>
                    <Label htmlFor="full_name_en">{t.fullNameEn}</Label>
                    <Input id="full_name_en" {...register("full_name_en")} autoComplete="name" dir="ltr" aria-invalid={!!errors.full_name_en} aria-describedby={errors.full_name_en ? "err_full_name_en" : undefined} />
                    {errors.full_name_en && <p id="err_full_name_en" className="mt-1 text-sm font-medium text-destructive">{errText(errors.full_name_en)}</p>}
                  </div>
                </div>
              )
            },
            {
              title: t.universityId,
              content: (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="university_id">{t.universityId}</Label>
                    <Input id="university_id" {...register("university_id")} inputMode="numeric" dir="ltr" aria-invalid={!!errors.university_id} aria-describedby={errors.university_id ? "err_university_id" : undefined} />
                    {errors.university_id && <p id="err_university_id" className="mt-1 text-sm font-medium text-destructive">{errText(errors.university_id)}</p>}
                  </div>
                  <div>
                    <Label htmlFor="phone">{t.phone}</Label>
                    <Input id="phone" {...register("phone")} type="tel" autoComplete="tel" dir="ltr" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "err_phone" : undefined} />
                    {errors.phone && <p id="err_phone" className="mt-1 text-sm font-medium text-destructive">{errText(errors.phone)}</p>}
                  </div>
                </div>
              )
            },
            {
              title: t.pickProgram,
              content: (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="program_id">{t.programs}</Label>
                    <select id="program_id" {...register("program_id")} aria-invalid={!!errors.program_id} aria-describedby={errors.program_id ? "err_program_id" : undefined} className="mt-1 flex min-h-[40px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20">
                      <option value="">—</option>
                      {progs.map(p => <option key={p.id} value={p.id}>{p.type === "partner" ? "★ " : ""}{p.code} · {p.name_ar}</option>)}
                    </select>
                    {errors.program_id && <p id="err_program_id" className="mt-1 text-sm font-medium text-destructive">{errText(errors.program_id)}</p>}
                  </div>
                  <div>
                    <Label htmlFor="level_id">{t.level}</Label>
                    <select id="level_id" {...register("level_id")} disabled={!progId} aria-invalid={!!errors.level_id} aria-describedby={errors.level_id ? "err_level_id" : undefined} className="mt-1 flex min-h-[40px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:opacity-50">
                      <option value="">—</option>
                      {levels.map(l => <option key={l.id} value={l.id}>{l.name_ar} / {l.name_en}</option>)}
                    </select>
                    {errors.level_id && <p id="err_level_id" className="mt-1 text-sm font-medium text-destructive">{errText(errors.level_id)}</p>}
                  </div>
                  <div>
                    <Label htmlFor="section_id">{t.group}</Label>
                    <select id="section_id" {...register("section_id")} disabled={!levelId} aria-invalid={!!errors.section_id} aria-describedby={errors.section_id ? "err_section_id" : undefined} className="mt-1 flex min-h-[40px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:opacity-50">
                      <option value="">—</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    {errors.section_id && <p id="err_section_id" className="mt-1 text-sm font-medium text-destructive">{errText(errors.section_id)}</p>}
                  </div>
                </div>
              )
            }
          ]}
        />
      </form>
    </main>
  );
}
