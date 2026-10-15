#!/usr/bin/env node
/**
 * scripts/bundle-budget.mjs
 *
 * Per-route bundle report + budget enforcement.
 *
 * Reads `.next/app-build-manifest.json` (written by `next build`), sums the
 * gzipped size of every JS file a route loads (that IS the First Load JS the
 * build reporter prints), writes `bundle-report.json`, and fails the process
 * if a budgeted route is over its cap.
 *
 * Budgets were set from the measured baseline with ~15% headroom, so an
 * accidental dependency import (an animation library on the scanner, a chart
 * lib on Today) fails CI immediately instead of quietly bloating the app.
 *
 * Usage:  node scripts/bundle-budget.mjs [--json]   (run after `next build`)
 * Exit:   0 = within budget, 1 = over budget or no build found.
 */
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const NEXT = join(ROOT, ".next");

// ---------------------------------------------------------------- budgets --
// Bytes (gzipped). Keyed by route; `note` explains what the route must keep out.
const BUDGETS = {
	"/student": {
		bytes: 280_000,
		note: "Today: no React Bits except the lazy announcements list, no chart libs.",
	},
	"/scan": {
		// Camera-scanner route: must stay lean (no React Bits, no motion).
		bytes: 160_000,
		note: "Present scanner: no React Bits, no motion, no heavy deps.",
	},
	"/student/scan-in-app": {
		// In-app scanner: the qr-scanner lib (~62 kB) is expected here.
		bytes: 230_000,
		note: "In-app scanner: qr-scanner only; no React Bits.",
	},
	"/student/timetable": {
		bytes: 250_000,
		note: "Timetable: WeekGrid + SegmentedControl only.",
	},
	"/onboarding": {
		bytes: 260_000,
		note: "Onboarding: Stepper + BlurText are the only bits.",
	},
};

// ------------------------------------------------------------------ utils --
/** @returns {Map<string, number>} absolute path -> gzipped byte size */
function gzipSizes(files) {
	const cache = new Map();
	for (const f of files) {
		const abs = join(NEXT, f);
		if (cache.has(abs)) continue;
		try {
			cache.set(abs, gzipSync(readFileSync(abs)).length);
		} catch {
			cache.set(abs, statSync(abs).size); // non-compressible fallback
		}
	}
	return cache;
}

const kb = (b) => `${(b / 1024).toFixed(1)} kB`;

// -------------------------------------------------------------------- run --
const manifestPath = join(NEXT, "app-build-manifest.json");
if (!existsSync(manifestPath)) {
	console.error(
		"✗ No .next/app-build-manifest.json — run `next build` first.",
	);
	process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pages = Object.entries(manifest.pages ?? {});
const sizes = gzipSizes(pages.flatMap(([, files]) => files));

// Shared chunk totals (imported by every route) — for the report only.
const sharedFiles = new Set(pages.flatMap(([, files]) => files));
let sharedBytes = 0;
for (const f of sharedFiles) sharedBytes += sizes.get(join(NEXT, f)) ?? 0;

/** Manifest keys are file-ish ("/student/page"); budgets are routes ("/student"). */
const routeKey = (k) => (k.endsWith("/page") ? k.slice(0, -"/page".length) || "/" : k);

const report = { generatedAt: new Date().toISOString(), sharedBytes, routes: {} };
let failed = false;

console.log(`\nHudoor bundle report (gzip) — shared chunks: ${kb(sharedBytes)}\n`);

for (const [route, files] of pages.sort()) {
	const total = files.reduce((n, f) => n + (sizes.get(join(NEXT, f)) ?? 0), 0);
	const key = routeKey(route);
	const budget = BUDGETS[key];
	report.routes[key] = {
		firstLoadBytes: total,
		fileCount: files.length,
		budgetBytes: budget?.bytes ?? null,
	};

	if (!budget) {
		console.log(`  ${key.padEnd(34)} ${kb(total).padStart(11)}  (no budget)`);
		continue;
	}
	const over = total > budget.bytes;
	if (over) failed = true;
	console.log(
		`  ${over ? "✗" : "✓"} ${key.padEnd(32)} ${kb(total).padStart(11)} / ${kb(budget.bytes).padStart(10)} budget${over ? "  — OVER BUDGET" : ""}`,
	);
	if (over) console.log(`      ${budget.note}`);
}

writeFileSync(join(ROOT, "bundle-report.json"), `${JSON.stringify(report, null, "\t")}\n`);

if (process.argv.includes("--json")) {
	console.log(JSON.stringify(report, null, "\t"));
}

if (failed) {
	console.error(
		"\n✗ Bundle budget exceeded. Trim the route (lazy-load the heavy import, " +
			"or move it to a component that isn't on the critical path) — see " +
			"docs/DESIGN_PLAN.md §6.",
	);
	process.exit(1);
}
console.log("\n✓ All budgeted routes within budget. Report: bundle-report.json");
