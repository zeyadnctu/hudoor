"use strict";
// Fuzzy name matching for timetable import (dependency-free, unit-tested).
// Normalized Dice coefficient over character bigrams + token overlap.
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = normalize;
exports.dice = dice;
exports.tokenOverlap = tokenOverlap;
exports.similarity = similarity;
exports.bestMatches = bestMatches;
function normalize(s) {
    return (s ?? "")
        .toLowerCase()
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}
function bigrams(s) {
    const t = `$${s}$`;
    const out = [];
    for (let i = 0; i < t.length - 1; i++)
        out.push(t.slice(i, i + 2));
    return out;
}
function dice(a, b) {
    const A = normalize(a), B = normalize(b);
    if (!A || !B)
        return 0;
    if (A === B)
        return 1;
    const ba = bigrams(A), bb = bigrams(B);
    const counts = new Map();
    for (const g of ba)
        counts.set(g, (counts.get(g) ?? 0) + 1);
    let hit = 0;
    for (const g of bb) {
        const c = counts.get(g) ?? 0;
        if (c > 0) {
            hit++;
            counts.set(g, c - 1);
        }
    }
    return (2 * hit) / (ba.length + bb.length);
}
function tokenOverlap(a, b) {
    const A = new Set(normalize(a).split(" ").filter(Boolean));
    const B = new Set(normalize(b).split(" ").filter(Boolean));
    if (!A.size || !B.size)
        return 0;
    let hit = 0;
    for (const t of A)
        if (B.has(t))
            hit++;
    return hit / Math.max(A.size, B.size);
}
/** Combined score 0..1 (bigrams carry spelling, tokens carry word order freedom). */
function similarity(a, b) {
    return Math.max(dice(a, b), tokenOverlap(a, b) * 0.95);
}
/** Best matches above threshold, sorted desc. `label` extracts the match text. */
function bestMatches(input, pool, label, threshold = 0.55, limit = 3) {
    return pool
        .map(item => ({ item, score: similarity(input, label(item)) }))
        .filter(c => c.score >= threshold)
        .sort((x, y) => y.score - x.score)
        .slice(0, limit);
}
