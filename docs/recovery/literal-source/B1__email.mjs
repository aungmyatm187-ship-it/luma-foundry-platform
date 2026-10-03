function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeHttpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Delivery link must use HTTPS.");
  return url.toString();
}

export function buildDeliveryEmail({ order, catalogueEntry, supportEmail }) {
  const templateName = escapeHtml(catalogueEntry.templateName || order.productName || "your Luma Foundry template");
  const licenceName = escapeHtml(catalogueEntry.licenceName);
  const orderNumber = escapeHtml(order.orderIdentifier);
  const receiptUrl = escapeHtml(safeHttpsUrl(order.receiptUrl));
  const safeSupportEmail = escapeHtml(supportEmail);

  return {
    subject: `Your Luma Foundry files are ready — ${catalogueEntry.templateName}`,
    text: [
      "LUMA FOUNDRY",
      "",
      "Your purchase is complete.",
      "",
      catalogueEntry.templateName,
      catalogueEntry.licenceName,
      `Order #${order.orderIdentifier}`,
      "",
      `Access your files: ${order.receiptUrl}`,
      "",
      "Before you begin:",
      "- Read the included setup notes.",
      "- Keep this email and your receipt with your project records.",
      "- Review the licence before using the files for another project or client.",
      "",
      `Need help with access? Contact ${supportEmail} and include your order number.`,
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#080808;color:#f6f4ef;font-family:Arial,sans-serif;">
    <main style="max-width:640px;margin:0 auto;padding:48px 24px;">
      <p style="margin:0 0 36px;font-size:11px;font-weight:700;letter-spacing:2px;">LUMA FOUNDRY</p>
      <h1 style="margin:0 0 12px;font-size:36px;line-height:1.1;font-family:Georgia,serif;font-weight:400;">Your purchase is complete.</h1>
      <p style="margin:0 0 32px;color:#b8b7b1;font-size:16px;line-height:1.6;">Your files and licence details are ready.</p>
      <section style="border-top:1px solid #2b2b2b;border-bottom:1px solid #2b2b2b;padding:22px 0;margin:0 0 32px;">
        <p style="margin:0 0 8px;font-size:20px;line-height:1.3;">${templateName}</p>
        <p style="margin:0 0 8px;color:#d7ff3f;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${licenceName}</p>
        <p style="margin:0;color:#b8b7b1;font-size:13px;">Order #${orderNumber}</p>
      </section>
      <p style="margin:0 0 34px;"><a href="${receiptUrl}" style="display:inline-block;background:#d7ff3f;color:#080808;padding:14px 20px;font-weight:700;text-decoration:none;">ACCESS YOUR FILES</a></p>
      <h2 style="margin:0 0 10px;font-size:18px;font-weight:600;">Before you begin</h2>
      <ul style="padding-left:20px;margin:0 0 34px;color:#b8b7b1;font-size:15px;line-height:1.7;">
        <li>Read the included setup notes.</li>
        <li>Keep this email and your receipt with your project records.</li>
        <li>Review the licence before using the files for another project or client.</li>
      </ul>
      <p style="margin:0;color:#b8b7b1;font-size:14px;line-height:1.6;">Need help with access? Contact <a href="mailto:${safeSupportEmail}" style="color:#f6f4ef;">${safeSupportEmail}</a> and include your order number.</p>
    </main>
  </body>
</html>`,
  };
}

export async function sendWithResend({ config, eventKey, order, catalogueEntry }) {
  const email = buildDeliveryEmail({
    order,
    catalogueEntry,
    supportEmail: config.supportEmail,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
      // Resend retains the key for 24 hours. This protects against retrying a
      // webhook after the email API accepted the request but before this server
      // saved the response to the database.
      "Idempotency-Key": `luma-delivery/${eventKey}`,
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [order.email],
      reply_to: config.supportEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [
        { name: "source", value: "lemon-squeezy" },
        { name: "sku", value: catalogueEntry.sku },
        { name: "order", value: order.resourceId },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend delivery failed with HTTP ${response.status}: ${payload?.message || "unknown error"}`);
  }

  if (!payload?.id) {
    throw new Error("Resend delivery response did not include an email ID.");
  }

  return payload.id;
}
