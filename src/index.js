require('dotenv').config();

const express = require('express');
const db = require('./db');
const shopify = require('./shopify');
const { sendWhatsAppTemplate } = require('./whatsapp');
const { normalizePhone } = require('./phone');

const app = express();
const PORT = process.env.PORT || 3000;

// Prefixed logger with timestamps for easy reading in Railway logs.
function log(scope, msg) {
  console.log(`[${new Date().toISOString()}] [${scope}] ${msg}`);
}

// Format a Shopify shipping_address into a one-line string.
function formatAddress(addr) {
  if (!addr) return '';
  const parts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.zip,
    addr.province,
    addr.country
  ].filter(Boolean);
  return parts.join(', ');
}

// Serve static assets (e.g. logo used on the privacy policy page).
app.use('/assets', express.static(`${__dirname}/assets`));

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

// ---------- Privacy Policy page (for Meta app submission) ----------
app.get('/privacy-policy', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Qutab Shahi IND</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 760px; margin: 0 auto; padding: 40px 24px; }
    h1 { font-size: 1.8rem; margin-bottom: 4px; }
    .updated { color: #666; font-size: 0.9rem; margin-bottom: 32px; }
    h2 { font-size: 1.2rem; margin-top: 32px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    a { color: #0a66c2; }
    p, li { font-size: 0.98rem; }
    address { font-style: normal; }
    .logo { display: block; max-height: 80px; width: auto; margin-bottom: 20px; }
  </style>
</head>
<body>
  <img class="logo" src="/assets/AppIcon.icon/Assets/icon.png" alt="Qutab Shahi IND logo" />
  <h1>Privacy Policy</h1>
  <p class="updated"><strong>Last updated:</strong> September 17, 2026</p>

  <p>This Privacy Policy describes how <strong>Qutab Shahi IND</strong> ("we," "us," or "our")
  collects, uses, and protects information in connection with our internal order-notification
  system, which sends order confirmation and shipping updates to our customers via WhatsApp.</p>
  <p>This application is built and used solely for our own e-commerce store operations. It is
  not offered as a service to any third party, agency, or external client, and no other
  business has access to it.</p>

  <h2>1. Who We Are</h2>
  <p>Qutab Shahi IND operates an online store selling Kashmiri chai and qehwa products at
  qutabshahi.com. Our registered business address is:</p>
  <address>House No. 8/120, Khokhar Street, Pura Heeran, Sialkot, Sialkot</address>
  <p>For any questions about this policy or your data, contact us at:
  qutabshahikashmirichai@gmail.com</p>

  <h2>2. Information We Collect</h2>
  <p>When you place an order on our store, we collect and process the following information
  solely to fulfill and communicate about that order:</p>
  <ul>
    <li>Your name</li>
    <li>Your phone number</li>
    <li>Order details (order number, items purchased, order total)</li>
    <li>Shipping address</li>
    <li>Order status and shipping/tracking information</li>
  </ul>
  <p>This information originates from our Shopify store's order records — it is not collected
  directly from any Meta platform, and we do not collect any additional personal information
  through WhatsApp beyond what is necessary to identify which order a message relates to.</p>

  <h2>3. How We Use Your Information</h2>
  <p>We use the information above exclusively to:</p>
  <ul>
    <li>Send you an order confirmation message via WhatsApp, allowing you to confirm or cancel
    your order</li>
    <li>Send you a shipping/dispatch notification via WhatsApp once your order is fulfilled,
    including your tracking number</li>
    <li>Update your order's status in our store system based on your response</li>
  </ul>
  <p>We do not use your information for marketing, advertising, profiling, or any purpose beyond
  fulfilling and communicating about the specific order you placed.</p>

  <h2>4. How Information Is Shared</h2>
  <p>We share the minimum information necessary with the following services solely to operate
  this system:</p>
  <ul>
    <li><strong>Meta / WhatsApp Business Platform</strong> — to deliver order confirmation and
    shipping messages to you. Meta processes this information in accordance with its own
    <a href="https://www.whatsapp.com/legal/business-data-processing-terms" target="_blank" rel="noopener">WhatsApp Business Data Processing Terms</a>.</li>
    <li><strong>Railway</strong> — our backend hosting provider, which runs the software
    connecting our store to WhatsApp.</li>
    <li><strong>Neon</strong> — our database provider, which stores order-status records
    described in Section 2.</li>
  </ul>
  <p>We do not sell, rent, or otherwise share your information with any other third party,
  advertiser, or data broker. We do not use any information obtained through Meta's platforms
  for any purpose other than the order-notification service described in this policy, and we do
  not share Meta Platform Data with any third party except the service providers listed above,
  solely to operate this system on our behalf.</p>

  <h2>5. Data Retention</h2>
  <p>We retain order-related information for 12 months after an order is completed, after which
  it is deleted from our systems. We may retain information longer where required by applicable
  tax or business record-keeping laws.</p>

  <h2>6. Your Rights</h2>
  <p>You may:</p>
  <ul>
    <li>Request a copy of the information we hold about your order</li>
    <li>Request correction of inaccurate information</li>
    <li>Request deletion of your information, subject to our legal obligation to retain certain
    order and tax records</li>
  </ul>
  <p>To make any of these requests, contact us at qutabshahikashmirichai@gmail.com.</p>

  <h2>7. Data Security</h2>
  <p>We take reasonable technical and organizational measures to protect your information,
  including restricting access to order data to systems and personnel who need it to fulfill
  your order, and using industry-standard hosting and database providers.</p>

  <h2>8. Children's Privacy</h2>
  <p>Our store and this notification system are not directed at children, and we do not knowingly
  collect information from anyone under the age of 18.</p>

  <h2>9. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page
  with an updated "Last updated" date.</p>

  <h2>10. Contact Us</h2>
  <p>If you have any questions about this Privacy Policy or how your information is handled,
  contact us at:</p>
  <address>
    Qutab Shahi IND<br />
    House No. 8/120, Khokhar Street, Pura Heeran, Sialkot, Sialkot<br />
    qutabshahikashmirichai@gmail.com
  </address>
</body>
</html>`);
});

// ---------- Meta WhatsApp webhook: verification handshake ----------
app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    log('whatsapp', 'Verification handshake SUCCESS (token matched)');
    return res.status(200).send(challenge);
  }
  log('whatsapp', `Verification handshake FAILED (mode=${mode}, token=${token})`);
  res.sendStatus(403);
});

// ---------- Meta WhatsApp webhook: incoming messages ----------
app.post('/webhooks/whatsapp', express.json(), async (req, res) => {
  try {
    log('whatsapp', 'Incoming webhook received');
    log('whatsapp', `Raw payload: ${JSON.stringify(req.body)}`);
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message) {
      log('whatsapp', 'No message in payload (status/delivery update or empty) — ignoring');
      return res.sendStatus(200);
    }
    if (message.type !== 'button') {
      log('whatsapp', `Ignoring non-button message type: ${message.type}`);
      return res.sendStatus(200);
    }

    const phone = normalizePhone(message.from);
    const buttonText = message.button?.text || '';
    log('whatsapp', `Button reply received: phone=${phone}, button="${buttonText}"`);

    const order = await db.findLatestByPhone(phone);
    if (!order) {
      log('whatsapp', `No matching order found for phone ${phone} — ignoring reply`);
      return res.sendStatus(200);
    }

    const isConfirm = buttonText.toLowerCase() === 'confirm';
    const newStatus = isConfirm ? 'confirmed' : 'cancelled';
    log('whatsapp', `Matched DB order id=${order.id} (shopify_order_id=${order.shopify_order_id}); setting status=${newStatus}`);

    await db.updateStatus(order.id, newStatus);
    log('whatsapp', `DB status updated to "${newStatus}" for order id=${order.id}`);

    await shopify.setOrderStatusTag(order.shopify_order_id, newStatus);
    log('whatsapp', `Shopify order ${order.shopify_order_id} tagged "${newStatus}"`);

    if (!isConfirm) {
      await shopify.cancelShopifyOrder(order.shopify_order_id);
      log('whatsapp', `Shopify order ${order.shopify_order_id} cancelled`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [whatsapp] ERROR processing reply:`, err);
    res.sendStatus(200); // ack so Meta doesn't retry endlessly
  }
});

