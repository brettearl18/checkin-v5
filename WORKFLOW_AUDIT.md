# Check-in Workflow Audit

## Complete Workflow: Client → Allocate Check-in → Client Fill out → Coach Review/Response

### ✅ Step 1: Client Creation & Allocation

**Location**: `/src/app/clients/create/page.tsx` and `/src/app/api/clients/route.ts`

**Process**:
1. Coach creates client with username/password
2. Firebase Auth account created immediately
3. Client record created in `clients` collection with `coachId` link
4. Credentials displayed in popup for coach to send manually

**Data Created**:
- `clients/{clientId}` document with:
  - `coachId` ✅
  - `firstName`, `lastName`, `email`
  - `status: 'active'`
  - `authUid` (Firebase Auth UID)

**Status**: ✅ **WORKING** - All fields properly linked

---

### ✅ Step 2: Allocate Check-in to Client

**Locations**:
- `/src/app/clients/[id]/page.tsx` - Quick send from client profile
- `/src/app/forms/create/page.tsx` - Allocate when creating form
- `/src/app/check-ins/send/page.tsx` - Send check-in page
- `/src/app/api/check-in-assignments/route.ts` - API endpoint

**Process**:
1. Coach selects form and client(s)
2. Sets frequency (once/weekly/monthly), duration, start date, due time
3. Check-in window configured (default: Friday 10:00 AM - Monday 10:00 PM)
4. Assignment created in `check_in_assignments` collection

**Data Created**:
- `check_in_assignments/{assignmentId}` document with:
  - `formId` ✅
  - `formTitle` ✅ (fetched from form document)
  - `clientId` ✅
  - `coachId` ✅
  - `status: 'pending'`
  - `checkInWindow` ✅
  - `isRecurring`, `recurringWeek`, `totalWeeks`
  - `assignedAt`

**Notification**: ✅ Notification created for client via `notificationService.createFormAssignedNotification()`

**Status**: ✅ **WORKING** - All fields properly set, formTitle fetched and saved

---

### ✅ Step 3: Client Views & Completes Check-in

**Location**: `/src/app/client-portal/check-in/[id]/page.tsx`

**Process**:
1. Client navigates to check-in from dashboard or check-ins list
2. System fetches assignment from `check_in_assignments`
3. Validates check-in window is open
4. Fetches form questions from `forms` and `questions` collections
5. Client answers questions
6. On submit:
   - Validates all questions answered
   - Calculates score (answeredCount / totalQuestions * 100)
   - Creates `formResponses` document
   - Updates `check_in_assignments` with completion data
   - Creates notification for coach
   - Redirects to success page

**Data Created**:
- `formResponses/{responseId}` document with:
  - `formId` ✅
  - `formTitle` ✅
  - `assignmentId` ✅ (links back to assignment)
  - `clientId` ✅
  - `coachId` ✅ **FIXED** - Now properly included
  - `clientName`, `clientEmail`
  - `score` ✅
  - `totalQuestions` ✅
  - `answeredQuestions` ✅
  - `responses[]` (array of question/answer pairs)
  - `submittedAt`, `completedAt`
  - `status: 'completed'`

**Data Updated**:
- `check_in_assignments/{assignmentId}`:
  - `status: 'completed'` ✅
  - `completedAt` ✅
  - `responseId` ✅ (links to formResponses document)
  - `score` ✅ **FIXED** - Now saved to assignment
  - `totalQuestions` ✅ **FIXED** - Now saved
  - `answeredQuestions` ✅ **FIXED** - Now saved

**Notification**: ✅ **FIXED** - Now creates notification for coach via `/api/check-in-completed`

**Status**: ✅ **FIXED** - All critical fields now properly saved

---

### ✅ Step 4: Coach Reviews Check-in

**Location**: `/src/app/dashboard/page.tsx` and `/src/app/responses/[id]/page.tsx`

**Process**:
1. Coach dashboard fetches completed check-ins via `/api/dashboard/check-ins-to-review`
2. API:
   - Finds all clients for coach
   - Finds all completed assignments for those clients
   - **FIXED**: Fetches score from `formResponses` if missing from assignment
   - **FIXED**: Backfills score to assignment for future queries
   - Returns check-ins with scores, client names, form titles
3. Coach clicks "Review" button
4. Response detail page loads via `/api/responses/[id]`
5. API:
   - Finds response by ID, assignmentId, or formId+clientId
   - **FIXED**: Checks `responseId` from assignment first
   - Fetches form questions
   - Fetches client data
   - Returns formatted response with questions

**Data Retrieved**:
- From `check_in_assignments`:
  - `responseId` ✅ (used to find formResponses)
  - `score` ✅ (with fallback to formResponses)
  - `clientId`, `formId`, `formTitle`
- From `formResponses`:
  - All response data
  - `coachId` ✅ (for permission checking)
- From `forms` and `questions`:
  - Question text and types

**Status**: ✅ **FIXED** - Score now properly displayed, response lookup improved

---

### ✅ Step 5: Coach Provides Feedback

