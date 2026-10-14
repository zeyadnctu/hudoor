"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/providers";
import { House, ScanLine, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/student", key: "myAttendance", icon: House },
  { href: "/student/scan-in-app", key: "openScanner", icon: ScanLine },
  { href: "/student/timetable", key: "weeklyTimetable", icon: MapPin },
  { href: "/profile", key: "profileTitle", icon: User },
];

export function StudentBottomNav() {
  const { t } = useApp();
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-black/10 bg-paper/95 backdrop-blur dark:border-white/15 dark:bg-inkdeep/95 sm:hidden" aria-label="main">
      <div className="grid grid-cols-4">
        {LINKS.map(l => {
          const active = path === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
                active ? "text-register" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span>{(t as any)[l.key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
