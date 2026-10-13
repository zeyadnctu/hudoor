export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function clientIp(req: Request): string {
  const h = (n: string) => req.headers.get(n);
  const fwd = h("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h("x-real-ip") ?? "unknown";
}

/** Campus IP allowlist: exact IPs, "prefix." forms, or CIDR (/8../24../32).
 *  Empty/unset rule = allow all (setting is opt-in). */
export function ipAllowed(ip: string, rule: unknown): boolean {
  if (!rule) return true;
  const list = (Array.isArray(rule) ? rule : String(rule).split(/[\n,;]+/))
    .map(s => String(s).trim()).filter(Boolean);
  if (!list.length) return true;
  const oct = ip.split(".");
  for (const r of list) {
    if (r.includes("/")) {
      const [base, bitsStr] = r.split("/");
      const bits = Number(bitsStr);
      const b = base.split(".");
      if (b.length !== 4 || oct.length !== 4 || !Number.isFinite(bits)) continue;
      const full = Math.floor(bits / 8);
      const rest = bits % 8;
      let ok = true;
      for (let i = 0; i < full && i < 4; i++) if (b[i] !== oct[i]) { ok = false; break; }
      if (ok && rest > 0 && full < 4) {
        const mask = 256 - 2 ** (8 - rest);
        if ((Number(oct[full]) & mask) !== (Number(b[full]) & mask)) ok = false;
      }
      if (ok) return true;
      continue;
    }
    if (ip === r) return true;
    if (r.endsWith(".") && ip.startsWith(r)) return true;
  }
  return false;
}
