# Dynamic Week Check-in Issues - CTO Analysis

## Issues Identified

### 1. **Check-in Can Be Filled Multiple Times After Submission**

**Root Cause:**
- When a dynamic week check-in (Week 2+) is submitted, a new assignment document is created with `status: 'completed'`
- However, the check-ins list API (`/api/client-portal/check-ins`) generates dynamic weeks for ALL weeks that don't exist in the database, including recent past weeks
- The deduplication logic uses `recurringWeek` + `dueDate` as the key, but dynamic weeks might have slightly different `dueDate` calculations or timing issues
- After submission, the newly created Week X assignment document should be included in `deduplicatedSeries`, but if the query runs before Firestore indexes update, OR if the `id` field format differs (`assignment-123_week_2` vs document ID), the deduplication might fail

**Impact:**
- User can see and fill the same check-in multiple times
- The dynamic week ID (`assignment-123_week_2`) doesn't match the real assignment document ID created on submission

### 2. **Progress Page Shows Wrong Week Numbers and Dates**

**Root Cause:**
- Progress page (`src/app/client-portal/progress/page.tsx`) uses `index + 1` for week numbers (line 444) instead of `response.recurringWeek`
- Week dates use `response.submittedAt` (line 445) instead of the assignment's `dueDate`
- The history API (`/api/client-portal/history`) DOES include `recurringWeek` and `totalWeeks` from the assignment (line 227-228), but the progress page doesn't use them

**Impact:**
- Week 2 check-in shows as "W1" with today's date instead of "W2" with the correct Monday due date
- Progress dots don't align with actual week numbers

### 3. **Check-in Status Not Reflected Everywhere**

**Root Cause:**
- The check-ins API generates dynamic weeks based on `maxExistingWeek`, which should prevent duplicates, BUT:
  - If the Week X assignment document uses a different `id` field format, it might not be properly grouped in the `recurringSeriesMap`
  - The deduplication happens BEFORE dynamic generation, but the dynamic generation might still create duplicates if the real assignment isn't found

## Solutions

### Fix 1: Improve Check-ins API Deduplication
- Ensure Week X assignment documents created on submission are properly included in the query results
- Improve deduplication to use `documentId` or check for existing assignments by querying Firestore before generating dynamic weeks
- Only generate dynamic weeks for weeks that don't have a corresponding assignment document

### Fix 2: Fix Progress Page Week Display
- Use `response.recurringWeek` from the API response instead of `index + 1`
- Fetch assignment `dueDate` from the assignment document and use it for week dates
- The history API already includes `recurringWeek`, so we just need to use it in the frontend

### Fix 3: Prevent Duplicate Submissions
- Enhance the submission API to check for existing Week X assignments more robustly
- Ensure the check-ins API properly excludes weeks that have completed assignments


