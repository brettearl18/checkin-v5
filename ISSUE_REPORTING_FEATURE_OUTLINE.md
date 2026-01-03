# Issue Reporting Feature - Implementation Outline

## Overview
Add a "Submit Issue" feature to the client navigation that allows clients to report bugs, errors, or issues they encounter while using the platform. The report will be sent via email to brett.earl@gmail.com with all relevant details.

---

## Feature Components

### 1. **Client Navigation Button**
**Location:** `src/components/ClientNavigation.tsx`

**Implementation:**
- Add "Submit Issue" button/link to the client navigation menu
- Position: After "Messages" or at the bottom of the menu
- Icon: Warning/exclamation icon
- Styling: Consistent with existing navigation items

**Code Structure:**
```tsx
<Link href="/client-portal/submit-issue" className="...">
  <svg>...</svg>
  <span>Submit Issue</span>
</Link>
```

---

### 2. **Issue Submission Form Page**
**Location:** `src/app/client-portal/submit-issue/page.tsx`

**Form Fields:**
1. **Issue Type** (dropdown):
   - Bug/Error
   - Feature Request
   - Performance Issue
   - Other

2. **Title** (required):
   - Brief description of the issue

3. **Description** (required, textarea):
   - Detailed description of what happened
   - What they were trying to do
   - What they expected vs. what actually happened

4. **Steps to Reproduce** (textarea):
   - Numbered steps to recreate the issue

5. **Browser Console Errors** (textarea):
   - Place for pasted console errors
   - Instructions on how to access console

6. **Attachments** (file input):
   - Screenshots (images)
   - Screen recordings (videos)
   - Multiple files allowed
   - Max file size: 10MB per file, 50MB total

7. **URL/Page** (text input):
   - Current page URL where issue occurred
   - Auto-populated with `window.location.href`

8. **Browser Information** (auto-populated):
   - User agent
   - Browser version
   - Screen resolution
   - Timezone

**UI Features:**
- Collapsible help sections:
  - "How to access Browser Console"
  - "How to take a screenshot"
  - "How to screen record"
- File preview for uploaded images
- Character counter for text fields
- Loading state during submission
- Success/error messages

---

### 3. **API Endpoint**
**Location:** `src/app/api/client-portal/submit-issue/route.ts`

**Functionality:**
1. Validate form data
2. Upload attachments to Firebase Storage (if any)
3. Get client information (name, email, clientId)
4. Format email with all issue details
5. Send email to brett.earl@gmail.com via Mailgun
6. Store issue report in Firestore (optional, for tracking)

**Request Body:**
```typescript
{
  issueType: string;
  title: string;
  description: string;
  stepsToReproduce?: string;
  consoleErrors?: string;
  pageUrl: string;
  browserInfo: {
    userAgent: string;
    screenResolution: string;
    timezone: string;
  };
  attachments?: string[]; // Firebase Storage URLs
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  issueId?: string; // If stored in Firestore
}
```

---

### 4. **File Upload Handling**
**Location:** `src/app/api/client-portal/submit-issue/upload/route.ts`

**Functionality:**
- Accept multipart/form-data
- Validate file types (images: jpg, png, gif, webp; videos: mp4, webm)
- Validate file sizes (max 10MB per file)
- Upload to Firebase Storage: `issue-reports/{clientId}/{timestamp}-{filename}`
- Return file URLs for inclusion in email

**Storage Structure:**
```
issue-reports/
  {clientId}/
    {timestamp}-{filename}
```

---

### 5. **Email Template**
**Location:** `src/lib/email-templates.ts` (add new function)

**Template Structure:**
```typescript
getIssueReportEmailTemplate(
  clientName: string,
  clientEmail: string,
  issueData: {
    type: string;
    title: string;
    description: string;
    stepsToReproduce?: string;
    consoleErrors?: string;
    pageUrl: string;
    browserInfo: object;
    attachments?: string[];
  }
): { subject: string; html: string }
```

**Email Content:**
- Subject: `[Issue Report] {title} - {clientName}`
- HTML formatted with:
  - Client information
  - Issue details
  - Browser/system information
  - Console errors (if provided)
  - Links to attachments
  - Timestamp

---

### 6. **User Guidance Components**

#### A. Console Access Instructions
**Modal/Expandable Section:**
```
How to Access Browser Console:

Chrome/Edge:
1. Press F12 or Right-click → Inspect
2. Click "Console" tab
3. Look for red error messages
4. Right-click on error → Copy → Paste below

Safari:
1. Enable Developer menu: Safari → Preferences → Advanced → Show Develop menu
2. Press Cmd+Option+C
3. Copy errors and paste below

Firefox:
1. Press F12
2. Click "Console" tab
3. Copy errors and paste below
```

#### B. Screenshot Instructions
```
How to Take a Screenshot:

Windows:
- Full screen: Press Print Screen
- Active window: Alt + Print Screen
- Snipping Tool: Windows + Shift + S

Mac:
- Full screen: Cmd + Shift + 3
- Selection: Cmd + Shift + 4
- Window: Cmd + Shift + 4, then Spacebar

Mobile:
- iOS: Volume Up + Power button
- Android: Power + Volume Down
```

