"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase";

/** Partner programs first (unarchived), then regulars by code; archived last. */
export function orderPrograms<T extends { type?: string; code?: string; archived?: boolean }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
    if ((a.type ?? "") !== (b.type ?? "")) return a.type === "partner" ? -1 : 1;
    return (a.code ?? "").localeCompare(b.code ?? "");
  });
}

export type MyProgram = { programId: string | null; programs: any[]; isAdmin: boolean };

/** The caller's program scope: student's own program, coordinator's programs,
 *  professor's taught programs, or all (admin). Defaults filters to it. */
export function useMyProgram(): MyProgram {
  const [state, setState] = useState<MyProgram>({ programId: null, programs: [], isAdmin: false });
  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: p } = await sb.from("profiles").select("id,role").eq("id", user.id).maybeSingle();
      if (!p) return;
      if ((p as any).role === "admin") {
        const { data: all } = await sb.from("programs").select("id,code,name_ar,name_en,type,color,archived").eq("archived", false).order("code");
        setState({ programId: null, programs: orderPrograms((all ?? []) as any[]), isAdmin: true });
        return;
      }
      const ids = new Set<string>();
      const { data: det } = await sb.from("student_details").select("program_id").eq("user_id", user.id).maybeSingle();
      if ((det as any)?.program_id) ids.add((det as any).program_id);
      const { data: pa } = await sb.from("program_admins").select("program_id").eq("profile_id", user.id);
      for (const r of (pa ?? []) as any[]) if (r.program_id) ids.add(r.program_id);
      const { data: cpRows } = await sb.from("course_professors").select("course_id").eq("professor_id", user.id);
      const cids = ((cpRows ?? []) as any[]).map(r => r.course_id);
      let taughtPrograms: string[] = [];
      if (cids.length) {
        const { data: cs } = await sb.from("courses").select("program_id").in("id", cids);
        taughtPrograms = ((cs ?? []) as any[]).map(c => c.program_id).filter(Boolean);
        taughtPrograms.forEach(id => ids.add(id));
      }
      if (!ids.size) { setState(s => ({ ...s, programs: [] })); return; }
      const { data: progs } = await sb.from("programs").select("id,code,name_ar,name_en,type,color,archived").in("id", [...ids]).eq("archived", false);
      const ordered = orderPrograms((progs ?? []) as any[]);
      // default: own program, else first coordinator program, else first taught
      let def: string | null = (det as any)?.program_id ?? null;
      if (!def && (pa ?? []).length) def = (pa as any[])[0].program_id;
      if (!def && taughtPrograms.length) def = taughtPrograms[0];
      setState({ programId: def, programs: ordered, isAdmin: false });
    })();
  }, []);
  return state;
}
