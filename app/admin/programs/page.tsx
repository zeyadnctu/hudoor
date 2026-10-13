"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Select, Label } from "@/components/ui";
import { CrudPage } from "@/components/console/CrudPage";

export default function ProgramsPage() {
  const { t } = useApp();
  const [programs, setPrograms] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [prog, setProg] = useState("");
  const [level, setLevel] = useState("");

  async function loadLists() {
    const [p, l] = await Promise.all([
      fetch("/api/console/programs?perPage=500").then(r => r.json()),
      fetch("/api/console/levels?perPage=500").then(r => r.json())
    ]);
    setPrograms(p.rows ?? []);
    setLevels(l.rows ?? []);
    if (!prog && (p.rows ?? [])[0]) setProg(p.rows[0].id);
  }
  useEffect(() => { loadLists(); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.programs}</h1>

      <div className="mt-4">
        <CrudPage
          resource="programs"
          columns={[
            { key: "code", label: "Code", sortable: true },
            { key: "name_ar", label: "Name (AR)", sortable: true },
            { key: "name_en", label: "Name (EN)" }
          ]}
        />
      </div>

      <div className="mt-8 border-t-2 border-ink/15 pt-5 dark:border-white/20">
        <h2 className="font-display text-xl font-bold">Levels & groups</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><Label>Program</Label>
            <Select value={prog} onChange={e => { setProg(e.target.value); setLevel(""); }}>
              <option value="">—</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name_ar}</option>)}
            </Select>
          </div>
          <div><Label>Level</Label>
            <Select value={level} onChange={e => setLevel(e.target.value)}>
              <option value="">—</option>
              {levels.filter(l => !prog || l.program_id === prog).map(l => <option key={l.id} value={l.id}>{l.name_ar}</option>)}
            </Select>
          </div>
        </div>
        {prog && (
          <div className="mt-3">
            <CrudPage
              key={`levels-${prog}`}
              resource="levels"
              filters={{ program_id: prog }}
              columns={[
                { key: "position", label: "Order", sortable: true },
                { key: "name_ar", label: "Name (AR)" },
                { key: "name_en", label: "Name (EN)" }
              ]}
              onNew={() => ({ program_id: prog, position: 0 })}
            />
          </div>
        )}
        {level && (
          <div className="mt-3">
            <CrudPage
              key={`groups-${level}`}
              resource="section_groups"
              filters={{ level_id: level }}
              columns={[{ key: "name", label: "Group", sortable: true }]}
              onNew={() => ({ level_id: level })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
