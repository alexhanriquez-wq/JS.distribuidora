import { BUSINESS_NAME, getProductUnitPrice, formatCurrency, wholesaleMinimum } from "./products.js";

export const CART_STORAGE_KEY = "js-cart-v1";
const CUSTOMER_STORAGE_KEY = "js-customer-v1";

function getSafeStoredCart() {
	try {
		const value = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
		return Array.isArray(value) ? value : [];
	} catch {
		return [];
	}
}

export function readCart() {
	return getSafeStoredCart().flatMap((item) => {
		const product = item?.product;
		const quantity = Number(item?.quantity);
		if (!product || typeof product !== "object" || typeof product.id !== "string" || typeof product.name !== "string") return [];
		if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) return [];
		const unitPrice = getProductUnitPrice(product, quantity, item.promotional === true) ?? Number(item?.unitPrice);
		if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(unitPrice * quantity)) return [];
		return [{ ...product, product: { ...product }, quantity, unitPrice, promotional: item.promotional === true }];
	});
}

function persistCart(cart) {
	localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart.map(({ id, quantity, unitPrice, promotional, product }) => ({
		id, quantity, unitPrice, promotional, product
	}))));
	document.dispatchEvent(new CustomEvent("gad:cart-change"));
}

export function updateCartCount() {
	const count = readCart().reduce((total, item) => total + item.quantity, 0);
	const badge = document.querySelector("[data-cart-count]");
	const link = document.querySelector(".cart-link");
	if (badge) badge.textContent = String(count);
	if (link) link.setAttribute("aria-label", `Ir al carrito, ${count} artículos`);
	return count;
}

export function addToCart(productId, { unitPrice, promotional = false, product: productSnapshot } = {}) {
	const product = productSnapshot?.id === productId ? productSnapshot : undefined;
	const expectedPrice = getProductUnitPrice(product || {}, 1, promotional);
	const price = Number(unitPrice ?? expectedPrice);
	if (!product || (Number.isSafeInteger(product.stock) && product.stock <= 0)
		|| !Number.isFinite(price) || price < 0 || price !== expectedPrice) return false;
	const cart = readCart();
	const existing = cart.find((item) => item.id === productId);
	if (existing) {
		if (existing.quantity >= 9999) return false;
		existing.quantity += 1;
		existing.promotional = existing.promotional || promotional;
	} else {
		cart.push({ id: productId, product: { ...product }, quantity: 1, unitPrice: price, promotional });
	}
	try {
		persistCart(cart);
		updateCartCount();
		return true;
	} catch {
		return false;
	}
}

export function setCartQuantity(productId, quantity) {
	const safeQuantity = Number(quantity);
	if (!Number.isSafeInteger(safeQuantity) || safeQuantity < 1 || safeQuantity > 9999) return false;
	const cart = readCart();
	const target = cart.find((item) => item.id === productId);
	if (!target) return false;
	target.quantity = safeQuantity;
	try {
		persistCart(cart);
		updateCartCount();
		return true;
	} catch {
		return false;
	}
}

export function removeFromCart(productId) {
	const cart = readCart().filter((item) => item.id !== productId);
	try {
		persistCart(cart);
		updateCartCount();
		return true;
	} catch {
		return false;
	}
}

export function clearCart() {
	try {
		persistCart([]);
		updateCartCount();
		return true;
	} catch {
		return false;
	}
}

