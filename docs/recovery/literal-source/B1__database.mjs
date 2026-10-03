import mysql from "mysql2/promise";

export function createDatabase(databaseUrl) {
  return mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    enableKeepAlive: true,
    timezone: "Z",
  });
}

export async function reserveEvent(pool, { eventKey, eventName, resourceId, orderIdentifier, rawPayload }) {
  await pool.execute(
    `INSERT INTO luma_webhook_events
      (event_key, event_name, resource_id, order_identifier, status, raw_payload_json)
     VALUES (?, ?, ?, ?, 'pending', ?)
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
    [eventKey, eventName, resourceId, orderIdentifier, rawPayload],
  );

  const [existingRows] = await pool.execute(
    `SELECT status FROM luma_webhook_events WHERE event_key = ?`,
    [eventKey],
  );
  const current = existingRows[0];

  if (!current) throw new Error("Could not read the stored webhook event.");
  if (current.status === "completed" || current.status === "ignored") {
    return { state: "already_final" };
  }

  // Lock only briefly: email work is bounded by a 10-second HTTP timeout. If
  // the process dies mid-flight, a Lemon Squeezy retry can acquire the event.
  const [claim] = await pool.execute(
    `UPDATE luma_webhook_events
     SET status = 'processing',
         attempts = attempts + 1,
         locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 20 SECOND),
         last_error = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE event_key = ?
       AND (
         status IN ('pending', 'failed')
         OR (status = 'processing' AND (locked_until IS NULL OR locked_until < UTC_TIMESTAMP()))
       )`,
    [eventKey],
  );

  return claim.affectedRows === 1 ? { state: "acquired" } : { state: "in_progress" };
}

export async function upsertPaidOrder(pool, { order, catalogueEntry }) {
  await pool.execute(
    `INSERT INTO luma_orders
      (order_resource_id, order_identifier, customer_email, customer_name, variant_id, sku, template_name, licence_name, payment_status, fulfilment_status, receipt_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'pending', ?)
     ON DUPLICATE KEY UPDATE
       customer_email = VALUES(customer_email),
       customer_name = VALUES(customer_name),
       variant_id = VALUES(variant_id),
       sku = VALUES(sku),
       template_name = VALUES(template_name),
       licence_name = VALUES(licence_name),
       payment_status = 'paid',
       receipt_url = VALUES(receipt_url),
       updated_at = CURRENT_TIMESTAMP`,
    [
      order.resourceId,
      order.orderIdentifier,
      order.email,
      order.customerName || null,
      order.variantId,
      catalogueEntry.sku,
      catalogueEntry.templateName,
      catalogueEntry.licenceName,
      order.receiptUrl,
    ],
  );
}

export async function markOrderDelivered(pool, { orderResourceId, resendEmailId }) {
  await pool.execute(
    `UPDATE luma_orders
     SET fulfilment_status = 'delivered', resend_email_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE order_resource_id = ?`,
    [resendEmailId, orderResourceId],
  );
}

export async function markOrderRefunded(pool, { orderResourceId }) {
  await pool.execute(
    `UPDATE luma_orders
     SET payment_status = 'refunded', fulfilment_status = 'refunded', updated_at = CURRENT_TIMESTAMP
     WHERE order_resource_id = ?`,
    [orderResourceId],
  );
}

export async function completeEvent(pool, { eventKey, outcome, resendEmailId = null }) {
  await pool.execute(
    `UPDATE luma_webhook_events
     SET status = 'completed', outcome = ?, resend_email_id = ?, locked_until = NULL,
         completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE event_key = ?`,
    [outcome, resendEmailId, eventKey],
  );
}

export async function ignoreEvent(pool, { eventKey, outcome }) {
  await pool.execute(
    `UPDATE luma_webhook_events
     SET status = 'ignored', outcome = ?, locked_until = NULL,
         completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE event_key = ?`,
    [outcome, eventKey],
  );
}

export async function failEvent(pool, { eventKey, error }) {
  await pool.execute(
    `UPDATE luma_webhook_events
     SET status = 'failed', locked_until = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP
     WHERE event_key = ?`,
    [String(error?.message || error).slice(0, 4000), eventKey],
  );
}
