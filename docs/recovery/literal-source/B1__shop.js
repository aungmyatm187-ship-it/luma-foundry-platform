import { catalogueMeta, products } from "./catalogue.js";

const grid = document.querySelector("#catalogue-grid");
const count = document.querySelector("#catalogue-count");
const filters = [...document.querySelectorAll(".filter")];

function matchesFilter(product, filter) {
  return filter === "all" || product.collection === filter;
}

function previewVisual(product) {
  if (product.imageUrl) return `<img src="${product.imageUrl}" alt="${product.name} live demo preview" loading="lazy" />`;
  return `<div class="card-placeholder" aria-hidden="true"><span>${product.index}</span><p>Live demo</p><i>Luma Foundry</i></div>`;
}

function productCard(product) {
  return `<article class="template-card ${product.tone}" data-product-id="${product.id}"><div class="card-image-wrap ${product.imageUrl ? "" : "without-image"}">${previewVisual(product)}<div class="card-image-overlay"></div><p class="card-index">${product.index} / LIVE</p><span class="card-arrow" aria-hidden="true">↗</span></div><div class="card-copy"><p class="eyebrow">${product.category}</p><h3>${product.name}</h3><p>${product.direction}</p></div><div class="card-actions"><a class="card-link" href="${product.previewUrl}" target="_blank" rel="noopener noreferrer">Live demo <span aria-hidden="true">↗</span></a><a class="card-link" href="/template.html?id=${product.id}">View direction <span aria-hidden="true">↗</span></a></div></article>`;
}

function render(filter = "all") {
  const visible = products.filter((product) => matchesFilter(product, filter));
  grid.innerHTML = visible.map(productCard).join("");
  count.textContent = `${visible.length} ${visible.length === 1 ? "live direction" : "live directions"}`;
}

document.querySelectorAll("[data-active-count]").forEach((element) => {
  element.textContent = catalogueMeta.activeTemplateCount;
});

filters.forEach((button) => button.addEventListener("click", () => {
  filters.forEach((filter) => { filter.classList.remove("is-active"); filter.setAttribute("aria-pressed", "false"); });
  button.classList.add("is-active"); button.setAttribute("aria-pressed", "true"); render(button.dataset.filter);
}));
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#site-nav");
menuToggle.addEventListener("click", () => { const open = menuToggle.getAttribute("aria-expanded") === "true"; menuToggle.setAttribute("aria-expanded", String(!open)); nav.classList.toggle("is-open", !open); });
render();
