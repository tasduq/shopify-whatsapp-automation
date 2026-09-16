const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Set it in Railway under Service > Variables.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_orders (
      id SERIAL PRIMARY KEY,
      shopify_order_id BIGINT NOT NULL,
      order_number TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      tracking_number TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
}

async function insertOrder({ shopifyOrderId, orderNumber, customerPhone }) {
  const result = await pool.query(
    `INSERT INTO whatsapp_orders (shopify_order_id, order_number, customer_phone)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [shopifyOrderId, orderNumber, customerPhone]
  );
  return result.rows[0];
}

async function findLatestByPhone(phone) {
  const result = await pool.query(
    `SELECT * FROM whatsapp_orders WHERE customer_phone = $1
     ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function findByShopifyOrderId(shopifyOrderId) {
  const result = await pool.query(
    `SELECT * FROM whatsapp_orders WHERE shopify_order_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [shopifyOrderId]
  );
  return result.rows[0] || null;
}

async function updateStatus(id, status, trackingNumber = null) {
  await pool.query(
    `UPDATE whatsapp_orders SET status = $1, tracking_number = COALESCE($2, tracking_number)
     WHERE id = $3`,
    [status, trackingNumber, id]
  );
}

module.exports = {
  pool,
  initSchema,
  insertOrder,
  findLatestByPhone,
  findByShopifyOrderId,
  updateStatus
};
