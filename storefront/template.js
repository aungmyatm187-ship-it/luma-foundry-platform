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
  root.innerHTML = `<section class="template-hero ${product.tone}"><div class="template-hero-copy"><a class="back-link" href="/shop.html">← Back to catalogue</a><p class="eyebrow">${product.index} / Live collection / ${product.category}</p>${isFlagship ? '<p class="eyebrow">Flagship candidate / evidence pending</p>' : ""}<h1>${product.name}</h1><p>${product.direction}</p><a class="button button-signal" href="${product.previewUrl}" target="_blank" rel="noopener noreferrer">Open live demo <span aria-hidden="true">↗</span></a></div><figure class="${product.imageUrl ? "" : "without-image"}">${productVisual(product)}<figcaption>Verified live-demo destination from the shared Luma Foundry source of truth.</figcaption></figure></section><section class="template-details"><div><p class="eyebrow">Release state</p><h2>Explore the direction.<br /><em>Enquire to proceed.</em></h2></div><div class="template-facts"><article><p class="eyebrow">What is ready</p><p>Live visual demo from Operator A’s active product record.</p></article>${isFlagship ? '<article><p class="eyebrow">Commercial gate</p><p>Source commit, design history, asset licences, contributor rights, dependency notices, and counsel review are still required before sale.</p></article>' : ""}<article><p class="eyebrow">What happens next</p><p>Submit an enquiry to start the buyer conversation; checkout activates once the merchant of record is wired.</p></article><article><p class="eyebrow">Why the boundary</p><p>Platform requirements and included files are not assumed before they are confirmed in the shared dataset.</p></article></div></section><section class="purchase-preview"><p class="eyebrow">Commercial release / preview</p><h2>Choose your licence<br /><em>or ask a question.</em></h2><div class="purchase-grid"><article><p class="eyebrow">Single-use standard</p><p class="price">$79</p><p>One template for one finished website.</p></article><article><p class="eyebrow">Multi-use agency</p><p class="price">$249</p><p>One template for up to five finished websites.</p></article></div><form id="enquiry-form" class="enquiry-form" data-product-id="${product.id}"><label>Your name<input name="name" type="text" autocomplete="name" placeholder="Name" /></label><label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com" /></label><label>Message<textarea name="message" rows="3" placeholder="Which licence, or a question about this direction…"></textarea></label><button class="button button-signal" type="submit">Send enquiry <span aria-hidden="true">↗</span></button><p class="enquiry-status" aria-live="polite"></p></form><p class="legal-note">Digital product. Read the <a href="/licence.html">buyer terms &amp; licence</a>. Checkout is handled by the merchant of record when activated.</p></section><section class="source-strip"><span>Shared source: ${catalogueMeta.source}</span><span>Product ID: ${product.id}</span><span>Preview state: ${catalogueMeta.paymentState}</span></section>`;

  const form = root.querySelector("#enquiry-form");
  const status = root.querySelector(".enquiry-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    status.textContent = "Sending…";
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, ...data }),
      });
      status.textContent = res.ok ? "Enquiry received — we'll be in touch." : "Could not send. Please try again.";
    } catch {
      status.textContent = "Could not send. Please try again.";
    }
  });
}
