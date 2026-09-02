/* Marrakech Crew: app-shell and runtime cache. IndexedDB remains the data source. */
const CACHE = "marrakech-crew-v6";
const ROUTES = ["/", "/journal", "/alcoolemie", "/stats", "/hall-of-fame", "/challenges", "/recaps", "/join"];
const STATIC_SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

function staticAssetsFrom(html) {
  const matches = html.matchAll(/(?:src|href)=["']([^"']+)["']/g);
  return [...matches]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"))
    .map((url) => url.href);
}

async function precacheShell() {
  const cache = await caches.open(CACHE);
  await cache.addAll(STATIC_SHELL);
  const assets = new Set();
  await Promise.all(ROUTES.map(async (route) => {
    const response = await fetch(route, { cache: "reload", credentials: "same-origin" });
    if (!response.ok) throw new Error(`Impossible de précacher ${route} (${response.status})`);
    await cache.put(route, response.clone());
    for (const asset of staticAssetsFrom(await response.text())) assets.add(asset);
  }));
  await Promise.all([...assets].map((asset) => cache.add(asset)));
}

self.addEventListener("install", (event) => {
  // L’ancienne version reste active si un chunk du nouveau build ne peut pas être
  // téléchargé : on ne remplace jamais un cache utilisable par une coquille vide.
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      // Une page d'erreur de l'hébergeur (502 le temps d'un déploiement, 404) ne
      // doit jamais remplacer la coquille précachée : elle deviendrait la version
      // servie hors ligne pour cette route jusqu'au prochain passage en ligne.
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(url.pathname)) || (await caches.match("/"))));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok && (url.pathname.startsWith("/_next/static/") || ["style", "script", "font", "image"].includes(request.destination))) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  }));
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") void self.skipWaiting();
});
