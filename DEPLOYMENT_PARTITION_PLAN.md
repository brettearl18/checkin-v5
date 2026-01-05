# Deployment Partition Plan

**Created**: January 5, 2026  
**Purpose**: Partition merged changes into logical, deployable groups to avoid build errors and enable staged deployments

---

## 🔴 Current Status

**Issue**: Large merge from `feature/mobile-dashboard` to `main` introduced duplicate code blocks causing build failures.  
**Solution**: Partition changes into logical groups and deploy separately to ensure each group builds successfully.

### Build Error Fixes (In Progress)

**Status**: 🔄 Actively fixing duplicate code blocks and syntax errors

**Files Fixed** (commits: cd9942c through a360363):
- ✅ `src/app/api/notifications/route.ts` - Removed duplicate code blocks
- ✅ `src/lib/firebase-server.ts` - Removed duplicate code in getStorageInstance
- ✅ `src/app/api/client-portal/goals-questionnaire/route.ts` - Removed duplicate GET/POST functions
- ✅ `src/app/api/client-portal/check-ins/route.ts` - Removed duplicate GET function
- ✅ `src/app/api/client-portal/goals/route.ts` - Removed duplicate PUT/DELETE functions
- ✅ `src/app/api/client-portal/onboarding/regenerate-summary/route.ts` - Removed duplicate POST function
- ✅ `src/app/api/client-portal/onboarding/report/route.ts` - Removed orphaned code block
- ✅ `src/app/api/client-portal/onboarding/submit/route.ts` - Removed orphaned code block
- ✅ `src/app/api/client-portal/resources/route.ts` - Removed orphaned code block
- ✅ `src/app/api/clients/[id]/ai-analytics/route.ts` - Removed duplicate GET/POST functions and imports
- ✅ `src/app/api/clients/[id]/swot-analysis/route.ts` - Removed duplicate GET function and imports
- ✅ `src/app/api/clients/[id]/weekly-summary/route.ts` - Removed duplicate GET function and imports

**Remaining Issues**:
- ⚠️ `src/app/api/coach-feedback/route.ts` - Build error to be fixed

**Next Steps**: Continue fixing remaining build errors, then proceed with partitioned deployments.

---

## 📦 Partition Groups

### Group 1: Image Compression (Already Deployed ✅)

**Status**: ✅ Already in main (commit 9b014bb)

**Files**:
- `package.json` & `package-lock.json` (browser-image-compression dependency)
- `src/lib/image-compression.ts` (new utility)
- `src/app/client-portal/progress-images/page.tsx`
- `src/app/client-portal/measurements/page.tsx`
- `src/components/ClientNavigation.tsx`
- `src/components/ProfilePersonalizationModal.tsx`
- `src/app/client-portal2/page.tsx` (banner images)

**Impact**: Low risk, client-side only, already tested

---

### Group 2: Security Enhancements (High Priority)

**Purpose**: Critical security fixes and improvements

**Files**:
- `src/lib/rate-limit.ts` (new)
- `src/middleware.ts` (new/updated)
- `src/app/api/progress-images/upload/route.ts` (file validation)
- `src/app/api/client-portal/profile-image/route.ts` (file validation)
- `src/app/api/admin/reorder-form-questions/route.ts` (error handling)
- `src/app/api/admin/check-form-questions/route.ts` (error handling)
- `src/app/api/client-portal/join-checkin/route.ts` (error handling)
- `src/app/api/client-portal/submit-issue/route.ts` (error handling)
- `src/app/clients/[id]/page.tsx` (XSS fix - onboarding summary)

**Dependencies**: None

**Testing Required**:
- Rate limiting works in production
- File uploads reject invalid files
- Error messages don't leak sensitive info

---

### Group 3: Client Portal - Support Section

**Purpose**: New support page with help guides, FAQ, platform updates, issue reporting

