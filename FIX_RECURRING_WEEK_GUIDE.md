# Fix RecurringWeek Issue - Implementation Guide

**Issue:** Some formResponses documents are missing the `recurringWeek` field, even though their assignments have it.

**Status:** ✅ Code already fixed (submission API stores recurringWeek correctly)
**Action Required:** Backfill existing responses missing this field

---

## ✅ SOLUTION IMPLEMENTED

### 1. Submission API Already Fixed ✅
The submission API at `/api/client-portal/check-in/[id]/route.ts` line 256 now correctly stores `recurringWeek`:
```typescript
recurringWeek: isDynamicWeek ? dynamicWeekNumber : (finalAssignmentData.recurringWeek || null)
```

### 2. Admin API Endpoint Created ✅
New endpoint: `/api/admin/fix-recurring-week`
- **GET**: Check if a response needs fixing
- **POST**: Fix one or all responses missing recurringWeek

### 3. Scripts Created ✅
- `scripts/fix-recurring-week.js` - Firebase Admin SDK script (requires service account)
- `scripts/fix-recurring-week-via-api.js` - API-based check script (read-only)

---

## 🔧 HOW TO FIX

### Option 1: Use Admin API Endpoint (Recommended)

**Step 1: Check if response needs fixing**
```bash
curl -X GET "http://localhost:3000/api/admin/fix-recurring-week?responseId=8vMCTRsb7oLMeOfpA7NP" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Step 2: Fix specific response**
```bash
curl -X POST "http://localhost:3000/api/admin/fix-recurring-week" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"responseId": "8vMCTRsb7oLMeOfpA7NP"}'
```

**Step 3: Fix all responses for a client**
```bash
curl -X POST "http://localhost:3000/api/admin/fix-recurring-week" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clientEmail": "brett.earl@gmail.com"}'
```

**Step 4: Fix ALL responses missing recurringWeek (use with caution)**
```bash
curl -X POST "http://localhost:3000/api/admin/fix-recurring-week" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fixAll": true}'
```

---

### Option 2: Use Firebase Admin SDK Script

**Prerequisites:**
- `service-account-key.json` in project root
- Node.js installed

**Fix specific response:**
```bash
node scripts/fix-recurring-week.js 8vMCTRsb7oLMeOfpA7NP
```

**Fix all responses:**
```bash
node scripts/fix-recurring-week.js --all
```

---

### Option 3: Manual Fix via Firestore Console

1. Go to Firestore Console
2. Navigate to `formResponses` collection
3. Find document: `8vMCTRsb7oLMeOfpA7NP`
4. Get `assignmentId` from the document
5. Navigate to `check_in_assignments` collection
6. Find the assignment document
7. Copy `recurringWeek` value (should be `1`)
8. Go back to `formResponses/8vMCTRsb7oLMeOfpA7NP`
9. Add field: `recurringWeek: 1`

---

## 🧪 VERIFICATION

After fixing, verify the fix worked:

```bash
# Check via API
curl "http://localhost:3000/api/admin/fix-recurring-week?responseId=8vMCTRsb7oLMeOfpA7NP"

# Should return:
# {
#   "success": true,
#   "responseId": "8vMCTRsb7oLMeOfpA7NP",
#   "hasRecurringWeek": true,
#   "recurringWeek": 1,
#   "needsFix": false
# }
```

Or test the success page API:
```bash
curl "http://localhost:3000/api/client-portal/check-in/8vMCTRsb7oLMeOfpA7NP/success?clientId=WzDZdyfnD5eqlIVcwc9uUjqgRIQ2"
```

The response should now have `recurringWeek: 1` directly in the response data, not just derived from assignment.

---

## 📋 FIX LOGIC

The fix works by:
1. Finding the response document
2. Getting `assignmentId` from response
3. Looking up the assignment document
4. Extracting `recurringWeek` from assignment (or deriving it if missing)
5. Updating the response document with `recurringWeek`

If assignment also missing `recurringWeek`:
- Tries to derive from assignment ID pattern (e.g., `_week_2`)
- Defaults to `1` if can't determine
- Updates both assignment and response

---

## ✅ PREVENTION

The submission API now correctly stores `recurringWeek` in all new responses:
- Line 256 of `/api/client-portal/check-in/[id]/route.ts`
- Handles both dynamic weeks and regular weeks
- Stores the value in the response document at creation time

**No additional action needed for future check-ins** - they will have `recurringWeek` set correctly.

---

## 📊 CURRENT STATUS

- ✅ Submission API: Fixed (stores recurringWeek)
- ✅ Admin API: Created (for backfilling)
- ✅ Scripts: Created (for batch fixing)
- ⚠️  Historical Data: Needs backfilling (1 response confirmed: 8vMCTRsb7oLMeOfpA7NP)

---

## 🎯 RECOMMENDATION

1. **Immediate:** Fix the specific response `8vMCTRsb7oLMeOfpA7NP` using Option 1 or 2
2. **Optional:** Check if other responses are missing `recurringWeek` and fix them
3. **Future:** No action needed - new submissions will be correct

The system works correctly even without this fix (due to fallback logic), but fixing it improves data consistency and reliability.


