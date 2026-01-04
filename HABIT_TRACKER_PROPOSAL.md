# Habit Tracker Module - Feature Proposal

## Executive Summary

The Habit Tracker module is a lightweight, motivating feature designed to support users in building sustainable daily health habits. Unlike the existing check-in system (which focuses on periodic assessments), the habit tracker emphasizes small, daily wins through consistent task completion.

---

## 1. Feature Overview

### 1.1 Purpose
Enable clients to track daily wellness habits (hydration, meal prep, mindfulness, steps, strength training, journaling, etc.) with visual feedback, streak tracking, and gentle reminders to reinforce consistency.

### 1.2 Key Principles
- **Lightweight**: Simple, quick interactions (1-2 taps to complete)
- **Motivating**: Visual feedback (streaks, progress bars, celebrations)
- **Flexible**: Customizable habits by coach or client
- **Integrated**: Works alongside existing check-ins and goals
- **Non-overwhelming**: Focus on 3-7 active habits at a time

---

## 2. User Stories

### 2.1 Client Perspective
- As a client, I want to see my daily habits in one place so I can quickly check them off
- As a client, I want to see my streak counts so I feel motivated to maintain consistency
- As a client, I want to receive gentle reminders so I don't forget to complete my habits
- As a client, I want to add my own personal habits so I can track things that matter to me
- As a client, I want to see my progress over time so I can visualize my consistency

### 2.2 Coach Perspective
- As a coach, I want to assign default habits to clients so they have a foundation to build on
- As a coach, I want to see my client's habit completion rates so I can provide targeted support
- As a coach, I want to customize habit templates so I can align with my coaching protocols
- As a coach, I want to provide feedback on habits so I can encourage and guide clients

---

## 3. Technical Architecture

### 3.1 Data Structure

#### Firestore Collections

