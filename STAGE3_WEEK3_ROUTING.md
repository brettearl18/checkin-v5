# Stage 3: Verify Week 3 Routing

## Issue
After completing Week 2, the "Complete Now" button should route to Week 3 (the next available check-in).

## Current Logic
The dashboard filters check-ins with:
```typescript
if (checkIn.status === 'completed') return false;
```

This should exclude completed check-ins and show the next available one (Week 3).

## Verification Needed
1. Check if Week 2 is being marked as `status === 'completed'` correctly
2. Verify the new pre-created assignments API is returning correct status
3. Ensure filtering logic works with new system

## Expected Behavior
- Week 2 completed → filtered out
- Week 3 (next available) → shown in "Check-ins Requiring Attention"
- "Complete Now" button → routes to Week 3

