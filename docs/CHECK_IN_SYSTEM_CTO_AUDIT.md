# Check-In System — CTO Audit

**Purpose:** Full audit of how check-ins work end-to-end: client notifications, overdue behaviour, coach views, status logic, and recommendations. Use this to fix “completed showing as overdue” and to align product behaviour.

**Date:** February 2026

---

## 1. Executive Summary

- **Status source of truth:** Assignment status is derived in multiple places (APIs and client) from `check_in_assignments` (and sometimes `formResponses`). “Completed” must always be determined by `responseId` or `completedAt` first; otherwise a completed check-in can appear as overdue.
- **Client notifications:** Clients are notified via (1) in-app notifications, (2) scheduled emails (window open, due reminder, window close 24h/1h, window closed, overdue). These are triggered by cron/scheduler calling `/api/scheduled-emails/*`.
- **Overdue definition:** Everywhere uses “3+ days past due date” to set display status to `overdue`; DB is auto-updated to `status: 'overdue'` in some API paths.
- **Coach views:** Coach sees check-ins in (1) Dashboard (to review), (2) Client profile → Check-ins Management, (3) Check-ins page (global), (4) Client Progress → Check-ins Awaiting Response.
- **Risks:** Multiple code paths compute “display status”; virtual (expanded) weeks don’t check completion; client “To Do” and “Check-ins Requiring Attention” must explicitly exclude `completed` and treat `extensionGranted` as open.

---

## 2. Data Model & Status Flow

### 2.1 Firestore collections

| Collection | Role |
|------------|------|
| `check_in_assignments` | One doc per assigned check-in (or per week for recurring). Fields: `clientId`, `coachId`, `formId`, `dueDate`, `status` (pending/overdue/completed/missed), `responseId`, `completedAt`, `recurringWeek`, `totalWeeks`, `extensionGranted`, etc. |
| `formResponses` | One doc per submission. `assignmentId` links to the assignment; assignment doc stores `responseId`. |
| `check_in_extensions` | Extension requests; when granted, assignment gets `extensionGranted: true`. |
| `notifications` | In-app notifications (e.g. check-in due, form assigned). |

### 2.2 Status lifecycle (intended)

1. **Created:** Assignment created with `status: 'active'` or `'pending'`.
2. **Overdue:** When due date is 3+ days in the past and not completed, status becomes `overdue` (set in API when building response and sometimes by background update).
3. **Missed:** Coach or client marks as missed → `status: 'missed'`.
4. **Completed:** Client submits → assignment updated with `responseId`, `completedAt`, `status: 'completed'`.

**Rule that must hold everywhere:** If an assignment has `responseId` or `completedAt`, it must be treated as **completed** and never shown as overdue or “to do” for the client.

---

## 3. Where “Display Status” Is Computed

Status shown to the client (and in some coach views) is **computed** in several places. In every path, the order must be:

1. If `status === 'completed'` OR `completedAt` OR `responseId` → **completed**
2. Else if `status === 'missed'` → **missed**
3. Else if 3+ days past due → **overdue**
4. Else → **pending**

### 3.1 API locations (must all follow the rule)

| File | What it does | Risk if completed not checked first |
|------|----------------|-------------------------------------|
| `src/app/api/client-portal/check-ins/route.ts` | Builds list for client Check-ins page; multiple branches set `displayStatus`. | Completed could show as overdue if one branch misses `responseId`/`completedAt`. |
| `src/app/api/client-portal/check-ins-precreated/route.ts` | Pre-created assignments for client. | Same. |
| `src/app/api/client-portal/route.ts` | Dashboard “Check-ins Requiring Attention” data. | Same. |
| `src/app/api/clients/[id]/check-ins/route.ts` | Coach client profile check-ins list. | Same. |

**Virtual (expanded) weeks:** In `client-portal/check-ins/route.ts`, virtual weeks (e.g. `id: baseId_week_7`) get status from:

