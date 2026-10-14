"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/components/providers";
import { browserSupabase } from "@/lib/supabase";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, UserCheck,
  MapPin, CalendarDays, CalendarRange, ClipboardList, Inbox, ScrollText,
  Flag, Megaphone, Settings, Trash2, Menu, X, Search, LogOut, Eye, MailPlus
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, key: "overview", exact: true },
  { href: "/admin/users", icon: Users, key: "users" },
  { href: "/admin/invites", icon: MailPlus, key: "newInvite" },
  { href: "/admin/programs", icon: GraduationCap, key: "programs" },
  { href: "/admin/courses", icon: BookOpen, key: "courses" },
  { href: "/admin/enrollments", icon: UserCheck, key: "enrollments" },
  { href: "/admin/rooms", icon: MapPin, key: "rooms" },
  { href: "/admin/timetable", icon: CalendarDays, key: "timetable" },
  { href: "/admin/semesters", icon: CalendarRange, key: "semesters" },
  { href: "/admin/attendance", icon: ClipboardList, key: "attendance" },
  { href: "/admin/requests", icon: Inbox, key: "requests" },
  { href: "/admin/audit", icon: ScrollText, key: "audit" },
  { href: "/admin/flagged", icon: Flag, key: "flagged" },
  { href: "/admin/notifications", icon: Megaphone, key: "notifications" },
  { href: "/admin/settings", icon: Settings, key: "settings" },
  { href: "/admin/trash", icon: Trash2, key: "trash" }
];

