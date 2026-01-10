# Fix RecurringWeek - Step-by-Step Instructions

## Option 1: Using the Admin Tool (Easiest)

### Step 1: Open the Admin Tool
1. Make sure you're logged in as an admin in your browser
2. Open the file `fix-recurring-week.html` in your browser
   - Or navigate to: `http://localhost:3000/fix-recurring-week.html` (if you serve it)
   - Or just double-click the file to open it

### Step 2: Check Current Status
1. The response ID `8vMCTRsb7oLMeOfpA7NP` is already filled in
2. Click **"Check Status"** button
3. This will show you if the response needs fixing

### Step 3: Fix the Response
1. If it needs fixing, click **"Fix Response"** button
2. Confirm the action
3. Wait for the result

### Step 4: Verify
1. Click **"Check Status"** again
2. Should now show: "✅ Response is already correct"

---

## Option 2: Using Browser Console (Alternative)

### Step 1: Open Browser Console
1. Make sure you're logged in as an admin
2. Navigate to any page on your site (e.g., `/dashboard`)
3. Open Developer Tools (F12 or Cmd+Option+I)
4. Go to the "Console" tab

### Step 2: Check Status
Copy and paste this into the console:
```javascript
fetch('/api/admin/fix-recurring-week?responseId=8vMCTRsb7oLMeOfpA7NP')
  .then(r => r.json())
  .then(data => {
    console.log('Status:', data);
    if (data.needsFix) {
      console.log('⚠️ Response needs fixing');
    } else {
      console.log('✅ Response is already correct');
    }
  });
```

### Step 3: Fix the Response
If it needs fixing, run this:
```javascript
fetch('/api/admin/fix-recurring-week', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ responseId: '8vMCTRsb7oLMeOfpA7NP' })
})
  .then(r => r.json())
  .then(data => {
    console.log('Result:', data);
    if (data.success && data.result?.updated) {
      console.log('✅ Successfully fixed! recurringWeek:', data.result.recurringWeek);
    } else if (data.result?.skipped) {
      console.log('ℹ️ Already fixed, no update needed');
    } else {
      console.log('❌ Error:', data.message);
    }
  });
```

### Step 4: Verify
Run the check again (Step 2) to confirm it's fixed.

---

## Option 3: Using Terminal (If you have auth token)

If you have an admin session cookie or auth token, you can use curl:

```bash
# Check status
curl -X GET "http://localhost:3000/api/admin/fix-recurring-week?responseId=8vMCTRsb7oLMeOfpA7NP" \
  -H "Cookie: YOUR_SESSION_COOKIE"

# Fix the response
curl -X POST "http://localhost:3000/api/admin/fix-recurring-week" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"responseId": "8vMCTRsb7oLMeOfpA7NP"}'
```

---

## Expected Results

### Before Fix:
```json
{
  "success": true,
  "responseId": "8vMCTRsb7oLMeOfpA7NP",
  "hasRecurringWeek": false,
  "recurringWeek": null,
  "needsFix": true
}
```

### After Fix:
```json
{
  "success": true,
  "message": "recurringWeek updated successfully",
  "result": {
    "responseId": "8vMCTRsb7oLMeOfpA7NP",
    "recurringWeek": 1,
    "updated": true,
    "fromAssignment": true
  }
}
```

### Verification (After Fix):
```json
{
  "success": true,
  "responseId": "8vMCTRsb7oLMeOfpA7NP",
  "hasRecurringWeek": true,
  "recurringWeek": 1,
  "needsFix": false
}
```

---

## Troubleshooting

### Error: "Authentication required"
- Make sure you're logged in as an admin
- Check that your session cookie is valid
- Try logging out and back in

### Error: "Response not found"
- Verify the response ID is correct: `8vMCTRsb7oLMeOfpA7NP`
- Check that the response document exists in Firestore

### Error: "Assignment not found"
- The response's `assignmentId` might be incorrect
- Check Firestore to verify the assignment exists

---

## What This Fix Does

1. Finds the response document
2. Gets the `assignmentId` from the response
3. Looks up the assignment document
4. Extracts `recurringWeek` from the assignment (should be `1`)
5. Updates the response document with `recurringWeek: 1`

This ensures the response document has the `recurringWeek` field directly, improving data consistency and reliability.


