# TextFlow — AI Text Tool SaaS on Flexprice
## Architecture & Implementation Plan

Verified against your running instance's actual swagger spec (`flexprice/docs/swagger/swagger.json`), not assumed API shapes. Endpoint names, field names, and enums below are exact.

---

## 1. Core Action & Premium Feature

**Core metered action:** `text_processed` — user submits text, gets back a summary or rewrite. Metered unit = **characters processed** (not "requests"), because it maps to real cost (AI API billing) and gives you a natural SUM aggregation instead of a flat COUNT.

**Premium feature (boolean gate):** **Tone-adjusted rewriting** (Professional / Casual / Academic / Creative). Free users only get default summarize/rewrite; tone selection is Pro-only. This is a clean boolean flag with an obvious visual gate (a locked dropdown with an upgrade tooltip).

**Secondary Pro benefit (optional, not required by spec but easy to add):** larger max input length per request (1,000 chars Free / 8,000 chars Pro) — this is just a client-side + backend constant, not a Flexprice entity, so don't over-engineer it.

Why this combination: it gives you one clean metered feature (characters, SUM aggregation, monthly reset) and one clean boolean feature (tone selector), which is exactly the two entitlement types the assignment asks for — nothing more, nothing less.

---

## 2. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + Express, **pure JSON API** (no server-rendered views) | Fastest to stand up on Windows, no native build tools, JSON-first (matches Flexprice's JSON API), cleanly decoupled from the frontend |
| Database (app-side) | SQLite via `better-sqlite3` | Zero setup, single file, no separate service to run alongside your already-heavy Docker stack |
| AI processing | Hugging Face Inference API (`facebook/bart-large-cnn` for summarize, a T5 paraphrase model for rewrite) | Free tier, no local ML deps, one HTTP call |
| Frontend | **React + Vite**, plain CSS (no UI framework) | Vite's dev server + build are lightweight and Windows-friendly (no webpack config, no node-gyp native deps); still a "simple React" app — a handful of components, no router complexity, no state library |
| Auth | express-session + bcrypt, cookie-based, **CORS with `credentials: true`** | "Simple auth is fine" per spec — skip JWT/OAuth; cookie session works across the two dev ports as long as CORS + `sameSite: "lax"` + `withCredentials` are set correctly (details in 4a) |
| HTTP client to Flexprice | axios, thin wrapper module (backend only — the React app never talks to Flexprice directly) | Centralizes the `x-api-key` header and base URL; also keeps the API key off the browser entirely |

Two dev processes: the Express API on `:4000`, the Vite React app on `:5173` (proxied to `:4000` for `/api/*` in dev, so the browser only ever talks to one origin and avoids CORS complexity). In production you'd `vite build` and have Express serve the static `dist/` folder from the same origin — but for the take-home demo, running both dev servers side by side is simplest and is what the README will document.

---

## 3. Database Schema (SQLite — app-side only)

Flexprice is the source of truth for **usage** and **entitlements** — the app DB never duplicates that. It only stores what Flexprice doesn't: local auth and a thin operation log for the UI history.

```sql
-- users: local auth + link to Flexprice customer
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  external_customer_id TEXT UNIQUE NOT NULL,   -- e.g. "user_7f3a2b" — sent to Flexprice
  flexprice_customer_id TEXT,                  -- Flexprice's internal customer.id, cached after creation
  flexprice_subscription_id TEXT,              -- active subscription id, cached after creation
  plan TEXT NOT NULL DEFAULT 'free',           -- 'free' | 'pro' — mirror only, never the source of truth for gating
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- operations: local history for the UI (Flexprice usage numbers still come live from Flexprice)
CREATE TABLE operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  operation_type TEXT NOT NULL,   -- 'summarize' | 'rewrite'
  tone TEXT,                      -- null unless Pro tone feature used
  input_chars INTEGER NOT NULL,
  input_preview TEXT,
  output_preview TEXT,
  flexprice_event_id TEXT,        -- the event_id sent to Flexprice, for traceability
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- simulated_customers: only used by the pricing-simulation script, kept separate from real users
CREATE TABLE simulated_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_customer_id TEXT UNIQUE NOT NULL,
  profile TEXT NOT NULL,          -- 'light' | 'medium' | 'heavy'
  flexprice_customer_id TEXT,
  flexprice_subscription_id TEXT
);
```

