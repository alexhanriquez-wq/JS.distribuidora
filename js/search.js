export function filterProducts(products, query = "", category = "todos") {
	const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
	return products.filter((product) => {
		const categoryMatches = category === "todos" || product.category === category;
		const searchable = `${product.name} ${product.categoryLabel || ""} ${product.presentation || ""} ${product.description || ""}`.toLocaleLowerCase("es-AR");
		return categoryMatches && searchable.includes(normalizedQuery);
	});
}

export function renderCategoryFilters(container, products, selectedCategory = "todos") {
	if (!container) return;

	const allButton = document.createElement("button");
	allButton.type = "button";
	allButton.className = `category-button${selectedCategory === "todos" ? " is-selected" : ""}`;
	allButton.dataset.category = "todos";
	allButton.setAttribute("aria-pressed", String(selectedCategory === "todos"));
	const icon = document.createElement("span");
	icon.setAttribute("aria-hidden", "true");
	icon.textContent = "✳";
	allButton.append(icon, document.createTextNode(` ${container.dataset.allLabel || "Todos"}`));

	const categories = new Map();
	for (const product of products) {
		if (product.category && !categories.has(product.category)) {
			categories.set(product.category, product.categoryLabel || product.category);
		}
	}
	const categoryButtons = [...categories].map(([category, label]) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `category-button${selectedCategory === category ? " is-selected" : ""}`;
		button.dataset.category = category;
		button.setAttribute("aria-pressed", String(selectedCategory === category));
		button.textContent = label;
		return button;
	});

	container.replaceChildren(allButton, ...categoryButtons);
}

export function bindCategoryFilters(container, onChange) {
	container?.addEventListener("click", (event) => {
		const button = event.target.closest("[data-category]");
		if (!button || !container.contains(button)) return;
		container.querySelectorAll("[data-category]").forEach((categoryButton) => {
			const selected = categoryButton === button;
			categoryButton.classList.toggle("is-selected", selected);
			categoryButton.setAttribute("aria-pressed", String(selected));
		});
		onChange(button.dataset.category);
	});
}

export function bindSearchForm(form, input, onSearch) {
	form?.addEventListener("submit", (event) => {
		event.preventDefault();
		onSearch(input?.value.trim() || "");
	});
}
