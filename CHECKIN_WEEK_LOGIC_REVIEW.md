# Check-in Week Logic Review - CTO Assessment

## Concept Confirmation
**Check-ins are about the PREVIOUS week, not the upcoming week.**
- All questions are past tense: "over the past week", "did you", "were you", etc.
- Clients are reflecting on what happened, not planning ahead.

## Current System Logic Analysis

### Week Numbering and Due Dates

**Example: Week 1 Check-in**
- **Due Date**: Monday Jan 5, 2026 (9:00 AM)
- **Check-in About**: The week ending Sunday Jan 4, 2026 (Mon Dec 29 - Sun Jan 4)
- **Window Opens**: Friday Jan 2, 2026 (10:00 AM) - DURING the week being checked in about
- **Window Closes**: Tuesday Jan 6, 2026 (12:00 PM) - AFTER the due date

**Example: Week 2 Check-in**
- **Due Date**: Monday Jan 12, 2026 (9:00 AM)
- **Check-in About**: The week ending Sunday Jan 11, 2026 (Mon Jan 5 - Sun Jan 11)
- **Window Opens**: Friday Jan 9, 2026 (10:00 AM) - DURING the week being checked in about
- **Window Closes**: Tuesday Jan 13, 2026 (12:00 PM) - AFTER the due date

### Current Implementation Issues

#### ✅ CORRECT:
1. **Window timing is correct**: Opens Friday (during the week being checked in about), closes Tuesday (after the Monday due date)
2. **Due dates are Mondays**: Correctly set to Monday of each week
3. **Questions are past tense**: All questions ask about "the past week"

#### ⚠️ POTENTIAL ISSUES:

1. **Week Labeling Ambiguity**:
   - Currently displays: "Week 2: Vana Health 2026 Check In"
   - **Question**: Is "Week 2" clear that it's about Week 2 (the week ending Jan 11)?
   - **OR**: Should it say "Week 2 Check-in (about week ending Jan 11)"?
   - **Issue**: "Week 2" could be interpreted as "the second check-in" OR "check-in about week 2"

2. **Due Date vs. Reference Week Confusion**:
   - Due date is Monday Jan 12 (when check-in is due)
   - But check-in is ABOUT the week ending Jan 11
   - **Question**: Should we show "Due: Jan 12" AND "About: Week of Jan 5-11"?

3. **Window Opening Logic**:
   - Window opens Friday Jan 9 (during the week being checked in about)
   - **This is CORRECT** - clients can start filling out during the week
   - But the week being checked in about isn't complete yet when window opens
   - **Question**: Is this intentional? Or should window open AFTER the week ends (Monday)?

4. **"Current Check-in" Display**:
   - Shows "Week 2: Vana Health 2026 Check In"
   - **Issue**: Doesn't clearly state it's about the previous week
   - **Suggestion**: "Week 2 Check-in (Reflecting on week ending Jan 11)"

### Recommended Changes

#### Option 1: Add Clear Week Reference (Recommended)
```
"Week 2 Check-in"
"About: Week ending Sunday, Jan 11"
"Due: Monday, Jan 12"
```

#### Option 2: More Descriptive Labeling
```
"Check-in: Week of Jan 5-11"
"Due: Monday, Jan 12 at 9:00 AM"
```

#### Option 3: Past Tense in Title
```
"Week 2 Check-in: How was your week?"
"Reflecting on: Jan 5-11"
"Due: Monday, Jan 12"
```

### Code Locations to Review

1. **Check-in Display** (`src/app/client-portal/check-ins/page.tsx`):
   - Line 728-729: `Week ${currentCheckin.recurringWeek}: ${currentCheckin.title}`
   - **Should include**: The week being referenced

2. **Check-in Completion Page** (`src/app/client-portal/check-in/[id]/page.tsx`):
   - Line 1042-1044: `Week {assignment.recurringWeek} of {assignment.totalWeeks}`
   - **Should clarify**: What week this is about

3. **Week Calculation Logic** (`src/app/api/client-portal/check-ins/route.ts`):
   - Lines 383-404: Week generation logic
   - **Status**: ✅ CORRECT - Generates Monday due dates
   - **Question**: Should we also store the "reference week" dates?

### Questions for Product/Design Team

1. **Week Labeling**:
   - Should "Week 2" mean "the second check-in" or "check-in about week 2"?
   - How should we display which week is being checked in about?

2. **Window Timing**:
   - Is it correct that window opens Friday DURING the week being checked in about?
   - Or should window open AFTER the week ends (Monday)?

3. **Due Date Clarity**:
   - Should we show both "Due Date" (when check-in is due) and "Reference Week" (what week it's about)?
   - Or is "Due: Monday Jan 12" sufficient?

4. **User Experience**:
   - Do clients understand they're checking in about the previous week?
   - Should we add helper text like "This check-in is about your week ending Sunday, Jan 11"?

### Proposed Implementation

#### Add Reference Week Calculation
```typescript
// For a check-in due on Monday Jan 12:
// Reference week is the week BEFORE that Monday (Mon Jan 5 - Sun Jan 11)
function getReferenceWeek(dueDate: Date) {
  const monday = new Date(dueDate);
  monday.setDate(dueDate.getDate() - 7); // Go back 7 days to get previous Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6); // Sunday of that week
  return { start: monday, end: sunday };
}
```

#### Update Display Labels
```typescript
// Instead of: "Week 2: Vana Health 2026 Check In"
// Show: "Week 2 Check-in: Vana Health 2026 Check In"
//       "Reflecting on: Week ending Sunday, Jan 11"
//       "Due: Monday, Jan 12 at 9:00 AM"
```

## Conclusion

**The logic is mostly correct, but labeling could be clearer.**

✅ **Correct**:
- Check-ins are about the previous week
- Questions are past tense
- Window opens Friday (during the week being checked in about)
- Due dates are Mondays

⚠️ **Needs Improvement**:
- Week labeling doesn't clearly indicate which week is being referenced
- No display of "reference week" dates
- Could be clearer that check-ins are retrospective

**Recommendation**: Add reference week display to make it crystal clear what week each check-in is about.


