# Changes Since Last Deployment

**Date**: January 2025  
**Last Updated**: January 4, 2025  
**Summary**: Security enhancements, UI/UX improvements, mobile optimizations, and new features

---

## 🔐 Security Enhancements

### 1. XSS Vulnerability Fix (CRITICAL)
- **File**: `src/app/clients/[id]/page.tsx`
- **Change**: Removed `dangerouslySetInnerHTML` usage in onboarding AI summary
- **Impact**: Prevents cross-site scripting attacks
- **Status**: ✅ Fixed and tested

### 2. Rate Limiting Implementation
- **Files**: 
  - `src/lib/rate-limit.ts` (new)
  - `src/middleware.ts` (new)
- **Change**: Implemented rate limiting for all API routes
- **Limits**:
  - Authentication endpoints: 5 requests/minute per IP
  - File upload endpoints: 10 requests/minute per IP
  - Admin endpoints: 10 requests/minute per IP
  - General API endpoints: 100 requests/minute per IP
- **Development Mode**: Rate limiting disabled in development to prevent 429 errors during HMR
- **Impact**: Prevents brute force attacks, DDoS, and API abuse in production
- **Status**: ✅ Implemented

### 3. Error Message Information Leakage Fixes
- **Files**:
  - `src/app/api/admin/reorder-form-questions/route.ts`
  - `src/app/api/admin/check-form-questions/route.ts`
  - `src/app/api/client-portal/join-checkin/route.ts`
  - `src/app/api/client-portal/submit-issue/route.ts`
- **Change**: Added `NODE_ENV` guards to prevent error message leakage in production
- **Impact**: Prevents sensitive information exposure in error responses
- **Status**: ✅ Fixed

### 4. File Upload Validation Enhancements
- **Files**:
  - `src/app/api/progress-images/upload/route.ts`
  - `src/app/api/client-portal/profile-image/route.ts`
- **Changes**:
  - Added 5MB file size limit validation
  - Added strict MIME type validation (JPEG, PNG, WebP, GIF only)
- **Impact**: Prevents malicious file uploads and storage abuse
- **Status**: ✅ Enhanced

### 5. Security Audit Scripts
- **Files**:
  - `scripts/audit-api-auth.js` (new)
- **Change**: Created automated security audit scripts
- **Impact**: Ongoing security verification capability
- **Status**: ✅ Created

---

## 👥 Client-Side Updates (Client Portal)

### Client Portal Improvements
- **Support Page Mobile Optimization**:
  - Reduced padding and margins for mobile devices
  - Added horizontal scrolling for tab navigation
  - Improved text wrapping and overflow handling
  - Better touch targets and spacing
- **Check-in Experience**:
  - Check-in extension request feature (allows late submissions with reason)
  - Improved error handling and user feedback
- **Answer Display**:
  - Scores rounded to 1 decimal place for cleaner display
  - Better formatting of answers in check-in responses

---

## 👥 Client-Side Updates (Client Portal)

### Client Portal Improvements
- **Support Page Mobile Optimization**:
  - Files: `src/app/client-portal/support/page.tsx` and all support components
  - Reduced padding and margins for mobile devices
  - Added horizontal scrolling for tab navigation
  - Improved text wrapping and overflow handling
  - Better touch targets and spacing
  - Content properly contained within mobile viewport
- **Check-in Experience**:
  - Check-in extension request feature (allows late submissions with reason)
  - Improved error handling and user feedback
  - Better mobile layout for check-in forms
- **Answer Display**:
  - Scores rounded to 1 decimal place for cleaner display
  - Better formatting of answers in check-in responses
- **Navigation**:
  - Reordered client navigation menu for better logical flow
  - Improved mobile navigation experience

---

## 📱 Mobile Optimizations

### 6. Coach Check-in Response Page Mobile Optimization
- **File**: `src/app/responses/[id]/page.tsx`
- **Changes**:
  - Responsive padding and font sizes throughout
  - Header navigation stacks vertically on mobile
  - Answer Summary table optimized for mobile:
    - Score column hidden on mobile, shown inline with question
    - Question text limited to 4 lines with proper truncation
    - Increased cell height and padding
    - Better text wrapping and alignment
  - Question cards with smaller padding and font sizes on mobile
  - Expanded content sections optimized for small screens
- **Impact**: Much better mobile experience for coaches reviewing check-ins
- **Status**: ✅ Completed

### 7. Client Profile Page Mobile Sizing
- **File**: `src/app/clients/[id]/page.tsx`
- **Changes**:
  - Reduced padding throughout: `p-3 sm:p-4 lg:p-6`
  - Header optimized: stacked layout on mobile, smaller avatar and text
  - Tab navigation: smaller padding, horizontally scrollable on mobile
  - Progress summary cards: smaller fonts, padding, and gaps
  - Progress images section: reduced header padding, stacked buttons on mobile
  - Measurement history: optimized spacing and button sizes
  - Quick Review table: reduced padding and improved mobile layout
