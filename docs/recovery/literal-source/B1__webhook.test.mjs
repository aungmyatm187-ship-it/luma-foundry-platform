import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveryEmail } from "../src/email.mjs";
import { extractOrder } from "../src/order.mjs";
import { createLemonSignature, verifyLemonSignature } from "../src/security.mjs";

const signingSecret = "test-signing-secret";

const orderPayload = {
  meta: { event_name: "order_created" },
  data: {
    type: "orders",
    id: "order-resource-123",
    attributes: {
      identifier: "order-public-456",
      status: "paid",
      user_email: "buyer@example.com",
      user_name: "Buyer Name",
      currency: "USD",
      total: 7900,
      test_mode: false,
      first_order_item: {
        product_name: "Template One",
        variant_name: "Standard",
        variant_id: "variant-standard-1",
      },
      urls: { receipt: "https://app.lemonsqueezy.com/my-orders/signed-example" },
    },
  },
};

test("accepts a valid Lemon Squeezy HMAC-SHA256 signature", () => {
  const rawBody = Buffer.from(JSON.stringify(orderPayload));
  const signature = createLemonSignature(rawBody, signingSecret);

  assert.equal(verifyLemonSignature({ rawBody, signature, signingSecret }), true);
  assert.equal(verifyLemonSignature({ rawBody, signature: "wrong", signingSecret }), false);
});

test("extracts only the required paid-order fields", () => {
  const order = extractOrder(orderPayload);

  assert.equal(order.resourceId, "order-resource-123");
  assert.equal(order.variantId, "variant-standard-1");
  assert.equal(order.receiptUrl, "https://app.lemonsqueezy.com/my-orders/signed-example");
  assert.equal(order.email, "buyer@example.com");
});

test("requires an HTTPS receipt URL", () => {
  const invalid = structuredClone(orderPayload);
  invalid.data.attributes.urls.receipt = "http://example.test/download";

  assert.throws(() => extractOrder(invalid), /must use HTTPS/);
});

test("renders escaped template content and uses the signed receipt URL", () => {
  const order = extractOrder(orderPayload);
  const email = buildDeliveryEmail({
    order,
    catalogueEntry: {
      sku: "LF-B01-01-STD",
      templateName: "<Unsafe Template>",
      licenceName: "Single-Use Standard Licence",
    },
    supportEmail: "support@lumafoundry.example",
  });

  assert.match(email.html, /&lt;Unsafe Template&gt;/);
  assert.doesNotMatch(email.html, /<Unsafe Template>/);
  assert.match(email.html, /https:\/\/app\.lemonsqueezy\.com\/my-orders\/signed-example/);
  assert.match(email.text, /Access your files:/);
});
