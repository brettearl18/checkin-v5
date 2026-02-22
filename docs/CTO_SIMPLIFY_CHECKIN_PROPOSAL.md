# CTO: Simplify Check-in Process Without Losing Data

**Problem:** Clients are seeing inconsistent behaviour—some work, some don’t; some see April, some January, when they use “Start a check-in” and pick a week. The current logic is fragile and depends on inferring “which week” from existing data that was never standardised.

**Goal:** One simple, predictable rule for “which check-in is for this week” so every client gets the right week every time. No data loss; existing completions and history stay as they are.

---

## 1. Why it’s a mess today

### 1.1 We infer “week” from `dueDate`

- **Resolve today:** User picks “This week (Feb 16–22)”. We load all assignments for that client+form and try to **match** by deriving “week” from each assignment’s `dueDate` (e.g. “Monday of dueDate” or “Monday before dueDate”).
- **Problem:** `dueDate` was never standardised:
  - Some docs: Monday of the week (e.g. Feb 16).
  - Some: next Monday (“week ending Sunday” → dueDate Feb 23).
  - Timezones and server vs client date handling can change the derived Monday.
  - Different coaches/setups created assignments in different ways.
- **Result:** We sometimes match the wrong assignment (e.g. one whose dueDate happens to fall in that week but is really “Week 7” in April), or we don’t match at all and then create with logic that can still be wrong. Hence “some see April, some January”.

### 1.2 Multiple assignments, no single source of truth

- One client can have many assignment docs for the same form (weeks 1–20 or 1–52). We sort by dueDate and try to match. If the “first” doc is for week 7 (April), our fallback or create logic can anchor to that.
- There is **no stored field** that says “this assignment is for the week starting 2026-02-16”. We only have `dueDate` and `recurringWeek`, which are ambiguous across the codebase.

### 1.3 No data loss so far

- We have **not** deleted or changed any `formResponses` or completed assignments. History and scores are intact. The mess is in **how we choose** which assignment to open (or create) when the user picks a week.

---

## 2. Simplification: one explicit “week” field

### 2.1 Idea

- Add a **single canonical field** on `check_in_assignments`: **`reflectionWeekStart`** (string, format `YYYY-MM-DD`, the **Monday** of the week this check-in is for).
- **Resolve API:**  
  - **Find:** Query by `(clientId, formId, reflectionWeekStart === selectedWeekStart)`. If we find exactly one, return it. No more guessing from dueDate.  
  - **Create:** If none found, create one assignment with `reflectionWeekStart = selectedWeekStart`, set `dueDate` to the next Monday 09:00 (so the form’s “Week ending Sunday” displays correctly), copy other fields from a template. Return the new doc id.
- **Display:** Form page can show “Week ending …” from `reflectionWeekStart` (or keep deriving from dueDate for backward compatibility). New and backfilled docs will have a consistent week.

### 2.2 Why this fixes “April / January” and “some work, some don’t”

- We **stop inferring** week from dueDate. The week the user selected is the week we store and query. No ambiguity.
- Same behaviour for every client: one query by (clientId, formId, reflectionWeekStart). Find or create. No “match this Monday or next Monday” or “first assignment in list” heuristics.
- Existing assignments that we backfill with `reflectionWeekStart` become findable by week; we don’t change their dueDate or responseId, so no data loss.

### 2.3 What we do and don’t change

| What | Action |
|------|--------|
| **formResponses** | No change. Still linked by assignmentId. |
| **Completed assignments** | No change to responseId, completedAt, score. Only **add** reflectionWeekStart (backfill). |
| **New assignments (create on demand)** | Always set reflectionWeekStart = selected week. |
| **Resolve API** | 1) Try to find by (clientId, formId, reflectionWeekStart). 2) If not found, create with reflectionWeekStart. 3) Remove “match by dueDate” / “next Monday” logic. |
| **Form page / submit** | No change. They already use assignmentId and dueDate; we just make sure the assignment we return has the correct week (via reflectionWeekStart and dueDate set from it). |

---

## 3. Implementation steps (no big-bang)

### Phase 1 – Add field and backfill (read-only for now)

1. **Schema:** Document that `check_in_assignments` can have optional `reflectionWeekStart` (string, YYYY-MM-DD, Monday of the week).
2. **Backfill script (admin, one-off):** For every existing assignment that doesn’t have `reflectionWeekStart`:
   - Compute Monday of the week from `dueDate` (same logic we use today: Monday of the week containing dueDate, or Monday of the week *before* if you treat dueDate as “next Monday”).
   - Write `reflectionWeekStart = that Monday in YYYY-MM-DD`.
   - Do **not** change dueDate, responseId, or any other field.
3. Run the backfill in production (with a dry-run option). Verify: no docs deleted, no formResponses touched, only one new field added.

### Phase 2 – Resolve API uses reflectionWeekStart only

1. **Resolve API:**
   - Resolve clientId (doc id + authUid) as today.
   - **Find:** Query `check_in_assignments` where `clientId in [ids]`, `formId === formId`, `reflectionWeekStart === weekStartNorm`. If we have a composite index (clientId, formId, reflectionWeekStart), use it; otherwise clientId + formId and filter by reflectionWeekStart in code.
   - If one found → return that assignment’s id (real doc id or existing link id). **Do not** use dueDate to match anymore.
   - If none found → **Create** as today, but **set** `reflectionWeekStart: weekStartNorm` on the new doc. Set dueDate to next Monday 09:00 from weekStartNorm so the form shows “Week ending Sunday” correctly.
   - Remove: “match by weekStartNorm or nextMondayStr from dueDate”, and any fallback that picks “first assignment” by dueDate.
2. **Deploy** and test: “Start a check-in” → pick “This week” → must open the week the user picked, for every client.

### Phase 3 – Optional: form page prefers reflectionWeekStart

- If the form page displays “Week ending …” or “Week of …”, derive it from `assignment.reflectionWeekStart` when present, else fall back to dueDate. This makes display consistent for new and backfilled assignments.

---

## 4. Data safety

- **Backfill:** Only adds a field; does not delete or overwrite existing fields. If we get the Monday wrong for a few legacy docs, we can re-run with a corrected rule; the only effect is that “find by week” might hit a different doc for that week (we can add guards to prefer docs that already have a response for that week if needed).
- **Resolve:** Stops using dueDate for matching; only uses reflectionWeekStart. Creates new assignments with reflectionWeekStart set. No changes to formResponses or to assignment fields that would break existing links.
- **Rollback:** If we need to revert, we can switch the resolve API back to the old “match by dueDate” logic and ignore reflectionWeekStart; the new field is additive and doesn’t break existing behaviour.

---

## 5. Summary

| Current problem | Fix |
|-----------------|-----|
| Some clients see April, some January | We stop inferring week from dueDate; we query and set one field: reflectionWeekStart. |
| Some work, some don’t | Same code path for everyone: find by (clientId, formId, reflectionWeekStart); if not found, create with that week. |
| Risk of data loss | No deletion or change to formResponses or to assignment identifiers; only add reflectionWeekStart and change resolve logic. |

**Next concrete steps:**  
1) Add backfill script and run it (with dry-run).  
2) Change resolve API to find/create by `reflectionWeekStart` only and remove dueDate-based matching.  
3) Deploy and validate with a few clients.  
4) Optionally update form display to use `reflectionWeekStart` when present.

This gives one simple rule: **the week the user selects is the week we store and look up.** No more guessing from dueDate, so no more April or January surprises and no data loss.
