# Implementation Plan — Shopify WhatsApp Order Automation

> Backend build plan (Phase 3). Derived from the full build guide.

## Goal

Node.js + Express backend that:

1. Receives Shopify `orders/create` → sends WhatsApp confirmation template (Confirm/Cancel buttons).
2. Receives customer button reply via WhatsApp → reflects Confirm/Cancel into Shopify.
3. Receives Shopify `fulfillments/create` → sends dispatch template with tracking number.

---

## Environment Variables

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=xxxxx
SHOPIFY_CLIENT_SECRET=xxxxx          # OAuth client-credentials grant + webhook HMAC signing
META_ACCESS_TOKEN=xxxxx
META_PHONE_NUMBER_ID=xxxxx
META_VERIFY_TOKEN=your-own-string    # must match Meta's webhook Callback URL config
DATABASE_URL=postgresql://...        # Neon Postgres
```

> **Note:** no static Shopify token. Backend requests one at startup via the client-credentials
> grant (see below).

---

## Shopify Access Token (client-credentials grant)

```
POST https://{SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token
{
  "client_id": "xxx",
  "client_secret": "xxx",
  "grant_type": "client_credentials"
}
```

Cache the returned `access_token` in memory and reuse.

---

## Database Schema

```sql
CREATE TABLE whatsapp_orders (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL,
  order_number TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending',   -- pending | confirmed | cancelled | dispatched
  tracking_number TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

---

## Backend Modules

| Module | Responsibility |
|--------|----------------|
| `db.js` | Postgres pool, `initSchema()`, `insertOrder()`, `findLatestByPhone()`, `findByShopifyOrderId()`, `updateStatus()` |
| `shopify.js` | `getShopifyAccessToken()`, `verifyShopifyWebhook()`, `updateShopifyOrder()`, `registerWebhooks()` |
| `whatsapp.js` | `sendWhatsAppTemplate()` |
| `index.js` | Express server, routes, startup |

---

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/webhooks/whatsapp` | Meta verification handshake (`hub.challenge`) |
| `POST` | `/webhooks/whatsapp` | Receive customer button reply → reflect in Shopify |
| `POST` | `/webhooks/shopify/order-created` | Send confirmation template + insert DB row |
| `POST` | `/webhooks/shopify/fulfillment-created` | Send dispatch template + update DB |
| `GET` | `/` | Health check |
| `GET` | `/register-webhooks` | One-time Shopify webhook registration (protected) |

---

## Message Templates (submit for Meta approval)

**`order_confirmation`** (Utility)
```
Hi {{1}}, thank you for your order #{{2}} (Rs {{3}}).
Please confirm your order:
[Quick Reply Button: Confirm]
[Quick Reply Button: Cancel]
```

**`order_dispatched`** (Utility)
```
Good news {{1}}! Your order #{{2}} has been dispatched.
Track it here: {{3}}
```

---

## Key Implementation Details

1. **Raw body capture** for Shopify HMAC verification — `express.json({ verify })` to store
   `req.rawBody`, then HMAC-SHA256 with `SHOPIFY_CLIENT_SECRET`.
2. **Phone lookup for replies** — match `whatsapp_orders` by `customer_phone` (most recent row).
3. **Confirm** → tag order `whatsapp-confirmed`; **Cancel** → cancel order via API.
4. **Graph API version** — verify current stable version before deploy.
5. **Shopify API version** — verify current stable version before deploy.

---

## Build Order (this phase)

1. Scaffold `package.json`, `.gitignore`, `.env.example`
2. `db.js` + schema
3. `shopify.js`
4. `whatsapp.js`
5. `index.js` + routes
6. `register-webhooks.js` (one-time script)
7. Install deps + verify startup

---

## After Deploy (next phases)

- Configure Meta webhook Callback URL
- Run `registerWebhooks()` against production
- Phase 4 testing → Phase 5 go-live