Rule of thumb enforced throughout the plan: **usage numbers and entitlement checks are always read live from Flexprice**, never from a locally cached counter. The `plan` column on `users` is purely a UI convenience (e.g., to render "Pro" badge without a round trip) — every gating decision re-verifies against `GET /customers/external/{external_id}/entitlements`.

---

## 4. Directory Structure

```
D:\Assingment\
├── flexprice\                          (existing, untouched)
├── flexprice-assignment.pdf
├── textflow\                           (new project root)
│   ├── server\                         (Express JSON API)
│   │   ├── package.json
│   │   ├── .env                        (FLEXPRICE_API_KEY, FLEXPRICE_BASE_URL, HF_API_TOKEN, SESSION_SECRET, PORT, CLIENT_ORIGIN)
│   │   ├── .env.example
│   │   ├── data\
│   │   │   └── textflow.db             (SQLite file, gitignored)
│   │   ├── src\
│   │   │   ├── server.js               (Express app entrypoint — cors(), express-session, JSON body parser)
│   │   │   ├── db\
│   │   │   │   ├── init.js             (creates tables if not exist)
│   │   │   │   └── queries.js          (prepared statements)
│   │   │   ├── flexprice\
│   │   │   │   ├── client.js           (axios instance, x-api-key header, base URL)
│   │   │   │   ├── customers.js        (createCustomer, getEntitlements, getUsageSummary)
│   │   │   │   ├── events.js           (ingestEvent, bulkIngestEvent)
│   │   │   │   └── subscriptions.js    (createSubscription, cancelSubscription, changeSubscription)
│   │   │   ├── services\
│   │   │   │   ├── aiService.js        (Hugging Face calls: summarize, rewrite, tone rewrite)
│   │   │   │   └── entitlementService.js (checkCanProcess, checkToneFeature — wraps Flexprice reads with friendly error shaping)
│   │   │   ├── routes\
│   │   │   │   ├── auth.js             (POST /api/auth/signup, /login, /logout, GET /api/auth/me)
│   │   │   │   ├── text.js             (POST /api/process — the metered action)
│   │   │   │   ├── usage.js            (GET /api/usage — dashboard data)
│   │   │   │   └── billing.js          (POST /api/upgrade, POST /api/downgrade)
│   │   │   └── middleware\
│   │   │       └── requireAuth.js
│   │   └── scripts\
│   │       ├── seed-flexprice.js       (idempotent: creates features, meter, plans, entitlements, prices)
│   │       ├── reset-flexprice.js      (optional: deletes seeded entities for a clean re-run)
│   │       └── simulate-pricing.js     (the pricing experiment simulation — Section 8)
│   ├── client\                         (React + Vite SPA)
│   │   ├── package.json
│   │   ├── vite.config.js              (dev proxy: /api -> http://localhost:4000)
│   │   ├── index.html
│   │   └── src\
│   │       ├── main.jsx
│   │       ├── App.jsx                 (simple route switch: landing/signup/login/dashboard — no router library needed for 4 views)
│   │       ├── api.js                  (fetch wrapper, credentials: 'include', base '/api')
│   │       ├── context\AuthContext.jsx (current user + plan, loaded via GET /api/auth/me)
│   │       ├── pages\
│   │       │   ├── Landing.jsx
│   │       │   ├── Signup.jsx
│   │       │   ├── Login.jsx
│   │       │   └── Dashboard.jsx       (text processor + usage bar, main demo screen)
│   │       ├── components\
│   │       │   ├── UsageBar.jsx        (progress bar, color shift by percent)
│   │       │   ├── ToneSelector.jsx    (disabled + tooltip when entitlement is off)
│   │       │   ├── UpgradeModal.jsx    (triggered by 402/403 API responses)
│   │       │   └── PlanBadge.jsx
│   │       └── styles\index.css
│   └── README.md                       (setup + demo script steps for the reviewer)
```

