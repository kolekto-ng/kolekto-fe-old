/* global self, clients */

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      title: "Kolekto update",
      body: event.data ? event.data.text() : "You have a new update.",
    };
  }

  const title = payload.title || "Kolekto update";
  const options = {
    body: payload.body || "You have a new update.",
    icon: payload.icon || "/kelekto_logo-removebg-preview.png",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || payload.type || "kolekto-update",
    renotify: Boolean(payload.renotify),
    data: {
      url: payload.url || "/dashboard",
      type: payload.type || "info",
      id: payload.id || null,
      collectionId: payload.collectionId || null,
      contributionId: payload.contributionId || null,
      transactionReference: payload.transactionReference || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

function getSafeNotificationUrl(rawUrl) {
  const fallback = new URL("/dashboard", self.location.origin);

  try {
    const targetUrl = new URL(rawUrl || "/dashboard", self.location.origin);

    if (targetUrl.origin !== self.location.origin) {
      return fallback;
    }

    if (targetUrl.pathname === "/dashboard/wallet") {
      targetUrl.pathname = "/dashboard/transactions";
    }

    if (targetUrl.pathname === "/dashboard/profile") {
      targetUrl.pathname = "/dashboard/settings";
    }

    return targetUrl;
  } catch (error) {
    return fallback;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = getSafeNotificationUrl(event.notification.data?.url);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === targetUrl.origin && "focus" in client) {
          client.navigate(targetUrl.href);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl.href);
      }

      return undefined;
    })
  );
});
