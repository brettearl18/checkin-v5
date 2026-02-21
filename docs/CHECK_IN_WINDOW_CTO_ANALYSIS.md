# CTO Analysis: Check-in Window Simplification

## Problem statement

Clients report:

- Going to check in on a **Saturday** and **not being allowed** to, or
- Being **asked to fill in a missed check-in from the past** instead of the current week.

Requirement: **All missed check-ins that are beyond the next check-in window do not need to be filled out**, and **when the client goes to the new current check-in, they should not be blocked.**

---

## Current workflow (as implemented)

### 1. Check-in window definition

- **Window:** Friday 10:00 AM → Tuesday 12:00 PM (relative to each week’s Monday).
- **Week:** Monday–Sunday; “week of Mon 17 Feb” = window opens Fri 14 Feb 10am, closes Tue 18 Feb 12pm.

### 2. Assignment status (API: `check-ins/route.ts`)

For each assignment the API derives a **display status**:

| Condition | Display status |
|----------|-----------------|
| `completed` / has `responseId` | **completed** |
| DB status `missed` | **missed** |
| **Next week’s window has opened** (`isNextWeeksWindowOpen(due, now)`) | **missed** (and DB updated) |
| Else 3+ days past due | **overdue** |
| Else | **pending** |

- **“Next week’s window opened”** = Friday 10am of the week *after* the assignment’s due Monday.  
  Example: due Mon 17 Feb → that week’s Monday 17 Feb; “next week’s window” = Fri 21 Feb 10am. So from **Sat 22 Feb**, the Mon 17 assignment is **missed**.

### 3. Client “To Do” list (`getToDoCheckins`)

- **Excluded:** `status === 'missed'` and completed.
- **Included:**
  - Overdue (due date &lt; today),
  - Due today,
  - **Or** window for that week is open (Fri 10am–Tue 12pm).
- **Sort:** Current week first (most recent due date first among overdue/open).

So in theory only **non-missed, non-completed** items are to do, and **current week is first**. Old missed weeks should not appear as the primary action.

### 4. Where it goes wrong

**A) Synthetic (expanded) assignments never become “missed”**

- The API **expands** future (and recent past) weeks that don’t exist in the DB yet.
- For those **synthetic** assignments, status is set only as:
  - `daysPastDue >= 3` → `'overdue'`
  - else → `'pending'`
- **`isNextWeeksWindowOpen` is never applied** to these. So a past week (e.g. Week 3, due Jan 20) that was never a real document stays **overdue** forever in the API response.
- The client then sees multiple “overdue” weeks and sorts by due date; we did add “current week first” so the **open** week should be first, but **overdue past weeks still appear in the list** and in “Wrong week? Select the week you’re completing”. So clients can open an **old** week and see “Check-in window is closed” and feel blocked.

**B) Form page for a past week**

- When the client opens a **specific** assignment (e.g. from an old email or “Wrong week?” link), the form loads that assignment’s **due date** and calls `isWithinCheckInWindow(checkInWindow, dueDate)`.
- For a **past** week that window is closed, so the UI shows “Check-in window is closed” and “Your check-in can still be updated…”.
- Submission is **not** actually blocked (code allows submit when window closed), but the **messaging** makes it feel like they shouldn’t or can’t, and there is **no clear “do the current week instead”** path.

**C) Multiple overdue items in the list**

- Because synthetic past weeks stay “overdue”, the to-do list can show several past weeks plus the current one. Even with “current first”, showing many past weeks is confusing and suggests they “must” complete old ones.

---

## Target behaviour (simplified)

1. **Only the current window’s check-in is actionable.**
   - “Current” = the single week whose window is **open now** (Fri 10am–Tue 12pm).
   - Any assignment whose window has **closed** (including “next week’s window has opened”) is **missed** and **does not need to be filled out**.

2. **Clients are never “blocked” on the current check-in.**
   - If they land on the **current** week’s form, the window is open (or we treat it as allowed); they can always complete it.

3. **Past-week forms don’t block or confuse.**
   - If they land on a **past** week’s form (old link or “Wrong week?”):
     - Show a clear message: this is a past week, you don’t need to complete it, and offer a single primary CTA: **“Complete current week’s check-in”** (link to current assignment).
     - Still allow submission for edge cases (e.g. coach asked them to backfill), but de-emphasise it.