- **Impact**: Client profile pages now properly sized for mobile devices
- **Status**: ✅ Completed

### 8. Support Page Mobile Optimization
- **Files**:
  - `src/app/client-portal/support/page.tsx`
  - `src/app/client-portal/support/components/HelpGuides.tsx`
  - `src/app/client-portal/support/components/FAQ.tsx`
  - `src/app/client-portal/support/components/SubmitIssueForm.tsx`
  - `src/app/client-portal/support/components/PlatformUpdates.tsx`
- **Changes**:
  - Reduced padding on mobile
  - Added `overflow-x-hidden` to prevent horizontal scrolling
  - Tab navigation horizontally scrollable
  - Filter buttons wrap properly on mobile
  - Text breaks properly with `break-words`
- **Impact**: Support page content properly contained on mobile screens
- **Status**: ✅ Completed

---

## 🎨 UI/UX Improvements

### 9. Answer Summary Table - Score Sorting
- **File**: `src/app/responses/[id]/page.tsx`
- **Changes**:
  - Added dropdown to sort by "Original Order" or "Score (Red → Orange → Green)"
  - Sorting groups answers by status: Red first, then Orange, then Green
  - Within each group, sorted by score (lowest first)
  - Questions without scores appear at the end
- **Impact**: Coaches can quickly identify and prioritize issues needing attention
- **Status**: ✅ Completed

### 10. Score Rounding to One Decimal Place
- **File**: `src/app/responses/[id]/page.tsx`
- **Changes**:
  - All score displays now use `.toFixed(1)` for one decimal place
  - Applied to Answer Summary table (mobile and desktop)
  - Applied to Questions & Answers section
  - Applied to Question history
  - Applied to answer formatting function
- **Impact**: Cleaner score display (e.g., "6.0/10" instead of "6.0040000000000004/10")
- **Status**: ✅ Completed

### 11. Photos Gallery Access from Clients Page
- **File**: `src/app/clients/page.tsx`
- **Changes**:
  - Added "View Photos Gallery" button in desktop header (with icon)
  - Added photo icon button in mobile header
  - Both link to `/clients/photos`
- **Impact**: Easy access to photos gallery directly from Clients page
- **Status**: ✅ Completed

### 12. Goals Tab (Replaced Progress Tab)
- **File**: `src/app/clients/[id]/page.tsx`
- **Change**: 
  - Replaced "Progress" tab with "Goals" tab
  - Displays client goals in a clean, readable format
  - Removed Progress tab content (Question Progress Grid, Progress Images)
- **Impact**: Improved focus on client goals for coaches
- **Status**: ✅ Implemented

### 13. Quick Review Table Enhancement
- **File**: `src/app/clients/[id]/page.tsx`
- **Change**: 
  - Replaced check-in name with percentage score in Quick Review table
  - Shows score (e.g., "75%") instead of form title
  - Maintains expand/collapse functionality
- **Impact**: Better at-a-glance check-in performance view
- **Status**: ✅ Implemented

### 14. Onboarding Questionnaire Removal
- **File**: `src/app/clients/[id]/page.tsx`
- **Change**: Removed Onboarding Questionnaire section from Overview tab
- **Impact**: Cleaner overview, questionnaire accessible via quick menu
- **Status**: ✅ Removed

---

## 📊 New Features

### 15. Client Photos Gallery Page
- **File**: `src/app/clients/photos/page.tsx` (new)
- **Features**:
  - View all client photos in one gallery
  - Filter by client, orientation, and image type
  - Sort by date or client name
  - Hover to see client name
  - Click to view full-screen with client info
- **Impact**: Centralized photo viewing for coaches
- **Status**: ✅ Completed

### 16. Security Audit Documentation
- **Files**:
  - `SECURITY_AUDIT_JAN_2025.md` (new)
  - `API_AUTH_AUDIT_RESULTS.md` (new)
- **Change**: Comprehensive security audit documentation
- **Impact**: Security best practices documented
- **Status**: ✅ Created

---

## 🔧 Technical Changes

### 17. Rate Limiting Utility
- **File**: `src/lib/rate-limit.ts` (new, 144 lines)
- **Features**:
  - In-memory rate limiting store
  - Configurable limits per endpoint type
  - Automatic cleanup of expired entries
  - IP-based client identification
  - Development mode bypass

### 18. Next.js Middleware
- **File**: `src/middleware.ts` (new)
- **Features**:
  - Applies rate limiting to all API routes
  - Route-specific rate limit configurations
  - Standard rate limit headers (X-RateLimit-*)
  - HTTP 429 responses for exceeded limits
  - Development mode bypass for easier local development

