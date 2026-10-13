import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { RESOURCES } from "@/lib/resources";

export const dynamic = "force-dynamic";

function pickAllowed(def: (typeof RESOURCES)[string], body: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const f of def.fields) {
    if (f.readOnly) continue;
    if (body[f.key] === undefined) continue;
    const v = body[f.key];
    if (f.type === "number") {
      const n = v === "" || v === null ? null : Number(v);
      if (v !== "" && v !== null && !Number.isFinite(n)) throw new Error(`bad_${f.key}`);
      out[f.key] = n;
    } else if (f.type === "boolean") {
      out[f.key] = v === true || v === "true";
    } else if (f.type === "uuid") {
      if (v !== "" && v !== null) {
        if (!/^[0-9a-f-]{36}$/i.test(String(v))) throw new Error(`bad_${f.key}`);
        out[f.key] = v;
      } else out[f.key] = null;
    } else {
      out[f.key] = (v === "" ? null : v);
    }
  }
  for (const f of def.fields) {
    if (f.required && (out[f.key] === null || out[f.key] === undefined))
      throw new Error(`missing_${f.key}`);
  }
  return out;
}

/** GET /api/console/[resource]?page&perPage&search&sort&order&f_<field>= */
export async function GET(req: NextRequest, { params }: { params: { resource: string } }) {
  const def = RESOURCES[params.resource];
  if (!def) return NextResponse.json({ error: "unknown_resource" }, { status: 404 });
  const gate = await requirePerm(req, params.resource, "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const perPage = Math.min(500, Math.max(1, Number(q.get("perPage") ?? 25)));
  const search = (q.get("search") ?? "").trim();
  const sort = q.get("sort") || def.defaultSort;
  const asc = (q.get("order") ?? "asc") === "asc";

  let query = svc.from(def.table).select("*", { count: "exact" });
  if (def.softDelete) query = query.is("deleted_at", null);
  for (const [k, v] of q.entries()) {
    if (k.startsWith("f_") && v) query = query.eq(k.slice(2), v);
  }
  if (search) {
    const ors = def.searchCols.map(c => `${c}.ilike.%${search.replace(/[%_]/g, "")}%`).join(",");
    query = query.or(ors);
  }
  query = query.order(sort, { ascending: asc }).range((page - 1) * perPage, page * perPage - 1);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pk = def.pk ?? "id";
  const rows = ((data ?? []) as any[]).map(r => ({ ...r, id: r[pk] ?? r.id }));
  return NextResponse.json({ rows, total: count ?? 0, page, perPage });
}

/** POST /api/console/[resource] — create (validated against registry). */
export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  const def = RESOURCES[params.resource];
  if (!def) return NextResponse.json({ error: "unknown_resource" }, { status: 404 });
  const gate = await requirePerm(req, params.resource, "create");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  let values: Record<string, any>;
  try {
    values = pickAllowed(def, await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  const { data, error } = await svc.from(def.table).insert(values).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, `${params.resource}.create`, def.table, String(data[def.pk ?? "id"] ?? data.id), null, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: { ...data, id: data[def.pk ?? "id"] ?? data.id } });
}

/** PATCH — update with before/after audit. DELETE — soft delete (or ?purge=1). */
export async function PATCH(req: NextRequest, { params }: { params: { resource: string } }) {
  const def = RESOURCES[params.resource];
  if (!def) return NextResponse.json({ error: "unknown_resource" }, { status: 404 });
  const gate = await requirePerm(req, params.resource, "edit");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  let values: Record<string, any>;
  try {
    values = pickAllowed(def, rest);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  const { data: before } = await svc.from(def.table).select("*").eq(def.pk ?? "id", id).single();
  const { data, error } = await svc.from(def.table).update(values).eq(def.pk ?? "id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, `${params.resource}.edit`, def.table, id, before, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { resource: string } }) {
  const def = RESOURCES[params.resource];
  if (!def) return NextResponse.json({ error: "unknown_resource" }, { status: 404 });
  const gate = await requirePerm(req, params.resource, "delete");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
  if (!ids.length) return NextResponse.json({ error: "missing_ids" }, { status: 400 });
  const purge = new URL(req.url).searchParams.get("purge") === "1" || body.purge === true;
  if (purge && !def.softDelete) {
    const { error } = await svc.from(def.table).delete().in(def.pk ?? "id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, gate.ctx.profile.id, `${params.resource}.purge`, def.table, ids.join(","), { ids }, null, { purge: true }, gate.ctx);
    return NextResponse.json({ ok: true, purged: ids });
  }
  if (!def.softDelete) {
    const { error } = await svc.from(def.table).delete().in(def.pk ?? "id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, gate.ctx.profile.id, `${params.resource}.delete`, def.table, ids.join(","), { ids }, null, {}, gate.ctx);
    return NextResponse.json({ ok: true, deleted: ids });
  }
  const { data: before } = await svc.from(def.table).select(def.pk ?? "id").in(def.pk ?? "id", ids);
  const { error } = await svc.from(def.table).update({ deleted_at: new Date().toISOString() }).in(def.pk ?? "id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, `${params.resource}.delete`, def.table, ids.join(","), before, { deleted_at: true }, { soft: true }, gate.ctx);
  return NextResponse.json({ ok: true, deleted: ids });
}
