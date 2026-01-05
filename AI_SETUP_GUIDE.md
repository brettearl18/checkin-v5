# AI Integration Setup Guide

## Prerequisites

1. OpenAI API account (sign up at https://platform.openai.com/)
2. API key from OpenAI dashboard

## Step 1: Install Dependencies

✅ **Already done** - OpenAI package installed via `npm install openai`

## Step 2: Environment Variables

Add to your `.env.local` file (or Cloud Run environment variables):

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

**For Local Development:**
1. Create `.env.local` in project root (if not exists)
2. Add `OPENAI_API_KEY=your_key_here`
3. Restart dev server

**For Cloud Run Deployment:**
1. Go to Google Cloud Console → Cloud Run → checkinv5 service
2. Click "Edit & Deploy New Revision"
3. Go to "Variables & Secrets" tab
4. Add environment variable:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-your-api-key-here`
5. Deploy

## Step 3: Verify Installation

The AI service is ready to use! Test it using the built-in test endpoint:

### Option 1: Quick Check (GET request)
Check if OpenAI is configured:
```bash
# Local development
curl http://localhost:3000/api/test-ai

# Production (after deployment)
curl https://your-app-url.run.app/api/test-ai
```

Expected response:
```json
{
  "success": true,
  "configured": true,
  "message": "OpenAI API is configured and ready"
}
```

### Option 2: Full Test (POST request)
Test actual AI functionality with sample data:
```bash
# Local development
curl -X POST http://localhost:3000/api/test-ai \
  -H "Content-Type: application/json" \
  -d '{}'

# Or test with custom data
curl -X POST http://localhost:3000/api/test-ai \
  -H "Content-Type: application/json" \
  -d '{
    "checkInResponse": {
      "score": 75,
      "responses": [
        {"question": "How was your sleep?", "answer": 7, "type": "scale"},
        {"question": "Did you exercise?", "answer": "Yes", "type": "boolean"}
      ]
    },
    "clientProfile": {
      "goals": ["Weight loss", "Build muscle"],
      "baselineScore": 70
    }
  }'
```

Expected response will include AI-generated feedback!

### Option 3: Use in Your Code
For using AI functions in your own code:
```typescript
import { generateCoachFeedback } from '@/lib/openai-service';

const feedback = await generateCoachFeedback({
  checkInResponse: {
    score: 75,
    responses: [
      { question: "How was your sleep?", answer: 7, type: "scale" },
      { question: "Did you exercise?", answer: "Yes", type: "boolean" }
    ]
  },
  clientProfile: {
    goals: ["Weight loss", "Build muscle"],
    baselineScore: 70
  }
});
```

## Step 4: API Cost Management

### Current Setup:
- **Caching**: Similar requests are cached for 5 minutes
- **Model Selection**: 
  - GPT-3.5-turbo for general tasks (cheaper: ~$0.002 per request)
  - GPT-4 for critical analysis (more expensive: ~$0.03 per request)
- **Retry Logic**: Automatic retries with exponential backoff

### Monitor Costs:
- Check OpenAI dashboard: https://platform.openai.com/usage
- Set up billing alerts in OpenAI dashboard
- Monitor via `getCacheStats()` function

## Step 5: Available AI Functions

### 1. **generateCoachFeedback()**
Generate personalized coach feedback for check-in responses.

**Usage:**
```typescript
import { generateCoachFeedback } from '@/lib/openai-service';

const feedback = await generateCoachFeedback({
  checkInResponse: { score: 75, responses: [...] },
  clientProfile: { goals: [...], barriers: [...] },
  historicalResponses: [...],
  previousFeedback: "..."
});
```

### 2. **analyzeClientRisk()**
Analyze client risk level based on patterns.

**Usage:**
```typescript
import { analyzeClientRisk } from '@/lib/openai-service';

const risk = await analyzeClientRisk({
  currentScore: 65,
  historicalScores: [70, 72, 68, 65],
  textResponses: [...],
  clientProfile: { goals: [...], barriers: [...] }
});
```

### 3. **extractTextInsights()**
Extract insights from text/textarea responses.

**Usage:**
```typescript
import { extractTextInsights } from '@/lib/openai-service';

const insights = await extractTextInsights({
  textResponses: ["I'm feeling tired", "Work is stressful"],
  context: { score: 65, weekNumber: 4 }
});
```

### 4. **generateOnboardingSummary()**
Generate AI summary for coach after client onboarding.

**Usage:**
```typescript
import { generateOnboardingSummary } from '@/lib/openai-service';

