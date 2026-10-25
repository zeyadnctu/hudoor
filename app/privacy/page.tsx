import type { Metadata } from "next";
import { LegalDocument } from "@/components/hudoor/legal-document";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "سياسة الخصوصية — حضور",
  description: "كيف يجمع تطبيق حضور بياناتك ويحميها وما حقوقك."
};

export default function PrivacyPage() {
  return <LegalDocument doc={PRIVACY} kind="privacy" />;
}
