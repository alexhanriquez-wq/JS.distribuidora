import { loadJsonProducts, renderProductGrid } from "./products.js";
import { bindCategoryFilters, bindSearchForm, filterProducts, renderCategoryFilters } from "./search.js";
import "./cart.js";

const pageType = document.body.dataset.page;
const grid = document.querySelector("[data-product-grid]");
const results = document.querySelector("[data-results-message]");
const form = document.querySelector("#catalog-search");
const input = document.querySelector("#catalog-search-input");
const offers = pageType === "offers";
const sourceNotice = document.querySelector("[data-catalog-source]");
let query = new URLSearchParams(window.location.search).get("q") || "";
let category = "todos";
let catalogProducts = [];
let catalogState = "loading";

if (input) input.value = query;

function render() {
	if (!grid) return;
	const catalog = catalogProducts;
	const shownProducts = offers
		? catalog.filter((product) => product.offer === true)
		: filterProducts(catalog, query, category);
	if (shownProducts.length === 0 && catalogProducts.length === 0 && catalogState !== "loading") {
		const empty = document.createElement("p");
		empty.className = "no-results";
		empty.textContent = catalogState === "error"
			? (offers ? "No se pudieron cargar las ofertas." : "No se pudieron cargar los productos.")
			: (offers ? "Todavía no hay ofertas publicadas." : "Todavía no hay productos publicados.");
		grid.replaceChildren(empty);
	} else if (shownProducts.length === 0 && catalogProducts.length === 0) {
		grid.replaceChildren();
	} else {
		renderProductGrid(grid, shownProducts, { showDescription: true });
	}
	if (results) results.textContent = offers
		? `${shownProducts.length} ${shownProducts.length === 1 ? "oferta" : "ofertas"}`
		: `${shownProducts.length} ${shownProducts.length === 1 ? "producto" : "productos"}`;
}

function setSourceNotice(message, state) {
	if (!sourceNotice) return;
	sourceNotice.textContent = message;
	sourceNotice.dataset.state = state;
	sourceNotice.hidden = false;
}

bindSearchForm(form, input, (value) => {
	query = value;
	category = "todos";
	const allButton = document.querySelector('[data-category="todos"]');
	if (allButton) allButton.click();
	render();
});

const categoryFilters = document.querySelector("[data-category-filters]");
bindCategoryFilters(categoryFilters, (value) => {
	category = value;
	render();
});

renderCategoryFilters(categoryFilters, catalogProducts, category);
render();
setSourceNotice("Cargando el catálogo local…", "loading");
loadJsonProducts()
	.then((products) => {
		catalogProducts = products.filter((product) => product.published && Number.isFinite(product.retailPrice) && product.retailPrice > 0);
		renderCategoryFilters(categoryFilters, catalogProducts, category);
		catalogState = catalogProducts.length ? "live" : "empty";
		if (catalogProducts.length === 0) {
			setSourceNotice(offers ? "Todavía no hay ofertas publicadas." : "Todavía no hay productos publicados.", "empty");
		} else if (sourceNotice) {
			sourceNotice.hidden = true;
		}
		render();
	})
	.catch((error) => {
		console.error("No se pudieron cargar los archivos del catálogo:", error);
		catalogProducts = [];
		renderCategoryFilters(categoryFilters, catalogProducts, category);
		catalogState = "error";
		setSourceNotice(`No se pudo cargar el catálogo: ${error.message}`, "fallback");
		render();
	});