---

## 5. Flexprice Entity Design (exact fields, verified against your swagger)

### 5.1 Meter — the raw event aggregation rule

`POST /meters` is not directly exposed; a meter is created **inline via the feature's `meter` object**, or standalone via `CreateMeterRequest` fields (`aggregation`, `event_name`, `name`, `reset_usage` are required). We'll create it inline through the feature.

```jsonc
// used inside CreateFeatureRequest.meter
{
  "name": "Characters Processed Meter",
  "event_name": "text_processed",
  "aggregation": { "type": "SUM", "field": "char_count" },
  "reset_usage": "BILLING_PERIOD"
}
```

- `event_name`: `text_processed` — every summarize/rewrite call ingests one event with this name.
- `aggregation.type`: `SUM` (not `COUNT`) summing the `char_count` property — this is the "sensible aggregation" the spec asks for, since characters (not call count) is the real cost driver.
- `reset_usage`: `BILLING_PERIOD` — usage resets every billing cycle (monthly), matching "periodic reset."

### 5.2 Feature #1 — Metered: `characters_processed`

```jsonc
POST /features
{
  "name": "Characters Processed",
  "type": "metered",
  "unit_singular": "character",
  "unit_plural": "characters",
  "meter": { /* object above */ }
}
```

### 5.3 Feature #2 — Boolean: `tone_selector`

```jsonc
POST /features
{
  "name": "Tone Selector",
  "type": "boolean",
  "description": "Adjust rewrite tone: Professional, Casual, Academic, Creative"
}
```

### 5.4 Plans

```jsonc
POST /plans   { "name": "Free", "lookup_key": "free_plan", "description": "Free tier — 2,000 characters/month" }
POST /plans   { "name": "Pro",  "lookup_key": "pro_plan",  "description": "Pro tier — 50,000 characters/month + tone control" }
```

### 5.5 Entitlements (attach features to plans)

```jsonc
// Free plan — metered, hard-capped
POST /entitlements
{
  "plan_id": "<free_plan_id>",
  "feature_id": "<characters_processed_feature_id>",
  "feature_type": "metered",
  "usage_limit": 2000,
  "usage_reset_period": "MONTHLY",
  "is_soft_limit": false,
  "is_enabled": true
}

// Free plan — boolean tone feature OFF
POST /entitlements
{
  "plan_id": "<free_plan_id>",
  "feature_id": "<tone_selector_feature_id>",
  "feature_type": "boolean",
  "is_enabled": false
}

// Pro plan — metered, higher cap
POST /entitlements
{
  "plan_id": "<pro_plan_id>",
  "feature_id": "<characters_processed_feature_id>",
  "feature_type": "metered",
  "usage_limit": 50000,
  "usage_reset_period": "MONTHLY",
  "is_soft_limit": false,
  "is_enabled": true
}

// Pro plan — boolean tone feature ON
POST /entitlements
{
  "plan_id": "<pro_plan_id>",
  "feature_id": "<tone_selector_feature_id>",
  "feature_type": "boolean",
  "is_enabled": true
}
```

### 5.6 Prices (Pricing Model A — for the base experiment)

Attach a usage price to the `characters_processed` meter on the **Pro** plan (Free stays $0 fixed, no usage price needed beyond the entitlement cap itself):

```jsonc
POST /prices   // Pricing Model A: PACKAGE (bundles of characters)
{
  "type": "USAGE",
  "billing_model": "PACKAGE",
  "entity_type": "PLAN",
  "entity_id": "<pro_plan_id>",
  "meter_id": "<characters_processed_meter_id>",
  "currency": "usd",
  "amount": "0.50",           // $0.50 per package
  "billing_period": "MONTHLY",
  "invoice_cadence": "ARREAR",
  "transform_quantity": { "divide_by": 1000 }   // package = 1000 chars → $0.50 per 1,000 chars
}
```

