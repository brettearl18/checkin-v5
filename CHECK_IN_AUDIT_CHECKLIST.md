# Check-In Submission Impact Audit Checklist

**Last Updated:** January 2025
**Audit Scope:** Verify all 25+ areas where weekly check-in submissions affect the system

---

## ✅ CLIENT-SIDE IMPACTS

### 1. Dashboard (`/client-portal`)
- [ ] **Check-ins Requiring Attention** - Completed check-in removed from alerts
- [ ] **Recent Check-ins** - New check-in added to recent list
- [ ] **Overall Progress** - `completedCheckins` and `totalCheckins` updated
- [ ] **Average Score** - Recalculates from all completed check-ins
- [ ] **Traffic Light Status** - Updates based on latest scores
- [ ] **Analytics** - Dashboard analytics refreshed
- [ ] **Cache Invalidation** - Dashboard cache cleared on submission

**API Endpoint:** `/api/client-portal/route.ts`
**Cache Key:** `dashboard:${clientId}`
**Verification:** Check `clearDashboardCache()` is called in check-in submission API

---

### 2. Progress Page (`/client-portal/progress`)
- [ ] **Question Progress Over Time** - New week column added with scores
- [ ] **Average Score** - Stats grid updates
- [ ] **Best Score** - Updates if new score is higher
- [ ] **Improvement** - First vs last score comparison
- [ ] **Consistency** - Scores within 10 points of average
- [ ] **Current Streak** - Consecutive weekly check-ins
- [ ] **Measurements** - Body weight extracted from responses
- [ ] **Progress Charts** - Score trends updated

**API Endpoint:** `/api/client-portal/history/route.ts`
**Key Fields:** `recurringWeek`, `assignmentDueDate`, `responses[]`, `score`
**Verification:** Check history API returns `recurringWeek` and `assignmentDueDate`

---

### 3. Check-ins List (`/client-portal/check-ins`)
- [ ] **Completed Check-ins** - Adds to "Completed" tab
- [ ] **Week Number Badge** - Displays correctly (Week 1, Week 2, etc.)
- [ ] **Status** - Assignment marked as "completed"
- [ ] **Date Display** - Submission date and due date shown
- [ ] **Score Badge** - Color-coded score displayed

**API Endpoint:** `/api/client-portal/check-ins/route.ts`
**Verification:** Check completed check-ins list filters and displays correctly

---

### 4. Check-in Success Page (`/client-portal/check-in/[id]/success`)
- [ ] **Score Display** - Final percentage score shown
- [ ] **Score Accuracy** - Matches URL parameter score
- [ ] **Progress Message** - Feedback based on score range
- [ ] **Progress Bar** - Visual indicator of score

**API Endpoint:** `/api/client-portal/check-in/[id]/success/route.ts`
**Verification:** Check success page fetches correct response data by responseId

---

### 5. Check-in History (`/client-portal/history`)
- [ ] **Response History** - Adds to completed responses list
- [ ] **Question Answers** - All Q&A pairs stored and displayed
- [ ] **Score History** - Adds to score timeline

**API Endpoint:** `/api/client-portal/history/route.ts`
**Verification:** Check history returns all responses with correct data

---

### 6. Email Notifications
- [ ] **Completion Email** - Sent immediately after submission
- [ ] **Email Template** - Uses correct template with all data
- [ ] **Email Content** - Form title, score, date, link included
- [ ] **Email Settings** - Respects client's email notification preferences

**API Endpoint:** `/api/client-portal/check-in/[id]/route.ts`
**Function:** `sendEmail()` with `getCheckInCompletedEmailTemplate()`
**Verification:** Check email is sent in try-catch block, doesn't fail check-in if email fails

---

## ✅ COACH-SIDE IMPACTS

### 7. Coach Dashboard (`/dashboard`)
- [ ] **Notifications** - "Check-in Completed" notification created
- [ ] **Notification Display** - Appears in notification center
- [ ] **Check-ins to Review** - Added to review queue
- [ ] **Recent Activity** - Updates recent client activity feed

**API Endpoint:** `/api/notifications` and `/api/dashboard/check-ins-to-review/route.ts`
**Function:** `notificationService.createCheckInCompletedNotification()`
**Verification:** Check notification created with correct metadata

---

### 8. Clients List Page (`/clients`)
- [ ] **Completion Rate** - Updates for client
- [ ] **Average Score** - Recalculates from check-ins
- [ ] **Recent Trend** - Updates (improving/stable/declining)
- [ ] **Last Check-in Date** - Updates to latest submission
- [ ] **Total Check-ins** - Increments count
- [ ] **Overdue Check-ins** - Decrements when completed
- [ ] **Engagement Score** - Recalculates

**API Endpoint:** `/api/clients/inventory/route.ts`
**Key Calculations:** `calculateClientMetricsFromCheckIns()`
**Verification:** Check inventory API aggregates correct metrics

---