**Location**: `/src/app/responses/[id]/page.tsx` and `/src/app/api/coach-feedback/route.ts`

**Process**:
1. Coach views response details
2. Can add feedback per question or overall:
   - Voice feedback (recorded audio)
   - Text feedback
3. Feedback saved to `coachFeedback` collection

**Data Created**:
- `coachFeedback/{feedbackId}` document with:
  - `responseId` ✅
  - `coachId` ✅
  - `clientId` ✅
  - `questionId` (null for overall feedback)
  - `feedbackType: 'voice' | 'text'`
  - `content` (base64 audio or text)
  - `createdAt`, `updatedAt`

**Status**: ✅ **WORKING** - Feedback system properly linked

---

## Issues Found & Fixed

### 🔴 Critical Issues Fixed:

1. **Missing `coachId` in formResponses**
   - **Issue**: When client submitted check-in, `coachId` wasn't saved
   - **Impact**: Coach couldn't properly filter/find responses
   - **Fix**: Added `coachId: assignment.coachId` to responseData
   - **File**: `src/app/client-portal/check-in/[id]/page.tsx`

2. **Missing score in assignment document**
   - **Issue**: Score wasn't saved to `check_in_assignments` when completed
   - **Impact**: Dashboard showed 0% for all check-ins
   - **Fix**: Added score, totalQuestions, answeredQuestions to assignment update
   - **File**: `src/app/client-portal/check-in/[id]/page.tsx`

3. **Missing notification for coach**
   - **Issue**: No notification created when client completed check-in
   - **Impact**: Coach didn't know when check-ins were completed
   - **Fix**: Added notification creation via `/api/check-in-completed`
   - **File**: `src/app/client-portal/check-in/[id]/page.tsx`

4. **Score not displayed for existing check-ins**
   - **Issue**: Old check-ins didn't have scores in assignment document
   - **Impact**: Dashboard showed 0% even for completed check-ins
   - **Fix**: API now fetches score from formResponses and backfills to assignment
   - **File**: `src/app/api/dashboard/check-ins-to-review/route.ts`

5. **Response lookup not optimal**
   - **Issue**: Response detail page had to try multiple queries
   - **Impact**: Slower loading, potential errors
   - **Fix**: API now checks `responseId` from assignment first
   - **File**: `src/app/api/responses/[id]/route.ts`

6. **Dashboard link to response**
   - **Issue**: Dashboard used assignment ID, should prefer responseId
   - **Impact**: Response page had to do extra lookups
   - **Fix**: API now returns responseId as primary ID when available
   - **File**: `src/app/api/dashboard/check-ins-to-review/route.ts`

---

## Data Flow Diagram

```
┌─────────────────┐
│  Coach Creates  │
│     Client      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ clients/{id}    │
│ - coachId ✅    │
│ - status:active │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Coach Allocates │
│   Check-in      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ check_in_assignments/{id}│
│ - formId ✅             │
│ - formTitle ✅          │
│ - clientId ✅           │
│ - coachId ✅            │
│ - status: pending       │
│ - checkInWindow ✅      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│ Client Completes│
│   Check-in      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ formResponses/{id}      │
│ - formId ✅             │
│ - formTitle ✅          │
│ - assignmentId ✅       │
│ - clientId ✅           │
│ - coachId ✅ FIXED      │
│ - score ✅              │
│ - responses[] ✅        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ check_in_assignments    │
│   UPDATED:              │
│ - status: completed ✅   │
│ - responseId ✅         │
│ - score ✅ FIXED        │
│ - completedAt ✅        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│ Notification    │
│   Created ✅    │
│   FIXED         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Coach Reviews   │
│   Response      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ coachFeedback/{id}      │
│ - responseId ✅         │
│ - coachId ✅            │
│ - clientId ✅           │
│ - feedbackType ✅       │
│ - content ✅            │
└─────────────────────────┘
```

---

## Verification Checklist

- [x] Client creation includes coachId link
- [x] Check-in allocation includes all required fields (formId, formTitle, clientId, coachId)
- [x] Client can view assigned check-ins
- [x] Check-in window validation works
- [x] Client submission saves all required data
- [x] formResponses includes coachId **FIXED**
- [x] Assignment updated with score **FIXED**
- [x] Notification created for coach **FIXED**
- [x] Coach dashboard shows completed check-ins
- [x] Score displayed correctly **FIXED**
- [x] Coach can access response detail page
- [x] Response detail page loads questions and answers
- [x] Coach can add feedback (voice/text)
- [x] Feedback saved and linked correctly

---

## Summary

**Overall Status**: ✅ **WORKFLOW COMPLETE AND VERIFIED**

All critical issues have been identified and fixed. The workflow now properly:
1. Links clients to coaches
2. Allocates check-ins with all required metadata
3. Allows clients to complete check-ins
4. Saves all data correctly (including coachId and score)
5. Notifies coaches when check-ins are completed
6. Allows coaches to review and provide feedback

The system is now production-ready for the complete check-in workflow.