**`habits` Collection**
```typescript
{
  id: string; // Document ID
  coachId: string; // Coach who created this habit template
  clientId?: string; // If client-specific, otherwise null (template)
  name: string; // "Drink 8 glasses of water"
  description?: string; // Optional description/instructions
  category: 'hydration' | 'nutrition' | 'movement' | 'mindfulness' | 'sleep' | 'other';
  frequency: 'daily' | 'weekly' | 'custom'; // Currently daily, future: weekly
  icon?: string; // Icon identifier (e.g., "💧", "🧘", "🏋️")
  color?: string; // Theme color for visual distinction
  isTemplate: boolean; // True if it's a reusable template
  isActive: boolean; // Active/inactive status
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**`habit_completions` Collection**
```typescript
{
  id: string; // Document ID
  habitId: string; // Reference to habits collection
  clientId: string; // Client who completed it
  date: string; // ISO date string (YYYY-MM-DD) for daily grouping
  completedAt: Timestamp; // When it was marked complete
  notes?: string; // Optional client notes
  skipped?: boolean; // True if explicitly skipped (not just not done)
  createdAt: Timestamp;
}
```

**`habit_streaks` Collection (Computed/Cached)**
```typescript
{
  id: string; // Document ID (habitId_clientId)
  habitId: string;
  clientId: string;
  currentStreak: number; // Current consecutive days
  longestStreak: number; // All-time best streak
  lastCompletedDate: string; // ISO date string
  updatedAt: Timestamp; // Last time streak was recalculated
}
```

**Client Document Extension**
Add to `clients` collection:
```typescript
{
  // ... existing fields
  activeHabits: string[]; // Array of habit IDs currently active for this client
  habitPreferences?: {
    reminderTime?: string; // "09:00" - when to send reminders
    reminderEnabled?: boolean; // Default: true
  };
  gamification?: {
    enabled: boolean; // Default: true
    totalXP: number; // Lifetime total XP
    currentLevel: number; // Calculated from totalXP
    xpThisWeek: number; // Weekly reset
    xpThisMonth: number; // Monthly reset
    lastXPUpdate: Timestamp;
    preferences: {
      showXP: boolean;
      showBadges: boolean;
      showLevel: boolean;
      celebrateMilestones: boolean;
    };
  };
}
```

### 3.2 API Routes

**New Routes:**
- `GET /api/habits` - List habits for client (with completion status for today)
- `GET /api/habits/[id]` - Get single habit details
- `POST /api/habits` - Create new habit (coach or client)
- `PATCH /api/habits/[id]` - Update habit
- `DELETE /api/habits/[id]` - Delete/deactivate habit
- `POST /api/habits/[id]/complete` - Mark habit as complete for today
- `POST /api/habits/[id]/skip` - Mark habit as skipped for today
- `DELETE /api/habits/[id]/complete` - Uncomplete (undo) habit for today
- `GET /api/habits/[id]/streak` - Get streak data for a habit
- `GET /api/habits/analytics` - Get completion stats and trends (coach view)
- `GET /api/habits/gamification` - Get XP, level, and badges for client
- `POST /api/habits/gamification/award-badge` - Award badge (system-triggered)
- `GET /api/habits/badges` - Get badge gallery (all badges with earned status)
- `GET /api/habits/gamification/unlocks` - Get available and unlocked features
- `POST /api/habits/gamification/unlock` - Unlock a feature (verify XP/level requirement)

**Existing Routes (Extensions):**
- `GET /api/client-portal` - Include habit completion status for today
- `GET /api/coach/clients/[id]` - Include habit analytics for coach view

### 3.3 Client-Side Pages/Components

**New Pages:**
- `/client-portal/habits` - Main habit tracker page (list view + calendar view)
- `/client-portal/habits/create` - Create new habit (client)
- `/client-portal/habits/[id]` - Habit detail/edit page

**New Components:**
- `HabitCard.tsx` - Individual habit card with completion checkbox
- `HabitStreakBadge.tsx` - Streak counter display
- `HabitCalendar.tsx` - Calendar view showing completion history
- `HabitProgressBar.tsx` - Progress visualization
- `CreateHabitModal.tsx` - Modal for creating/editing habits

**Existing Pages (Extensions):**
- `/client-portal` (Dashboard) - Add "Today's Habits" section with quick-complete cards
- `/clients/[id]` (Coach view) - Add "Habits" tab showing client's habit analytics

---

## 4. User Flows

### 4.1 Client: Daily Habit Completion

1. Client opens Dashboard or Habits page
2. Sees list of active habits for today
3. Each habit shows:
   - Name and icon
   - Completion checkbox (empty if not done, checked if done)
   - Current streak badge
   - Quick action button
4. Client taps checkbox/button to mark complete
5. Visual feedback: Checkmark animates, streak updates, progress bar advances
6. Optional: Client adds quick note about completion
7. Completion saved to Firestore
8. Streak counter updated (server-side or client-side calculation)

### 4.2 Client: Creating Custom Habit

1. Client navigates to Habits page
2. Taps "Add Habit" button
3. Modal/form opens with fields:
   - Name (required)
   - Category (dropdown)
   - Description (optional)
   - Icon picker (optional)
   - Color picker (optional)
4. Client fills form and submits
5. Habit created and added to active habits
6. Confirmation message shown

### 4.3 Coach: Assigning Habits to Client

1. Coach navigates to client profile
2. Opens "Habits" tab
3. Sees:
   - Client's current active habits
   - Library of habit templates
   - Client's completion statistics
4. Coach can:
   - Assign template habit to client
   - Create new custom habit for client
   - Edit/remove client's habits
   - View completion trends and streaks
5. Changes saved and synced to client's view

### 4.4 Notifications/Reminders

1. Scheduled job runs (Cloud Scheduler) at configured reminder time
2. Queries clients with `habitPreferences.reminderEnabled === true`
3. For each client, checks which habits are not yet completed today
4. Sends reminder email/push notification (future: push notifications)
5. Email includes:
   - List of incomplete habits
   - Link to habits page
   - Current streak information (motivation)
   - Encouragement message

---

## 5. UI/UX Design

### 5.1 Dashboard Integration

**Quick Stats Section (Dashboard)**
- Add "Habits Completed Today" card
- Shows: "3 of 5 habits completed" with progress bar
- Tap to go to full habits page

**Today's Habits Section (Dashboard)**
- Compact list of today's active habits
- Quick-complete checkboxes
- Shows streaks inline
- "View All Habits" link at bottom

### 5.2 Habits Page (Dedicated)

**List View (Default)**
- Header: "Habits" + "Add Habit" button
- Filter tabs: "Today" | "All" | "By Category"
- List of habit cards, each showing:
  - Icon + Name
  - Description (collapsible)
  - Completion checkbox (large, touch-friendly)
  - Streak badge (e.g., "🔥 7 days")
  - Progress indicator (monthly completion %)
  - Quick actions (edit, delete)

**Calendar View (Toggle)**
- Monthly calendar
- Days with completions highlighted
- Tap day to see habits completed that day
- Streak indicators on consecutive days

**Empty State**
- Friendly message: "Start building healthy habits!"
- "Add Your First Habit" call-to-action button
- Suggests common habits (hydration, steps, mindfulness)

### 5.3 Visual Feedback

**Completion Animation**
- Checkmark appears with subtle animation
- Streak number updates with count-up animation
- Progress bar fills smoothly
- Optional: Confetti/celebration for milestones (7-day streak, 30-day streak)

**Streak Badges**
- Fire emoji (🔥) for active streaks
- Number of days prominently displayed
- Color coding: Green (7+), Gold (30+), Purple (100+)

**Progress Visualization**
- Weekly completion bar (7 days)
- Monthly completion percentage
- Trend indicators (↑ improving, ↓ declining)

---

## 6. Integration Points

### 6.1 Existing Systems

**Check-ins Integration**
- Habits can be referenced in check-in questions
- "How consistent were you with your habits this week?" (scale 1-10)
- Completion data can inform check-in responses

**Goals Integration**
- Habits can be linked to goals
- "Complete daily strength training habit" → Progress toward "Build muscle" goal
- Visual connection between habits and goals on Goals page

**Messaging Integration**
- Coach can comment on habit completion patterns
- Automated messages for streaks: "Congratulations on your 7-day streak! 🎉"
- Coach feedback on habit performance

**Analytics Integration**
- Habit completion rates in client analytics
- Correlation between habit consistency and check-in scores
- Progress trends over time

### 6.2 Notification System

**Email Reminders**
- Use existing email service (`src/lib/email-service.ts`)
- New template: `getHabitReminderEmailTemplate()`
- Scheduled via Cloud Scheduler (hourly check at reminder time)

**Future: Push Notifications**
- Firebase Cloud Messaging (FCM)
- Daily reminder notifications
- Streak milestone notifications
- Coach feedback notifications

---

## 7. Implementation Phases

### Phase 1: Core Functionality (MVP)
**Timeline: 2-3 weeks**

1. **Data Structure**
   - Create Firestore collections (`habits`, `habit_completions`, `habit_streaks`)
   - Add fields to client documents
   - Set up Firestore security rules

2. **Basic API Routes**
   - `GET /api/habits` - List habits
   - `POST /api/habits` - Create habit
   - `POST /api/habits/[id]/complete` - Complete habit
   - `DELETE /api/habits/[id]/complete` - Uncomplete habit
   - `GET /api/habits/[id]/streak` - Get streak

3. **Client UI - Habits Page**
   - Basic list view with habit cards
   - Completion checkboxes
   - Streak display
   - Create habit modal

4. **Dashboard Integration**
   - "Today's Habits" section on dashboard
   - Quick-complete functionality
   - Link to full habits page

**Deliverables:**
- Clients can create habits
- Clients can mark habits complete/skip
- Streaks are calculated and displayed
- Basic visual feedback
- **Basic Gamification**: XP system, level calculation, simple streak badges (3, 7, 14, 30 days)

### Phase 2: Coach Features & Analytics
**Timeline: 1-2 weeks**

1. **Coach UI**
   - Habits tab in client profile
   - Assign template habits
   - View client analytics (completion rates, streaks)
   - Create custom habits for clients

2. **Analytics API**
   - `GET /api/habits/analytics` - Completion stats
   - Trend calculations
   - Weekly/monthly summaries

3. **Habit Templates**
   - Pre-built habit templates (hydration, steps, mindfulness, etc.)
   - Coach can create custom templates
   - Template library

**Deliverables:**
- Coaches can manage client habits
- Completion analytics visible to coaches
- Template system functional
- **Enhanced Gamification**: Full badge system, level-up celebrations, badge gallery, XP history

### Phase 3: Enhanced UX & Notifications
**Timeline: 1-2 weeks**

1. **Reminders**
   - Email reminder system
   - Cloud Scheduler integration
   - Customizable reminder times

2. **Calendar View**
   - Monthly calendar visualization
   - Historical completion data
   - Streak visualization on calendar

3. **Enhanced Visual Feedback**
   - Completion animations
   - Milestone celebrations
   - Progress charts

4. **Mobile Optimization**
   - Touch-friendly interactions
   - Swipe gestures (swipe to complete?)
   - Responsive design

**Deliverables:**
- Email reminders working
- Calendar view functional
- Polished animations and feedback
- **Advanced Gamification**: Perfect week/month tracking, category-specific badges, milestone badges, coach recognition points

### Phase 4: Advanced Features (Future)
**Timeline: TBD**

1. **Habit Linking**
   - Link habits to goals
   - Cross-habit dependencies
   - Habit chains/routines

2. **Social Features** (Optional)
   - Share streaks with coach
   - Celebration messages from coach
   - Group challenges (future)

3. **Advanced Analytics**
   - Correlation analysis (habits vs. check-in scores)
   - Pattern recognition
   - Personalized recommendations

4. **Push Notifications**
   - FCM integration
   - Real-time reminders
   - Milestone notifications

---

## 8. Technical Considerations

### 8.1 Performance

**Streak Calculation**
- Option 1: Calculate on-demand (simple but slower)
- Option 2: Cache in `habit_streaks` collection (recommended)
  - Update on completion/skip
  - Background job to recalculate daily (safety net)
  - Efficient for displaying multiple habits

**Date Handling**
- Use ISO date strings (YYYY-MM-DD) for daily grouping
- Handle timezone considerations (use client's timezone or UTC)
- Ensure consistency across client/server

**Querying Completions**
- Index: `habit_completions` collection on `(clientId, date)` and `(habitId, date)`
- Efficient queries for "today's completions" and "habit history"

### 8.2 Data Consistency

**Completion Integrity**
- Prevent duplicate completions for same habit/date
- Handle edge cases (midnight timezone transitions)
- Validation: Can't complete future dates, can't complete inactive habits

**Streak Calculation Logic**
- Current streak: Count consecutive days from today backwards
- Longest streak: Track all-time best (separate calculation)
- Handle gaps: If missed one day, streak resets to 0
- Skip vs. Not Done: Skipped days don't break streaks? (Design decision)

### 8.3 Security & Permissions

**Firestore Rules**
```javascript
// habits collection
match /habits/{habitId} {
  allow read: if isAuthenticated() && (
    // Clients can read their own habits
    (isClient() && resource.data.clientId == getUserId()) ||
    // Coaches can read their clients' habits
    (isCoach() && resource.data.coachId == getUserId()) ||
    // Coaches can read templates
    (isCoach() && resource.data.isTemplate == true)
  );
  
  allow create: if isAuthenticated() && (
    // Clients can create their own habits
    (isClient() && request.resource.data.clientId == getUserId()) ||
    // Coaches can create habits for their clients
    (isCoach() && request.resource.data.coachId == getUserId())
  );
  
  allow update, delete: if isAuthenticated() && (
    // Same rules as create
    (isClient() && resource.data.clientId == getUserId()) ||
    (isCoach() && resource.data.coachId == getUserId())
  );
}

