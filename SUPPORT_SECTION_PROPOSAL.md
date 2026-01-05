# Support Section - Consolidated Menu Proposal

## Overview

Consolidate "Submit Issue" and "Platform Updates" into a single **"Support"** menu item that provides:
- Help/How-to guides
- FAQ
- Issue reporting
- Platform updates/changelog

---

## Navigation Structure

### Current Menu Items:
- Submit Issue
- Platform Updates

### Proposed Menu Item:
- **Support** (single menu item)

---

## Support Page Structure (`/client-portal/support`)

```
┌─────────────────────────────────────────┐
│  Support & Help Center                  │
│  Find answers, report issues, stay      │
│  informed                               │
└─────────────────────────────────────────┘

[Tab Navigation]
┌──────────┬──────────┬──────────┬──────────┐
│  Help    │   FAQ    │  Report  │ Updates  │
│          │          │  Issue   │          │
└──────────┴──────────┴──────────┴──────────┘

┌─────────────────────────────────────────┐
│  Help & How-To Guides (Default Tab)     │
└─────────────────────────────────────────┘

📋 Getting Started
  ├─ How to Complete Your First Check-in
  ├─ How to Fill Out Your Onboarding Questionnaire
  ├─ How to Upload Progress Photos
  └─ How to Set Up Your Baseline Measurements

📊 Check-ins
  ├─ How to Complete a Check-in
  ├─ Understanding Check-in Windows
  ├─ What to Do If You Miss a Check-in
  └─ How to Edit a Submitted Check-in

📝 Questionnaires
  ├─ How to Complete the Onboarding Questionnaire
  ├─ How to Complete the Goals Questionnaire
  └─ Understanding Question Types

📸 Progress Tracking
  ├─ How to Upload Progress Photos
  ├─ How to Take Good Before/After Photos
  ├─ How to Update Your Measurements
  └─ Understanding Your Progress Dashboard

🎯 Goals & Progress
  ├─ How to Set Goals
  ├─ How to View Your Progress Over Time
  └─ Understanding Your Score and Traffic Light System

💬 Communication
  ├─ How to Message Your Coach
  └─ How to View Coach Feedback

[Expandable Sections with Step-by-Step Guides]
```

---

## Detailed Page Layout

### Tab 1: Help (Default)
**Content:**
- Search bar (optional)
- Categorized guides
- Step-by-step instructions with screenshots/illustrations
- Video links (if available)

**Sections:**

#### 1. Getting Started
- **How to Complete Your First Check-in**
  - Step 1: Navigate to "Check-ins" in the menu
  - Step 2: Find your assigned check-in
  - Step 3: Click "Start Check-in"
  - Step 4: Answer each question
  - Step 5: Review your responses
  - Step 6: Submit your check-in
  - Tips & Common Questions

- **How to Fill Out Your Onboarding Questionnaire**
  - Step-by-step walkthrough
  - What to expect
  - How long it takes
  - Tips for accurate answers

- **How to Upload Progress Photos**
  - Before photo guidelines
  - After photo guidelines
  - Upload process
  - Photo quality tips

- **How to Set Up Your Baseline Measurements**
  - Required measurements
  - How to measure accurately
  - When to update measurements

#### 2. Check-ins
- **How to Complete a Check-in**
  - Detailed step-by-step
  - Understanding question types
  - Saving progress
  - Reviewing before submission

- **Understanding Check-in Windows**
  - What is a check-in window?
  - When can you complete a check-in?
  - What happens if the window closes?

- **What to Do If You Miss a Check-in**
  - Contact your coach
  - Late submission process
  - Make-up check-ins

- **How to Edit a Submitted Check-in**
  - When editing is available
  - How to request edits
  - Limitations

#### 3. Questionnaires
- **How to Complete the Onboarding Questionnaire**
- **How to Complete the Goals Questionnaire**
- **Understanding Question Types**
  - Multiple choice
  - Scale/rating
  - Text responses
  - Date pickers

#### 4. Progress Tracking
- **How to Upload Progress Photos**
- **How to Take Good Before/After Photos**
  - Lighting tips
  - Angle consistency
  - Clothing guidelines
  - Background recommendations

- **How to Update Your Measurements**
- **Understanding Your Progress Dashboard**
  - Score explanation
  - Traffic light system
  - Progress graphs

#### 5. Goals & Progress
- **How to Set Goals**
- **How to View Your Progress Over Time**
- **Understanding Your Score and Traffic Light System**
  - What is a score?
  - What do the colors mean?
  - How to improve your score

#### 6. Communication
- **How to Message Your Coach**
  - Accessing messages
  - Sending a message
  - Viewing coach responses

- **How to View Coach Feedback**
  - Where to find feedback
  - Understanding feedback
  - Responding to feedback

---

### Tab 2: FAQ
**Content:**
- Common questions organized by category
- Expandable Q&A format
- Search functionality (optional)

**Sample Questions:**

#### Account & Login
- Q: How do I reset my password?
- Q: How do I update my email address?
- Q: I'm locked out of my account. What should I do?

