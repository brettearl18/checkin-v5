# CTO: Check-in by “Select Type + Select Date”

## Goal

Simplify the client experience:

- **Current:** Client sees a list of “weeks” and due dates (Week 8, Week 9, windows, etc.) and must navigate to the right check-in. This has caused confusion (wrong week, April vs February, window blocking).
- **Proposed:** Client chooses **(1) which check-in type** (e.g. “Vana Health 2026 Check In”) and **(2) which date/week** they are completing it for. No need to worry about “weeks”, “due dates”, or “windows” in the UI.

We **must not lose data from past check-ins** and must **keep following progress** (history, scores, coach feedback).

---

## Current Data Model (What We Keep)

### 1. `check_in_assignments`

- One document per allocated “slot” (or one base + synthetic expansion in API).
- Key fields: `clientId`, `formId`, `dueDate`, `recurringWeek`, `totalWeeks`, `status`, `responseId`, `assignedAt`.
- **Progress:** When a client submits, we link `formResponses` to an assignment via `assignmentId`; we update the assignment with `responseId`, `completedAt`, `score`.

### 2. `formResponses`

- One document per submission.
- Key fields: `clientId`, `formId`, `assignmentId`, `recurringWeek`, `submittedAt`, `score`, `responses`, `status`.
- **Progress:** History and progress are built from this collection (by `clientId`, ordered by `submittedAt`). `recurringWeek` (and optionally a date/week field) identifies “which week” the check-in was for.

### 3. How progress is used today

- **Client history:** `formResponses` for client, with `recurringWeek` and assignment details for labels (“Week 8”, etc.).
- **Coach view:** Assignments list + responses; completion and scores come from assignments and formResponses.
- **Analytics / progress:** Scores and trends are derived from formResponses (and assignment aggregates).

**Nothing in this proposal deletes or migrates these collections.** We only change how the **client starts** a check-in (type + date) and how we **resolve or create** the assignment/response link.

---

## Proposed UX (Client Flow)

1. **“Start a check-in”** (or “New check-in”).
2. **Step 1 – Select type:** List of check-in types (forms) the client is assigned.  
   - Source: same as today – forms that appear in the client’s assignments (from `check_in_assignments` by `clientId`), or a dedicated “assigned forms” API.  
   - Show form title only (e.g. “Vana Health 2026 Check In”). No “Week N” here.
3. **Step 2 – Select date:** “Which week (or date) are you completing this for?”  
   - Options: week picker (“Week of Mon 16 Feb – Sun 22 Feb”) or a single “reference date” (e.g. that week’s Monday, or “week ending” date).  
   - We can restrict to “allowed” weeks (e.g. past 4 weeks + current + next 2) to avoid typos and keep data clean, or allow any past/current week.
4. **Step 3 – Fill form:** Same form as today (same questions, scoring, submit API).  
   - On submit we **resolve or create** the right assignment and save the response so progress is preserved.

Result: client never has to understand “Week 8”, “due date”, or “window”; they only pick **type** and **date/week**.

---

## Implementation Options

### Option A – Add “Start by type + date” (recommended first step)

**Idea:** Keep the existing list view (for users who like it and for backwards compatibility). Add a clear primary path: **“Start a check-in” → choose type → choose date → open form.**

- **New UI:** e.g. on Check-ins page, a card: “Start a check-in” → modal or new page: (1) dropdown or list of assigned form titles, (2) week/date picker, (3) “Continue” → open existing form page with a **resolved** assignment id (or a “virtual” id we can resolve on submit).
- **Resolve assignment:** From (clientId, formId, selectedWeekStart), either:
  - Find an existing `check_in_assignments` doc whose `dueDate` (or week) matches that week and use its id for the form + submit; or
  - If we allow “any week” and no assignment exists, **create** an assignment for that (clientId, formId, week) on submit and link the new response to it (same as current “dynamic week” behaviour).
- **Submit:** Reuse current submit API. Payload includes `assignmentId` (or a temporary “formId + weekStart” token). Server either:
  - Updates the existing assignment and creates formResponse with `assignmentId` + `recurringWeek` (or equivalent week identifier), or
  - Creates a new assignment for that week and then creates formResponse linked to it.