**Files**:
- `src/app/client-portal/support/page.tsx` (new)
- `src/app/client-portal/support/components/FAQ.tsx` (new)
- `src/app/client-portal/support/components/HelpGuides.tsx` (new)
- `src/app/client-portal/support/components/PlatformUpdates.tsx` (new)
- `src/app/client-portal/support/components/SubmitIssueForm.tsx` (new)
- `src/app/api/client-portal/submit-issue/route.ts` (new)
- `src/app/api/client-portal/platform-updates/route.ts` (new)
- `src/app/admin/platform-updates/page.tsx` (new)
- `src/app/api/admin/platform-updates/route.ts` (new)
- `src/app/api/admin/platform-updates/[id]/route.ts` (new)
- `src/components/ClientNavigation.tsx` (support link)

**Dependencies**: 
- Firestore collection: `platform_updates`
- Email service for issue reporting

**Testing Required**:
- Support page loads correctly
- Issue reporting sends emails
- Platform updates display correctly
- Admin can manage platform updates

---

### Group 4: Profile Personalization

**Purpose**: Custom avatars, color themes, quotes, icons for clients

**Files**:
- `src/components/ProfilePersonalizationModal.tsx` (new)
- `src/app/api/client-portal/profile-personalization/route.ts` (new)
- `src/app/api/client-portal/profile-image/route.ts` (new)
- `src/components/ClientNavigation.tsx` (personalization integration)
- `src/contexts/AuthContext.tsx` (refreshProfile method)

**Dependencies**:
- Firebase Storage for avatar images
- Firestore collection: `profilePersonalization`

**Testing Required**:
- Avatar upload and cropping works
- Color themes apply correctly
- Quotes and icons save and display
- Profile image displays in navigation

---

### Group 5: Email Tracking & Audit Log

**Purpose**: Email open/click tracking via Mailgun webhooks

**Files**:
- `src/lib/email-service.ts` (tracking options)
- `src/app/api/webhooks/mailgun/route.ts` (new)
- `src/app/admin/email-audit-log/page.tsx` (new/updated)
- `src/app/api/admin/email-audit-log/route.ts` (new/updated)
- `src/app/coach/email-audit-log/page.tsx` (new)
- `src/app/api/coach/email-audit-log/route.ts` (new)

**Dependencies**:
- Mailgun webhook URL configuration
- Firestore collection: `email_audit_log` (updated schema)

**Configuration Required**:
- Set Mailgun webhook URL to `/api/webhooks/mailgun`
- Verify webhook signature validation

**Testing Required**:
- Webhook receives Mailgun events
- Email audit log displays tracking data
- Open/click counts update correctly

---

### Group 6: Check-in Extensions

**Purpose**: Allow clients to request extensions for overdue check-ins

**Files**:
- `src/app/api/check-in-assignments/[id]/extension/route.ts` (new)
- `src/app/client-portal/check-in/[id]/page.tsx` (extension UI)
- `src/app/api/client-portal/check-in/[id]/route.ts` (extension validation)
- Firestore collection: `check_in_extensions` (new)

**Dependencies**: None

**Testing Required**:
- Extension requests work
- Extension grants access to overdue check-ins
- Notifications sent to coaches

---

### Group 7: Client Portal - Analytics & Dashboard Improvements

**Purpose**: Analytics API, quick stats, improved dashboard

**Files**:
- `src/app/api/client-portal/analytics/route.ts` (new)
- `src/components/client-portal/QuickStatsBar.tsx` (new)
- `src/app/client-portal/page.tsx` (dashboard improvements)
- `src/app/client-portal/progress/page.tsx` (Recharts conversion)

**Dependencies**:
- Recharts library (already installed)

**Testing Required**:
- Analytics API returns correct data
- Quick stats display correctly
- Charts render properly

---

### Group 8: Client Profile - Overview Tab Enhancements

**Purpose**: Progress photos, bodyweight charts, quick review table in Overview tab

