const CACHE_NAME = "js-distribuidora-pwa-v3";
const APP_FILES = [
	"index.html",
	"productos.html",
	"ofertas.html",
	"carrito.html",
	"contacto.html",
	"pages/admin.html",
	"manifest.webmanifest",
	"assets/logo-192.png",
	"assets/logo-512.png",
	"css/style.css",
	"css/responsive.css",
	"css/cart.css",
	"css/admin.css",
	"js/main.js",
	"js/catalog-page.js",
	"js/cart.js",
	"js/contact.js",
	"js/admin.js",
	"js/pwa.js",
	"js/products.js",
	"js/search.js",
	"productos.json",
	"contacto.json",
	"pedidos.json"
];

const appUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(APP_FILES.map(appUrl)))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys()
			.then((cacheNames) => Promise.all(
				cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName))
			))
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;

	const requestUrl = new URL(request.url);
	if (requestUrl.origin !== self.location.origin) return;

	event.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);
		try {
			const response = await fetch(request);
			if (response.ok) await cache.put(request, response.clone());
			return response;
		} catch (error) {
			const cachedResponse = await cache.match(request);
			if (cachedResponse) return cachedResponse;

			if (request.mode === "navigate") {
				const pageUrl = new URL(request.url);
				pageUrl.search = "";
				const cachedPage = await cache.match(pageUrl.href);
				if (cachedPage) return cachedPage;
				const homePage = await cache.match(appUrl("index.html"));
				if (homePage) return homePage;
			}

			throw error;
		}
	})());
});
