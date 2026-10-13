const CACHE_NAME = "comu-app-v3";
// Solo assets estáticos de bajo volumen. La shell de la app (/) NO se precachea:
// en dev dispara la compilación de la ruta y en producción cambia en cada deploy.
const PRECACHE = ["/sounds/notification.mp3", "/sounds/order-received.mp3", "/sounds/order-ready.mp3"];

// En desarrollo el servidor de Next compila rutas bajo demanda y el hash de los
// chunks cambia a cada reinicio; cachear ahí sirve HTML/chunks obsoletos que
// rompen la hidratación y dejan la página congelada. En dev todo pasa directo.
const IS_DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (IS_DEV) return;
  // Las navegaciones (HTML de la app) nunca se cachean ni se responden desde
  // caché: un shell viejo con chunks nuevos rompe la app. Solo pasan por red.
  if (req.mode === "navigate") return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// ─── Web Push ───────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || "COMU-APP";
    const options = {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/icon-192.png",
      tag: data.tag || "comu-app",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || "/" },
    };
    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        // Notificar a ventanas abiertas para reproducir sonido
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: "push-sound", sound: data.sound || "order-received" });
          }
        });
      })
    );
  } catch {
    // noop — push data wasn't valid JSON
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Si ya hay una ventana abierta, enfocar y navegar
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Si no, abrir nueva ventana
      self.clients.openWindow(targetUrl);
    })
  );
});
