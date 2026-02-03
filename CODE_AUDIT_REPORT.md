# Code Audit Report – Errors & Security Risks

**Date:** February 1, 2026  
**Scope:** Full codebase – errors, logic bugs, and security risks  
**Status:** Critical fixes implemented (see "Fixes Applied" section below)

---

## Executive Summary

This audit found **critical API authentication gaps** (IDOR/unauthorized access), an **SSRF/open proxy risk**, a **Firebase Storage rules syntax error**, and several code quality issues. The app relies on Firestore rules for client-side access, but server-side API routes use the Admin SDK, which bypasses Firestore rules, so **API auth is the only protection** for these endpoints.

### Severity Overview

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 3 | IDOR, SSRF, config errors |
| High | 5 | Missing auth, open endpoints |
| Medium | 4 | Validation, logging, robustness |
| Low | 3 | Types, structure, hygiene |

---

## Critical Issues

### 1. API routes without authentication (IDOR)

Several routes accept `clientId`/`coachId` in path or body but never verify the caller. Anyone can read or modify other users’ data.

| Route | Methods | Risk |
|-------|---------|------|
| `/api/clients/[id]/meal-plan` | PUT | Update any client’s meal plan |
| `/api/coaches/[id]/custom-meal-plans` | POST | Add custom meal plans to any coach |
| `/api/clients/[id]` | GET, PUT, DELETE | Full client CRUD for any client |
| `/api/client-measurements` | GET, POST, PUT, DELETE | Read/write any client’s measurements |
| `/api/client-portal` | GET | Full dashboard for any client (ID, email, or UID) |
| `/api/client-portal/check-ins` | GET | Check-ins for any client |
| `/api/client-portal/check-ins-precreated` | GET | Pre-created check-ins for any client |
| `/api/client-portal/history` | GET | History for any client |
| `/api/client-portal/goals` | GET, POST, PUT, DELETE | Goals for any client |
| `/api/client-portal/resources` | GET | Resources for any client |
| `/api/client-portal/onboarding` | GET, POST | Onboarding data for any client |

**Fix:** Add auth and authorization checks to these routes:

- Coach/admin/client routes: `requireCoach`, `requireAdmin`, or `requireAuth`.
- Client-specific data: use `verifyClientAccess(request, clientId)` before returning or modifying data.
- Coach-specific data: ensure `coachId` matches the authenticated coach (or admin).

---

### 2. Progress images proxy – SSRF / open proxy

**File:** `src/app/api/progress-images/proxy/route.ts`

The proxy accepts any `url` query parameter and fetches it:

```typescript
const imageUrl = searchParams.get('url');
const response = await fetch(imageUrl);
```

There is no validation that `url` points to an allowed domain.

**Risks:**

- SSRF: access to internal services or metadata endpoints.
- Open proxy: fetching arbitrary external URLs.
- Serving malicious content via your domain.

**Fix:**

- Restrict to your Firebase Storage domain (e.g. `*.googleusercontent.com`, your storage bucket).
- Validate and whitelist the domain before fetching.
- Add authentication and, where applicable, ownership checks.

---

### 3. Firebase Storage rules – syntax error

**File:** `storage.rules`

Lines 80–113 duplicate earlier content and create invalid rules. The service block effectively closes around line 78, and the following block is orphaned.

**Fix:** Remove the duplicate block (lines 80–113) so the file is valid and deployable.

---

## High-Priority Issues

### 4. Scheduled email endpoints – no authentication

**Routes:** `/api/scheduled-emails/*` (e.g. `check-in-window-open`, `check-in-window-closed`, `check-in-due-reminders`)

These endpoints have no auth or secret checks. Anyone can trigger them and send emails to clients.

**Fix:**

- Add a shared secret header (e.g. `X-Cron-Secret`) and verify it before running.
- Or call them only from Cloud Scheduler with OIDC/IAM auth and validate the caller.
- Ensure these endpoints are not exposed to arbitrary callers.

---

### 5. `client-portal` authorization mismatch

`/api/client-portal` uses `clientId`, `clientEmail`, or `userUid` from query params and returns full dashboard data. It does not validate that the authenticated user matches the requested client (or has coach/admin access).

**Fix:** Use `requireAuth` and `verifyClientAccess` (or equivalent) and only return data for the authenticated client, or for clients the authenticated coach/admin is allowed to see.

---

### 6. Excessive `console` usage in API routes

`grep` reports 569 `console.log/error/warn` usages in API code. These can:

- Leak sensitive data in production logs.
- Expose implementation details (e.g. IDs, paths).

**Fix:** Replace with `logInfo`, `logSafeError`, etc. from `src/lib/logger.ts`, which are env-aware and sanitize sensitive fields. Avoid logging raw bodies, tokens, or PII.

---

### 7. Sensitive logging in `client-measurements`

**File:** `src/app/api/client-measurements/route.ts` (around lines 95–107)

Full request body is logged:

```typescript
console.log('POST /api/client-measurements:', {
  ...
  fullBody: JSON.stringify(body)
});
```

**Fix:** Remove or redact sensitive fields (IDs, measurements, etc.) and use the shared logger instead of `console.log`.

---

### 8. Mailgun webhook signature handling

