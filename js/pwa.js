if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register(new URL("../service-worker.js", import.meta.url))
		.catch((error) => {
			console.error("No se pudo habilitar el modo sin conexión de la aplicación:", error);
		});
}
