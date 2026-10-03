import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { products } from "../catalogue.js";

const root = new URL("../", import.meta.url);
const runtimeFiles = ["index.html", "shop.html", "template.html", "app.js", "shop.js", "template.js", "catalogue.js", "styles.css"];
const blocked = /\b(?:Apple|Stripe|Leica|Porsche)\b|apple\.com|stripe\.com|leica-camera\.com|porsche\.com/i;
const lumaHost = "lumafoundry-jx4veohg.manus.space";

test("master storefront runtime has no benchmark-brand terms, domains, or direct reference assets", async () => {
  const sources = await Promise.all(runtimeFiles.map((file) => readFile(new URL(file, root), "utf8")));
  for (const source of sources) assert.doesNotMatch(source, blocked);
});

test("active catalogue preserves only Luma-hosted preview URLs and authorised Luma image URLs", () => {
  assert.equal(products.length, 50);
  for (const product of products) {
    assert.equal(new URL(product.previewUrl).hostname, lumaHost);
    if (product.imageUrl) assert.equal(new URL(product.imageUrl).hostname, lumaHost);
    assert.doesNotMatch(`${product.id} ${product.name} ${product.category} ${product.previewUrl} ${product.imageUrl || ""}`, blocked);
  }
});

test("legal archive exposes the independent-studio IP declaration as a working draft", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  assert.match(homepage, /Working intellectual-property declaration — owner and legal review required before commercial publication\./);
  assert.match(homepage, /Luma Foundry is an independent design studio\. All product templates, layout engineering, and curated assets are original properties of Luma Foundry\./);
  assert.match(homepage, /Reference to third-party design aesthetics is used strictly for stylistic inspiration and does not imply affiliation or endorsement\./);
});
