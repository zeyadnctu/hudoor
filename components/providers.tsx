"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { dict, type Locale, type Dict } from "@/lib/i18n";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider, useTheme } from "next-themes";
import { DirectionProvider } from "@radix-ui/react-direction";
import { Sun, Moon, Languages } from "lucide-react";

type AppCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
  theme: string;
  setTheme: (t: string) => void;
};

const Ctx = createContext<AppCtx>({
  locale: "ar", setLocale: () => {}, t: dict.ar, theme: "light", setTheme: () => {}
});

/* next-themes owns the .dark class; this wrapper keeps the app's t/locale API */
function AppProviders({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [locale, setLocaleState] = useState<Locale>("ar");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const l = localStorage.getItem("hudoor_locale");
    setLocaleState(l === "en" ? "en" : "ar");
  }, []);
  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    localStorage.setItem("hudoor_locale", locale);
  }, [locale]);

  const dir = locale === "ar" ? "rtl" : "ltr";
  const value: AppCtx = {
    locale,
    setLocale: setLocaleState,
    t: dict[locale],
    // avoid hydration flash: render the default until mounted
    theme: mounted ? (theme ?? "light") : "light",
    setTheme: (t: string) => setTheme(t)
  };
  return (
    <Ctx.Provider value={value}>
      <DirectionProvider dir={dir}>
        <NextIntlClientProvider locale={locale} messages={dict[locale] as Record<string, string>}>
          {children}
        </NextIntlClientProvider>
      </DirectionProvider>
    </Ctx.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <AppProviders>{children}</AppProviders>
    </ThemeProvider>
  );
}

export const useApp = () => useContext(Ctx);

export function Controls() {
  const { locale, setLocale, theme, setTheme } = useApp();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        className="flex min-h-[48px] min-w-[48px] items-center justify-center gap-1 rounded-base border border-border px-3 text-sm font-semibold transition-colors hover:bg-accent"
        aria-label="language"
      >
        <Languages size={18} strokeWidth={2} />
        {locale === "ar" ? "EN" : "ع"}
      </button>
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="grid min-h-[48px] min-w-[48px] place-items-center rounded-base border border-border transition-colors hover:bg-accent"
        aria-label="theme"
      >
        {theme === "dark" ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
      </button>
    </div>
  );
}
