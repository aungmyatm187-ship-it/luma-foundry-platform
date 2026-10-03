function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Webhook payload is missing ${field}.`);
  }
  return value.trim();
}

function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertHttpsUrl(value, field) {
  const candidate = requiredString(value, field);
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`Webhook payload has an invalid ${field}.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`Webhook payload ${field} must use HTTPS.`);
  }
  return url.toString();
}

/**
 * Extract only the fields this service needs. Unknown payload properties are
 * intentionally ignored so the handler is resilient to additive API changes.
 */
export function extractOrder(payload) {
  const data = payload?.data;
  if (!data || data.type !== "orders") {
    throw new Error("Expected a Lemon Squeezy order resource.");
  }

  const attributes = data.attributes ?? {};
  const firstItem = attributes.first_order_item ?? {};
  const email = requiredString(attributes.user_email, "data.attributes.user_email");

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Webhook payload has an invalid customer email.");
  }

  return {
    resourceId: requiredString(String(data.id), "data.id"),
    orderIdentifier: requiredString(attributes.identifier, "data.attributes.identifier"),
    status: requiredString(attributes.status, "data.attributes.status").toLowerCase(),
    email,
    customerName: optionalString(attributes.user_name),
    currency: optionalString(attributes.currency),
    total: Number.isFinite(Number(attributes.total)) ? Number(attributes.total) : null,
    testMode: attributes.test_mode === true,
    productName: optionalString(firstItem.product_name),
    variantName: optionalString(firstItem.variant_name),
    variantId: requiredString(String(firstItem.variant_id), "data.attributes.first_order_item.variant_id"),
    receiptUrl: assertHttpsUrl(attributes.urls?.receipt, "data.attributes.urls.receipt"),
  };
}
