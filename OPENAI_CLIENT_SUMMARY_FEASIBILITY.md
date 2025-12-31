# OpenAI Client Summary Feature - Feasibility Assessment

## Overview
Generate an AI-powered client summary after onboarding completion that provides coaches with insights on:
- How to train the client
- How to work with them
- What to watch for
- Key characteristics and considerations

## Difficulty Level: **MEDIUM** ⚠️

This is a **stage 2 feature** that's quite feasible but requires several components.

---

## What We Already Have ✅

1. **Onboarding Submission Flow**
   - `/api/client-portal/onboarding/submit/route.ts` handles submission
   - Data is stored in `client_onboarding_responses` collection
   - Reports are stored in `onboarding_reports` collection
   - Coach notification system exists

2. **Structured Data**
   - All onboarding responses are stored in a structured format
   - `generateOnboardingReport()` already formats responses
   - 9 sections with 40+ questions covering demographics, health, fitness, nutrition, goals, motivation, lifestyle, preferences, and barriers

3. **Coach View**
   - `/clients/[id]/onboarding-report/page.tsx` displays full report
   - `/clients/[id]/page.tsx` shows client profile with onboarding summary
   - Coach can already view raw responses

---

## What Needs to Be Added 🔧

### 1. OpenAI Integration (NEW)
- **Package**: Install `openai` npm package
- **API Key**: Add `OPENAI_API_KEY` environment variable
- **Service**: Create `/lib/openai-service.ts` with helper functions
- **Cost**: ~$0.01-0.03 per summary (using GPT-4 or GPT-3.5-turbo)

### 2. Summary Generation Function
- **Location**: Create new function in submit route or separate service
- **Trigger**: After onboarding is marked as 'submitted'
- **Input**: Formatted onboarding responses
- **Output**: AI-generated summary text
- **Storage**: Save to `onboarding_reports` collection as `aiSummary` field

### 3. Prompt Engineering
- **Complexity**: MEDIUM-HIGH
- Create a detailed prompt that:
  - Formats all responses contextually
  - Asks for training recommendations
  - Asks for communication approach
  - Asks for red flags/things to watch
  - Ensures consistent, actionable output

### 4. UI Display
- **Where**: `/clients/[id]/onboarding-report/page.tsx` (add new section)
- **Alternative**: `/clients/[id]/page.tsx` (add summary card)
- **Design**: New section/tab showing AI summary vs raw responses
- **Loading State**: Show "Generating summary..." while processing

### 5. Error Handling
- Handle OpenAI API failures gracefully
- Retry logic for transient failures
- Fallback to manual review if AI fails
- Cache generated summaries

---

## Implementation Steps 📋

### Step 1: Setup (30 mins)
1. Install OpenAI package: `npm install openai`
2. Add `OPENAI_API_KEY` to environment variables (local + Cloud Run)
3. Create `/lib/openai-service.ts` with basic client setup

### Step 2: Create Summary Generator (2-3 hours)
1. Create prompt template with all sections
2. Format onboarding responses into prompt
3. Call OpenAI API (GPT-3.5-turbo or GPT-4)
4. Parse and clean response
5. Add to submit route (or make async/background job)

### Step 3: Update Data Model (30 mins)
1. Add `aiSummary` field to `onboarding_reports` collection schema
2. Add `aiSummaryGeneratedAt` timestamp
3. Add `aiSummaryModel` (to track which model was used)

### Step 4: UI Integration (1-2 hours)
1. Add "AI Summary" section to onboarding report page
2. Style it nicely with cards/sections
3. Add loading state
4. Handle cases where summary doesn't exist yet

### Step 5: Testing & Refinement (1-2 hours)
1. Test with various onboarding responses
2. Refine prompt for better results
3. Handle edge cases (minimal responses, etc.)
4. Test error scenarios

---

## Estimated Total Time: **5-8 hours**

---

## Technical Considerations ⚙️

### API Choice
- **GPT-3.5-turbo**: Cheaper (~$0.002 per summary), faster, good quality
- **GPT-4**: More expensive (~$0.03 per summary), better quality, more nuanced
- **Recommendation**: Start with GPT-3.5-turbo, upgrade if needed

### When to Generate
- **Option A**: Synchronously during submission (slower, but immediate)
- **Option B**: Asynchronously after submission (faster UX, but delayed)
- **Option C**: Background job/cron (best for scale, but complex)
- **Recommendation**: Start with Option A (sync), move to Option B if slow

### Token Usage
- Typical summary: 2000-4000 tokens (input + output)
- Cost per summary: ~$0.01-0.03
- Monthly cost (100 clients): ~$1-3

### Prompt Structure Example
```
You are a fitness coach reviewing a new client's onboarding questionnaire. 
Analyze their responses and provide:

1. TRAINING APPROACH
   - Recommended training style and intensity
   - Exercise preferences and limitations
   - Weekly schedule recommendations

2. COMMUNICATION STYLE
   - How to best motivate this client
   - Preferred communication frequency
   - Support needs

3. THINGS TO WATCH
   - Health concerns or limitations
   - Potential barriers to success
   - Red flags or special considerations

Client Details:
[Formatted responses here]
```

---

## Risks & Considerations ⚠️

1. **API Costs**: Monitor usage, especially if generating summaries for existing clients
2. **Quality**: Prompt engineering is crucial - may need iteration
3. **Reliability**: OpenAI API can be slow/fail - need good error handling
4. **Privacy**: Client data sent to OpenAI - ensure compliance with privacy policy
5. **Rate Limits**: OpenAI has rate limits - may need queuing for scale

---

## Alternative: Simpler Version (Stage 1.5)

If you want something faster, could create a **template-based summary** first:
- Pre-written templates for common scenarios
- Fill in key data points
- Less personalized but faster/cheaper
- Could enhance with AI later

---

## Recommendation 💡

**This is a good Stage 2 feature!** It's:
- ✅ Feasible with existing infrastructure
- ✅ Adds significant value to coaches
- ✅ Reasonably scoped (5-8 hours)
- ✅ Can start simple and enhance

**Suggested Approach:**
1. Start with GPT-3.5-turbo (cost-effective)
2. Generate synchronously during submission
3. Add to onboarding report page
4. Iterate on prompt quality based on coach feedback

Would you like me to start implementing this, or would you prefer to plan it for a future sprint?

