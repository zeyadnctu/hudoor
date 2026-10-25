"use client";
import * as React from "react";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Camera,
  ClipboardList,
  MapPin,
  QrCode,
  ScanLine
} from "lucide-react";
import { useApp, Controls } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { StatusPill, type StatusKind } from "@/components/hudoor/status-pill";
import { NumberStat } from "@/components/hudoor/number-stat";
import { NextClassCard } from "@/components/hudoor/next-class-card";
import { TimelineRow } from "@/components/hudoor/timeline-row";
import { CourseAttendanceCard } from "@/components/hudoor/course-attendance-card";
import { StampResult } from "@/components/hudoor/stamp-result";
import { WeekGrid, type WeekDay } from "@/components/hudoor/week-grid";
import { SemesterHeatmap, type HeatCell } from "@/components/hudoor/semester-heatmap";
import { EmptyState } from "@/components/hudoor/empty-state";
import { StatsSkeleton, TimelineSkeleton, CardSkeleton } from "@/components/hudoor/skeletons";
import { PermissionPrimer } from "@/components/hudoor/permission-primer";
import { SegmentedControl } from "@/components/hudoor/segmented-control";
import { BottomSheet } from "@/components/hudoor/bottom-sheet";
import { Toast, toast } from "@/components/hudoor/toast";
import { CommandPalette, CommandPaletteTrigger, usePalette } from "@/components/hudoor/command-palette";
import {
  LazyCountUp,
  LazyBlurText,
  LazyAnimatedList
} from "@/components/hudoor/bits";
import { LazyStepper } from "@/components/hudoor/stepper";

/* /design — dev-only reference page. Every token and every component in
   every state, in the current theme and direction (toggle with the Controls).
   Hidden with notFound() in production builds. */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display mb-3 border-b border-border pb-2 text-lg font-bold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Swatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-8 w-8 shrink-0 rounded-base border border-border"
        style={{ background: `var(${cssVar})` }}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{name}</span>
        <span className="tnum block text-[11px] text-muted-foreground">{cssVar}</span>
      </span>
    </div>
  );
}

/* demo data ---------------------------------------------------------------- */
const STATUS_KINDS: StatusKind[] = ["present", "late", "absent", "excused", "active", "scheduled", "ended"];

const WEEK_DAYS: WeekDay[] = [
  {
    key: 0,
    label: "الأحد",
    slots: [
      { id: "s1", start: "08:00", end: "09:50", code: "CS301", name: "نظم التشغيل", room: "قاعة 204", instructor: "د. منى", type: "lecture" },
      { id: "s2", start: "10:00", end: "10:50", code: "CS305", name: "قواعد البيانات", room: "معمل 3", type: "section" }
    ]
  },
  {
    key: 1,
    label: "الاثنين",
    slots: [
      { id: "s3", start: "09:00", end: "10:50", code: "Math210", name: "الرياضيات المتقطعة", room: "قاعة 110", instructor: "د. سامي", type: "lecture" }
    ]
  },
  { key: 2, label: "الثلاثاء", slots: [] },
  {
    key: 3,
    label: "الأربعاء",
    slots: [
      { id: "s4", start: "12:00", end: "13:50", code: "CS301", name: "نظم التشغيل", room: "قاعة 204", instructor: "د. منى", type: "lecture" }
    ]
  }
];

function demoHeatCells(): HeatCell[] {
  // ~7 weeks of mixed statuses across two months
  const statuses: HeatCell["status"][] = ["present", "present", "late", "present", "none", "absent", "present", "excused", "present", "late", "present"];
  const cells: HeatCell[] = [];
  const start = new Date("2026-09-06T12:00:00");
  for (let i = 0; i < 46; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    if (d.getDay() === 5) continue; // no Friday classes
    cells.push({ date: d.toISOString().slice(0, 10), status: statuses[i % statuses.length] });
  }
  return cells;
}

const ANNOUNCEMENTS = [
  { id: 1, title: "تم تأجيل محاضرة الرياضيات إلى قاعة 115" },
  { id: 2, title: "امتحان منتصف الترم — نظم التشغيل — الخميس 10:00 ص" },
  { id: 3, title: " تحديث مجموعات معمل قواعد البيانات" }
];

const LEDGER = [
  { id: "l1", dateLabel: "2026-09-07", timeLabel: "08:00", status: "present", statusLabel: "حاضر" },
  { id: "l2", dateLabel: "2026-09-09", timeLabel: "08:00", status: "late", statusLabel: "متأخر" },
  { id: "l3", dateLabel: "2026-09-14", timeLabel: "08:00", status: "absent", statusLabel: "غائب" },
  { id: "l4", dateLabel: "2026-09-16", timeLabel: "08:00", status: "excused", statusLabel: "بعذر" }
];