Plus a flat monthly base fee on Pro:

```jsonc
POST /prices
{
  "type": "FIXED",
  "billing_model": "FLAT_FEE",
  "entity_type": "PLAN",
  "entity_id": "<pro_plan_id>",
  "currency": "usd",
  "amount": "9.00",
  "billing_period": "MONTHLY",
  "invoice_cadence": "ADVANCE"
}
```

Pricing Model B (the alternative, tiered) is built as a **separate Pro-tier plan clone** — see Section 8.

---

## 6. Runtime Flow — How the App Talks to Flexprice

### Signup
1. User submits email/password → hash password, generate `external_customer_id` (e.g. `user_<uuid short>`).
2. `POST /customers` with `{ external_id, name, email }` → cache returned `customer.id` as `flexprice_customer_id`.
3. `POST /subscriptions` with `{ external_customer_id, plan_id: free_plan_id, currency: "usd", billing_period: "MONTHLY" }` → cache `subscription.id`.
4. Insert local `users` row with `plan = 'free'`.

### Every text-processing request (the metered action)
1. **Check entitlement first**: `GET /customers/external/{external_id}/entitlements` → find the `characters_processed` `AggregatedFeature` → compare `entitlement.usage_limit` vs. current usage (see next step) plus the incoming request's char count.
2. **Check current usage**: `GET /customers/usage?customer_id=<flexprice_customer_id>&feature_ids=<characters_processed_id>` → read `current_usage` / `usage_percent` from `FeatureUsageSummary`.
3. If `current_usage + input_chars > total_limit` → return **402/403 with a friendly JSON payload** (`{ "blocked": true, "reason": "quota_exceeded", "limit": 2000, "used": 1950 }`) → frontend renders the upgrade modal, never a 500.
4. If tone parameter is set, first check the boolean `tone_selector` entitlement's `is_enabled`; if false, block with `{ "blocked": true, "reason": "feature_locked" }`.
5. Otherwise, call Hugging Face, get the result.
6. `POST /events` with `{ event_name: "text_processed", external_customer_id, properties: { char_count, operation_type, tone } }`.
7. Store a row in local `operations` table for the UI history (not for enforcement).

### Usage dashboard page
- `GET /customers/usage?...` for the live bar + `GET /customers/external/{external_id}/entitlements` for plan/feature state — rendered directly, no local shadow copy.

### Upgrade
- `POST /subscriptions/{id}/change/execute` (or cancel Free sub + create new Pro sub — either works; `change/execute` is cleaner and preserves customer history) with `plan_id: pro_plan_id`.
- Update local `users.plan = 'pro'` (display cache only).
- Immediately re-fetch entitlements to unlock the tone selector in the UI.

### CORS & session notes (React app is a separate origin in dev)
- Express: `app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }))`, session cookie `sameSite: "lax"`, `secure: false` (localhost, no HTTPS needed for the demo).
- React: every `fetch`/axios call sets `credentials: 'include'`; Vite dev proxy (`vite.config.js` → `server.proxy['/api']`) forwards `/api/*` to `http://localhost:4000`, so in practice the browser sees same-origin requests during `npm run dev` and CORS mostly stays out of the way — the explicit CORS config is a fallback if you ever open the client on a different port directly.
- All backend routes live under `/api/*` (e.g. `/api/auth/signup`, `/api/process`, `/api/usage`, `/api/upgrade`) so the Vite proxy rule is a single clean prefix match.

---

## 7. Step-by-Step Implementation Plan

**Step 1 — Scaffold both halves**
Backend (`textflow/server`): `npm init`, install `express`, `express-session`, `cors`, `better-sqlite3`, `bcrypt`, `axios`, `dotenv`, `nanoid`. Frontend (`textflow/client`): `npm create vite@latest client -- --template react` (JavaScript, not TS, to keep it simple). Create the directory tree from Section 4. Write `db/init.js` to create tables on boot. Configure `client/vite.config.js` with the `/api` proxy to `http://localhost:4000`.

