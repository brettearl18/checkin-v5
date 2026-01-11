# Quick Check-in Review Panel - Debug Guide

## Issue
The Quick Check-in Review panel is not visible on the coach's client overview page.

## Panel Location
- **File**: `src/app/clients/[id]/page.tsx`
- **Line**: 2750-2936
- **Tab**: Overview tab (must be selected)
- **Section**: Below "Quick Insights" panel

## Panel Logic

The panel:
1. **Always renders** - it's not conditionally hidden
2. Filters `allocatedCheckIns` for `status === 'completed'`
3. Shows the latest completed check-in
4. If no completed check-ins exist, shows "No completed check-ins yet"

## Data Flow

1. **Data Source**: `/api/clients/[id]/check-ins`
   - Endpoint: `src/app/api/clients/[id]/check-ins/route.ts`
   - Returns: `{ success: true, checkIns: [...], metrics: {...} }`

2. **Frontend Processing**:
   - `fetchAllocatedCheckIns()` (line 348)
   - Sets `allocatedCheckIns` state (line 386)
   - Filters for completed: `allocatedCheckIns.filter(ci => ci.status === 'completed')` (line 2753)

3. **Response Fetching**:
   - If latest check-in has `responseId`, fetches `/api/responses/{responseId}`
   - Sets `latestCheckInResponses` state
   - Used to display color-coded question responses

## Potential Issues

### 1. API Not Returning Completed Check-ins
- **Check**: Browser console → Network tab → `/api/clients/[id]/check-ins`
- **Look for**: Response includes check-ins with `status: 'completed'`
- **Fix**: Verify endpoint logic for status detection (line 221-222)

### 2. Status Field Not Set Correctly
- **Check**: API endpoint sets status based on `responseId || completedAt` (line 221-222)
- **Fix**: Ensure pre-created assignments have `responseId` or `completedAt` set

### 3. Data Not Loading
- **Check**: Browser console for errors in `fetchAllocatedCheckIns`
- **Fix**: Verify `hasLoadedCheckIns` flag and API response structure

### 4. Panel Rendering But Empty
- **Check**: Panel shows "No completed check-ins yet"
- **Cause**: `allocatedCheckIns` has no items with `status === 'completed'`
- **Fix**: Verify completed check-ins are being returned from API

## Debug Steps

1. Open browser DevTools (F12)
2. Navigate to client overview page (Overview tab)
3. Check Console for errors
4. Check Network tab → `/api/clients/{clientId}/check-ins`
5. Verify response includes completed check-ins
6. Verify `allocatedCheckIns` state in React DevTools
7. Check if panel renders but shows "No completed check-ins yet"

## Expected Behavior

If Brett Earl has completed check-ins (W1, W2, W3, W4):
- Panel should render
- Should show latest check-in date (e.g., "Jan 11, 2026")
- Should show color-coded circles for responses
- Should show score percentage
- Should be expandable to show full responses

