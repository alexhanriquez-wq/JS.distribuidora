const root = new URL("../", import.meta.url);
const dayNames = {
	lunes: "Lunes",
	martes: "Martes",
	miercoles: "Miércoles",
	jueves: "Jueves",
	viernes: "Viernes",
	sabado: "Sábado",
	domingo: "Domingo"
};

function validPhone(value) {
	if (typeof value !== "string") return "";
	const phone = value.replace(/\D/g, "");
	return /^\d{8,15}$/.test(phone) ? phone : "";
}

function validMapUrl(value) {
	if (typeof value !== "string" || !value.trim()) return "";
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? url.href : "";
	} catch {
		return "";
	}
}

function formatHours(hours) {
	if (!hours || typeof hours !== "object" || Array.isArray(hours)) {
		throw new TypeError("contacto.json debe incluir horarios como un objeto.");
	}
	return Object.entries(dayNames).map(([key, label]) => {
		const schedule = hours[key];
		if (!schedule || typeof schedule !== "object" || typeof schedule.abierto !== "boolean" || !Array.isArray(schedule.intervalos)) {
			throw new TypeError(`El horario de ${label.toLocaleLowerCase("es-AR")} en contacto.json no es válido.`);
		}
		if (!schedule.abierto) return `${label}: cerrado`;
		if (schedule.intervalos.length === 0) return `${label}: horario a confirmar`;
		const intervals = schedule.intervalos.map(({ desde, hasta }) => {
			if (typeof desde !== "string" || typeof hasta !== "string") {
				throw new TypeError(`El horario de ${label.toLocaleLowerCase("es-AR")} en contacto.json no es válido.`);
			}
			return `${desde}–${hasta}`;
		});
		return `${label}: ${intervals.join(", ")}`;
	}).join("\n");
}

function setText(selector, value) {
	document.querySelectorAll(selector).forEach((element) => {
		element.textContent = value;
	});
}

function renderContact(data) {
	const address = typeof data.direccion === "string" && data.direccion.trim() ? data.direccion.trim() : "";
	const phone = validPhone(data.telefono_contacto);
	const email = typeof data.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) ? data.email.trim() : "";
	const mapUrl = validMapUrl(data.google_maps_url);
	const hours = formatHours(data.horarios);
	const location = address || "Dirección no informada";
	const whatsappLink = document.querySelector("[data-contact-whatsapp]");
	const phoneText = document.querySelector("[data-contact-phone]");
	if (whatsappLink && phoneText) {
		if (phone) {
			whatsappLink.href = `https://wa.me/${phone}`;
			whatsappLink.textContent = data.telefono_contacto.trim();
			whatsappLink.hidden = false;
			phoneText.hidden = true;
		} else {
			phoneText.textContent = "Número no informado";
			phoneText.hidden = false;
		}
	}
	const emailLink = document.querySelector("[data-contact-email]");
	const emailEmpty = document.querySelector("[data-contact-email-empty]");
	if (emailLink && emailEmpty) {
		if (email) {
			emailLink.href = `mailto:${email}`;
			emailLink.textContent = email;
			emailLink.hidden = false;
		} else {
			emailEmpty.hidden = false;
		}
	}
	const mapLink = document.querySelector("[data-contact-map]");
	if (mapLink && mapUrl) {
		mapLink.href = mapUrl;
		mapLink.hidden = false;
	}
	const mapPlaceholder = document.querySelector("[data-contact-map-placeholder]");
	if (mapPlaceholder && mapUrl) {
		mapPlaceholder.replaceChildren();
		const link = document.createElement("a");
		link.href = mapUrl;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		link.textContent = "Abrir ubicación en Google Maps";
		mapPlaceholder.setAttribute("role", "group");
		mapPlaceholder.setAttribute("aria-label", "Abrir la ubicación de JS en Google Maps");
		mapPlaceholder.append(link);
	}

	setText("[data-contact-address]", location);
	setText("[data-contact-hero]", `${location}, Campo Largo, Chaco.`);
	setText("[data-contact-location-summary]", `Encontranos en ${location}, Campo Largo, Chaco.`);
	setText("[data-contact-hours]", hours);
	setText("[data-contact-footer-address]", `${location}, Campo Largo, Chaco, Argentina`);
	setText("[data-contact-footer-hours]", hours.replaceAll("\n", " · "));
	setText("[data-contact-footer-phone]", phone ? `WhatsApp: ${data.telefono_contacto.trim()}` : "WhatsApp no informado");
	const status = document.querySelector("[data-contact-status]");
	if (status) status.hidden = true;
}

fetch(new URL("contacto.json", root), { cache: "no-store" })
	.then((response) => {
		if (!response.ok) throw new Error(`No se pudo cargar contacto.json (HTTP ${response.status}).`);
		return response.json();
	})
	.then(renderContact)
	.catch((error) => {
		console.error("No se pudieron cargar los datos de contacto:", error);
		setText("[data-contact-status]", `No se pudieron cargar los datos de contacto: ${error.message}`);
		setText("[data-contact-phone]", "No se pudo cargar el número");
		setText("[data-contact-email-empty]", "No se pudieron cargar los datos");
		document.querySelector("[data-contact-email-empty]")?.removeAttribute("hidden");
		setText("[data-contact-hours]", "No se pudieron cargar los horarios");
		setText("[data-contact-footer-address]", "No se pudo cargar la dirección");
		setText("[data-contact-footer-hours]", "No se pudieron cargar los horarios");
	});