**Step 2 — Flexprice client wrapper**
Build `server/src/flexprice/client.js`: axios instance with `baseURL: process.env.FLEXPRICE_BASE_URL`, header `x-api-key`. Build thin functions in `customers.js`, `events.js`, `subscriptions.js` mapping 1:1 to the exact endpoints from Section 6. Smoke-test each with a one-off script hitting your already-verified `GET /customers`.

**Step 3 — Seed script (`server/scripts/seed-flexprice.js`)**
Idempotent script: check `POST /features/search` / `POST /plans/search` for existing names first (so re-running doesn't duplicate), then create the meter+features, plans, entitlements, and Pricing-Model-A prices from Section 5. Print all generated IDs to console **and** write them to `server/.env` (`FREE_PLAN_ID=...`, `PRO_PLAN_ID=...`, `CHAR_FEATURE_ID=...`, `TONE_FEATURE_ID=...`, `CHAR_METER_ID=...`) so the app can reference them without hardcoding magic strings.

**Step 4 — Auth API**
`POST /api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `GET /api/auth/me` using `express-session` + `bcrypt` + `cors({ credentials: true })`. Signup handler performs the 4-step Flexprice bootstrap from Section 6, returns the created user's plan/email so the React app can populate `AuthContext` immediately without a second round trip.

**Step 5 — Entitlement service**
`entitlementService.js` with `checkUsageQuota(externalId, incomingChars)` and `checkBooleanFeature(externalId, featureId)`, both wrapping the live Flexprice reads and returning a normalized `{ allowed: bool, reason, limit, used }` shape — this is the single choke point every route calls, so gating logic lives in one place, not scattered across routes.

**Step 6 — AI service**
`aiService.js`: `summarize(text)`, `rewrite(text, tone)` calling Hugging Face Inference API via axios with the model IDs from Section 2, plus local fallback logic (retry once, then return a clear error) since free-tier HF endpoints occasionally cold-start (503).

**Step 7 — Text processing route**
`POST /api/process` (protected by `requireAuth`): entitlement check → tone check (if requested) → AI call → Flexprice event ingestion → local history insert → JSON response with `{ result, usage: { used, limit, percent } }` so the React dashboard can update the bar from the same response without a second round trip.

**Step 8 — Usage & billing routes**
`GET /api/usage` returns live Flexprice entitlement + usage data for the dashboard. `POST /api/upgrade` and `POST /api/downgrade` call `subscriptions/{id}/change/execute`.

**Step 9 — React frontend**
Build the four pages/components from the Section 4 tree. `App.jsx` does a simple conditional render based on `AuthContext` state (no `react-router` needed for four screens — one less dependency to install on Windows). `Dashboard.jsx`: textarea, operation buttons, `ToneSelector` (disabled + tooltip if `tone_selector.is_enabled === false`), `UsageBar` (color shifts green → amber → red by `usage_percent`), `UpgradeModal` (triggered whenever an API call returns `{ blocked: true }`, not a crash page). One `styles/index.css`, no Tailwind/component library — keeps it genuinely "simple React."

**Step 10 — Manual demo run-through**
Run `npm run dev` in both `server/` and `client/` (two terminals). Walk the exact script: signup → process text a few times → watch the bar climb → hit the cap → see the blocked state + modal (not an error page) → click upgrade → tone dropdown unlocks immediately → process with a tone → confirm higher cap. Fix any rough edges here before recording/screenshotting the demo.

**Step 11 — Pricing experiment & simulation script**
Detailed in Section 8 below — build after the core app works, since it reuses the same Flexprice client wrapper (`server/scripts/simulate-pricing.js`).

**Step 12 — README**
Write setup steps for both halves (`server`: `npm install`, `.env` values, `node scripts/seed-flexprice.js`, `npm run dev`; `client`: `npm install`, `npm run dev`) and the demo walkthrough script, so the reviewer can reproduce everything from a clean Flexprice instance.

---

## 8. Pricing Experiment & Simulation Script

**Pricing Model A (already defined in 5.6):** PACKAGE billing — $0.50 per 1,000 characters (via `transform_quantity.divide_by: 1000`), plus a $9 flat monthly fee.

**Pricing Model B (the alternative):** TIERED billing on a cloned Pro plan (`pro_plan_tiered`), same meter, using `tier_mode: "SLAB"` and `tiers`:

```jsonc
POST /prices
{
  "type": "USAGE",
  "billing_model": "TIERED",
  "entity_type": "PLAN",
  "entity_id": "<pro_plan_tiered_id>",
  "meter_id": "<characters_processed_meter_id>",
  "currency": "usd",
  "billing_period": "MONTHLY",
  "invoice_cadence": "ARREAR",
  "tier_mode": "SLAB",
  "tiers": [
    { "up_to": 10000, "unit_amount": "0.0008" },
    { "up_to": 30000, "unit_amount": "0.0005" },
    { "up_to": null,  "unit_amount": "0.0003" }
  ]
}
```
(Same $9 flat fee reused.) This gives you a genuinely different economic curve: Model A charges linearly per package regardless of volume; Model B rewards heavy usage with a lower marginal rate — a believable A/B pricing comparison.

**`scripts/simulate-pricing.js`:**
1. Create 5 simulated customers via `POST /customers` (`external_id`: `sim_light_1`, `sim_medium_1`, `sim_heavy_1`, `sim_heavy_2`, `sim_medium_2`), store in `simulated_customers` table.
2. Subscribe each to the **Pro (Model A)** plan first (`POST /subscriptions`).
3. Push a realistic burst of `text_processed` events per profile using `POST /events/bulk`:
   - light: ~15 events/month, 200–400 chars each (~4,000 chars total)
   - medium: ~60 events/month, 300–800 chars each (~30,000 chars total)
   - heavy: ~200 events/month, 400–1200 chars each (~120,000 chars total)
   Randomize within ranges for realism; timestamp them spread across the last 30 days.
4. Pull back usage via `GET /customers/usage?customer_id=...` for each — confirms Flexprice's own aggregation matches what you pushed (sanity check).
5. **Compute cost locally** for both pricing models using the same aggregated `qty_total` per customer (don't require live invoices — just replicate the pricing math in JS, referencing the exact tier/package parameters from the prices above, so the script is fast and self-contained):
   - Model A: `9 + ceil(total_chars / 1000) * 0.50`
   - Model B: `9 + slab_calc(total_chars, tiers)`
6. Print a comparison table to console (and optionally write `simulation-results.csv`):

```
Customer      Profile   Chars    Model A ($)   Model B ($)   Cheaper
sim_light_1   light     4,120    $11.06        $12.30        A
sim_medium_1  medium    31,450   $24.73        $20.86        B
sim_heavy_1   heavy     118,900  $68.45        $47.51        B
```

7. Add a one-paragraph written takeaway in the README: Model A is simpler and predictable for light users but punishes heavy users; Model B (tiered/slab) rewards volume and is more competitive for retention of heavy users — a real pricing trade-off, not just a technical exercise.

---

## Summary Checklist Against the Assignment

| Requirement | Where it's satisfied |
|---|---|
| Signup registers Flexprice customer + Free subscription | Section 6, Step 4 |
| Metered core action | `text_processed` event, char-count SUM meter |
| Premium feature gated by boolean entitlement | `tone_selector` |
| Two plans, two entitlement types, different limits | Section 5.4–5.5 |
| Entitlement checks via API (not hardcoded) | `entitlementService.js`, Section 6 |
| Upgrade mechanism, no payment gateway | `subscriptions/{id}/change/execute` |
| Friendly block on limit/feature (no 500) | Step 7 route contract |
| Usage page reads live from Flexprice | Section 6, `GET /usage` |
| Alternative pricing model experiment | PACKAGE vs. TIERED, Section 8 |
| Simulation script: 3–5 customers, usage burst, cost comparison | Section 8 |
