# Goals Questionnaire Integration Plan

## Overview
Integrate goals questionnaire responses into AI Analysis and create automatic goal tracking/notifications based on check-ins and measurements.

## Feasibility: ✅ YES, This is Achievable!

---

## Part 1: Add Goals Questionnaire to AI Analysis

### Current State
- AI Analysis (`/api/clients/[id]/ai-analytics`) currently uses:
  - Check-in scores and responses
  - Client profile data
  - Historical trends
  - Basic goals from `clientData?.goals`

### What We'll Add
1. **Fetch Goals Questionnaire Responses**
   - Load from `client_goals_questionnaire_responses` collection
   - Include in AI context when generating analysis

2. **Enhance AI Prompts**
   - Include goals questionnaire responses in analysis
   - AI can reference client's "why", vision, and commitment
   - Compare current performance to stated goals

### Implementation Steps

#### Step 1: Fetch Goals Questionnaire Data
```typescript
// In /api/clients/[id]/ai-analytics/route.ts

// Fetch goals questionnaire responses
let goalsQuestionnaire = null;
try {
  const questionnaireSnapshot = await db.collection('client_goals_questionnaire_responses')
    .where('clientId', '==', clientId)
    .where('status', '==', 'completed')
    .limit(1)
    .get();
  
  if (!questionnaireSnapshot.empty) {
    goalsQuestionnaire = questionnaireSnapshot.docs[0].data();
  }
} catch (error) {
  console.error('Error fetching goals questionnaire:', error);
}
```

#### Step 2: Include in AI Analysis Context
```typescript
// Add to risk analysis request
const riskAnalysis = await analyzeClientRisk({
  currentScore,
  historicalScores,
  textResponses,
  clientProfile: {
    goals: clientData?.goals || [],
    barriers: [],
    goalsQuestionnaire: goalsQuestionnaire?.responses || null, // NEW
    vision2026: goalsQuestionnaire?.responses?.['vision-2'] || null, // NEW
    commitment: goalsQuestionnaire?.responses?.['commitment-1'] || null, // NEW
  },
  coachContext
});
```

#### Step 3: Update AI Prompts
```typescript
// In /lib/ai-context.ts or /lib/ai-prompts.ts

// Add goals questionnaire context to risk analysis prompt
function buildRiskAnalysisWithGoalsPrompt(
  goalsQuestionnaire: any,
  clientGoals: any[]
): string {
  let prompt = buildRiskAnalysisSystemPrompt(coachContext);
  
  if (goalsQuestionnaire) {
    prompt += `\n\n## Client's 2026 Goals & Vision\n`;
    prompt += `Vision: ${goalsQuestionnaire.responses['vision-2']}\n`;
    prompt += `Why It Matters: ${goalsQuestionnaire.responses['vision-3']}\n`;
    prompt += `Commitment Level: ${goalsQuestionnaire.responses['commitment-1']}/10\n`;
    prompt += `Anticipated Challenges: ${goalsQuestionnaire.responses['commitment-2']}\n`;
    prompt += `First Action Step: ${goalsQuestionnaire.responses['nextsteps-1']}\n`;
  }
  
  if (clientGoals && clientGoals.length > 0) {
    prompt += `\n## Active Goals\n`;
    clientGoals.forEach(goal => {
      prompt += `- ${goal.title}: ${goal.currentValue}/${goal.targetValue} ${goal.unit} (${goal.progress}% complete, deadline: ${goal.deadline})\n`;
    });
  }
  
  prompt += `\nWhen analyzing risk and providing recommendations, consider:\n`;
  prompt += `1. Whether client's current performance aligns with their stated goals and vision\n`;
  prompt += `2. If they're on track to meet their goals by their deadlines\n`;
  prompt += `3. Whether their commitment level matches their progress\n`;
  prompt += `4. How to address their anticipated challenges\n`;
  
  return prompt;
}
```

---

## Part 2: Goal Progress Tracking & Notifications

### How It Works
Monitor check-ins and measurements to track progress toward goals, then notify coach when:
- ✅ Goal is **on track** (progressing as expected)
- ⚠️ Goal is **at risk** (falling behind)
- 🎉 Goal is **achieved** (completed)
- 📉 Goal is **stalled** (no progress in 2+ weeks)

### Goal Matching Logic

#### Weight Goals
- Match with: Body weight measurements from check-ins or measurements page
- Track: Current weight vs. target weight
- Calculate: Progress percentage and time remaining

#### Fitness Goals
- Match with: Check-in responses about exercise frequency, intensity
- Example: "Exercise 3x/week" goal → Check exercise frequency in check-ins

#### Nutrition Goals  
- Match with: Check-in responses about nutrition habits
- Example: "Eat 5 vegetables/day" → Check nutrition questions in check-ins

#### Measurement Goals
- Match with: Body measurements (waist, chest, etc.)
- Track: Measurement changes over time

### Implementation Steps

#### Step 1: Create Goal Tracking Service
```typescript
// src/lib/goal-tracking.ts

