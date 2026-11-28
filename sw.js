/*
  A1 KITCHEN APP: SERVICE WORKER
  ------------------------------
  Makes the website work like an app on the phone:
  - Pages and files are fetched fresh when the internet works, and the last
    copy is kept on the phone for when it does not.
  - On a slow connection, the saved copy is shown after a few seconds.
  - With no internet at all, a friendly "You are offline" page is shown.
  - Nothing from Supabase (orders, payments, tickets, logins) is ever saved
    here: only this website's own pages, styles, scripts and pictures.
  Change VERSION when you want every phone to drop its old saved copies.
*/
const VERSION = "a1-app-v1";
const OFFLINE_PAGE = "offline.html";
const CORE = [
  "index.html",
  "menu.html",
  "order.html",
  "track-order.html",
  "events.html",
  "contact.html",
  "offline.html",
  "style.css",
  "theme-init.js",
  "site-extras.js",
  "supabase-config.js",
  "images/logo-wide.webp",
  "images/logo-mark.png",
  "images/app-icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        Promise.all(
          CORE.map((url) =>
            fetch(url, { cache: "no-cache" })
              .then((response) =>
                response.ok && !response.redirected
                  ? cache.put(url, response)
                  : null,
              )
              .catch(() => null),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== VERSION)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function saveCopy(request, response) {
  if (
    response &&
    response.ok &&
    response.type === "basic" &&
    !response.redirected
  ) {
    const copy = response.clone();
    caches
      .open(VERSION)
      .then((cache) => cache.put(request, copy))
      .catch(() => null);
  }
  return response;
}

/* Try the internet first. If it is slow, show the saved copy after a few
   seconds (and keep updating the saved copy in the background). */
function networkFirst(request, waitSeconds) {
  return new Promise((resolve) => {
    let finished = false;
    const done = (response) => {
      if (!finished && response) {
        finished = true;
        resolve(response);
      }
    };
    const fromNetwork = fetch(request)
      .then((response) => saveCopy(request, response))
      .catch(() => null);
    const timer = setTimeout(() => {
      caches
        .match(request, { ignoreSearch: request.mode === "navigate" })
        .then(done);
    }, waitSeconds * 1000);
    fromNetwork.then(async (response) => {
      clearTimeout(timer);
      if (response) {
        done(response);
        return;
      }
      const saved = await caches.match(request, {
        ignoreSearch: request.mode === "navigate",
      });
      if (saved) {
        done(saved);
        return;
      }
      if (request.mode === "navigate") {
        done(await caches.match(OFFLINE_PAGE));
      }
      done(Response.error());
    });
  });
}

/* Pictures rarely change: show the saved one at once, refresh it quietly */
function savedFirst(request) {
  return caches.match(request).then((saved) => {
    const fresh = fetch(request)
      .then((response) => saveCopy(request, response))
      .catch(() => saved || Response.error());
    return saved || fresh;
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return; /* Supabase, WhatsApp and other sites are never touched */
  }
  if (url.pathname.endsWith("sw.js")) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, 6));
  } else if (request.destination === "image") {
    event.respondWith(savedFirst(request));
  } else {
    event.respondWith(networkFirst(request, 5));
  }
});
