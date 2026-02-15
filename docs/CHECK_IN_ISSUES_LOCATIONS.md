# Check-in system – issue locations

Concrete code locations for the bugs and inconsistencies described in `CHECK_IN_SYSTEM_CTO_AUDIT.md`. Use this to apply fixes (single status helper, “completed first” everywhere, virtual-week safety, client guard, overdue exclusions).

---

## 1. Display status: completed not checked first (or not using `responseId`)

**Rule:** If `responseId` or `completedAt` exists → display status must be **completed** in every code path.

### 1.1 Legacy client-portal route – missing `responseId` for completed

- **File:** `src/app/api/client-portal/route.ts`
- **Lines:** 248–250  
- **Issue:** Completed is set only from `data.status === 'completed' || data.completedAt`. `data.responseId` is never checked, so assignments that are completed (have `responseId`) but whose DB `status`/`completedAt` weren’t updated can be shown as overdue/pending.
- **Fix:** Treat as completed when `data.responseId` is present as well, e.g.  
  `if (data.status === 'completed' || data.completedAt || data.responseId) { displayStatus = 'completed'; }`

### 1.2 Coach API – overdue update runs after completion check (OK)

- **File:** `src/app/api/clients/[id]/check-ins/route.ts`
- **Lines:** 280–284, then 301–316  
- **Note:** Completion is set from `data.responseId || data.completedAt` first (280–284), then overdue logic runs only when `status !== 'completed'`. So this path is correct; no change needed for “completed first”.

---

## 2. Virtual-week assignments – status without completion check

- **File:** `src/app/api/client-portal/check-ins/route.ts`
- **Lines:** 595–609 (virtual week push), 600–603 (status)  
- **Issue:** Virtual weeks are pushed with  
  `status: daysPastDue >= 3 ? 'overdue' : 'pending'`  
  and `responseId: undefined`. There is no “completed” branch for virtual weeks. Deduplication (617–678) prefers completed (by `responseId`) and real docs over virtual, so normally a real completed week won’t be replaced. The risk is if a real completed doc for that week is missing or keyed differently, the virtual “overdue” can be the only one shown.
- **Fix:**  
  - Ensure virtual weeks are never preferred over a real assignment that has `responseId` (deduplication already does this).  
  - Optionally: when building virtual entries, if a real doc for that week exists and is completed, skip creating the virtual entry for that week (or set status from that doc).

---

## 3. Deduplication – completed vs virtual (already correct)

- **File:** `src/app/api/client-portal/check-ins/route.ts`
- **Lines:** 617–678  
- **Note:** Logic prefers `responseId` (completed) and real docs over virtual. No change needed here; the remaining risk is only if the real completed doc isn’t in the list (see §2).

---

## 4. Overdue in-app notifications – wrong filter and no completed guard

- **File:** `src/app/api/client-portal/check-ins/route.ts`
- **Lines:** 728–736  
- **Issue:**  
  - `overdueAssignments` uses `assignment.status === 'active' || assignment.status === 'pending'`. In this handler, `allAssignments` items have **display** status (`completed` / `overdue` / `pending` / `missed`), not DB `active`. So `active` never matches; only `pending` does.  
  - Assignments that are 3+ days past due have display status `overdue`, so they are **excluded** from this filter. So in-app overdue notifications only run for 1–2 days past due (still “pending”), not for 3+ days.  
  - There is no explicit exclusion of completed (e.g. by `responseId` or `status === 'completed'`), so in a race or bug where a completed assignment still has `status === 'pending'`, we could create an overdue notification for it.
- **Fix:**  
  - Exclude completed: e.g. `assignment.status !== 'completed' && !assignment.responseId`.  
  - Include truly overdue: e.g. also allow `assignment.status === 'overdue'` so notifications run for 3+ days past due as well.

---

## 5. Scheduled overdue email – completed not fully guarded

- **File:** `src/app/api/scheduled-emails/check-in-overdue/route.ts`
- **Lines:** 66–70  
- **Issue:** Skip is only `assignmentData.status === 'completed' || assignmentData.completedAt`. If an assignment is completed via `responseId` but `status` and `completedAt` were never set, it could still get an overdue email.
- **Fix:** Also skip when `assignmentData.responseId` is set, e.g.  
  `if (assignmentData.status === 'completed' || assignmentData.completedAt || assignmentData.responseId) { results.skipped++; continue; }`

---

## 6. Client-side “To Do” / “Requiring Attention” – no defensive completed guard

- **File:** `src/app/client-portal/check-ins/page.tsx`  
  - **Lines:** 447–456 (`getToDoCheckins`)  
- **File:** `src/app/client-portal/page.tsx`  
  - **Lines:** 1378–1380, 1454–1456, 1518, 2555–2557, 2618–2620 (Requiring Attention filters)  
- **Issue:** Filters exclude by `status !== 'completed'` (and `status !== 'missed'` on dashboard). They do **not** exclude by `responseId` or `completedAt`. If the API ever returns a completed check-in with a wrong status (e.g. `overdue`), it would appear in To Do / Requiring Attention.
- **Fix:** Add a defensive guard: exclude items that have `responseId` or `completedAt` (e.g. `if (checkin.responseId || (checkin as any).completedAt) return false;`) in the same filters.

---

## 7. Precreated and main check-ins API – completed check (OK)

- **File:** `src/app/api/client-portal/check-ins-precreated/route.ts`  
  - **Lines:** 106–108  
- **File:** `src/app/api/client-portal/check-ins/route.ts`  
  - **Lines:** 152–155, 269–272, 455–458  
- **Note:** All use `data.status === 'completed' || data.completedAt || data.responseId` (or equivalent) for setting display status to completed. No change needed for “completed first” in these blocks.

---

## Summary table

| # | Location | Issue | Severity |
|---|----------|--------|----------|
| 1.1 | `client-portal/route.ts` 248–250 | Completed not set when only `responseId` present | High – can show completed as overdue |
| 2 | `client-portal/check-ins/route.ts` 600–603 | Virtual week status has no “completed” branch | Medium – edge case if real doc missing |
| 4 | `client-portal/check-ins/route.ts` 730–736 | Overdue notification filter wrong + no completed guard | High – wrong targeting + possible spam |
| 5 | `scheduled-emails/check-in-overdue/route.ts` 66–70 | Overdue email doesn’t skip by `responseId` | Medium – completed can get overdue email |
| 6 | `client-portal/check-ins/page.tsx`, `client-portal/page.tsx` | To Do / Requiring Attention don’t exclude by `responseId`/`completedAt` | Medium – defensive only |

Recommended next steps: implement a single `getDisplayStatus()` (e.g. in `lib/checkin-status.ts`) and use it in all API routes above; then apply the specific fixes in §§ 1.1, 4, 5, and 6, and optionally tighten virtual-week logic in §2.
