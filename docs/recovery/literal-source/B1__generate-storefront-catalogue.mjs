import { mkdirSync, writeFileSync } from "node:fs";
import { batch01Catalogue, assertBatch01CatalogueReady } from "../src/catalogue.mjs";

assertBatch01CatalogueReady(batch01Catalogue);

const storefrontCatalogue = {
  batch: batch01Catalogue.batch,
  currency: batch01Catalogue.currency,
  products: batch01Catalogue.products.map((product) => ({
    index: product.index,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    category: product.category,
    platform: product.platform,
    previewImageUrl: product.previewImageUrl,
    livePreviewUrl: product.livePreviewUrl,
    startingPriceUsd: Math.min(...product.variants.map((variant) => variant.priceUsd)),
    variants: product.variants.map((variant) => ({
      licenceCode: variant.licenceCode,
      licenceName: variant.licenceName,
      priceUsd: variant.priceUsd,
      checkoutUrl: variant.checkoutUrl,
    })),
  })),
};

const outputDirectory = new URL("../generated/", import.meta.url);
mkdirSync(outputDirectory, { recursive: true });
const outputPath = new URL("batch-01-storefront-catalogue.json", outputDirectory);
writeFileSync(outputPath, `${JSON.stringify(storefrontCatalogue, null, 2)}\n`);

console.log(`Wrote validated storefront catalogue to ${outputPath.pathname}`);
