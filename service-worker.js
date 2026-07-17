"use strict";

const CACHE_NAME = "saircom-captura-v12";

const APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/app.js",
    "./js/database.js",
    "./js/camera.js",
    "./js/marker.js",
    "./js/export.js",
    "./js/vendor/jszip.min.js",
    "./icons/icon-192.png",
    "./icons/icon2-192.png",
    "./icons/icon-48.png",
    "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_FILES);
        })
    );

    self.skipWaiting();
});


self.addEventListener("activate", (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter(
                            (cacheName) =>
                                cacheName !== CACHE_NAME
                        )
                        .map(
                            (cacheName) =>
                                caches.delete(cacheName)
                        )
                );
            }),

            self.clients.claim()
        ])
    );
});


async function networkFirst(request) {
    try {
        const networkResponse = await fetch(
            request,
            {
                cache: "no-store"
            }
        );

        if (networkResponse?.ok) {
            const cache = await caches.open(
                CACHE_NAME
            );

            await cache.put(
                request,
                networkResponse.clone()
            );
        }

        return networkResponse;

    } catch (networkError) {
        const cachedResponse = await caches.match(
            request
        );

        if (cachedResponse) {
            return cachedResponse;
        }

        if (request.mode === "navigate") {
            const cachedPage = await caches.match(
                "./index.html"
            );

            if (cachedPage) {
                return cachedPage;
            }
        }

        throw networkError;
    }
}


self.addEventListener("fetch", (event) => {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(request.url);

    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        networkFirst(request)
    );
});