import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { onboardingSchema } from "../.testbuild/validators.js";

// Regression: the wizard showed zod's raw "Required" even after the user had
// typed a name — untouched RHF fields were `undefined`, and `.min(2)` alone
// never receives a custom message for that case.
const msgs = (value) => {
  const parsed = onboardingSchema.safeParse(value);
  assert.equal(parsed.success, false);
  return parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
};
const UUID = "e0000000-0000-0000-0000-000000000021";

describe("onboarding schema messages", () => {
  it("never emits a bare 'required' for undefined fields", () => {
    for (const { message } of msgs({})) {
      assert.doesNotMatch(message, /^required$/i);
      assert.match(message, /\/|\S/);
    }
  });

  it("names the Arabic field when only Arabic is missing", () => {
    const issues = msgs({
      full_name_en: "Ahmed", university_id: "4411", phone: "0500000000",
      program_id: UUID, level_id: UUID, section_id: UUID
    });
    assert.deepEqual(issues.map((i) => i.path), ["full_name_ar"]);
    assert.match(issues[0].message, /العربية/);
  });

  it("names the English field when only the Arabic name was typed", () => {
    const issues = msgs({
      full_name_ar: "أحمد", university_id: "4411", phone: "0500000000",
      program_id: UUID, level_id: UUID, section_id: UUID
    });
    assert.deepEqual(issues.map((i) => i.path), ["full_name_en"]);
    assert.match(issues[0].message, /English/);
  });

  it("uses field-specific messages for empty strings too", () => {
    const issues = msgs({
      full_name_ar: "", full_name_en: "", university_id: "", phone: "",
      program_id: "", level_id: "", section_id: ""
    });
    assert.equal(issues.length, 7);
    for (const { message } of issues) assert.doesNotMatch(message, /^required$/i);
    assert.match(issues.find((i) => i.path === "program_id").message, /البرنامج/);
    assert.match(issues.find((i) => i.path === "phone").message, /جوال/);
    assert.match(issues.find((i) => i.path === "full_name_en").message, /English/);
    assert.match(issues.find((i) => i.path === "full_name_ar").message, /العربية/);
  });

  it("accepts a complete profile", () => {
    const parsed = onboardingSchema.safeParse({
      full_name_ar: "أحمد", full_name_en: "Ahmed", university_id: "4411",
      phone: "0500000000", program_id: UUID, level_id: UUID, section_id: UUID
    });
    assert.equal(parsed.success, true, JSON.stringify(parsed.success ? {} : parsed.error.issues));
  });
});
