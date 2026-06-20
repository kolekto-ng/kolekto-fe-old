self.addEventListener("activate", (event) => {
  const currentPrefixes = [
    "kolekto-pwa-v4",
    "kolekto-google-fonts-v4",
    "kolekto-images-v4",
    "kolekto-pages-v4",
  ];

  const legacyCacheNames = [
    "google-fonts-cache",
    "images-cache",
    "kolekto-pages-v2",
    "kolekto-pages-v3",
    "kolekto-google-fonts-v3",
    "kolekto-images-v3",
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
