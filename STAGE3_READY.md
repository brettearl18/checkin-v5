# Stage 3 Ready: Enable New System
## Code Activation

**Status:** ✅ READY  
**Risk Level:** ⚠️ MEDIUM (can rollback instantly with feature flag)

---

## What Stage 3 Does

Enable the new pre-created assignments system by turning on the feature flag.

**Before (Feature Flag OFF):**
- Uses old dynamic generation system
- Complex code, data integrity issues

**After (Feature Flag ON):**
- Uses new simplified pre-created assignments system
- Simple queries, all weeks exist as documents
- Better data integrity

---

## Steps

### Step 3.1: Enable Feature Flag on Cloud Run

**Method 1: Via Google Cloud Console (Easiest)**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: Cloud Run > checkinv5 service
3. Click "Edit & Deploy New Revision"
4. Go to "Variables & Secrets" tab
5. Click "Add Variable"
6. Name: `USE_PRE_CREATED_ASSIGNMENTS`
7. Value: `true`
8. Click "Deploy" (creates new revision)

**Method 2: Via gcloud CLI**
```bash
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=true"
```

### Step 3.2: Verify System Startup

After deployment, check:
- ✅ New revision deployed successfully
- ✅ Application starts without errors
- ✅ No errors in Cloud Run logs

**Check logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5" \
  --limit 50 \
  --format="table(timestamp,textPayload)"
```

### Step 3.3: Smoke Tests

Test the system to verify it works:

1. **Check-ins Page**
   - Load `/client-portal/check-ins`
   - Verify all weeks are visible
   - Verify Week 2+ assignments appear

2. **Dashboard**
   - Load `/client-portal`
   - Verify "Check-ins Requiring Attention" is correct
   - Verify completed check-ins don't appear in "Requiring Attention"

3. **Success Page (if possible)**
   - Submit a test check-in (if allowed)
   - Verify week number displays correctly
   - Verify "Week 2" shows as "Week 2" (not "Week 1")

4. **History Page**
   - Load `/client-portal/check-ins` (Completed tab)
   - Verify week numbers are correct
   - Verify "Week 2" appears correctly

### Step 3.4: Monitor (30-60 minutes)

Watch for issues:
- ✅ No errors in logs
- ✅ Response times acceptable
- ✅ Client submissions work
- ✅ Week numbers display correctly

---

## Rollback (If Needed)

**Instant Rollback:**
```bash
# Revert to previous revision
gcloud run services update-traffic checkinv5 \
  --region australia-southeast2 \
  --to-revisions=PREVIOUS_REVISION=100

# Or disable feature flag
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=false"
```

**Safety:**
- Old code remains as fallback
- Can rollback instantly
- No data changes (only code behavior changes)

---

## Success Criteria

- ✅ Feature flag enabled
- ✅ Application starts successfully
- ✅ Check-ins page loads correctly
- ✅ All weeks visible
- ✅ Week numbers display correctly
- ✅ No errors in logs
- ✅ System performs well

---

## Timeline

- **Enable feature flag:** 2-5 minutes
- **Verify startup:** 1-2 minutes
- **Smoke tests:** 5-10 minutes
- **Monitoring:** 30-60 minutes

**Total:** ~1 hour for initial activation and testing

---

## After Stage 3

Once Stage 3 is stable (1-2 weeks):
- **Stage 4:** Remove old code (cleanup)
- Simpler codebase
- Better maintainability

---

**Ready to enable?** Just set the feature flag and monitor! 🚀

