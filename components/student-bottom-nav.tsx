"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/providers";
import { House, ScanLine, CalendarDays, ClipboardList, User } from "lucide-react";
import { cn } from "@/lib/utils";

/* Student bottom nav — 5 destinations with the Scan action raised in the
   center for one-handed reach. Active state is ink + weight, not color alone. */
const LINKS = [
  { href: "/student", key: "today", icon: House },
  { href: "/student/timetable", key: "timetable", icon: CalendarDays },
  null, // center slot: scan
  { href: "/student/attendance", key: "attNav", icon: ClipboardList },
  { href: "/student/me", key: "profileTitle", icon: User }
] as const;

export function StudentBottomNav() {
  const { t } = useApp();
  const path = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      aria-label="main"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end">
        {LINKS.map((l) => {
          if (!l) {
            // center scan button — raised above the bar
            return (
              <Link
                key="scan"
                href="/student/scan-in-app"
                aria-label={t.scanNow}
                className="relative flex justify-center"
              >
                <span
                  className={cn(
                    "-mt-6 grid h-14 w-14 place-items-center rounded-pill bg-primary text-primary-foreground shadow-lg transition-transform duration-fast ease-out active:scale-95",
                    path === "/student/scan-in-app" && "ring-2 ring-ring ring-offset-2 ring-offset-card"
                  )}
                >
                  <ScanLine size={24} strokeWidth={2} />
                </span>
              </Link>
            );
          }
          const active = path === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-0.5 pb-1 text-[10px] font-semibold transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span className="max-w-full truncate px-0.5">{(t as any)[l.key]}</span>
              <span
                className={cn("h-0.5 w-4 rounded-pill", active ? "bg-primary" : "bg-transparent")}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
