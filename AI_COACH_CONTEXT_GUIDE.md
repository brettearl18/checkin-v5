# AI Coach Context System

## Overview

The AI system now includes **role-specific context** that tailors all AI responses to each coach's specialization and approach. This ensures that AI-generated feedback, risk analysis, and insights are relevant to the coach's expertise (e.g., Functional Health and Wellness, Weight Loss, Fitness, Mental Health).

## How It Works

### 1. **Coach Context Data**
The system fetches coach information from the database:
- **Specialization** (e.g., "Functional Health and Wellness")
- **Bio** (coach's approach and philosophy)
- **Gender** (optional, for personalized language)
- **Approach** (e.g., "holistic", "evidence-based")

### 2. **System Prompts**
Based on the coach's specialization, the AI receives tailored instructions:

#### **Functional Health & Wellness** (Default)
```
You are an AI assistant helping a Functional Health and Wellness Coach...

Your approach should:
- Focus on functional health principles (root cause analysis, holistic wellness)
- Consider the interconnectedness of sleep, nutrition, stress, movement, and recovery
- Address hormonal health, gut health, and metabolic function
- Look for patterns that indicate underlying imbalances
- Emphasize sustainable lifestyle changes
```

#### **Weight Loss & Nutrition**
```
You are an AI assistant helping a Health Coach specializing in Weight Loss & Nutrition...

Your approach should:
- Focus on metabolic health and sustainable nutrition strategies
- Consider energy balance, macronutrient quality, and meal timing
- Address emotional eating patterns
- Consider how sleep, stress, and movement affect metabolism
```

#### **Fitness & Exercise**
```
You are an AI assistant helping a Fitness Coach...

Your approach should:
- Focus on progressive overload, recovery, and movement quality
- Consider how training load, sleep, and nutrition interact
- Address barriers to consistency and motivation
- Emphasize consistency over intensity
```

#### **Mental Health & Stress**
```
You are an AI assistant helping a Health Coach specializing in Mental Health & Stress...

Your approach should:
- Focus on stress response, nervous system regulation, and emotional resilience
- Consider how stress affects physical health (sleep, digestion, energy)
- Address thought patterns, coping strategies, and self-care practices
- Consider the mind-body connection
```

### 3. **Automatic Application**
The coach context is automatically:
- ✅ Fetched when generating analytics
- ✅ Passed to all AI functions
- ✅ Used to build specialized system prompts
- ✅ Applied to all AI-generated content

## Benefits

### **More Relevant Insights**
- AI understands the coach's specialty and focuses on relevant factors
- Recommendations align with the coach's approach
- Language and terminology match the coach's expertise

### **Better Risk Analysis**
- Risk factors identified are relevant to the coach's specialty
- Interventions suggested match the coach's capabilities
- Predictions consider specialty-specific factors

### **Personalized Feedback**
- Feedback tone and focus match the coach's style
- Recommendations use the coach's preferred approach
- Examples and analogies are relevant to the specialty

## Example: Functional Health Coach

**Without Context:**
> "Client's score dropped. Consider increasing exercise frequency."

**With Functional Health Context:**
> "Client's score dropped, and sleep quality declined. This pattern suggests potential stress response or hormonal imbalance. Consider investigating:
> - Cortisol patterns (stress response)
> - Sleep hygiene and circadian rhythm
> - Gut health indicators (digestion, energy after meals)
> - Recovery markers (HRV, resting heart rate)
> 
> The interconnected decline in multiple areas suggests a root cause rather than isolated issues."

## Configuration

### For Coaches
Coaches can set their specialization in their profile settings:
- Go to Settings → Profile
- Enter specialization (e.g., "Functional Health and Wellness")
- Add bio describing their approach
- AI will automatically use this context

### Default Behavior
If no specialization is set, the system defaults to:
- **"Functional Health and Wellness"** approach
- Holistic, evidence-based recommendations
- Focus on root causes and interconnected systems

## Technical Implementation

### Files Created
- `src/lib/ai-context.ts` - Context builder and coach data fetcher
- Updated `src/lib/openai-service.ts` - All functions now accept `coachContext`
- Updated `src/app/api/clients/[id]/ai-analytics/route.ts` - Fetches and passes coach context

### Functions Updated
- ✅ `generateCoachFeedback()` - Uses coach context
- ✅ `analyzeClientRisk()` - Uses coach context
- ✅ `extractTextInsights()` - Uses coach context
- ✅ `generateOnboardingSummary()` - Uses coach context

### How to Use

```typescript
import { getCoachContext } from '@/lib/ai-context';
import { analyzeClientRisk } from '@/lib/openai-service';

// Fetch coach context
const coachContext = await getCoachContext(coachId, db);

// Use in AI function
const risk = await analyzeClientRisk({
  currentScore: 65,
  historicalScores: [70, 72, 68, 65],
  clientProfile: { goals: ['Weight loss'] },
  coachContext: coachContext || undefined // Pass coach context
});
```

## Customization

### Adding New Specializations
Edit `src/lib/ai-context.ts` and add a new condition:

```typescript
if (specialization.includes('your-keyword')) {
  specializedContext = `You are an AI assistant helping a ${coachContext.specialization} Coach...
  // Your custom instructions
  `;
}
```

### Custom System Prompts
Coaches can add their bio in settings, which will be appended to the system prompt for even more personalization.

## Best Practices

1. **Set Specialization**: Coaches should set their specialization in profile settings
2. **Update Bio**: Adding a bio provides additional context for AI
3. **Be Specific**: More specific specializations get better-tailored prompts
4. **Review Output**: AI responses should align with coach's approach - if not, refine specialization/bio

## Future Enhancements

- [ ] Allow coaches to customize their own AI instructions
- [ ] Support multiple specializations per coach
- [ ] Learn from coach's previous feedback to match their style
- [ ] Add industry-specific terminology and frameworks