const summary = await generateOnboardingSummary({
  onboardingResponses: { ... },
  clientName: "John Doe"
});
```

## Error Handling

All functions include:
- ✅ Automatic retry logic (3 attempts with exponential backoff)
- ✅ Error handling and logging
- ✅ Type safety with TypeScript interfaces

## Caching

Similar requests are automatically cached for 5 minutes to reduce costs.

**Clear cache manually:**
```typescript
import { clearCache } from '@/lib/openai-service';
clearCache();
```

**Check cache stats:**
```typescript
import { getCacheStats } from '@/lib/openai-service';
const stats = getCacheStats();
console.log(`Cache size: ${stats.size}, Keys: ${stats.keys}`);
```

## Testing

To test AI integration:

1. **Test locally** with a simple API endpoint:
   ```typescript
   // src/app/api/test-ai/route.ts
   import { generateCoachFeedback } from '@/lib/openai-service';
   
   export async function POST(request: Request) {
     const data = await request.json();
     const feedback = await generateCoachFeedback(data);
     return Response.json({ success: true, feedback });
   }
   ```

2. **Test with seeded data** (already set up in AI Analytics tab)

## Next Steps

1. ✅ Environment setup (this guide)
2. ⏭️ Integrate into check-in submission flow
3. ⏭️ Add to coach review page
4. ⏭️ Set up background jobs for risk analysis
5. ⏭️ Add monitoring and cost tracking

## Troubleshooting

### "OPENAI_API_KEY environment variable is not set"
- Make sure `.env.local` exists and has the key
- Restart dev server after adding env variable
- For Cloud Run, ensure variable is set in service configuration

### "Rate limit exceeded"
- Reduce request frequency
- Increase cache TTL
- Implement request queuing for high-volume scenarios

### High costs
- Use GPT-3.5-turbo instead of GPT-4 where possible
- Increase cache TTL
- Implement request batching
- Monitor usage in OpenAI dashboard

## Support

For issues or questions:
- Check OpenAI API documentation: https://platform.openai.com/docs
- Review error logs in console
- Check OpenAI dashboard for API status


## Prerequisites

1. OpenAI API account (sign up at https://platform.openai.com/)
2. API key from OpenAI dashboard

## Step 1: Install Dependencies

✅ **Already done** - OpenAI package installed via `npm install openai`

## Step 2: Environment Variables

Add to your `.env.local` file (or Cloud Run environment variables):

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

**For Local Development:**
1. Create `.env.local` in project root (if not exists)
2. Add `OPENAI_API_KEY=your_key_here`
3. Restart dev server

**For Cloud Run Deployment:**
1. Go to Google Cloud Console → Cloud Run → checkinv5 service
2. Click "Edit & Deploy New Revision"
3. Go to "Variables & Secrets" tab
4. Add environment variable:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-your-api-key-here`
5. Deploy

## Step 3: Verify Installation

The AI service is ready to use! Test it using the built-in test endpoint:

### Option 1: Quick Check (GET request)
Check if OpenAI is configured:
```bash
# Local development
curl http://localhost:3000/api/test-ai

# Production (after deployment)
curl https://your-app-url.run.app/api/test-ai
```

Expected response:
```json
{
  "success": true,
  "configured": true,
  "message": "OpenAI API is configured and ready"
}
```

### Option 2: Full Test (POST request)
Test actual AI functionality with sample data:
```bash
# Local development
curl -X POST http://localhost:3000/api/test-ai \
  -H "Content-Type: application/json" \
  -d '{}'

# Or test with custom data
curl -X POST http://localhost:3000/api/test-ai \
  -H "Content-Type: application/json" \
  -d '{
    "checkInResponse": {
      "score": 75,
      "responses": [
        {"question": "How was your sleep?", "answer": 7, "type": "scale"},
        {"question": "Did you exercise?", "answer": "Yes", "type": "boolean"}
      ]
    },
    "clientProfile": {
      "goals": ["Weight loss", "Build muscle"],
      "baselineScore": 70
    }
  }'
```

Expected response will include AI-generated feedback!

