# Question Progress Over Time: Handling Form/Question Changes During Programs

## Understanding the Problem

### Current Implementation
The "Question Progress Over Time" table:
1. Collects all unique `questionId`s from all historical check-in responses
2. Matches responses by `questionId` across different weeks
3. Displays scores week-by-week, with empty cells when a question wasn't present in that check-in

### The Challenge
When forms/questions are modified during an active program, several scenarios create data integrity and UX issues:

#### Scenario 1: New Questions Added Mid-Program
- **Example**: Week 5, coach adds "How is your sleep quality?"
- **Current Behavior**: Shows empty cells for Weeks 1-4, only data from Week 5+
- **Issue**: Clutters table with incomplete rows, but manageable

#### Scenario 2: Questions Removed Mid-Program
- **Example**: Week 3, coach removes "How many steps did you walk today?" (was in Weeks 1-2)
- **Current Behavior**: Question still appears in table with empty cells for Weeks 3+
- **Issue**: Confusing - shows "dead" questions that are no longer being asked

#### Scenario 3: Question Text Changed
- **Example**: Week 4, coach changes "How are you feeling?" to "Rate your overall mood (1-10)"
- **Current Behavior**: Shows old question text with data from all weeks
- **Issue**: Misleading - question meaning/scoring may have changed but appears as same question

#### Scenario 4: Question Options/Scoring Changed
- **Example**: Week 3, "Energy levels" changes from Yes/No to 1-10 scale
- **Current Behavior**: Mixes incompatible score types in same row
- **Issue**: Data incompatibility - can't compare scores across weeks meaningfully

#### Scenario 5: Question Replaced (Removed + New Similar)
- **Example**: Remove "Protein intake" (weeks 1-3), add "Daily protein grams" (weeks 4+)
- **Current Behavior**: Shows as two separate questions, both with incomplete data
- **Issue**: Loses continuity - related questions appear unrelated

## CTO Recommendations

### Strategy 1: Question Versioning (Recommended - Long-term)

**Approach**: Track question versions and form snapshots

**Implementation**:
1. When a form is modified, create a **snapshot** of the form at that point in time
2. Each check-in response references the **formVersionId** (snapshot) it was based on
3. Questions have a `version` field; changes create new versions while maintaining `originalQuestionId`
4. Display logic groups questions by `originalQuestionId` but shows version-aware data

**Benefits**:
- Maintains data integrity
- Can show "question evolution" over time
- Preserves historical accuracy
- Allows "question family" grouping

**Complexity**: High - requires schema changes and migration

---

### Strategy 2: Question Lifecycle Status (Medium-term)

**Approach**: Track when questions are added/removed and handle display accordingly

**Implementation**:
1. Add metadata to questions:
   - `addedAt`: Timestamp when question was first used
   - `removedAt`: Timestamp when question was removed (nullable)
   - `lastModifiedAt`: Timestamp of last change
   - `status`: 'active' | 'deprecated' | 'replaced'

2. In progress table:
   - **Filter out deprecated questions** by default (with toggle to show all)
   - Show **"Question added in Week X"** badge for questions that start mid-program
   - Show **"Question removed in Week X"** badge for questions that end mid-program
   - Group by `questionId` but show status indicators

**Benefits**:
- Cleaner default view (no "dead" questions)
- Users understand why data exists or doesn't
- Moderate implementation complexity

**Display Logic**:
```typescript
// Filter questions based on their lifecycle
const activeQuestions = questions.filter(q => {
  const addedWeek = getWeekNumber(q.addedAt);
  const removedWeek = q.removedAt ? getWeekNumber(q.removedAt) : null;
  const currentWeek = getCurrentWeek();
  
  return !removedWeek || removedWeek > currentWeek;
});

// Show badge for questions with limited history
{question.addedWeek > 1 && (
  <Badge>Added Week {question.addedWeek}</Badge>
)}
{question.removedWeek && (
  <Badge variant="warning">Removed Week {question.removedWeek}</Badge>
)}
```

---

### Strategy 3: Question Grouping & Smart Display (Short-term - Recommended for MVP)

**Approach**: Improve UX with smart filtering and visual indicators

**Implementation**:
1. **Default View**: Only show questions that have data in the most recent week (active questions)
2. **"Show All Questions" Toggle**: Include deprecated questions with visual distinction
3. **Visual Indicators**:
   - Gray out/italicize question text for deprecated questions
   - Show "—" (dash) with tooltip "Question not in this check-in" for missing cells
   - Add "NEW" badge next to questions that first appear mid-program
   - Group related questions (by category or text similarity)

4. **Question Matching Enhancement**:
   - Primary: Match by `questionId`
   - Fallback: Match by normalized question text (if IDs differ but text is identical)
   - Show warning if question text changed but ID is same: "⚠ Question wording changed"

**Benefits**:
- Quick win - minimal code changes
- Significantly improves UX
- Can be implemented alongside Strategy 2

