export const BUSINESS_NAME = "JS";

let jsonProductsPromise;

/**
 * Todo el catálogo vive en productos.json, indexado por código de barras:
 * precio_minorista, precio_mayorista y cantidad_mayorista (unidades mínimas
 * para que se aplique el precio mayorista) van dentro de cada producto.
 */
export function loadJsonProducts() {
	if (!jsonProductsPromise) {
		const root = new URL("../", import.meta.url);
		jsonProductsPromise = fetchCatalogFile(new URL("productos.json", root))
			.then((products) => indexByBarcode(products, "productos.json")
				.map(([barcode, data]) => normalizeJsonProduct(barcode, data)))
			.catch((error) => {
				jsonProductsPromise = undefined;
				throw error;
			});
	}
	return jsonProductsPromise;
}

/** Cantidad mínima para el precio mayorista, o null si el producto no tiene mayorista. */
export function wholesaleMinimum(product) {
	const minimum = Number(product?.wholesaleMin);
	const hasPrice = Number.isFinite(product?.wholesalePrice) && product.wholesalePrice > 0;
	return hasPrice && Number.isSafeInteger(minimum) && minimum >= 2 ? minimum : null;
}

/** Precio por unidad según la cantidad: el más bajo entre minorista/oferta y mayorista (si alcanza la cantidad). */
export function getProductUnitPrice(product, quantity = 1, promotional = false) {
	const basePrice = promotional && Number.isFinite(product.offerPrice) && product.offerPrice > 0
		? product.offerPrice
		: product.price ?? product.retailPrice;
	const candidates = [];
	if (Number.isFinite(basePrice) && basePrice > 0) candidates.push(basePrice);
	const minimum = wholesaleMinimum(product);
	if (minimum !== null && quantity >= minimum) candidates.push(product.wholesalePrice);
	return candidates.length ? Math.min(...candidates) : null;
}

/**
 * Las imágenes subidas a Cloudinary se piden ya optimizadas: formato automático
 * (WebP/AVIF según el navegador), calidad automática y como máximo 720 px de ancho.
 */
export function optimizeImageUrl(url, width = 720) {
	const match = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/.exec(url);
	return match ? `${match[1]}f_auto,q_auto,c_limit,w_${width}/${match[2]}` : url;
}

async function fetchCatalogFile(url) {
	const response = await fetch(url, { cache: "no-store" });
	if (!response.ok) throw new Error(`No se pudo cargar ${url.pathname.split("/").pop()} (HTTP ${response.status}).`);
	return response.json();
}

function indexByBarcode(data, fileName) {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw new TypeError(`${fileName} debe contener un objeto JSON indexado por código de barras.`);
	}
	const indexedRecords = Object.entries(data).map(([key, value]) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new TypeError(`El registro ${key} de ${fileName} no es un objeto válido.`);
		}
		const barcode = String(value.codigo_barras ?? key).trim();
		if (!barcode) throw new TypeError(`El registro ${key} de ${fileName} no tiene código de barras.`);
		return [barcode, value];
	});
	if (new Set(indexedRecords.map(([barcode]) => barcode)).size !== indexedRecords.length) {
		throw new TypeError(`${fileName} contiene códigos de barras duplicados.`);
	}
	return indexedRecords;
}

function readPrice(value) {
	if (value === null || value === undefined || value === "") return null;
	const price = Number(value);
	return Number.isFinite(price) && price > 0 ? price : null;
}

