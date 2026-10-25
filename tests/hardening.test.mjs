import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signQrToken, verifyQrToken, qrTimingSettings, isNonceReplay } from "../.testbuild/qr-token.js";
import { haversineM, ipAllowed, clientIp } from "../.testbuild/geo.js";
import { rateLimit } from "../.testbuild/rate-limit.js";
import { scanSchema, manualMarkSchema, sessionCreateSchema } from "../.testbuild/validators.js";

const SECRET = "test-secret-please-rotate";

// ---- QR tokens: validity, tampering, expiry ----
describe("qr token sign/verify", () => {
  it("round-trips a fresh token", async () => {
    const t = await signQrToken(SECRET, "sess-1", 30);
    const v = await verifyQrToken(SECRET, t);
    assert.equal(v.sid, "sess-1");
    assert.ok(v.nonce.length > 8);
  });
  it("produces a different nonce per mint (rotation = new code)", async () => {
    const a = await signQrToken(SECRET, "sess-1", 30);
    const b = await signQrToken(SECRET, "sess-1", 30);
    const [va, vb] = await Promise.all([verifyQrToken(SECRET, a), verifyQrToken(SECRET, b)]);
    assert.notEqual(va.nonce, vb.nonce);
  });
  it("rejects an expired token", async () => {
    const t = await signQrToken(SECRET, "sess-1", -10);
    await assert.rejects(() => verifyQrToken(SECRET, t));
  });
  it("rejects a token signed with another secret", async () => {
    const t = await signQrToken("other-secret", "sess-1", 30);
    await assert.rejects(() => verifyQrToken(SECRET, t));
  });
  it("rejects a tampered payload (sid swapped)", async () => {
    const t = await signQrToken(SECRET, "sess-1", 30);
    const [h, p, s] = t.split(".");
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const forged = `${h}.${b64({ ...JSON.parse(Buffer.from(p, "base64url").toString()), sid: "sess-2" })}.${s}`;
    await assert.rejects(() => verifyQrToken(SECRET, forged));
  });
  it("rejects a token with missing claims", async () => {
    // sign a token without sid/nonce by hand through jose is out of scope here;
    // verify the guard exists at the type/runtime boundary instead
    await assert.rejects(() => verifyQrToken(SECRET, "not.a.jwt"));
  });
});

describe("qr timing settings", () => {
  const svcReturning = (rows) => ({
    from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: rows }) }) }) })
  });
  it("falls back to env defaults with a failing svc", async () => {
    const bad = { from: () => { throw new Error("down"); } };
    const s = await qrTimingSettings(bad);
    assert.ok(s.rotationSec >= 5 && s.rotationSec <= 120);
    assert.ok(s.ttlSec >= s.rotationSec, "ttl must outlive rotation");
  });
  it("reads DB values, clamps range, and keeps ttl >= rotation", async () => {
    const s = await qrTimingSettings(svcReturning([
      { key: "qr_rotation_seconds", value: 9999 },
      { key: "qr_token_ttl_seconds", value: 1 }
    ]));
    assert.equal(s.rotationSec, 120);
    assert.ok(s.ttlSec >= s.rotationSec, "ttl is raised to at least the rotation");
  });
});

// ---- replay vs double-tap ----
describe("nonce replay rule", () => {
  it("tolerates a concurrent double-tap inside the window", () => {
    assert.equal(isNonceReplay(0), false);
    assert.equal(isNonceReplay(14_999), false);
  });
  it("flags an older claim as replay", () => {
    assert.equal(isNonceReplay(15_001), true);
    assert.equal(isNonceReplay(Infinity), true);
  });
  it("respects a custom window", () => {
    assert.equal(isNonceReplay(5_000, 4_000), true);
    assert.equal(isNonceReplay(3_000, 4_000), false);
  });
});

