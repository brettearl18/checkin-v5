# Client-Side Check-In Data Flow Documentation

**Last Updated:** January 2025
**Purpose:** Complete documentation of all client-side check-in data flows and connections

---

## 📊 OVERVIEW: Client-Side Check-In Flow

The client-side check-in system consists of 6 main pages/components with multiple data flows:

1. **Check-In List Page** (`/client-portal/check-ins`)
2. **Check-In Completion Page** (`/client-portal/check-in/[id]`)
3. **Check-In Success Page** (`/client-portal/check-in/[id]/success`)
4. **Dashboard** (`/client-portal`)
5. **Progress Page** (`/client-portal/progress`)
6. **History Page** (`/client-portal/history`)

---

## 🔄 COMPLETE DATA FLOW DIAGRAMS

### Flow 1: Viewing Available Check-Ins

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT NAVIGATES TO /client-portal/check-ins                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Component: ClientCheckInsPage                                │
│ useEffect: [clientId, filter]                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchClientId()                                              │
│ GET /api/client-portal?clientEmail={email}                   │
│ Returns: { client: { id: "..." } }                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchCheckIns()                                              │
│ GET /api/client-portal/check-ins?clientId={id}               │
│ Returns: { checkIns: [...] }                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Filter Logic Applied:                                        │
│ - getToDoCheckins(): Filters by availability window          │
│   * Overdue check-ins (always included)                      │
│   * Available now (Friday 10am - Tuesday 12pm)               │
│   * Week 1 check-ins (special handling)                      │
│ - getScheduledCheckins(): Future check-ins                   │
│ - getCompletedCheckins(): Completed with responses           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ UI Renders:                                                  │
│ - "To Do" Tab: Available check-ins                           │
│ - "Scheduled" Tab: Future check-ins                          │
│ - "Completed" Tab: Past check-ins with scores                │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 2: Starting a Check-In

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT CLICKS "Start Check-in" on Available Check-In        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Navigation: router.push(`/client-portal/check-in/${id}`)    │
│ Where id = assignmentId (or dynamic week ID)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Component: CheckInCompletionPage                             │
│ useEffect: [assignmentId, userProfile]                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ loadFormAndQuestionsFromAPI()                                │
│ GET /api/check-in-assignments/${assignmentId}                │
│ Returns: { assignment, questions, form }                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Check for Saved Draft:                                       │
│ localStorage.getItem(`checkin-draft-${assignmentId}`)        │
│ If exists: Merge with initial responses                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Initialize Responses Array:                                  │
│ - One response per question                                  │
│ - Pre-filled if draft exists                                 │
│ - Empty answers otherwise                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Auto-save Logic (as user types):                             │
│ useEffect: [responses, currentQuestion]                      │
│ Saves to localStorage every 2 seconds                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 3: Submitting a Check-In (CRITICAL FLOW)

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT CLICKS "Submit Check-in"                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ handleSubmit() - Validation Phase                            │
│ 1. Prevents double submission (isSubmittingRef)             │
│ 2. Validates all required questions answered                │
│ 3. Scrolls to first unanswered if validation fails          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Score Calculation Phase                                      │
│ processedResponses.map():                                   │
│ - Match questions by questionId (not index!)                │
│ - Skip number/text/textarea (never scored)                  │
│ - Skip questions with weight === 0                          │
│ - Calculate score per question (scale/rating/multiple_choice/boolean) │
│ - Apply question weights                                    │
│ totalWeightedScore / (totalWeight * 10) * 100 = finalScore │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ API Submission                                               │
│ POST /api/client-portal/check-in/${assignmentId}            │
│ Body: {                                                      │
│   responses: processedResponses,                            │
│   score: finalScore,                                        │
│   totalQuestions: questions.length,                         │
│   answeredQuestions: answeredCount                          │
│ }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVER-SIDE PROCESSING (API Route)                           │
│ /api/client-portal/check-in/[id]/route.ts                   │
│                                                              │
│ 1. Handle dynamic week IDs (assignment-123_week_2)          │
│ 2. Fetch base assignment if dynamic week                    │
│ 3. Calculate score (validate/recalculate)                   │
│ 4. Create formResponse document:                            │
│    - All question/answer pairs                              │
│    - Individual question scores                             │
│    - Overall score                                          │
│    - recurringWeek (critical!)                              │
│    - assignmentId                                           │
│ 5. Create/update Week X assignment if needed                │
│ 6. Update response with correct assignmentId                │
│ 7. Create coach notification                                │
│ 8. Send completion email to client                          │
│ 9. Invalidate dashboard cache                               │
│ 10. Trigger goal tracking (async)                           │
│                                                              │
│ Returns: { success: true, responseId: "...", score: 75 }    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ CLIENT-SIDE POST-SUBMISSION                                  │
│ 1. Clear localStorage draft                                 │
│ 2. Redirect to success page:                                │
│    router.push(`/client-portal/check-in/${responseId}/success?score=${score}`) │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 4: Viewing Success Page

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT ARRIVES AT /client-portal/check-in/[id]/success      │
│ Where id = responseId from submission                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Component: CheckInSuccessPage                                │
│ useEffect: [id, scoreParam]                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchData()                                                  │
│ 1. Extract score from URL query param (most accurate)       │
│ 2. GET /api/client-portal/check-in/${id}/success?clientId=... │
│    Returns: { assignment, response, form, questions, ... }  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Display Logic:                                               │
│ - Score: Prioritize URL param, fallback to API response     │
│ - Traffic Light: Calculate from score + thresholds          │
│ - Progress Message: Based on score range                    │
│ - Question Scores: Calculate individual question scores     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ "Back to Dashboard" Link:                                    │
│ router.push("/client-portal") + router.refresh()            │
│ Forces dashboard to fetch fresh data                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 5: Dashboard Updates After Submission

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT NAVIGATES TO /client-portal (Dashboard)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Component: ClientPortalPage                                  │
│ useEffect: [authLoading, userProfile, previewClientId]      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchClientData()                                            │
│ GET /api/client-portal?clientEmail={email}                  │
│ Returns: {                                                   │
│   client: {...},                                             │
│   coach: {...},                                              │
│   checkInAssignments: [...],                                 │
│   summary: {                                                 │
│     totalAssignments: 4,                                     │
│     completedAssignments: 2,                                 │
│     recentResponses: [...]                                   │
│   }                                                          │
│ }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Filter "Check-ins Requiring Attention":                      │
│ filteredCheckins = assignedCheckins.filter():               │
│ - Status !== 'completed'                                    │
│ - Either overdue (dueDate < now)                            │
│ - OR window is currently open (Friday 10am - Tuesday 12pm)  │
│ - Excludes future check-ins                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Calculate Stats:                                             │
│ - overallProgress: (completed/total) * 100                  │
│ - completedCheckins: summary.completedAssignments           │
│ - totalCheckins: summary.totalAssignments                   │
│ - averageScore: from recentResponses                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Display Sections:                                            │
│ 1. "Check-ins Requiring Attention" - filteredCheckins       │
│ 2. "Recent Check-ins" - recentResponses (last 5)            │
│ 3. Stats Cards - overallProgress, averageScore              │
│ 4. Analytics Section - fetchAnalytics()                     │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 6: Progress Page Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT NAVIGATES TO /client-portal/progress                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Component: ClientProgressPage                                │
│ useEffect: [userProfile, timeRange]                         │
│ Also: visibilitychange listener (auto-refresh)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchProgressData()                                          │
│ GET /api/client-portal/history?clientId={uid}               │
│ Returns: { history: [...] }                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ History API Processing (/api/client-portal/history):         │
│ 1. Fetch all formResponses for client                       │
│ 2. Fetch all check_in_assignments for client                │
│ 3. Match responses to assignments by:                       │
│    - assignmentId (first priority)                          │
│    - formId + recurringWeek (fallback)                      │
│    - formId only (final fallback)                           │
│ 4. Extract recurringWeek from response (most accurate)      │
│ 5. Extract assignmentDueDate for week dates                 │
│ 6. Return enriched history items                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Deduplication:                                               │
│ - Group by assignmentId                                     │
│ - Keep most recent response per assignment                  │
│ - Prevents duplicate entries                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ processQuestionProgress():                                   │
│ 1. Sort responses by:                                       │
│    - recurringWeek (first)                                  │
│    - assignmentDueDate (second)                             │
│    - submittedAt (fallback)                                 │
│ 2. Group questions by questionId                            │
│ 3. Create week columns for each check-in                    │
│ 4. Match questions across weeks                             │
│ 5. Calculate question scores and status                     │
│    - Grey if weight === 0 or type === number/text/textarea │
│    - Green if score >= 7                                    │
│    - Orange if score >= 4                                   │
│    - Red if score < 4                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Calculate Stats:                                             │
│ - totalCheckIns: responses.length                           │
│ - averageScore: average of all scores                       │
│ - bestScore: max score                                      │
│ - improvement: lastScore - firstScore                       │
│ - consistency: % scores within 10 points of average         │
│ - currentStreak: consecutive weekly completions             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Display:                                                     │
│ - "Question Progress Over Time" table                       │
│ - Stats cards (Average, Best, Improvement, Streak)          │
│ - Measurements chart                                        │
│ - Progress trend chart                                      │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 7: Check-Ins List Page - Completed Tab

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT CLICKS "Completed" TAB                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchCompletedResponses()                                    │
│ GET /api/client-portal/history?clientId={id}                │
│ Returns: { history: [...] }                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Filter & Sort:                                               │
│ - Sort by submittedAt DESC (newest first)                   │
│ - Filter by score if filter selected                        │
│ - Apply time range filter if selected                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Display Each Completed Check-In:                            │
│ - Title: formTitle                                          │
│ - Week Badge: recurringWeek (if available)                  │
│ - Score Badge: Color-coded (green/orange/red)               │
│ - Date: submittedAt formatted                               │
│ - Link: /client-portal/history/${responseId}                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 CRITICAL DATA FLOW CONNECTIONS

