# Maintenance Window Plan
## Migration to Pre-Created Assignments

---

## 📅 Scheduling

### Recommended Time Windows

**Option 1: Low-Traffic Period (Recommended)**
- **Day:** Weekend (Saturday or Sunday)
- **Time:** Early morning (2:00 AM - 6:00 AM AWST)
- **Duration:** 4-6 hours allocated
- **Expected Actual:** 2-3 hours
- **Why:** Minimal user activity, reduces impact

**Option 2: Business Hours (If Weekend Not Possible)**
- **Day:** Weekday
- **Time:** 8:00 AM - 12:00 PM AWST (before peak hours)
- **Duration:** 4 hours allocated
- **Expected Actual:** 2-3 hours
- **Why:** Team available, can respond quickly

### Critical Considerations

- ✅ **Australian Time Zone** - All times in AWST (Australia/Perth)
- ✅ **User Notification** - Notify clients 24-48 hours in advance
- ✅ **Team Availability** - Ensure CTO/Dev team available
- ✅ **Backup Systems** - Verify backup systems accessible
- ✅ **Rollback Ready** - Have rollback plan tested

---

## 🔔 Pre-Maintenance Communication

### Client Notification (24-48 Hours Before)

**Email Template:**
```
Subject: Scheduled Maintenance - Check-In System Update

Dear Vana Health Clients,

We will be performing a scheduled maintenance window to improve the check-in system.

Date: [DATE]
Time: [START TIME] - [END TIME] AWST
Duration: Approximately 2-3 hours

During this time:
- Check-ins may be temporarily unavailable
- Existing data will remain safe
- No action required from you

We apologize for any inconvenience and will have the system back online as soon as possible.

Thank you for your patience.

Vana Health Team
```

**Internal Notification:**
- Email to coaches
- Slack/Discord notification
- Dashboard banner (optional)

---

## ✅ Pre-Maintenance Checklist (24 Hours Before)

### Environment & Access
- [ ] All team members have access to:
  - Firebase Console
  - Cloud Run/Deployment environment
  - Git repository
  - Monitoring/logging tools
- [ ] VPN/access credentials verified
- [ ] Team communication channel ready (Slack/Discord)

### Scripts & Tools
- [ ] Migration script tested on staging
- [ ] Validation script ready
- [ ] Backup script ready
- [ ] Rollback script ready (if needed)
- [ ] Audit script ready

### Code & Configuration
- [ ] Feature flag code deployed
- [ ] New API endpoints deployed (disabled)
- [ ] Feature flag set to `false` (use old system)
- [ ] Code reviewed and approved

### Data & Backup
- [ ] Pre-migration audit completed
- [ ] Backup location verified
- [ ] Backup restore tested (on staging)
- [ ] Database access verified

### Monitoring
- [ ] Error monitoring active
- [ ] Log aggregation accessible
- [ ] Performance metrics dashboard ready
- [ ] Alert channels configured

---

## 🚀 Maintenance Window Execution

### Phase 1: Preparation (30 minutes)

**Time: T-30 minutes**

#### Step 1.1: Final Pre-Checks
```bash
# Verify system status
- [ ] No active check-ins in progress (check recent submissions)
- [ ] All systems operational
- [ ] Team ready and online
```

#### Step 1.2: Create Pre-Migration Snapshot
```bash
# Run pre-migration audit
node scripts/audit-all-client-checkins.js > MAINTENANCE_PRE_MIGRATION_$(date +%Y%m%d_%H%M%S).md

# Document baseline counts
- Total clients: ___
- Total responses: ___
- Total assignments: ___
```

#### Step 1.3: Backup Production Data
```bash
# Option 1: Export via Firebase Admin SDK
node scripts/backup-production-data.js

# Option 2: Manual export via Firebase Console
# - Export formResponses collection
# - Export check_in_assignments collection
# - Save to secure location
```

**Validation:**
- [ ] Backup files created
- [ ] Backup file sizes reasonable
- [ ] Backup location accessible