interface GoalProgress {
  goalId: string;
  goal: Goal;
  currentValue: number;
  targetValue: number;
  progress: number;
  status: 'on_track' | 'at_risk' | 'achieved' | 'stalled' | 'overdue';
  timeRemaining: number; // days
  lastUpdate: Date;
  trend: 'improving' | 'stable' | 'declining';
}

export async function calculateGoalProgress(
  goal: Goal,
  checkIns: any[],
  measurements: any[]
): Promise<GoalProgress> {
  // Match goal to relevant data
  let currentValue = goal.currentValue;
  
  if (goal.category === 'fitness' && goal.unit.toLowerCase().includes('kg')) {
    // Weight goal - find most recent weight measurement
    const weightMeasurements = measurements
      .filter(m => m.type === 'body_weight' || m.measurementType === 'weight')
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
    
    if (weightMeasurements.length > 0) {
      currentValue = weightMeasurements[0].value;
    }
  }
  
  // Calculate progress
  const progress = (currentValue / goal.targetValue) * 100;
  const deadline = new Date(goal.deadline);
  const now = new Date();
  const timeRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Determine status
  let status: GoalProgress['status'];
  const expectedProgress = calculateExpectedProgress(goal.createdAt, goal.deadline);
  
  if (progress >= 100) {
    status = 'achieved';
  } else if (progress >= expectedProgress * 0.9) {
    status = 'on_track';
  } else if (progress >= expectedProgress * 0.7) {
    status = 'at_risk';
  } else if (timeRemaining < 0) {
    status = 'overdue';
  } else {
    status = 'stalled';
  }
  
  return {
    goalId: goal.id,
    goal,
    currentValue,
    targetValue: goal.targetValue,
    progress,
    status,
    timeRemaining,
    lastUpdate: new Date(),
    trend: calculateTrend(goal, checkIns, measurements)
  };
}
```

#### Step 2: Create Notification System
```typescript
// src/app/api/goals/track-progress/route.ts

export async function POST(request: NextRequest) {
  // This endpoint will be called:
  // 1. After each check-in submission
  // 2. After measurement updates
  // 3. By a scheduled job (daily) to check all goals
  
  const { clientId } = await request.json();
  
  // Fetch all active goals for client
  const goals = await fetchClientGoals(clientId);
  
  // Fetch recent check-ins and measurements
  const checkIns = await fetchRecentCheckIns(clientId);
  const measurements = await fetchMeasurements(clientId);
  
  // Calculate progress for each goal
  const goalProgress: GoalProgress[] = [];
  for (const goal of goals) {
    const progress = await calculateGoalProgress(goal, checkIns, measurements);
    goalProgress.push(progress);
    
    // Update goal in Firestore
    await updateGoalProgress(goal.id, progress);
    
    // Check if notification needed
    const shouldNotify = checkNotificationNeeded(progress, goal);
    
    if (shouldNotify) {
      await createGoalNotification(clientId, goal, progress);
    }
  }
  
  return NextResponse.json({ success: true, goalProgress });
}
```

#### Step 3: Create Notifications
```typescript
// src/lib/notification-service.ts (add function)