### Connection 1: Submission → Dashboard Update

```
Submission API → Cache Invalidation → Dashboard Refresh
├─ POST /api/client-portal/check-in/[id]
├─ clearDashboardCache(clientId) called
├─ Dashboard useEffect triggers on visibility change
└─ Dashboard fetches fresh data on next load
```

**Verification:** ✅ Cache invalidation confirmed working

---

### Connection 2: Submission → Progress Page

```
Submission API → History API → Progress Page
├─ formResponse stored with recurringWeek
├─ History API fetches response + assignment
├─ Matches by assignmentId (prioritized)
├─ Extracts recurringWeek from response
├─ Returns assignmentDueDate for week dates
└─ Progress page processes into week columns
```

**Verification:** ✅ recurringWeek and assignmentDueDate confirmed working

---

### Connection 3: Submission → Check-Ins List

```
Submission API → Check-Ins API → List Page
├─ Assignment status updated to 'completed'
├─ Check-ins API filters out completed
├─ Completed responses fetched via history API
├─ Displays in "Completed" tab with week badge
└─ Sorted newest first
```

**Verification:** ✅ Status updates and filtering confirmed working

---

### Connection 4: Submission → Success Page

```
Submission API → Success Page API → Display
├─ Returns responseId from submission
├─ Redirect uses responseId (not assignmentId)
├─ Success page API handles dynamic week IDs
├─ Fetches response + assignment + form data
├─ Uses URL score param (most accurate)
└─ Displays score, questions, progress message
```

