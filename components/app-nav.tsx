"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp, Controls } from "@/components/providers";
import { LogOut, ScanLine, House, CalendarDays, FileBarChart, Table2, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const links = {
  student: [
    { href: "/student", label: "myAttendance", icon: <House size={19} strokeWidth={2} /> },
    { href: "/student/scan-in-app", label: "openScanner", icon: <ScanLine size={19} strokeWidth={2} /> }
  ],
  professor: [
    { href: "/professor", label: "startSession", icon: <CalendarDays size={19} strokeWidth={2} /> },
    { href: "/professor/reports", label: "reports", icon: <FileBarChart size={19} strokeWidth={2} /> }
  ],
  admin: [
    { href: "/admin", label: "dashboard", icon: <Table2 size={19} strokeWidth={2} /> }
  ]
} as const;

export function AppNav({ role }: { role: keyof typeof links }) {
  const { t } = useApp();
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    const sb = browserSupabase();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const home = role === "admin" ? "/admin" : role === "professor" ? "/professor" : "/student";

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink/15 bg-chalk/95 backdrop-blur dark:border-white/20 dark:bg-inkdeep/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link href={home} className="flex min-h-[48px] items-center gap-2" aria-label={t.app}>
          <span className="font-display grid h-9 w-9 place-items-center rounded-md2 bg-ink text-sm font-bold text-chalk dark:bg-chalk dark:text-ink">ح</span>
          <span className="font-display text-lg font-bold">{t.app}</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="main">
          {links[role].map(l => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[48px] items-center gap-1.5 rounded-md2 px-3 text-[15px] font-semibold transition-colors",
                  active
                    ? "bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                )}
              >
                {l.icon}
                <span className="hidden sm:inline">{(t as any)[l.label]}</span>
              </Link>
            );
          })}
          <Controls />
          <button
            onClick={logout}
            aria-label={t.logout}
            className="flex min-h-[48px] items-center gap-1.5 rounded-md2 border border-black/15 px-3 text-sm font-semibold transition-colors hover:border-brick hover:text-brick dark:border-white/20"
          >
            <LogOut size={18} strokeWidth={2} />
            <span className="hidden sm:inline">{t.logout}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