### Phase 2: Data Migration (60-90 minutes)

**Time: T-0 (Start of Maintenance)**

#### Step 2.1: Enable Maintenance Mode (Optional)
```bash
# Optional: Show maintenance banner to users
# Update environment variable
MAINTENANCE_MODE=true

# Deploy update (if maintenance mode implemented)
# Or: Use Cloud Run traffic splitting to show maintenance page
```

#### Step 2.2: Run Migration Script (DRY-RUN First)
```bash
# First, run in dry-run mode to verify
node scripts/migrate-to-precreated-assignments.js --dry-run

# Review output:
- [ ] Expected assignments to create: ___
- [ ] Expected responses to link: ___
- [ ] Estimated storage impact: ___
- [ ] No unexpected errors
```

#### Step 2.3: Run Migration Script (Real)
```bash
# Run actual migration
node scripts/migrate-to-precreated-assignments.js

# Monitor output:
- [ ] Watch for errors
- [ ] Check progress logs
- [ ] Verify completion status
```

**During Migration:**
- Monitor script progress
- Watch for errors in logs
- Keep team updated via communication channel
- **DO NOT** interrupt script unless critical error

#### Step 2.4: Validate Migration Results
```bash
# Run validation script
node scripts/validate-migration.js

# Verify:
- [ ] All responses preserved (count matches)
- [ ] All assignments created (expected count)
- [ ] All links valid
- [ ] No data integrity issues
```

**Success Criteria:**
- ✅ Response count matches pre-migration
- ✅ Assignment count increased by expected amount
- ✅ All response → assignment links valid
- ✅ All assignment → response links valid
- ✅ Zero errors in validation

#### Step 2.5: Post-Migration Audit
```bash
# Generate post-migration audit
node scripts/audit-all-client-checkins.js > MAINTENANCE_POST_MIGRATION_$(date +%Y%m%d_%H%M%S).md

# Compare with pre-migration:
- [ ] All clients present
- [ ] All responses present
- [ ] Week assignments created correctly
- [ ] Week numbers accurate
```

### Phase 3: Code Activation (30 minutes)

**Time: T+90 minutes (after data migration validated)**

#### Step 3.1: Enable Feature Flag

**For Cloud Run deployment:**

```bash
# Update environment variable in Cloud Run
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=true"

# This will create a new revision and deploy it
# The new revision will start with the feature flag enabled
```

**Or via Google Cloud Console:**
1. Go to Cloud Run > checkinv5 service
2. Click "Edit & Deploy New Revision"
3. Go to "Variables & Secrets" tab
4. Add/update environment variable: `USE_PRE_CREATED_ASSIGNMENTS=true`
5. Click "Deploy" (creates new revision)

**Note:** New revision will deploy automatically. Old revision stays active until traffic switches (automatic).

**Rollback (if needed):**
```bash
# Revert to previous revision
gcloud run services update-traffic checkinv5 \
  --region australia-southeast2 \
  --to-revisions=PREVIOUS_REVISION=100

# Or disable feature flag in new revision
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=false"
```

**Deployment Method: Cloud Run**

```bash
# Option 1: Update environment variable via gcloud CLI
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=true"

# Option 2: Update via Google Cloud Console
# - Go to Cloud Run > checkinv5 service
# - Click "Edit & Deploy New Revision"
# - Go to "Variables & Secrets" tab
# - Add/update: USE_PRE_CREATED_ASSIGNMENTS=true
# - Deploy new revision
```

#### Step 3.2: Verify System Startup
```bash
# Check Cloud Run revision status
gcloud run services describe checkinv5 \
  --region australia-southeast2 \
  --format="value(status.conditions)"

# Check application logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5" \
  --limit 50 \
  --format="table(timestamp,textPayload)"

# Verify:
- [ ] New revision deployed successfully
- [ ] Application starts without errors
- [ ] Feature flag detected correctly
- [ ] New code paths active
- [ ] No initialization errors
- [ ] Traffic routing to new revision
```

