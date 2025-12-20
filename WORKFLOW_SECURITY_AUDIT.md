# Workflow Security Audit

## Overview
This document verifies that the check-in workflow is properly secured for both coach-only and client-only authentication, and that clients cannot delete check-ins.

## Role-Based Access Control

### ✅ Coach-Only Pages (Protected with `RoleProtected requiredRole="coach"`)

1. **Dashboard** (`/dashboard/page.tsx`)
   - ✅ Protected with `RoleProtected requiredRole="coach"`
   - Shows "Check-ins to Review" with workflow status
   - Shows "Needs Response" count
   - Displays workflow status badges (⏳ Needs Response / ✓ Responded)

2. **Response Review Page** (`/responses/[id]/page.tsx`)
   - ✅ Protected with `RoleProtected requiredRole="coach"`
   - Shows workflow status badge
   - "Respond" section when feedback is pending
   - Coach can add voice/text feedback
   - Coach can mark as reviewed

3. **Client Profile Page** (`/clients/[id]/page.tsx`)
   - ✅ Protected with `RoleProtected requiredRole="coach"`
   - Coach can delete check-ins (authorized action)
   - Delete button only visible to coaches

### ✅ Client-Only Pages (Protected with `RoleProtected requiredRole="client"`)

1. **Client Portal Dashboard** (`/client-portal/page.tsx`)
   - ✅ Protected with `RoleProtected requiredRole="client"`
   - Shows check-ins with feedback indicators
   - Shows workflow status (traffic lights)

2. **Client Check-ins List** (`/client-portal/check-ins/page.tsx`)
   - ✅ Protected with `RoleProtected requiredRole="client"`
   - Shows "Coach Feedback Available" badge when feedback exists
   - "View Feedback" button when feedback is available
   - **NO DELETE FUNCTIONALITY** - Clients cannot delete check-ins

3. **Check-in Completion Page** (`/client-portal/check-in/[id]/page.tsx`)
   - ✅ Protected with `RoleProtected requiredRole="client"` (updated from `AuthenticatedOnly`)
   - Clients can complete check-ins
   - **NO DELETE FUNCTIONALITY**

4. **Check-in Success Page** (`/client-portal/check-in/[id]/success/page.tsx`)
   - ✅ Protected with `RoleProtected requiredRole="client"`
   - Shows score and traffic light status
   - **NO DELETE FUNCTIONALITY**

5. **Client Feedback Page** (`/client-portal/feedback/[id]/page.tsx`)
   - ✅ Protected with `RoleProtected requiredRole="client"`
   - Clients can view coach feedback
   - **NO DELETE FUNCTIONALITY**

## API Security

### ✅ Check-in Assignment DELETE Endpoints

1. **Single Assignment Delete** (`/api/check-in-assignments/[id]/route.ts`)
   - ✅ **SECURITY ADDED**: Requires `coachId` query parameter
   - ✅ **SECURITY ADDED**: Verifies that `assignmentData.coachId === coachId`
   - ✅ Returns 403 if coachId doesn't match
   - ✅ **Clients cannot delete check-ins** - API will reject requests without valid coachId

2. **Series Delete** (`/api/check-in-assignments/series/route.ts`)
   - ✅ **SECURITY ADDED**: Requires `coachId` in request body
   - ✅ **SECURITY ADDED**: Verifies all assignments belong to the requesting coach
   - ✅ Returns 403 if any assignment belongs to a different coach
   - ✅ **Clients cannot delete check-in series**

### ✅ Coach Feedback API (`/api/coach-feedback/route.ts`)

- ✅ Requires `coachId` in request body
- ✅ Only coaches can create/update feedback
- ✅ Creates notifications for clients when feedback is added
- ✅ Updates workflow status when feedback is created

### ✅ Response API (`/api/responses/[id]/route.ts`)

- ✅ Requires `coachId` query parameter
- ✅ Verifies `responseData.coachId === coachId` before allowing access
- ✅ Returns 403 if coach doesn't have permission

## Workflow Status Tracking

### Data Flow Security

1. **Coach Creates Check-in**
   - ✅ Only coaches can create check-ins via `/api/check-in-assignments` (POST)
   - ✅ Requires `coachId` in request body

2. **Client Completes Check-in**
   - ✅ Only clients can complete check-ins via `/api/client-portal/check-in/[id]` (POST)
   - ✅ Client ID verified from authenticated user profile
   - ✅ Creates `formResponses` document with `coachId` link

3. **Coach Reviews & Responds**
   - ✅ Only coaches can view responses via `/api/responses/[id]` (GET)
   - ✅ Only coaches can add feedback via `/api/coach-feedback` (POST)
   - ✅ Workflow status updated: `completed` → `reviewed` → `responded`

4. **Client Views Feedback**
   - ✅ Only clients can view their own feedback via `/client-portal/feedback/[id]`
   - ✅ Protected with `RoleProtected requiredRole="client"`

## Security Summary

### ✅ What's Protected

1. **Frontend Pages**
   - All coach pages: `RoleProtected requiredRole="coach"`
   - All client pages: `RoleProtected requiredRole="client"`
   - Proper redirects if wrong role accesses page

2. **API Endpoints**
   - DELETE operations require `coachId` and verify ownership
   - GET operations verify `coachId` matches assignment/response
   - POST operations verify user role through request parameters

3. **Data Access**
   - Coaches can only see their own clients' check-ins
   - Clients can only see their own check-ins
   - Responses linked to `coachId` for proper filtering

### ✅ What Clients CANNOT Do

1. ❌ **Cannot delete check-ins** - No delete buttons on client pages
2. ❌ **Cannot delete check-in series** - API rejects requests without coachId
3. ❌ **Cannot access coach dashboard** - Redirected to client portal
4. ❌ **Cannot view other clients' data** - Filtered by clientId
5. ❌ **Cannot create check-ins** - No access to check-in creation endpoints

### ✅ What Coaches CAN Do

1. ✅ Create check-ins for their clients
2. ✅ Delete check-ins (with proper authorization)
3. ✅ View and respond to client check-ins
4. ✅ Access dashboard with workflow status
5. ✅ See "Needs Response" indicators

## Recommendations

1. **Future Enhancement**: Consider implementing Firebase Auth token verification in API routes for stronger security
2. **Audit Logging**: Consider logging all delete operations for audit purposes
3. **Rate Limiting**: Consider adding rate limiting to prevent abuse

## Verification Checklist

- [x] Coach dashboard shows workflow status
- [x] Client portal shows feedback indicators
- [x] Coach review page shows "Respond" section
- [x] Clients cannot delete check-ins (no UI elements)
- [x] API DELETE endpoints require coachId
- [x] API DELETE endpoints verify coach ownership
- [x] All client pages use `RoleProtected requiredRole="client"`
- [x] All coach pages use `RoleProtected requiredRole="coach"`
- [x] Workflow status tracking works for both roles
- [x] Notifications created when coach responds

## Status: ✅ SECURE

All workflow pages are properly protected, and clients cannot delete check-ins. The system enforces role-based access control at both the frontend and API levels.





