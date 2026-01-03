# AI Prompt Expert Review & Recommendations
## For Functional Health Coaching Platform

**Context:** Female Functional Health Coach working with clients through check-ins, measurements, and progress tracking.

---

## 📊 Current Prompt Analysis

### 1. **Weekly Summary** (Text Insights)
**Current Grade: C+**

**Issues:**
- ❌ Too generic - doesn't leverage functional health principles
- ❌ Misses functional health markers (energy patterns, inflammation signs, sleep quality correlation)
- ❌ Doesn't identify root causes vs. symptoms
- ❌ No mention of systems thinking (how different lifestyle factors interconnect)
- ❌ Missing functional health terminology and concepts

**Recommendation:** Enhance to functional health-specific analysis

---

### 2. **SWOT Analysis**
**Current Grade: B-**

**Issues:**
- ⚠️ Generic SWOT framework doesn't leverage functional health lens
- ⚠️ Doesn't analyze functional health pillars (sleep, stress, nutrition, movement, relationships)
- ⚠️ Misses root cause patterns (e.g., "stress → poor sleep → low energy → reduced motivation")
- ⚠️ Weak on identifying interconnected systems
- ⚠️ No emphasis on functional health optimization vs. general wellness

**Recommendation:** Reframe with functional health framework

---

### 3. **AI Analytics / Risk Analysis**
**Current Grade: B+**

**Issues:**
- ✅ Already mentions "functional health principles" in system prompt
- ⚠️ Could be more specific about functional health markers
- ⚠️ Doesn't emphasize the functional health coaching approach (root cause, systems thinking)
- ⚠️ Missing functional health risk factors (adrenal fatigue patterns, inflammation markers, gut health indicators)

**Recommendation:** Strengthen functional health specificity

---

## 🎯 Recommended Enhanced Prompts

### **1. Enhanced Weekly Summary (Text Insights)**

```typescript
// System Prompt
You are an AI assistant helping a Female Functional Health Coach analyze client check-in responses. 
Your analysis applies functional health principles, focusing on root causes, systems thinking, 
and the interconnected nature of health. Look for patterns across sleep, stress, energy, 
digestion, movement, and emotional wellbeing.

// Main Prompt
Analyze these check-in text responses through a functional health lens and extract key insights.

Client Context:
- Score: ${context.score}%
- Week: ${context.weekNumber}
- Check-in Count: ${context.checkInCount}
- Measurements: ${context.measurementsCount}

Text Responses:
${textResponses.join('\n\n---\n\n')}

Analyze using functional health principles:

1. **ROOT CAUSE PATTERNS** (not just symptoms):
   - What underlying systems or imbalances might be causing reported issues?
   - Identify any recurring patterns that suggest systemic root causes
   - Note any interconnected factors (e.g., stress → sleep → energy → motivation)

2. **FUNCTIONAL HEALTH PILLARS** (assess each):
   - **Sleep Quality:** Patterns, disruptions, energy correlation
   - **Stress Levels:** Sources, impact on other systems, management strategies mentioned
   - **Energy Patterns:** When energy is high/low, what correlates?
   - **Digestive Health:** Any mentions of bloating, discomfort, food reactions?
   - **Movement/Exercise:** How movement affects energy, mood, sleep
   - **Relationships/Social:** Impact on stress, motivation, accountability

3. **SYSTEMS INTERCONNECTIONS:**
   - How do different health domains affect each other?
   - Example: "Client mentions stress → also reports poor sleep → low energy → reduced exercise"
   - Identify cascading effects and feedback loops

4. **FUNCTIONAL HEALTH MARKERS:**
   - Signs of inflammation (stiffness, aches, brain fog)
   - Adrenal/stress patterns (energy crashes, difficulty waking)
   - Recovery patterns (how well they bounce back)
   - Metabolic signals (cravings, blood sugar stability mentions)

5. **ACHIEVEMENTS & POSITIVE DEVELOPMENTS:**
   - What functional improvements are evident?
   - Which systems are showing optimization?

6. **CONCERNS & RED FLAGS:**
   - Warning signs that need deeper investigation
   - Patterns suggesting functional imbalances

7. **COACHING OPPORTUNITIES:**
   - Where can root cause investigation be beneficial?
   - What lifestyle interventions might address root causes?
   - Functional health strategies to suggest

8. **OVERALL SUMMARY** (2-3 sentences):
   - Functional health perspective on current state
   - Key systems to focus on
   - Priority interventions from functional health approach
```

