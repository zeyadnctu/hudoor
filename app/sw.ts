/// <reference lib="webworker" />
import {
  Serwist,
  NetworkFirst,
  StaleWhileRevalidate,
  CacheFirst,
  ExpirationPlugin,
  CacheableResponsePlugin,
  type RuntimeCaching,
  type PrecacheEntry,
  type SerwistGlobalConfig
} from "serwist";

/* Hudoor service worker (Serwist).
   - Precaches the Next build assets via the injected manifest.
   - Pages: network-first with a cache fallback so a flaky campus Wi-Fi
     still opens the app shell.
   - /api/* is never cached (attendance tokens rotate every few seconds).
   - Static assets/fonts: stale-while-revalidate / cache-first for a fast
     second visit. */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // injection point replaced at build time by @serwist/next
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const isSameOriginImage: RuntimeCaching["matcher"] = ({ url, request }) =>
  request.destination === "image" && url.origin === self.location.origin;

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ url, request }) =>
      request.mode === "navigate" && url.origin === self.location.origin,
    handler: new NetworkFirst({
      networkTimeoutSeconds: 4,
      cacheName: "hudoor-pages",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 7 * 24 * 3600 })
      ]
    })
  },
  {
    matcher: ({ url }) =>
      url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image"),
    handler: new StaleWhileRevalidate({
      cacheName: "hudoor-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 30 * 24 * 3600 })]
    })
  },
  {
    matcher: isSameOriginImage,
    handler: new StaleWhileRevalidate({
      cacheName: "hudoor-images",
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 7 * 24 * 3600 })]
    })
  },
  {
    matcher: ({ request }) => request.destination === "font",
    handler: new CacheFirst({
      cacheName: "hudoor-fonts",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 365 * 24 * 3600 })
      ]
    })
  }
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching
});

serwist.addEventListeners();

// Allow the page to clear caches (used on logout so a shared device
// doesn't serve another student's cached pages).
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string })?.type === "CLEAR_CACHE") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => {
        (event.source as Client | null)?.postMessage({ type: "CACHE_CLEARED" });
      });
  }
});