/* page --------------------------------------------------------------------- */
export default function DesignPage() {
  const { t, locale } = useApp();
  const setPaletteOpen = usePalette((s) => s.setOpen);
  const [expandedCourse, setExpandedCourse] = React.useState<string | null>("cs301");
  const [view, setView] = React.useState<"weekly" | "list">("weekly");
  const [step, setStep] = React.useState(0);
  const [heatCells] = React.useState(demoHeatCells);

  // dev-only reference page: 404 in production (after hooks, per rules of hooks)
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Hudoor /design</h1>
          <p className="text-sm text-muted-foreground">
            مرجع التصميم — dev فقط. غيّر الثيم والاتجاه بالأزرار، وجرّب تقليل الحركة من إعدادات النظام.
          </p>
        </div>
        <Controls />
      </header>

      <Section title="Tokens · الألوان">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Swatch name="Background" cssVar="--background" />
          <Swatch name="Card" cssVar="--card" />
          <Swatch name="Muted" cssVar="--muted" />
          <Swatch name="Border" cssVar="--border" />
          <Swatch name="Primary" cssVar="--primary" />
          <Swatch name="Foreground" cssVar="--foreground" />
        </div>
        <p className="text-[13px] font-semibold text-muted-foreground">Status (ink · fill · soft)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { name: "Present", ink: "--present-ink", fill: "--present-fill", soft: "--present-soft" },
            { name: "Late", ink: "--late-ink", fill: "--late-fill", soft: "--late-soft" },
            { name: "Absent", ink: "--absent-ink", fill: "--absent-fill", soft: "--absent-soft" },
            { name: "Excused", ink: "--excused-ink", fill: "--excused-fill", soft: "--excused-soft" }
          ].map((s) => (
            <div key={s.name} className="space-y-1">
              <Swatch name={s.name} cssVar={s.ink} />
              <div className="flex gap-1 pl-10">
                <span className="h-5 w-5 rounded-frame" style={{ background: `var(${s.fill})` }} />
                <span className="h-5 w-5 rounded-frame border border-border" style={{ background: `var(${s.soft})` }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tokens · Radius & Motion">
        <div className="flex flex-wrap items-center gap-2">
          {["rounded-base", "rounded-card", "rounded-sheet", "rounded-pill", "rounded-frame"].map((r) => (
            <span key={r} className={`${r} border border-border bg-muted px-3 py-2 text-[11px] font-semibold`}>{r}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="tnum">--duration-fast 120ms</span>
          <span className="tnum">--duration-base 200ms</span>
          <span className="tnum">--duration-slow 320ms</span>
          <span className="tnum">--ease-out</span>
          <span className="tnum">--ease-spring</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="transition-[transform,background-color] duration-base ease-out active:scale-[0.98]">duration-base press</Button>
          <Button size="sm" variant="outline" className="transition-[background-color] duration-fast">duration-fast</Button>
        </div>
      </Section>

      <Section title="Typography">
        <p className="font-display text-2xl font-bold">Readex Pro — العناوين</p>
        <p className="text-base">IBM Plex Sans Arabic — النص الأساسي · Latin body</p>
        <p className="tnum text-base">Tabular: 08:00–09:50 · 87% · 1,234</p>
        <div className="flex flex-wrap items-center gap-2">
          {["default", "secondary", "outline", "destructive"].map((v) => (
            <Badge key={v} variant={v as "default"}>{v}</Badge>
          ))}
          <StatusPill status="present" />
        </div>
        <p className="text-[13px] text-muted-foreground">
          Badge محايد للسياق؛ الحالة تبقى في StatusPill (أيقونة + نص + لون).
        </p>
      </Section>

      <Section title="Buttons & Inputs">
        <div className="flex flex-wrap gap-2">
          <Button>تسجيل الحضور</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="d-email">{t.email}</Label>
            <Input id="d-email" placeholder="student@uni.edu" dir="ltr" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch id="d-switch" defaultChecked />
            <Label htmlFor="d-switch">{t.deviceBinding}</Label>
          </div>
        </div>
        <Progress value={87} aria-label="demo progress" className="max-w-xs" />
      </Section>

      <Section title="StatusPill — كل الحالات">
        <div className="flex flex-wrap gap-2">
          {STATUS_KINDS.map((k) => (
            <StatusPill key={k} status={k} />
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">
          الحالة دائماً أيقونة + نص + لون — لا لون وحده أبداً. النص يتبع لغة التطبيق تلقائياً.
        </p>
      </Section>

      <Section title="NextClassCard">
        <NextClassCard
          live
          courseCode="CS301"
          courseName="نظم التشغيل"
          room="قاعة 204"
          endsInSeconds={1080}
          scanLabel={t.scanNow}
          endsInLabel={t.endsIn}
          startsInLabel={t.startsIn}
        />
        <NextClassCard
          live={false}
          courseCode="CS305"
          courseName="قواعد البيانات"
          nextCode="CS305"
          nextInMinutes={95}
          scanLabel={t.scanNow}
          endsInLabel={t.endsIn}
          startsInLabel={t.startsIn}
        />
      </Section>

      <Section title="NumberStat">
        <div className="grid grid-cols-3 divide-x divide-border rounded-card border border-border bg-card">
          <NumberStat value={87} suffix="%" label={t.overallRate} tone="present" />
          <NumberStat value={24} label={t.sessionsPresent} />
          <NumberStat value={5} label={t.dayStreak} tone="late" />
        </div>
        <p className="tnum text-sm text-muted-foreground">
          LazyCountUp: <LazyCountUp to={87} suffix="%" />
        </p>
      </Section>

      <Section title="TimelineRow">
        <div className="divide-y divide-border rounded-card border border-border bg-card">
          <TimelineRow startTime="08:00" endTime="09:50" courseCode="CS301" courseName="نظم التشغيل" room="قاعة 204" status="present" statusLabel={t.present} live />
          <TimelineRow startTime="10:00" endTime="10:50" courseCode="CS305" courseName="قواعد البيانات" room="معمل 3" status="late" statusLabel={t.lateStamp} />
          <TimelineRow startTime="12:00" endTime="13:50" courseCode="Math210" courseName="الرياضيات المتقطعة" status="absent" statusLabel={t.markAbsent} />
          <TimelineRow startTime="14:00" endTime="15:50" courseCode="CS310" courseName="الشبكات" trailing={<Button size="sm" variant="outline">{t.contest}</Button>} />
        </div>
      </Section>

      <Section title="CourseAttendanceCard">
        <div className="divide-y divide-border rounded-card border border-border bg-card">
          <CourseAttendanceCard
            courseCode="CS301"
            courseName="نظم التشغيل"
            attended={14}
            total={16}
            percent={88}
            noSessionsLabel={t.noSessionsYet}
            expanded={expandedCourse === "cs301"}
            onToggle={() => setExpandedCourse(expandedCourse === "cs301" ? null : "cs301")}
            sessions={LEDGER}
          />
          <CourseAttendanceCard
            courseCode="CS305"
            courseName="قواعد البيانات"
            attended={11}
            total={16}
            percent={69}
            noSessionsLabel={t.noSessionsYet}
            expanded={expandedCourse === "cs305"}
            onToggle={() => setExpandedCourse(expandedCourse === "cs305" ? null : "cs305")}
            sessions={LEDGER.slice(0, 2)}
          />
          <CourseAttendanceCard
            courseCode="CS310"
            courseName="الشبكات"
            attended={0}
            total={0}
            percent={0}
            noSessionsLabel={t.noSessionsYet}
            expanded={expandedCourse === "cs310"}
            onToggle={() => setExpandedCourse(expandedCourse === "cs310" ? null : "cs310")}
          />
        </div>
      </Section>

      <Section title="StampResult">
        <div className="rounded-card border border-border bg-card">
          <StampResult stamp={t.presentStamp} timeLabel="08:03 ص" tone="present" headline={t.markedPresent} sub="CS301 · قاعة 204" />
        </div>
        <div className="rounded-card border border-border bg-card">
          <StampResult stamp={t.lateStamp} timeLabel="08:23 ص" tone="late" headline={t.markedLate} sub="CS301 · قاعة 204" />
        </div>
      </Section>

      <Section title="WeekGrid">
        <WeekGrid days={WEEK_DAYS} todayKey={0} locale={locale} emptyHint={t.noSessionsToday} />
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          value={view}
          onValueChange={setView}
          ariaLabel={t.weeklyView}
          options={[
            { value: "weekly", label: t.weeklyView, icon: <CalendarDays size={14} /> },
            { value: "list", label: t.listView, icon: <ClipboardList size={14} /> }
          ]}
        />
      </Section>

      <Section title="SemesterHeatmap">
        <div className="rounded-card border border-border bg-card p-3">
          <SemesterHeatmap
            cells={heatCells}
            locale={locale}
            statusLabels={{
              present: t.present,
              late: t.lateStamp,
              absent: t.markAbsent,
              excused: t.newExcuse,
              none: t.noSessionsYet
            }}
          />
        </div>
      </Section>

      <Section title="LazyBlurText / LazyAnimatedList">
        <p className="font-display text-lg font-bold">
          <LazyBlurText text="أول حضور مسجّل — ابدأ يومك" />
        </p>
        <div className="rounded-card border border-border bg-card">
          <LazyAnimatedList
            items={ANNOUNCEMENTS}
            maxHeight={220}
            renderItem={(item) => (
              <span className="flex items-start gap-2 text-[15px]">
                <ScanLine size={16} className="mt-1 shrink-0 text-primary" />
                {item.title}
              </span>
            )}
          />
        </div>
      </Section>

      <Section title="LazyStepper">
        <div className="rounded-card border border-border bg-card p-4">
          <LazyStepper
            step={step}
            onStepChange={setStep}
            onCompleted={() => setStep(0)}
            labels={{ back: t.back, next: t.next, complete: t.save }}
            steps={[
              { title: t.fullName, content: <Input placeholder={t.fullName} /> },
              { title: t.universityId, content: <Input placeholder="40212345" dir="ltr" /> },
              { title: t.faculty, content: <Input placeholder={t.pickProgram} /> }
            ]}
          />
        </div>
      </Section>

      <Section title="EmptyState & Skeletons">
        <EmptyState
          icon={<QrCode size={24} />}
          title={t.noEnroll}
          hint={t.noEnrollHint}
          withGrid
          action={<Button variant="outline">{t.viewHistory}</Button>}
        />
        <div className="rounded-card border border-border bg-card p-4">
          <StatsSkeleton />
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <TimelineSkeleton rows={3} />
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <CardSkeleton rows={2} />
        </div>
      </Section>

      <Section title="PermissionPrimer">
        <PermissionPrimer
          kind="camera"
          title="الكاميرا لمسح رمز القاعة"
          reason="نحتاج الكاميرا لقراءة رمز الحضور الظاهر على شاشة القاعة. لا نحفظ أي صور."
          actionLabel="اسمح بالكاميرا"
          skipLabel={t.back}
          onAllow={() => {}}
          onSkip={() => {}}
        />
        <PermissionPrimer
          kind="location"
          title="الموقع للتحقق من القاعة"
          reason="نتحقق أنك داخل نطاق القاعة أثناء المسح. لا نتتبع موقعك خارج الجلسة."
          actionLabel="تفعيل الموقع"
          onAllow={() => {}}
        />
      </Section>

      <Section title="BottomSheet">
        <BottomSheet
          title={t.newExcuse}
          description={t.contestHint}
          trigger={<Button variant="outline">{t.newExcuse}</Button>}
          footer={<Button className="w-full">{t.save}</Button>}
        >
          <Label htmlFor="d-excuse">{t.comment}</Label>
          <Input id="d-excuse" placeholder={t.manualHint} className="mt-1.5" />
        </BottomSheet>
      </Section>

      <Section title="Toast & CommandPalette">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast.status("present", t.markedPresent, "CS301 · 08:03 ص")}>
            status · present
          </Button>
          <Button variant="outline" onClick={() => toast.status("late", t.markedLate, "CS301 · 08:23 ص")}>
            status · late
          </Button>
          <Button variant="outline" onClick={() => toast.status("absent", t.markAbsent)}>
            status · absent
          </Button>
          <Button variant="outline" onClick={() => toast.error(t.err_offline, { description: t.err_offline_fix })}>
            error
          </Button>
        </div>
        <CommandPaletteTrigger />
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="text-sm text-primary underline underline-offset-2"
        >
          افتح لوحة الأوامر (أو ⌘K)
        </button>
        <p className="text-[13px] text-muted-foreground">
          المسار الظاهر: {typeof window === "undefined" ? "—" : window.location.pathname}
        </p>
      </Section>

      <Section title="Icons — lucide فقط">
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <Camera size={20} strokeWidth={2} />
          <MapPin size={20} strokeWidth={2} />
          <ScanLine size={20} strokeWidth={2} />
          <QrCode size={20} strokeWidth={2} />
          <CalendarDays size={20} strokeWidth={2} />
          <Separator orientation="vertical" className="h-6" />
          <span className="text-[13px]">stroke-width ثابت 2 في كل الأيقونات</span>
        </div>
      </Section>

      <Toast />
      <CommandPalette />
    </main>
  );
}
