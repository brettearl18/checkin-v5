# CTO: Check-in 2 – Clean Build Option

**Question:** Would it be better to create a **Check-in 2** page that is a clean build, doesn’t interfere with pending/legacy check-ins, and generates a new dynamic check-in when started?

**Short answer:** Yes. A separate “Check-in 2” flow is a good way to get a single, predictable experience for new check-ins without touching the existing list or resolve logic. Data stays in the same place (same collections); only the **entry path** is new and clean.

---

## 1. Why a clean build helps

### 1.1 No interference with current behaviour

- **Existing Check-ins page** keeps showing the current list (completed, overdue, pending, whatever is there). No change to how that list is built or how “Start a check-in” on that page resolves assignments.
- **Pending / legacy assignments** are left as-is. We don’t backfill, don’t change resolve rules for the old flow, and don’t risk breaking clients who still use the old list.
- **Check-in 2** is a separate entry: e.g. “New check-in” or “Check-in (simple)” that goes to a dedicated flow. That flow uses **one rule only**: type + week → find or create by an explicit week (e.g. `reflectionWeekStart`), then open the form. No dueDate matching, no legacy edge cases.

### 1.2 One clear rule for “new” check-ins

- In Check-in 2 we **only** create or find assignments that have the explicit week field set (e.g. `reflectionWeekStart`). New assignments created from Check-in 2 always get that field.
- We don’t need to make the old data consistent. Old list and old “Start a check-in” can stay as they are; Check-in 2 is the clean path.

### 1.3 Same data underneath

- Submissions from Check-in 2 still write to **same** `formResponses` and **same** `check_in_assignments`. So:
  - History, progress, and coach view stay unified.
  - No new collections or duplicate concepts.
- Only the **way the client starts** a check-in is different: they use Check-in 2 → pick type + week → we create (or find by week) → they fill the same form and submit to the same APIs.

---

## 2. What “Check-in 2” would be

### 2.1 User flow

1. Client goes to **Check-in 2** (or “New check-in (simple)”).
2. **Step 1:** Choose check-in type (from forms they’re assigned – same source as today, e.g. from existing assignments so we know they’re allowed).
3. **Step 2:** Choose week (e.g. “Week of 16 Feb – 22 Feb”).
4. **Continue:** Backend finds an assignment with `reflectionWeekStart === selected week` for that client+form, or **creates one** with that week set. Returns assignment id. Client is sent to the **existing** form page: `/client-portal/check-in/{assignmentId}`.
5. They fill and submit as today; response is stored in `formResponses` and assignment is updated. No change to submit or history.

### 2.2 What we build

| Piece | What it is |
|-------|------------|
| **New page or entry** | e.g. `/client-portal/check-in-2` or a prominent “New check-in” on the current Check-ins page that routes to the new flow. |
| **Resolve API for Check-in 2** | New route, e.g. `POST /api/client-portal/check-in-resolve-v2`. Input: `clientId`, `formId`, `weekStart`. Logic: (1) Resolve clientId (doc id + authUid). (2) Find assignment where `clientId in [ids]`, `formId`, `reflectionWeekStart === weekStart`. (3) If none, create one with `reflectionWeekStart = weekStart`, dueDate = next Monday 09:00, copy template from any existing assignment for that client+form. (4) Return assignment id. **No** dueDate-based matching. |
| **Form & submit** | Reuse existing form page and submit API. Check-in 2 only provides the assignment id; the rest is unchanged. |
| **List / “pending”** | Existing Check-ins page and coach list stay as they are. Check-in 2 doesn’t depend on them and doesn’t change how they’re built. |

### 2.3 Optional: hide or retire old “Start a check-in”

- Once Check-in 2 is trusted, you can:
  - Hide the old “Start a check-in” on the original Check-ins page and make the main CTA “New check-in” → Check-in 2, or
  - Keep both and let clients use either (old for legacy list, new for simple type+week).

---

## 3. Comparison

| Approach | Interference with pending/legacy | Complexity | Data |
|----------|----------------------------------|------------|------|
| **Fix in place** (reflectionWeekStart + backfill + change current resolve) | Changes how current “Start a check-in” and list work; risk of regressions for existing clients. | Backfill, index, change existing API. | Same; no loss. |
| **Check-in 2 clean build** | None. Old page and list untouched. New flow is additive. | One new entry + one new resolve API; no backfill for old data. | Same; no loss. |

---

## 4. Recommendation

- **If the priority is “don’t touch pending/legacy and get one clean path for new check-ins”:**  
  **Check-in 2** is the better option. New dynamic check-ins are generated only when started from that flow, with a single rule (week stored and looked up explicitly). Existing check-ins and list behaviour stay as they are.

- **If the priority is “one single Check-ins page and one resolve API for everyone”:**  
  Then we fix in place (reflectionWeekStart + backfill + resolve change) and accept touching the current flow and running a backfill.

**Summary:** A Check-in 2 page that is a clean build, doesn’t interfere with pending check-ins, and generates a new dynamic check-in when started is a good approach and keeps data unified while avoiding risk to the current flow.
