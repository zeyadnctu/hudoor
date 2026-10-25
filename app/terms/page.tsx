import type { Metadata } from "next";
import { LegalDocument } from "@/components/hudoor/legal-document";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "شروط الاستخدام — حضور",
  description: "شروط استخدام تطبيق حضور وقواعد الحضور والجهاز والاعتراضات."
};

export default function TermsPage() {
  return <LegalDocument doc={TERMS} kind="terms" />;
}