```ts
status: daysPastDue >= 3 ? 'overdue' : 'pending'
```

There is **no check** here for an existing completed assignment for that week. Deduplication later prefers real documents and completed over virtual, but the merge order and keying can still allow a virtual “overdue” to appear if the real completed doc is missing from the set or keyed differently. **Recommendation:** When building virtual weeks, exclude week numbers for which a completed assignment already exists (e.g. by checking `formResponses` or existing assignments for that client+form+recurringWeek).

---

## 4. Client-Facing Flows

### 4.1 Where the client sees check-ins

| Place | Data source | Filter / logic |
|-------|-------------|----------------|
| **Dashboard** – “Check-ins Requiring Attention” | `client-portal` route → `assignedCheckins` | Exclude `completed`, `missed`; include `extensionGranted`; include if overdue, due today, or window open. |
| **Check-ins page** – “To Do” | `client-portal/check-ins` API → `checkins` | Same idea: exclude completed, include extensionGranted, overdue, due today, window open. |
| **Check-ins page** – “Scheduled” | Same API | Future check-ins whose window is not open. |
| **Check-ins page** – “Completed” | Same API / history | `status === 'completed'`. |

**Bug pattern (completed showing as overdue):** If any of these is true, a completed check-in can appear under “To Do” or “Requiring Attention”:

1. The API returns `status: 'overdue'` for an assignment that has `responseId`/`completedAt` (wrong branch in displayStatus).
2. Deduplication keeps a virtual “overdue” assignment instead of the real “completed” one (key/order issue).
3. Client-side filter doesn’t exclude by `responseId` or `completedAt` and only trusts `status` from the API.

**Recommendation:** In every API path that returns assignments to the client, set status to **completed** whenever `data.responseId` or `data.completedAt` is present, before any overdue/pending logic. On the client, defensively exclude from “To Do” / “Requiring Attention” any item with `responseId` or `status === 'completed'`.

### 4.2 Client notifications (how clients are notified)

| Trigger | Mechanism | Endpoint / location |
|--------|------------|----------------------|
| New check-in assigned | In-app + email | `notificationService.createFormAssignedNotification`; email in `check-in-assignments/route.ts` (on create). |
| Check-in due (24h before) | Scheduled email | `POST /api/scheduled-emails/check-in-due-reminders` (cron). |
| Window open | Scheduled email | `POST /api/scheduled-emails/check-in-window-open` (cron). |
| Window closing 24h / 1h | Scheduled email | `POST /api/scheduled-emails/check-in-window-close-24h`, `check-in-window-close-1h` (cron). |
| Window closed | Scheduled email | `POST /api/scheduled-emails/check-in-window-closed` (cron). |
| Overdue | In-app + scheduled email | In-app: when client fetches check-ins, overdue notifications created (up to 3) in `client-portal/check-ins/route.ts`. Daily: `POST /api/scheduled-emails/check-in-overdue` (runs at 7 AM). |
| Coach feedback ready | In-app (+ email if implemented) | `notificationService.createCoachFeedbackAvailableNotification`. |

**Overdue notification bug risk:** In `client-portal/check-ins/route.ts`, `overdueAssignments` is built from `allAssignments` with:

```ts
return diffDays > 0 && (assignment.status === 'active' || assignment.status === 'pending');
```

Assignments in that list have **display** status (`completed`, `overdue`, `pending`, `missed`), not raw DB `active`. So `assignment.status === 'active'` is never true. Effect: only `status === 'pending'` overdue assignments get in-app overdue notifications; anything already stored as `overdue` in the object might still be included if the list was built from a mix of sources. **Recommendation:** Explicitly exclude completed: `assignment.status !== 'completed' && !assignment.responseId`, and base “overdue” on due date, not only status.

---

## 5. What Happens When a Check-In Is Overdue

### 5.1 Definition

