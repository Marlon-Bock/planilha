/* Service worker da Planilha Financeira.
 *
 * - /api e /sanctum: SEMPRE rede, nunca cache (dados financeiros privados).
 * - Arquivos estáticos do Next (/_next/static) e ícones: cache primeiro (são versionados).
 * - Páginas: rede primeiro; sem conexão, usa a última cópia ou a página /offline.
 */
const VERSION = "v2";
const STATIC_CACHE = `planilha-static-${VERSION}`;
const PAGES_CACHE = `planilha-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("planilha-") && ![STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// A página pede para ativar a nova versão imediatamente ("Atualizar agora").
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_PAGES") caches.delete(PAGES_CACHE);
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/sanctum/")) return; // só rede

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const res = await fetch(request);
    // Só guarda páginas finais (redirecionamentos de login não).
    if (res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}
