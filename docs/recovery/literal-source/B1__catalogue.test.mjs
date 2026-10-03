import assert from "node:assert/strict";
import test from "node:test";
import { createVariantMap, validateBatch01Catalogue } from "../src/catalogue.mjs";

function validCatalogue() {
  return {
    batch: "01",
    currency: "USD",
    products: [1, 2, 3, 4, 5].map((index) => ({
      index,
      sku: `LF-B01-0${index}`,
      slug: `template-${index}`,
      name: `Template ${index}`,
      category: "Services",
      platform: "Webflow",
      previewImageUrl: `https://cdn.lumafoundry.test/template-${index}.jpg`,
      livePreviewUrl: `https://preview.lumafoundry.test/template-${index}`,
      setupGuideUrl: `https://docs.lumafoundry.test/template-${index}`,
      variants: [
        {
          licenceCode: "standard",
          licenceName: "Single-Use Standard Licence",
          priceUsd: 79,
          lemonSqueezyProductId: `product-${index}`,
          lemonSqueezyVariantId: `variant-${index}-standard`,
          checkoutUrl: `https://checkout.lumafoundry.test/template-${index}-standard`,
        },
        {
          licenceCode: "agency",
          licenceName: "Multi-Use Commercial Agency Licence",
          priceUsd: 249,
          lemonSqueezyProductId: `product-${index}`,
          lemonSqueezyVariantId: `variant-${index}-agency`,
          checkoutUrl: `https://checkout.lumafoundry.test/template-${index}-agency`,
        },
      ],
    })),
  };
}

test("accepts a complete five-product Batch 01 catalogue", () => {
  const catalogue = validCatalogue();
  assert.deepEqual(validateBatch01Catalogue(catalogue), []);

  const map = createVariantMap(catalogue);
  assert.equal(map.size, 10);
  assert.equal(map.get("variant-3-agency").sku, "LF-B01-03-AGY");
  assert.equal(map.get("variant-3-agency").licenceCode, "agency");
});

test("rejects placeholders, duplicate variant IDs, and a missing agency licence", () => {
  const invalid = validCatalogue();
  invalid.products[0].name = "[TEMPLATE 01 NAME]";
  invalid.products[1].variants[1].lemonSqueezyVariantId = "variant-2-standard";
  invalid.products[2].variants.pop();

  const errors = validateBatch01Catalogue(invalid);
  assert.ok(errors.some((error) => error.includes("Product 1.name")));
  assert.ok(errors.some((error) => error.includes("duplicates another variant")));
  assert.ok(errors.some((error) => error.includes("exactly Standard and Agency")));
});