- **Overdue:** Due date is in the past by **3 or more days** (everywhere in code).
- Assignment document may be updated to `status: 'overdue'` by:
  - `client-portal/check-ins/route.ts` (when building response),
  - `client-portal/route.ts` (legacy path),
  - `clients/[id]/check-ins/route.ts` (when returning list).

### 5.2 Client experience when overdue

- Appears in “Check-ins Requiring Attention” and “To Do” as overdue; client can still submit (submissions allowed when window closed).
- Can request extension (client) or coach can “Open for check-in” (sets `extensionGranted`).
- Can mark as “Missed” (client) once 3+ days overdue → status `missed`, removed from “Requiring Attention”.
- May receive in-app “check-in due” notifications and daily overdue email (7 AM) from scheduled job.

### 5.3 Coach experience when overdue

- Client’s Check-ins Management shows status “overdue” and options: “Open for check-in”, “Mark as Missed”, Delete.
- Once client submits, assignment moves to completed and appears in “Check-ins Awaiting Response” (to review) and in Completed.

---

## 6. Where the Coach Sees Check-Ins

| View | Source | What coach sees |
|------|--------|------------------|
| **Dashboard** | `GET /api/dashboard/check-ins-to-review` | Completed check-ins not yet responded to (from `formResponses` + assignments). |
| **Check-ins (global)** | Same + filters | All “to review” and completed; can filter by client/form/date. |
| **Client profile** – Check-ins Management | `GET /api/clients/[id]/check-ins` | All allocated check-ins (pending, overdue, missed, completed) with Edit, Open for check-in, Mark as Missed, Delete. |
| **Client profile** – Progress tab | `GET /api/dashboard/check-ins-to-review` filtered by client | “Check-ins Awaiting Response” for that client; week fix / reassign tools. |
| **Responses** | `GET /api/responses/[id]` (or similar) | Single response view and feedback. |

Coach does **not** see a separate “overdue” list; overdue is just a status on each assignment in the client’s Check-ins Management and in the client’s own To Do / Requiring Attention.

---

## 7. Scheduled Jobs (Cron) and Emails

These need to be invoked on a schedule (e.g. Cloud Scheduler). If not configured, clients won’t get the corresponding emails.

| Job | Endpoint | Suggested schedule | Purpose |
|-----|----------|--------------------|--------|
| Window open | `POST /api/scheduled-emails/check-in-window-open` | Hourly | Email when a check-in’s window opens. |
| Due reminder | `POST /api/scheduled-emails/check-in-due-reminders` | Hourly | 24h before due. |
| Window close 24h | `POST /api/scheduled-emails/check-in-window-close-24h` | Hourly | 24h before window closes. |
| Window close 1h | `POST /api/scheduled-emails/check-in-window-close-1h` | Hourly | 1h before window closes. |
| Window closed | `POST /api/scheduled-emails/check-in-window-closed` | Hourly | 2h after window closes. |
| Overdue | `POST /api/scheduled-emails/check-in-overdue` | Daily (e.g. 7 AM) | Overdue reminder (24h since last sent). |

All should skip assignments that are already completed (e.g. `responseId` or `status === 'completed'`).

---

## 8. Root Cause: “Completed Showing as Overdue”

Likely causes:

1. **Display status order:** In one or more API branches, `overdue` is set (e.g. from `daysPastDue >= 3`) before checking `responseId`/`completedAt`, or a path doesn’t check them at all.
2. **Virtual vs real:** For a given week, the client gets a virtual assignment (overdue) while the real completed assignment is missing from the merged list or loses during deduplication (key/order).
3. **Stale DB:** Assignment document was never updated with `responseId`/`completedAt`/`status: 'completed'` at submit time (e.g. bug in submit handler or dynamic-week creation).
4. **Client filter:** Client-side “To Do” or “Requiring Attention” doesn’t exclude by `responseId` or `completedAt`, and the API sometimes returns the wrong status.

**Recommended fix (in order):**

