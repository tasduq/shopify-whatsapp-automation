# Shopify WhatsApp Order Automation — Project Status

> Last updated: 2026-09-12

## Project Overview

Automate order communication for a Shopify store via WhatsApp (Meta WhatsApp Cloud API):

1. **Order confirmation** — when an order is placed, send a WhatsApp template message with
   **Confirm** / **Cancel** quick-reply buttons.
2. **Decision reflection** — the customer's button tap updates Shopify (tag `whatsapp-confirmed`
   for Confirm, cancel the order for Cancel).
3. **Dispatch notification** — when an order is fulfilled, send an automatic "dispatched" message
   with the tracking number.

---

## Current Status — what's done ✅

| # | Task | Status |
|---|------|--------|
| 1 | Meta app created, WhatsApp product added, test number claimed | ✅ Done |
| 2 | Shopify Dev Dashboard app created, scopes configured, installed | ✅ Done |
| 3 | Neon Postgres database created, `DATABASE_URL` set | ✅ Done |
| 4 | `META_VERIFY_TOKEN` chosen and set | ✅ Done |
| 5 | All environment variables collected in `.env` | ✅ Done |

## Current Status — what's left ⬜

| # | Task | Status |
|---|------|--------|
| 6 | Build the backend (Node.js + Express) | ⬜ **Next to start** |
| 7 | Message templates submitted for Meta approval | ⬜ To do |
| 8 | Backend deployed to Railway | ⬜ To do |
| 9 | Webhook callback URL configured in Meta dashboard | ⬜ Blocked on deploy |
| 10 | "Check test webhooks" panel confirmed working | ⬜ Blocked on deploy |
| 11 | Register Shopify webhooks (`orders/create`, `fulfillments/create`) | ⬜ Blocked on deploy |
| 12 | End-to-end testing (Phase 4) | ⬜ To do |
| 13 | Go-live checklist (Phase 5) | ⬜ To do |

---

## Environment Variables — inventory

Confirmed present in `.env`:

| Variable | Set? | Notes |
|----------|------|-------|
| `SHOPIFY_STORE_DOMAIN` | ✅ | `m6vjex-me.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | ✅ | From Dev Dashboard |
| `SHOPIFY_API_SECRET` | ✅ | `shpss_...` — for Shopify webhook HMAC verification |
| `META_ACCESS_TOKEN` | ✅ | Test token (expires in 24h — needs permanent token before go-live) |
| `META_PHONE_NUMBER_ID` | ✅ | |
| `META_VERIFY_TOKEN` | ✅ | Webhook handshake |
| `DATABASE_URL` | ✅ | Neon Postgres |

⚠️ **Discrepancies to resolve before building:**

1. **`SHOPIFY_ACCESS_TOKEN`** is still a placeholder (`shpat_xxxxx`). Per the new Dev Dashboard
   flow (documented in the build guide), the static token is no longer given — the backend must
   fetch one via the **client-credentials grant** using `client_id` + `client_secret`.
2. **`SHOPIFY_CLIENT_SECRET` is missing.** The guide calls for it for both the OAuth
   client-credentials grant *and* Shopify's webhook HMAC signing. `.env` currently has
   `SHOPIFY_API_SECRET` (an `shpss_` string) instead — need to confirm whether that `shpss_`
   value is the correct client secret, or if a separate `SHOPIFY_CLIENT_SECRET` is required from
   the Dev Dashboard.

These will be resolved as part of the backend build work.

---

## Architecture / Components

```mermaid
flowchart LR
    SH[Shopify Store] -->|orders/create<br/>fulfillments/create| BE[Backend<br/>Node.js + Express]
    BE -->|send template| WA[Meta WhatsApp API]
    WA -->|button reply| BE
    BE -->|confirm/cancel| SH
    BE -->[(Neon Postgres<br/>whatsapp_orders)]
```

**Database table** — `whatsapp_orders`:

```
id | shopify_order_id | order_number | customer_phone | status | tracking_number | created_at
```

`status` values: `pending` → `confirmed` | `cancelled` | `dispatched`

**Webhook endpoints:**
- `GET /webhooks/whatsapp` — Meta verification handshake
- `POST /webhooks/whatsapp` — receive button replies
- `POST /webhooks/shopify/order-created` — order confirmation trigger
- `POST /webhooks/shopify/fulfillment-created` — dispatch trigger

**Message templates (need Meta approval):**
- `order_confirmation` (Utility) — with Confirm/Cancel buttons
- `order_dispatched` (Utility) — with tracking link

---

## Next Steps — starting point

> The **immediate next step is Phase 3: building the backend server**. The workspace currently has
> no code, only `.env`.

1. **Scaffold** the Node.js + Express backend
   - Resolve the `SHOPIFY_CLIENT_SECRET` / `SHOPIFY_API_SECRET` question first
   - Implement `getShopifyAccessToken()` (client-credentials grant)
2. **Implement** the DB table + the 7 core pieces from the build guide:
   - Shopify webhook HMAC verification
   - `orders/create` handler → send confirmation
   - Reusable `sendWhatsAppTemplate()`
   - `GET`/`POST` WhatsApp webhook handlers
   - `updateShopifyOrder()` (confirm/cancel reflection)
   - `fulfillments/create` handler → send dispatch
   - `registerWebhooks()` (run once)
3. **Submit** the two message templates for Meta approval (can be done in parallel)
4. **Deploy** to Railway Hobby, then:
   - Configure Meta webhook callback URL
   - Run `registerWebhooks()` against production
5. **Test** end-to-end (Phase 4)
6. **Go-live** (Phase 5) — permanent token, real number verification (start early)

**First concrete todo:** scaffold the backend and settle the Shopify credential question.