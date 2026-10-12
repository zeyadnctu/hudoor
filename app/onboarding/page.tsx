"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema } from "@/lib/validators";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label, FieldError } from "@/components/ui";
import { User, IdCard, School } from "lucide-react";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "hudoor_onboarding_draft";
const STEPS = [
  { icon: <User size={20} strokeWidth={2} /> },
  { icon: <IdCard size={20} strokeWidth={2} /> },
  { icon: <School size={20} strokeWidth={2} /> }
];

export default function Onboarding() {
  const { t } = useApp();
  const r = useRouter();
  const [step, setStep] = useState(0);
  const [facs, setFacs] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(onboardingSchema) as any,
    defaultValues: (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { return {}; } })()
  });
  const values = watch();
  const facId = values.faculty_id as string | undefined;

  // autosave draft
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: f } = await sb.from("faculties").select("*");
      setFacs(f ?? []);
    })();
  }, []);
  useEffect(() => {
    if (!facId) return;
    (async () => {
      const sb = browserSupabase();
      const { data: d } = await sb.from("departments").select("*").eq("faculty_id", facId);
      setDeps(d ?? []);
    })();
  }, [facId]);

  async function next() {
    const fields = step === 0
      ? ["full_name_ar", "full_name_en"]
      : ["university_id", "phone"];
    const ok = await trigger(fields as any);
    if (ok) setStep(s => Math.min(2, s + 1));
  }

  async function submit(v: any) {
    const sb = browserSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { r.push("/login"); return; }
    const { error } = await sb.from("student_details").upsert({ user_id: user.id, ...v, level_year: Number(v.level_year) });
    if (error) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stamp-light text-stamp-dark dark:bg-stamp/20 dark:text-emerald-300">
          <School size={32} strokeWidth={1.75} />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold">{t.onboardingDone}</h1>
        <a href="/student" className="mt-6 block"><Button className="w-full">{t.myAttendance}</Button></a>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="font-display text-3xl font-bold">{t.completeProfile}</h1>
      <p className="mt-1 text-neutral-500">{t.askOnlyNeeded}</p>

      {/* progress: 3 segments, current filled */}
      <div className="mt-5 flex gap-2" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={3} aria-label={`${t.stepOf} ${step + 1}/3`}>
        {[0, 1, 2].map(i => (
          <div key={i} className={cn("h-2 flex-1 rounded-full", i <= step ? "bg-register" : "bg-black/10 dark:bg-white/15")} />
        ))}
      </div>
      <p className="tnum mt-2 flex items-center gap-2 text-sm font-semibold text-neutral-500">
        {STEPS[step].icon} {t.stepOf} {step + 1}/3
      </p>

      <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4">
        {step === 0 && (
          <>
            <div><Label>{t.fullNameAr}</Label><Input {...register("full_name_ar")} autoComplete="name" /><FieldError msg={errors.full_name_ar && "مطلوب / required"} /></div>
            <div><Label>{t.fullNameEn}</Label><Input {...register("full_name_en")} autoComplete="name" /><FieldError msg={errors.full_name_en && "مطلوب / required"} /></div>
          </>
        )}
        {step === 1 && (
          <>
            <div><Label>{t.universityId}</Label><Input {...register("university_id")} inputMode="numeric" /><FieldError msg={errors.university_id && "مطلوب / required"} /></div>
            <div><Label>{t.phone}</Label><Input {...register("phone")} type="tel" autoComplete="tel" dir="ltr" /><FieldError msg={errors.phone && "مطلوب / required"} /></div>
          </>
        )}
        {step === 2 && (
          <>
            <div><Label>{t.faculty}</Label>
              <Select {...register("faculty_id")}><option value="">—</option>{facs.map(f => <option key={f.id} value={f.id}>{f.name_ar} / {f.name_en}</option>)}</Select>
            </div>
            <div><Label>{t.department}</Label>
              <Select {...register("department_id")}><option value="">—</option>{deps.map(d => <option key={d.id} value={d.id}>{d.name_ar} / {d.name_en}</option>)}</Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t.level}</Label><Input type="number" min={1} max={7} {...register("level_year", { valueAsNumber: true })} /></div>
              <div><Label>{t.section}</Label><Input {...register("section_group")} /></div>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          {step > 0 && <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>{t.back}</Button>}
          {step < 2
            ? <Button type="button" className="flex-[2]" onClick={next}>{t.next}</Button>
            : <Button type="submit" variant="stamp" className="flex-[2]">{t.save}</Button>}
        </div>
      </form>
    </main>
  );
}
