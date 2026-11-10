// Eski adres (dnz-bakkal.web.app) için "kendini silen" service worker.
// Telefona kurulu eski uygulama güncelleme kontrolünde bunu indirir: önbelleği siler,
// kendini kaldırır ve açık pencereyi yeniler → yönlendirme sayfası yeni adrese götürür.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      for (const w of windows) w.navigate(w.url);
    })(),
  );
});
