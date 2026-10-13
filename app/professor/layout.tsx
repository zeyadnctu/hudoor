"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/providers";
import { AppNav } from "@/components/app-nav";
import { ViewAsBanner } from "@/components/console/ViewAsBanner";
import { BookOpen, CalendarDays, Users, Inbox, FileBarChart, CalendarRange, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/professor/courses", icon: BookOpen, key: "myCourses" },
  { href: "/professor/sessions", icon: CalendarDays, key: "mySessions" },
  { href: "/professor/students", icon: Users, key: "myStudents" },
  { href: "/professor/excuses", icon: Inbox, key: "excuses" },
  { href: "/professor/reports", icon: FileBarChart, key: "myReports" },
  { href: "/professor/schedule", icon: CalendarRange, key: "mySchedule" },
  { href: "/professor/settings", icon: Settings, key: "mySettings" }
];

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const { t } = useApp();
  const path = usePathname();
  return (
    <>
      <ViewAsBanner />
      <AppNav role="professor" />
      <nav className="border-b border-black/10 bg-paper dark:border-white/10 dark:bg-inksurface" aria-label="Workspace">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
          {TABS.map(n => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link
                key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md2 px-3 text-sm font-semibold",
                  active ? "bg-register text-white" : "hover:bg-black/5 dark:hover:bg-white/10"
                )}
              >
                <n.icon size={17} strokeWidth={2} />
                {(t as any)[n.key] ?? n.key}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