- **Progress:** No change. formResponses still have `assignmentId`, `recurringWeek` (or a new `reflectionWeekStart` if we want to be date-based). History and progress continue to read from formResponses + assignments.

**Data:** No migration. Existing formResponses and assignments stay as-is. New submissions look the same in the DB; only the way we **choose** the assignment (by type + date) changes.

---

### Option B – Full switch to “type + date” only

**Idea:** Remove the “week list” as the main entry. Client **only** sees “Start a check-in” → type → date → form.

- List view could become “Recent / history” (past submissions by type and date) instead of “upcoming weeks”.
- Coach still allocates as today (or we simplify coach side to “assign form + frequency” and let clients pick dates within that).
- Same resolution and submit logic as Option A; we just remove or de-emphasise the week-based list.

**Data:** Still no deletion. Progress and history remain on formResponses + assignments.

---

## Resolving “Which assignment?” from (clientId, formId, date/week)

Today we have:

- Assignments with `dueDate` (often Monday of the week) and `recurringWeek`.
- formResponses with `assignmentId` and `recurringWeek`.

**Proposed resolution (server-side):**

1. Normalise “selected date” to a **week key** (e.g. Monday of that week, or “week ending” date). Use the same convention everywhere (e.g. Monday 00:00 local or UTC, or store ISO week).
2. **Find assignment:** Query `check_in_assignments` where `clientId == X`, `formId == Y`, and the assignment’s week (derived from `dueDate` or stored `recurringWeek`) equals the selected week. If exactly one → use it. If none → “create on submit” (create assignment for that week when the client submits, then link response).
3. **If multiple assignments** (e.g. two series for same form+client): prefer the one with **earliest** first due date (coach’s “main” schedule), same as we did for the April/February fix.

This keeps coach-allocated schedules intact and avoids duplicate “weeks” for the same form+client.

---

## Preserving Progress and History

- **Existing formResponses:** Never delete or change. All history and progress screens keep reading from `formResponses` (and assignments) as today.
- **New submissions (type + date flow):** Each new submission still creates (or updates) a formResponse with:
  - `clientId`, `formId`, `assignmentId` (resolved or newly created), `recurringWeek` or `reflectionWeekStart`, `submittedAt`, `score`, `responses`, etc.
- **Progress “by week”:** We can keep using `recurringWeek` for display (“Week 8”) or derive a label from the assignment’s `dueDate` or from a new `reflectionWeekStart` on the response. Coach and client progress views can stay as they are; we only need to ensure the **assignmentId** and week identifier are set correctly when we resolve by type + date.

So: **no data loss**, and **progress continues** to be tracked the same way.

---

## Suggested Rollout

1. **Phase 1 (Option A):**  
   - Add “Start a check-in” → select type → select date.  
   - Implement resolution (clientId, formId, week) → assignment (find or create on submit).  
   - Reuse existing form page and submit API; only the **entry point** and **assignment resolution** are new.  
   - Keep current list view; optional “suggested” current week based on reflection week.

2. **Phase 2 (optional):**  
   - If the new flow is adopted, make it the **primary** path and simplify or retire the week-based list (Option B).  
   - Coach UX can stay as-is (allocate by form + schedule) or be simplified later.

3. **No big-bang migration:**  
   - No change to existing documents.  
   - New flow only adds a different way to **start** a check-in and to **resolve** the assignment; the rest of the pipeline (form, submit, history, progress) is unchanged.

---

## Summary

| Aspect | Approach |
|--------|----------|
| **Client UX** | Select check-in **type** (form) → select **date/week** → fill form. No “Week N” or window in the main flow. |
| **Data** | Keep `check_in_assignments` and `formResponses`; no deletion or one-off migration. |
| **Progress** | Unchanged: formResponses + assignmentId + week identifier; history and scores as today. |
| **Implementation** | New entry: “Start a check-in” (type + date). Resolve assignment by (clientId, formId, week); find existing or create on submit. Reuse form + submit API. |
| **Risk** | Low: additive flow; existing behaviour and data stay intact. |

This gives you a simpler, date-centric client experience while keeping all past check-ins and progress intact and avoiding any dependency on “weeks” or “windows” in the main flow.
