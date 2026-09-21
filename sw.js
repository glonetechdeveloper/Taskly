/* ==========================================================
   TASKLY — Service Worker (sw.js)
   Progressive Web App Offline Support & Fast Asset Caching
   ========================================================== */

const CACHE_NAME = "taskly-pwa-v1.0.2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./roadmap.html",
  "./roadmapmanager.html",
  "./notifications.html",
  "./settings.html",
  "./account.html",
  "./login.html",
  "./signup.html",
  "./manifest.json",
  "./manifest.webmanifest",
  "./css/sidebar.css",
  "./css/dashboard.css",
  "./css/roadmap.css",
  "./css/roadmapmanager.css",
  "./css/notifications.css",
  "./css/settings.css",
  "./css/account.css",
  "./css/auth.css",
  "./css/nodi.css",
  "./css/streak.css",
  "./js/api.js",
  "./js/sidebar.js",
  "./js/streak.js",
  "./js/nodi.js",
  "./js/dashboard.js",
  "./js/roadmap.js",
  "./js/roadmapmanager.js",
  "./js/settings.js",
  "./js/notifications.js",
  "./js/account.js",
  "./js/auth.js",
  "./js/session-guard.js",
  "./js/pwa.js",
  "./assets/Icon.png",
  "./assets/tasklylogo.png",
  "./assets/Nodi.png",
  "./assets/profile.png"
];

// Install Event — Pre-cache the App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use individual caching with catch to prevent single asset failure from failing entire install
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("[SW] Skipping cache item:", url, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Clean old caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Removing outdated cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Network-first for dynamic requests, Stale-while-revalidate for static shell
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and browser extensions
  if (req.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // API Requests: Network-First (skip aggressive cache for backend endpoints)
  if (url.origin.includes("onrender.com") || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({ offline: true, message: "You are currently offline. Actions will sync when reconnected." }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Navigation requests (HTML pages)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const dashboardFallback = await caches.match("./dashboard.html");
          if (dashboardFallback) return dashboardFallback;
          return caches.match("./index.html");
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Images, Fonts) — Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