4. **API and client agree on “missed”.**
   - Any assignment (real or synthetic) for which the window has passed (next week’s window opened) must have **display status = missed** so the client can hide it from “To Do” and from primary flows.

---

## Recommended changes

### 1. API: Apply “missed” to synthetic assignments

**File:** `src/app/api/client-portal/check-ins/route.ts`

When building **expanded** (synthetic) assignments for future/past weeks, compute status the same way as for real documents:

- If `isNextWeeksWindowOpen(weekMonday, now)` → set **`status: 'missed'`** (not overdue).
- Only use overdue/pending for the narrow band where the window has not yet been “passed” (next week’s window not open).

Result: All past weeks beyond the current window appear as **missed** in the API; client can exclude them from “To Do”.

### 2. Client: “To Do” = only current window’s week

**File:** `src/app/client-portal/check-ins/page.tsx` (and portal home if it uses similar logic)

- Define **“current check-in”** = the assignment whose **due date** falls in the week for which the window is **open right now** (Fri 10am–Tue 12pm).
- **To Do list:** Only include that single assignment (or the next one if we’re between windows). **Do not** include other overdue/missed weeks as actionable.
- Optionally: in a separate “Past check-ins” or “History” area, list missed weeks as “Missed – no need to complete” for transparency only.

Result: One clear “Do this one” item; no list of old weeks to complete.

### 3. Form page: Past-week messaging and CTA

**File:** `src/app/client-portal/check-in/[id]/page.tsx`

- If the **loaded assignment’s window is closed** and the assignment is in the **past** (e.g. `isNextWeeksWindowOpen(dueDate, now)` is true):
  - Show a clear, friendly message:  
    **“This check-in is for a past week. You don’t need to complete it. Complete your current week’s check-in instead.”**
  - Add a primary button/link: **“Go to current week’s check-in”** that points to the **current** assignment (e.g. from the same check-ins API: first actionable item).
- Do **not** block submission (keep “can still be updated” behaviour for edge cases), but make the **primary** path “go to current”.

Result: No perceived “block”; clear path to the only check-in we want them to do.

### 4. Optional: Redirect past-week URLs to current

- When loading `/client-portal/check-in/[id]`, if `[id]` is a past-week assignment (window closed and next week’s window opened), **redirect** to the current week’s check-in URL instead of showing the past form.
- Reduces confusion from old emails/bookmarks; can be added after 1–3 are in place.

---

## What we're hoping to achieve (check-in flow)

1. **"Check in now" always opens the form**  
   When the client clicks "Check in now" for the **current week's** check-in (e.g. Week 8), they must land on the form and stay there. No redirect back to My Check-ins.

2. **Only the current window's check-in is the main action**  
   My Check-ins and Dashboard show a single "Current check-in" for the week whose window is open (Fri 10am–Tue 12pm). Past weeks are missed; no long list of old weeks to complete.

3. **Past-week links (e.g. old email) don’t trap the user**  
   If they open a **past** week’s URL:
   - We can **redirect** them to the **current** week’s check-in URL when we find it from the API.
   - We **never** redirect them back to the **list** from this effect: if we don’t find another open check-in, we leave them on the form (they may already be on the current one, or the API may be incomplete).

4. **Auth/401 must not cause redirect**  
   If the API returns 401 or the request fails, we do **not** redirect. The user stays on the form (or sees an error on the form). We use cached token first, then retry with force refresh, then try assignment fetch without auth so the form can still load.

---

## Summary

| Issue | Cause | Fix |
|-------|--------|-----|
| Old weeks still show as “to do” or “overdue” | Synthetic assignments never get status `missed` | API: set `missed` when `isNextWeeksWindowOpen` for expanded assignments |
| Too many items in “To Do” | We include all overdue + open | Client: “To Do” = only current window’s week |
| “Blocked” on Saturday | They opened an old week’s form; “window closed” message | Form: past-week message + “Go to current week’s check-in” CTA (and optionally redirect) |
| Confusion about what to fill | Multiple overdue + open in list | Same as above: single current check-in only |

Implementing **1 (API)**, **2 (client To Do)**, and **3 (form page)** will align behaviour with the requirement: **missed check-ins beyond the next window need not be filled out, and clients are not blocked when going to the new current check-in.**