#### C. Screen Recording Instructions
```
How to Screen Record:

Windows:
- Windows + G (Game Bar) → Record
- Or use built-in Screen Recorder

Mac:
- Cmd + Shift + 5 → Record Screen
- Or QuickTime Player

Mobile:
- iOS: Control Center → Screen Recording
- Android: Varies by device
```

---

## Implementation Steps

### Phase 1: Basic Form (2-3 hours)
1. ✅ Create `/client-portal/submit-issue` page
2. ✅ Add form with basic fields (title, description, type)
3. ✅ Add "Submit Issue" link to ClientNavigation
4. ✅ Create API endpoint for submission
5. ✅ Send basic email to brett.earl@gmail.com

### Phase 2: Enhanced Features (2-3 hours)
6. ✅ Add file upload functionality
7. ✅ Add browser info auto-population
8. ✅ Add console error field with instructions
9. ✅ Add help modals/expandable sections
10. ✅ Improve email template formatting

### Phase 3: Polish & Testing (1-2 hours)
11. ✅ Add form validation
12. ✅ Add loading states
13. ✅ Add success/error handling
14. ✅ Test file uploads
15. ✅ Test email delivery
16. ✅ Mobile responsiveness

---

## File Structure

```
src/
├── app/
│   ├── client-portal/
│   │   └── submit-issue/
│   │       └── page.tsx                    # Issue submission form
│   └── api/
│       └── client-portal/
│           └── submit-issue/
│               ├── route.ts                # Main submission endpoint
│               └── upload/
│                   └── route.ts            # File upload endpoint
├── components/
│   └── ClientNavigation.tsx                 # Add "Submit Issue" link
└── lib/
    └── email-templates.ts                  # Add issue report template
```

---

## Firestore Collection (Optional)

**Collection:** `issue_reports`

**Document Structure:**
```typescript
{
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  issueType: string;
  title: string;
  description: string;
  stepsToReproduce?: string;
  consoleErrors?: string;
  pageUrl: string;
  browserInfo: {
    userAgent: string;
    screenResolution: string;
    timezone: string;
  };
  attachments: string[]; // Firebase Storage URLs
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
  resolvedBy?: string; // Admin/coach email
  notes?: string; // Internal notes
}
```

**Benefits:**
- Track all issues in one place
- Build admin dashboard to view/manage issues
- Mark issues as resolved
- Analytics on common issues

---

## Email Format Example

```
Subject: [Issue Report] Cannot save check-in - Mandy Knaack

Issue Report from CheckInV5 Platform
=====================================

Client Information:
- Name: Mandy Knaack
- Email: mandy.knaack@gmail.com
- Client ID: JgX5qBevC9VQuRsGIL6k3j5tc6D3

Issue Details:
- Type: Bug/Error
- Title: Cannot save check-in
- Page: https://checkinv5.web.app/client-portal/check-in/abc123

Description:
When I try to submit my check-in, I get an error message saying 
"Failed to save. Please try again." This happens every time I try 
to complete a check-in.

Steps to Reproduce:
1. Log into client portal
2. Click on "Check in now" button
3. Fill out all questions
4. Click "Submit Check-in"
5. Error appears

Browser Console Errors:
Error: Failed to fetch
    at handleSubmit (check-in.js:45)
    at HTMLButtonElement.onclick (check-in.js:123)

Browser Information:
- User Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...
- Screen Resolution: 1920x1080
- Timezone: Australia/Sydney

Attachments:
- Screenshot: https://storage.googleapis.com/.../screenshot.png
- Screen Recording: https://storage.googleapis.com/.../recording.mp4

Submitted: January 3, 2026 at 2:30 PM
```

---

## Security Considerations

1. **File Upload Validation:**
   - Whitelist allowed file types
   - Scan for malicious content (optional)
   - Limit file sizes
   - Rate limit uploads per client

2. **Email Security:**
   - Sanitize user input before sending
   - Prevent email injection attacks
   - Validate email addresses

3. **Access Control:**
   - Only authenticated clients can submit
   - Verify client ID matches authenticated user
   - Rate limit submissions (e.g., max 5 per day)

---

## Future Enhancements

1. **Admin Dashboard:**
   - View all submitted issues
   - Filter by status, client, type
   - Mark as resolved
   - Add internal notes
   - Reply to client via email

2. **Client Portal:**
   - View their submitted issues
   - See status updates
   - Add follow-up comments

3. **Automated Responses:**
   - Auto-reply confirmation email to client
   - Notify when issue is resolved

4. **Analytics:**
   - Track most common issues
   - Identify problem areas
   - Measure resolution time

---

## Testing Checklist

- [ ] Form validation works correctly
- [ ] File uploads work (images and videos)
- [ ] Email sends successfully with all details
- [ ] Browser info is captured correctly
- [ ] Console instructions are clear
- [ ] Mobile responsive
- [ ] Error handling works
- [ ] Success message displays
- [ ] File size limits enforced
- [ ] Rate limiting works (if implemented)

---

## Estimated Development Time

- **Basic Implementation:** 4-6 hours
- **With File Uploads:** 6-8 hours
- **With Admin Dashboard:** 10-12 hours
- **Full Feature Set:** 12-16 hours

---

## Next Steps

1. Review this outline
2. Confirm email recipient (brett.earl@gmail.com)
3. Decide on Firestore storage (optional but recommended)
4. Approve file size limits
5. Start with Phase 1 implementation