1. **Single helper for display status**  
   Implement one function (e.g. in `lib/checkin-status.ts`) that, given an assignment doc (and optional response), returns `'completed' | 'missed' | 'overdue' | 'pending'` using the order: completed (`responseId` or `completedAt`) → missed → overdue (3+ days) → pending. Use it in all API routes that return assignments to the client (and optionally for coach).

2. **APIs: always completed first**  
   In every place that sets `displayStatus`, ensure the first condition is:  
   `if (data.responseId || data.completedAt || data.status === 'completed') displayStatus = 'completed';`

3. **Virtual weeks: don’t override completed**  
   When building virtual (expanded) weeks, either:  
   - Omit a week number if there is already a real assignment with that `recurringWeek` (and prefer that real doc in the list), or  
   - When merging/deduplicating, always prefer an assignment with `responseId` over one without, regardless of id/documentId.

4. **Client-side guard**  
   In client portal “To Do” and “Check-ins Requiring Attention”, exclude any item where `assignment.responseId != null` or `assignment.status === 'completed'`, in addition to current filters.

5. **Overdue notifications**  
   When creating overdue in-app (and in overdue email job), exclude assignments with `responseId` or `status === 'completed'`.

---

## 9. CTO Recommendations (Checklist)

- [ ] **Single source of truth for status**  
  One shared `getDisplayStatus(assignment)` used by all APIs and, if useful, by the client for defensive display.

- [ ] **Audit all displayStatus branches**  
  Grep for `displayStatus` and `status.*overdue` and ensure every path checks `responseId`/`completedAt` first.

- [ ] **Virtual week logic**  
  When expanding recurring weeks, don’t emit an “overdue” virtual assignment for a week that already has a completed assignment (real doc or response). Prefer real + completed in deduplication.

- [ ] **Client defensive filter**  
  In “To Do” and “Check-ins Requiring Attention”, exclude items with `responseId` or `status === 'completed'`.

- [ ] **Overdue notifications**  
  In `client-portal/check-ins` and in `scheduled-emails/check-in-overdue`, exclude assignments that have `responseId` or are completed.

- [ ] **Scheduled jobs**  
  Confirm all `/api/scheduled-emails/*` endpoints are called on the intended schedule (e.g. Cloud Scheduler) and that they skip completed assignments.

- [ ] **Submit path**  
  Verify that on submit we always update the correct assignment doc (and, for dynamic week, create/update the week doc) with `responseId`, `completedAt`, and `status: 'completed'`.

- [ ] **Monitoring**  
  Add a simple check or log when an assignment has `responseId` but is returned with status other than `completed` (so you can catch regressions).

- [ ] **Docs**  
  Keep this audit and the “Status lifecycle” section in sync with code so future changes don’t reintroduce the bug.

---

## 10. Quick Reference: Key Files

| Area | Files |
|------|--------|
| Display status (API) | `api/client-portal/check-ins/route.ts`, `api/client-portal/route.ts`, `api/client-portal/check-ins-precreated/route.ts`, `api/clients/[id]/check-ins/route.ts` |
| Client To Do / Requiring Attention | `app/client-portal/page.tsx`, `app/client-portal/check-ins/page.tsx` |
| Window / overdue logic | `lib/checkin-window-utils.ts` |
| Notifications (in-app) | `lib/notification-service.ts`; creation in `api/client-portal/check-ins/route.ts`, `api/check-in-assignments/route.ts`, `api/client-portal/check-in/[id]/route.ts` |
| Scheduled emails | `api/scheduled-emails/check-in-window-open`, `check-in-due-reminders`, `check-in-window-close-24h`, `check-in-window-close-1h`, `check-in-window-closed`, `check-in-overdue` |
| Coach views | `api/dashboard/check-ins-to-review/route.ts`, `app/clients/[id]/page.tsx`, `app/clients/[id]/progress/page.tsx`, `app/check-ins/page.tsx` |
| Submit & update assignment | `api/client-portal/check-in/[id]/route.ts` |

---

*Update this doc when changing status logic, notification triggers, or coach/client views.*
