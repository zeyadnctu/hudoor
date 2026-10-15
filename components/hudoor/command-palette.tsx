'use client';

import * as React from 'react';
import {
  CalendarDays,
  Home,
  LogOut,
  Languages,
  Moon,
  ScanLine,
  Search,
  Sun,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useApp } from '@/components/providers';

/** Global open state so ⌘K / ctrl+K and the header trigger share one source. */
type PaletteState = { open: boolean; setOpen: (open: boolean) => void };
export const usePalette = create<PaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/**
 * CommandPalette — cmdk.
 *
 * Rows are filtered by the translated label, so searching in Arabic works.
 * Keyboard: ⌘K / Ctrl+K toggles, arrows navigate, Enter selects, Esc closes.
 */
export function CommandPalette() {
  const { open, setOpen } = usePalette();
  const router = useRouter();
  const { locale, setLocale, t, theme, setTheme } = useApp();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const run = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const isDark = mounted && theme === 'dark';

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command
        loop
        // Filter on the visible (translated) label, not the value id.
        filter={(value, search) => {
          const label = value.replace(/^nav-|^action-/, '');
          return label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
        }}
      >
        <CommandInput placeholder={t.palette} className="h-11 [&>input]:text-base" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>{t.noResults}</CommandEmpty>

          <CommandGroup heading={t.mainNav}>
            <CommandItem
              value={`nav-${t.today}`}
              onSelect={() => run('/student')}
              className="gap-3 rounded-[calc(var(--radius)-2px)]"
            >
              <Home className="size-4 text-muted-foreground" />
              <span>{t.today}</span>
            </CommandItem>
            <CommandItem
              value={`nav-${t.timetable}`}
              onSelect={() => run('/student/timetable')}
              className="gap-3 rounded-[calc(var(--radius)-2px)]"
            >
              <CalendarDays className="size-4 text-muted-foreground" />
              <span>{t.timetable}</span>
            </CommandItem>
            <CommandItem
              value={`nav-${t.scanNow}`}
              onSelect={() => run('/student/scan-in-app')}
              className="gap-3 rounded-[calc(var(--radius)-2px)]"
            >
              <ScanLine className="size-4 text-muted-foreground" />
              <span>{t.scanNow}</span>
            </CommandItem>
            <CommandItem
              value={`nav-${t.profileTitle}`}
              onSelect={() => run('/profile')}
              className="gap-3 rounded-[calc(var(--radius)-2px)]"
            >
              <User className="size-4 text-muted-foreground" />
              <span>{t.profileTitle}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t.actions}>
            <CommandItem
              value={`action-${isDark ? t.lightMode : t.darkMode}`}
              onSelect={() => setTheme(isDark ? 'light' : 'dark')}
              className="gap-3 rounded-[calc(var(--radius)-2px)]"
            >
              {isDark ? (
                <Sun className="size-4 text-muted-foreground" />
              ) : (
                <Moon className="size-4 text-muted-foreground" />
              )}
              <span>{isDark ? t.lightMode : t.darkMode}</span>
            </CommandItem>

            <CommandItem
              value={`action-${locale === 'ar' ? 'English' : 'العربية'}`}
              onSelect={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
              className="gap-3 rounded-[calc(var(--radius)-2px)]"
            >
              <Languages className="size-4 text-muted-foreground" />
              <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
            </CommandItem>

            <CommandItem
              value={`action-${t.logout}`}
              onSelect={() => run('/login')}
              className="gap-3 rounded-[calc(var(--radius)-2px)] text-destructive"
            >
              <LogOut className="size-4" />
              <span>{t.logout}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

/** ⌘K trigger for headers — opens the palette. */
export function CommandPaletteTrigger({ label }: { label?: string }) {
  const setOpen = usePalette((state) => state.setOpen);
  const { t } = useApp();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t.palette}
      className="inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-2px)] border border-border bg-card px-3 text-muted-foreground transition-[background-color,border-color] duration-200 hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="text-sm">{label ?? t.palette}</span>
      <kbd className="hidden rounded-[calc(var(--radius)-4px)] border border-border bg-muted px-1.5 font-sans text-[11px] text-muted-foreground sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}
