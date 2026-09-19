const crypto = require('crypto');

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const BASE_URL = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}`;

// Status tags applied to Shopify orders (our own tags only — never touch unrelated tags).
const STATUS_TAGS = {
  pending: '⏳ Confirmation Pending',
  confirmed: '✅ Confirmed',
  cancelled: '❌ Cancelled',
  dispatched: '📦 Dispatched'
};

function log(scope, msg) {
  console.log(`[${new Date().toISOString()}] [${scope}] ${msg}`);
}

let shopifyAccessToken = null;
let tokenExpiry = 0;

async function getShopifyAccessToken() {
  // Cache the token; refresh before it expires (client-credentials tokens are short-lived).
  if (shopifyAccessToken && Date.now() < tokenExpiry) {
    log('shopify', 'Using cached Shopify access token');
    return shopifyAccessToken;
  }

  log('shopify', 'Fetching new Shopify access token (client-credentials grant)');
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[${new Date().toISOString()}] [shopify] FAILED to fetch access token (${res.status}):`, text);
    throw new Error(`Failed to fetch Shopify access token (${res.status}): ${text}`);
  }

  const data = await res.json();
  shopifyAccessToken = data.access_token;

  // Default cache of 20 minutes; respect `expires_in` when provided (capped at ~1 day).
  const expiresIn = Math.min((data.expires_in || 1200) - 60, 86340);
  tokenExpiry = Date.now() + expiresIn * 1000;
  log('shopify', `Shopify access token obtained (expires in ~${expiresIn}s)`);

  return shopifyAccessToken;
}

function verifyShopifyWebhook(req) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  if (!hmac || !req.rawBody) return false;

  const digest = crypto
    .createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
    .update(req.rawBody, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  } catch {
    return false;
  }
}

async function setOrderStatusTag(orderId, statusKey) {
  const token = await getShopifyAccessToken();
  const newTag = STATUS_TAGS[statusKey];

  // 1. Read the order's current tags.
  const getRes = await fetch(`${BASE_URL}/orders/${orderId}.json`, {
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
  });
  if (!getRes.ok) {
    const text = await getRes.text();
    console.error(`[${new Date().toISOString()}] [shopify] FAILED to GET order ${orderId} (${getRes.status}):`, text);
    throw new Error(`Failed to GET order (${getRes.status}): ${text}`);
  }
  const { order } = await getRes.json();
  const existingTags = order.tags ? order.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  // 2. Remove any of our own status tags (so we replace, not pile up), keep unrelated tags.
  const ourTagValues = Object.values(STATUS_TAGS);
  const remainingTags = existingTags.filter((t) => !ourTagValues.includes(t));

  // 3. Append the new status tag.
  const mergedTags = [...remainingTags, newTag];

  // 4. PUT the merged tags back.
  const putRes = await fetch(`${BASE_URL}/orders/${orderId}.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: { id: orderId, tags: mergedTags.join(', ') } })
  });
  if (!putRes.ok) {
    const text = await putRes.text();
    console.error(`[${new Date().toISOString()}] [shopify] FAILED to update tags for order ${orderId} (${putRes.status}):`, text);
    throw new Error(`Failed to update tags (${putRes.status}): ${text}`);
  }

  log('shopify', `Order ${orderId} tagged "${newTag}" (tags now: ${mergedTags.join(', ')})`);
  return mergedTags;
}

async function cancelShopifyOrder(orderId) {
  const token = await getShopifyAccessToken();
  log('shopify', `Cancelling Shopify order ${orderId}`);
  const res = await fetch(`${BASE_URL}/orders/${orderId}/cancel.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[${new Date().toISOString()}] [shopify] FAILED to cancel order ${orderId} (${res.status}):`, text);
    throw new Error(`Failed to cancel order (${res.status}): ${text}`);
  }
  log('shopify', `Order ${orderId} cancelled successfully`);
}

async function registerWebhooks(baseAddress) {
  const token = await getShopifyAccessToken();
  const normalized = baseAddress.replace(/\/+$/, '');
  const topics = [
    { topic: 'orders/create', address: `${normalized}/webhooks/shopify/order-created` },
    { topic: 'fulfillments/create', address: `${normalized}/webhooks/shopify/fulfillment-created` }
  ];

  const results = [];
  for (const hook of topics) {
    const res = await fetch(`${BASE_URL}/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ webhook: { ...hook, format: 'json' } })
    });
    results.push({ topic: hook.topic, status: res.status, body: await res.text() });
  }

  return results;
}

module.exports = {
  BASE_URL,
  SHOPIFY_API_VERSION,
  STATUS_TAGS,
  getShopifyAccessToken,
  verifyShopifyWebhook,
  setOrderStatusTag,
  cancelShopifyOrder,
  registerWebhooks
};