function renderCart(container, items) {
	container.replaceChildren();
	items.forEach((item) => {
		const row = document.createElement("article");
		row.className = "cart-item";
		const image = document.createElement("img");
		image.className = "cart-item-image";
		image.hidden = !item.image;
		if (item.image) image.src = item.image;
		image.alt = item.imageAlt || item.name;
		image.width = 104;
		image.height = 104;
		image.loading = "lazy";
		image.addEventListener("error", () => { image.hidden = true; }, { once: true });
		const info = document.createElement("div");
		info.className = "cart-item-info";
		const category = document.createElement("p");
		category.className = "product-category";
		category.textContent = item.categoryLabel || item.category;
		const title = document.createElement("h3");
		title.textContent = item.name;
		const presentation = document.createElement("p");
		presentation.textContent = item.presentation || "Presentación no especificada";
		const unit = document.createElement("span");
		unit.className = "cart-unit-price";
		const wholesaleMin = wholesaleMinimum(item);
		unit.textContent = `${formatCurrency(item.unitPrice)} · ${item.presentation || "unidad"}`;
		if (priceTypeOf(item) === "mayorista") unit.textContent += " · precio mayorista aplicado";
		else if (item.promotional) unit.textContent += " · oferta";
		if (wholesaleMin !== null && item.quantity < wholesaleMin) {
			unit.textContent += ` · llevando ${wholesaleMin} o más: ${formatCurrency(item.wholesalePrice)} c/u`;
		}
		info.append(category, title, presentation, unit);

		const controls = document.createElement("div");
		controls.className = "cart-item-controls";
		const quantityLabel = document.createElement("span");
		quantityLabel.className = "visually-hidden";
		quantityLabel.textContent = `Cantidad de ${item.name}`;
		const quantity = document.createElement("div");
		quantity.className = "quantity-control";
		const decrease = document.createElement("button");
		decrease.type = "button";
		decrease.textContent = "−";
		decrease.dataset.cartAction = "decrease";
		decrease.setAttribute("aria-label", `Reducir ${item.name}`);
		const quantityValue = document.createElement("output");
		quantityValue.textContent = String(item.quantity);
		const increase = document.createElement("button");
		increase.type = "button";
		increase.textContent = "+";
		increase.dataset.cartAction = "increase";
		increase.setAttribute("aria-label", `Aumentar ${item.name}`);
		quantity.append(quantityLabel, decrease, quantityValue, increase);
		const subtotal = document.createElement("strong");
		subtotal.className = "cart-item-subtotal";
		subtotal.textContent = formatCurrency(item.unitPrice * item.quantity);
		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "remove-item";
		remove.textContent = "Quitar";
		remove.dataset.cartAction = "remove";
		remove.setAttribute("aria-label", `Quitar ${item.name} del carrito`);
		controls.append(quantity, subtotal, remove);
		row.append(image, info, controls);
		row.dataset.productId = item.id;
		row.dataset.unitPrice = String(item.unitPrice);
		container.append(row);
	});
}


// ---------- Orden de compra ----------

function priceTypeOf(item) {
	const minimum = wholesaleMinimum(item);
	if (minimum !== null && item.quantity >= minimum && item.unitPrice === item.wholesalePrice) return "mayorista";
	if (item.promotional && item.unitPrice === item.offerPrice) return "oferta";
	return "minorista";
}

const CUSTOMER_FIELDS = ["nombre", "telefono", "direccion", "documento", "nota"];

function restoreCustomer(form) {
	if (!form) return;
	try {
		const saved = JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || "{}");
		CUSTOMER_FIELDS.forEach((field) => {
			if (field !== "nota" && typeof saved[field] === "string" && form.elements[field]) form.elements[field].value = saved[field];
		});
	} catch {
		// Sin datos guardados: el formulario queda vacío.
	}
}

function saveCustomer(form) {
	try {
		const data = {};
		CUSTOMER_FIELDS.filter((field) => field !== "nota").forEach((field) => { data[field] = form.elements[field]?.value.trim() ?? ""; });
		localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(data));
	} catch {
		// Si el navegador no permite guardar, se vuelve a escribir la próxima vez.
	}
}

/** Devuelve los datos del comprador o null (y marca el campo) si falta el nombre. */
function readCustomer(form) {
	const customer = {};
	CUSTOMER_FIELDS.forEach((field) => { customer[field] = form?.elements[field]?.value.trim() ?? ""; });
	if (!customer.nombre) {
		const input = form?.elements.nombre;
		if (input) {
			input.setAttribute("aria-invalid", "true");
			input.focus();
		}
		const status = document.querySelector("[data-order-contact-status]");
		if (status) status.textContent = "Escribí tu nombre o razón social para preparar el pedido.";
		return null;
	}
	form?.elements.nombre?.removeAttribute("aria-invalid");
	return customer;
}