**Code Changes**:
```typescript
const processQuestionProgress = (responses: FormResponse[]) => {
  // ... existing code ...
  
  // Determine question lifecycle status
  const questionStatus = new Map<string, {
    firstSeenWeek: number;
    lastSeenWeek: number;
    isActive: boolean;
    textChanges: string[]; // Track if question text changed
  }>();
  
  sortedResponses.forEach((response, weekIndex) => {
    response.responses?.forEach((qResp: QuestionResponse) => {
      const status = questionStatus.get(qResp.questionId) || {
        firstSeenWeek: weekIndex + 1,
        lastSeenWeek: weekIndex + 1,
        isActive: weekIndex === sortedResponses.length - 1,
        textChanges: [qResp.question || qResp.questionText]
      };
      
      status.lastSeenWeek = Math.max(status.lastSeenWeek, weekIndex + 1);
      status.isActive = weekIndex === sortedResponses.length - 1;
      
      // Track text changes
      const currentText = qResp.question || qResp.questionText;
      if (!status.textChanges.includes(currentText)) {
        status.textChanges.push(currentText);
      }
      
      questionStatus.set(qResp.questionId, status);
    });
  });
  
  // Filter: Only show active questions by default
  const activeOnly = true; // From user preference/state
  const filteredQuestions = progress.filter(q => {
    const status = questionStatus.get(q.questionId);
    return activeOnly ? status?.isActive : true;
  });
};
```

---

### Strategy 4: Form Snapshot on Check-in Completion (Hybrid)

**Approach**: When a check-in is completed, store a snapshot of the form state

**Implementation**:
1. When check-in is submitted, store `formSnapshot` in the response:
```typescript
{
  formId: 'form-123',
  formVersion: '2025-01-15-v2', // Auto-generated or manual
  formSnapshot: {
    formTitle: 'Vana Health 2026 Check In',
    questions: [
      { id: 'q1', text: 'Question 1', type: 'scale', weight: 5 },
      // ... all questions at time of submission
    ]
  },
  responses: [...]
}
```

2. Progress table uses `formSnapshot` to understand question context
3. Can detect changes by comparing snapshots across weeks

**Benefits**:
- Preserves historical accuracy
- Can reconstruct "what the form looked like" at any point
- Works with existing data (going forward)

**Complexity**: Medium - requires storing additional data

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (1-2 days)
1. ✅ Add "Show All Questions" toggle (default: active questions only)
2. ✅ Visual indicators for new/deprecated questions
3. ✅ Better empty cell display (dash with tooltip)
4. ✅ Group questions by category

### Phase 2: Enhanced Tracking (1 week)
1. Add question lifecycle metadata tracking
2. Detect question text changes and show warnings
3. Implement question status filtering
4. Add "Question History" tooltip showing when added/removed

### Phase 3: Long-term (Future)
1. Implement form snapshot system
2. Consider question versioning if needed
3. Advanced question grouping/merging logic

---

## Edge Cases to Handle

1. **Question ID Reuse**: If same ID is used for different questions (shouldn't happen but protect against it)
2. **Bulk Question Changes**: When multiple questions change in one form update
3. **Client-Specific Forms**: If different clients have different forms (currently all use same form)
4. **Question Deletion**: If question is deleted from database but exists in historical responses
5. **Form Replacement**: If entire form is replaced with new form (different formId)

---

## User Experience Considerations

### Coach Perspective
- **Need**: Understand client progress on questions over time
- **Want**: Clean view of active questions, ability to see historical questions
- **Expectation**: When they remove a question, it shouldn't clutter the view

### Display Options to Provide
1. **Default View**: Active questions only (have data in most recent week)
2. **Historical View**: All questions that ever existed
3. **Custom Filter**: Questions added/removed in specific date range
4. **Category Filter**: Filter by question category

### Visual Hierarchy
- Active questions: Normal styling
- Deprecated questions: Grayed out, italic, or in collapsed section
- New questions: "NEW" badge, subtle highlight
- Changed questions: Warning icon with tooltip explaining change

---

## Data Model Considerations

### Current Schema (formResponses)
```typescript
{
  id: string;
  formId: string;
  clientId: string;
  submittedAt: Date;
  responses: Array<{
    questionId: string;
    question: string; // Question text at time of response
    answer: any;
    score: number;
    type: string;
  }>;
}
```

### Proposed Enhancements
```typescript
// Option A: Add metadata to response
{
  // ... existing fields ...
  formSnapshot?: {
    formVersion: string;
    questions: Array<{ id: string; text: string; type: string; weight: number }>;
  };
}

// Option B: Track in separate collection
// question_lifecycle: { questionId, addedAt, removedAt, lastModifiedAt, status }
```

---

## Questions for Stakeholder

1. **Is it acceptable** to hide deprecated questions by default? (They can toggle to see all)
2. **Should we prevent** question text changes mid-program, or just warn about them?
3. **Do we need** to maintain question history indefinitely, or can we archive old questions?
4. **Should new questions** be clearly marked, or blend in naturally?
5. **How should we handle** questions that are removed and then re-added later (same ID or new ID)?

---

## Recommendation Summary

**For MVP/Short-term**: Implement **Strategy 3** (Smart Display) with these features:
- Default to active questions only
- Visual indicators for new/deprecated questions  
- Better empty cell handling
- "Show All" toggle

**For Medium-term**: Implement **Strategy 2** (Lifecycle Status) to add proper tracking

**For Long-term**: Consider **Strategy 1** (Versioning) if question evolution becomes critical to the product

This provides immediate value while maintaining flexibility for future enhancements.