// ---------- Shopify webhook: order created ----------
app.post('/webhooks/shopify/order-created', rawBodyParser, async (req, res) => {
  try {
    log('shopify', 'orders/create webhook received');
    if (!shopify.verifyShopifyWebhook(req)) {
      log('shopify', 'HMAC verification FAILED — rejecting webhook (401)');
      return res.sendStatus(401);
    }
    log('shopify', 'HMAC verification passed');

    const order = req.body;
    const rawPhone =
      order.phone ||
      order.customer?.phone ||
      order.shipping_address?.phone ||
      order.billing_address?.phone;
    if (!rawPhone) {
      log('shopify', `Order ${order.id} has no phone number — skipping WhatsApp`);
      return res.sendStatus(200);
    }

    const phone = normalizePhone(rawPhone);
    log('shopify', `Order id=${order.id} raw phone="${rawPhone}" normalized to ${phone}`);

    const orderNumber = String(order.order_number ?? order.name ?? order.id);

    const lineItemsStr = (order.line_items || [])
      .map((item) => `${item.title} × ${item.quantity}`)
      .join(', ');
    log('shopify', `Order ${orderNumber}: ${(order.line_items || []).length} line items, total=${order.total_price}`);

    const totalPrice = order.total_price ?? '';
    const deliveryAddress = formatAddress(order.shipping_address);

    await sendWhatsAppTemplate(phone, 'order_confirmation', [
      orderNumber,
      lineItemsStr,
      totalPrice,
      deliveryAddress
    ]);
    log('shopify', `WhatsApp confirmation SENT to ${phone} for order ${orderNumber}`);

    await shopify.setOrderStatusTag(order.id, 'pending');
    log('shopify', `Order ${orderNumber} tagged as pending`);

    await db.insertOrder({
      shopifyOrderId: order.id,
      orderNumber,
      customerPhone: phone,
      customerName: order.customer?.first_name ?? null,
      itemsSummary: lineItemsStr
    });
    log('shopify', `Order ${orderNumber} saved to DB (phone=${phone})`);

    res.sendStatus(200);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [shopify] ERROR processing order-created:`, err);
    res.sendStatus(500);
  }
});

// ---------- Shopify webhook: fulfillment created ----------
app.post('/webhooks/shopify/fulfillment-created', rawBodyParser, async (req, res) => {
  try {
    log('shopify', 'fulfillments/create webhook received');
    if (!shopify.verifyShopifyWebhook(req)) {
      log('shopify', 'HMAC verification FAILED — rejecting webhook (401)');
      return res.sendStatus(401);
    }
    log('shopify', 'HMAC verification passed');

    const fulfillment = req.body;
    const trackingNumber = fulfillment.tracking_number;
    const trackingUrl = fulfillment.tracking_url || trackingNumber;
    log('shopify', `Fulfillment for shopify_order_id=${fulfillment.order_id}; tracking=${trackingNumber} url=${trackingUrl}`);

    const order = await db.findByShopifyOrderId(fulfillment.order_id);
    if (!order) {
      log('shopify', `No DB record for shopify_order_id=${fulfillment.order_id} — skipping dispatch message`);
      return res.sendStatus(200);
    }

    const customerName = order.customer_name || 'there';
    const itemsSummary = order.items_summary || 'your order';

    const dispatchParams = [
      customerName,
      order.order_number,
      fulfillment.tracking_company ?? '',
      fulfillment.tracking_number ?? '',
      fulfillment.tracking_url ?? '',
      itemsSummary
    ];
    log('shopify', `order_dispatched params (${dispatchParams.length}): ${JSON.stringify(dispatchParams)}`);

    await sendWhatsAppTemplate(order.customer_phone, 'order_dispatched', dispatchParams);
    log('shopify', `Dispatch message SENT to ${order.customer_phone} for order ${order.order_number}`);

    await shopify.setOrderStatusTag(order.shopify_order_id, 'dispatched');
    log('shopify', `Order ${order.order_number} tagged as dispatched`);

    await db.updateStatus(order.id, 'dispatched', trackingNumber);
    log('shopify', `DB status updated to "dispatched" (tracking=${trackingNumber}) for order id=${order.id}`);

    res.sendStatus(200);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [shopify] ERROR processing fulfillment-created:`, err);
    res.sendStatus(500);
  }
});

// ---------- One-time webhook registration (protected) ----------
app.get('/register-webhooks', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key || key !== process.env.WEBHOOK_REGISTER_KEY) {
      log('shopify', 'register-webhooks attempt with INVALID key — rejected (403)');
      return res.status(403).json({ error: 'invalid key' });
    }

    const baseAddress = `https://${req.headers.host}`;
    log('shopify', `Registering Shopify webhooks with base address ${baseAddress}`);
    const results = await shopify.registerWebhooks(baseAddress);
    for (const r of results) {
      log('shopify', `Webhook "${r.topic}" -> status ${r.status}`);
    }
    log('shopify', 'Webhook registration complete');
    res.json({ results });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [shopify] register-webhooks FAILED:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Startup ----------
(async () => {
  try {
    await db.initSchema();
    log('db', 'Schema ready (whatsapp_orders table exists)');
    log('startup', `DEFAULT_COUNTRY_CODE=${process.env.DEFAULT_COUNTRY_CODE || '92'}`);
    log('startup', `GRAPH_API_VERSION=${process.env.GRAPH_API_VERSION || 'v21.0'}`);
    app.listen(PORT, () => {
      log('server', `Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [server] FAILED to start:`, err);
    process.exit(1);
  }
})();
