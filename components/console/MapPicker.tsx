"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

// Dependency-free OSM slippy-map picker with a draggable pin.
// Tiles: tile.openstreetmap.org (graceful fallback box if offline).
const TILE = "https://tile.openstreetmap.org";

function lonToX(lon: number, z: number) { return ((lon + 180) / 360) * 2 ** z; }
function latToY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}
function xToLon(x: number, z: number) { return (x / 2 ** z) * 360 - 180; }
function yToLat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return ((180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
}

/** Draggable-pin geofence picker. Radius circle preview in screen px. */
export function MapPicker({
  lat, lng, radiusM, onChange
}: {
  lat: number | null; lng: number | null; radiusM: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(16);
  const [cLat, setCLat] = useState(lat ?? 30.0444); // Cairo fallback
  const [cLng, setCLng] = useState(lng ?? 31.2357);
  const [size, setSize] = useState({ w: 600, h: 320 });
  const [failed, setFailed] = useState(false);
  const dragPin = useRef(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (lat != null) setCLat(lat); if (lng != null) setCLng(lng); }, [lat, lng]);

  const cx = lonToX(cLng, z), cy = latToY(cLat, z);
  const tiles: { x: number; y: number }[] = [];
  const nx = Math.ceil(size.w / 256) + 1, ny = Math.ceil(size.h / 256) + 1;
  const x0 = Math.floor(cx - nx / 2), y0 = Math.floor(cy - ny / 2);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) tiles.push({ x: x0 + i, y: y0 + j });
  const ox = x0 * 256 - (cx * 256 - size.w / 2);
  const oy = y0 * 256 - (cy * 256 - size.h / 2);

  const pin = lat != null && lng != null
    ? { x: lonToX(lng, z) * 256 - cx * 256 + size.w / 2, y: latToY(lat, z) * 256 - cy * 256 + size.h / 2 }
    : null;
  const metersPerPx = (156543.03 * Math.cos((cLat * Math.PI) / 180)) / 2 ** z;
  const radiusPx = Math.max(8, radiusM / Math.max(1, metersPerPx));

  const toLatLng = useCallback((px: number, py: number) => {
    const wx = (px + cx * 256 - size.w / 2) / 256;
    const wy = (py + cy * 256 - size.h / 2) / 256;
    return { la: yToLat(wy, z), lo: xToLon(wx, z) };
  }, [cx, cy, size, z]);

  function onPointer(e: { clientX: number; clientY: number }, pan: boolean) {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (dragPin.current || !pan) {
      const { la, lo } = toLatLng(px, py);
      onChange(Number(la.toFixed(6)), Number(lo.toFixed(6)));
      dragPin.current = false;
      return;
    }
    // pan: recenter
    const { la, lo } = toLatLng(px, py);
    setCLat(la); setCLng(lo);
  }

  return (
    <div>
      <div
        ref={boxRef}
        className="relative h-80 w-full touch-none overflow-hidden rounded-md2 border-2 border-black/15 select-none dark:border-white/20"
        style={{ background: "#e8e4d8" }}
        onDoubleClick={e => onPointer(e, false)}
        role="application"
        aria-label="Map: double-click to place the pin, drag the pin to move it"
      >
        {!failed && tiles.map(t => (
          <img
            key={`${t.x}-${t.y}-${z}`}
            src={`${TILE}/${z}/${t.x}/${t.y}.png`}
            alt="" draggable={false}
            onError={() => setFailed(true)}
            className="pointer-events-none absolute h-64 w-64"
            style={{ left: t.x * 256 - x0 * 256 + ox, top: t.y * 256 - y0 * 256 + oy, width: 256, height: 256 }}
          />
        ))}
        {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-neutral-500">Map tiles unavailable offline — enter coordinates manually below.</p>}
        {/* radius preview */}
        {pin && (
          <div className="pointer-events-none absolute rounded-full border-2 border-register bg-register/15" style={{ width: radiusPx * 2, height: radiusPx * 2, left: pin.x - radiusPx, top: pin.y - radiusPx }} />
        )}
        {/* crosshair pan layer */}
        <div className="absolute inset-0" onClick={e => onPointer(e, true)} />
        {pin && (
          <button
            aria-label="Drag pin"
            className="absolute grid h-12 w-12 -translate-x-1/2 -translate-y-full cursor-grab place-items-center text-brick active:cursor-grabbing"
            style={{ left: pin.x, top: pin.y }}
            onPointerDown={() => { dragPin.current = true; }}
            onPointerMove={e => { if (dragPin.current && e.buttons) onPointer(e, false); }}
            onPointerUp={() => { dragPin.current = false; }}
          >
            <MapPin size={40} strokeWidth={2} fill="currentColor" className="text-brick" />
          </button>
        )}
        <div className="absolute bottom-2 end-2 flex gap-1">
          <button onClick={() => setZ(v => Math.min(19, v + 1))} aria-label="Zoom in" className="grid h-11 w-11 place-items-center rounded-md2 border bg-paper text-xl font-bold">+</button>
          <button onClick={() => setZ(v => Math.max(3, v - 1))} aria-label="Zoom out" className="grid h-11 w-11 place-items-center rounded-md2 border bg-paper text-xl font-bold">−</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Double-click to place · drag the pin · click empty map to pan · radius preview follows the meter setting</p>
    </div>
  );
}
