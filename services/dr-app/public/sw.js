self.__DR_CACHE_VERSION__ = "v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(`dr-app-shell-${self.__DR_CACHE_VERSION__}`).then((cache) =>
      cache.addAll([
        "/",
        "/dashboard",
        "/login",
        "/register",
        "/manifest.webmanifest",
        "/dr-tree-192.png",
        "/dr-tree-512.png"
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) =>
          key === `dr-app-shell-${self.__DR_CACHE_VERSION__}` ? null : caches.delete(key)
        )
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    event.request.destination === "script" ||
    event.request.destination === "style" ||
    event.request.destination === "image"
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode !== "navigate") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