**Verification:** ✅ responseId redirect confirmed working

---

## ⚠️ POTENTIAL ISSUES & VERIFICATIONS

### Issue 1: Week Number Display
**Status:** ✅ FIXED
- recurringWeek stored correctly during submission
- History API prioritizes response's recurringWeek
- Progress page uses recurringWeek for week columns
- Completed check-ins show week badge correctly

### Issue 2: Number Questions Scoring
**Status:** ✅ FIXED
- Number questions never scored (weight always 0)
- Text/textarea questions never scored
- Only weight === 0 or unscored types show grey

### Issue 3: Question Matching
**Status:** ✅ FIXED
- Questions matched by questionId (not array index)
- Prevents wrong question-score pairing
- Handles question order differences

### Issue 4: Cache Invalidation
**Status:** ✅ VERIFIED
- Dashboard cache cleared after submission
- Uses correct clientId
- Error handling prevents submission failure

### Issue 5: Dynamic Week IDs
**Status:** ✅ VERIFIED
- Dynamic week assignments created correctly
- responseId used for success page redirect
- Assignment lookup handles dynamic IDs

---

## 📋 CLIENT-SIDE API ENDPOINTS USED

### 1. `/api/client-portal`
**Purpose:** Fetch dashboard data
**Used By:** Dashboard page
**Returns:** Client data, check-ins, summary stats

