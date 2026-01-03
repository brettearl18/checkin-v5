# 2026 Goals Questionnaire - Design Document

## Overview
A guided questionnaire to help clients set their wellness goals for 2026. The questionnaire will ask structured questions and automatically create goal entries based on their responses.

## Structure & Sections

### Section 1: Vision & Priorities (3-4 questions)
**Purpose:** Understand what matters most to them in 2026

1. **What's your main focus for 2026?** (multiple choice, select all that apply)
   - Weight management (lose/gain/maintain)
   - Strength & muscle building
   - Cardiovascular fitness
   - Nutrition & eating habits
   - Mental health & stress management
   - Sleep quality
   - Energy & vitality
   - Flexibility & mobility
   - General wellness & lifestyle
   - Other: [text input]

2. **Why are these areas important to you?** (textarea)
   - What will achieving these goals mean for your life?

3. **What would success look like for you by the end of 2026?** (textarea)
   - Describe your vision of yourself in December 2026

### Section 2: Fitness Goals (Conditional - if fitness selected)
**Purpose:** Set specific fitness-related goals

4. **What is your primary fitness goal?** (multiple choice)
   - Lose weight
   - Gain weight/muscle
   - Improve strength
   - Improve endurance/cardio
   - Improve flexibility
   - Maintain current fitness level
   - Other

5. **What is your target?** (number + unit selector)
   - For weight: [kg/lbs]
   - For strength: [kg/lbs] on [exercise name]
   - For cardio: [distance] [km/miles] in [time]
   - For flexibility: [specific milestone]
   
6. **Current starting point?** (number + unit)
   - What's your current measurement?

7. **By when do you want to achieve this?** (date picker)
   - Default: End of 2026, but can be earlier

8. **How will you track progress?** (multiple choice, select all)
   - Weekly measurements
   - Body photos
   - Performance metrics (speed, strength, etc.)
   - How you feel
   - Other

### Section 3: Nutrition Goals (Conditional - if nutrition selected)
**Purpose:** Set specific nutrition-related goals

9. **What is your primary nutrition goal?** (multiple choice)
   - Eat healthier/more balanced
   - Meal planning/consistency
   - Increase protein intake
   - Reduce processed foods
   - Increase vegetables/fruits
   - Portion control
   - Hydration
   - Other

10. **What's your target?** (number + unit)
    - e.g., "Eat 5 servings of vegetables per day"
    - e.g., "Drink 2L of water per day"
    - e.g., "Eat 150g protein per day"

11. **Current starting point?** (number + unit)
    - What's your current measurement?

12. **By when do you want to achieve this?** (date picker)

13. **How often will you track this?** (multiple choice)
    - Daily
    - Weekly
    - Monthly

### Section 4: Mental Health & Wellness Goals (Conditional - if mental health selected)
**Purpose:** Set mental health and stress management goals

14. **What is your primary mental health goal?** (multiple choice)
    - Reduce stress levels
    - Improve mood/mental wellbeing
    - Better work-life balance
    - Practice mindfulness/meditation
    - Manage anxiety
    - Improve self-care routine
    - Other

15. **How will you measure this?** (multiple choice)
    - Stress scale (1-10)
    - Mood tracking
    - Meditation minutes per week
    - Self-care activities per week
    - Quality of sleep
    - Energy levels

16. **What's your target?** (number + unit based on measurement)
    - e.g., "Meditate 30 minutes per week"
    - e.g., "Keep stress level below 5/10"
    - e.g., "3 self-care activities per week"

17. **Current starting point?** (number)
    - What's your current measurement?

18. **By when do you want to achieve this?** (date picker)

### Section 5: Sleep Goals (Conditional - if sleep selected)
**Purpose:** Set sleep quality goals

19. **What is your primary sleep goal?** (multiple choice)
    - Sleep more hours
    - Improve sleep quality
    - Consistent sleep schedule
    - Fall asleep faster
    - Sleep through the night
    - Wake up feeling rested

20. **What's your target?** (number + unit)
    - Hours of sleep per night: [hours]
    - Sleep quality score: [1-10]
    - Time to fall asleep: [minutes]

