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
import { School } from "lucide-react";

const DRAFT_KEY = "hudoor_onboarding_draft";

export default function Onboarding() {
  const { t } = useApp();
  const r = useRouter();
  const [step, setStep] = useState(0);
  const [progs, setProgs] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(onboardingSchema) as any,
    defaultValues: (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { return {}; } })()
  });
  const values = watch();
  const progId = values.program_id as string | undefined;
  const levelId = values.level_id as string | undefined;

  // autosave draft
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      // If onboarding already completed, redirect to student home
      const { data: det } = await sb.from("student_details").select("id").eq("user_id", user.id).maybeSingle();
      if (det) { r.push("/student"); return; }
      const { data } = await sb.from("programs").select("*").eq("archived", false).order("type", { ascending: false }).order("code");
      const rows = (data ?? []) as any[];
      // partner programs first, then the rest by code
      rows.sort((a, b) => (a.type === b.type ? a.code.localeCompare(b.code) : a.type === "partner" ? -1 : 1));
      setProgs(rows);
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

  /* gate: only advance a step when its fields validate */
  async function handleStepChange(next: number) {
    if (next > step) {
      const fields = step === 0
        ? ["full_name_ar", "full_name_en"]
        : ["university_id", "phone"];
      const ok = await trigger(fields as any);
      if (!ok) return;
    }
    setStep(next);
  }

  async function submit(v: any) {
    // final step validates program/level/section before leaving
    const ok = await trigger(["program_id", "level_id", "section_id"] as any);
    if (!ok) return;
    const sb = browserSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { r.push("/login"); return; }
    const level = levels.find(l => l.id === v.level_id);
    const group = groups.find(g => g.id === v.section_id);
    const { error } = await sb.from("student_details").upsert({
      user_id: user.id, ...v,
      level_year: Number(level?.position ?? 1),
      section_group: group?.name ?? "sec1"
    });
    if (error) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <EmptyState
          icon={<School size={28} strokeWidth={2} />}
          title={t.onboardingDone}
          hint={t.checkEmailHint}
          withGrid
          action={<a href="/student" className="block"><Button className="w-full">{t.myAttendance}</Button></a>}
        />
      </main>
    );
  }

  const errText = (e: any) => (e ? "مطلوب / required" : undefined);

  return (
    <main className="dot-grid mx-auto w-full max-w-md px-4 py-8">
      <h1 className="font-display text-3xl font-bold">
        <LazyBlurText text={t.completeProfile} />
      </h1>
      <p className="mt-1 text-muted-foreground">{t.askOnlyNeeded}</p>

      <form onSubmit={handleSubmit(submit)} className="mt-6">
        <LazyStepper
          step={step}
          onStepChange={handleStepChange}
          onCompleted={handleSubmit(submit) as () => void}
          labels={{ back: t.back, next: t.next, complete: t.save }}
          steps={[
            {
              title: t.fullName,
              content: (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="full_name_ar">{t.fullNameAr}</Label>
                    <Input id="full_name_ar" {...register("full_name_ar")} autoComplete="name" aria-invalid={!!errors.full_name_ar} />
                    <p className="mt-1 text-sm font-medium text-destructive">{errText(errors.full_name_ar)}</p>
                  </div>
                  <div>
                    <Label htmlFor="full_name_en">{t.fullNameEn}</Label>
                    <Input id="full_name_en" {...register("full_name_en")} autoComplete="name" dir="ltr" aria-invalid={!!errors.full_name_en} />
                    <p className="mt-1 text-sm font-medium text-destructive">{errText(errors.full_name_en)}</p>
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
                    <Input id="university_id" {...register("university_id")} inputMode="numeric" dir="ltr" aria-invalid={!!errors.university_id} />
                    <p className="mt-1 text-sm font-medium text-destructive">{errText(errors.university_id)}</p>
                  </div>
                  <div>
                    <Label htmlFor="phone">{t.phone}</Label>
                    <Input id="phone" {...register("phone")} type="tel" autoComplete="tel" dir="ltr" aria-invalid={!!errors.phone} />
                    <p className="mt-1 text-sm font-medium text-destructive">{errText(errors.phone)}</p>
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
                    <select id="program_id" {...register("program_id")} className="mt-1 flex min-h-[40px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm">
                      <option value="">—</option>
                      {progs.map(p => <option key={p.id} value={p.id}>{p.type === "partner" ? "★ " : ""}{p.code} · {p.name_ar}</option>)}
                    </select>
                    <p className="mt-1 text-sm font-medium text-destructive">{errors.program_id ? t.required : undefined}</p>
                  </div>
                  <div>
                    <Label htmlFor="level_id">{t.level}</Label>
                    <select id="level_id" {...register("level_id")} disabled={!progId} className="mt-1 flex min-h-[40px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm disabled:opacity-50">
                      <option value="">—</option>
                      {levels.map(l => <option key={l.id} value={l.id}>{l.name_ar} / {l.name_en}</option>)}
                    </select>
                    <p className="mt-1 text-sm font-medium text-destructive">{errors.level_id ? t.required : undefined}</p>
                  </div>
                  <div>
                    <Label htmlFor="section_id">{t.group}</Label>
                    <select id="section_id" {...register("section_id")} disabled={!levelId} className="mt-1 flex min-h-[40px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm disabled:opacity-50">
                      <option value="">—</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <p className="mt-1 text-sm font-medium text-destructive">{errors.section_id ? t.required : undefined}</p>
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
