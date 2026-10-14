import { z } from "zod";

export const scanSchema = z.object({
  token: z.string().min(10),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(100000).optional(),
  mocked: z.boolean().optional(),
  deviceId: z.string().min(8).max(128)
});

export const sessionCreateSchema = z.object({
  course_id: z.string().uuid(),
  duration_min: z.number().int().min(5).max(480).default(60),
  geofence_lat: z.number().min(-90).max(90).nullable().optional(),
  geofence_lng: z.number().min(-180).max(180).nullable().optional(),
  geofence_radius_m: z.number().int().min(0).max(5000).default(100),
  geofence_enabled: z.boolean().default(true)
});

export const onboardingSchema = z.object({
  full_name_ar: z.string().min(2),
  full_name_en: z.string().min(2),
  university_id: z.string().min(2).max(32),
  program_id: z.string().uuid(),
  level_id: z.string().uuid(),
  section_id: z.string().uuid(),
  level_year: z.number().int().min(1).max(12).optional(),
  section_group: z.string().min(1).max(32).optional(),
  phone: z.string().min(5).max(24)
});

export const manualMarkSchema = z.object({
  session_id: z.string().uuid(),
  student_id: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused"]).default("present"),
  reason: z.string().min(3).max(500)
});
