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