**Files**:
- `src/app/clients/[id]/page.tsx` (major refactor - Overview tab)
- Progress photos gallery
- Bodyweight chart (Recharts)
- Quick review table
- Coach quick response feature

**Dependencies**:
- VoiceRecorder component
- `/api/coach-feedback` endpoint
- `/api/responses/[id]/review` endpoint

**Testing Required**:
- Progress photos display correctly
- Bodyweight chart renders
- Quick review table works
- Quick response (voice/text) functions

---

### Group 9: Client Profile - Goals Tab

**Purpose**: Replace Progress tab with Goals tab

**Files**:
- `src/app/clients/[id]/page.tsx` (Goals tab)
- Goals display and tracking

**Dependencies**: 
- Client goals data structure
- `/api/client-portal/goals` endpoint

**Testing Required**:
- Goals display correctly
- Goals can be viewed and tracked

---

### Group 10: Client Portal - Goals Questionnaire

**Purpose**: Goals questionnaire system for clients

**Files**:
- `src/app/client-portal/goals/questionnaire/page.tsx` (new)
- `src/app/api/client-portal/goals-questionnaire/route.ts` (new)
- `src/app/api/client-portal/goals-questionnaire/submit/route.ts` (new)
- `src/lib/goals-questionnaire.ts` (new)
- `src/app/client-portal/goals/page.tsx` (updates)

**Dependencies**:
- Goals questionnaire data structure
- Goals tracking system

**Testing Required**:
- Questionnaire loads correctly
- Answers save properly
- Goals created from questionnaire

---

### Group 11: AI Analytics Features

**Purpose**: SWOT analysis, weekly summaries, AI analytics for coaches

**Files**:
- `src/app/api/clients/[id]/ai-analytics/route.ts` (new)
- `src/app/api/clients/[id]/swot-analysis/route.ts` (new)
- `src/app/api/clients/[id]/weekly-summary/route.ts` (new)
- `src/app/clients/[id]/page.tsx` (AI Analytics tab)
- `src/lib/ai-context.ts` (new)
- `src/lib/openai-service.ts` (new)
- `src/lib/ai-prompts.ts` (new)

**Dependencies**:
- OpenAI API key
- Firestore collections: `ai_analytics_history`, `weekly_summaries`, `swot_analyses`

**Configuration Required**:
- `OPENAI_API_KEY` environment variable

**Testing Required**:
- AI analytics generate correctly
- SWOT analysis works
- Weekly summaries generate
- History tracking works

---

### Group 12: Photo Gallery (Coach View)

**Purpose**: Dedicated gallery page for coaches to view all client photos

**Files**:
- `src/app/clients/photos/page.tsx` (new)
- `src/app/dashboard/page.tsx` (gallery link)
- `src/app/clients/page.tsx` (gallery link)

**Dependencies**: None

**Testing Required**:
- Gallery loads all photos
- Filtering works
- Sorting works
- Full-screen modal works

---

### Group 13: Onboarding Enhancements

**Purpose**: Enhanced onboarding with regeneration and reporting

**Files**:
- `src/app/api/client-portal/onboarding/regenerate-summary/route.ts` (new)
- `src/app/api/client-portal/onboarding/report/route.ts` (new)
- `src/app/clients/[id]/onboarding-report/page.tsx` (new)
- `src/app/client-portal/onboarding-setup/page.tsx` (updates)

**Dependencies**:
- Onboarding system
- AI summary generation

**Testing Required**:
- Summary regeneration works
- Onboarding report displays correctly

---

### Group 14: Password Reset

**Purpose**: Password reset functionality

**Files**:
- `src/app/reset-password/page.tsx` (new)
- `src/lib/password-reset-email.ts` (new)
- `src/lib/password-validation.ts` (new)

**Dependencies**:
- Firebase Auth password reset
- Email service

**Testing Required**:
- Password reset emails send
- Reset flow works end-to-end

---

### Group 15: Scheduled Emails

**Purpose**: Scheduled email endpoints for reminders and notifications

