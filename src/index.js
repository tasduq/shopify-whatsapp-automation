require('dotenv').config();

const express = require('express');
const db = require('./db');
const shopify = require('./shopify');
const { sendWhatsAppTemplate } = require('./whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Capture raw body for Shopify webhook HMAC verification.
const rawBodyParser = express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
});

// ---------- Health check ----------
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'shopify-whatsapp-order-automation' });
});

// ---------- Meta WhatsApp webhook: verification handshake ----------
app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ---------- Meta WhatsApp webhook: incoming messages ----------
app.post('/webhooks/whatsapp', express.json(), async (req, res) => {
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message || message.type !== 'button') return res.sendStatus(200);

    const phone = message.from;
    const buttonText = message.button?.text || '';

    const order = await db.findLatestByPhone(phone);
    if (!order) {
      console.warn(`[whatsapp] no order found for phone ${phone}`);
      return res.sendStatus(200);
    }

    const newStatus = buttonText.toLowerCase() === 'confirm' ? 'confirmed' : 'cancelled';
    await db.updateStatus(order.id, newStatus);
    await shopify.updateShopifyOrder(order.shopify_order_id, newStatus);

    res.sendStatus(200);
  } catch (err) {
    console.error('[whatsapp] error processing reply:', err);
    res.sendStatus(200); // ack so Meta doesn't retry endlessly
  }
});

// ---------- Shopify webhook: order created ----------
app.post('/webhooks/shopify/order-created', rawBodyParser, async (req, res) => {
  try {
    if (!shopify.verifyShopifyWebhook(req)) return res.sendStatus(401);

    const order = req.body;
    const phone = order.customer?.phone || order.phone;
    if (!phone) return res.sendStatus(200);

    const firstName = order.customer?.first_name || 'there';
    const orderNumber = String(order.order_number ?? order.name ?? order.id);
    const totalPrice = order.total_price ?? '';

    await sendWhatsAppTemplate(phone, 'order_confirmation', [
      firstName,
      orderNumber,
      totalPrice
    ]);

    await db.insertOrder({
      shopifyOrderId: order.id,
      orderNumber,
      customerPhone: phone
    });

    res.sendStatus(200);
  } catch (err) {
    console.error('[shopify] error processing order-created:', err);
    res.sendStatus(500);
  }
});

// ---------- Shopify webhook: fulfillment created ----------
app.post('/webhooks/shopify/fulfillment-created', rawBodyParser, async (req, res) => {
  try {
    if (!shopify.verifyShopifyWebhook(req)) return res.sendStatus(401);

    const fulfillment = req.body;
    const trackingNumber = fulfillment.tracking_number;
    const trackingUrl = fulfillment.tracking_url || trackingNumber;

    const order = await db.findByShopifyOrderId(fulfillment.order_id);
    if (!order) return res.sendStatus(200);

    await sendWhatsAppTemplate(order.customer_phone, 'order_dispatched', [
      order.order_number,
      order.order_number,
      trackingUrl
    ]);

    await db.updateStatus(order.id, 'dispatched', trackingNumber);

    res.sendStatus(200);
  } catch (err) {
    console.error('[shopify] error processing fulfillment-created:', err);
    res.sendStatus(500);
  }
});

// ---------- One-time webhook registration (protected) ----------
app.get('/register-webhooks', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key || key !== process.env.WEBHOOK_REGISTER_KEY) {
      return res.status(403).json({ error: 'invalid key' });
    }

    const baseAddress = `https://${req.headers.host}`;
    const results = await shopify.registerWebhooks(baseAddress);
    res.json({ results });
  } catch (err) {
    console.error('[shopify] register-webhooks failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Startup ----------
(async () => {
  try {
    await db.initSchema();
    console.log('[db] schema ready');
    app.listen(PORT, () => {
      console.log(`[server] listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[server] failed to start:', err);
    process.exit(1);
  }
})();