---

### **2. Enhanced SWOT Analysis (Functional Health Framework)**

```typescript
// System Prompt
You are an AI assistant helping a Female Functional Health Coach perform a comprehensive 
SWOT analysis. Apply functional health principles: root cause thinking, systems interconnection, 
and personalized optimization. Focus on how different health domains (sleep, stress, nutrition, 
movement, relationships) interconnect and impact overall function.

// Main Prompt
Perform a comprehensive SWOT analysis for this client using a functional health framework.

Client: ${clientName}
Current Progress Score: ${currentScore || 'N/A'}%
Average Progress Score: ${averageScore || 'N/A'}%
Score Trend: ${trend}
Total Check-ins Completed: ${checkIns.length}
Recent Measurements: ${recentMeasurements.length} recorded

[Goals and text responses as before...]

Analyze through the lens of functional health:

**STRENGTHS** (Internal positive factors - functional health perspective):
- What functional systems are working well?
- Which health pillars are optimized (sleep, stress management, energy, digestion, movement)?
- What positive patterns suggest strong foundational health?
- What resources or capabilities support functional optimization?
- Which root causes are well-managed?

**WEAKNESSES** (Internal areas for improvement - root cause focus):
- What functional imbalances or deficiencies exist?
- Which health pillars need attention?
- What underlying systems (adrenal, digestive, hormonal) might be compromised?
- What root causes need investigation vs. symptom management?
- Where are cascading negative patterns (e.g., stress → poor sleep → low energy)?

**OPPORTUNITIES** (External positive factors - functional health optimization):
- What lifestyle interventions could optimize function?
- What environmental or social factors support functional health?
- What functional health tools or strategies could be leveraged?
- Where are opportunities to address root causes rather than symptoms?
- What systemic improvements could create positive cascades?

**THREATS** (External risks - functional health perspective):
- What factors could derail functional optimization?
- What environmental toxins or stressors threaten systems?
- What lifestyle patterns could lead to functional decline?
- What systemic risks could cascade into multiple health domains?
- What early warning signs suggest functional imbalances developing?

**FUNCTIONAL HEALTH PRIORITY ASSESSMENT:**
- Rank health pillars by priority for intervention
- Identify which root causes, if addressed, would have the greatest systemic impact
- Suggest order of functional health investigation

Provide 3-5 specific, actionable items for each SWOT category, framed in functional health terms.
```

---

### **3. Enhanced Risk Analysis (Functional Health Specific)**

```typescript
// Enhanced System Prompt
export function buildRiskAnalysisSystemPrompt(coachContext?: CoachContext, goalsQuestionnaire?: any): string {
  let basePrompt = `You are an AI assistant helping a Female Functional Health Coach analyze 
client risk factors and predict potential outcomes. Your analysis applies functional health 
principles:

CORE FUNCTIONAL HEALTH PRINCIPLES:
- Root Cause Thinking: Look beyond symptoms to underlying imbalances
- Systems Thinking: Understand how sleep, stress, nutrition, movement, and relationships interconnect
- Individual Biochemistry: Recognize each client's unique functional patterns
- Functional Optimization: Focus on optimal function, not just absence of disease
- Holistic View: Consider physical, mental, emotional, and environmental factors

YOUR ANALYSIS SHOULD:
- Identify functional health markers and patterns
- Assess root causes, not just symptoms
- Consider systemic interconnections and cascading effects
- Use functional health terminology and concepts
- Prioritize interventions based on systemic impact
- Recognize early warning signs of functional decline
- Suggest functional health-specific interventions`;

  if (coachContext?.specialization) {
    basePrompt += `\n\nSPECIALIZATION: ${coachContext.specialization}
