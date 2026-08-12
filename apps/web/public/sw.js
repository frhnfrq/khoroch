const LEGACY_CACHE_PREFIX = "khoroch-shell-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((cacheName) => cacheName.startsWith(LEGACY_CACHE_PREFIX))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.registration.unregister()),
  );
});