21. **Current starting point?** (number + unit)

22. **By when do you want to achieve this?** (date picker)

### Section 6: Lifestyle & Habits (Optional)
**Purpose:** Set general wellness and lifestyle goals

23. **Are there any lifestyle habits you'd like to change or improve?** (textarea)
    - e.g., "Reduce screen time", "Spend more time outdoors", "Better time management"

24. **For each habit, set a specific goal:**
    - Habit: [text]
    - Target: [number] + [unit] + [frequency]
    - Deadline: [date]

### Section 7: Commitment & Support
**Purpose:** Understand motivation and barriers

25. **On a scale of 1-10, how committed are you to achieving these goals?** (scale 1-10)

26. **What are the biggest challenges you anticipate?** (textarea)
    - Time constraints, motivation, knowledge, etc.

27. **What support do you need from your coach?** (textarea)
    - How can your coach best help you achieve these goals?

28. **What's your "why"?** (textarea)
    - What's the deeper reason behind these goals?
    - What will keep you motivated when it gets tough?

## Auto-Goal Creation Logic

After questionnaire completion, automatically create goals in Firestore:

1. **Parse responses by category**
   - For each selected focus area, create corresponding goals

2. **Goal creation rules:**
   - **Title:** Auto-generated from question responses
     - e.g., "Lose 10kg" from fitness goal responses
   - **Category:** Based on section (fitness, nutrition, mental-health, sleep, general)
   - **Target Value:** From "target" question
   - **Current Value:** From "current starting point" question
   - **Unit:** Inferred from target measurement
   - **Deadline:** From "by when" question (default: Dec 31, 2026)
   - **Description:** Include "why" and "how will you track" responses

3. **Handle multiple goals:**
   - If multiple focus areas selected, create multiple goals
   - If multiple sub-goals within a category, create multiple goals

## Implementation Plan

1. **Create `src/lib/goals-questionnaire.ts`**
   - Define question structure
   - Question types and sections

2. **Create `src/app/client-portal/goals/questionnaire/page.tsx`**
   - Multi-step questionnaire UI
   - Conditional sections (only show if category selected)
   - Progress tracking
   - Save/continue functionality

3. **Create `src/app/api/client-portal/goals-questionnaire/route.ts`**
   - GET: Load saved responses
   - POST: Save responses (by section)
   - POST /submit: Submit complete questionnaire and auto-create goals

4. **Update Goals Page**
   - Add banner/prompt if questionnaire not completed
   - Link to questionnaire
   - Show completion status

5. **Auto-Goal Creation Service**
   - Parse questionnaire responses
   - Map to goal structure
   - Create goals via existing goals API
   - Handle validation and errors

## UI Flow

1. **On Goals Page:**
   - If questionnaire not completed: Show banner "Set Your 2026 Goals - Take the Questionnaire"
   - If completed: Show "Review Your 2026 Goals Questionnaire" link (optional)

2. **Questionnaire Page:**
   - Progress bar at top
   - Section navigation
   - Conditional sections based on selections
   - Save & Continue button (saves progress)
   - Next/Previous section buttons
   - Submit button at end

3. **After Submission:**
   - Show summary of goals created
   - Redirect to goals page
   - Goals appear in "Your Goals" section

## Data Structure

**Questionnaire Response Document:**
```typescript
{
  clientId: string;
  coachId: string;
  year: 2026;
  status: 'not_started' | 'in_progress' | 'completed';
  responses: {
    [questionId: string]: any;
  };
  goalsCreated: string[]; // Array of goal IDs created
  startedAt: Date;
  completedAt?: Date;
  progress: {
    currentSection: number;
    completedSections: number[];
    totalQuestions: number;
    answeredQuestions: number;
  }
}
```

## Benefits

1. **Guided Goal Setting:** Helps clients think through goals systematically
2. **SMART Goals:** Ensures goals are Specific, Measurable, Achievable, Relevant, Time-bound
3. **Time Saving:** Auto-creates goals from responses
4. **Better Outcomes:** More thoughtful, well-planned goals
5. **Coach Insight:** Coach can see client's "why" and anticipated challenges