### 19. Photos Gallery API Optimization
- **File**: `src/app/api/progress-images/route.ts`
- **Changes**:
  - Added validation to filter invalid image URLs
  - Improved error handling
- **Impact**: Prevents black squares in photo galleries
- **Status**: ✅ Enhanced

---

## 📝 Files Modified

### Modified Files:
1. `src/app/responses/[id]/page.tsx` - Mobile optimization, sorting, score rounding
2. `src/app/clients/[id]/page.tsx` - Goals tab, Quick Review, mobile sizing, Overview refactor
3. `src/app/clients/page.tsx` - Photos gallery link added
4. `src/app/clients/photos/page.tsx` - useEffect dependency fix
5. `src/app/client-portal/support/page.tsx` - Mobile optimization
6. `src/app/client-portal/support/components/HelpGuides.tsx` - Mobile optimization
7. `src/app/client-portal/support/components/FAQ.tsx` - Mobile optimization
8. `src/app/client-portal/support/components/SubmitIssueForm.tsx` - Mobile optimization
9. `src/app/client-portal/support/components/PlatformUpdates.tsx` - Mobile optimization
10. `src/app/api/admin/reorder-form-questions/route.ts` - Error message fix
11. `src/app/api/admin/check-form-questions/route.ts` - Error message fix
12. `src/app/api/client-portal/join-checkin/route.ts` - Error message fix
13. `src/app/api/client-portal/submit-issue/route.ts` - Error message fix
14. `src/app/api/progress-images/upload/route.ts` - File upload validation
15. `src/app/api/client-portal/profile-image/route.ts` - File upload validation
16. `src/app/api/progress-images/route.ts` - Image validation improvements
17. `src/middleware.ts` - Development mode bypass added

### New Files:
1. `src/lib/rate-limit.ts` - Rate limiting utility
2. `src/middleware.ts` - Next.js middleware for rate limiting
3. `scripts/audit-api-auth.js` - API authentication audit script
4. `SECURITY_AUDIT_JAN_2025.md` - Security audit report
5. `API_AUTH_AUDIT_RESULTS.md` - Authentication audit results
6. `CHANGES_SINCE_LAST_DEPLOYMENT.md` - This file

---

## 🎯 Impact Summary

### Security
- ✅ 1 critical vulnerability fixed (XSS)
- ✅ Rate limiting implemented (prevents abuse)
- ✅ Error message leakage prevented
- ✅ File upload validation enhanced
- ✅ Security audit tools created

### User Experience
- ✅ Goals tab replaces Progress tab (better coach workflow)
- ✅ Quick Review table shows scores instead of names
- ✅ Cleaner Overview tab (removed redundant onboarding section)
- ✅ Answer Summary sorting by score (prioritize issues)
- ✅ Score rounding for cleaner display
- ✅ Photos gallery accessible from Clients page
- ✅ Mobile optimizations across multiple pages

### Mobile Experience
- ✅ Coach check-in response page fully optimized
- ✅ Client profile pages properly sized
- ✅ Support page contained on mobile
- ✅ Better touch targets and spacing
- ✅ Improved text readability

### Code Quality
- ✅ Security best practices implemented
- ✅ Audit scripts for ongoing verification
- ✅ Comprehensive security documentation
- ✅ Development-friendly rate limiting

---

## ⚠️ Deployment Notes

1. **Rate Limiting**: 
   - Uses in-memory storage (works for single instance)
   - For multi-instance deployments, consider Redis-based rate limiting
   - **Disabled in development mode** to prevent 429 errors during HMR

2. **Security Scripts**: Audit scripts are for development use and can be run as needed.

3. **Build Status**: All changes tested and build passes successfully.

4. **Breaking Changes**: None - all changes are backward compatible.

5. **Mobile Testing**: Please test on actual mobile devices to verify optimizations work as expected.

---

## 🚀 Recommended Deployment Steps

1. Review and test changes on staging/localhost
2. Verify rate limiting doesn't interfere with normal usage (production only)
3. Test file uploads with new validation
4. Verify Goals tab displays correctly
5. Check Quick Review table functionality
6. Test Answer Summary sorting feature
7. Verify photos gallery link works
8. Test mobile responsiveness on various devices
9. Verify score rounding displays correctly
10. Deploy to production

---

## 📊 Change Statistics

**Total Changes**: 
- 17 files modified
- 6 new files created
- 0 breaking changes
- 4 critical/high security improvements
- 6 UI/UX enhancements
- 3 major mobile optimizations
- 2 new features (Photos Gallery, Score Sorting)

**Lines of Code Changed**:
- ~500+ lines modified
- ~400+ lines added (new features and utilities)
- ~100+ lines removed (removed features, cleanup)

---

**Last Updated**: January 4, 2025