### 9. Individual Client Profile (`/clients/[id]`)
- [ ] **Check-ins Overview** - Adds to completed check-ins list
- [ ] **Current Check-in Status** - Updates status card
- [ ] **Week Number Display** - Shows correct week
- [ ] **Progress Tab** - Question progress table updates
- [ ] **Score Trends** - Analytics section updates
- [ ] **Risk Assessment** - Updates based on new data

**API Endpoint:** `/api/clients/[id]/check-ins/route.ts`
**Verification:** Check coach can see same check-ins as client

---

### 10. Client Progress Page (`/clients/[id]/progress`)
- [ ] **Question Progress Over Time** - Matches client view
- [ ] **Weekly Scores** - Adds new week data point
- [ ] **Trend Analysis** - Updates improvement/decline indicators

**API Endpoint:** `/api/clients/[id]/check-ins/route.ts`
**Verification:** Check progress page displays same data as client view

---

## ✅ ANALYTICS & METRICS

### 11. Analytics Overview (`/api/analytics/overview`)
- [ ] **Client Metrics** - Completion rate, average score, trend
- [ ] **Overall Statistics** - Total completed, average score, distribution
- [ ] **Top Performers** - List updates based on scores
- [ ] **Needs Attention** - List updates based on performance

**Function:** `calculateClientMetricsFromCheckIns()`
**Verification:** Check analytics recalculate from assignments and responses

---

### 12. Risk Analytics (`/api/analytics/risk`)
- [ ] **Risk Score** - Recalculates (performance 40%, engagement 30%, activity 20%)
- [ ] **At-Risk Clients** - List updates based on risk score

**Function:** `calculateRiskScore()`
**Verification:** Check risk calculation uses latest check-in data

---

### 13. Engagement Analytics (`/api/analytics/engagement`)
- [ ] **Check-in Streak** - Calculates consecutive weekly completions
- [ ] **Average Response Time** - Time between assignment and completion
- [ ] **Retention Risk** - Updates based on engagement
- [ ] **Engagement Score** - Overall metric updates

**Function:** `calculateCheckInStreak()`, `calculateAverageResponseTime()`
**Verification:** Check streak calculation logic is correct (7-day windows)

---

### 14. Client Analytics (`/api/client-portal/analytics`)
- [ ] **Score Trends** - Updates trend data
- [ ] **Completion Rates** - Updates completion metrics
- [ ] **Progress Indicators** - Updates progress calculations

**Verification:** Check client-side analytics match coach-side analytics

---

## ✅ DATA STORAGE

### 15. Firestore Collections
- [ ] **`formResponses` Collection**
  - [ ] Document created with all response data
  - [ ] `assignmentId` links to correct assignment
  - [ ] `recurringWeek` stored correctly
  - [ ] `score` stored as percentage
  - [ ] `responses[]` array contains all Q&A pairs with scores
  - [ ] `submittedAt` timestamp stored
  - [ ] `completedAt` timestamp stored
  
- [ ] **`check_in_assignments` Collection**
  - [ ] Assignment status updated to `'completed'`
  - [ ] `completedAt` timestamp set
  - [ ] `responseId` links to formResponse document
  - [ ] `score` stored on assignment
  - [ ] `responseCount` incremented
  - [ ] `answeredQuestions` stored
  
- [ ] **Dashboard Cache**
  - [ ] Cache key cleared: `dashboard:${clientId}`
  - [ ] Cache invalidation doesn't fail check-in submission

**Verification:** Check database writes in `/api/client-portal/check-in/[id]/route.ts`

---

## ✅ INTEGRATIONS

### 16. Goal Tracking (`/api/goals/track-progress`)
- [ ] **API Called** - Triggered after check-in submission (async)
- [ ] **Goal Progress** - Updates progress percentages
- [ ] **Goal Status** - Determines on_track, at_risk, achieved, stalled, overdue
- [ ] **Notifications** - Sends coach notifications if goals need attention
- [ ] **Error Handling** - Doesn't fail check-in if goal tracking fails

**Function:** `POST /api/goals/track-progress`
**Trigger:** Called in check-in submission API after response saved
**Verification:** Check goal tracking API is called with correct clientId

---

### 17. Client of the Week (`/api/client-of-the-week`)
- [ ] **Data Aggregation** - Includes check-in data in analysis
- [ ] **Metrics Used** - Total, completed, average score, completion rate, trend
- [ ] **Weekly Selection** - Uses OpenAI to analyze including check-ins
- [ ] **Cache** - Weekly cache prevents redundant calculations

**Function:** `aggregateClientData()` includes check-in metrics
**Verification:** Check client-of-week API includes latest check-in data

---

### 18. AI Analytics (`/api/clients/[id]/ai-analytics`)
- [ ] **Risk Analysis** - Includes check-in scores in AI context
- [ ] **Question Responses** - Includes in analysis
- [ ] **Historical Trends** - Uses check-in history
- [ ] **Goal Comparison** - Compares performance to goals

**Verification:** Check AI analytics includes latest check-in data

---

## ✅ NOTIFICATIONS SYSTEM

### 19. Coach Notifications
- [ ] **Notification Created** - `createCheckInCompletedNotification()` called
- [ ] **Notification Type** - `'check_in_completed'` set correctly
- [ ] **Notification Data** - Client name, form title, score, link included
- [ ] **Error Handling** - Doesn't fail check-in if notification fails

