"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { dict, type Locale, type Dict } from "@/lib/i18n";
import { Sun, Moon, Languages } from "lucide-react";

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: Dict; theme: string; setTheme: (t: string) => void }>({
  locale: "ar", setLocale: () => {}, t: dict.ar, theme: "light", setTheme: () => {}
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Arabic-first: RTL is the default, English secondary.
  const [locale, setLocaleState] = useState<Locale>("ar");
  const [theme, setThemeState] = useState("light");
  useEffect(() => {
    const l = localStorage.getItem("hudoor_locale");
    const th = localStorage.getItem("hudoor_theme") || "light";
    setLocaleState(l === "en" ? "en" : "ar");
    setThemeState(th === "dark" ? "dark" : "light");
  }, []);
  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("hudoor_locale", locale);
    localStorage.setItem("hudoor_theme", theme);
  }, [locale, theme]);
  return (
    <Ctx.Provider value={{ locale, setLocale: setLocaleState, t: dict[locale], theme, setTheme: setThemeState }}>
      {children}
    </Ctx.Provider>
  );
}
export const useApp = () => useContext(Ctx);

export function Controls() {
  const { locale, setLocale, theme, setTheme } = useApp();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        className="flex min-h-[48px] min-w-[48px] items-center justify-center gap-1 rounded-md2 border border-black/15 px-3 text-sm font-semibold dark:border-white/20"
        aria-label="language"
      >
        <Languages size={18} strokeWidth={2} />
        {locale === "ar" ? "EN" : "ع"}
      </button>
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="grid min-h-[48px] min-w-[48px] place-items-center rounded-md2 border border-black/15 dark:border-white/20"
        aria-label="theme"
      >
        {theme === "dark" ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
      </button>
    </div>
  );
}
