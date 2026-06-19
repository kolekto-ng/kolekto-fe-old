self.addEventListener("activate", (event) => {
  const currentPrefixes = [
    "kolekto-pwa-v2",
    "kolekto-google-fonts-v2",
    "kolekto-images-v2",
  ];

  const legacyCacheNames = [
    "google-fonts-cache",
    "images-cache",
    "api-cache",
    "api-no-cache",
  ];

  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          const isCurrent = currentPrefixes.some((prefix) =>
            cacheName.includes(prefix)
          );
          const isLegacyRuntimeCache = legacyCacheNames.includes(cacheName);
          const isLegacyPrecache =
            cacheName.includes("workbox-precache") && !isCurrent;

          if (isLegacyRuntimeCache || isLegacyPrecache) {
            return caches.delete(cacheName);
          }

          return Promise.resolve(false);
        })
      )
    )
  );
});