export async function createGoalNotification(
  clientId: string,
  goal: Goal,
  progress: GoalProgress
) {
  const clientDoc = await db.collection('clients').doc(clientId).get();
  const clientData = clientDoc.data();
  const coachId = clientData?.coachId;
  
  if (!coachId) return;
  
  let title: string;
  let message: string;
  let type: string;
  
  switch (progress.status) {
    case 'achieved':
      title = '🎉 Goal Achieved!';
      message = `${clientData?.displayName || 'Client'} has achieved their goal: "${goal.title}"`;
      type = 'goal_achieved';
      break;
    case 'at_risk':
      title = '⚠️ Goal At Risk';
      message = `${clientData?.displayName || 'Client'}'s goal "${goal.title}" is falling behind. Progress: ${progress.progress.toFixed(0)}%`;
      type = 'goal_at_risk';
      break;
    case 'stalled':
      title = '📉 Goal Progress Stalled';
      message = `${clientData?.displayName || 'Client'}'s goal "${goal.title}" has stalled. No progress in 2+ weeks.`;
      type = 'goal_stalled';
      break;
    case 'on_track':
      title = '✅ Goal On Track';
      message = `${clientData?.displayName || 'Client'} is making good progress on "${goal.title}": ${progress.progress.toFixed(0)}% complete`;
      type = 'goal_on_track';
      break;
  }
  
  await notificationService.create({
    userId: coachId,
    type: type,
    title: title,
    message: message,
    actionUrl: `/clients/${clientId}?tab=goals`,
    metadata: {
      clientId,
      goalId: goal.id,
      goalTitle: goal.title,
      progress: progress.progress,
      status: progress.status
    }
  });
}
```

#### Step 4: Schedule Daily Goal Check
```typescript
// src/app/api/scheduled-emails/goal-progress-check/route.ts

export async function POST(request: NextRequest) {
  // Run daily to check all client goals
  
  const db = getDb();
  
  // Fetch all active goals
  const goalsSnapshot = await db.collection('clientGoals')
    .where('status', 'in', ['active', 'in_progress'])
    .get();
  
  // Group by clientId
  const goalsByClient = new Map<string, any[]>();
  goalsSnapshot.docs.forEach(doc => {
    const goal = { id: doc.id, ...doc.data() };
    const clientId = goal.clientId;
    if (!goalsByClient.has(clientId)) {
      goalsByClient.set(clientId, []);
    }
    goalsByClient.get(clientId)!.push(goal);
  });
  
  // Process each client's goals
  for (const [clientId, goals] of goalsByClient.entries()) {
    // Call goal tracking logic
    await fetch(`/api/goals/track-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId })
    });
  }
  
  return NextResponse.json({ success: true });
}
```

---

## Part 3: Display in Coach's Client Profile

### Add Goals Tab to Client Profile
- Show goals with progress indicators
- Color-coded status (green=on track, yellow=at risk, red=stalled/overdue)
- Link to goals questionnaire responses
- Show last progress update

### Add to AI Analysis Tab
- Include goals questionnaire in "Client Context" section
- Show goal alignment with current performance
- AI recommendations based on goals progress

---

## Implementation Priority

### Phase 1: Basic Integration (2-3 hours)
1. ✅ Add "Take the Next Steps" section to questionnaire
2. Fetch goals questionnaire in AI Analysis
3. Include in AI prompts

### Phase 2: Goal Tracking (4-5 hours)
1. Create goal progress calculation logic
2. Match goals to check-in/measurement data
3. Update goals when new data available

### Phase 3: Notifications (2-3 hours)
1. Create notification system for goal status
2. Test with different goal types
3. Add to coach notifications page

### Phase 4: Scheduled Monitoring (1-2 hours)
1. Create daily goal check job
2. Set up Cloud Scheduler
3. Test notifications

---

## Complexity Assessment

**Difficulty: Medium** ✅

**Why it's achievable:**
- We already have notification system
- We already have goal data structure
- We already have AI Analysis framework
- We already have check-in/measurement data
- Just need to connect the pieces

**Challenges:**
- Matching goals to check-in questions (may need mapping)
- Determining "on track" vs "at risk" thresholds
- Handling different goal types (weight, fitness, nutrition, etc.)

**Solutions:**
- Use flexible matching logic
- Allow coaches to customize thresholds
- Create extensible goal tracking system

---

## Next Steps

Would you like me to:
1. ✅ Add "Take the Next Steps" section (done above)
2. Start implementing the AI Analysis integration?
3. Build the goal tracking system?
4. Create the notification system?

Let me know which part you'd like to tackle first!


