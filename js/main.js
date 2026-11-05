import { loadJsonProducts, renderProductGrid } from "./products.js";
import { updateCartCount } from "./cart.js";
import { bindCategoryFilters, bindSearchForm, filterProducts, renderCategoryFilters } from "./search.js";

const productGrid = document.querySelector("[data-product-grid]");
const newProductGrid = document.querySelector("[data-new-products]");
const homeOffersGrid = document.querySelector("[data-home-offers]");
const resultsMessage = document.querySelector("[data-results-message]");
const searchForm = document.querySelector("#site-search");
const searchInput = document.querySelector("#search-input");
const toast = document.querySelector("[data-toast]");
const sourceNotice = document.querySelector("[data-catalog-source]");
let activeCategory = "todos";
let activeQuery = "";
let toastTimeout;
let catalogProducts = [];
let catalogState = "loading";

function renderProducts() {
	if (!productGrid) return;
	const matchingProducts = filterProducts(catalogProducts, activeQuery, activeCategory);
	const homeSelection = activeQuery || activeCategory !== "todos"
		? matchingProducts
		: [...matchingProducts.filter((product) => product.featured), ...matchingProducts.filter((product) => !product.featured)].slice(0, 8);
	if (catalogProducts.length || catalogState === "loading") renderProductGrid(productGrid, homeSelection);
	else showEmptyGrid(productGrid, catalogState === "error" ? "No se pudieron cargar los productos." : "Todavía no hay productos publicados.");
	if (catalogProducts.length || catalogState === "loading") {
		if (newProductGrid) renderProductGrid(newProductGrid, catalogProducts.slice(-4).reverse());
	} else {
		showEmptyGrid(newProductGrid, catalogState === "error" ? "No se pudieron cargar las novedades." : "Todavía no hay novedades publicadas.");
	}
	if (homeOffersGrid) {
		const offerProducts = catalogProducts.filter((product) => product.offer === true);
		if (catalogProducts.length || catalogState === "loading") renderProductGrid(homeOffersGrid, offerProducts);
		else showEmptyGrid(homeOffersGrid, catalogState === "error" ? "No se pudieron cargar las ofertas." : "Todavía no hay ofertas publicadas.");
	}

	if (resultsMessage) {
		resultsMessage.textContent = activeQuery || activeCategory !== "todos"
			? `${matchingProducts.length} ${matchingProducts.length === 1 ? "resultado" : "resultados"}`
			: `${homeSelection.length} productos populares`;
	}
}

function setSourceNotice(message, state) {
	if (!sourceNotice) return;
	sourceNotice.textContent = message;
	sourceNotice.dataset.state = state;
	sourceNotice.hidden = false;
}

function showEmptyGrid(container, message) {
	if (!container) return;
	const empty = document.createElement("p");
	empty.className = "no-results";
	empty.textContent = message;
	container.replaceChildren(empty);
}

function showToast(message) {
	if (!toast) return;
	toast.textContent = message;
	toast.classList.add("is-visible");
	window.clearTimeout(toastTimeout);
	toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

bindSearchForm(searchForm, searchInput, (query) => {
	activeQuery = query;
	renderProducts();
	document.querySelector("#destacados")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

bindCategoryFilters(document.querySelector(".category-list"), (category) => {
	activeCategory = category;
	renderProducts();
	document.querySelector("#destacados")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
const categoryFilters = document.querySelector(".category-list");
renderCategoryFilters(categoryFilters, catalogProducts, activeCategory);

const currentYear = document.querySelector("[data-current-year]");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());
updateCartCount();
setSourceNotice("Cargando el catálogo local…", "loading");
renderProducts();
loadJsonProducts()
	.then((products) => {
		catalogProducts = products.filter((product) => product.published && Number.isFinite(product.retailPrice) && product.retailPrice > 0);
		renderCategoryFilters(categoryFilters, catalogProducts, activeCategory);
		catalogState = catalogProducts.length ? "live" : "empty";
		if (catalogProducts.length === 0) {
			setSourceNotice("Todavía no hay productos disponibles.", "empty");
		} else if (sourceNotice) {
			sourceNotice.hidden = true;
		}
		renderProducts();
	})
	.catch((error) => {
		console.error("No se pudieron cargar los archivos del catálogo:", error);
		catalogProducts = [];
		renderCategoryFilters(categoryFilters, catalogProducts, activeCategory);
		catalogState = "error";
		setSourceNotice(`No se pudo cargar el catálogo: ${error.message}`, "fallback");
		renderProducts();
	});
