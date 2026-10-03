import { batch01Catalogue, validateBatch01Catalogue } from "../src/catalogue.mjs";

const errors = validateBatch01Catalogue(batch01Catalogue);
if (errors.length) {
  console.error("\nBatch 01 catalogue is incomplete. Fix the following before starting the webhook:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Batch 01 catalogue is complete and valid.");
  console.table(batch01Catalogue.products.flatMap((product) =>
    product.variants.map((variant) => ({
      index: product.index,
      sku: `${product.sku}-${variant.licenceCode === "standard" ? "STD" : "AGY"}`,
      name: product.name,
      licence: variant.licenceCode,
      priceUsd: variant.priceUsd,
      variantId: variant.lemonSqueezyVariantId,
    })),
  ));
}