#### Check-ins
- Q: How often do I need to complete check-ins?
- Q: What happens if I miss a check-in?
- Q: Can I edit a check-in after submitting?
- Q: Why can't I see my check-in yet?

#### Progress & Measurements
- Q: How often should I update my measurements?
- Q: Why aren't my photos showing up?
- Q: What measurements are required?
- Q: How do I delete a progress photo?

#### Scores & Ratings
- Q: How is my score calculated?
- Q: What do the traffic light colors mean?
- Q: Why did my score change?
- Q: How can I improve my score?

#### Technical Issues
- Q: The page isn't loading. What should I do?
- Q: I'm seeing an error message. What does it mean?
- Q: How do I access the browser console?
- Q: How do I take a screenshot?

#### Platform & Features
- Q: How do I contact my coach?
- Q: What is the difference between check-ins and questionnaires?
- Q: Can I use the platform on my phone?
- Q: Do you have a mobile app?

---

### Tab 3: Report Issue
**Content:**
- Same as current Submit Issue form
- Embedded within Support section
- Quick access to platform updates

**Features:**
- Issue reporting form
- Link to recent fixes
- "Check if your issue is already fixed" button

---

### Tab 4: Updates
**Content:**
- Same as current Platform Updates page
- Embedded within Support section
- Filterable by category

**Features:**
- All platform updates
- Category filters
- Search functionality (optional)

---

## Visual Design

### Layout Options

**Option A: Tabs (Recommended)**
```
┌─────────────────────────────────────────┐
│  [Help] [FAQ] [Report Issue] [Updates] │
├─────────────────────────────────────────┤
│                                         │
│  [Selected Tab Content]                 │
│                                         │
└─────────────────────────────────────────┘
```

**Option B: Sidebar Navigation**
```
┌────────┬───────────────────────────────┐
│ Help   │                               │
│ FAQ    │  [Selected Section Content]   │
│ Report │                               │
│ Updates│                               │
└────────┴───────────────────────────────┘
```

**Option C: Accordion/Menu**
```
┌─────────────────────────────────────────┐
│  Help & How-To Guides                   │
│  ▼ Getting Started                      │
│    • How to Complete Your First Check-in│
│    • How to Fill Out Questionnaire     │
│  ▶ Check-ins                            │
│  ▶ Questionnaires                       │
└─────────────────────────────────────────┘
```

---

## Implementation Approach

### Phase 1: Basic Structure
1. Create `/client-portal/support` page with tabs
2. Move Submit Issue form to "Report Issue" tab
3. Move Platform Updates to "Updates" tab
4. Create "Help" tab with basic structure
5. Create "FAQ" tab with sample questions
6. Update navigation menu (remove old items, add Support)

### Phase 2: Help Content
1. Write detailed how-to guides for each section
2. Add step-by-step instructions
3. Create visual aids (screenshots/diagrams)
4. Add video links (if available)

### Phase 3: Enhanced Features
1. Add search functionality
2. Add "Was this helpful?" feedback
3. Add related articles suggestions
4. Add print-friendly versions

---

## Content Storage Options

### Option A: Hardcoded (Phase 1)
- Content stored in React components
- Easy to update in code
- Fast loading

### Option B: Firestore Collection (Phase 2)
- Store guides in `help_guides` collection
- Admin interface to edit content
- Version control
- Multi-language support (future)

---

## Navigation Menu Change

### Before:
```
├─ Dashboard
├─ Check-ins
├─ Progress
├─ Progress Images
├─ Goals
├─ Messages
├─ Profile
├─ Measurements
├─ Submit Issue
└─ Platform Updates
```

### After:
```
├─ Dashboard
├─ Check-ins
├─ Progress
├─ Progress Images
├─ Goals
├─ Messages
├─ Profile
├─ Measurements
└─ Support
    ├─ Help & How-To
    ├─ FAQ
    ├─ Report Issue
    └─ Platform Updates
```

---

## Benefits

1. **Better Organization** - All support resources in one place
2. **Easier Discovery** - Users find help naturally
3. **Reduced Support Tickets** - Self-service resources
4. **Better UX** - Logical grouping of related features
5. **Scalability** - Easy to add more help content

---

## Questions to Confirm

1. **Layout Preference:**
   - Tabs (Option A)?
   - Sidebar (Option B)?
   - Accordion (Option C)?

2. **Content Storage:**
   - Hardcoded initially?
   - Firestore for admin editing?

3. **Help Content Priority:**
   - Which guides are most important?
   - Start with basic structure or full content?

4. **Search Functionality:**
   - Include in Phase 1?
   - Or Phase 2 enhancement?

---

## Estimated Implementation Time

- **Phase 1 (Basic Structure):** 3-4 hours
- **Phase 2 (Full Help Content):** 6-8 hours
- **Phase 3 (Enhanced Features):** 4-6 hours

---

## Next Steps

1. Review this outline
2. Confirm layout preference
3. Prioritize help content sections
4. Approve Phase 1 scope
5. Begin implementation

