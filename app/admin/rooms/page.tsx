"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { CrudPage } from "@/components/console/CrudPage";
import { MapPicker } from "@/components/console/MapPicker";

function RoomDrawer({ row, close }: { row: any; close: () => void }) {
  const { t } = useApp();
  const [lat, setLat] = useState<number | null>(row.geofence_lat ?? null);
  const [lng, setLng] = useState<number | null>(row.geofence_lng ?? null);
  const [radius, setRadius] = useState(row.geofence_radius_m ?? 100);
  const [cap, setCap] = useState(row.capacity ?? 0);
  const [msg, setMsg] = useState("");
  async function save() {
    const r = await fetch("/api/console/rooms", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, geofence_lat: lat, geofence_lng: lng, geofence_radius_m: Number(radius), capacity: Number(cap) })
    });
    const j = await r.json();
    setMsg(r.ok ? `✓ ${t.createdOk}` : j.error);
  }
  return (
    <div>
      <h2 className="font-display text-xl font-bold" dir="auto">{row.name_ar}</h2>
      <p className="text-neutral-500" dir="auto">{row.name_en}</p>
      <div className="mt-3">
        <Label>{t.pickOnMap}</Label>
        <MapPicker lat={lat} lng={lng} radiusM={Number(radius) || 100} onChange={(a, o) => { setLat(a); setLng(o); }} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div><Label>Lat</Label><Input type="number" value={lat ?? ""} onChange={e => setLat(e.target.value === "" ? null : Number(e.target.value))} dir="ltr" /></div>
        <div><Label>Lng</Label><Input type="number" value={lng ?? ""} onChange={e => setLng(e.target.value === "" ? null : Number(e.target.value))} dir="ltr" /></div>
        <div><Label>Radius (m)</Label><Input type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} /></div>
        <div><Label>{t.capacity}</Label><Input type="number" value={cap} onChange={e => setCap(Number(e.target.value))} /></div>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
      <Button className="mt-3 w-full" onClick={save}>{t.save}</Button>
      <Button variant="outline" className="mt-2 w-full" onClick={close}>Close</Button>
    </div>
  );
}

export default function RoomsPage() {
  const { t } = useApp();
  const [tick, setTick] = useState(0);
  useEffect(() => { void tick; }, [tick]);
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.rooms}</h1>
      <div className="mt-4">
        <CrudPage
          resource="rooms"
          columns={[
            { key: "name_ar", label: "Name (AR)", sortable: true },
            { key: "name_en", label: "Name (EN)" },
            { key: "capacity", label: t.capacity, sortable: true },
            { key: "geofence_radius_m", label: "Radius" }
          ]}
          detail={(row, close) => <RoomDrawer row={row} close={close} />}
          impactFor={rows => `Delete ${rows.length} room(s)? Sessions linked to them keep running but lose their room.`}
        />
      </div>
      <div className="mt-8 border-t-2 border-ink/15 pt-5 dark:border-white/20">
        <h2 className="font-display text-xl font-bold">{t.buildings}</h2>
        <div className="mt-3">
          <CrudPage
            resource="buildings"
            columns={[
              { key: "name_ar", label: "Name (AR)", sortable: true },
              { key: "name_en", label: "Name (EN)" }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
