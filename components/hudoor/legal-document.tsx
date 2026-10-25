"use client";

import Link from "next/link";
import { useApp } from "@/components/providers";
import { LEGAL_UPDATED, LEGAL_VERSION, type LegalDoc } from "@/lib/legal";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";

/**
 * Shared renderer for /privacy and /terms. Content is bilingual data, so the
 * language switch in the app header changes the whole document without a
 * second route or a reload.
 */
export function LegalDocument({ doc, kind }: { doc: LegalDoc; kind: "privacy" | "terms" }) {
  const { locale, t } = useApp();
  const Icon = kind === "privacy" ? ShieldCheck : FileText;
  const updated = new Date(`${LEGAL_UPDATED}T00:00:00Z`).toLocaleDateString(
    locale === "ar" ? "ar-EG" : "en-US",
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-base px-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight size={16} strokeWidth={2} className={locale === "ar" ? "" : "rotate-180"} aria-hidden="true" />
          {t.legalHome}
        </Link>
        <span className="tnum text-[11px] text-muted-foreground">
          {t.legalVersion} {LEGAL_VERSION}
        </span>
      </div>

      <header className="mt-6 border-b border-border pb-5">
        <span className="grid h-11 w-11 place-items-center rounded-base bg-primary/10 text-primary">
          <Icon size={21} strokeWidth={2} aria-hidden="true" />
        </span>
        <h1 className="mt-3 font-display text-[28px] font-bold leading-tight">{doc.title[locale]}</h1>
        <p className="tnum mt-1 text-[11px] text-muted-foreground">
          {t.legalUpdated}: {updated}
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">{doc.intro[locale]}</p>
      </header>

      <div className="mt-6 space-y-7">
        {doc.sections.map(section => (
          <section key={section.heading.en} aria-labelledby={section.heading.en}>
            <h2 className="font-display text-[17px] font-bold leading-snug">{section.heading[locale]}</h2>
            {section.paragraphs?.map(p => (
              <p key={p.en} className="mt-2 text-[14px] leading-relaxed text-foreground/90">
                {p[locale]}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-2 space-y-2">
                {section.bullets.map(b => (
                  <li key={b.en} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground/90">
                    <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-pill bg-primary" />
                    <span>{b[locale]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <footer className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-[12px] font-semibold">
        <Link href="/privacy" className="min-h-[44px] inline-flex items-center text-primary hover:underline">
          {t.mePrivacyPolicy}
        </Link>
        <Link href="/terms" className="min-h-[44px] inline-flex items-center text-primary hover:underline">
          {t.meTerms}
        </Link>
      </footer>
    </main>
  );
}