### Option 3: Use in Your Code
For using AI functions in your own code:
```typescript
import { generateCoachFeedback } from '@/lib/openai-service';

const feedback = await generateCoachFeedback({
  checkInResponse: {
    score: 75,
    responses: [
      { question: "How was your sleep?", answer: 7, type: "scale" },
      { question: "Did you exercise?", answer: "Yes", type: "boolean" }
    ]
  },
  clientProfile: {
    goals: ["Weight loss", "Build muscle"],
    baselineScore: 70
  }
});
```

## Step 4: API Cost Management

### Current Setup:
- **Caching**: Similar requests are cached for 5 minutes
- **Model Selection**: 
  - GPT-3.5-turbo for general tasks (cheaper: ~$0.002 per request)
  - GPT-4 for critical analysis (more expensive: ~$0.03 per request)
- **Retry Logic**: Automatic retries with exponential backoff

### Monitor Costs:
- Check OpenAI dashboard: https://platform.openai.com/usage
- Set up billing alerts in OpenAI dashboard
- Monitor via `getCacheStats()` function

## Step 5: Available AI Functions

### 1. **generateCoachFeedback()**
Generate personalized coach feedback for check-in responses.

**Usage:**
```typescript
import { generateCoachFeedback } from '@/lib/openai-service';

const feedback = await generateCoachFeedback({
  checkInResponse: { score: 75, responses: [...] },
  clientProfile: { goals: [...], barriers: [...] },
  historicalResponses: [...],
  previousFeedback: "..."
});
```

### 2. **analyzeClientRisk()**
Analyze client risk level based on patterns.

**Usage:**
```typescript
import { analyzeClientRisk } from '@/lib/openai-service';

const risk = await analyzeClientRisk({
  currentScore: 65,
  historicalScores: [70, 72, 68, 65],
  textResponses: [...],
  clientProfile: { goals: [...], barriers: [...] }
});
```

### 3. **extractTextInsights()**
Extract insights from text/textarea responses.

**Usage:**
```typescript
import { extractTextInsights } from '@/lib/openai-service';

const insights = await extractTextInsights({
  textResponses: ["I'm feeling tired", "Work is stressful"],
  context: { score: 65, weekNumber: 4 }
});
```

### 4. **generateOnboardingSummary()**
Generate AI summary for coach after client onboarding.

**Usage:**
```typescript
import { generateOnboardingSummary } from '@/lib/openai-service';

const summary = await generateOnboardingSummary({
  onboardingResponses: { ... },
  clientName: "John Doe"
});
```

## Error Handling

All functions include:
- ✅ Automatic retry logic (3 attempts with exponential backoff)
- ✅ Error handling and logging
- ✅ Type safety with TypeScript interfaces

## Caching

Similar requests are automatically cached for 5 minutes to reduce costs.

**Clear cache manually:**
```typescript
import { clearCache } from '@/lib/openai-service';
clearCache();
```

**Check cache stats:**
```typescript
import { getCacheStats } from '@/lib/openai-service';
const stats = getCacheStats();
console.log(`Cache size: ${stats.size}, Keys: ${stats.keys}`);
```

## Testing

To test AI integration:

1. **Test locally** with a simple API endpoint:
   ```typescript
   // src/app/api/test-ai/route.ts
   import { generateCoachFeedback } from '@/lib/openai-service';
   
   export async function POST(request: Request) {
     const data = await request.json();
     const feedback = await generateCoachFeedback(data);
     return Response.json({ success: true, feedback });
   }
   ```

2. **Test with seeded data** (already set up in AI Analytics tab)

## Next Steps

1. ✅ Environment setup (this guide)
2. ⏭️ Integrate into check-in submission flow
3. ⏭️ Add to coach review page
4. ⏭️ Set up background jobs for risk analysis
5. ⏭️ Add monitoring and cost tracking

## Troubleshooting

### "OPENAI_API_KEY environment variable is not set"
- Make sure `.env.local` exists and has the key
- Restart dev server after adding env variable
- For Cloud Run, ensure variable is set in service configuration

### "Rate limit exceeded"
- Reduce request frequency
- Increase cache TTL
- Implement request queuing for high-volume scenarios

### High costs
- Use GPT-3.5-turbo instead of GPT-4 where possible
- Increase cache TTL
- Implement request batching
- Monitor usage in OpenAI dashboard

## Support

For issues or questions:
- Check OpenAI API documentation: https://platform.openai.com/docs
- Review error logs in console
- Check OpenAI dashboard for API status

