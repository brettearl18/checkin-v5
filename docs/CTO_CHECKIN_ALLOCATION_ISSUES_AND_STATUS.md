# CTO: Check-in Allocation – Issues, Fixes, and Status

This document summarises the problems we’ve had with check-in allocation, how we’re fixing them, where we are now, and what to do next.

---

## 1. The issues we’ve been having

### 1.1 Client confusion (weeks, due dates, “wrong week”)

- **What happened:** Clients see a long list of “Week 8”, “Week 9”, due dates, and check-in windows. They don’t know which one to open and sometimes open the wrong week (e.g. they mean “this week” but land on a week in April).
- **Why:** The UI was driven by pre-created assignment documents and “week” semantics. Resolving “this week” to the right assignment was brittle (e.g. due date stored as “next Monday” so week matching failed).

### 1.2 “Start a check-in” sent users to the wrong week (e.g. April)

- **What happened:** Client chose “This week (Feb 16–22)” but the form opened for a week in April.
- **Why:**  
  - Resolve API only matched when the assignment’s week Monday equalled the selected Monday. For “week ending Sunday” we store due date as the **next** Monday, so the match failed.  
  - With no match, the API fell back to the “earliest” assignment and built a synthetic week number. In some data sets the earliest assignment was a later week (e.g. week 7 in April), so the user was sent there.

### 1.3 Pre-created check-ins and “Delete Pending”

- **What happened:** Coach assigns a form (e.g. 20 or 52 weeks) and the system pre-creates many assignment documents. We wanted to move to “create on demand” and remove the extra pending ones. “Delete Pending” in the UI either did nothing (deleted 0) or the list didn’t update.
- **Why:**  
  - **Deleted 0:** The series delete API used two separate queries (one per client id variant). In production, pending assignments could be stored under a different `clientId` (e.g. auth UID) than the one the page sent (e.g. doc id), so only the completed ones were found.  
  - **Body not received:** The UI sent a `DELETE` with a JSON body; some environments don’t send bodies with `DELETE`, so the API got no `clientId`/`formId`.  
  - **Page not updating:** After a successful delete we called `fetchAllocatedCheckIns()` but it returned early because of the `hasLoadedCheckIns` guard (React state not yet updated), so the list never refetched.

### 1.4 Pending still showing after Delete Pending (synthetic rows)

- **What happened:** Coach ran “Delete Pending” and the success message appeared, but the list still showed many “pending” rows (e.g. 25 or 45).
- **Why:** The coach check-ins list is built by `/api/clients/[id]/check-ins`. When `USE_PRE_CREATED_ASSIGNMENTS` is false, that API **synthesised** future weeks from the one remaining template assignment (e.g. “Week 1 of 52” → weeks 2–52 generated as pending). So even after deleting the real pending documents, the API kept adding synthetic pending rows; the list was not “only what’s in the DB”.

### 1.5 401 on “Start a check-in” (resolve API)

- **What happened:** Client clicked Continue after choosing type and week and got “Could not start check-in” (401).
- **Why:** The resolve request was sent without the auth headers (Bearer token). The resolve API uses `verifyClientAccess`, which requires a valid token, so the request was rejected.

---

## 2. How we are fixing them (allocation and flow)

### 2.1 New client flow: “Start a check-in” (type + date)

- **What we did:**  
  - Added a **“Start a check-in”** entry on the client Check-ins page.  
  - **Step 1:** Choose check-in type (from assigned forms).  
  - **Step 2:** Choose week (e.g. last 4, this week, next 2).  
  - **Continue** calls `POST /api/client-portal/check-in-resolve` with `clientId`, `formId`, `weekStart` (Monday YYYY-MM-DD), then redirects to `/client-portal/check-in/{assignmentId}`.
- **Result:** Client no longer has to pick “Week N” from a long list; they pick type and week and open the right form.

### 2.2 Resolve API: correct week match and dynamic create

- **What we did:**  
  - Match both the selected week Monday **and** the “next Monday” (so “week ending Sunday” due dates match).  
  - If no assignment exists for that week, **create one on demand** (one doc per client+form+week) using an existing assignment as template, then return the new doc id.  
  - If still no assignment for that week, return 404 instead of falling back to another week.  
  - Client page sends **auth headers** with the resolve request so the API can verify access.
- **Result:** “This week” opens the correct week; no more April when they chose February. Clients can start any allowed week without pre-created docs.

### 2.3 Remove pre-created pending (cleanup and Delete Pending)

