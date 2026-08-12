"use client";

import { useEffect } from "react";

const LEGACY_CACHE_PREFIX = "khoroch-shell-";
const LEGACY_SERVICE_WORKER_PATH = "/sw.js";

async function removeLegacyServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;

  try {
    // Re-registering the same script forces existing installations to pick up the
    // self-removing worker in public/sw.js instead of continuing to intercept navigations.
    await navigator.serviceWorker.register(LEGACY_SERVICE_WORKER_PATH, {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    // If the update cannot be installed, unregister the legacy worker directly.
    await registration.unregister();
  }
}

async function removeLegacyCaches() {
  if (!("caches" in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(LEGACY_CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName)),
  );
}

export function ServiceWorkerCleanup() {
  useEffect(() => {
    void Promise.allSettled([removeLegacyServiceWorker(), removeLegacyCaches()]);
  }, []);

  return null;
}
