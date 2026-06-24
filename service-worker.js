"use strict";

const CACHE_NAME = "saircom-captura-v5";

const APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/app.js",
    "./js/database.js",
    "./js/camera.js",
    "./js/marker.js",
    "./icons/icon-192.png",
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
        })
    );

    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(
            (cachedResponse) => {
                return (
                    cachedResponse ||
                    fetch(event.request)
                );
            }
        )
    );
});