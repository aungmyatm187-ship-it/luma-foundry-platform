import { catalogueMeta, products } from "./catalogue.js";

const id = new URLSearchParams(window.location.search).get("id");
const product = products.find((item) => item.id === id);
const isFlagship = product?.id === "prd-axiom-grid";
const root = document.querySelector("#template");

function productVisual(product) {
  if (product.imageUrl) {
    return `<img src="${product.imageUrl}" alt="${product.name} live demo preview" />`;
  }
  return `<div class="template-placeholder" aria-hidden="true"><span>${product.index} / LIVE</span><p>${product.name}</p><i>Luma Foundry</i></div>`;
}

if (!product) {
  document.title = "Template not found — Luma Foundry";
  root.innerHTML = `<section class="not-found"><p class="eyebrow">Luma Foundry / Current collection</p><h1>That direction<br /><em>is not in the archive.</em></h1><p>Return to the active catalogue and choose one of the verified live templates.</p><a class="button button-signal" href="/shop.html">Browse templates <span aria-hidden="true">↗</span></a></section>`;
} else {
  document.title = `${product.name} — Luma Foundry`;
  root.innerHTML = `<section class="template-hero ${product.tone}"><div class="template-hero-copy"><a class="back-link" href="/shop.html">← Back to catalogue</a><p class="eyebrow">${product.index} / Live collection / ${product.category}</p>${isFlagship ? '<p class="eyebrow">Flagship candidate / evidence pending</p>' : ""}<h1>${product.name}</h1><p>${product.direction}</p><a class="button button-signal" href="${product.previewUrl}" target="_blank" rel="noopener noreferrer">Open live demo <span aria-hidden="true">↗</span></a></div><figure class="${product.imageUrl ? "" : "without-image"}">${productVisual(product)}<figcaption>Verified live-demo destination from the shared Luma Foundry source of truth.</figcaption></figure></section><section class="template-details"><div><p class="eyebrow">Release state</p><h2>Explore the direction.<br /><em>Checkout comes later.</em></h2></div><div class="template-facts"><article><p class="eyebrow">What is ready</p><p>Live visual demo from Operator A’s active product record.</p></article>${isFlagship ? '<article><p class="eyebrow">Commercial gate</p><p>Source commit, design history, asset licences, contributor rights, dependency notices, and counsel review are still required before sale.</p></article>' : ""}<article><p class="eyebrow">What remains offline</p><p>File download, checkout link, licence variant mapping, and post-purchase delivery.</p></article><article><p class="eyebrow">Why the boundary</p><p>Platform requirements and included files are not assumed before they are confirmed in the shared dataset.</p></article></div></section><section class="purchase-preview"><p class="eyebrow">Commercial release / preview only</p><h2>Choose your licence<br /><em>when release data is verified.</em></h2><div class="purchase-grid"><article><p class="eyebrow">Single-use standard</p><p class="price">$79</p><p>One template for one finished website.</p><button class="button button-quiet" type="button" disabled>Checkout offline</button></article><article><p class="eyebrow">Multi-use agency</p><p class="price">$249</p><p>One template for up to five finished websites.</p><button class="button button-quiet" type="button" disabled>Checkout offline</button></article></div><p class="legal-note">Digital product. Full working licence and refund text is available in the <a href="/#archive">legal archive</a>. The merchant-of-record checkout is deliberately not activated in this preview.</p></section><section class="source-strip"><span>Shared source: ${catalogueMeta.source}</span><span>Product ID: ${product.id}</span><span>Preview state: ${catalogueMeta.paymentState}</span></section>`;
}
