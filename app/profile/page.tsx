"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { AppNav } from "@/components/app-nav";
import { ViewAsBanner } from "@/components/console/ViewAsBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardSkeleton } from "@/components/hudoor/skeletons";
import { toast } from "@/components/hudoor/toast";
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
    })();
  }, []);

  async function save() {
    setSaving(true);
    const sb = browserSupabase();
    if (profile?.role === "student" && details) {
      await sb.from("student_details").update({ phone: editPhone.trim() || null }).eq("user_id", user.id);
    }
    setSaving(false);
    toast.success(t.createdOk);
  }

  if (loading) return <><ViewAsBanner /><AppNav role={profile?.role ?? "student"} /><div className="mx-auto max-w-2xl px-4 py-16"><CardSkeleton rows={4} /></div></>;

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

  const rows = [
    { icon: Mail, label: t.email, value: profile?.email, ltr: true },
    details?.university_id && { icon: Hash, label: t.universityId, value: details.university_id, tnum: true },
    details?.level_year && { icon: GraduationCap, label: t.level, value: details.level_year },
    details?.section_group && { icon: BookOpen, label: t.group, value: details.section_group },
    { icon: Calendar, label: locale === "ar" ? "عضو منذ" : "Member since", value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—", tnum: true }
  ].filter(Boolean) as { icon: any; label: string; value: any; ltr?: boolean; tnum?: boolean }[];

  return (
    <>
      <ViewAsBanner />
      <AppNav role={navRole} />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{t.profileTitle}</h1>

        <div className="mt-6 rounded-card border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-pill bg-primary/10 text-primary">
              <User size={28} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-bold" dir="auto">
                {details?.full_name_ar || details?.full_name_en || profile?.email}
              </p>
              <p className="text-sm text-muted-foreground">{roleLabel(profile?.role, profile?.custom_role)}</p>
              {program && (
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {locale === "ar" ? program.name_ar : program.name_en} · {program.code}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <row.icon size={18} className="shrink-0 text-muted-foreground" strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className={`truncate font-semibold ${row.tnum ? "tnum" : ""}`} dir={row.ltr ? "ltr" : undefined}>{row.value}</p>
                </div>
              </div>
            ))}

            {profile?.role === "student" && (
              <div className="flex items-center gap-3">
                <Phone size={18} className="shrink-0 text-muted-foreground" strokeWidth={2} />
                <div className="flex-1">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input id="phone" value={editPhone} onChange={e => setEditPhone(e.target.value)} dir="ltr" placeholder="+20…" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Shield size={18} className="shrink-0 text-muted-foreground" strokeWidth={2} />
              <div>
                <p className="text-xs text-muted-foreground">{t.status}</p>
                <p className="font-semibold">
                  {profile?.status === "approved" ? (
                    <span className="text-present-ink">{profile.status}</span>
                  ) : profile?.status === "suspended" ? (
                    <span className="text-absent-ink">{profile.status}</span>
                  ) : (
                    <span className="text-muted-foreground">{profile?.status}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {profile?.role === "student" && (
            <div className="mt-6">
              <Button onClick={save} disabled={saving}>{saving ? "…" : t.save}</Button>
            </div>
          )}
        </div>

        {profile?.role === "student" && (
          <Link href="/student/timetable" className="mt-4 flex items-center justify-between rounded-card border border-border bg-card p-4 font-semibold transition-colors hover:bg-muted">
            <span className="flex items-center gap-2"><MapPin size={18} strokeWidth={2} /> {t.weeklyTimetable}</span>
            <span className="text-primary">←</span>
          </Link>
        )}
      </div>
    </>
  );
}
