"use client";
import { useApp } from "@/components/providers";
import { CrudPage } from "@/components/console/CrudPage";

export default function SemestersPage() {
  const { t } = useApp();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.semesters}</h1>
      <div className="mt-4">
        <CrudPage
          resource="semesters"
          columns={[
            { key: "name", label: "Name", sortable: true },
            { key: "starts_at", label: t.from },
            { key: "ends_at", label: t.to },
            { key: "is_current", label: "Current", render: r => (r.is_current ? "●" : "—") }
          ]}
          impactFor={rows => `Delete ${rows.length} semester(s)? Courses, slots and generated sessions linked to them will be removed by cascade.`}
        />
      </div>
      <div className="mt-8 border-t-2 border-ink/15 pt-5 dark:border-white/20">
        <h2 className="font-display text-xl font-bold">{t.holidays} / {t.examWeeks}</h2>
        <p className="text-sm text-neutral-500">No sessions generate on these days.</p>
        <div className="mt-3">
          <CrudPage
            resource="academic_blocks"
            columns={[
              { key: "name_ar", label: "Name (AR)", sortable: true },
              { key: "kind", label: "Kind" },
              { key: "starts_at", label: t.from },
              { key: "ends_at", label: t.to }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