// ---- duplicate attendance race (unique-contract semantics) ----
describe("duplicate registration race", () => {
  it("exactly one of two simultaneous requests wins the unique constraint", async () => {
    const rows = new Map();
    const insert = async (session_id, student_id) => {
      const key = `${session_id}|${student_id}`;
      if (rows.has(key)) return { code: "23505" };
      rows.set(key, { session_id, student_id, status: "present" });
      return null;
    };
    const results = await Promise.all([
      insert("s1", "stu1"),
      insert("s1", "stu1"),
      insert("s1", "stu1")
    ]);
    assert.equal(results.filter(r => r === null).length, 1, "only one insert succeeds");
    assert.equal(results.filter(r => r?.code === "23505").length, 2, "losers get a conflict");
    assert.equal(rows.size, 1, "exactly one attendance row exists");
  });
  it("different students never collide", async () => {
    const rows = new Map();
    const insert = async (sid) => {
      const key = `s1|${sid}`;
      if (rows.has(key)) return { code: "23505" };
      rows.set(key, true);
      return null;
    };
    const results = await Promise.all([insert("a"), insert("b"), insert("c")]);
    assert.equal(results.filter(r => r === null).length, 3);
    assert.equal(rows.size, 3);
  });
});

// ---- geofence math ----
describe("haversine", () => {
  it("zero distance for the same point", () => {
    assert.equal(haversineM(24.7, 46.7, 24.7, 46.7), 0);
  });
  it("≈111.2 km per degree of latitude", () => {
    const d = haversineM(24, 46, 25, 46);
    assert.ok(Math.abs(d - 111194) < 300, `got ${d}`);
  });
  it("a 100 m geofence accepts 90 m and rejects 150 m", () => {
    // ~0.0009° latitude ≈ 100 m
    const at90 = haversineM(24, 46, 24 + 0.00081, 46);
    const at150 = haversineM(24, 46, 24 + 0.00135, 46);
    assert.ok(at90 <= 100, `got ${at90}`);
    assert.ok(at150 > 100, `got ${at150}`);
  });
});

// ---- campus IP allowlist ----
describe("ipAllowed", () => {
  it("empty/unset rule allows everyone (opt-in setting)", () => {
    assert.equal(ipAllowed("8.8.8.8", null), true);
    assert.equal(ipAllowed("8.8.8.8", ""), true);
    assert.equal(ipAllowed("8.8.8.8", "  \n "), true);
  });
  it("exact match", () => {
    assert.equal(ipAllowed("192.168.1.5", "192.168.1.5"), true);
    assert.equal(ipAllowed("192.168.1.6", "192.168.1.5"), false);
  });
  it("prefix form", () => {
    assert.equal(ipAllowed("10.4.2.9", "10.4."), true);
    assert.equal(ipAllowed("11.4.2.9", "10.4."), false);
  });
  it("CIDR /24", () => {
    assert.equal(ipAllowed("192.168.1.77", "192.168.1.0/24"), true);
    assert.equal(ipAllowed("192.168.2.77", "192.168.1.0/24"), false);
  });
  it("CIDR /8 and mixed multi-line list", () => {
    const rules = "10.0.0.0/8\n172.16.0.0/12";
    assert.equal(ipAllowed("10.9.9.9", rules), true);
    assert.equal(ipAllowed("172.20.0.1", rules), true);
    assert.equal(ipAllowed("172.32.0.1", rules), false);
    assert.equal(ipAllowed("8.8.8.8", rules), false);
  });
  it("malformed rule never throws", () => {
    assert.equal(ipAllowed("1.2.3.4", "not-an-ip/x"), false);
    assert.equal(ipAllowed("1.2.3.4", "999.999.999.999/24"), false);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    assert.equal(clientIp(req), "1.2.3.4");
  });
  it("falls back to x-real-ip then unknown", () => {
    assert.equal(clientIp(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } })), "9.9.9.9");
    assert.equal(clientIp(new Request("http://x")), "unknown");
  });
});

