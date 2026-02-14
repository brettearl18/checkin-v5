# Payment Report – CTO Build Plan

## 1. Goal

A **Payment Report** that lets the coach (and optionally admin) see, at a glance, whether each client is **up to date on payments** or not. No new payment logic—we surface existing Stripe-backed data in a dedicated report view.

---

## 2. Current State (What We Already Have)

### 2.1 Data model (Firestore `clients`)

Payment state is already stored on each client document and kept in sync by the Stripe webhook:

| Field | Type | Source | Meaning |
|--------|------|--------|--------|
| `stripeCustomerId` | string \| null | Set when client is linked to Stripe | Has a Stripe customer (and possibly subscription) |
| `paymentStatus` | `'paid' \| 'past_due' \| 'failed' \| 'canceled' \| null` | Webhook | Current payment/subscription state |
| `lastPaymentAt` | timestamp \| null | Webhook (`invoice.paid`) | Last successful payment |
| `nextBillingAt` | timestamp \| null | Webhook (`subscription.updated`) | Next billing date (if subscription) |
| `stripeSubscriptionId` | string \| null | Webhook | Active subscription id |

- **“Up to date”** = `paymentStatus === 'paid'` (or no Stripe link and not required to pay).
- **“Not up to date”** = `paymentStatus === 'failed' \| 'past_due' \| 'canceled'`, or linked to Stripe but status missing/stale.

### 2.2 Existing APIs

- **`GET /api/clients?coachId={coachId}`**  
  Returns all clients for that coach. Response includes full client documents, so `paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeCustomerId` are already there.  
  Today this route does **not** require auth; for the report we will call it with the authenticated user’s token and only use it for the logged-in coach’s `coachId`.

- **Stripe webhook**  
  Already updates `paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeSubscriptionId` on the client when invoices/subscriptions change.

- **Per-client billing**  
  Client profile already has a Billing/Payment tab and history via `/api/clients/[id]/billing/history`. No change needed for the report.

So: **no new payment processing or webhook logic**—only read of existing client + payment fields and a new report UI (and optionally a dedicated report API).

---

## 3. How It Will Be Implemented

### 3.1 Product behaviour

- **Coach**
  - Sees a single **Payment Report** view.
  - Sees only **their** clients.
  - For each client: name, email, **payment status** (e.g. Up to date / Failed / Past due / Canceled / Not linked), last payment date, next billing date (if any).
  - Can open the client profile (e.g. Billing tab) for details.
- **Admin (optional)**
  - Same report layout.
  - Can see **all** clients or filter by **coach** (dropdown).
  - Same columns and “up to date” interpretation.

“Up to date” is defined in the UI as: **payment status = Paid** (or no Stripe link if you treat “no link” as N/A rather than overdue). All other statuses are “not up to date” for the report.

### 3.2 Where it lives (placement)

- **Coach**
  - New item in the **Coach Hub** sidebar, e.g. **“Payment Report”**, linking to a dedicated route (e.g. `/clients/payment-report` or `/payment-report`).  
  - Or a sub-item under “My Clients” (e.g. “Payment report”) that goes to the same page.
- **Admin**
  - New item in the **admin** navigation, e.g. **“Payment Report”**, linking to e.g. `/admin/payment-report` (same UI, different data scope and optional coach filter).

So: **one report concept**, **one UI component**, **two entry points** (Coach Hub + Admin) and role-based data (coach sees own clients; admin sees all or by coach).

### 3.3 Data flow (how we get the data)

**Option A – Reuse existing API (recommended for coach-only or first release)**  
- **Coach:**  
  - Page calls `GET /api/clients?coachId={currentUser.uid}` with auth headers.  
  - Backend already returns client list including `paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeCustomerId`.  
  - No new API; ensure this endpoint is **auth-protected** and that we only pass the logged-in coach’s `coachId` (so coaches only see their own clients).
- **Admin:**  
  - Either reuse the same endpoint with an optional `coachId` (admin can pass any coach’s id or omit for “all”) and enforce in backend that caller is admin when `coachId` is not self; or add a small **report-specific** endpoint (see Option B).

**Option B – Dedicated report API (better if admin filter is in scope)**  
- New endpoint, e.g. **`GET /api/reports/payment`** (or `GET /api/admin/payment-report`).  
- Query params:  
  - `coachId` (optional). If omitted and caller is admin → return all clients; if omitted and caller is coach → treat as self. If present and caller is admin → return that coach’s clients; if present and caller is coach → must equal self.  