function normalizeJsonProduct(id, data) {
	const rawCategory = String(data.categoria ?? "Otros").trim() || "Otros";
	const category = rawCategory.toLocaleLowerCase("es-AR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
	const offer = data.oferta;
	const offerObject = offer && typeof offer === "object" ? offer : {};
	const retailPrice = readPrice(data.precio_minorista) ?? readPrice(data.precio);
	const wholesalePrice = readPrice(data.precio_mayorista);
	const wholesaleMin = Number(data.cantidad_mayorista);
	const offerPrice = readPrice(offerObject.precio ?? offerObject.precioOferta ?? data.precio_oferta);
	const previousPrice = readPrice(offerObject.precioAnterior ?? data.precio_anterior);
	return {
		id,
		barcode: id,
		name: String(data.nombre ?? "Producto sin nombre"),
		description: String(data.descripcion ?? ""),
		presentation: String(data.presentacion ?? data.unidad ?? "Unidad"),
		price: retailPrice,
		retailPrice,
		wholesalePrice,
		wholesaleMin: Number.isSafeInteger(wholesaleMin) && wholesaleMin >= 2 ? wholesaleMin : null,
		category,
		categoryLabel: rawCategory,
		image: typeof data.imagen === "string" ? optimizeImageUrl(data.imagen.trim()) : "",
		imageAlt: String(data.nombre ?? "Producto"),
		stock: Number.isFinite(Number(data.stock)) ? Number(data.stock) : null,
		featured: data.destacado === true,
		offer: data.oferta === true || (typeof data.oferta === "object" && data.oferta !== null && data.oferta.activa !== false),
		offerPrice,
		previousPrice,
		published: data.publicado !== false,
	};
}

export function formatCurrency(value) {
	return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function createProductCard(product, options = {}) {
	const { offer, showDescription = false } = options;
	const isOffer = Boolean(offer || product.offer);
	const card = document.createElement("article");
	card.className = "product-card";

	const media = document.createElement("div");
	media.className = "product-media";
	if (product.image) {
		const image = document.createElement("img");
		image.src = product.image;
		image.alt = product.imageAlt || product.name;
		image.width = 720;
		image.height = 560;
		image.loading = "lazy";
		image.decoding = "async";
		image.addEventListener("error", () => {
			image.remove();
			media.classList.add("product-media--fallback");
		}, { once: true });
		media.append(image);
	} else {
		media.classList.add("product-media--fallback");
	}
	if (product.offer) {
		const tag = document.createElement("span");
		tag.className = "demo-tag live-offer-tag";
		tag.textContent = "OFERTA";
		media.append(tag);
	}
	if (!product.image) {
		const pending = document.createElement("span");
		pending.className = "image-pending-label";
		pending.textContent = "Foto próximamente";
		media.append(pending);
	}

	const body = document.createElement("div");
	body.className = "product-body";
	const category = document.createElement("p");
	category.className = "product-category";
	category.textContent = product.categoryLabel || product.category;
	const title = document.createElement("h3");
	title.textContent = product.name;
	const presentation = document.createElement("p");
	presentation.className = "product-presentation";
	presentation.textContent = product.presentation || product.description || "Presentación no especificada";
	body.append(category, title, presentation);
	if (Number.isSafeInteger(product.stock)) {
		const stock = document.createElement("p");
		stock.className = `product-stock ${product.stock > 0 ? "is-in-stock" : "is-out-of-stock"}`;
		stock.textContent = product.stock > 0 ? `Disponible: ${product.stock}` : "Sin stock";
		body.append(stock);
	}
	if (showDescription && product.description) {
		const description = document.createElement("p");
		description.className = "product-description";
		description.textContent = product.description;
		body.append(description);
	}

	const priceRow = document.createElement("div");
	priceRow.className = "product-price-row";
	const priceBlock = document.createElement("div");
	const priceNote = document.createElement("span");
	priceNote.textContent = isOffer ? "Precio minorista · Oferta" : "Precio minorista";
	const price = document.createElement("strong");
	price.className = "product-price";
	const visiblePrice = offer?.offerPrice ?? (product.offer ? product.offerPrice : null) ?? product.price;
	price.textContent = formatCurrency(visiblePrice);
	priceBlock.append(priceNote, price);
	const wholesaleMin = wholesaleMinimum(product);
	if (wholesaleMin !== null) {
		const wholesale = document.createElement("span");
		wholesale.className = "product-wholesale-price";
		wholesale.textContent = `Mayorista (desde ${wholesaleMin} u.): ${formatCurrency(product.wholesalePrice)}`;
		priceBlock.append(wholesale);
	}
	const previousPriceValue = isOffer ? (offer?.previousPrice ?? product.previousPrice) : null;
	if (Number.isSafeInteger(previousPriceValue) && previousPriceValue > visiblePrice) {
		const previousPrice = document.createElement("del");
		previousPrice.className = "product-old-price";
		previousPrice.textContent = formatCurrency(previousPriceValue);
		priceBlock.append(previousPrice);
	}

	const addButton = document.createElement("button");
	addButton.className = "add-button";
	addButton.type = "button";
	addButton.dataset.addProduct = product.id;
	addButton.dataset.unitPrice = String(visiblePrice);
	addButton.dataset.promotional = String(isOffer);
	addButton.dataset.productSnapshot = JSON.stringify(product);
	addButton.setAttribute("aria-label", `Agregar ${product.name} al pedido`);
	if (Number.isSafeInteger(product.stock) && product.stock <= 0) {
		addButton.disabled = true;
		addButton.textContent = "Sin stock";
		addButton.setAttribute("aria-label", `${product.name}, sin stock`);
	}
	const addIcon = document.createElement("span");
	addIcon.setAttribute("aria-hidden", "true");
	addIcon.textContent = "+";
	if (!addButton.disabled) addButton.append(addIcon, document.createTextNode("Agregar"));
	priceRow.append(priceBlock, addButton);
	body.append(priceRow);
	card.append(media, body);
	return card;
}

export function renderProductGrid(container, products, options = {}) {
	if (!container) return;
	const { offers = [], showDescription = false } = options;
	container.replaceChildren();
	if (products.length === 0) {
		const empty = document.createElement("p");
		empty.className = "no-results";
		empty.textContent = "No encontramos productos con esos criterios.";
		container.append(empty);
		return;
	}
	const offerById = new Map(offers.map((offer) => [offer.productId, offer]));
	container.append(...products.map((product) => createProductCard(product, {
		offer: offerById.get(product.id),
		showDescription
	})));
}
