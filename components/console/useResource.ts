"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Query = {
  page: number; perPage: number; search: string;
  sort: string; order: "asc" | "desc";
  filters: Record<string, string>;
};

/** Server-side list + optimistic mutations with rollback.
 *  Subscribes to realtime updates; when another actor edits the same row,
 *  surfaces a merge/refresh prompt instead of silently overwriting. */
export function useResource<T extends { id: string; updated_at?: string }>(resource: string, initialQuery?: Partial<Query>) {
  const [q, setQ] = useState<Query>({
    page: 1, perPage: 25, search: "",
    sort: "", order: "asc", filters: {}, ...initialQuery
  });
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState<string | null>(null); // "edited by X" notice
  const [error, setError] = useState("");
  const timer = useRef<any>(null);

  const fetchRows = useCallback(async (qq: Query) => {
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams({
        page: String(qq.page), perPage: String(qq.perPage),
        search: qq.search, sort: qq.sort, order: qq.order
      });
      for (const [k, v] of Object.entries(qq.filters)) if (v) p.set(`f_${k}`, v);
      const r = await fetch(`/api/console/${resource}?${p}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `http_${r.status}`);
      setRows(j.rows ?? []);
      setTotal(j.total ?? 0);
      setStale(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchRows(q), q.search ? 350 : 0);
    return () => clearTimeout(timer.current);
  }, [q, fetchRows]);

  async function mutate(
    method: string, body: any, optimistic?: (prev: T[]) => T[]
  ): Promise<{ ok: boolean; error?: string; row?: T }> {
    const prev = rows;
    if (optimistic) setRows(optimistic(prev));
    try {
      const r = await fetch(`/api/console/${resource}`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `http_${r.status}`);
      await fetchRows(q);
      return { ok: true, row: j.row };
    } catch (e: any) {
      setRows(prev); // rollback
      return { ok: false, error: e.message };
    }
  }

  const create = (values: Record<string, any>) =>
    mutate("POST", values, prev => [{ ...values, id: `tmp-${Date.now()}` } as T, ...prev]);
  const update = (id: string, values: Record<string, any>) =>
    mutate("PATCH", { id, ...values }, prev => prev.map(r => r.id === id ? { ...r, ...values } : r));
  const remove = (ids: string[], purge = false) =>
    mutate("DELETE", { ids, purge }, prev => prev.filter(r => !ids.includes(r.id)));

  /** Realtime hook: call with the changed row + actor label. */
  function remoteEdit(row: T, actor: string) {
    setRows(prev => {
      if (!prev.some(r => r.id === row.id)) return prev;
      setStale(`${actor} edited this list — refresh to merge`);
      return prev;
    });
  }

  return {
    q, setQ, rows, total, loading, error, stale,
    refresh: () => fetchRows(q),
    create, update, remove, remoteEdit, setRows
  };
}