#### Step 3.3: Smoke Tests
```bash
# Run quick smoke tests
1. Load check-ins page (client portal)
2. Verify Week 2+ assignments visible
3. Load dashboard
4. Verify check-in statuses correct
5. Test submission (if possible)
```

**Manual Tests:**
- [ ] Client portal loads
- [ ] Check-ins list shows all weeks
- [ ] Dashboard shows correct status
- [ ] Success page works (if test submission possible)
- [ ] History page shows correct weeks

### Phase 4: Monitoring (30-60 minutes)

**Time: T+120 minutes**

#### Step 4.1: Active Monitoring
```bash
# Monitor Cloud Run metrics (via console or CLI)
# Google Cloud Console: Cloud Run > checkinv5 > Metrics tab

# Watch error logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5 AND severity>=ERROR" \
  --limit 20 \
  --format="table(timestamp,severity,textPayload)"

# Monitor for 30-60 minutes:
- [ ] Error logs (watch for errors)
- [ ] API response times (check Cloud Run metrics)
- [ ] Request count (should be normal)
- [ ] CPU/Memory usage (should be normal)
- [ ] Client submissions (if any during window)
- [ ] System performance metrics
```

**Monitoring Checklist:**
- [ ] No spike in errors
- [ ] Response times acceptable
- [ ] No memory leaks
- [ ] Database query performance good

#### Step 4.2: User Acceptance Testing (Optional)
```bash
# If possible, have test users verify:
1. Submit a test check-in
2. Verify week number displays correctly
3. Verify success page works
4. Verify dashboard updates
```

### Phase 5: Completion (30 minutes)

**Time: T+180 minutes**

#### Step 5.1: Final Validation
```bash
# Final checks:
- [ ] All systems operational
- [ ] No errors in logs
- [ ] Performance metrics normal
- [ ] User-facing functionality working
```

#### Step 5.2: Disable Maintenance Mode
```bash
# Remove maintenance banner (if enabled)
MAINTENANCE_MODE=false

# Restore full traffic (if traffic splitting used)
```

#### Step 5.3: Post-Maintenance Communication
```
✅ Maintenance Complete Notification:

Subject: Maintenance Complete - System Back Online

Dear Vana Health Clients,

The scheduled maintenance has been completed successfully.

All systems are back online and fully operational.

New features:
- Improved check-in system
- Better week tracking
- Enhanced data integrity

If you experience any issues, please contact support.

Thank you for your patience.

Vana Health Team
```

---

## 🚨 Rollback Procedures

### If Migration Fails

**Scenario 1: Script Errors During Migration**
```bash
1. Stop script (Ctrl+C)
2. Review error logs
3. Assess impact:
   - What assignments were created?
   - What links were updated?
4. If minimal impact:
   - Fix issue
   - Re-run script (idempotent, safe to re-run)
5. If significant issue:
   - Restore from backup
   - Investigate cause
   - Reschedule maintenance
```

**Scenario 2: Data Validation Fails**
```bash
1. Review validation errors
2. Check data integrity:
   - Missing assignments?
   - Invalid links?
   - Data corruption?
3. If fixable:
   - Run fix script (if available)
   - Re-run validation
4. If not fixable:
   - Restore from backup
   - Investigate cause
   - Reschedule maintenance
```

**Scenario 3: Code Activation Issues**
```bash
# Quick rollback: Revert to previous revision
gcloud run services update-traffic checkinv5 \
  --region australia-southeast2 \
  --to-revisions=PREVIOUS_REVISION=100

# Or disable feature flag in current revision
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=false"

# System reverts to old dynamic generation immediately
# Pre-created assignments remain (harmless)

# Investigate issue:
# - Check Cloud Run logs
# - Review code changes
# - Test on staging

# Fix and retry (or reschedule)
```