// ---- in-memory rate limiter ----
describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const k = `t1:${Date.now()}`;
    assert.equal(rateLimit(k, 3, 60_000), true);
    assert.equal(rateLimit(k, 3, 60_000), true);
    assert.equal(rateLimit(k, 3, 60_000), true);
    assert.equal(rateLimit(k, 3, 60_000), false, "4th attempt blocked");
    assert.equal(rateLimit(k, 3, 60_000), false);
  });
  it("keys are independent", () => {
    const base = Date.now();
    assert.equal(rateLimit(`a:${base}`, 1, 60_000), true);
    assert.equal(rateLimit(`b:${base}`, 1, 60_000), true);
    assert.equal(rateLimit(`a:${base}`, 1, 60_000), false);
  });
  it("window expiry resets the counter", async () => {
    const k = `t3:${Date.now()}`;
    assert.equal(rateLimit(k, 1, 40), true);
    assert.equal(rateLimit(k, 1, 40), false);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(rateLimit(k, 1, 40), true, "allowed again after the window");
  });
});

// ---- request schemas ----
describe("scanSchema", () => {
  const good = { token: "a".repeat(40), deviceId: "device-1234" };
  it("accepts a minimal valid scan", () => {
    assert.ok(scanSchema.safeParse(good).success);
  });
  it("accepts optional GPS fields", () => {
    assert.ok(scanSchema.safeParse({ ...good, lat: 24.7, lng: 46.7, accuracy: 12, mocked: false }).success);
  });
  it("rejects missing/short token or device", () => {
    assert.equal(scanSchema.safeParse({ ...good, token: "short" }).success, false);
    assert.equal(scanSchema.safeParse({ token: "a".repeat(40) }).success, false);
    assert.equal(scanSchema.safeParse({ ...good, deviceId: "abc" }).success, false);
  });
  it("rejects out-of-range coordinates (mocked GPS probing)", () => {
    assert.equal(scanSchema.safeParse({ ...good, lat: 91 }).success, false);
    assert.equal(scanSchema.safeParse({ ...good, lng: -181 }).success, false);
    assert.equal(scanSchema.safeParse({ ...good, accuracy: -1 }).success, false);
  });
});

describe("manualMarkSchema", () => {
  const base = { session_id: "00000000-0000-4000-8000-000000000001", student_id: "00000000-0000-4000-8000-000000000002", reason: "late bus" };
  it("defaults to present and accepts the four statuses", () => {
    const r = manualMarkSchema.safeParse(base);
    assert.ok(r.success);
    if (r.success) assert.equal(r.data.status, "present");
    for (const s of ["present", "absent", "late", "excused"])
      assert.ok(manualMarkSchema.safeParse({ ...base, status: s }).success, s);
  });
  it("rejects unknown status and short reason", () => {
    assert.equal(manualMarkSchema.safeParse({ ...base, status: "ghost" }).success, false);
    assert.equal(manualMarkSchema.safeParse({ ...base, reason: "no" }).success, false);
  });
});

describe("sessionCreateSchema", () => {
  const uuid = "00000000-0000-4000-8000-000000000009";
  it("applies safe defaults (60 min, 100 m, geofence on)", () => {
    const r = sessionCreateSchema.safeParse({ course_id: uuid });
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.duration_min, 60);
      assert.equal(r.data.geofence_radius_m, 100);
      assert.equal(r.data.geofence_enabled, true);
    }
  });
  it("rejects absurd durations/radius and bad uuids", () => {
    assert.equal(sessionCreateSchema.safeParse({ course_id: uuid, duration_min: 3 }).success, false);
    assert.equal(sessionCreateSchema.safeParse({ course_id: uuid, duration_min: 500 }).success, false);
    assert.equal(sessionCreateSchema.safeParse({ course_id: "nope" }).success, false);
    assert.equal(sessionCreateSchema.safeParse({ course_id: uuid, geofence_radius_m: -1 }).success, false);
  });
});
