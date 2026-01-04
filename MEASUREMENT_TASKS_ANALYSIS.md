# CTO Analysis: Recurring Measurement Tasks Feature

## Understanding of Requirements

### Current State:
- **Check-in allocation system**: Coaches allocate check-ins (forms) to clients with recurring schedules
- **Measurement tracking**: Clients can manually add measurements/photos via `/client-portal/measurements` and `/client-portal/progress-images`
- **Todo system**: Onboarding todos exist on dashboard for baseline setup (weight, measurements, photos)

### Requested Feature:
**Fortnightly (every 2 weeks) automatic tasks** for clients to update:
1. Body measurements
2. Progress photos

**Workflow:**
1. When coach allocates a check-in to a client, they also select a **"First Measurement Friday"** date
2. System automatically creates recurring tasks every 2 weeks on Fridays
3. Tasks appear in client's todo/dashboard as reminders
4. Example: Client starts Monday Jan 5 → Coach selects Friday Jan 23 → Tasks on Jan 23, Feb 6, Feb 20, etc.

---

## Technical Architecture

### Option 1: Integrated with Check-in Allocation (Recommended)
**Pros:**
- Natural workflow - coach sets measurement schedule when setting up check-ins
- Single source of truth
- Easier to manage start date

**Cons:**
- Couples measurement tasks to check-in allocation
- What if coach wants to set measurement schedule separately?

### Option 2: Separate Measurement Schedule Configuration
**Pros:**
- Independent of check-in schedule
- More flexible

**Cons:**
- Additional UI/UX complexity
- Coach needs to set both separately

---

## Data Structure

### New Collection: `measurement_schedules`
```typescript
interface MeasurementSchedule {
  id: string;
  clientId: string;
  coachId: string;
  firstFridayDate: string; // ISO date string for first Friday
  frequency: 'fortnightly' | 'weekly' | 'monthly'; // default: 'fortnightly'
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### New Collection: `measurement_tasks`
```typescript
interface MeasurementTask {
  id: string;
  clientId: string;
  scheduleId: string; // Links to measurement_schedules
  dueDate: string; // ISO date string (Friday date)
  status: 'pending' | 'completed' | 'overdue' | 'skipped';
  completedAt?: string;
  reminderSent?: boolean;
  createdAt: string;
}
```

**Alternative: Generate tasks on-the-fly**
- Don't store individual task documents
- Calculate pending tasks based on `measurement_schedules`
- Only create task document when marked complete
- Pros: Less database storage, easier to adjust schedule
- Cons: More complex queries

---

## Implementation Approach

### Phase 1: Schedule Creation
1. **Add to check-in allocation modal:**
   - Optional checkbox: "Enable fortnightly measurement reminders"
   - Date picker: "First measurement Friday" (defaults to 2nd Friday after start date)
   - Creates `measurement_schedules` document

2. **Auto-calculate first Friday:**
   - If check-in starts Monday Jan 5
   - Calculate next Friday (Jan 9)
   - Then calculate 2nd Friday (Jan 23)
   - Or let coach pick manually

### Phase 2: Task Generation
**Option A: Generate tasks in advance (12 months)**
- When schedule created, generate next 26 tasks (52 weeks / 2)
- Background job to generate more as needed

**Option B: Calculate tasks on-demand**
- Client dashboard queries: "What's the next measurement task due?"
- Calculates based on `firstFridayDate` + frequency
- More flexible, less storage

### Phase 3: Dashboard Integration
1. **Client Dashboard:**
   - Show next measurement task in todos section
   - "Update Measurements & Photos - Due: [Date]"
   - Links to `/client-portal/measurements` page

2. **Task Completion:**
   - Auto-detect: If measurements/photos added on or after due date → mark complete
   - Manual: Client can mark as done
   - Or: Coach marks as complete

3. **Notifications:**
   - Send reminder notification 1-2 days before due date
   - Send notification on due date
   - Mark overdue if not completed within 3 days

---

## Questions for Clarification

1. **Integration Point:**
   - Should measurement schedule be set **only** when allocating check-in?
   - Or should there be a separate "Measurement Schedule" setting in client profile?

2. **Task Generation:**
   - Generate tasks in advance (6-12 months)?
   - Or calculate on-demand when client views dashboard?

3. **Completion Detection:**
   - Auto-detect when client adds measurements/photos on due date?
   - Manual completion only?
   - Coach can mark as complete?

4. **First Friday Calculation:**
   - Auto-calculate "2nd Friday after start date"?
   - Or always manual coach selection?

5. **Flexibility:**
   - Can coach pause/resume measurement schedule?
   - Can coach adjust frequency per client?
   - Can coach skip specific dates?

6. **Overdue Handling:**
   - How long before task marked overdue?
   - What happens to overdue tasks? (Show in separate list, send reminders, etc.)

---

## Recommended Implementation

### Immediate Solution (MVP):
1. Add "Enable Measurement Reminders" checkbox + date picker to check-in allocation modal
2. Create `measurement_schedules` collection
3. Calculate tasks on-demand (Option B)
4. Show next task in client dashboard todos
5. Auto-complete when measurements/photos added within 3 days of due date
6. Send reminder notification on due date

### Future Enhancements:
- Pause/resume schedules
- Different frequencies per client
- Coach can mark tasks complete manually
- Measurement task history/analytics
- Skip specific dates

---

## Code Locations

**To Modify:**
- `/src/app/clients/[id]/page.tsx` - Add measurement schedule UI to allocation modal
- `/src/app/api/check-in-assignments/route.ts` - Handle schedule creation
- `/src/app/api/client-portal/route.ts` - Include measurement tasks in dashboard data
- `/src/app/client-portal/page.tsx` - Display measurement tasks in todos
- `/src/app/api/client-measurements/route.ts` - Auto-complete tasks when measurements added
- `/src/lib/notification-service.ts` - Send measurement reminders

**To Create:**
- `/src/app/api/measurement-schedules/route.ts` - CRUD for schedules
- `/src/app/api/measurement-tasks/route.ts` - Task generation and completion
- `/src/lib/measurement-task-utils.ts` - Calculate next task dates