**Files**:
- `src/app/api/scheduled-emails/check-in-due-reminders/route.ts` (new)
- `src/app/api/scheduled-emails/check-in-window-open/route.ts` (new)
- `src/app/api/scheduled-emails/check-in-window-close-24h/route.ts` (new)
- `src/app/api/scheduled-emails/check-in-window-close-1h/route.ts` (new)
- `src/app/api/scheduled-emails/check-in-window-closed/route.ts` (new)
- `src/app/api/scheduled-emails/check-in-overdue/route.ts` (updated)
- `src/app/api/scheduled-emails/onboarding-reminders/route.ts` (new)
- `src/app/test-scheduled-emails/page.tsx` (new)

**Dependencies**:
- Cloud Scheduler jobs (to be configured)
- Email service

**Configuration Required**:
- Cloud Scheduler jobs for each endpoint
- Hourly schedules for reminders
- Daily schedules for overdue emails

**Testing Required**:
- Endpoints can be called manually
- Emails send correctly
- Flags prevent duplicate sends

---

### Group 16: Admin Tools & Utilities

**Purpose**: Admin utilities for form management and client cleanup

**Files**:
- `src/app/api/admin/add-questions-to-form/route.ts` (new)
- `src/app/api/admin/check-form-questions/route.ts` (new)
- `src/app/api/admin/cleanup-coaches/route.ts` (new)
- `src/app/api/admin/delete-client-by-email/route.ts` (new)
- `src/app/api/admin/find-client-by-email/route.ts` (new)
- `src/app/api/admin/find-user-by-email/route.ts` (new)
- `src/app/api/admin/fix-vana-form-order/route.ts` (new)
- `src/app/api/admin/fix-vana-form-questions/route.ts` (new)
- `src/app/api/admin/set-vana-form-questions-final/route.ts` (new)
- `src/app/admin/update-vana-form/page.tsx` (new)
- `src/app/api/clear-client-data/route.ts` (new)
- `src/app/api/seed-test-data/route.ts` (new)
- `src/app/test-seed-data/page.tsx` (new)

**Dependencies**: None (admin-only)

**Testing Required**:
- Admin tools work correctly
- Form management functions properly
- Client cleanup works safely

---

### Group 17: Mobile Optimizations

**Purpose**: Mobile-specific UI improvements across multiple pages

**Files**:
- `src/app/client-portal/support/page.tsx` (mobile fixes)
- `src/app/client-portal/check-in/[id]/page.tsx` (mobile improvements)
- `src/app/responses/[id]/page.tsx` (mobile optimizations)
- `src/app/clients/[id]/page.tsx` (mobile sizing)
- Various other mobile improvements

**Dependencies**: None

**Testing Required**:
- Pages render correctly on mobile
- Touch targets are adequate
- Text is readable
- Forms are usable

---

### Group 18: Client Portal Dashboard v2 (Development)

**Purpose**: New dashboard design (development version)

**Files**:
- `src/app/client-portal2/page.tsx` (new - development only)
- `src/app/api/client-portal/banner-image/route.ts` (new)

**Status**: ⚠️ Development only - should NOT be deployed to production yet

**Note**: This is a development version and should remain on feature branch until complete.

---

### Group 19: Documentation & Scripts

**Purpose**: Documentation files and utility scripts

**Files**:
- Various `.md` documentation files
- Scripts in `/scripts` directory
- Configuration files

**Status**: Can be deployed anytime (no code impact)

---

### Group 20: Navigation & UI Improvements

**Purpose**: Navigation reordering, UI polish, small improvements

**Files**:
- `src/components/ClientNavigation.tsx` (menu reordering)
- Various UI improvements and fixes
- Tab visibility fixes
- Profile image display fixes

**Dependencies**: None

**Testing Required**:
- Navigation works correctly
- UI elements display properly

---

## 🎯 Recommended Deployment Order

### Phase 1: Critical Security (Group 2)
**Priority**: 🔴 CRITICAL  
**Risk**: Low  
**Impact**: High (security fixes)