// habit_completions collection
match /habit_completions/{completionId} {
  allow read: if isAuthenticated() && (
    (isClient() && resource.data.clientId == getUserId()) ||
    (isCoach() && resource.data.coachId == getUserId())
  );
  
  allow create, update, delete: if isAuthenticated() && (
    // Clients can only manage their own completions
    (isClient() && request.resource.data.clientId == getUserId())
  );
}
```

### 8.4 Edge Cases

**Timezone Handling**
- Store dates in ISO format (YYYY-MM-DD)
- Use client's timezone for "today" calculations
- Consider UTC vs. local time for reminders

**Deleting Habits**
- Soft delete: Set `isActive: false` instead of hard delete
- Preserve completion history for analytics
- Option to hard delete after X days of inactivity

**Habit Templates**
- Templates are coach-created, reusable habits
- When assigned to client, create client-specific copy
- Template changes don't affect existing client assignments

**Multiple Completions Per Day**
- Design decision: Allow multiple? (e.g., "Drink water" - 8 times)
- Or: Single completion per day per habit (simpler)
- Recommendation: Single completion (simpler UX, clearer streaks)

---

## 9. Design Decisions

### 9.1 Completion Model
**Decision**: One completion per habit per day
- Simpler mental model
- Clearer streak calculation
- Less overwhelming UX
- Can extend later if needed (e.g., "Water: 8/8 glasses")

### 9.2 Streak Logic
**Decision**: Consecutive days from today backwards
- Missed day breaks streak (resets to 0)
- Skipped days: TBD (recommend: skipped doesn't break streak, but doesn't count)
- Future dates: Not allowed

### 9.3 Reminder Timing
**Decision**: Single daily reminder at client-configured time
- Default: 9:00 AM client's timezone
- Configurable per client
- Can extend later to multiple reminders

### 9.4 Habit Limit
**Decision**: No hard limit, but UI suggests 3-7 active habits
- Too many habits = overwhelming
- Coach can guide clients
- UI can show warning: "You have 10 active habits. Consider focusing on 3-7."

---

## 10. Success Metrics

### 10.1 Engagement Metrics
- Daily active users (DAU) for habits feature
- Average habits per client
- Completion rate (completions / (active habits * days))
- Streak distribution (how many clients maintain 7+ day streaks)

### 10.2 Health Outcomes
- Correlation between habit consistency and check-in scores
- Long-term retention (clients with active habits stay longer?)
- Goal achievement rates for clients with active habits

### 10.3 Feature Adoption
- % of clients who create at least one habit
- % of coaches who assign habits to clients
- Average time to first habit creation

---

## 11. Open Questions

1. **Skipped vs. Not Done**: Should explicitly "skipped" days break streaks, or only "not done"?
2. **Habit Frequency**: Start with daily only, or support weekly habits from the start?
3. **Completion Flexibility**: Can clients complete habits for past days, or only today?
4. **Habit Dependencies**: Should some habits unlock others? (e.g., complete "Morning Routine" unlocks "Exercise")
5. **Social/Community**: Future feature - share streaks with coach/community?
6. **Gamification**: See Section 14 for detailed gamification proposal

---

## 12. Next Steps

1. **Review & Approval**: Stakeholder review of this proposal
2. **Design Mockups**: Create UI mockups for key screens
3. **Technical Spikes**: Prototype streak calculation, test Firestore queries
4. **Phase 1 Planning**: Break down Phase 1 into detailed tasks
5. **Development Start**: Begin Phase 1 implementation

---

## 13. Appendix: Example Habit Templates

### Pre-built Templates (Coach Library)

1. **Hydration**
   - Name: "Drink 8 glasses of water"
   - Category: hydration
   - Icon: 💧
   - Description: "Stay hydrated throughout the day"

2. **Steps**
   - Name: "Walk 10,000 steps"
   - Category: movement
   - Icon: 🚶
   - Description: "Track your daily steps"

3. **Mindfulness**
   - Name: "5-minute mindfulness practice"
   - Category: mindfulness
   - Icon: 🧘
   - Description: "Take time for mental wellness"

4. **Meal Prep**
   - Name: "Prepare tomorrow's meals"
   - Category: nutrition
   - Icon: 🥗
   - Description: "Plan ahead for nutritional success"

5. **Strength Training**
   - Name: "Strength training session"
   - Category: movement
   - Icon: 🏋️
   - Description: "Build strength and muscle"

6. **Journaling**
   - Name: "Evening gratitude journal"
   - Category: mindfulness
   - Icon: 📔
   - Description: "Reflect on the day's positives"

7. **Sleep**
   - Name: "Get 7-8 hours of sleep"
   - Category: sleep
   - Icon: 😴
   - Description: "Prioritize quality rest"

---

## 14. Gamification System

### 14.1 Overview

Gamification transforms habit tracking from a chore into an engaging, motivating experience. By adding game-like elements (points, badges, levels, achievements), we tap into intrinsic motivation and make daily habit completion feel rewarding.

### 14.2 Core Gamification Elements

#### 14.2.1 Points System (XP)

**Earning Points:**
- **Daily Completion**: 10 XP per habit completed
- **Streak Bonus**: 
  - 3-day streak: +5 XP bonus
  - 7-day streak: +10 XP bonus
  - 14-day streak: +20 XP bonus
  - 30-day streak: +50 XP bonus
  - 100-day streak: +200 XP bonus
- **Perfect Week**: Complete all habits 7 days in a row: +100 XP
- **Perfect Month**: Complete all habits 30 days in a row: +500 XP
- **Coach Recognition**: Coach gives feedback/encouragement: +25 XP

**Point Display:**
- Total XP shown in profile/navigation
- Daily XP earned shown on dashboard
- XP breakdown in habits page ("You earned 45 XP today!")

**Data Structure:**
```typescript
// Add to client document or separate collection
{
  totalXP: number; // Lifetime total
  currentLevel: number; // Calculated from totalXP
  xpThisWeek: number; // Weekly reset
  xpThisMonth: number; // Monthly reset
  lastXPUpdate: Timestamp;
}
```

#### 14.2.2 Level System

**Level Calculation:**
- Level = floor(sqrt(totalXP / 100)) + 1
- Example: 0-99 XP = Level 1, 100-399 XP = Level 2, 400-899 XP = Level 3, etc.
- Each level requires exponentially more XP (creates long-term goals)

**Level Benefits:**
- Visual level badge/indicator
- Level-up celebrations (animation, notification)
- Progress bar showing XP to next level
- Automatic feature unlocks (see XP Rewards below)

#### 14.2.2.1 XP Rewards & Unlocks

XP can be "spent" or used to unlock various features and personalization options, making the points system more meaningful and giving clients goals to work toward.

**Unlockable Features (XP Cost):**

**Personalization (Free - Level Unlocks):**
- **Level 2**: Custom habit colors (unlock color picker for habits)
- **Level 3**: Custom dashboard themes (light, dark, color themes)
- **Level 4**: Custom habit icons (access to expanded icon library)
- **Level 5**: Profile customization (custom profile picture frames/borders)
- **Level 6**: Achievement showcase (dedicated section on profile)
- **Level 7**: Weekly summary customization (email template styles)

**Feature Unlocks (XP Cost or Level-Based):**
- **50 XP**: Unlock "Habit Templates Library" (access to all coach templates)
- **100 XP**: Unlock "Advanced Analytics" (detailed charts, trend analysis)
- **200 XP**: Unlock "Habit Insights" (personalized recommendations)
- **300 XP**: Unlock "Habit Challenges" (self-created mini-challenges)
- **500 XP**: Unlock "Export Data" (download habit data as CSV/PDF)

**Virtual Rewards (XP Store):**
- **25 XP**: Unlock a new badge frame style
- **50 XP**: Unlock a celebration animation style
- **75 XP**: Unlock a custom title/display name badge ("Habit Master", "Consistency Champion")
- **100 XP**: Unlock a profile banner/background
- **150 XP**: Unlock exclusive achievement badges (special edition)

**Optional: Future Premium Features**
- **1000 XP**: Unlock early access to new features
- **2000 XP**: Unlock "Habit Coach AI" features (AI-powered suggestions)
- **5000 XP**: Unlock lifetime achievement title (permanent custom title)

**XP Spending Mechanics:**
- XP is never "consumed" - unlocks are permanent once earned
- Alternative approach: XP can be "spent" but can also be re-earned
- **Recommendation**: Keep XP as cumulative (never decreases) and use it for unlock thresholds rather than spending

**Display:**
- "XP Rewards" page showing all available unlocks
- Locked items: Grayed out with XP requirement shown
- Unlocked items: Full color with "Unlocked!" badge
- Progress indicators: "You need 50 more XP to unlock..."

#### 14.2.3 Badges & Achievements

**Badge Categories:**

**Streak Badges:**
- 🔥 "First Flame" - 3-day streak
- 🔥🔥 "Hot Streak" - 7-day streak
- 🔥🔥🔥 "On Fire" - 14-day streak
- 🔥🔥🔥🔥 "Inferno" - 30-day streak
- 🔥🔥🔥🔥🔥 "Unstoppable" - 100-day streak

**Completion Badges:**
- ✅ "First Step" - Complete first habit
- ✅✅ "Getting Started" - Complete 10 habits total
- ✅✅✅ "Consistent" - Complete 50 habits total
- ✅✅✅✅ "Dedicated" - Complete 200 habits total
- ✅✅✅✅✅ "Master" - Complete 1000 habits total

**Perfect Week/Month Badges:**
- ⭐ "Perfect Week" - Complete all habits 7 days in a row
- ⭐⭐ "Perfect Fortnight" - Complete all habits 14 days in a row
- ⭐⭐⭐ "Perfect Month" - Complete all habits 30 days in a row
- ⭐⭐⭐⭐ "Perfect Quarter" - Complete all habits 90 days in a row
- ⭐⭐⭐⭐⭐ "Perfect Year" - Complete all habits 365 days in a row

**Category-Specific Badges:**
- 💧 "Hydration Hero" - Complete hydration habit 30 days
- 🏋️ "Strength Master" - Complete strength training 30 days
- 🧘 "Mindful Master" - Complete mindfulness 30 days
- 🚶 "Step Champion" - Complete steps goal 30 days
- 📔 "Journal Keeper" - Complete journaling 30 days

**Milestone Badges:**
- 🎯 "Goal Achiever" - Link habit to goal and achieve goal
- 📊 "Data Tracker" - Track measurements consistently for 30 days
- 💬 "Communicator" - Message coach about habits 5 times
- 🎓 "Student" - Complete all onboarding habits

**Data Structure:**
```typescript
// achievements collection
{
  id: string;
  clientId: string;
  badgeId: string; // e.g., "streak_7", "perfect_week", "hydration_hero"
  badgeName: string;
  badgeIcon: string; // Emoji or icon identifier
  badgeDescription: string;
  earnedAt: Timestamp;
  category: 'streak' | 'completion' | 'perfect' | 'category' | 'milestone';
}
```

#### 14.2.4 Visual Rewards

**Completion Celebrations:**
- **Daily Completion**: Subtle checkmark animation
- **Streak Milestone** (7, 14, 30, 100 days): Confetti animation + badge unlock notification
- **Perfect Week**: Special animation + badge
- **Level Up**: Level-up animation with new level display
- **Badge Earned**: Badge reveal animation with description

**Progress Visualization:**
- XP progress bar (to next level)
- Weekly completion chart (7-day view)
- Monthly completion calendar (heat map)
- Streak fire indicators (more flames = longer streak)

**Dashboard Gamification Widget:**
- Current level with progress bar
- Recent badges earned (last 3)
- Today's XP earned
- Current streak display
- "Next badge" preview (e.g., "Complete 3 more days for 🔥 First Flame")

### 14.3 Gamification Features by Phase

#### Phase 1 (MVP) - Basic Gamification
- Points system (XP for completions)
- Basic level calculation
- Simple streak badges (3, 7, 14, 30 days)
- Completion celebrations

#### Phase 2 - Enhanced Gamification
- Full badge system (all categories)
- Level-up celebrations
- XP breakdown and history
- Badge gallery/collection view

#### Phase 3 - Advanced Gamification
- Perfect week/month tracking
- Category-specific badges
- Milestone badges
- Coach recognition points

#### Phase 4 (Future) - Social Gamification
- Leaderboards (optional, privacy-respecting)
- Team challenges (coach's clients)
- Share achievements (with coach)
- Community milestones

### 14.4 Gamification UI Components

#### 14.4.1 XP & Level Display

**Navigation/Profile:**
```
┌─────────────────────┐
│ Level 5             │
│ ████████░░ 850/1000 │
│ +45 XP today        │
└─────────────────────┘
```

**Habit Card:**
```
┌─────────────────────────────┐
│ 💧 Drink Water              │
│ ✅ Complete                 │
│ 🔥 7 day streak             │
│ +10 XP (+5 streak bonus)    │
└─────────────────────────────┘
```

#### 14.4.2 Badge Gallery

**Badges Page:**
- Grid view of all badges
- Earned badges: Full color, animated
- Locked badges: Grayed out with "Locked" overlay
- Progress indicators: "3/7 days" for streak badges
- Badge details: Name, description, earned date

**Badge Categories:**
- Tabs: "All" | "Streaks" | "Completions" | "Perfect" | "Categories" | "Milestones"

#### 14.4.3 Achievement Notifications

**Toast Notifications:**
- "🎉 Level Up! You're now Level 5!"
- "🔥 Badge Earned: 7-Day Streak!"
- "⭐ Perfect Week! You completed all habits!"
- "💧 Category Badge: Hydration Hero!"

**Email Notifications:**
- Weekly summary with XP earned, badges unlocked
- Milestone celebrations (30-day streak, level up, etc.)

### 14.5 Motivation Psychology

#### 14.5.1 Intrinsic vs. Extrinsic Motivation

**Balance:**
- Gamification enhances intrinsic motivation (feeling of progress, achievement)
- Avoids over-reliance on extrinsic rewards (points for points' sake)
- Focus on meaningful progress visualization

**Design Principles:**
- Celebrate effort, not just completion
- Show progress over time (not just today)
- Make achievements feel earned (not given)
- Connect gamification to real health outcomes

#### 14.5.2 Dopamine Loops

**Short-term (Daily):**
- Completion checkmark → Immediate satisfaction
- XP earned → Progress feedback
- Streak maintained → Continuity reward

**Medium-term (Weekly):**
- Perfect week badge → Weekly achievement
- Level progress → Weekly advancement
- Weekly summary → Reflection and motivation

**Long-term (Monthly/Yearly):**
- Level milestones → Long-term progress
- Category badges → Skill development
- Perfect month/year → Ultimate achievement

### 14.6 Coach Integration

#### 14.6.1 Coach Recognition

**Coach Can:**
- Give "Coach Recognition" points (+25 XP) for exceptional effort
- Comment on achievements ("Great job on your 30-day streak!")
- Suggest new habits based on achievements
- Celebrate milestones with clients

**Coach Dashboard:**
- View client levels and badges
- See XP leaderboard (optional, privacy-respecting)
- Identify clients who need motivation (low XP, no recent badges)
- Send encouragement based on gamification data

### 14.7 Privacy & Opt-Out

**Privacy Considerations:**
- Gamification data is private by default
- Clients can opt-out of gamification (still track habits, just no points/badges)
- Leaderboards are opt-in only (if implemented)
- Coach can see client gamification (for support purposes)

**Opt-Out Options:**
- Toggle in settings: "Enable Gamification"
- Can disable specific elements (points, badges, levels)
- Data still tracked for analytics, just not displayed

### 14.8 Technical Implementation

#### 14.8.1 Data Structures

**Add to Client Document:**
```typescript
{
  // ... existing fields
  gamification: {
    enabled: boolean; // Default: true
    totalXP: number;
    currentLevel: number;
    xpThisWeek: number;
    xpThisMonth: number;
    lastXPUpdate: Timestamp;
    preferences: {
      showXP: boolean;
      showBadges: boolean;
      showLevel: boolean;
      celebrateMilestones: boolean;
    };
  };
}
```

**New Collection: `client_achievements`**
```typescript
{
  id: string;
  clientId: string;
  badgeId: string; // Unique identifier for badge type
  badgeName: string;
  badgeIcon: string;
  badgeDescription: string;
  category: string;
  earnedAt: Timestamp;
  metadata?: {
    streakDays?: number;
    completionCount?: number;
    // Other badge-specific data
  };
}
```

**New Collection: `client_xp_unlocks`** (Optional - track unlocked features)
```typescript
{
  id: string;
  clientId: string;
  unlockId: string; // e.g., "custom_colors", "advanced_analytics"
  unlockType: 'personalization' | 'feature' | 'virtual_reward';
  unlockedAt: Timestamp;
  unlockedVia: 'level' | 'xp_threshold'; // How it was unlocked
  threshold: number; // XP or level required
}
```

#### 14.8.2 XP Calculation Service

**New File: `src/lib/gamification-service.ts`**
```typescript
// Functions:
- calculateXP(completion: HabitCompletion, streak: number): number
- calculateLevel(totalXP: number): number
- checkBadgeEligibility(clientId: string, habitId: string): Badge[]
- awardBadge(clientId: string, badgeId: string): void
- updateClientXP(clientId: string, xpEarned: number): void
- checkUnlocks(clientId: string, newXP: number, newLevel: number): Unlock[]
- unlockFeature(clientId: string, unlockId: string): void
- getAvailableUnlocks(clientId: string): Unlock[]
```

#### 14.8.3 Badge Definitions

**New File: `src/lib/badge-definitions.ts`**
```typescript
// Badge configuration:
const BADGE_DEFINITIONS = {
  streak_3: { name: "First Flame", icon: "🔥", xp: 0 },
  streak_7: { name: "Hot Streak", icon: "🔥🔥", xp: 50 },
  // ... all badges
};
```

### 14.9 Gamification Metrics

**Track:**
- Average XP per client per week
- Badge unlock rates
- Level distribution
- Engagement correlation (gamification vs. habit completion rates)
- Opt-out rates

**Success Indicators:**
- Clients with gamification enabled complete 20%+ more habits
- Badge unlocks correlate with continued engagement
- Level progression predicts long-term retention

---

**Document Version**: 1.1  
**Last Updated**: January 4, 2026  
**Author**: CTO  
**Status**: Proposal - Pending Review