- **What we did:**  
  - **Admin cleanup:** `POST /api/admin/cleanup-precreated-checkins` (admin only). Keeps all **completed** assignments and exactly **one template** per (clientId, formId); deletes all other incomplete assignments. Optional `{ "dryRun": true }` to preview.  
  - **Delete Pending (UI):**  
    - Switched from `DELETE` to `POST` so the body is always sent.  
    - Series API now uses a single query: `formId` + `clientId in [docId, authUid]` so we find all assignments regardless of which id is stored.  
    - Preserve by “has response” (`responseId` or `completedAt`), not only `status === 'completed'`.  
  - **Page refresh:** After a successful delete we call `fetchAllocatedCheckIns(true)` so the list always refetches and the UI updates.
- **Result:** Delete Pending actually deletes the right docs and the coach list updates; one-off cleanup available for all clients.

### 2.4 Coach list: no synthetic pending

- **What we did:** In `/api/clients/[id]/check-ins`, when `USE_PRE_CREATED_ASSIGNMENTS` is false, we **stopped** generating synthetic future weeks from the template. The API now returns only **real** assignment documents (completed + one template per form).
- **Result:** After Delete Pending or cleanup, the coach list shows only what’s in the DB (e.g. 26 completed + 1 template), not dozens of phantom “pending” rows.

### 2.5 Small UI fix

- **What we did:** Replaced undefined `completedLink` with `isCompleted` in the check-ins page click handler so completed check-in actions don’t throw.
- **Result:** No runtime error when interacting with completed check-ins.

---

## 3. Where we are up to

| Item | Status |
|------|--------|
| “Start a check-in” UI (type + week modal) | Done |
| Resolve API (match week + next Monday, auth headers) | Done |
| Resolve API: create assignment on demand when none exists | Done |
| Admin cleanup API (`/api/admin/cleanup-precreated-checkins`) | Done |
| Delete Pending: POST, single query, preserve by responseId/completedAt | Done |
| Coach page: force refresh after delete (`fetchAllocatedCheckIns(true)`) | Done |
| Coach check-ins API: no synthetic future weeks | Done |
| CTO docs (this doc + CTO_CHECKIN_SELECT_TYPE_AND_DATE.md) | Done |
| **Deploy to production (Cloud Run + Firebase Hosting)** | Pending / in your hands |
| **Run cleanup or Delete Pending per client in production** | Pending / in your hands |

**Branch:** `feature/checkin-select-type-date`. Main is unchanged as the “come back” point.

**Data:** No migrations. All changes are backward compatible. Existing `formResponses` and completed assignments are untouched. We only change how clients **start** a check-in and how we **resolve or create** assignments; submit and history behaviour are unchanged.

---

## 4. What to do next

### 4.1 Deploy

1. Commit any remaining changes, push `feature/checkin-select-type-date`.
2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy checkinv5 --source . --region australia-southeast2 --allow-unauthenticated
   ```
3. Refresh Firebase Hosting so the live site uses the new revision:
   ```bash
   firebase deploy --only hosting
   ```

### 4.2 Trim pending in production

- **Option A – Per client (UI):** On the deployed site, for each client open Check-ins → Check-in Series Management → **Delete Pending** for each series. Use this if you have few clients or want to do it gradually.
- **Option B – One-off for all (admin API):** Call the cleanup API once with admin auth:
  - Dry run: `POST .../api/admin/cleanup-precreated-checkins` with body `{ "dryRun": true }`.
  - Then without `dryRun` to perform the cleanup.

After this, clients stay allocated to their form(s); only the extra pre-created pending assignments are removed. Clients use **Start a check-in → type → week** and the resolve API finds or creates the right assignment.

### 4.3 Optional: merge to main

When you’re happy with the new flow in production, merge `feature/checkin-select-type-date` into `main` and align future deploys with `main` if that’s your standard.

### 4.4 Optional: coach assignment creation

If you want to stop pre-creating weeks when a coach assigns a form (e.g. create only one “base” or week 1 per client+form), that’s a separate change in the assignment-creation flow; the rest of the system already supports create-on-demand via the resolve API.

---

## 5. Summary

- **Problems:** Wrong week (April vs February), Delete Pending not working or list not updating, pending still showing because of synthetic rows, 401 on resolve.
- **Approach:** New “Start a check-in” (type + week) flow, resolve API that matches the right week and creates on demand, cleanup and Delete Pending fixed (query + body + refresh), coach list returns only real assignments (no synthetic pending).
- **Status:** Implementation and fixes are done on the branch; deploy and run cleanup/Delete Pending in production to complete the rollout.
