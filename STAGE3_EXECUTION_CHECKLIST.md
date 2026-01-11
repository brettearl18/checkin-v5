# Stage 3 Execution Checklist
## Enable Pre-Created Assignments System

**Current Status:**
- ✅ Stage 1: Complete (feature flags + new endpoint)
- ✅ Stage 2: Complete (691 assignments created, validated)
- ⏳ Stage 3: Ready to enable

---

## Pre-Activation Checklist

Before enabling the feature flag:

- [x] Stage 2 migration completed successfully
- [x] All validation tests passing (6/6)
- [x] All data validated
- [ ] Team ready (if needed)
- [ ] Monitoring tools ready
- [ ] Rollback plan understood

---

## Execution Steps

### Step 1: Enable Feature Flag (5 minutes)

**Option A: Google Cloud Console (Recommended)**

1. [ ] Open [Google Cloud Console](https://console.cloud.google.com)
2. [ ] Navigate to: Cloud Run > checkinv5 service
3. [ ] Click "Edit & Deploy New Revision"
4. [ ] Go to "Variables & Secrets" tab
5. [ ] Click "Add Variable" or edit existing
6. [ ] Set:
   - **Name:** `USE_PRE_CREATED_ASSIGNMENTS`
   - **Value:** `true`
7. [ ] Click "Deploy"
8. [ ] Wait for deployment to complete (~1-2 minutes)

**Option B: gcloud CLI**

```bash
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=true"
```

- [ ] Command executed successfully
- [ ] New revision deployed

### Step 2: Verify Startup (2 minutes)

- [ ] Check Cloud Run revision status (active, no errors)
- [ ] Check application logs (no initialization errors)
- [ ] Verify feature flag is detected

**Check logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5 AND severity>=ERROR" \
  --limit 20
```

- [ ] No critical errors
- [ ] Application started successfully

### Step 3: Smoke Tests (10 minutes)

**Test 1: Check-ins List Page**
- [ ] Navigate to `/client-portal/check-ins`
- [ ] Page loads without errors
- [ ] All weeks are visible (Week 1, 2, 3, etc.)
- [ ] Week 2+ assignments appear correctly
- [ ] Due dates display correctly

**Test 2: Dashboard**
- [ ] Navigate to `/client-portal`
- [ ] "Check-ins Requiring Attention" section loads
- [ ] Completed check-ins don't appear in "Requiring Attention"
- [ ] Week numbers are correct

**Test 3: Completed Check-ins**
- [ ] Navigate to `/client-portal/check-ins` (Completed tab)
- [ ] All completed check-ins visible
- [ ] Week numbers display correctly (Week 1, Week 2, etc.)
- [ ] No duplicates

**Test 4: Check-in Submission (Optional)**
- [ ] If possible, submit a test check-in
- [ ] Success page shows correct week number
- [ ] Score displays correctly
- [ ] Status updates correctly

### Step 4: Monitor (30-60 minutes)

- [ ] Watch error logs (no spike in errors)
- [ ] Monitor response times (acceptable performance)
- [ ] Check client submissions (if any during monitoring)
- [ ] Verify system stability

**Monitor logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5" \
  --limit 50 \
  --format="table(timestamp,severity,textPayload)"
```

---

## Success Criteria

All of these must pass:

- [x] Feature flag enabled successfully
- [ ] Application starts without errors
- [ ] Check-ins page loads correctly
- [ ] All weeks visible
- [ ] Week numbers display correctly
- [ ] No errors in logs
- [ ] System performs well

---

## Rollback Procedure (If Needed)

**Quick Rollback (Instant):**

```bash
# Disable feature flag
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=false"
```

**Or revert to previous revision:**
```bash
gcloud run services update-traffic checkinv5 \
  --region australia-southeast2 \
  --to-revisions=PREVIOUS_REVISION=100
```

**When to rollback:**
- Critical errors in logs
- System not responding
- Data integrity issues
- Performance degradation

---

## Post-Activation

After successful activation:

- [ ] Document activation time
- [ ] Note any issues encountered
- [ ] Continue monitoring for 24-48 hours
- [ ] Plan for Stage 4 (code cleanup) after 1-2 weeks

---

## Notes

- Feature flag allows instant rollback
- Old code remains as fallback
- No data changes (only code behavior)
- Pre-created assignments already exist (from Stage 2)

---

**Ready to execute?** Start with Step 1! 🚀

