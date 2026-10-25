import { z } from "zod";

export const scanSchema = z.object({
  token: z.string().min(10),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(100000).optional(),
  mocked: z.boolean().optional(),
  deviceId: z.string().min(8).max(128),
  /** Stable key for one logical attempt; retries reuse it. */
  idempotencyKey: z.string().min(8).max(100).optional()
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
  // required_error / invalid_type_error matter: RHF fields the user never
  // touched are `undefined`, and a bare z.string() would then emit zod's raw
  // "Required" even though the user did fill the OTHER name field. Every field
  // now always answers with a bilingual, field-specific message.
  full_name_ar: z.string({
    required_error: "اكتب اسمك الأول بالعربية / enter your Arabic name",
    invalid_type_error: "اكتب اسمك الأول بالعربية / enter your Arabic name"
  }).trim().min(2, { message: "اكتب اسمك الأول بالعربية (حرفان على الأقل) / enter your Arabic name (at least 2 characters)" }),
  full_name_en: z.string({
    required_error: "اكتب اسمك بالإنجليزية / enter your English name",
    invalid_type_error: "اكتب اسمك بالإنجليزية / enter your English name"
  }).trim().min(2, { message: "اكتب اسمك بالإنجليزية (حرفان على الأقل) / enter your English name (at least 2 characters)" }),
  university_id: z.string({
    required_error: "أدخل رقمك الجامعي / enter your university ID",
    invalid_type_error: "أدخل رقمك الجامعي / enter your university ID"
  }).trim().min(2, { message: "أدخل رقمك الجامعي / enter your university ID" }).max(32, { message: "الرقم الجامعي طويل جدًا / university ID is too long" }),
  program_id: z.string({
    required_error: "اختر البرنامج / pick a program",
    invalid_type_error: "اختر البرنامج / pick a program"
  }).uuid({ message: "اختر البرنامج / pick a program" }),
  level_id: z.string({
    required_error: "اختر المستوى / pick a level",
    invalid_type_error: "اختر المستوى / pick a level"
  }).uuid({ message: "اختر المستوى / pick a level" }),
  section_id: z.string({
    required_error: "اختر المجموعة / pick a group",
    invalid_type_error: "اختر المجموعة / pick a group"
  }).uuid({ message: "اختر المجموعة / pick a group" }),
  level_year: z.number().int().min(1).max(12).optional(),
  section_group: z.string().min(1).max(32).optional(),
  phone: z.string({
    required_error: "أدخل رقم الجوال / enter your phone number",
    invalid_type_error: "أدخل رقم الجوال / enter your phone number"
  }).trim().min(5, { message: "أدخل رقم جوال صحيح (5 أرقام على الأقل) / enter a valid phone number" }).max(24, { message: "رقم الجوال طويل جدًا / phone number is too long" })
});

export const manualMarkSchema = z.object({
  session_id: z.string().uuid(),
  student_id: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused"]).default("present"),
  reason: z.string().min(3).max(500)
});