- Response: same client list shape as today (id, name, email, coachId, `paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeCustomerId`), possibly with a small wrapper like `{ success, data: clients }`.  
- Auth: require authenticated user; apply role rules above. No new Firestore fields; read from existing `clients` collection.

Recommendation: **Start with Option A** for the coach (reuse `GET /api/clients?coachId=`) and add **Option B** when we add the admin view with coach filter, so admin has one clear place to get “all clients” or “clients by coach” without overloading the generic clients list contract.

### 3.4 Backend (API) summary

| Who   | Endpoint (recommended)        | Auth / behaviour |
|-------|-------------------------------|-------------------|
| Coach | `GET /api/clients?coachId={uid}` | Require auth; coachId must be the current user’s uid. Returns clients with payment fields. |
| Admin | `GET /api/reports/payment?coachId=optional` | Require auth + admin. If coachId omitted → all clients; if present → that coach’s clients. Returns same payment fields. |

- No new Firestore collections or fields.  
- No Stripe API calls in the report path (we only read stored fields).  
- Optional: add a **cached** “last sync” or “report generated at” in the response for UX; still no new DB writes for payment state.

### 3.5 Frontend (UI) implementation

- **One report page component** (e.g. `PaymentReportPage` or `PaymentReportTable`) that:
  - Takes a list of clients (with payment fields) and optionally a “coach filter” (admin only).
  - Renders a **table** (or card list): Client name, Email, Payment status, Last payment, Next billing, Link to client profile.
  - Derives “Up to date” from `paymentStatus === 'paid'`; shows “Failed”, “Past due”, “Canceled”, “Not linked” (or “N/A”) for other cases.
  - Supports **sorting** by name, status, last payment date (and optionally filtering by status “up to date” / “not up to date”).
- **Coach route:** e.g. `/clients/payment-report`.  
  - Fetches `GET /api/clients?coachId={user.uid}` with auth.  
  - Renders the report component; no coach selector.
- **Admin route:** e.g. `/admin/payment-report`.  
  - Fetches `GET /api/reports/payment` (or `/api/admin/payment-report`) with optional `coachId` from a dropdown.  
  - Renders the same report component with an optional coach filter above the table.
- **Access control:**  
  - Coach route: protected so only coach (or admin) can access; only their data is shown.  
  - Admin route: protected so only admin can access.

This keeps a single source of truth for “what the report looks like” and only the data source and filters different per role.

### 3.6 Security and performance

- **Auth:** All report endpoints require authentication. Coach can only request their own `coachId`; admin can request any coach or all.
- **Data:** No PII beyond what the coach/admin already has access to; payment fields are non-sensitive status and dates.
- **Performance:** One Firestore query per request (clients by coachId, or all clients for admin). If the client list grows large (e.g. >500), we can add pagination or a cap later; not required for initial build.
- **Stripe:** Report does not call Stripe; it only reads from Firestore. Stripe remains the source of truth via existing webhook.

---

## 4. Build Order (Implementation Plan)

1. **Ensure `GET /api/clients` is auth-protected** and that the client list returned includes `paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeCustomerId`. If it already does, no change beyond auth.
2. **Coach Payment Report page**
   - Add route (e.g. `/clients/payment-report`).
   - Add “Payment Report” to Coach Hub sidebar.
   - Page: auth (coach), fetch `GET /api/clients?coachId={uid}` with token, render table with payment columns and “up to date” interpretation.
3. **Admin Payment Report (optional, same sprint or follow-up)**
   - Add `GET /api/reports/payment` (or `/api/admin/payment-report`) with admin-only and optional `coachId`.
   - Add route `/admin/payment-report` and link in admin nav.
   - Reuse same table component; add coach dropdown for admin.
4. **Polish**
   - Sortable columns, optional filter by “Up to date / Not up to date”, “Report generated at” timestamp if desired.

---

## 5. Summary

| Aspect | Decision |
|--------|----------|
| **Data source** | Existing Firestore `clients` fields (`paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeCustomerId`). No new collections. |
| **“Up to date”** | `paymentStatus === 'paid'`. Everything else (failed, past_due, canceled, or not linked) is “not up to date” for the report. |
| **Coach** | New page in Coach Hub; reuse `GET /api/clients?coachId=uid` with auth. |
| **Admin** | New page under `/admin`; new endpoint for “all clients” or “by coach”; same UI, coach filter. |
| **Stripe** | No direct Stripe calls in report; webhook continues to keep client payment fields up to date. |

This gives a clear, low-risk way to add the Payment Report so coaches (and admins) can see at a glance if each client is up to date on payments, without changing how payments or webhooks work.
