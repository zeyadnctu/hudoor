# Hudoor Student UI — Design Plan (premium theme module)

Written before UI code, per the module brief. Re-verified against the brief's
anti-"AI slop" rules. Palette math is executable: `node scripts/palette-check.mjs`
(64 fg/bg pairs, WCAG AA, both themes — all pass).

## 1. Palette check (oklch, verified)

Brand inputs kept: Lecture Slate #1F2A33, Chalk #EEF0EA, Register Blue #2F5D8A,
Stamp Green #2E9B5F, Brick #B5432E, Highlighter #D9A21B.

Light (adjusted to pass AA — spec allows lightness changes):
- background #F4F5F1 · foreground #1B242B (14.4:1)
- card #FFFFFF · muted #E7EAE3 · muted-foreground #5A6670 (4.8–5.9:1)
- primary #2F5D8A / white (6.9:1) · accent #E2ECF4 (hover/selected-row wash)
- present ink **#227346** (5.0–5.8:1) — darkened from #2E9B5F, which failed at 3.2:1
- late ink **#7E5D08** (5.3–6.1:1) — darkened from #B8860B, which failed at 3.0:1
- absent #B5432E (5.0–5.5:1) · excused #5A6670 (5.9:1)
- status fills (bars/rings only, ≥3:1): #2E9B5F · #AD7F0C · #B5432E

Dark (designed, not inverted — all pass as authored):
- background #11181D · card #182027 · popover #1C262E · muted #222D36
- foreground #E9ECE6 (13.8–15:1) · muted-foreground #93A0AA (5.2–6.7:1)
- primary #6FA3D8 / ink #0E1A24 (6.6:1)
- present #4CC283 (7.3:1) · late #E8B93E (9.0:1) · absent #E0705A (5.2:1) · excused #93A0AA

Status rule: every status = icon/shape + label + color, never color alone.

## 2. Type scale (4px spacing grid)

Fonts: Readex Pro (display, `--font-display`) + IBM Plex Sans Arabic (body,
`--font-body`), next/font, arabic+latin subsets, swap.

| role | size/lh | weight | use |
|---|---|---|---|
| display | 26px/1.25 | 700 | screen title, stamp face |
| stat | 28–32px/1 | 700 | NumberStat value (tnum) |
| title | 20px/1.35 | 600 | section heading |
| body | 15px/1.7 | 400–500 | content |
| small | 13px/1.5 | 400–600 | meta |
| micro | 11px/1.4 | 600 | labels, chips |

Tabular numerals (`.tnum`) on all times, counts, percentages.

## 3. Elevation, radius, motion

- Elevation: surface step (background → card → popover) + 1px border. Soft shadow
  (`--shadow-sheet/-pop/-scan`) only on sheets, popovers and the Scan action.
- Radius from one 10px base: inputs/buttons 10 · cards 14 · sheets 20 · pills full.
- Motion tokens: fast 120ms · base 200ms · slow 320ms; ease-out `cubic-bezier(.22,1,.36,1)`,
  spring `cubic-bezier(.2,.9,.25,1.2)`. One signature motion: the stamp press.
- Data viz: chart-1..4 = primary + status fills; direct labels; no 3D, no gradients.

## 4. React Bits — exactly 4, each with a fixed screen

| component | screen(s) | notes |
|---|---|---|
| CountUp | Today: overall %, sessions present, streak, "ends in" countdown | tabular numerals, static fallback, reduced-motion shows final value |
| BlurText | Onboarding intro headline + Present result headline | word-by-word blur resolve; the "text reveal" role (Text Reveal was removed upstream; BlurText is its quiet successor) |
| AnimatedList | Today: announcements feed | new items enter, nothing else moves; frame off, tokens only |
| Stepper | Onboarding wizard (3 steps) | also the pattern for future excuse/dispute wizards |

Every one is lazy-loaded (`next/dynamic`), has a static fallback, honors
prefers-reduced-motion, and is retokened (lucide icons only, theme vars only).

Rejected and why:
- React Bits backgrounds (Dot Grid/Dot Field/etc.): would exceed the 4-cap and most
  are WebGL/cursor-reactive — forbidden. The quiet background is an in-house CSS
  `.dot-grid` (token-tinted, slow drift, static under reduced motion), used only on
  login, onboarding intro, and large empty states.
- Dock / Pill Nav / Gooey Nav: fail the one-handed test; the custom bottom tab bar
  with center Scan action stays.
- Counter (CountUp covers it), Split Text/Gradient Text/Shiny/Aurora/Plasma/cursor
  trails/particles: forbidden categories.
- No React Bits anywhere on the Scan camera route, the Present stamp, tables, forms,
  or the professor QR screen.

## 5. Screen intents (what each screen is for)

- **Login** — get in, one thumb. Quiet dot-grid, wordmark, one primary action.
- **Onboarding** — three steps, Stepper + BlurText intro; ask only what enrollment needs.
- **Today (/student)** — "one page of the register": live-class card is the single
  bold moment (dark slate on light chalk, stamp-green scan action), stats row quiet,
  today's timeline, course cards with progress, announcements feed, recent scans.
- **Scan result (/scan)** — the stamp presses onto ruled paper; headline blurs in.
  Nothing else moves. Budget-tight, zero libraries beyond the stamp.
- **Scanner (/student/scan-in-app)** — camera first, chrome last. No effects.
- **Timetable (/student/timetable)** — WeekGrid of day columns, program chip only
  place a program color appears (badges/chips only, never large surfaces).
- **Profile** — account + device + prefs; toasts confirm actions.

## 6. Anti-slop checklist (run before each screen ships)

stock-shadcn look? default colors? more than one bold moment? decoration without
meaning? RTL broken? dark contrast? motion respecting reduced-motion? Fix, then move on.
