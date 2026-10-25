import { z } from "zod";

export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  IMPERSONATION_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  QR_ROTATION_SECONDS: z.coerce.number().default(10),
  QR_TOKEN_TTL_SECONDS: z.coerce.number().default(15),
  GEOFENCE_DEFAULT_RADIUS_M: z.coerce.number().default(100),
});

// Optional fast-path secret: when set, middleware and API routes verify the
// session JWT locally instead of a network auth.getUser() on every call.
// Find it in Supabase dashboard → Project Settings → API → JWT Settings.
// When absent (or when the project uses asymmetric GoTrue keys) the app
// silently falls back to the slower network verification. Never crash boot
// because of it.
export function SUPABASE_JWT_SECRET(): string | null {
  const s = process.env.SUPABASE_JWT_SECRET;
  return s && s.length > 0 ? s : null;
}

export function validateEnv(): { ok: boolean; errors?: string[] } {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) return { ok: true };
  return { ok: false, errors: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) };
}

// Invoke at startup (best-effort, log only in dev to avoid crashing prod boot on optional vars)
if (process.env.NODE_ENV !== "production") {
  const r = validateEnv();
  if (!r.ok) console.warn("[env] validation issues:", r.errors);
}
