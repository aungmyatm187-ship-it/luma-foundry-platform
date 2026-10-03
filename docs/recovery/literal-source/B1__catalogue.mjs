import { readFileSync } from "node:fs";

const catalogueUrl = new URL("../config/catalogue.batch-01.json", import.meta.url);
export const batch01Catalogue = JSON.parse(readFileSync(catalogueUrl, "utf8"));

const requiredLicenceCodes = new Set(["standard", "agency"]);
const placeholderPattern = /(^$|REPLACE|\[.+\]|example\.com|your-(storefront|domain))/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isNonPlaceholderString(value) {
  return typeof value === "string" && value.trim().length > 0 && !placeholderPattern.test(value.trim());
}

/**
 * Validate every catalogue value that affects product identity, licence scope,
 * price, checkout, preview, and delivery. It intentionally rejects starter
 * placeholders so a server cannot start with a misleading product mapping.
 */
export function validateBatch01Catalogue(catalogue) {
  const errors = [];
  if (!isPlainObject(catalogue)) return ["Catalogue must be a JSON object."];
  if (catalogue.batch !== "01") errors.push('Catalogue "batch" must equal "01".');
  if (catalogue.currency !== "USD") errors.push('Catalogue "currency" must equal "USD" for the Batch 01 launch map.');
  if (!Array.isArray(catalogue.products) || catalogue.products.length !== 5) {
    errors.push("Batch 01 must contain exactly five template products.");
    return errors;
  }

  const indexSet = new Set();
  const skuSet = new Set();
  const slugSet = new Set();
  const variantIdSet = new Set();

  for (const product of catalogue.products) {
    const label = `Product ${product?.index ?? "?"}`;
    if (!isPlainObject(product)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!Number.isInteger(product.index) || product.index < 1 || product.index > 5 || indexSet.has(product.index)) {
      errors.push(`${label} must have a unique integer index from 1 to 5.`);
    }
    indexSet.add(product.index);

    for (const field of ["sku", "slug", "name", "category", "platform", "previewImageUrl", "livePreviewUrl", "setupGuideUrl"]) {
      if (!isNonPlaceholderString(product[field])) errors.push(`${label}.${field} is required and cannot be a placeholder.`);
    }
    if (isNonPlaceholderString(product.previewImageUrl) && !isHttpsUrl(product.previewImageUrl)) errors.push(`${label}.previewImageUrl must be HTTPS.`);
    if (isNonPlaceholderString(product.livePreviewUrl) && !isHttpsUrl(product.livePreviewUrl)) errors.push(`${label}.livePreviewUrl must be HTTPS.`);
    if (isNonPlaceholderString(product.setupGuideUrl) && !isHttpsUrl(product.setupGuideUrl)) errors.push(`${label}.setupGuideUrl must be HTTPS.`);
    if (skuSet.has(product.sku)) errors.push(`${label}.sku duplicates another product SKU.`);
    if (slugSet.has(product.slug)) errors.push(`${label}.slug duplicates another product slug.`);
    skuSet.add(product.sku);
    slugSet.add(product.slug);

    if (!Array.isArray(product.variants) || product.variants.length !== 2) {
      errors.push(`${label}.variants must contain exactly Standard and Agency entries.`);
      continue;
    }
    const licenceSet = new Set();
    for (const variant of product.variants) {
      const code = variant?.licenceCode;
      const variantLabel = `${label}.${code || "variant"}`;
      if (!requiredLicenceCodes.has(code) || licenceSet.has(code)) {
        errors.push(`${variantLabel} must have one unique licenceCode: standard or agency.`);
      }
      licenceSet.add(code);
      for (const field of ["lemonSqueezyProductId", "lemonSqueezyVariantId", "checkoutUrl", "licenceName"]) {
        if (!isNonPlaceholderString(variant?.[field])) errors.push(`${variantLabel}.${field} is required and cannot be a placeholder.`);
      }
      if (isNonPlaceholderString(variant?.checkoutUrl) && !isHttpsUrl(variant.checkoutUrl)) errors.push(`${variantLabel}.checkoutUrl must be HTTPS.`);
      if (!Number.isFinite(variant?.priceUsd) || variant.priceUsd <= 0) errors.push(`${variantLabel}.priceUsd must be a positive number.`);
      if (variantIdSet.has(variant?.lemonSqueezyVariantId)) errors.push(`${variantLabel}.lemonSqueezyVariantId duplicates another variant.`);
      variantIdSet.add(variant?.lemonSqueezyVariantId);
    }
    for (const requiredCode of requiredLicenceCodes) {
      if (!licenceSet.has(requiredCode)) errors.push(`${label} is missing the ${requiredCode} variant.`);
    }
  }

  for (const requiredIndex of [1, 2, 3, 4, 5]) {
    if (!indexSet.has(requiredIndex)) errors.push(`Batch 01 is missing product index ${requiredIndex}.`);
  }
  return errors;
}

export function assertBatch01CatalogueReady(catalogue = batch01Catalogue) {
  const errors = validateBatch01Catalogue(catalogue);
  if (errors.length) {
    throw new Error(`Batch 01 catalogue is not ready:\n- ${errors.join("\n- ")}`);
  }
  return catalogue;
}

export function createVariantMap(catalogue = batch01Catalogue) {
  const entries = catalogue.products.flatMap((product) =>
    product.variants.map((variant) => [String(variant.lemonSqueezyVariantId), {
      sku: `${product.sku}-${variant.licenceCode === "standard" ? "STD" : "AGY"}`,
      templateName: product.name,
      templateSlug: product.slug,
      category: product.category,
      platform: product.platform,
      livePreviewUrl: product.livePreviewUrl,
      setupGuideUrl: product.setupGuideUrl,
      productIndex: product.index,
      licenceCode: variant.licenceCode,
      licenceName: variant.licenceName,
      priceUsd: variant.priceUsd,
      lemonSqueezyProductId: String(variant.lemonSqueezyProductId),
      lemonSqueezyVariantId: String(variant.lemonSqueezyVariantId),
    }]),
  );
  return new Map(entries);
}

export const catalogueByVariantId = createVariantMap(batch01Catalogue);

export function getCatalogueEntry(variantId) {
  return catalogueByVariantId.get(String(variantId)) ?? null;
}