**File:** `src/app/api/webhooks/mailgun/route.ts`

Verification is optional:

```typescript
if (token && timestamp && signature) {
  if (!verifyMailgunSignature(...)) { ... }
}
```

If any of these are missing, the request is processed without verification.

**Fix:** Require and verify signature for all webhook requests. Reject requests that lack a valid signature.

---

## Medium-Priority Issues

### 9. Input validation gaps

- **`meal-plan` URL:** Only basic `new URL()` check; no length or scheme restriction.
- **`custom-meal-plans` URL:** Same.
- **Goals / measurement values:** Limited validation for numeric ranges, lengths, and types.
- **File uploads:** Types and sizes should be validated consistently.

**Fix:** Add stricter validation for URLs, numbers, and uploads; reject invalid inputs before persisting.

---

### 10. Error details in responses

Some routes return raw errors or stack traces, e.g.:

```typescript
error: error.message || 'Failed to update meal plan'
```

and similar patterns.

**Fix:** In production, return generic messages; keep detailed errors in server logs only. Use `process.env.NODE_ENV === 'development'` (or equivalent) when including extra detail.

---

### 11. Rate limiting disabled in development

**File:** `src/middleware.ts`

```typescript
if (process.env.NODE_ENV === 'development') {
  return NextResponse.next();
}
```

In development, no rate limiting is applied, which can hide abuse or performance issues.

**Note:** This is acceptable for local dev, but ensure production rate limits are correct.

---

### 12. Client ID ambiguity in measurement rules

`client_measurements` uses `clientId` which can be either Firestore document ID or auth UID. Inconsistent use can cause data access or visibility bugs.

**Fix:** Document and standardize which ID is used where. Ensure API and Firestore rules handle both cases consistently.

---

## Low-Priority Issues

### 13. TypeScript `any` usage

Widespread `any` reduces type safety and makes refactors riskier.

**Fix:** Replace `any` with proper types or `unknown` where possible, especially in shared and API code.

---

### 14. Possible duplicate rules in `storage.rules`

Confirm the main `storage.rules` file is the canonical version and that no duplicated/conflicting rules exist elsewhere.

---

### 15. Firestore rules – progress images vs `clientId`

**File:** `firestore.rules` – `progress_images` collection

Rules use both `clientId` and `coachId`. Some documents may only have one. Ensure the schema and rules align with how progress images are stored and accessed.

---

## Strengths

1. **Firestore rules:** Role-based access for most collections; admin/coach/client separation is clear.
2. **Admin routes:** Protected with `requireAdmin`.
3. **Auth utilities:** `api-auth.ts` provides `requireAuth`, `requireCoach`, `verifyClientAccess`, etc.
4. **Rate limiting:** Present for API routes in production.
5. **Logging utility:** `logger.ts` supports env-aware and sanitized logging.
6. **Password validation:** Stronger rules enforced.
7. **XSS surface:** No `dangerouslySetInnerHTML`, `eval`, or `innerHTML` usage observed.
8. **Test endpoints:** Blocked in production where checked.

---

## Recommended Fix Order

1. Add auth to all sensitive API routes (clients, coaches, measurements, client-portal).
2. Add URL whitelist and auth to the progress images proxy.
3. Fix `storage.rules` syntax by removing duplicate blocks.
4. Protect scheduled-email endpoints with a shared secret or IAM.
5. Enforce Mailgun webhook signature verification.
6. Replace `console` calls in API routes with the shared logger.
7. Tighten input validation and error handling as above.

---

## Fixes Applied (February 2026)

The following critical fixes have been implemented:

1. **API authentication added** – `verifyClientAccess`, `requireAuth`, and `requireCoach` are now used in:
   - `/api/clients/[id]/meal-plan` (PUT)
   - `/api/coaches/[id]/custom-meal-plans` (POST)
   - `/api/clients/[id]` (GET, PUT, DELETE)
   - `/api/client-measurements` (GET, POST, PUT, DELETE)
   - `/api/client-portal` (GET)
   - `/api/client-portal/check-ins`, `check-ins-precreated`, `history`, `goals`, `resources`, `onboarding` (GET, POST, PUT, DELETE as applicable)
   - `/api/progress-images` (GET) and `/api/progress-images/proxy` (GET)

2. **Progress images proxy** – Now requires authentication and only allows URLs from `firebasestorage.googleapis.com`, `storage.googleapis.com`, or `*.googleusercontent.com`.

3. **Storage rules** – Removed duplicate/orphaned block (lines 80–113) that caused a syntax error.

4. **Client access** – `verifyClientAccess` updated so clients can access their data when using either their auth UID or their Firestore document ID.

5. **Client portal pages** – Progress images page now sends the auth token when calling protected APIs (client-portal, progress-images, proxy).

---

## Appendix: Routes Needing Auth Review

Routes that appear to lack authentication or authorization checks:

- `client-portal/*` (dashboard, check-ins, history, goals, onboarding, resources)
- `clients/[id]` (GET, PUT, DELETE)
- `clients/[id]/meal-plan`
- `client-measurements`
- `coaches/[id]/custom-meal-plans`
- `scheduled-emails/*`
- `progress-images/proxy`

Confirm each route with client/coach/admin access has appropriate auth and access checks.