function buildOrder(cart, customer) {
	const now = new Date();
	const pad = (value) => String(value).padStart(2, "0");
	const random = Array.from(crypto.getRandomValues(new Uint8Array(3)), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
	const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
	const items = cart.map((item) => ({
		codigo_barras: item.barcode || item.id,
		nombre: item.name,
		presentacion: item.presentation || "",
		cantidad: item.quantity,
		precio_unitario: item.unitPrice,
		tipo_precio: priceTypeOf(item),
		subtotal: item.unitPrice * item.quantity
	}));
	return {
		tipo: "orden_de_compra",
		version: 1,
		id: `JS-${date}-${pad(now.getHours())}${pad(now.getMinutes())}-${random}`,
		negocio: BUSINESS_NAME,
		fecha: now.toISOString(),
		cliente: customer,
		items,
		total: items.reduce((sum, item) => sum + item.subtotal, 0),
		moneda: "ARS"
	};
}

function buildOrderMessage(order, code) {
	const customer = order.cliente;
	const lines = order.items.map((item) => {
		const kind = item.tipo_precio === "minorista" ? "" : ` (${item.tipo_precio})`;
		return `• ${item.nombre} x${item.cantidad} — ${formatCurrency(item.subtotal)}${kind}`;
	});
	const customerLines = [
		`Cliente: ${customer.nombre}`,
		customer.documento && `CUIT/DNI: ${customer.documento}`,
		customer.telefono && `Teléfono: ${customer.telefono}`,
		customer.direccion && `Dirección: ${customer.direccion}`,
		customer.nota && `Nota: ${customer.nota}`
	].filter(Boolean);
	return [
		`Hola, quiero hacer este pedido (N° ${order.id}):`,
		"",
		...customerLines,
		"",
		...lines,
		"",
		`Total estimado: ${formatCurrency(order.total)}`,
		"Precios y disponibilidad sujetos a confirmación.",
		"",
		"Código de la orden (no lo borres):",
		code
	].join("\n");
}

/** Orden comprimida en una sola línea de texto que la app JS Admin puede importar. */
async function encodeOrder(order) {
	const bytes = new TextEncoder().encode(JSON.stringify(order));
	if (typeof CompressionStream === "function") {
		try {
			const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
			const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
			return `JSPEDIDO1:${toBase64Url(compressed)}`;
		} catch {
			// Si falla la compresión se envía sin comprimir.
		}
	}
	return `JSPEDIDO0:${toBase64Url(bytes)}`;
}

function toBase64Url(bytes) {
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function initCartPage() {
	const container = document.querySelector("[data-cart-items]");
	if (!container) return;
	const emptyState = document.querySelector("[data-cart-empty]");
	const summary = document.querySelector("[data-cart-summary]");
	const subtotalElement = document.querySelector("[data-cart-subtotal]");
	const totalElement = document.querySelector("[data-cart-total]");
	const whatsappButton = document.querySelector("[data-whatsapp-order]");
	const orderContactStatus = document.querySelector("[data-order-contact-status]");
	const root = new URL("../", import.meta.url);
	let orderPhone;
	const refresh = () => {
		const cart = readCart();
		const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
		renderCart(container, cart);
		if (emptyState) emptyState.hidden = cart.length > 0;
		if (summary) summary.hidden = cart.length === 0;
		if (subtotalElement) subtotalElement.textContent = formatCurrency(total);
		if (totalElement) totalElement.textContent = formatCurrency(total);
		updateCartCount();
	};

	container.addEventListener("click", (event) => {
		const button = event.target.closest("[data-cart-action]");
		if (!button) return;
		const row = button.closest(".cart-item");
		const productId = row?.dataset.productId;
		const item = readCart().find((cartItem) => cartItem.id === productId);
		if (!item) return;
		if (button.dataset.cartAction === "remove") removeFromCart(productId);
		if (button.dataset.cartAction === "increase") setCartQuantity(productId, item.quantity + 1);
		if (button.dataset.cartAction === "decrease") {
			if (item.quantity <= 1) removeFromCart(productId);
			else setCartQuantity(productId, item.quantity - 1);
		}
		refresh();
	});
	document.querySelector("[data-clear-cart]")?.addEventListener("click", () => {
		clearCart();
		refresh();
	});
	const customerForm = document.querySelector("[data-order-customer]");
	restoreCustomer(customerForm);
	customerForm?.addEventListener("input", () => saveCustomer(customerForm));

	whatsappButton?.addEventListener("click", async () => {
		if (!orderPhone) return;
		const cart = readCart();
		if (cart.length === 0) return;
		const customer = readCustomer(customerForm);
		if (!customer) return;
		// Se abre la pestaña antes de esperar la compresión para que el navegador no la bloquee.
		const tab = window.open("about:blank", "_blank");
		const order = buildOrder(cart, customer);
		const code = await encodeOrder(order);
		const url = `https://wa.me/${orderPhone}?text=${encodeURIComponent(buildOrderMessage(order, code))}`;
		if (tab) {
			tab.opener = null;
			tab.location.href = url;
		} else {
			window.location.href = url;
		}
		if (orderContactStatus) {
			orderContactStatus.textContent = `Pedido ${order.id} preparado. Para que llegue, tocá «Enviar» en WhatsApp sin borrar el código de la orden.`;
		}
	});
	document.addEventListener("gad:cart-change", refresh);
	window.addEventListener("storage", (event) => {
		if (event.key === CART_STORAGE_KEY) refresh();
	});
	refresh();
	if (whatsappButton) {
		fetch(new URL("pedidos.json", root), { cache: "no-store" })
			.then((response) => {
				if (!response.ok) throw new Error(`No se pudo cargar pedidos.json (HTTP ${response.status}).`);
				return response.json();
			})
			.then((data) => {
				const phone = typeof data.telefono_pedidos === "string" ? data.telefono_pedidos.replace(/\D/g, "") : "";
				if (!/^\d{8,15}$/.test(phone)) throw new TypeError("pedidos.json debe incluir un teléfono válido en telefono_pedidos.");
				orderPhone = phone;
				whatsappButton.disabled = false;
				if (orderContactStatus) orderContactStatus.textContent = "El pedido y su orden de compra se envían por WhatsApp.";
			})
			.catch((error) => {
				console.error("No se pudo configurar el teléfono para pedidos:", error);
				if (orderContactStatus) orderContactStatus.textContent = `No se pudo cargar el teléfono para pedidos: ${error.message}`;
			});
	}
}

document.addEventListener("click", (event) => {
	const button = event.target.closest("[data-add-product]");
	if (!button) return;
	let added = false;
	try {
		added = addToCart(button.dataset.addProduct, {
			unitPrice: Number(button.dataset.unitPrice),
			promotional: button.dataset.promotional === "true",
			product: JSON.parse(button.dataset.productSnapshot || "null")
		});
	} catch {
		added = false;
	}
	const toast = document.querySelector("[data-toast]");
	if (toast) {
		toast.textContent = added ? "Producto agregado al pedido" : "No se pudo agregar: revisá el producto y su precio.";
		toast.classList.add("is-visible");
		window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
	}
});

if (document.querySelector("[data-cart-items]")) initCartPage();
document.addEventListener("gad:cart-change", updateCartCount);
window.addEventListener("storage", (event) => {
	if (event.key === CART_STORAGE_KEY) updateCartCount();
});
const currentYear = document.querySelector("[data-current-year]");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());
document.querySelectorAll("[data-business-name]").forEach((element) => {
	element.textContent = BUSINESS_NAME;
});
updateCartCount();
