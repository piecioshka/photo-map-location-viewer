/// <reference lib="webworker" />
/**
 * Custom service worker: Workbox precaching (app shell, offline) plus a
 * Web Share Target handler — photos shared from the phone gallery are
 * POSTed here, parked in a cache and picked up by the page.
 */
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
void self.skipWaiting();
clientsClaim();

const SHARE_CACHE = "shared-photos";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/share-target") {
    return;
  }
  event.respondWith(
    (async () => {
      const formData = await event.request.formData();
      const files = formData
        .getAll("photos")
        .filter((entry): entry is File => entry instanceof File);
      const cache = await caches.open(SHARE_CACHE);
      await Promise.all(
        files.map((file, index) =>
          cache.put(
            `/shared-photo-${index}`,
            new Response(file, {
              headers: {
                "Content-Type": file.type || "image/jpeg",
                "X-File-Name": encodeURIComponent(file.name),
              },
            }),
          ),
        ),
      );
      return Response.redirect(`/?shared=${files.length}`, 303);
    })(),
  );
});