**Scenario 4: Post-Activation Issues**
```bash
# Monitor error patterns in Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5" \
  --limit 50 \
  --format json

# If critical:
# Revert to previous revision (instant rollback)
gcloud run services update-traffic checkinv5 \
  --region australia-southeast2 \
  --to-revisions=PREVIOUS_REVISION=100

# System uses old code immediately
# Pre-created assignments stay (no harm)

# If minor:
# - Fix in place (update code, redeploy)
# - Monitor closely via Cloud Run metrics
```

### Rollback Checklist

- [ ] Feature flag can be toggled
- [ ] Rollback tested on staging
- [ ] Team knows rollback procedure
- [ ] Communication ready (if rollback needed)

---

## 📊 Success Metrics

### During Maintenance Window

**Phase 2 (Data Migration):**
- [ ] Migration script completes successfully
- [ ] Validation passes (100% data integrity)
- [ ] Zero errors in logs
- [ ] Time within expected window (<90 minutes)

**Phase 3 (Code Activation):**
- [ ] Feature flag toggles correctly
- [ ] Application starts without errors
- [ ] Smoke tests pass
- [ ] System responsive

**Phase 4 (Monitoring):**
- [ ] No errors in logs
- [ ] Response times acceptable
- [ ] System stable
- [ ] Ready for production traffic

### Post-Maintenance (24 Hours)

- [ ] No spike in errors
- [ ] User submissions working
- [ ] Week numbers displaying correctly
- [ ] No support tickets related to migration
- [ ] Performance metrics normal

---

## 👥 Team Roles & Responsibilities

### CTO/Lead Developer
- Overall migration execution
- Decision-making during window
- Rollback authorization
- Issue resolution

### Developer 2 (Backup)
- Monitor logs and metrics
- Assist with troubleshooting
- Communication coordination
- Documentation

### QA/Tester (If Available)
- Smoke testing
- User acceptance testing
- Validation checks
- Issue reporting

---

## 📝 Maintenance Window Log Template

**Date:** ___________
**Time:** ___________
**Duration:** ___________

### Pre-Migration
- [ ] Pre-migration audit completed
- [ ] Backup created
- [ ] Team ready

### Migration
- [ ] Dry-run completed: ___________
- [ ] Migration executed: ___________
- [ ] Validation passed: ___________
- [ ] Issues encountered: ___________

### Activation
- [ ] Feature flag enabled: ___________
- [ ] Smoke tests passed: ___________
- [ ] System stable: ___________

### Post-Migration
- [ ] Monitoring period complete
- [ ] No critical issues
- [ ] System ready

**Notes:**
_________________________________
_________________________________
_________________________________

**Signed off by:** ___________

---

## 🔄 Alternative: Phased Rollout (No Maintenance Window)

If a maintenance window is not possible, consider:

### Phased Approach:
1. **Week 1:** Migrate data (no code changes)
   - Create pre-created assignments
   - Old code still works
   - No user impact

2. **Week 2:** Enable for subset of users
   - Feature flag based on user ID
   - Test with small group
   - Monitor closely

3. **Week 3:** Full rollout
   - Enable for all users
   - Monitor for issues
   - Keep rollback ready

**Advantages:**
- No downtime
- Lower risk
- Can test incrementally

**Disadvantages:**
- Longer timeline
- More complex (need user-based feature flag)

---

## ✅ Final Pre-Maintenance Checklist

**24 Hours Before:**
- [ ] Date/time confirmed
- [ ] Team availability confirmed
- [ ] Client notification sent
- [ ] Scripts tested on staging
- [ ] Backup strategy ready
- [ ] Rollback plan understood
- [ ] Communication channels ready

**1 Hour Before:**
- [ ] Team online
- [ ] Access verified
- [ ] Monitoring active
- [ ] Scripts ready
- [ ] Backup location accessible

**Start Time:**
- [ ] Pre-migration audit complete
- [ ] Backup created
- [ ] Ready to proceed

---

## 📞 Emergency Contacts

- **CTO/Lead:** ___________
- **Backup Developer:** ___________
- **Infrastructure:** ___________
- **Support:** ___________

---

**Ready to schedule maintenance window?** 🚀

Choose a date/time and we can customize this plan for your specific schedule.