**Function:** `notificationService.createCheckInCompletedNotification()`
**Collection:** `notifications`
**Verification:** Check notification document created in Firestore

---

### 20. Email System
- [ ] **Email Sent** - `sendEmail()` called with correct template
- [ ] **Template Used** - `getCheckInCompletedEmailTemplate()`
- [ ] **Email Content** - All required fields included
- [ ] **Error Handling** - Doesn't fail check-in if email fails
- [ ] **Email Settings** - Respects `emailNotifications` preference

**Verification:** Check email sending in try-catch block

---

## ✅ COMPUTED METRICS

### 21. Client Stats Calculations
- [ ] **Total Check-ins** - Count increments correctly
- [ ] **Completed Check-ins** - Count increments correctly
- [ ] **Average Score** - Recalculates from all check-ins
- [ ] **Best Score** - Updates if higher
- [ ] **Improvement** - First vs last comparison
- [ ] **Consistency** - Within 10 points calculation
- [ ] **Current Streak** - Consecutive weeks calculation
- [ ] **Longest Streak** - Historical maximum

**Verification:** Check calculations in progress page and analytics APIs

---

### 22. Question-Level Metrics
- [ ] **Individual Scores** - Stored per question in responses array
- [ ] **Question Status** - Red/orange/green/grey based on score
- [ ] **Question Trends** - Tracks improvement over weeks
- [ ] **Question Completion** - Tracks answered questions

**Verification:** Check question-level data in progress page display

---

### 23. Time-Based Calculations
- [ ] **Days Since Last Check-in** - Resets to 0
- [ ] **Completion Frequency** - Updates weekly pattern
- [ ] **Engagement Timeline** - Adds data point

**Verification:** Check time-based metrics in analytics APIs

---

## ✅ UI COMPONENTS

### 24. Progress Images
- [ ] **Body Weight Extraction** - Extracted from check-in if question exists
- [ ] **Measurement Updates** - Updates measurement data

**Verification:** Check progress images component extracts weight correctly

---

### 25. Traffic Light System
- [ ] **Average Traffic Light** - Updates based on average score
- [ ] **Individual Question Lights** - Red/orange/green in progress view
- [ ] **Overall Wellness Indicator** - Updates on dashboard

**Function:** `getTrafficLightStatus()` from `scoring-utils.ts`
**Verification:** Check traffic light calculations use correct thresholds

---

## 🔍 AUDIT VERIFICATION STEPS

### Step 1: Code Review
- [ ] Review `/api/client-portal/check-in/[id]/route.ts` for all trigger points
- [ ] Verify all async operations don't block check-in submission
- [ ] Check error handling for all dependent operations

### Step 2: Data Flow Verification
- [ ] Verify `formResponses` document created correctly
- [ ] Verify `check_in_assignments` document updated correctly
- [ ] Verify `recurringWeek` stored in both collections
- [ ] Verify `assignmentId` links correctly

### Step 3: API Endpoint Testing
- [ ] Test history API returns new check-in
- [ ] Test inventory API includes new metrics
- [ ] Test analytics APIs recalculate correctly
- [ ] Test goal tracking API triggers

### Step 4: UI Display Verification
- [ ] Test dashboard updates immediately after submission
- [ ] Test progress page shows new week column
- [ ] Test coach dashboard shows notification
- [ ] Test clients list updates metrics

### Step 5: Integration Testing
- [ ] Test goal tracking updates goals
- [ ] Test email sends successfully
- [ ] Test notification created
- [ ] Test cache invalidation works

---

## 🚨 COMMON ISSUES TO CHECK

1. **Week Number Incorrect** - Check `recurringWeek` stored correctly in response
2. **Missing Assignment Link** - Verify `assignmentId` in formResponse
3. **Cache Not Clearing** - Verify `clearDashboardCache()` called
4. **Goal Tracking Not Triggered** - Verify async call to goal tracking API
5. **Email Not Sending** - Check error logs, verify email service
6. **Notification Not Created** - Check notification service
7. **Progress Page Not Updating** - Check history API returns new data
8. **Score Mismatch** - Verify score calculation matches display
9. **Question Matching** - Verify questions matched by `questionId` not index
10. **Number Questions Scored** - Verify number questions not scored if weight 0

---

## 📋 TESTING CHECKLIST

- [ ] Submit a Week 1 check-in and verify all updates
- [ ] Submit a Week 2 check-in and verify week number displayed
- [ ] Verify dashboard cache clears
- [ ] Verify goal tracking triggers
- [ ] Verify email sends
- [ ] Verify notification created
- [ ] Verify progress page updates
- [ ] Verify coach dashboard updates
- [ ] Verify analytics recalculate
- [ ] Verify client-of-week includes new data

---

## 📝 NOTES

- All async operations should not block check-in submission
- Error handling should prevent one failure from breaking entire flow
- Cache invalidation should happen immediately after submission
- Week numbers should be consistent across all views
- Scores should match between submission and display