### 2. `/api/client-portal/check-ins`
**Purpose:** Fetch available check-ins
**Used By:** Check-ins list page
**Returns:** All check-in assignments (filters applied client-side)

### 3. `/api/check-in-assignments/[id]`
**Purpose:** Fetch assignment details for form
**Used By:** Check-in completion page
**Returns:** Assignment, questions, form data

### 4. `/api/client-portal/check-in/[id]` (POST)
**Purpose:** Submit check-in
**Used By:** Check-in completion page
**Body:** responses, score, counts
**Returns:** responseId, score

### 5. `/api/client-portal/check-in/[id]/success`
**Purpose:** Fetch success page data
**Used By:** Success page
**Returns:** Assignment, response, form, questions, scoring config

### 6. `/api/client-portal/history`
**Purpose:** Fetch completed check-ins
**Used By:** Progress page, Check-ins completed tab
**Returns:** History array with enriched data

### 7. `/api/client-portal/analytics`
**Purpose:** Fetch client analytics
**Used By:** Dashboard analytics section
**Returns:** Analytics data, trends

---

## ✅ VERIFICATION CHECKLIST

### Data Flow Verification
- [x] Check-in submission stores all required fields
- [x] recurringWeek stored correctly
- [x] assignmentId links correctly
- [x] Cache invalidation triggers
- [x] Dashboard updates on refresh
- [x] Progress page shows new week column
- [x] Check-ins list filters correctly
- [x] Success page displays correct score
- [x] History API returns correct data
- [x] Success page API handles both assignmentId and responseId
- [x] Dynamic week ID handling works correctly
- [x] Auto-save draft functionality works
- [x] Score calculation logic correct
- [x] Question matching by questionId (not index)

### Connection Verification
- [x] Submission → Success Page (responseId redirect)
- [x] Submission → Dashboard (cache invalidation)
- [x] Submission → Progress Page (history API)
- [x] Submission → Check-ins List (status update)
- [x] Submission → Goal Tracking (async trigger)
- [x] Submission → Notifications (coach notification)
- [x] Submission → Email (completion email)

### Error Handling
- [x] Double submission prevention
- [x] Required question validation
- [x] Network error handling
- [x] API error handling
- [x] Cache invalidation doesn't fail submission
- [x] Email failure doesn't fail submission
- [x] Notification failure doesn't fail submission

### User Experience
- [x] Auto-save draft to localStorage
- [x] Restore draft on page reload
- [x] Clear draft on successful submission
- [x] Loading states during submission
- [x] Error messages for validation failures
- [x] Success confirmation on completion
- [x] Redirect to dashboard after success

---

## 🎯 SUMMARY

All client-side check-in data flows are **properly connected and working**:

1. ✅ **Submission Flow:** Complete end-to-end from form to API to success
2. ✅ **Dashboard Updates:** Cache invalidation ensures fresh data
3. ✅ **Progress Tracking:** Week numbers, dates, and scores all correct
4. ✅ **Data Consistency:** recurringWeek and assignmentId linked correctly
5. ✅ **Error Handling:** All edge cases handled gracefully
6. ✅ **User Experience:** Auto-save, validation, and feedback all working

**Status:** 🟢 **ALL SYSTEMS OPERATIONAL**

