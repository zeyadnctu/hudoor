"use client";
const KEY = "hudoor_device_id";

export function getOrCreateDeviceId(): string {
  let id = "";
  try {
    const m = document.cookie.match(/(?:^|; )hudoor_did=([^;]+)/);
    if (m) id = decodeURIComponent(m[1]);
  } catch {}
  if (!id) {
    try {
      id = localStorage.getItem(KEY) ?? "";
    } catch {}
  }
  if (!id) {
    id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      localStorage.setItem(KEY, id);
      document.cookie = `hudoor_did=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      indexedDB.open("hudoor").onsuccess = (e: any) => {
        try {
          const db = e.target.result;
          if ([...db.objectStoreNames].includes("kv")) {
            const tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").put(id, "device_id");
          }
        } catch {}
      };
    } catch {}
  } else {
    try { document.cookie = `hudoor_did=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`; } catch {}
  }
  return id;
}

export function coarseUa(): string {
  const ua = navigator.userAgent;
  const mobile = /mobile|android|iphone|ipad/i.test(ua) ? "m" : "d";
  return `${mobile}|${ua.length}|${navigator.language}|${screen.width}x${screen.height}`;
}