### Phase 2: Image Compression (Group 1)
**Status**: ✅ Already deployed

### Phase 3: Support Section (Group 3)
**Priority**: 🟡 High  
**Risk**: Low  
**Impact**: Medium (new client-facing feature)

### Phase 4: Email Tracking (Group 5)
**Priority**: 🟡 High  
**Risk**: Medium (requires webhook configuration)  
**Impact**: Medium (better email analytics)

### Phase 5: Profile Personalization (Group 4)
**Priority**: 🟢 Medium  
**Risk**: Low  
**Impact**: Medium (user engagement)

### Phase 6: Check-in Extensions (Group 6)
**Priority**: 🟢 Medium  
**Risk**: Low  
**Impact**: Medium (user experience)

### Phase 7: Analytics & Dashboard (Group 7)
**Priority**: 🟢 Medium  
**Risk**: Low  
**Impact**: Medium (better insights)

### Phase 8: Client Profile Enhancements (Groups 8, 9)
**Priority**: 🟢 Medium  
**Risk**: Medium (major refactor)  
**Impact**: High (coach workflow improvements)

### Phase 9: Goals Questionnaire (Group 10)
**Priority**: 🟢 Medium  
**Risk**: Medium  
**Impact**: Medium (new feature)

### Phase 10: AI Analytics (Group 11)
**Priority**: 🟢 Medium  
**Risk**: High (AI dependencies)  
**Impact**: High (coach insights)

### Phase 11: Photo Gallery (Group 12)
**Priority**: 🟢 Medium  
**Risk**: Low  
**Impact**: Low (nice-to-have)

### Phase 12: Onboarding Enhancements (Group 13)
**Priority**: 🟢 Medium  
**Risk**: Low  
**Impact**: Medium

### Phase 13: Password Reset (Group 14)
**Priority**: 🟡 High  
**Risk**: Medium  
**Impact**: High (user support)

### Phase 14: Scheduled Emails (Group 15)
**Priority**: 🟢 Medium  
**Risk**: Medium (requires Cloud Scheduler)  
**Impact**: High (automation)

### Phase 15: Mobile Optimizations (Group 17)
**Priority**: 🟡 High  
**Risk**: Low  
**Impact**: High (user experience)

### Phase 16: Navigation & UI (Group 20)
**Priority**: 🟢 Low  
**Risk**: Low  
**Impact**: Low (polish)

### Phase 17: Admin Tools (Group 16)
**Priority**: 🟢 Low  
**Risk**: Low (admin-only)  
**Impact**: Low (internal tools)

### Phase 18: Documentation (Group 19)
**Priority**: 🟢 Low  
**Risk**: None  
**Impact**: None (documentation only)

---

## ⚠️ Groups to Exclude from Initial Deployment

### Group 18: Client Portal Dashboard v2
**Reason**: Development version, not ready for production  
**Action**: Keep on feature branch until complete

---

## 📝 Next Steps

1. **Revert the merge** to `main` (go back to commit 9b014bb)
2. **Create feature branches** for each partition group
3. **Deploy groups sequentially** starting with Phase 1 (Security)
4. **Test each phase** before moving to the next
5. **Keep Dashboard v2** on feature branch until ready

---

## 🔧 How to Partition

For each group:
1. Create a new branch from `9b014bb` (current clean main)
2. Cherry-pick or manually add the files for that group
3. Test build and functionality
4. Merge to main and deploy
5. Repeat for next group

---

## 📊 Summary Statistics

- **Total Groups**: 20
- **Critical Groups**: 1 (Security)
- **High Priority Groups**: 4 (Support, Email Tracking, Password Reset, Mobile)
- **Medium Priority Groups**: 8
- **Low Priority Groups**: 7
- **Exclude from Deployment**: 1 (Dashboard v2)

**Estimated Deployment Time**: 2-3 weeks (deploying 1-2 groups per day)

