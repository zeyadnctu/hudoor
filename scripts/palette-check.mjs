// Palette verification: hex -> oklch + WCAG contrast for every semantic pair,
// light and dark. Fails (exit 1) if any required pair is below AA.
// Usage: node scripts/palette-check.mjs

const hexToRgb = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const relLum = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(srgbToLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// hex -> oklch (D65)
function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}

// Status model: `-ink` = text on surfaces (AA), `-fill` = graphics/bars (3:1),
// `-soft` = chip background tint (ink must stay AA on top of it).
const LIGHT = {
  background: "#F4F5F1", foreground: "#1B242B",
  card: "#FFFFFF", "card-foreground": "#1B242B",
  popover: "#FFFFFF", "popover-foreground": "#1B242B",
  muted: "#E7EAE3", "muted-foreground": "#5A6670",
  border: "#D9DDD4", input: "#C9CEC2", ring: "#2F5D8A",
  primary: "#2F5D8A", "primary-foreground": "#FFFFFF",
  accent: "#E2ECF4", "accent-foreground": "#1B242B",
  "present-ink": "#227346", "present-fill": "#2E9B5F", "present-soft": "#E2F2E8",
  "late-ink": "#7E5D08", "late-fill": "#AD7F0C", "late-soft": "#F9EED3",
  "absent-ink": "#B5432E", "absent-fill": "#B5432E", "absent-soft": "#F8E9E4",
  "excused-ink": "#5A6670", "excused-fill": "#5A6670", "excused-soft": "#E7EAE3",
};
const DARK = {
  background: "#11181D", foreground: "#E9ECE6",
  card: "#182027", "card-foreground": "#E9ECE6",
  popover: "#1C262E", "popover-foreground": "#E9ECE6",
  muted: "#222D36", "muted-foreground": "#93A0AA",
  border: "#2B3742", input: "#3A4854", ring: "#6FA3D8",
  primary: "#6FA3D8", "primary-foreground": "#0E1A24",
  accent: "#22313D", "accent-foreground": "#E9ECE6",
  "present-ink": "#4CC283", "present-fill": "#4CC283", "present-soft": "#173326",
  "late-ink": "#E8B93E", "late-fill": "#E8B93E", "late-soft": "#33290F",
  "absent-ink": "#E0705A", "absent-fill": "#E0705A", "absent-soft": "#3A211C",
  "excused-ink": "#93A0AA", "excused-fill": "#93A0AA", "excused-soft": "#222D36",
};

function check(theme, name, required) {
  console.log(`\n=== ${name} (oklch) ===`);
  for (const [k, v] of Object.entries(theme)) console.log(`--color-${k}: ${hexToOklch(v)}  /* ${v} */`);
  console.log(`\n--- ${name} contrast pairs ---`);
  let fails = 0;
  for (const [label, fg, bg, min] of required) {
    const c = contrast(theme[fg], theme[bg]);
    const ok = c >= min;
    if (!ok) fails++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.toFixed(2)}:1 (need ${min})  ${fg} on ${bg}  [${label}]`);
  }
  return fails;
}

const statusPairs = (t) => [
  ["present text on card", "present-ink", "card", 4.5],
  ["present text on bg", "present-ink", "background", 4.5],
  ["present text on its chip", "present-ink", "present-soft", 4.5],
  ["late text on card", "late-ink", "card", 4.5],
  ["late text on bg", "late-ink", "background", 4.5],
  ["late text on its chip", "late-ink", "late-soft", 4.5],
  ["absent text on card", "absent-ink", "card", 4.5],
  ["absent text on bg", "absent-ink", "background", 4.5],
  ["absent text on its chip", "absent-ink", "absent-soft", 4.5],
  ["excused text on card", "excused-ink", "card", 4.5],
  ["excused text on bg", "excused-ink", "background", 4.5],
  ["excused text on its chip", "excused-ink", "excused-soft", 4.5],
  ["present fill vs bg (3:1)", "present-fill", "background", 3],
  ["late fill vs bg (3:1)", "late-fill", "background", 3],
  ["absent fill vs bg (3:1)", "absent-fill", "background", 3],
];
const lightPairs = [
  ["body text", "foreground", "background", 4.5],
  ["card text", "card-foreground", "card", 4.5],
  ["popover text", "popover-foreground", "popover", 4.5],
  ["muted text on bg", "muted-foreground", "background", 4.5],
  ["muted text on card", "muted-foreground", "card", 4.5],
  ["muted text on muted", "muted-foreground", "muted", 4.5],
  ["text on accent", "foreground", "accent", 4.5],
  ["primary button", "primary-foreground", "primary", 4.5],
  ["ring on bg (UI 3:1)", "ring", "background", 3],
  ["border on card (UI 1.15)", "border", "card", 1.15],
  ...statusPairs(LIGHT),
];
const darkPairs = [
  ["body text", "foreground", "background", 4.5],
  ["card text", "card-foreground", "card", 4.5],
  ["popover text", "popover-foreground", "popover", 4.5],
  ["muted text on bg", "muted-foreground", "background", 4.5],
  ["muted text on card", "muted-foreground", "card", 4.5],
  ["muted text on muted", "muted-foreground", "muted", 4.5],
  ["text on accent", "accent-foreground", "accent", 4.5],
  ["primary button", "primary-foreground", "primary", 4.5],
  ["ring on bg (UI 3:1)", "ring", "background", 3],
  ["border on card (UI 1.15)", "border", "card", 1.15],
  ...statusPairs(DARK),
];

const fails = check(LIGHT, "LIGHT", lightPairs) + check(DARK, "DARK", darkPairs);
console.log(fails ? `\n${fails} FAILING PAIR(S)` : "\nAll pairs pass.");
process.exit(fails ? 1 : 0);
