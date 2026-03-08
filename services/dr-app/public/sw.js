self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("dr-app-shell-v1").then((cache) =>
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
        keys.map((key) => (key === "dr-app-shell-v1" ? null : caches.delete(key)))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request)
    )
  );
});