const TITLES: Record<string, string> = {
  "/admin": "overview", "/admin/users": "users", "/admin/invites": "newInvite", "/admin/faculties": "faculties",
  "/admin/programs": "programs", "/admin/courses": "courses",
  "/admin/enrollments": "enrollments", "/admin/rooms": "rooms",
  "/admin/timetable": "timetable", "/admin/semesters": "semesters",
  "/admin/attendance": "attendance", "/admin/requests": "requests",
  "/admin/audit": "audit", "/admin/flagged": "flagged",
  "/admin/notifications": "notifications", "/admin/settings": "settings",
  "/admin/trash": "trash"
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  const [pq, setPq] = useState("");
  const [results, setResults] = useState<any>({ users: [], courses: [], rooms: [], sessions: [] });
  const [viewAs, setViewAs] = useState<any>(null);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("hudoor_admin_nav") === "1"); } catch {}
    fetch("/api/console/view-as").then(r => r.json()).then(j => setViewAs(j.active ?? null)).catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(p => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!palette || pq.trim().length < 2) { setResults({ users: [], courses: [], rooms: [], sessions: [] }); return; }
    const id = setTimeout(async () => {
      const r = await fetch(`/api/console/search?q=${encodeURIComponent(pq)}`);
      if (r.ok) setResults(await r.json());
    }, 300);
    return () => clearTimeout(id);
  }, [pq, palette]);

  async function logout() {
    await browserSupabase().auth.signOut();
    router.push("/login");
  }
  async function stopViewAs() {
    await fetch("/api/console/view-as", { method: "DELETE" });
    setViewAs(null);
    location.reload();
  }

  const crumbs = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    return parts.map((p, i) => ({ label: p, href: "/" + parts.slice(0, i + 1).join("/") }));
  }, [path]);

  const pageKey = TITLES[path] ?? path.split("/").pop() ?? "";
  const pageTitle = (t as any)[pageKey] ?? pageKey;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3">
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-2">
            <span className="font-display grid h-9 w-9 place-items-center rounded-md2 bg-ink text-sm font-bold text-chalk dark:bg-chalk dark:text-ink">ح</span>
            <span className="font-display text-lg font-bold">{t.app}</span>
          </Link>
        )}
        <button
          onClick={() => { const v = !collapsed; setCollapsed(v); try { localStorage.setItem("hudoor_admin_nav", v ? "1" : "0"); } catch {} }}
          aria-label={t.collapse}
          className="grid h-11 w-11 place-items-center rounded-md2 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
      </div>
      <button
        onClick={() => { setPalette(true); setMobile(false); }}
        className="mx-3 flex min-h-[48px] items-center gap-2 rounded-md2 border border-black/15 px-3 text-sm text-neutral-500 dark:border-white/20"
      >
        <Search size={17} strokeWidth={2} />
        {!collapsed && <span className="flex-1 text-start">{t.commandHint}</span>}
        {!collapsed && <kbd className="tnum rounded bg-black/10 px-1.5 text-xs dark:bg-white/15">⌘K</kbd>}
      </button>
      <nav className="mt-2 flex-1 overflow-auto px-2 pb-2" aria-label="Admin">
        {NAV.map(n => {
          const active = n.exact ? path === n.href : path === n.href || path.startsWith(n.href + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.href} href={n.href} aria-current={active ? "page" : undefined}
              onClick={() => setMobile(false)}
              title={(t as any)[n.key] ?? n.key}
              className={cn(
                "mt-0.5 flex min-h-[48px] items-center gap-3 rounded-md2 px-3 text-[15px] font-medium transition-colors",
                active ? "bg-register font-semibold text-white" : "hover:bg-black/5 dark:hover:bg-white/10"
              )}
            >
              <Icon size={19} strokeWidth={2} className="shrink-0" />
              {!collapsed && <span>{(t as any)[n.key] ?? n.key}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-black/10 p-2 dark:border-white/10">
        <button onClick={logout} className="flex min-h-[48px] w-full items-center gap-3 rounded-md2 px-3 text-[15px] font-semibold text-brick-dark hover:bg-brick-light dark:text-red-300 dark:hover:bg-brick/15">
          <LogOut size={19} strokeWidth={2} />
          {!collapsed && <span>{t.logout}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 border-e-2 border-ink/15 bg-paper transition-all dark:border-white/15 dark:bg-inksurface lg:block", collapsed ? "w-[76px]" : "w-64")}>
        {sidebar}
      </aside>
      {/* mobile drawer */}
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-paper shadow-2xl dark:bg-inksurface">
            <div className="flex justify-end p-2">
              <button onClick={() => setMobile(false)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-md2 hover:bg-black/5"><X size={20} strokeWidth={2} /></button>
            </div>
            <div className="h-[calc(100%-52px)]">{sidebar}</div>
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        {viewAs && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-hi px-4 py-2 text-sm font-bold text-ink" role="alert">
            <span className="flex items-center gap-2"><Eye size={17} strokeWidth={2} /> {t.viewAsBanner}: {viewAs.email} ({viewAs.role})</span>
            <button onClick={stopViewAs} className="min-h-[40px] rounded bg-ink px-3 font-bold text-chalk">{t.stopView}</button>
          </div>
        )}
        {/* breadcrumbs */}
        <div className="sticky top-0 z-30 border-b border-black/10 bg-chalk/95 backdrop-blur dark:border-white/10 dark:bg-inkdeep/95">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
            <button onClick={() => setMobile(true)} aria-label="Menu" className="grid h-11 w-11 place-items-center rounded-md2 hover:bg-black/5 lg:hidden dark:hover:bg-white/10">
              <Menu size={20} strokeWidth={2} />
            </button>
            <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
              {crumbs.map((c, i) => (
                <span key={c.href} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <span className="text-neutral-400">/</span>}
                  {i === 0
                    ? <Link href="/admin" className="font-semibold text-register hover:underline">{t.app}</Link>
                    : i === crumbs.length - 1
                      ? <span className="truncate font-bold" aria-current="page">{pageTitle}</span>
                      : <Link href={c.href} className="truncate text-neutral-500 hover:underline">{(t as any)[TITLES[c.href]] ?? c.label}</Link>}
                </span>
              ))}
            </nav>
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      </div>

      {/* command palette */}
      {palette && (
        <div className="fixed inset-0 z-50 p-4" role="dialog" aria-modal="true" aria-label="Search">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setPalette(false)} />
          <div className="relative mx-auto mt-16 w-full max-w-xl overflow-hidden rounded-lg2 border border-black/10 bg-paper shadow-2xl dark:border-white/15 dark:bg-inksurface">
            <div className="flex items-center gap-2 border-b border-black/10 p-3 dark:border-white/10">
              <Search size={19} strokeWidth={2} className="shrink-0 text-neutral-400" />
              <input
                autoFocus value={pq} onChange={e => setPq(e.target.value)} dir="auto"
                placeholder={t.commandHint} aria-label={t.commandHint}
                onKeyDown={e => { if (e.key === "Escape") setPalette(false); }}
                className="min-h-[48px] w-full bg-transparent text-lg outline-none placeholder:text-neutral-400"
              />
            </div>
            <div className="max-h-[50vh] overflow-auto p-2">
              <p className="px-2 py-1 text-xs font-bold text-neutral-500">Pages</p>
              {NAV.filter(n => !pq || (((t as any)[n.key] ?? n.key) as string).includes(pq)).slice(0, 6).map(n => (
                <Link key={n.href} href={n.href} onClick={() => setPalette(false)} className="flex min-h-[48px] items-center gap-2 rounded-md2 px-3 font-medium hover:bg-black/5 dark:hover:bg-white/10">
                  <n.icon size={18} strokeWidth={2} /> {(t as any)[n.key] ?? n.key}
                </Link>
              ))}
              {(["users", "courses", "rooms", "sessions"] as const).map(k => (
                <div key={k}>
                  {results[k]?.length > 0 && <p className="px-2 py-1 text-xs font-bold capitalize text-neutral-500">{k}</p>}
                  {(results[k] ?? []).map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setPalette(false);
                        if (k === "users") location.href = `/admin/users?q=${encodeURIComponent(r.email ?? r.name ?? "")}`;
                        if (k === "courses") location.href = `/admin/courses?q=${encodeURIComponent(r.code)}`;
                        if (k === "rooms") location.href = `/admin/rooms?q=${encodeURIComponent(r.name_ar ?? "")}`;
                        if (k === "sessions") location.href = `/admin/attendance?session=${r.id}`;
                      }}
                      className="flex min-h-[48px] w-full items-center gap-2 rounded-md2 px-3 text-start hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <span className="tnum font-semibold">{r.email ?? r.code ?? r.name_ar ?? r.id?.slice(0, 8)}</span>
                      <span className="truncate text-sm text-neutral-500">{r.name ?? r.name_en ?? r.status ?? ""}</span>
                    </button>
                  ))}
                </div>
              ))}
              {pq.trim().length >= 2 && !results.users?.length && !results.courses?.length && (
                <p className="p-4 text-center text-sm text-neutral-500">{t.noResults}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