Apply ${coachContext.specialization} functional health principles in your analysis.`;
  }

  // Add goals questionnaire context as before...

  return basePrompt;
}

// Enhanced Main Prompt
const prompt = `Analyze this client's risk level using functional health principles.

Client Profile:
- Goals: ${clientProfile.goals.join(', ')}
${clientProfile.barriers ? `- Known Barriers: ${clientProfile.barriers.join(', ')}` : ''}

Performance Metrics:
- Current Score: ${currentScore}%
- Historical Average: ${avgHistorical.toFixed(1)}%
- Trend: ${trend}
- Score History: ${historicalScores.join(', ')}%
${engagementMetrics ? `- Completion Rate: ${engagementMetrics.completionRate}%` : ''}

${textResponses && textResponses.length > 0 ? `Recent Text Responses:\n${textResponses.slice(-3).join('\n\n')}` : ''}

FUNCTIONAL HEALTH RISK ASSESSMENT:

1. **SYSTEMIC RISK FACTORS:**
   - Are there patterns suggesting functional imbalances? (adrenal fatigue, inflammation, gut issues)
   - What root causes might be driving declining scores?
   - Which health pillars (sleep, stress, nutrition, movement) show dysfunction?
   - Are there cascading patterns? (e.g., stress → poor sleep → low energy → reduced motivation → declining scores)

2. **FUNCTIONAL HEALTH MARKERS:**
   - Energy patterns (crashes, difficulty waking, afternoon slumps)
   - Sleep quality patterns and correlations
   - Stress response patterns
   - Recovery patterns
   - Any mentions of inflammation, digestive issues, brain fog

3. **ROOT CAUSE ANALYSIS:**
   - What underlying systems might be compromised?
   - Are symptoms being managed vs. root causes addressed?
   - What functional investigations might be needed?

4. **PREDICTED OUTCOME:**
   - If current functional patterns continue, what's the trajectory?
   - What functional health complications could develop?
   - What systemic impacts might cascade?

5. **FUNCTIONAL HEALTH INTERVENTIONS:**
   - Specific functional health strategies (not generic wellness)
   - Root cause interventions vs. symptom management
   - Priority order based on systemic impact
   - Lifestyle interventions addressing functional pillars

Assess the risk level (low/medium/high/critical) from a functional health perspective and provide:
1. Specific functional health risk factors identified
2. Root causes that need attention
3. Predicted functional health trajectory if trend continues
4. Functional health-specific intervention recommendations
5. Confidence level in the assessment

Consider: functional health markers, root cause patterns, systems interconnections, 
alignment with functional health goals, and barriers to functional optimization.`;
```

---

## ✅ Key Improvements Summary

### **What's Better:**
1. **Functional Health Lens:** All prompts now explicitly use functional health principles
2. **Root Cause Focus:** Emphasis on underlying causes vs. symptom management
3. **Systems Thinking:** Analysis of interconnections between health domains
4. **Functional Health Pillars:** Sleep, stress, nutrition, movement, relationships framework
5. **Functional Health Terminology:** Uses proper terminology and concepts
6. **Priority Assessment:** Focuses on interventions with greatest systemic impact

### **Why This Matters for Functional Health Coaching:**
- ✅ Aligns with functional health methodology
- ✅ Identifies root causes, not just symptoms
- ✅ Recognizes system interconnections
- ✅ Provides functional health-specific interventions
- ✅ Uses appropriate terminology
- ✅ Supports a root-cause, systems-based approach

---

## 🚀 Implementation Priority

1. **High Priority:** Risk Analysis enhancement (already has foundation)
2. **Medium Priority:** Weekly Summary enhancement (biggest gap currently)
3. **Medium Priority:** SWOT Analysis enhancement (good foundation, needs functional health reframing)

---

## 💡 Additional Recommendations

1. **Add Functional Health Context Variable:** Consider adding functional health assessment data if collected
2. **Temperature Adjustments:** Consider slightly higher temperature (0.4-0.5) for more creative root cause insights
3. **Prompt Chaining:** Consider two-step analysis: symptom identification → root cause analysis
4. **Functional Health Checklist:** Add validation step to ensure outputs use functional health principles


