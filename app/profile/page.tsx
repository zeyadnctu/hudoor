"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { AppNav } from "@/components/app-nav";
import { ViewAsBanner } from "@/components/console/ViewAsBanner";
import { Button, Input, Label } from "@/components/ui";
import { User, Mail, Shield, Calendar, BookOpen, GraduationCap, MapPin, Phone, Hash } from "lucide-react";

export default function ProfilePage() {
  const { t, locale } = useApp();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: { user: u } } = await sb.auth.getUser();
      if (!u) { router.push("/login"); return; }
      setUser(u);

      const { data: prof } = await sb.from("profiles").select("*").eq("id", u.id).single();
      setProfile(prof);

      if (prof?.role === "student") {
        const { data: det } = await sb.from("student_details").select("*").eq("user_id", u.id).maybeSingle();
        setDetails(det);
        setEditPhone(det?.phone ?? "");
        if (det?.program_id) {
          const { data: prog } = await sb.from("programs").select("id,code,name_ar,name_en,type,color").eq("id", det.program_id).maybeSingle();
          setProgram(prog);
        }
      }

      setLoading(false);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    const sb = browserSupabase();
    if (profile?.role === "student" && details) {
      await sb.from("student_details").update({ phone: editPhone.trim() || null }).eq("user_id", user.id);
    }
    setSaving(false);
    setMsg("✓");
    setTimeout(() => setMsg(""), 2000);
  }

  if (loading) return <><ViewAsBanner /><AppNav role={profile?.role ?? "student"} /><div className="mx-auto max-w-2xl px-4 py-16 animate-pulse"><div className="h-8 w-48 bg-black/10 rounded dark:bg-white/10" /><div className="mt-4 h-64 bg-black/5 rounded dark:bg-white/5" /></div></>;

  const roleLabel = (r: string, cr: string | null) => {
    if (cr === "program_coordinator") return locale === "ar" ? "منسق برنامج" : "Program Coordinator";
    switch (r) {
      case "admin": return locale === "ar" ? "مدير" : "Admin";
      case "professor": return locale === "ar" ? "دكتور" : "Professor";
      case "student": return locale === "ar" ? "طالب" : "Student";
      case "ta": return locale === "ar" ? "معيد" : "TA";
      case "coordinator": return locale === "ar" ? "منسق" : "Coordinator";
      default: return r;
    }
  };

  const navRole = (profile?.role === "professor" || profile?.role === "admin") ? profile.role : "student";
  return (
    <>
      <ViewAsBanner />
      <AppNav role={navRole} />
      <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">{t.profileTitle}</h1>

      <div className="mt-6 rounded-md2 border border-black/10 p-6 dark:border-white/15">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-register-light dark:bg-register/20">
            <User size={28} className="text-register" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold" dir="auto">
              {details?.full_name_ar || details?.full_name_en || profile?.email}
            </p>
            <p className="text-sm text-neutral-500">{roleLabel(profile?.role, profile?.custom_role)}</p>
            {program && (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{ backgroundColor: (program.color ?? "#7C3AED") + "22", color: program.color ?? "#7C3AED" }}>
                {locale === "ar" ? program.name_ar : program.name_en} · {program.code}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="flex items-center gap-3">
            <Mail size={18} className="shrink-0 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">{t.email}</p>
              <p className="font-semibold" dir="ltr">{profile?.email}</p>
            </div>
          </div>

          {details?.university_id && (
            <div className="flex items-center gap-3">
              <Hash size={18} className="shrink-0 text-neutral-400" />
              <div>
                <p className="text-xs text-neutral-500">{t.universityId}</p>
                <p className="tnum font-semibold">{details.university_id}</p>
              </div>
            </div>
          )}

          {details?.level_year && (
            <div className="flex items-center gap-3">
              <GraduationCap size={18} className="shrink-0 text-neutral-400" />
              <div>
                <p className="text-xs text-neutral-500">{t.level}</p>
                <p className="font-semibold">{details.level_year}</p>
              </div>
            </div>
          )}

          {details?.section_group && (
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="shrink-0 text-neutral-400" />
              <div>
                <p className="text-xs text-neutral-500">{t.group}</p>
                <p className="font-semibold">{details.section_group}</p>
              </div>
            </div>
          )}

          {profile?.role === "student" && (
            <div className="flex items-center gap-3">
              <Phone size={18} className="shrink-0 text-neutral-400" />
              <div className="flex-1">
                <Label>{t.phone}</Label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} dir="ltr" placeholder="+20…" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Shield size={18} className="shrink-0 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">{t.status}</p>
              <p className={`font-semibold ${profile?.status === "approved" ? "text-register" : profile?.status === "suspended" ? "text-brick" : "text-neutral-500"}`}>
                {profile?.status}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar size={18} className="shrink-0 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">Member since</p>
              <p className="tnum font-semibold">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—"}</p>
            </div>
          </div>
        </div>

        {profile?.role === "student" && (
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={save} disabled={saving}>{saving ? "…" : t.save}</Button>
            {msg && <span className="text-sm font-bold text-register" role="status">{msg}</span>}
          </div>
        )}
      </div>

      {profile?.role === "student" && (
        <Link href="/student/timetable" className="mt-4 flex items-center justify-between rounded-md2 border border-black/10 p-4 font-semibold transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
          <span className="flex items-center gap-2"><MapPin size={18} /> {t.weeklyTimetable}</span>
          <span className="text-register">←</span>
        </Link>
      )}
    </div>
    </>
  );
}
